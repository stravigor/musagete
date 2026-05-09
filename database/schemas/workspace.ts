import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Tenant root. Every tenant-scoped row in the project carries
 * `workspace_id` (auto-injected by `tenanted: true`) referencing this
 * table; `@strav/database` derives the FK column name and idType for
 * the RLS policy DDL from this schema's name + PK pgType.
 *
 * Slice 002 — workspace + space bootstrap.
 *
 * `owner` is a denormalized FK to the creating user (also encoded in
 * `membership` with `role='owner'`); kept here for fast lookups in the
 * `/` redirect path. `t.reference('user').required()` emits an
 * `owner_id BIGINT` column referencing `user(id)` with `ON DELETE
 * RESTRICT` — a user with workspaces they own cannot be deleted until
 * ownership is reassigned. Ownership-transfer is a v2 flow; v1 simply
 * blocks the destructive case. Forms a 2-schema cycle with
 * `user.lastWorkspace → workspace`; supported via `@strav/database`'s
 * circular-FK pass.
 */
export default defineSchema('workspace', {
  archetype: Archetype.Entity,
  tenantRegistry: true,
  fields: {
    id: t.bigserial().primaryKey(),
    slug: t.varchar(80).required().unique(),
    name: t.varchar(80).required(),
    owner: t.reference('user').required(),
  },
})
