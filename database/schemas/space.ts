import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Top-level container within a workspace; holds a tree of folders + docs.
 * Tenanted: scoped to `workspace_id` (auto-injected by `tenanted: true`).
 *
 * `visibility = 'protected'` is visible to every workspace member;
 * `'private'` is visible only to an invited subset (invite mechanism is
 * a v2 People & Access slice). Public visibility is a v1 non-goal.
 *
 * `(workspace_id, slug)` is unique: each space slug must be unique
 * within its workspace, but the same slug may recur across workspaces.
 */
export default defineSchema('space', {
  archetype: Archetype.Entity,
  tenanted: true,
  fields: {
    id: t.tenantedBigSerial().primaryKey(),
    slug: t.varchar(80).required(),
    name: t.varchar(80).required(),
    icon: t.varchar(40).nullable(),
    visibility: t.enum(['protected', 'private']).required(),
    template: t.varchar(40).required(),
  },
  uniques: [
    ['workspace_id', 'slug'],
  ],
})
