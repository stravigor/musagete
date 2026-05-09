import type { Context } from '@strav/http'
import { withCookie } from '@strav/http'
import { social, SocialError } from '@strav/social'
import { ConfigurationError } from '@strav/kernel'
import type { OAuthProvider } from '#services/auth/oauth_service'
import { completeOAuthSignIn } from '#services/auth/oauth_service'
import { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from '#services/auth/session_service'

function clientIp(ctx: Context): string | undefined {
  const forwarded = ctx.header('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim()
  return ctx.header('x-real-ip') ?? undefined
}

const SUPPORTED_PROVIDERS: ReadonlyArray<OAuthProvider> = ['google', 'github']

function isSupported(name: string): name is OAuthProvider {
  return (SUPPORTED_PROVIDERS as ReadonlyArray<string>).includes(name)
}

/**
 * Slice 001 — OAuth start + callback for Google and GitHub.
 *
 * Routes:
 *   GET /auth/oauth/:provider/start     → start()
 *   GET /auth/oauth/:provider/callback  → callback()
 *
 * Both endpoints are public per Tech Spec § Authz, but they require the
 * `session()` middleware (applied at the route layer) so `@strav/social`
 * can bind the OAuth CSRF state to the request's session.
 */
export default class OAuthController {
  /**
   * `GET /auth/oauth/:provider/start`
   * 302 to the provider's authorization URL (state bound to Strav session).
   * 404 if the provider is unsupported or unconfigured.
   */
  async start(ctx: Context) {
    const name = ctx.params.provider
    if (!isSupported(name)) {
      return ctx.json({ error: 'unknown_provider' }, 404)
    }
    try {
      return social.driver(name).redirect(ctx)
    } catch (err) {
      if (err instanceof ConfigurationError) {
        return ctx.json({ error: 'unknown_provider' }, 404)
      }
      throw err
    }
  }

  /**
   * `GET /auth/oauth/:provider/callback`
   * Provider returns `code` + `state` as query params.
   * 302 on success (with `musagete_session` cookie); 400 state mismatch;
   * 502 provider error (sanitized — never echoes upstream error strings).
   */
  async callback(ctx: Context) {
    const name = ctx.params.provider
    if (!isSupported(name)) {
      return ctx.json({ error: 'unknown_provider' }, 404)
    }

    let socialUser: import('@strav/social').SocialUser
    try {
      socialUser = await social.driver(name).user(ctx)
    } catch (err) {
      if (err instanceof SocialError) {
        // CSRF / state mismatch / missing-code / provider-rejected token.
        return ctx.json({ error: 'state_mismatch' }, 400)
      }
      // Token-endpoint or user-endpoint failure: identify the provider only.
      return ctx.json({ error: 'provider_error', provider: name }, 502)
    }

    const result = await completeOAuthSignIn(name, socialUser, clientIp(ctx))
    if (result.kind === 'email_unverified') {
      return ctx.redirect('/auth?error=email_unverified')
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
