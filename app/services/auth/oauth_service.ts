/**
 * OAuth post-callback storage + session-start for Google and GitHub.
 *
 * The OAuth dance itself (redirect → token exchange → user fetch + state
 * binding) is owned by `@strav/social`'s `AbstractProvider`, invoked from
 * the controller via `social.driver(name).redirect(ctx)` and `.user(ctx)`.
 * This service handles the post-`user()` work: enforce verified-email,
 * find-or-create the local `user`, INSERT `oauth_identity`, INSERT a
 * project session row, and return the cookie value for the controller
 * to set.
 */

import { sql } from '@strav/database'
import type { SocialUser } from '@strav/social'
import type { CurrentUser } from '#policies/auth_policy'
import { SESSION_TTL_SECONDS, hashCookieValue } from '#services/auth/session_service'

export type OAuthProvider = 'google' | 'github'

export type OAuthCompleteResult =
  | { kind: 'session_started'; user: CurrentUser; cookieValue: string }
  | { kind: 'email_unverified' }

/**
 * Given the `SocialUser` produced by `provider.user(ctx)`, complete the
 * sign-in: find-or-create user, link the OAuth identity, start a session.
 *
 * `provider` MUST match the driver name used to fetch `socialUser` — it's
 * persisted to `oauth_identity.provider` so subsequent sign-ins recognise
 * the same external account.
 */
export async function completeOAuthSignIn(
  provider: OAuthProvider,
  socialUser: SocialUser,
  ip?: string,
): Promise<OAuthCompleteResult> {
  const ipValue = ip ?? null

  // Verified-email gate per Tech Spec § Policy: "OAuth verified email is
  // the authoritative email." Do not match by unverified providers.
  const verifiedEmail = pickVerifiedEmail(socialUser)
  if (!verifiedEmail) {
    await sql`
      INSERT INTO "login_attempt" ("email", "ip", "kind", "success")
      VALUES (${socialUser.email ?? null}, ${ipValue}, 'oauth', false)
    `
    return { kind: 'email_unverified' }
  }

  // Find-or-create user by verified email (atomic).
  const inserted = (await sql`
    INSERT INTO "user" ("email")
    VALUES (${verifiedEmail})
    ON CONFLICT ("email") DO NOTHING
    RETURNING "id", "email"
  `) as Array<{ id: number; email: string }>

  let user: { id: number; email: string }
  if (inserted.length > 0) {
    user = inserted[0]!
  } else {
    const existing = (await sql`
      SELECT "id", "email" FROM "user" WHERE "email" = ${verifiedEmail} LIMIT 1
    `) as Array<{ id: number; email: string }>
    user = existing[0]!
  }

  // Link the OAuth identity (idempotent). The DSL UNIQUE(provider, provider_user_id)
  // guards against the same external account ↔ two users.
  await sql`
    INSERT INTO "oauth_identity" ("user_id", "provider", "provider_user_id")
    VALUES (${user.id}, ${provider}, ${socialUser.id})
    ON CONFLICT ("provider", "provider_user_id") DO NOTHING
  `

  // Resolve totp state.
  const totpRows = (await sql`
    SELECT "enabled" FROM "totp_secret" WHERE "user_id" = ${user.id} LIMIT 1
  `) as Array<{ enabled: boolean }>
  const totpEnabled = totpRows[0]?.enabled === true
  const sessionState: 'step1' | 'full' = totpEnabled ? 'step1' : 'full'

  // Issue session cookie and persist row. We hash the *encoded* cookie
  // string so the currentUser middleware computes the same key on read.
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
    VALUES (${verifiedEmail}, ${ipValue}, 'oauth', true)
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

/**
 * Returns the verified email from a SocialUser, or null if unverified or
 * absent. Google sets `emailVerified: true` from the OIDC `email_verified`
 * claim; GitHub's primary email is verified-by-policy when Strav fetches it.
 */
function pickVerifiedEmail(u: SocialUser): string | null {
  if (!u.email) return null
  if (u.emailVerified === false) return null
  return u.email.toLowerCase()
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
