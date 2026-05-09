import { describe, test, expect } from 'bun:test'
import { TestCase } from '@strav/testing'
import { sql } from '@strav/database'

/**
 * Slice 001 — Scenario 2: User redeems a valid magic link.
 *
 * Test isolation: TestCase.boot() wraps each test in a transaction that
 * auto-rolls-back, so the inserted magic_link/user/session disappear after
 * the test.
 */

const t = await TestCase.boot({
  routes: () => import('#routes/auth'),
})

describe('GET /auth/magic/:token — Scenario 2: User redeems a valid magic link', () => {
  test('creates user + session, redirects to /, sets strav_session cookie', async () => {
    // ── Given: a valid, unconsumed magic-link row keyed by `tokenHash`
    const email = 'ada@example.com'
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const tokenHash = new Uint8Array(await crypto.subtle.digest('SHA-256', tokenBytes))
    const tokenUrlSafe = base64url(tokenBytes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    await sql`
      INSERT INTO "magic_link" ("email", "token_hash", "expires_at")
      VALUES (${email}, ${tokenHash}, ${expiresAt})
    `

    // ── When: the user opens the redemption URL
    const res = await t.get(`/auth/magic/${tokenUrlSafe}`)

    // ── Then:
    // 1) 302 redirect to `/` (no TOTP enabled → session is `full`)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')

    // 2) `musagete_session` cookie is set with the documented attributes
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('musagete_session=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=lax')

    // 3) A user row exists for the magic-link's email
    const users = (await sql`
      SELECT "id", "email" FROM "user" WHERE "email" = ${email}
    `) as Array<{ id: number; email: string }>
    expect(users).toHaveLength(1)

    // 4) A session row exists, linked to that user, in `full` state
    const sessions = (await sql`
      SELECT "user_id", "state" FROM "session" WHERE "user_id" = ${users[0]!.id}
    `) as Array<{ user_id: number; state: string }>
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.state).toBe('full')

    // 5) The magic_link row is now consumed
    const links = (await sql`
      SELECT "consumed_at" FROM "magic_link" WHERE "token_hash" = ${tokenHash}
    `) as Array<{ consumed_at: Date | null }>
    expect(links[0]!.consumed_at).not.toBeNull()
  })
})

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
