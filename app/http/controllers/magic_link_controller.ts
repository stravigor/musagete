import type { Context } from '@strav/http'
import { validate, required, string, email, withCookie } from '@strav/http'
import { requestMagicLink, redeemMagicLink, MAGIC_LINK_TTL_SECONDS } from '#services/auth/magic_link_service'
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '#services/auth/session_service'

/** Best-effort client IP from forwarded headers. */
function clientIp(ctx: Context): string | undefined {
  const forwarded = ctx.header('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim()
  return ctx.header('x-real-ip') ?? undefined
}

/**
 * Slice 001 — magic-link request and redemption.
 *
 * Routes:
 *   POST /auth/magic         → request()
 *   GET  /auth/magic/:token  → redeem()
 *
 * Both endpoints are public per Tech Spec § Authz.
 */
export default class MagicLinkController {
  /**
   * `POST /auth/magic`
   * Body: `{ email: string }` — RFC 5322; lowercased server-side.
   * 202 on success, 400 invalid_email, 429 rate_limited.
   */
  async request(ctx: Context) {
    const { data, errors } = validate<{ email: string }>(await ctx.body(), {
      email: [required(), string(), email()],
    })
    if (errors) return ctx.json({ error: 'invalid_email' }, 400)

    const result = await requestMagicLink(data.email.toLowerCase(), clientIp(ctx))

    if (result.kind === 'rate_limited') {
      // Retry-After is included in the body; setting it as an HTTP header
      // requires constructing the Response manually — left as a Checkpoint 3+ task.
      return ctx.json(
        { error: 'rate_limited', retry_after: result.retryAfterSeconds },
        429,
      )
    }
    return ctx.json({ status: 'sent', expires_in_seconds: MAGIC_LINK_TTL_SECONDS }, 202)
  }

  /**
   * `GET /auth/magic/:token`
   * On success: 302 to `/` (or `/auth/2fa/verify` if user has TOTP enabled),
   * with a `strav_session` cookie set per Tech Spec § Authz.
   * On expired/consumed/unknown: redirect to the auth screen with an `expired` query.
   */
  async redeem(ctx: Context) {
    const token = ctx.params.token
    if (!token || token.length < 32) {
      // Mismatched length is rejected at the route layer per Tech Spec.
      return ctx.redirect('/auth?error=expired')
    }

    const result = await redeemMagicLink(token, clientIp(ctx))

    if (result.kind !== 'session_started') {
      return ctx.redirect('/auth?error=expired')
    }

    const next = result.user.sessionState === 'step1' ? '/auth/2fa/verify' : '/'
    return withCookie(
      ctx.redirect(next),
      SESSION_COOKIE_NAME,
      result.cookieValue,
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: SESSION_TTL_SECONDS,
      },
    )
  }
}
