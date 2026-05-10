import type { Context } from '@strav/http'
import { validate, required, string } from '@strav/http'
import { sql } from '@strav/database'
import type { CurrentUser } from '#policies/auth_policy'
import { createWorkspace } from '#services/workspaces/workspace_service'

/**
 * Slice 002 — workspace creation.
 *
 * Routes:
 *   POST /workspaces  → create()
 *
 * Auth required (any signed-in user). Per Tech Spec § Boundary, the
 * `/workspaces/:slug/...` group runs under `tenantContext` middleware;
 * this endpoint is OUTSIDE that group because it creates the tenant row
 * itself.
 */
export default class WorkspaceController {
  /**
   * `GET /workspaces/new`
   * Renders the workspace-creation form (mounts the `WorkspaceForm` island).
   * Auth required.
   */
  async newForm(ctx: Context) {
    return ctx.view('workspaces/new', {})
  }

  /**
   * `GET /workspaces/:slug`
   * Workspace landing page — lists the workspace's spaces with links to
   * read views, plus a "Create your first space" CTA when empty.
   *
   * Runs under `tenantContext` (slug → workspace.id, membership verified,
   * `withTenant` bound), so the SELECT on `space` is RLS-scoped.
   */
  async show(ctx: Context) {
    const user = ctx.get<CurrentUser>('user')
    const workspace = ctx.get<{ id: number; slug: string; name: string }>('workspace')
    const membershipRole = ctx.get<string>('membershipRole')

    const spaces = (await sql`
      SELECT "slug", "name", "template", "visibility"
      FROM "space"
      ORDER BY "id" ASC
    `) as Array<{ slug: string; name: string; template: string; visibility: string }>

    // The sidebar partial reads `sidebarSpaces`; reuse the same SELECT.
    return ctx.view('workspaces/show', {
      user,
      workspace,
      membershipRole,
      spaces,
      sidebarSpaces: spaces,
    })
  }

  /**
   * `POST /workspaces`
   * Body: `{ name: string, slug: string }` per Tech Spec § Validation
   * (slugs follow Design V2; names 1–80 chars).
   *
   * 302 redirect to `/workspaces/<slug>` on success.
   * 409 with `{ error: "slug_taken" }` if the slug is already in use.
   * 400 invalid_input on validation failure.
   */
  async create(ctx: Context) {
    const user = ctx.get<CurrentUser>('user')
    const { data, errors } = validate<{ name: string; slug: string }>(await ctx.body(), {
      name: [required(), string()],
      slug: [required(), string()],
    })
    if (errors) return ctx.json({ error: 'invalid_input' }, 400)

    const result = await createWorkspace({
      name: data.name,
      slug: data.slug.toLowerCase(),
      ownerId: user.id,
    })

    if (result.kind === 'slug_taken') {
      return ctx.json({ error: 'slug_taken' }, 409)
    }

    return ctx.redirect(`/workspaces/${result.slug}`)
  }
}
