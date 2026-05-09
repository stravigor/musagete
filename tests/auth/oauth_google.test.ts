import { describe, test, expect, spyOn } from 'bun:test'
import { TestCase } from '@strav/testing'
import { sql } from '@strav/database'
import { app } from '@strav/kernel'
import { SocialProvider, GoogleProvider } from '@strav/social'

/**
 * Slice 001 — Scenario 4: User signs in with Google OAuth.
 *
 * Test strategy (per Tech Spec § Test strategy):
 *   - OAuth provider HTTP is mocked at the @strav/social boundary.
 *   - We spy on `GoogleProvider.prototype.user(ctx)` to return a canned
 *     `SocialUser`, sidestepping the real token exchange + user fetch
 *     against Google's servers and the CSRF state-binding step.
 *   - The test then asserts the **post-callback application logic**: user
 *     row, oauth_identity row, session row, cookie set.
 *
 * Why we don't drive the start → callback round-trip end-to-end here:
 *   that path is `@strav/social`'s responsibility and has its own tests
 *   in the framework. Slice 001's integration risk is the storage logic.
 */

const t = await TestCase.boot({
  routes: () => import('#routes/auth'),
  auth: true,                         // boots SessionManager (session() middleware needs it)
  userResolver: async () => null,     // not used by slice 001; required when auth: true
})

// Boot SocialProvider manually — TestCase only knows about Auth + Session.
const socialProvider = new SocialProvider()
socialProvider.register(app)
await socialProvider.boot(app)

describe('GET /auth/oauth/google/callback — Scenario 4: User signs in with Google OAuth', () => {
  test('creates user + oauth_identity + session, redirects to /, sets musagete_session cookie', async () => {
    // ── Arrange: fake the Google profile that @strav/social would fetch.
    spyOn(GoogleProvider.prototype, 'user').mockResolvedValueOnce({
      id: 'google-12345',
      email: 'ada@gmail.com',
      emailVerified: true,
      name: 'Ada Lovelace',
      avatar: null,
      nickname: undefined,
      token: 'access-token-fake',
      refreshToken: null,
      expiresIn: 3600,
      approvedScopes: ['openid', 'email', 'profile'],
      raw: {},
    } as any)

    // ── Act: hit the callback. The spy bypasses CSRF state validation, so
    //    the query params don't matter — they just need to exist for the
    //    framework's `user(ctx)` signature shape.
    const res = await t.get(
      '/auth/oauth/google/callback?code=fake-code&state=fake-state',
    )

    // ── Assert:
    // 1) 302 to `/` (no TOTP enabled → session is `full`)
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')

    // 2) `musagete_session` cookie set with the project's standard attributes
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('musagete_session=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('SameSite=lax')

    // 3) A user row exists for the verified Google email
    const users = (await sql`
      SELECT "id", "email" FROM "user" WHERE "email" = 'ada@gmail.com'
    `) as Array<{ id: number; email: string }>
    expect(users).toHaveLength(1)

    // 4) An oauth_identity row links (user, google, provider_user_id)
    const identities = (await sql`
      SELECT "provider", "provider_user_id"
      FROM "oauth_identity"
      WHERE "user_id" = ${users[0]!.id}
    `) as Array<{ provider: string; provider_user_id: string }>
    expect(identities).toHaveLength(1)
    expect(identities[0]!.provider).toBe('google')
    expect(identities[0]!.provider_user_id).toBe('google-12345')

    // 5) A session row exists in `full` state (no TOTP for this user yet)
    const sessions = (await sql`
      SELECT "state" FROM "session" WHERE "user_id" = ${users[0]!.id}
    `) as Array<{ state: string }>
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.state).toBe('full')
  })
})
