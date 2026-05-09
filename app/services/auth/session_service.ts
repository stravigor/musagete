/**
 * Session lifecycle — sign-out, state transitions.
 *
 * Tech Spec § Interface contract — `POST /auth/sign-out` and the
 * `step1 → full` promotion that magic-link redemption + TOTP verification
 * trigger.
 *
 * Cookie management: `musagete_session` (HttpOnly, Secure, SameSite=Lax),
 * lifetime per `expires_at` on the row. Set/clear is the controller's
 * job (it owns the response); the service updates rows.
 */

import { sql } from '@strav/database'

// `musagete_session` (not the framework default `strav_session`) so this
// project-owned session cookie doesn't collide with the cookie set by
// `@strav/http`'s SessionProvider — which is registered alongside this
// service for OAuth state binding (`@strav/social`'s redirect()/user()
// require it). Strav's session and our session are independent stores;
// distinct cookie names keep them addressable separately.
export const SESSION_COOKIE_NAME = 'musagete_session'

/** Default session lifetime — slice 001 keeps it short until extended in a later slice. */
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

/**
 * Canonical cookie-hash function for `session.cookie_hash`. Consumers MUST
 * use this — both the writer side (redeem / OAuth complete) and the reader
 * side (currentUser middleware) — so the lookup keys agree.
 *
 * We hash the *encoded* cookie string (UTF-8 bytes of the base64url form)
 * rather than the raw 32 random bytes, because the reader only ever sees
 * the encoded string from the request cookie header. Hashing the string
 * keeps writer and reader in lockstep without requiring a base64url decode
 * at lookup time.
 */
export async function hashCookieValue(cookieValue: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(cookieValue)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource))
}

export type SignOutResult =
  | { kind: 'signed_out' }
  | { kind: 'no_session' }

export async function signOut(cookieValue: string): Promise<SignOutResult> {
  const cookieHash = await hashCookieValue(cookieValue)
  const deleted = (await sql`
    DELETE FROM "session" WHERE "cookie_hash" = ${cookieHash} RETURNING "id"
  `) as Array<{ id: number }>
  return deleted.length > 0 ? { kind: 'signed_out' } : { kind: 'no_session' }
}

/**
 * Promote the session linked to this cookie from `step1` to `full`. Called
 * after a successful TOTP verify. No-op if the session is already `full`.
 */
export async function promoteToFull(cookieValue: string): Promise<void> {
  const cookieHash = await hashCookieValue(cookieValue)
  await sql`
    UPDATE "session"
    SET "state" = 'full', "updated_at" = now()
    WHERE "cookie_hash" = ${cookieHash} AND "state" = 'step1'
  `
}
