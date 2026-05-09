import type { Context } from '@strav/http'
import { clearCookie } from '@strav/http'
import { signOut, SESSION_COOKIE_NAME } from '#services/auth/session_service'

/**
 * Slice 001 — session sign-out.
 *
 * Route:
 *   POST /auth/sign-out   → destroy()  (authPolicy.canSignOut)
 */
export default class SessionController {
  /**
   * `POST /auth/sign-out`
   * Deletes the session row and clears the response cookie. The route
   * is gated by `canSignOut` (session required), so subsequent calls
   * with a stale cookie return 401 — i.e. "the cookie is now anonymous"
   * from the BDD.
   */
  async destroy(ctx: Context) {
    const cookie = ctx.cookie(SESSION_COOKIE_NAME)
    if (cookie) await signOut(cookie)

    return clearCookie(
      ctx.json({ status: 'signed_out' }),
      SESSION_COOKIE_NAME,
      { httpOnly: true, secure: true, sameSite: 'lax' },
    )
  }
}
