import { describe, test, expect, beforeEach } from 'bun:test'
import { TestCase } from '@strav/testing'
import { sql } from '@strav/database'
import { hashCookieValue } from '#services/auth/session_service'
import { createWorkspace } from '#services/workspaces/workspace_service'
import { resetTenantTables } from '../utils/reset_tenant_tables'

/**
 * Slice 002 — Scenario 2 (Build-T1 inner-loop Micro-Turn).
 *
 * Wizard creates a space from the "engineering" template. The space gets
 * the seeded folder structure (Runbooks, ADRs, On-call, API Reference)
 * with at least one Doc + initial Revision per folder, plus a
 * `space_defaults` row carrying the template's defaults.
 *
 * Preconditions per slice 002 Tech Spec § Boundary: the workspace-scoped
 * routes run under `tenantContext` middleware, which resolves `:slug` to
 * `workspace.id` and binds `withTenant(...)`. The `canCreateSpace` policy
 * requires role ≥ `editor`; the workspace owner satisfies it.
 */

const t = await TestCase.boot({
  routes: () => import('#routes/workspaces'),
  auth: true,
  userResolver: async () => null,
  // transaction: false — slice 002 services use `sql.begin(...)` which Bun
  // doesn't nest as a SAVEPOINT inside an outer BEGIN; rolling back the
  // outer transaction wouldn't undo the inner one. See
  // tests/spaces/workspace_create.test.ts for the longer explanation.
  transaction: false,
})

beforeEach(async () => {
  await resetTenantTables()
})

