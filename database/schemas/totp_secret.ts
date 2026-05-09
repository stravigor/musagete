import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Per-user TOTP secret + enabled flag. One row per user (1:1).
 *
 * `secretEncrypted` is the user's TOTP secret, AES-GCM-encrypted with the
 * application key (`APP_KEY`). It is `.sensitive()` — the framework redacts
 * it from logs and serializers.
 */
export default defineSchema('totp_secret', {
  archetype: Archetype.Component,
  // 1:1 with `user` — the parent's `unique: true` flag emits a UNIQUE
  // constraint on the auto-generated `user_id` column.
  parents: [{ name: 'user', unique: true }],
  fields: {
    id: t.bigserial().primaryKey(),
    secretEncrypted: t.bytea().required().sensitive(),
    enabled: t.boolean().required().default(false),
    enabledAt: t.timestamptz().nullable(),
  },
})
