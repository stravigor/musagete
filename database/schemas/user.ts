import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Platform user account. Cross-workspace identity.
 *
 * Slice 001 — auth surface (magic link + Google/GitHub OAuth + TOTP).
 * Identity is the verified email; OAuth flows always reconcile against
 * an existing user-by-email before creating a new one.
 */
export default defineSchema('user', {
  archetype: Archetype.Entity,
  fields: {
    id: t.bigserial().primaryKey(),
    email: t.varchar(254).required().unique().email(),
    name: t.varchar(120).nullable(),
    avatarIdx: t.integer().required().default(0),
    lastSeenAt: t.timestamptz().nullable(),
  },
})
