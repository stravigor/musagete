import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Active user session. Cookie-keyed, TTL'd, two-state (`step1` → `full`).
 *
 * `cookieHash` is the SHA-256 of the high-entropy cookie value delivered
 * to the browser. The plaintext cookie never appears server-side after
 * issue; lookup is by hash.
 */
export default defineSchema('session', {
  archetype: Archetype.Component,
  parents: ['user'],
  fields: {
    id: t.bigserial().primaryKey(),
    cookieHash: t.bytea().required().unique(),
    state: t.enum(['step1', 'full']).required(),
    expiresAt: t.timestamptz().required(),
    ip: t.inet().nullable(),
    userAgent: t.text().nullable(),
  },
})
