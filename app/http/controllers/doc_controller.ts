import type { Context } from '@strav/http'
import { sql } from '@strav/database'
import type { CurrentUser } from '#policies/auth_policy'
import { renderMarkdown } from '#config/markdown'

/**
 * Slice 003 — doc read view.
 *
 * Routes:
 *   GET /workspaces/:slug/spaces/:space_slug/d/:doc_slug  → show()
 *
 * Mounted under `currentUser` + `tenantContext` + `authorize(spacePolicy,
 * 'canViewSpace')`. tenant_context resolves the workspace + binds
 * `withTenant`; the SELECTs below run RLS-scoped.
 *
 * Per ADR-0007: the served revision is always `doc.current_revision_id`,
 * never a draft.
 */
export default class DocController {
  /**
   * `GET /workspaces/:slug/spaces/:space_slug/d/:doc_slug`
   * Renders `docs/read.strav` with the rendered HTML, the doc + space
   * metadata, and a TOC built from the markdown's headings.
   */
  async show(ctx: Context) {
    const user = ctx.get<CurrentUser>('user')
    const workspace = ctx.get<{ id: number; slug: string; name: string }>('workspace')
    const membershipRole = ctx.get<string>('membershipRole')
    const spaceSlug = ctx.params.space_slug
    const docSlug = ctx.params.doc_slug

    // Resolve the space (slug → id) under the current tenant.
    const spaces = (await sql`
      SELECT "id", "slug", "name", "template", "visibility"
      FROM "space"
      WHERE "slug" = ${spaceSlug}
      LIMIT 1
    `) as Array<{
      id: number
      slug: string
      name: string
      template: string
      visibility: string
    }>
    if (spaces.length === 0) return ctx.json({ error: 'not_found' }, 404)
    const space = spaces[0]!

    // Resolve the doc + its current revision content.
    const docs = (await sql`
      SELECT "d"."id"     AS "doc_id",
             "d"."slug"   AS "doc_slug",
             "d"."title"  AS "doc_title",
             "d"."folder_path" AS "folder_path",
             "r"."id"     AS "rev_id",
             "r"."content" AS "rev_content",
             "r"."author_id" AS "author_id",
             "r"."created_at" AS "rev_created_at"
      FROM "doc" "d"
      INNER JOIN "revision" "r"
        ON "r"."id" = "d"."current_revision_id"
       AND "r"."workspace_id" = "d"."workspace_id"
      WHERE "d"."space_id" = ${space.id}
        AND "d"."slug"     = ${docSlug}
      LIMIT 1
    `) as Array<{
      doc_id: number
      doc_slug: string
      doc_title: string
      folder_path: string
      rev_id: number | null
      rev_content: string | null
      author_id: number | null
      rev_created_at: Date | null
    }>
    if (docs.length === 0 || !docs[0]!.rev_content) {
      return ctx.json({ error: 'not_found' }, 404)
    }
    const doc = docs[0]!

    const html = await renderMarkdown(doc.rev_content!)

    const sidebarSpaces = (await sql`
      SELECT "slug", "name", "template"
      FROM "space"
      ORDER BY "id" ASC
    `) as Array<{ slug: string; name: string; template: string }>

    return ctx.view('docs/read', {
      user,
      workspace,
      membershipRole,
      space,
      doc: {
        id: doc.doc_id,
        slug: doc.doc_slug,
        title: doc.doc_title,
        folderPath: doc.folder_path,
      },
      revision: {
        id: doc.rev_id,
        createdAt: doc.rev_created_at,
      },
      html,
      sidebarSpaces,
    })
  }
}
