import type { Context, Middleware } from '@strav/http'
import { sql, withTenant } from '@strav/database'
import type { CurrentUser } from '#policies/auth_policy'

/**
 * Resolve the workspace slug from the URL and bind tenant context.
 *
 * Mounted on the `/workspaces/:slug/...` route group (slice 002 Tech Spec
 * § Policy & invariants). The workspace-creation route `POST /workspaces`
 * does NOT use this middleware — it creates the tenant row itself.
 *
 * Algorithm:
 *   1. Read `:slug` from the URL. If absent → pass through.
 *   2. Read `ctx.get('user')` populated by upstream `currentUser` middleware.
 *      If absent → pass through; downstream `authorize()` will return 401.
 *   3. SELECT workspace by slug from the app pool. `workspace` is the
 *      tenant registry, not `tenanted: true`, so no RLS applies — the
 *      query works without a tenant context.
 *   4. If workspace not found → 404.
 *   5. Bind `withTenant(workspace.id, …)` for the rest of the request.
 *      Inside the block, query membership for the current user — RLS
 *      now filters by `app.tenant_id = workspace.id`, so the membership
 *      either exists for this tenant or it doesn't.
 *   6. If user has no membership in this workspace → 404 (no existence leak).
 *   7. Stash the resolved workspace + role on the context under
 *      `'workspace'` and `'membershipRole'`, then call `next()` still
 *      inside the `withTenant` block so every controller-side query
 *      runs with `app.tenant_id` set.
 *
 * Single-pool design (slice 002 Scenario 1 pattern): avoids the bypass
 * pool entirely. `withoutTenant` would route to the bypass connection,
 * which `@strav/testing` doesn't warm up — and which adds connection-
 * isolation friction for test data seeded on the app pool.
 */
export const tenantContext: Middleware = async (ctx: Context, next) => {
  const slug = ctx.params.slug
  if (!slug) return next()

  const user = ctx.get<CurrentUser | undefined>('user')
  if (!user) return next()

  const workspaceRows = (await sql`
    SELECT "id", "slug", "name"
    FROM "workspace"
    WHERE "slug" = ${slug}
    LIMIT 1
  `) as Array<{ id: number; slug: string; name: string }>

  if (workspaceRows.length === 0) return ctx.json({ error: 'not_found' }, 404)
  const workspace = workspaceRows[0]!

  return withTenant(String(workspace.id), async () => {
    const memRows = (await sql`
      SELECT "role"
      FROM "membership"
      WHERE "user_id" = ${user.id}
      LIMIT 1
    `) as Array<{ role: 'owner' | 'admin' | 'editor' | 'reader' | 'guest' }>

    if (memRows.length === 0) return ctx.json({ error: 'not_found' }, 404)

    ctx.set('workspace', workspace)
    // Augment the actor with the membership role so `@strav/http`'s
    // `authorize(policy, ...)` can call `policyMethod(actor)` against a
    // SpaceActor shape — `authorize` reads only `ctx.get('user')` as the
    // actor, so the role must live on the user object, not on a sibling
    // ctx key.
    ctx.set('user', { ...user, membershipRole: memRows[0]!.role })

    return next()
  })
}
