import { describe, test, expect, spyOn } from 'bun:test'
import { TestCase } from '@strav/testing'
import { sql } from '@strav/database'
import { app } from '@strav/kernel'
import { SocialProvider, GitHubProvider } from '@strav/social'

/** Slice 001 — Scenario 5: User signs in with GitHub OAuth. */

const t = await TestCase.boot({
  routes: () => import('#routes/auth'),
  auth: true,
  userResolver: async () => null,
})

const socialProvider = new SocialProvider()
socialProvider.register(app)
await socialProvider.boot(app)

describe('GET /auth/oauth/github/callback — Scenario 5: User signs in with GitHub OAuth', () => {
  test('creates user + oauth_identity (provider=github) + session', async () => {
    spyOn(GitHubProvider.prototype, 'user').mockResolvedValueOnce({
      id: 'github-67890',
      email: 'grace@example.com',
      emailVerified: true,
      name: 'Grace Hopper',
      avatar: 'https://avatars.githubusercontent.com/u/67890',
      nickname: 'gracehopper',
      token: 'gho_fake',
      refreshToken: null,
      expiresIn: null,
      approvedScopes: ['user:email'],
      raw: {},
    } as any)

    const res = await t.get(
      '/auth/oauth/github/callback?code=fake-code&state=fake-state',
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('musagete_session=')

    const users = (await sql`
      SELECT "id", "email" FROM "user" WHERE "email" = 'grace@example.com'
    `) as Array<{ id: number; email: string }>
    expect(users).toHaveLength(1)

    const identities = (await sql`
      SELECT "provider", "provider_user_id"
      FROM "oauth_identity"
      WHERE "user_id" = ${users[0]!.id}
    `) as Array<{ provider: string; provider_user_id: string }>
    expect(identities).toHaveLength(1)
    expect(identities[0]!.provider).toBe('github')
    expect(identities[0]!.provider_user_id).toBe('github-67890')
  })
})
