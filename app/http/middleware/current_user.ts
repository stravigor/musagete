import type { Context, Middleware } from '@strav/http'
import { sql } from '@strav/database'
import type { CurrentUser } from '#policies/auth_policy'
import { SESSION_COOKIE_NAME, hashCookieValue } from '#services/auth/session_service'

/**
 * Resolve the current user from the `musagete_session` cookie and stash it
 * on the context as `'user'`, where `@strav/http`'s `authorize()` reads it.
 *
 * Algorithm (per slice 001 Tech Spec):
 *   1. Read the `musagete_session` cookie. If absent → leave `'user'` unset.
 *   2. SHA-256 the cookie value → look up `session` by `cookie_hash`.
 *   3. If found and not expired, fetch the linked `user` and (LEFT JOIN)
 *      `totp_secret.enabled`. Stash a `CurrentUser` on `ctx.set('user', …)`.
 *   4. If the session row is missing or expired, leave `'user'` unset.
 *
 * No `next()` short-circuit on missing/expired session — this middleware
 * is purely a populator. Endpoint-level `authorize()` enforces presence.
 */
export const currentUser: Middleware = async (ctx: Context, next) => {
  const user = await resolveCurrentUser(ctx)
  if (user) ctx.set('user', user)
  return next()
}

/** Imperative variant for tests / one-off lookups. */
export async function resolveCurrentUser(ctx: Context): Promise<CurrentUser | null> {
  const cookieValue = ctx.cookie(SESSION_COOKIE_NAME)
  if (!cookieValue) return null

  const cookieHash = await hashCookieValue(cookieValue)

  const rows = (await sql`
    SELECT
      "u"."id"             AS "user_id",
      "u"."email"          AS "user_email",
      "s"."state"          AS "session_state",
      "s"."expires_at"     AS "session_expires_at",
      COALESCE("t"."enabled", false) AS "totp_enabled"
    FROM "session" "s"
    INNER JOIN "user" "u"  ON "u"."id" = "s"."user_id"
    LEFT JOIN  "totp_secret" "t" ON "t"."user_id" = "u"."id"
    WHERE "s"."cookie_hash" = ${cookieHash}
    LIMIT 1
  `) as Array<{
    user_id: number
    user_email: string
    session_state: 'step1' | 'full'
    session_expires_at: Date
    totp_enabled: boolean
  }>

  if (rows.length === 0) return null
  const row = rows[0]!

  // Expired sessions are not authoritative — the prune job clears the row
  // separately; here we treat the request as anonymous.
  if (new Date(row.session_expires_at).getTime() <= Date.now()) return null

  return {
    id: row.user_id,
    email: row.user_email,
    sessionState: row.session_state,
    totpEnabled: row.totp_enabled,
  }
}
