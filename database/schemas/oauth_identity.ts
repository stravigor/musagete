import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Link between a user and a verified social-OAuth account.
 *
 * Slice 001 uses OAuth strictly for identity verification (sign-in only),
 * not for acting on behalf of the user — so no `token` / `refreshToken`
 * columns. (The `@strav/social` `social_account` stub was deliberately
 * not adopted; revisit if a future slice needs stored tokens.)
 *
 * Uniqueness is `(provider, providerUserId)` — the same external account
 * cannot be linked to two users.
 */
export default defineSchema('oauth_identity', {
  archetype: Archetype.Component,
  parents: ['user'],
  fields: {
    id: t.bigserial().primaryKey(),
    provider: t.enum(['google', 'github']).required(),
    providerUserId: t.varchar(255).required(),
  },
  // The same external account cannot be linked to two users.
  uniques: [
    ['provider', 'providerUserId'],
  ],
})
