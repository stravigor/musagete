import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Issued magic-link token. Consumed-once, TTL'd at 15 minutes from issue.
 *
 * Keyed by email (not user) — at issue time the user may not yet exist;
 * redemption either fetches the user-by-email or creates a new one.
 *
 * `tokenHash` is the SHA-256 of the random token; the plaintext lives
 * only in the issued URL and never on the server after the email is sent.
 */
export default defineSchema('magic_link', {
  archetype: Archetype.Event,
  fields: {
    id: t.bigserial().primaryKey(),
    email: t.varchar(254).required().email().index(),
    tokenHash: t.bytea().required().unique(),
    expiresAt: t.timestamptz().required(),
    consumedAt: t.timestamptz().nullable(),
    ip: t.inet().nullable(),
  },
})
