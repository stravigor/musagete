import { sql } from '@strav/database'

/**
 * Toggle space defaults — slice 002 § Interface contract:
 *   PATCH /workspaces/:slug/spaces/:space_slug/defaults
 *
 * Per-field optional update; missing fields keep their current value.
 * Caller runs inside `withTenant(workspaceId, …)` (the tenant_context
 * middleware ensures this for `/workspaces/:slug/...` routes), so the
 * UPDATE is RLS-scoped to the current tenant.
 *
 * Returns `kind: 'updated'` with the post-update row, or `kind: 'not_found'`
 * if the space slug doesn't resolve in the current tenant.
 */

export type UpdateSpaceDefaultsInput = {
  spaceSlug: string
  fields: {
    requireReview?: boolean
    allowComments?: boolean
    aiIndex?: boolean
  }
}

export type UpdateSpaceDefaultsResult =
  | {
      kind: 'updated'
      requireReview: boolean
      allowComments: boolean
      aiIndex: boolean
    }
  | { kind: 'not_found' }

export async function updateSpaceDefaults(
  input: UpdateSpaceDefaultsInput,
): Promise<UpdateSpaceDefaultsResult> {
  // Resolve the space by slug under the current tenant. RLS filters
  // cross-tenant rows out automatically.
  const spaces = (await sql`
    SELECT "id" FROM "space" WHERE "slug" = ${input.spaceSlug} LIMIT 1
  `) as Array<{ id: number }>
  if (spaces.length === 0) return { kind: 'not_found' }
  const spaceId = spaces[0]!.id

  // No-op if no fields supplied — return the current row.
  const { requireReview, allowComments, aiIndex } = input.fields
  const hasUpdates =
    requireReview !== undefined ||
    allowComments !== undefined ||
    aiIndex !== undefined

  if (hasUpdates) {
    await sql`
      UPDATE "space_defaults"
      SET
        "require_review" = COALESCE(${requireReview ?? null}, "require_review"),
        "allow_comments" = COALESCE(${allowComments ?? null}, "allow_comments"),
        "ai_index"       = COALESCE(${aiIndex ?? null}, "ai_index")
      WHERE "space_id" = ${spaceId}
    `
  }

  const rows = (await sql`
    SELECT "require_review", "allow_comments", "ai_index"
    FROM "space_defaults"
    WHERE "space_id" = ${spaceId}
    LIMIT 1
  `) as Array<{
    require_review: boolean
    allow_comments: boolean
    ai_index: boolean
  }>
  if (rows.length === 0) return { kind: 'not_found' }
  const row = rows[0]!

  return {
    kind: 'updated',
    requireReview: row.require_review,
    allowComments: row.allow_comments,
    aiIndex: row.ai_index,
  }
}
