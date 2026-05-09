/**
 * TOTP setup + verification + recovery codes.
 *
 * Tech Spec § Interface contract — `POST /auth/2fa/setup` and `POST /auth/2fa/verify`.
 * Primitives come from `@strav/auth/totp` (RFC 6238).
 *
 * Storage:
 *   - `totp_secret.secret_encrypted` is AES-256-GCM encrypted with `APP_KEY`
 *     (Strav `EncryptionProvider` registered in start/providers.ts).
 *     The encrypter returns a string envelope; we store its UTF-8 bytes
 *     in the `BYTEA` column.
 *   - `recovery_code.code_hash` is SHA-256 of a high-entropy code; the
 *     plaintext is shown to the user once at setup time.
 */

import { sql } from '@strav/database'
import { EncryptionManager } from '@strav/kernel'
import {
  generateSecret,
  totpUri,
  verifyTotp as verifyTotpCode,
  base32Decode,
  generateRecoveryCodes,
} from '@strav/auth'

export const RECOVERY_CODE_COUNT = 10
const TOTP_ISSUER = 'Musagete'

export type TotpSetupResult = {
  /** otpauth URL for QR rendering: otpauth://totp/<issuer>:<email>?secret=<base32> */
  secretOtpauthUrl: string
  /** Plaintext recovery codes — shown to the user once, never returned again. */
  recoveryCodes: string[]
}

export type TotpVerifyResult =
  | { kind: 'verified' }
  | { kind: 'recovery_used' }
  | { kind: 'invalid' }

export async function setupTotp(userId: number, userEmail: string): Promise<TotpSetupResult> {
  // 1. Generate a fresh TOTP secret + encrypt it.
  const { base32 } = generateSecret()
  const encryptedString = EncryptionManager.encrypt(base32)
  const encryptedBytes = new TextEncoder().encode(encryptedString)

  // 2. Upsert totp_secret with enabled=false. A re-setup before the user
  //    confirmed the previous QR overwrites the prior row (intentional).
  await sql`
    INSERT INTO "totp_secret" ("user_id", "secret_encrypted", "enabled", "enabled_at")
    VALUES (${userId}, ${encryptedBytes}, false, NULL)
    ON CONFLICT ("user_id") DO UPDATE
    SET "secret_encrypted" = EXCLUDED."secret_encrypted",
        "enabled"          = false,
        "enabled_at"       = NULL,
        "updated_at"       = now()
  `

  // 3. Wipe any prior unused recovery codes (the regenerated secret invalidates
  //    them anyway), then issue 10 fresh ones — only the SHA-256 hash is stored.
  await sql`DELETE FROM "recovery_code" WHERE "user_id" = ${userId}`
  const recoveryCodes = generateRecoveryCodes(RECOVERY_CODE_COUNT)
  for (const code of recoveryCodes) {
    const codeHash = await sha256(new TextEncoder().encode(code))
    await sql`
      INSERT INTO "recovery_code" ("user_id", "code_hash")
      VALUES (${userId}, ${codeHash})
    `
  }

  // 4. otpauth URL for QR rendering.
  const secretOtpauthUrl = totpUri({
    secret: base32,
    issuer: TOTP_ISSUER,
    account: userEmail,
    digits: 6,
    period: 30,
  })

  return { secretOtpauthUrl, recoveryCodes }
}

export async function verifyTotp(userId: number, code: string): Promise<TotpVerifyResult> {
  // 1. Load the secret.
  const rows = (await sql`
    SELECT "secret_encrypted", "enabled"
    FROM "totp_secret"
    WHERE "user_id" = ${userId}
    LIMIT 1
  `) as Array<{ secret_encrypted: Uint8Array; enabled: boolean }>
  if (rows.length === 0) {
    await recordTotpAttempt(false)
    return { kind: 'invalid' }
  }
  const totp = rows[0]!

  // 2. Six digits → TOTP code path.
  if (/^\d{6}$/.test(code)) {
    const base32 = EncryptionManager.decrypt(new TextDecoder().decode(totp.secret_encrypted))
    const secretBytes = base32Decode(base32)
    const ok = await verifyTotpCode(secretBytes, code, { window: 1, digits: 6, period: 30 })
    if (!ok) {
      await recordTotpAttempt(false)
      return { kind: 'invalid' }
    }

    // First-time setup confirmation: flip enabled true.
    if (!totp.enabled) {
      await sql`
        UPDATE "totp_secret"
        SET "enabled" = true, "enabled_at" = now(), "updated_at" = now()
        WHERE "user_id" = ${userId}
      `
    }
    await recordTotpAttempt(true)
    return { kind: 'verified' }
  }

  // 3. Otherwise → recovery-code path. Atomic single-use guard.
  const codeHash = await sha256(new TextEncoder().encode(code))
  const consumed = (await sql`
    UPDATE "recovery_code"
    SET "used_at" = now(), "updated_at" = now()
    WHERE "user_id" = ${userId}
      AND "code_hash" = ${codeHash}
      AND "used_at" IS NULL
    RETURNING "id"
  `) as Array<{ id: number }>
  if (consumed.length === 0) {
    await recordTotpAttempt(false)
    return { kind: 'invalid' }
  }
  await recordTotpAttempt(true)
  return { kind: 'recovery_used' }
}

async function sha256(input: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', input as BufferSource))
}

async function recordTotpAttempt(success: boolean): Promise<void> {
  await sql`
    INSERT INTO "login_attempt" ("kind", "success")
    VALUES ('totp', ${success})
  `
}
