import { sql } from '@strav/database'

/**
 * Workspace service — handles the creation flow.
 *
 * Atomicity: all four side-effects (workspace insert, membership insert,
 * user.last_workspace_id update, slug-uniqueness check) run inside a single
 * `sql.begin(...)` transaction; partial failures roll back.
 *
 * Connection choice: stays on the app pool throughout (no `withoutTenant`).
 * The `workspace` table is the tenant registry, not `tenanted: true`, so
 * its INSERT is not RLS-protected. The `membership` INSERT IS RLS-protected
 * — we set `app.tenant_id` to the new workspace's id mid-transaction via
 * `set_config(..., true)` so the policy WITH CHECK passes. `set_config` is
 * transaction-local; the test transaction's ROLLBACK undoes it cleanly.
 *
 * Single-connection design keeps `@strav/testing`'s transaction-rollback
 * isolation working — switching pools mid-flow (`withoutTenant`) breaks
 * test isolation because the bypass pool is a separate connection that
 * doesn't see the test's uncommitted seed data.
 */

export type CreateWorkspaceInput = {
  name: string
  slug: string
  ownerId: number
}

export type CreateWorkspaceResult =
  | { kind: 'created'; workspaceId: number; slug: string }
  | { kind: 'slug_taken' }

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<CreateWorkspaceResult> {
  return sql.begin(async (tx) => {
    // Slug-uniqueness via ON CONFLICT DO NOTHING + RETURNING — avoids the
    // TOCTOU window of a pre-check + insert and keeps the transaction
    // valid (constraint violations would abort the tx; ON CONFLICT just
    // returns zero rows on collision).
    const inserted = (await tx`
      INSERT INTO "workspace" ("slug", "name", "owner_id")
      VALUES (${input.slug}, ${input.name}, ${input.ownerId})
      ON CONFLICT ("slug") DO NOTHING
      RETURNING "id", "slug"
    `) as Array<{ id: number; slug: string }>

    if (inserted.length === 0) {
      return { kind: 'slug_taken' as const }
    }

    const workspace = inserted[0]!

    // Bind the new workspace as the tenant context for the rest of this
    // transaction. The membership table's RLS policy WITH CHECK reads
    // `current_setting('app.tenant_id', true)::bigint`; without this set,
    // the membership INSERT would be rejected. `set_config(..., true)`
    // is transaction-local; rolls back cleanly with the surrounding tx.
    await tx`SELECT set_config('app.tenant_id', ${String(workspace.id)}, true)`

    // Owner membership row. `workspace_id` is provided explicitly so the
    // `strav_assign_tenanted_id()` BEFORE INSERT trigger reads the right
    // tenant for the per-tenant id sequence.
    await tx`
      INSERT INTO "membership" ("workspace_id", "user_id", "role")
      VALUES (${workspace.id}, ${input.ownerId}, 'owner')
    `

    // Set the user's "last opened" pointer so `GET /` redirects them
    // here on next visit. The `user` table is platform-side (not tenanted),
    // so RLS doesn't apply.
    await tx`
      UPDATE "user"
      SET "last_workspace_id" = ${workspace.id}
      WHERE "id" = ${input.ownerId}
    `

    return {
      kind: 'created' as const,
      workspaceId: workspace.id,
      slug: workspace.slug,
    }
  })
}