describe('POST /workspaces/:slug/spaces — Scenario 2: Space creation from "engineering" template', () => {
  test('creates space + space_defaults + seeded docs + revisions; redirects', async () => {
    // ── Arrange: a signed-in user who owns a workspace.
    const { userId, cookieValue } = await seedSession({
      email: 's2-ada@example.com',
      state: 'full',
    })
    const created = await createWorkspace({
      name: 'Acme Cloud',
      slug: 'acme-cloud',
      ownerId: userId,
    })
    if (created.kind !== 'created') throw new Error('workspace seed failed')
    const workspaceId = created.workspaceId

    // ── Act: POST the wizard payload for the engineering template.
    const res = await t.post(
      '/workspaces/acme-cloud/spaces',
      {
        template: 'engineering',
        name: 'Platform',
        slug: 'platform',
        visibility: 'protected',
      },
      { Cookie: `musagete_session=${cookieValue}` },
    )

    // ── Assert:
    // 1) 302 redirect to the new space's read view.
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/workspaces/acme-cloud/spaces/platform')

    // 2) Exactly one space row with slug='platform', template='engineering'.
    const spaces = (await sql`
      SELECT "id", "slug", "name", "template", "visibility"
      FROM "space"
      WHERE "workspace_id" = ${workspaceId}
        AND "slug"         = 'platform'
    `) as Array<{
      id: number
      slug: string
      name: string
      template: string
      visibility: string
    }>
    expect(spaces).toHaveLength(1)
    const space = spaces[0]!
    expect(space.template).toBe('engineering')
    expect(space.name).toBe('Platform')
    expect(space.visibility).toBe('protected')

    // 3) A space_defaults row with the template's defaults.
    const defaults = (await sql`
      SELECT "require_review", "allow_comments", "ai_index"
      FROM "space_defaults"
      WHERE "workspace_id" = ${workspaceId}
        AND "space_id"     = ${space.id}
    `) as Array<{ require_review: boolean; allow_comments: boolean; ai_index: boolean }>
    expect(defaults).toHaveLength(1)

    // 4) Seeded folders match the engineering template's structure.
    //    Distinct folder_path across the space's docs == the four expected
    //    folders, in any order.
    const folderRows = (await sql`
      SELECT DISTINCT "folder_path"
      FROM "doc"
      WHERE "workspace_id" = ${workspaceId}
        AND "space_id"     = ${space.id}
    `) as Array<{ folder_path: string }>
    const folders = folderRows.map((r) => r.folder_path).sort()
    expect(folders).toEqual(['/ADRs', '/API Reference', '/On-call', '/Runbooks'])

    // 5) At least one published Revision per Doc, with doc.current_revision_id
    //    pointing at it.
    const docs = (await sql`
      SELECT "id", "current_revision_id"
      FROM "doc"
      WHERE "workspace_id" = ${workspaceId}
        AND "space_id"     = ${space.id}
    `) as Array<{ id: number; current_revision_id: number | null }>
    expect(docs.length).toBeGreaterThanOrEqual(4)

    for (const doc of docs) {
      expect(doc.current_revision_id).not.toBeNull()
      const revs = (await sql`
        SELECT "id", "status"
        FROM "revision"
        WHERE "workspace_id" = ${workspaceId}
          AND "doc_id"       = ${doc.id}
      `) as Array<{ id: number; status: string }>
      expect(revs.length).toBeGreaterThanOrEqual(1)
      expect(revs.some((r) => r.status === 'published' && r.id === doc.current_revision_id)).toBe(true)
    }
  })

  test('Scenario 3: wizard step 3 toggles override the template defaults', async () => {
    // ── Arrange: signed-in user owning a workspace.
    const { userId, cookieValue } = await seedSession({
      email: 's2-ada@example.com',
      state: 'full',
    })
    const created = await createWorkspace({
      name: 'Acme Cloud',
      slug: 'acme-cloud',
      ownerId: userId,
    })
    if (created.kind !== 'created') throw new Error('workspace seed failed')
    const workspaceId = created.workspaceId

    // ── Act: same engineering template as Scenario 2, but wizard step 3
    //    toggles "Require PR review" off and "AI index" on (already true
    //    in the template — explicit confirmation, not a change). The
    //    omitted `allowComments` field falls back to the template default.
    const res = await t.post(
      '/workspaces/acme-cloud/spaces',
      {
        template: 'engineering',
        name: 'Platform',
        slug: 'platform',
        visibility: 'protected',
        requireReview: false,
        aiIndex: true,
      },
      { Cookie: `musagete_session=${cookieValue}` },
    )

    // ── Assert: 302 redirect; space_defaults reflects the overrides.
    expect(res.status).toBe(302)

    const spaces = (await sql`
      SELECT "id"
      FROM "space"
      WHERE "workspace_id" = ${workspaceId}
        AND "slug"         = 'platform'
    `) as Array<{ id: number }>
    expect(spaces).toHaveLength(1)
    const spaceId = spaces[0]!.id

    const defaults = (await sql`
      SELECT "require_review", "allow_comments", "ai_index"
      FROM "space_defaults"
      WHERE "workspace_id" = ${workspaceId}
        AND "space_id"     = ${spaceId}
    `) as Array<{ require_review: boolean; allow_comments: boolean; ai_index: boolean }>
    expect(defaults).toHaveLength(1)
    // Engineering template defaults: { requireReview: true, allowComments: true, aiIndex: true }.
    // After wizard step 3 toggles: require_review=false (overridden), allow_comments=true
    // (template default — wizard didn't touch), ai_index=true (overridden but unchanged).
    expect(defaults[0]!.require_review).toBe(false)
    expect(defaults[0]!.allow_comments).toBe(true)
    expect(defaults[0]!.ai_index).toBe(true)
  })

  test('Scenario 5: slug uniqueness within a workspace returns 409 slug_taken', async () => {
    // ── Arrange: signed-in user owning a workspace, with one space
    //    already at slug 'platform'.
    const { userId, cookieValue } = await seedSession({
      email: 's2-ada@example.com',
      state: 'full',
    })
    const created = await createWorkspace({
      name: 'Acme Cloud',
      slug: 'acme-cloud',
      ownerId: userId,
    })
    if (created.kind !== 'created') throw new Error('workspace seed failed')

    const first = await t.post(
      '/workspaces/acme-cloud/spaces',
      {
        template: 'engineering',
        name: 'Platform',
        slug: 'platform',
        visibility: 'protected',
      },
      { Cookie: `musagete_session=${cookieValue}` },
    )
    expect(first.status).toBe(302)

    // ── Act: a second create with the same slug.
    const second = await t.post(
      '/workspaces/acme-cloud/spaces',
      {
        template: 'engineering',
        name: 'Platform Take Two',
        slug: 'platform',
        visibility: 'protected',
      },
      { Cookie: `musagete_session=${cookieValue}` },
    )

    // ── Assert: 409 with the documented body.
    expect(second.status).toBe(409)
    const body = (await second.json()) as { error: string }
    expect(body.error).toBe('slug_taken')
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
