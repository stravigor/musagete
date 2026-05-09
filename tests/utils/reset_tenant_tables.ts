import { sql } from '@strav/database'

/**
 * Truncate slice 002 tenant tables. Used by slice 002 tests in
 * `beforeEach` to enforce isolation, because Bun's `sql.begin(...)` does
 * not use SAVEPOINT when nested in an outer BEGIN — so TestCase's
 * transaction-rollback isolation can't undo what slice 002 services
 * commit.
 *
 * Scope is intentionally NARROW: we do not touch slice 001's platform
 * tables (`user`, `session`, etc.). Slice 001 tests run in parallel with
 * slice 002 tests under `bun test`, and TRUNCATEing user CASCADE would
 * wipe slice 001's seeded sessions mid-test, racing slice 001 to red.
 *
 * Slice 002 tests reuse user rows across tests (`seedSession` is
 * idempotent on email), which is fine: workspace.owner_id can point at
 * any existing user; last_workspace_id is overwritten by the test under
 * inspection; per-tenant ids restart from 1 because each test creates a
 * fresh workspace.
 *
 * `RESTART IDENTITY` resets sequences on the truncated tables.
 * `_strav_tenant_sequences` is the framework-managed counter table —
 * truncating keeps per-tenant id counters reproducible across runs.
 * `CASCADE` follows the FK graph so we don't need to enumerate in order.
 */
export async function resetTenantTables(): Promise<void> {
  await sql`
    TRUNCATE
      "workspace",
      "membership",
      "space",
      "space_defaults",
      "doc",
      "revision",
      "_strav_tenant_sequences"
    RESTART IDENTITY
    CASCADE
  `

  // Slice 002 tests seed users prefixed with `s2-` and commit their
  // sessions (`transaction: false`). Slice 001 tests in parallel files
  // assert on global `SELECT FROM session` counts (e.g.
  // magic_link_expired expects zero sessions); leaked s2- sessions race
  // those assertions to red. Delete s2- users; CASCADE removes their
  // sessions, oauth_identities, totp_secrets, and recovery_codes.
  //
  // Restricted to the s2- prefix so slice 001's seeded users (their
  // tests' transactions are still active in parallel) are untouched.
  await sql`
    DELETE FROM "user" WHERE "email" LIKE 's2-%@example.com'
  `
}
