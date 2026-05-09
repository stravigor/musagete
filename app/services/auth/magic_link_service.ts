/**
 * Magic-link issue + redemption.
 *
 * Tech Spec § Interface contract — `POST /auth/magic` and `GET /auth/magic/:token`.
 * Delivery is via `@strav/signal`'s `mail` facade (see start/providers.ts).
 *
 * Token shape: 32 bytes of crypto-random, base64url-encoded → URL-safe.
 * Storage: only the SHA-256 hash (`magic_link.token_hash`) — the plaintext
 * lives in the issued URL and never on the server after the email is sent.
 * Expiry: 15 minutes from issue.
 */

import { sql } from '@strav/database'
import { mail } from '@strav/signal'
import { config } from '@strav/kernel'
import type { CurrentUser } from '#policies/auth_policy'
import { checkMagicLinkRequestRate } from '#services/auth/rate_limit_service'
import { SESSION_TTL_SECONDS, hashCookieValue } from '#services/auth/session_service'

export const MAGIC_LINK_TTL_SECONDS = 15 * 60

export type MagicLinkRequestResult =
  | { kind: 'sent'; expiresInSeconds: number }
  | { kind: 'rate_limited'; retryAfterSeconds: number }

export type MagicLinkRedeemResult =
  | { kind: 'session_started'; user: CurrentUser; cookieValue: string }
  | { kind: 'expired' }
  | { kind: 'consumed' }
  | { kind: 'unknown' }

export async function requestMagicLink(email: string, ip?: string): Promise<MagicLinkRequestResult> {
  // 1. Normalize email per Tech Spec § Validation.
  const normalizedEmail = email.trim().toLowerCase()
  const ipValue = ip ?? null

  // 2. Rate-limit per Tech Spec § Idempotency / rate limits (5 per email per 10 min).
  const verdict = await checkMagicLinkRequestRate(normalizedEmail)
  if (!verdict.allowed) {
    await sql`
      INSERT INTO "login_attempt" ("email", "ip", "kind", "success")
      VALUES (${normalizedEmail}, ${ipValue}, 'magic_request', false)
    `
    return { kind: 'rate_limited', retryAfterSeconds: verdict.retryAfterSeconds }
  }

  // 3. 32-byte URL-safe random; SHA-256 the bytes (plaintext lives only in
  //    the issued URL — only the hash is stored).
  const tokenBytes = new Uint8Array(32)
  crypto.getRandomValues(tokenBytes)
  const tokenHash = new Uint8Array(await crypto.subtle.digest('SHA-256', tokenBytes))
  const tokenUrlSafe = base64url(tokenBytes)

  // 4. INSERT magic_link with expires_at = now + 15 min.
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_SECONDS * 1000)
  await sql`
    INSERT INTO "magic_link" ("email", "token_hash", "expires_at", "ip")
    VALUES (${normalizedEmail}, ${tokenHash}, ${expiresAt}, ${ipValue})
  `

  // 5. Successful attempt feeds the rate-limit window for subsequent calls.
  await sql`
    INSERT INTO "login_attempt" ("email", "ip", "kind", "success")
    VALUES (${normalizedEmail}, ${ipValue}, 'magic_request', true)
  `

  // 6. Dispatch the magic-link email via @strav/signal's mail facade.
  //    Driver is configured in config/mail.ts (default: log; prod: smtp).
  const appUrl = config('http.app_url') ?? config('app.url') ?? 'http://localhost:3000'
  const baseUrl = String(appUrl).replace(/\/$/, '')
  const redeemUrl = `${baseUrl}/auth/magic/${tokenUrlSafe}`

  await mail.raw({
    to: normalizedEmail,
    subject: 'Sign in to Musagete',
    html: `<p>Click <a href="${redeemUrl}">this link</a> to sign in to Musagete.</p>
<p>The link expires in 15 minutes. If you did not request this email, you can ignore it.</p>`,
    text: `Sign in to Musagete: ${redeemUrl}\n\nThe link expires in 15 minutes. If you did not request this email, you can ignore it.\n`,
  })

  return { kind: 'sent', expiresInSeconds: MAGIC_LINK_TTL_SECONDS }
}

