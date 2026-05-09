import { describe, test, expect } from 'bun:test'
import { TestCase } from '@strav/testing'
import { sql } from '@strav/database'
import { generateTotp, base32Decode } from '@strav/auth'
import { app, EncryptionProvider } from '@strav/kernel'
import { hashCookieValue } from '#services/auth/session_service'

/**
 * Slice 001 — Scenario 6: User enables TOTP 2FA.
 *
 * Flow:
 *   1. Sign in (we seed a session row directly to avoid driving a magic-link
 *      flow inside this test).
 *   2. POST /auth/2fa/setup → returns secret_otpauth_url + 10 recovery_codes.
 *      DB has a totp_secret row with enabled=false and 10 recovery_code rows.
 *   3. Decode the secret from the otpauth URL, generate a 6-digit code,
 *      POST /auth/2fa/verify → enables=true (setup-confirmation flow).
 */

const t = await TestCase.boot({
  routes: () => import('#routes/auth'),
  auth: true,
  userResolver: async () => null,
})

// EncryptionProvider isn't booted by TestCase; register it so EncryptionManager
// is initialized from APP_KEY.
const encryptionProvider = new EncryptionProvider()
encryptionProvider.register(app)
encryptionProvider.boot(app)

describe('TOTP setup + first verify — Scenario 6', () => {
  test('setup returns otpauth + 10 recovery codes; verify flips enabled=true', async () => {
    // ── Arrange: a signed-in user (state=full, totp not yet enabled).
    const cookieValue = await seedSession({
      email: 'ada@example.com',
      state: 'full',
    })

    // ── Step 1: setup.
    const setupRes = await t.post('/auth/2fa/setup', undefined, {
      Cookie: `musagete_session=${cookieValue}`,
    })
    expect(setupRes.status).toBe(200)

    const setupBody = (await setupRes.json()) as {
      secret_otpauth_url: string
      recovery_codes: string[]
    }
    expect(setupBody.secret_otpauth_url).toMatch(/^otpauth:\/\/totp\//)
    expect(setupBody.recovery_codes).toHaveLength(10)
    expect(new Set(setupBody.recovery_codes).size).toBe(10) // all distinct

    // The totp_secret row exists (still disabled) and 10 recovery_code rows.
    const totpRows = (await sql`
      SELECT "enabled" FROM "totp_secret" WHERE "user_id" = (
        SELECT "id" FROM "user" WHERE "email" = 'ada@example.com'
      )
    `) as Array<{ enabled: boolean }>
    expect(totpRows).toHaveLength(1)
    expect(totpRows[0]!.enabled).toBe(false)

    const recoveryRows = (await sql`
      SELECT count(*)::int AS "count" FROM "recovery_code" WHERE "user_id" = (
        SELECT "id" FROM "user" WHERE "email" = 'ada@example.com'
      )
    `) as Array<{ count: number }>
    expect(recoveryRows[0]!.count).toBe(10)

    // ── Step 2: confirm the QR by submitting a code generated from the secret.
    const base32 = extractSecret(setupBody.secret_otpauth_url)
    const code = await generateTotp(base32Decode(base32), { digits: 6, period: 30 })

    const verifyRes = await t.post('/auth/2fa/verify', { code }, {
      Cookie: `musagete_session=${cookieValue}`,
    })
    expect(verifyRes.status).toBe(200)
    const verifyBody = (await verifyRes.json()) as { status: string }
    expect(verifyBody.status).toBe('verified')

    // ── Then: totp_secret.enabled is true.
    const enabledRows = (await sql`
      SELECT "enabled" FROM "totp_secret" WHERE "user_id" = (
        SELECT "id" FROM "user" WHERE "email" = 'ada@example.com'
      )
    `) as Array<{ enabled: boolean }>
    expect(enabledRows[0]!.enabled).toBe(true)
  })
})

/** Insert a user + session row, return the (plaintext) cookie value. */
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

function extractSecret(otpauthUrl: string): string {
  const u = new URL(otpauthUrl)
  return u.searchParams.get('secret') ?? ''
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

