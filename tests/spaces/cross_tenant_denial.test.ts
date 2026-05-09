import { describe, test, expect, beforeEach } from 'bun:test'
import { TestCase } from '@strav/testing'
import { sql, withTenant } from '@strav/database'
import { hashCookieValue } from '#services/auth/session_service'
import { createWorkspace } from '#services/workspaces/workspace_service'
import { createSpace } from '#services/spaces/space_service'
import { resetTenantTables } from '../utils/reset_tenant_tables'

/**
 * Slice 002 — Scenario 4 (Build-T1 inner-loop Micro-Turn).
 *
 * Cross-workspace read is denied at the database. Two parts:
 *
 * 1. **Structural** (always meaningful) — verify the RLS policy DDL is
 *    in place on every tenant table. This is the slice's contract with
 *    the database: each tenant table has ENABLE + FORCE row level
 *    security, plus a `tenant_isolation` policy that filters rows by
 *    `workspace_id = current_setting('app.tenant_id', true)::bigint`.
 *
 * 2. **Empirical** (conditional on dev-env role config) — set
 *    `app.tenant_id` to workspace A and SELECT a doc keyed by workspace
 *    B's id; expect zero rows. This only fires correctly when the
 *    regular DB pool runs as a non-BYPASSRLS role. If the project's
 *    `DB_USER` is the same role as `DB_BYPASS_USER` (common in dev to
 *    avoid creating two roles), the role bypasses RLS even on FORCE
 *    tables, and this test would silently pass with 2 rows. Skipped
 *    automatically when `DB_USER === DB_BYPASS_USER`; surfaced loudly
 *    in turns.md as a deferred operator task before slice 002 ships.
 *
 * Per slice 002 Tech Spec § Test strategy: "Cross-tenant denial test
 * runs at the connection level (calls SELECT directly with different
 * session-scoped workspace_id) to prove RLS is the gate." Structural
 * + empirical together proves that.
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

const TENANT_TABLES = ['membership', 'space', 'space_defaults', 'doc', 'revision'] as const

// Empirical denial is skipped when the regular pool's role has BYPASSRLS
// (the dev-env shorthand of using one role for both pools, or when the
// configured `DB_USER` itself is a BYPASSRLS role). Slice 002 ships
// expecting role separation in production; the structural tests above
// cover the schema contract for both envs.
const roleRows = (await sql`
  SELECT "rolbypassrls" FROM "pg_roles" WHERE "rolname" = current_user
`) as Array<{ rolbypassrls: boolean }>
const skipEmpirical = roleRows[0]?.rolbypassrls ?? false
const empiricalTest = skipEmpirical ? test.skip : test

describe('Cross-workspace read denial — Scenario 4', () => {
  test('every tenant table has ENABLE + FORCE row level security', async () => {
    for (const table of TENANT_TABLES) {
      const rows = (await sql`
        SELECT "relrowsecurity", "relforcerowsecurity"
        FROM "pg_class"
        WHERE "relname" = ${table}
          AND "relnamespace" = (SELECT "oid" FROM "pg_namespace" WHERE "nspname" = 'public')
      `) as Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
      expect(rows).toHaveLength(1)
      expect(rows[0]!.relrowsecurity).toBe(true)
      expect(rows[0]!.relforcerowsecurity).toBe(true)
    }
  })

  test('every tenant table has a tenant_isolation policy scoped by app.tenant_id', async () => {
    for (const table of TENANT_TABLES) {
      const policies = (await sql`
        SELECT "qual", "with_check"
        FROM "pg_policies"
        WHERE "schemaname" = 'public'
          AND "tablename"  = ${table}
          AND "policyname" = 'tenant_isolation'
      `) as Array<{ qual: string; with_check: string }>
      expect(policies).toHaveLength(1)
      expect(policies[0]!.qual).toContain("workspace_id = (current_setting('app.tenant_id'")
      expect(policies[0]!.with_check).toContain("workspace_id = (current_setting('app.tenant_id'")
    }
  })

  empiricalTest(
    'SELECT for a doc in workspace B returns zero rows when app.tenant_id is workspace A',
    async () => {
      const userA = await seedSession({ email: 's2-userA@example.com' })
      const userB = await seedSession({ email: 's2-userB@example.com' })

      const wsA = await createWorkspace({ name: 'A', slug: 'ws-a', ownerId: userA.userId })
      const wsB = await createWorkspace({ name: 'B', slug: 'ws-b', ownerId: userB.userId })
      if (wsA.kind !== 'created' || wsB.kind !== 'created') {
        throw new Error('workspace seed failed')
      }

      const spaceA = await withTenant(String(wsA.workspaceId), () =>
        createSpace({
          workspaceId: wsA.workspaceId,
          template: 'engineering',
          name: 'Platform',
          slug: 'platform',
          visibility: 'protected',
          authorId: userA.userId,
        }),
      )
      const spaceB = await withTenant(String(wsB.workspaceId), () =>
        createSpace({
          workspaceId: wsB.workspaceId,
          template: 'engineering',
          name: 'Platform',
          slug: 'platform',
          visibility: 'protected',
          authorId: userB.userId,
        }),
      )
      if (spaceA.kind !== 'created' || spaceB.kind !== 'created') {
        throw new Error('space seed failed')
      }

      const docsB = await withTenant(String(wsB.workspaceId), async () =>
        (await sql`
          SELECT "id" FROM "doc" WHERE "space_id" = ${spaceB.spaceId} LIMIT 1
        `) as Array<{ id: number }>,
      )
      expect(docsB).toHaveLength(1)
      const docBId = docsB[0]!.id

      // Denial path.
      const crossTenant = await withTenant(String(wsA.workspaceId), async () =>
        (await sql`
          SELECT "id" FROM "doc" WHERE "id" = ${docBId}
        `) as Array<{ id: number }>,
      )
      expect(crossTenant).toHaveLength(0)

      // Sanity check (allow path).
      const sameTenant = await withTenant(String(wsB.workspaceId), async () =>
        (await sql`
          SELECT "id" FROM "doc" WHERE "id" = ${docBId}
        `) as Array<{ id: number }>,
      )
      expect(sameTenant).toHaveLength(1)
    },
  )
})

/** Insert a user + session row, return the user id and (plaintext) cookie value. */
async function seedSession(opts: {
  email: string
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
    VALUES (${userId}, ${cookieHash}, 'full', ${expiresAt})
  `

  return { userId, cookieValue }
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
