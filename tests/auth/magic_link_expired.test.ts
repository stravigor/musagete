import { describe, test, expect } from 'bun:test'
import { TestCase } from '@strav/testing'
import { sql } from '@strav/database'

/**
 * Slice 001 — Scenario 3: An expired magic link is rejected.
 */

const t = await TestCase.boot({
  routes: () => import('#routes/auth'),
})

describe('GET /auth/magic/:token — Scenario 3: An expired magic link is rejected', () => {
  test('does not create user/session; redirects to /auth?error=expired', async () => {
    // ── Given: a magic-link row whose expires_at is already in the past
    const email = 'ada@example.com'
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const tokenHash = new Uint8Array(await crypto.subtle.digest('SHA-256', tokenBytes))
    const tokenUrlSafe = base64url(tokenBytes)
    const expiresAt = new Date(Date.now() - 60 * 1000) // 1 minute ago

    await sql`
      INSERT INTO "magic_link" ("email", "token_hash", "expires_at")
      VALUES (${email}, ${tokenHash}, ${expiresAt})
    `

    // ── When: the user opens the redemption URL
    const res = await t.get(`/auth/magic/${tokenUrlSafe}`)

    // ── Then:
    // 1) 302 redirect to `/auth?error=expired`
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/auth?error=expired')

    // 2) No `musagete_session` cookie is set
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).not.toContain('musagete_session=')

    // 3) No user row was created
    const users = (await sql`
      SELECT "id" FROM "user" WHERE "email" = ${email}
    `) as Array<{ id: number }>
    expect(users).toHaveLength(0)

    // 4) No session row was created for the requesting email.
    //    Scoped by user to avoid races with parallel test files that may
    //    have committed sessions (e.g., slice 002's seeded sessions —
    //    its tests use `transaction: false` because Bun's `sql.begin()`
    //    does not nest as a SAVEPOINT inside an outer BEGIN).
    const sessions = (await sql`
      SELECT "s"."id"
      FROM "session" "s"
      INNER JOIN "user" "u" ON "u"."id" = "s"."user_id"
      WHERE "u"."email" = ${email}
    `) as Array<{ id: number }>
    expect(sessions).toHaveLength(0)

    // 5) The magic_link row remains unconsumed (the failed attempt didn't touch it)
    const links = (await sql`
      SELECT "consumed_at" FROM "magic_link" WHERE "token_hash" = ${tokenHash}
    `) as Array<{ consumed_at: Date | null }>
    expect(links[0]!.consumed_at).toBeNull()
  })
})

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
