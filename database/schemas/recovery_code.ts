import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Single-use TOTP recovery code (hashed). Ten codes are generated at
 * `/auth/2fa/setup` and shown to the user once; only their hashes are
 * stored. On consumption, `usedAt` is set; subsequent attempts on the
 * same code fail.
 */
export default defineSchema('recovery_code', {
  archetype: Archetype.Component,
  parents: ['user'],
  fields: {
    id: t.bigserial().primaryKey(),
    codeHash: t.bytea().required(),
    usedAt: t.timestamptz().nullable(),
  },
  // Single-use recovery codes per user — same code cannot be re-issued
  // for the same user (and the column is keyed by hash, not plaintext).
  uniques: [
    ['user', 'codeHash'],
  ],
})
