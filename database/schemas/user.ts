import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Platform user account. Cross-workspace identity.
 *
 * Slice 001 — auth surface (magic link + Google/GitHub OAuth + TOTP).
 * Identity is the verified email; OAuth flows always reconcile against
 * an existing user-by-email before creating a new one.
 *
 * Slice 002 added `lastWorkspace` — the workspace the user most recently
 * opened, read by the `/` redirect handler to land them back where they
 * left off. `t.reference('workspace').nullable()` emits a
 * `last_workspace_id BIGINT NULL` column with `ON DELETE SET NULL` (the
 * field is nullable, so the framework derives SET NULL semantics). Cross-
 * boundary FK (platform → tenant) is fine: lookups happen via the bypass
 * pool in the `/` redirect handler.
 */
export default defineSchema('user', {
  archetype: Archetype.Entity,
  fields: {
    id: t.bigserial().primaryKey(),
    email: t.varchar(254).required().unique().email(),
    name: t.varchar(120).nullable(),
    avatarIdx: t.integer().required().default(0),
    lastSeenAt: t.timestamptz().nullable(),
    lastWorkspace: t.reference('workspace').nullable(),
  },
})
