import { describe, test, expect } from 'bun:test'
import { TestCase } from '@strav/testing'
import { sql } from '@strav/database'
import { generateTotp, generateSecret, base32Decode } from '@strav/auth'
import { app, EncryptionProvider, EncryptionManager } from '@strav/kernel'
import { hashCookieValue } from '#services/auth/session_service'

/**
 * Slice 001 — Scenario 7: User signs in with TOTP enabled.
 *
 * Setup: user has `totp_secret.enabled=true`; sign-in put the session in
 * `step1` state. We seed both directly to keep the test focused on the
 * verify endpoint.
 *
 * Then: a valid TOTP code promotes the session to `full`; an invalid code
 * leaves the state in `step1` and counts the attempt.
 */

const t = await TestCase.boot({
  routes: () => import('#routes/auth'),
  auth: true,
  userResolver: async () => null,
})

const encryptionProvider = new EncryptionProvider()
encryptionProvider.register(app)
encryptionProvider.boot(app)

describe('POST /auth/2fa/verify — Scenario 7: sign-in second-factor flow', () => {
  test('valid code promotes session step1 → full', async () => {
    const { cookieValue, base32 } = await seedTotpEnabledSession({
      email: 'grace@example.com',
      state: 'step1',
    })

    const code = await generateTotp(base32Decode(base32), { digits: 6, period: 30 })

    const res = await t.post('/auth/2fa/verify', { code }, {
      Cookie: `musagete_session=${cookieValue}`,
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body.status).toBe('verified')

    // State promoted.
    const sessions = (await sql`
      SELECT "state" FROM "session" WHERE "user_id" = (
        SELECT "id" FROM "user" WHERE "email" = 'grace@example.com'
      )
    `) as Array<{ state: string }>
    expect(sessions[0]!.state).toBe('full')
  })

  test('invalid code is rejected; session remains step1', async () => {
    const { cookieValue } = await seedTotpEnabledSession({
      email: 'hopper@example.com',
      state: 'step1',
    })

    const res = await t.post('/auth/2fa/verify', { code: '000000' }, {
      Cookie: `musagete_session=${cookieValue}`,
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('invalid_code')

    // State unchanged.
    const sessions = (await sql`
      SELECT "state" FROM "session" WHERE "user_id" = (
        SELECT "id" FROM "user" WHERE "email" = 'hopper@example.com'
      )
    `) as Array<{ state: string }>
    expect(sessions[0]!.state).toBe('step1')

    // Failed attempt recorded.
    const attempts = (await sql`
      SELECT count(*)::int AS "count" FROM "login_attempt"
      WHERE "kind" = 'totp' AND "success" = false
    `) as Array<{ count: number }>
    expect(attempts[0]!.count).toBeGreaterThanOrEqual(1)
  })
})

/** Insert user + totp_secret(enabled=true) + session, return cookie + base32 secret. */
async function seedTotpEnabledSession(opts: {
  email: string
  state: 'step1' | 'full'
}): Promise<{ cookieValue: string; base32: string }> {
  const inserted = (await sql`
    INSERT INTO "user" ("email") VALUES (${opts.email})
    ON CONFLICT ("email") DO UPDATE SET "email" = EXCLUDED."email"
    RETURNING "id"
  `) as Array<{ id: number }>
  const userId = inserted[0]!.id

  // Seed an enabled totp_secret directly.
  const { base32 } = generateSecret()
  const encryptedString = EncryptionManager.encrypt(base32)
  const encryptedBytes = new TextEncoder().encode(encryptedString)
  await sql`
    INSERT INTO "totp_secret" ("user_id", "secret_encrypted", "enabled", "enabled_at")
    VALUES (${userId}, ${encryptedBytes}, true, now())
    ON CONFLICT ("user_id") DO UPDATE
    SET "secret_encrypted" = EXCLUDED."secret_encrypted",
        "enabled"          = true,
        "enabled_at"       = now()
  `

  // Seed a step1 session.
  const cookieBytes = new Uint8Array(32)
  crypto.getRandomValues(cookieBytes)
  const cookieValue = base64url(cookieBytes)
  const cookieHash = await hashCookieValue(cookieValue)
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await sql`
    INSERT INTO "session" ("user_id", "cookie_hash", "state", "expires_at")
    VALUES (${userId}, ${cookieHash}, ${opts.state}, ${expiresAt})
  `

  return { cookieValue, base32 }
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
