import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Link between a workspace and a user, carrying the user's role within
 * that workspace. Tenanted: every membership row is scoped to its
 * `workspace_id` (auto-injected by `tenanted: true`).
 *
 * `parents: ['user']` emits a CASCADE FK to `user(id)` — deleting a user
 * removes their memberships, which is the desired GDPR-shaped behavior.
 *
 * `(workspace_id, user_id)` is unique: a given user can only have one
 * membership row per workspace.
 *
 * Cross-workspace listing (sign-in landing, workspace switcher) reads
 * memberships across tenants under `withoutTenant(...)` with explicit
 * `WHERE user_id = $1` filtering — the canonical RLS-aware service shape.
 */
export default defineSchema('membership', {
  archetype: Archetype.Component,
  parents: ['user'],
  tenanted: true,
  fields: {
    id: t.tenantedBigSerial().primaryKey(),
    role: t.enum(['owner', 'admin', 'editor', 'reader', 'guest']).required(),
  },
  uniques: [
    ['workspace_id', 'user'],
  ],
})
