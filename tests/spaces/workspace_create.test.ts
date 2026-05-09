import { describe, test, expect, beforeEach } from 'bun:test'
import { TestCase } from '@strav/testing'
import { sql } from '@strav/database'
import { hashCookieValue } from '#services/auth/session_service'
import { resetTenantTables } from '../utils/reset_tenant_tables'

/**
 * Slice 002 — Scenario 1 (Build-T1 Checkpoint 3, first failing BDD test).
 *
 * Encodes the acceptance criterion BEFORE any production handler logic
 * exists in the workspace service. With the current stub body, the
 * controller returns 302 with the right Location header (so the response-
 * shape assertions pass) but no `workspace`, `membership`, or
 * `user.last_workspace_id` row mutates — so the row-presence assertions
 * fail. That failure is the test's job at this checkpoint.
 *
 * Once Build-T1's inner TDD loop fills the workspace service body, this
 * test goes green; further scenarios then file in alongside.
 *
 * Preconditions to run:
 *   - Postgres up at $DB_HOST:$DB_PORT (per .env / config/database.ts).
 *   - The BYPASSRLS Postgres role exists (`CREATE ROLE postgres_bypass
 *     WITH LOGIN BYPASSRLS PASSWORD '...';`) — required by `@strav/database`
 *     once `tenant.enabled = true`.
 *   - `bun strav migrate` has applied slice 002's migration `1778324255164`
 *     (creates `workspace`, `membership`, `space`, `space_defaults`, `doc`,
 *     `revision` tables; adds `user.last_workspace_id`; enables RLS).
 *
 * Test isolation: TestCase's auto-transaction wrap is DISABLED for slice
 * 002 tests because Bun's `sql.begin(...)` does not use SAVEPOINT when
 * nested inside an outer BEGIN — `createWorkspace`'s inner `begin` would
 * commit independently of the outer ROLLBACK, leaving rows behind.
 * Instead, each test calls `resetTenantTables()` in `beforeEach` to
 * truncate slice 001 + slice 002 tables. Documented as a deferred
 * Strav-testing framework gap (`@strav/testing` could detect an open
 * outer transaction and emit SAVEPOINT manually around `sql.begin`).
 */

const t = await TestCase.boot({
  routes: () => import('#routes/workspaces'),
  auth: true,
  userResolver: async () => null,
  transaction: false,
})

beforeEach(async () => {
  await resetTenantTables()
})

describe('POST /workspaces — Scenario 1: First workspace creation', () => {
  test('creates workspace + owner membership + sets last_workspace_id + redirects', async () => {
    // ── Arrange: a signed-in user with no workspaces.
    const { userId, cookieValue } = await seedSession({
      email: 's2-ada@example.com',
      state: 'full',
    })

    // ── Act: POST /workspaces with the wizard's identity-step payload.
    const res = await t.post(
      '/workspaces',
      { name: 'Acme Cloud', slug: 'acme-cloud' },
      { Cookie: `musagete_session=${cookieValue}` },
    )

    // ── Assert:
    // 1) 302 redirect to `/workspaces/acme-cloud`.
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/workspaces/acme-cloud')

    // 2) Exactly one workspace row exists with the slug + name + owner_id.
    //    `workspace` is the tenant registry, not RLS-protected; queries
    //    against it run unconditionally on the test's reserved connection.
    const workspaces = (await sql`
      SELECT "id", "slug", "name", "owner_id"
      FROM "workspace"
      WHERE "slug" = 'acme-cloud'
    `) as Array<{ id: number; slug: string; name: string; owner_id: number }>
    expect(workspaces).toHaveLength(1)
    const workspace = workspaces[0]!
    expect(workspace.name).toBe('Acme Cloud')
    expect(workspace.owner_id).toBe(userId)

    // 3) A membership row links (workspace, user, role='owner'). The
    //    `membership` table IS RLS-protected — `createWorkspace` already
    //    set `app.tenant_id` to the new workspace's id via `set_config(…,
    //    true)`, and the setting persists for the rest of the test
    //    transaction, so the policy WITH USING clause passes here.
    const memberships = (await sql`
      SELECT "role"
      FROM "membership"
      WHERE "workspace_id" = ${workspace.id}
        AND "user_id"      = ${userId}
    `) as Array<{ role: string }>
    expect(memberships).toHaveLength(1)
    expect(memberships[0]!.role).toBe('owner')

    // 4) The user's last_workspace_id is set to the new workspace.
    const users = (await sql`
      SELECT "last_workspace_id"
      FROM "user"
      WHERE "id" = ${userId}
    `) as Array<{ last_workspace_id: number | null }>
    expect(users).toHaveLength(1)
    expect(users[0]!.last_workspace_id).toBe(workspace.id)
  })
})

/** Insert a user + session row, return the user id and (plaintext) cookie value. */
async function seedSession(opts: {
  email: string
  state: 'step1' | 'full'
}): Promise<{ userId: number; cookieValue: string }> {
  const inserted = (await sql`
    INSERT INTO "user" ("email") VALUES (${opts.email})
    ON CONFLICT ("email") DO UPDATE SET "email" = EXCLUDED."email"
    RETURNING "id"
  `) as Array<{ id: number }>
  const userId = inserted[0]!.id

  const cookieBytes = new Uint8Array(32)
  crypto.getRandomValues(cookieBytes)
  const cookieValue = base64url(cookieBytes)
  const cookieHash = await hashCookieValue(cookieValue)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  await sql`
    INSERT INTO "session" ("user_id", "cookie_hash", "state", "expires_at")
    VALUES (${userId}, ${cookieHash}, ${opts.state}, ${expiresAt})
  `

  return { userId, cookieValue }
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
