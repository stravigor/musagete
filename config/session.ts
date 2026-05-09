import { env } from '@strav/kernel'

/**
 * Strav's session machinery. Distinct from this project's auth-session
 * tracked in `app/services/auth/session_service.ts` (cookie:
 * `musagete_session`, table: `session`).
 *
 * Strav's session is registered solely so `@strav/social`'s redirect() /
 * user() can bind OAuth CSRF state to a server-side store. Outside the
 * `/auth/oauth/*` routes (which apply the `session()` middleware) it is
 * unused.
 */
export default {
  driver: env('SESSION_DRIVER', 'postgres') as 'postgres' | 'redis',
  cookie: 'strav_session', // framework-canonical name — does not collide with `musagete_session`
  lifetime: 30,            // minutes; OAuth state TTL is far shorter than this
  httpOnly: true,
  secure: env.bool('APP_SECURE', true),
  sameSite: 'lax' as const,
}
