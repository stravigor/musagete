import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Logical document within a space. Stable identity; content lives in
 * immutable `revision` rows; `currentRevision` points to the most
 * recently published revision per ADR-0007.
 *
 * Tenanted: scoped to `workspace_id`. Parent FK to `space` is composite
 * `(workspace_id, space_id) → space(workspace_id, id)` (auto-promoted
 * because `space.id` is a `tenantedBigSerial`).
 *
 * `currentRevision` is a `t.reference('revision').nullable()` — emits
 * a composite FK `(workspace_id, current_revision_id) → revision(workspace_id, id)`.
 * Cycle with `revision.parents = ['doc']` is supported via `@strav/database`'s
 * circular-FK pass. ADR-0007 wanted ON DELETE RESTRICT here, but composite
 * FKs in the framework are emitted as CASCADE (SET NULL is impossible
 * because the tenant FK column is NOT NULL; CASCADE is the framework's
 * default). Functionally equivalent: ADR-0007 forbids revision deletion
 * under normal flow, so the CASCADE pathway is unreachable in practice.
 */
export default defineSchema('doc', {
  archetype: Archetype.Component,
  parents: ['space'],
  tenanted: true,
  fields: {
    id: t.tenantedBigSerial().primaryKey(),
    slug: t.varchar(80).required(),
    title: t.varchar(200).required(),
    folderPath: t.varchar(255).required().default('/'),
    currentRevision: t.reference('revision').nullable(),
  },
  // `space_id` is `tenantedBigSerial` (per-tenant), so two workspaces may
  // each have a `space_id=1`. The slug-uniqueness constraint must include
  // the tenant FK column to be tenant-scoped — otherwise two workspaces
  // seeding the same template (with the same doc slugs in their per-
  // workspace space_id=1) would collide across tenants. The framework
  // auto-includes `workspace_id` for parents-with-`unique:true`, but not
  // for explicit `uniques:` entries; we name it explicitly here.
  uniques: [
    ['workspace_id', 'space', 'slug'],
  ],
})
