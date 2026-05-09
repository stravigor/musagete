import { sql } from '@strav/database'
import { getTemplate } from '#services/spaces/space_templates'

/**
 * Space service — handles wizard-driven space creation.
 *
 * Atomicity: space + space_defaults + every seeded doc + every initial
 * revision land inside a single `sql.begin(...)` transaction; partial
 * failures roll back. Single-connection design (slice 002 Scenario 1
 * pattern): the tenant_context middleware has already bound
 * `withTenant(workspaceId, …)` for the request, so every `tx` query
 * inside the begin block runs with `app.tenant_id` set — RLS on the
 * tenanted tables (`space`, `space_defaults`, `doc`, `revision`)
 * passes without per-query `set_config` calls.
 *
 * Per-tenant id sequences: tenant tables use `tenantedBigSerial`, so
 * `INSERT … RETURNING id` reads the id assigned by the
 * `<table>_assign_tenanted_id` trigger.
 */

export type CreateSpaceInput = {
  workspaceId: number
  template: string
  name: string
  slug: string
  visibility: 'protected' | 'private'
  authorId: number
  /**
   * Wizard step 3 toggle overrides. Each field overrides the template's
   * default if provided; missing fields fall back to the template default.
   */
  defaultOverrides?: {
    requireReview?: boolean
    allowComments?: boolean
    aiIndex?: boolean
  }
}

export type CreateSpaceResult =
  | {
      kind: 'created'
      spaceId: number
      slug: string
    }
  | { kind: 'unknown_template' }
  | { kind: 'slug_taken' }

export async function createSpace(input: CreateSpaceInput): Promise<CreateSpaceResult> {
  const template = getTemplate(input.template)
  if (!template) return { kind: 'unknown_template' }

  return sql.begin(async (tx) => {
    // 1. Insert the space row. ON CONFLICT DO NOTHING avoids the TOCTOU
    //    window of a pre-check; the (workspace_id, slug) UNIQUE constraint
    //    yields zero rows on collision.
    const insertedSpace = (await tx`
      INSERT INTO "space" ("workspace_id", "slug", "name", "visibility", "template")
      VALUES (${input.workspaceId}, ${input.slug}, ${input.name}, ${input.visibility}, ${input.template})
      ON CONFLICT ("workspace_id", "slug") DO NOTHING
      RETURNING "id", "slug"
    `) as Array<{ id: number; slug: string }>

    if (insertedSpace.length === 0) {
      return { kind: 'slug_taken' as const }
    }

    const space = insertedSpace[0]!

    // 2. space_defaults — one row per space. Wizard step 3 toggles
    //    override the template defaults per-field; missing overrides fall
    //    back to the template's value (Scenario 3 covers this layering).
    const defaults = {
      requireReview:
        input.defaultOverrides?.requireReview ?? template.defaults.requireReview,
      allowComments:
        input.defaultOverrides?.allowComments ?? template.defaults.allowComments,
      aiIndex:
        input.defaultOverrides?.aiIndex ?? template.defaults.aiIndex,
    }

    await tx`
      INSERT INTO "space_defaults" (
        "workspace_id", "space_id",
        "require_review", "allow_comments", "ai_index"
      )
      VALUES (
        ${input.workspaceId}, ${space.id},
        ${defaults.requireReview},
        ${defaults.allowComments},
        ${defaults.aiIndex}
      )
    `

    // 3. Seeded docs + initial revisions. For each doc in the template:
    //    INSERT doc → INSERT revision → UPDATE doc.current_revision_id
    //    so the doc is queryable as a published document immediately.
    for (const seed of template.docs) {
      const insertedDoc = (await tx`
        INSERT INTO "doc" (
          "workspace_id", "space_id",
          "slug", "title", "folder_path"
        )
        VALUES (
          ${input.workspaceId}, ${space.id},
          ${seed.slug}, ${seed.title}, ${seed.folderPath}
        )
        RETURNING "id"
      `) as Array<{ id: number }>
      const docId = insertedDoc[0]!.id

      const insertedRevision = (await tx`
        INSERT INTO "revision" (
          "workspace_id", "doc_id", "author_id",
          "message", "content", "status"
        )
        VALUES (
          ${input.workspaceId}, ${docId}, ${input.authorId},
          ${'Seed from template: ' + template.id},
          ${seed.body},
          'published'
        )
        RETURNING "id"
      `) as Array<{ id: number }>
      const revisionId = insertedRevision[0]!.id

      await tx`
        UPDATE "doc"
        SET "current_revision_id" = ${revisionId}
        WHERE "workspace_id" = ${input.workspaceId}
          AND "id"           = ${docId}
      `
    }

    return {
      kind: 'created' as const,
      spaceId: space.id,
      slug: space.slug,
    }
  })
}
