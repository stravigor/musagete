import { describe, test, expect } from 'bun:test'
import { TestCase } from '@strav/testing'
import { sql } from '@strav/database'
import { hashCookieValue } from '#services/auth/session_service'

/**
 * Slice 001 — Scenario 9: Sign-out destroys the session.
 *
 * - POST /auth/sign-out with the session cookie:
 *     - returns 200 with body { status: 'signed_out' }
 *     - clears the response cookie (Max-Age=0)
 *     - deletes the session row
 *
 * Subsequent requests with the now-stale cookie are anonymous: the
 * `currentUser` middleware returns null and `authorize(canSignOut)`
 * 401s. (That's the intended "anonymous" outcome from the BDD.)
 */

const t = await TestCase.boot({
  routes: () => import('#routes/auth'),
  auth: true,
  userResolver: async () => null,
})

describe('POST /auth/sign-out — Scenario 9', () => {
  test('deletes session row, clears cookie, returns signed_out', async () => {
    const cookieValue = await seedSession({ email: 'ada@example.com', state: 'full' })

    const res = await t.post('/auth/sign-out', undefined, {
      Cookie: `musagete_session=${cookieValue}`,
    })

    // 1) 200 + body
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('signed_out')

    // 2) Set-Cookie clears `musagete_session` (Max-Age=0)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('musagete_session=')
    expect(setCookie).toContain('Max-Age=0')

    // 3) Session row was deleted
    const sessions = (await sql`
      SELECT count(*)::int AS "count"
      FROM "session"
      WHERE "user_id" = (SELECT "id" FROM "user" WHERE "email" = 'ada@example.com')
    `) as Array<{ count: number }>
    expect(sessions[0]!.count).toBe(0)
  })

  test('subsequent requests with the now-stale cookie are anonymous (401)', async () => {
    const cookieValue = await seedSession({ email: 'grace@example.com', state: 'full' })

    // Sign out — deletes session row.
    const out = await t.post('/auth/sign-out', undefined, {
      Cookie: `musagete_session=${cookieValue}`,
    })
    expect(out.status).toBe(200)

    // Same cookie now resolves to no session — gated endpoint returns 401.
    const after = await t.post('/auth/sign-out', undefined, {
      Cookie: `musagete_session=${cookieValue}`,
    })
    expect(after.status).toBe(401)
  })
})

async function seedSession(opts: {
  email: string
  state: 'step1' | 'full'
}): Promise<string> {
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

  return cookieValue
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
