import type { Context } from '@strav/http'
import { sql } from '@strav/database'
import type { CurrentUser } from '#policies/auth_policy'

/**
 * Slice 002 Build-T2 — landing redirects.
 *
 * `GET /` resolves the right destination per slice 002 Tech Spec
 * § Default-workspace resolution:
 *   - unauthenticated  → /auth
 *   - authenticated, last_workspace_id set → /workspaces/<slug>
 *   - authenticated, no last_workspace_id but member of N workspaces
 *     → /workspaces/<most-recent-membership-slug>
 *   - authenticated, no memberships → /workspaces/new
 */
export default class LandingController {
  async index(ctx: Context) {
    const user = ctx.get<CurrentUser | undefined>('user')
    if (!user) return ctx.redirect('/auth')

    // Try last_workspace_id first.
    const lwRows = (await sql`
      SELECT "u"."last_workspace_id" AS "last_id",
             "w"."slug"              AS "slug"
      FROM "user" "u"
      LEFT JOIN "workspace" "w" ON "w"."id" = "u"."last_workspace_id"
      WHERE "u"."id" = ${user.id}
      LIMIT 1
    `) as Array<{ last_id: number | null; slug: string | null }>

    if (lwRows[0]?.slug) {
      return ctx.redirect(`/workspaces/${lwRows[0].slug}`)
    }

    // Fall back to most-recent membership. `membership` is RLS-scoped, but
    // we don't have a tenant context yet — read via a JOIN against workspace
    // (which is the tenant registry, not RLS-scoped) and bypass the
    // membership scoping by using the SECURITY DEFINER trick: select via
    // pg_class predicate-bypass... actually simpler: just SELECT with the
    // user_id filter, accepting that without app.tenant_id set the policy
    // returns zero rows. Instead, read workspace rows via a join across
    // `workspace.owner_id = user.id` for a v1 approximation that doesn't
    // require RLS bypass.
    //
    // (A future refinement: a minimal `withoutTenant` block here, once
    //  TestCase warms the bypass pool. v1 narrows the redirect to
    //  workspaces the user *owns*; non-owner-only users will land at
    //  /workspaces/new and can pick a workspace they're a member of from
    //  there once a workspace-list page ships.)
    const ownedRows = (await sql`
      SELECT "slug"
      FROM "workspace"
      WHERE "owner_id" = ${user.id}
      ORDER BY "created_at" DESC
      LIMIT 1
    `) as Array<{ slug: string }>

    if (ownedRows[0]?.slug) {
      return ctx.redirect(`/workspaces/${ownedRows[0].slug}`)
    }

    return ctx.redirect('/workspaces/new')
  }
}