/** RFC 4648 base64url, no padding. */
function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function redeemMagicLink(token: string, ip?: string): Promise<MagicLinkRedeemResult> {
  const ipValue = ip ?? null

  // 1. Hash the URL-safe token; find the magic_link row.
  let tokenBytes: Uint8Array
  try {
    tokenBytes = fromBase64url(token)
  } catch {
    return { kind: 'unknown' }
  }
  const tokenHash = new Uint8Array(await crypto.subtle.digest('SHA-256', tokenBytes as BufferSource))

  const linkRows = (await sql`
    SELECT "id", "email", "expires_at", "consumed_at"
    FROM "magic_link"
    WHERE "token_hash" = ${tokenHash}
    LIMIT 1
  `) as Array<{ id: number; email: string; expires_at: Date; consumed_at: Date | null }>

  if (linkRows.length === 0) return { kind: 'unknown' }
  const link = linkRows[0]!

  if (link.consumed_at !== null) return { kind: 'consumed' }
  if (new Date(link.expires_at).getTime() <= Date.now()) {
    await sql`
      INSERT INTO "login_attempt" ("email", "ip", "kind", "success")
      VALUES (${link.email}, ${ipValue}, 'magic_consume', false)
    `
    return { kind: 'expired' }
  }

  // 2. Atomic consumption — TOCTOU guard against double-redeem.
  const consumed = (await sql`
    UPDATE "magic_link"
    SET "consumed_at" = now()
    WHERE "id" = ${link.id} AND "consumed_at" IS NULL
    RETURNING "id"
  `) as Array<{ id: number }>
  if (consumed.length === 0) return { kind: 'consumed' }

  // 3. Find-or-create user by email; fetch totp_enabled.
  const user = await findOrCreateUserByEmail(link.email)
  const totpRows = (await sql`
    SELECT "enabled" FROM "totp_secret" WHERE "user_id" = ${user.id} LIMIT 1
  `) as Array<{ enabled: boolean }>
  const totpEnabled = totpRows[0]?.enabled === true
  const sessionState: 'step1' | 'full' = totpEnabled ? 'step1' : 'full'

  // 4. Generate session cookie value; only the SHA-256 hash of its encoded
  //    form is stored (matches what currentUser middleware computes on read).
  const cookieBytes = new Uint8Array(32)
  crypto.getRandomValues(cookieBytes)
  const cookieValue = base64url(cookieBytes)
  const cookieHash = await hashCookieValue(cookieValue)

  const sessionExpiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)
  await sql`
    INSERT INTO "session" ("user_id", "cookie_hash", "state", "expires_at", "ip")
    VALUES (${user.id}, ${cookieHash}, ${sessionState}, ${sessionExpiresAt}, ${ipValue})
  `

  await sql`
    INSERT INTO "login_attempt" ("email", "ip", "kind", "success")
    VALUES (${link.email}, ${ipValue}, 'magic_consume', true)
  `

  return {
    kind: 'session_started',
    user: {
      id: user.id,
      email: user.email,
      sessionState,
      totpEnabled,
    },
    cookieValue,
  }
}

/** Idempotent find-or-create against the `user` table. */
async function findOrCreateUserByEmail(email: string): Promise<{ id: number; email: string }> {
  const inserted = (await sql`
    INSERT INTO "user" ("email")
    VALUES (${email})
    ON CONFLICT ("email") DO NOTHING
    RETURNING "id", "email"
  `) as Array<{ id: number; email: string }>
  if (inserted.length > 0) return inserted[0]!

  const existing = (await sql`
    SELECT "id", "email" FROM "user" WHERE "email" = ${email} LIMIT 1
  `) as Array<{ id: number; email: string }>
  return existing[0]!
}

/** RFC 4648 base64url decode (no padding). */
function fromBase64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
