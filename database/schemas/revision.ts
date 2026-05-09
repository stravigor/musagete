import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Immutable content snapshot. Every save creates a new revision; the
 * doc's "current" content is `doc.currentRevisionId`. Drafts have
 * `status = 'draft'` and are not eligible to be a current_revision_id
 * (per ADR-0007).
 *
 * Tenanted: scoped to `workspace_id`. Parent FK to `doc` is composite
 * `(workspace_id, doc_id) → doc(workspace_id, id)` (auto-promoted
 * because `doc.id` is a `tenantedBigSerial`); CASCADE on doc delete
 * (deleting a doc deletes its history — non-issue at v1 scale).
 *
 * `author` is `t.reference('user').required()` — emits `author_id BIGINT`
 * with `ON DELETE RESTRICT`, blocking user deletion until authored
 * revisions are explicitly handled (transfer or anonymize, both v2).
 *
 * `parentRevision` is `t.reference('revision').nullable()` — emits a
 * composite self-FK `(workspace_id, parent_revision_id) → revision(workspace_id, id)`.
 * Self-references are supported via `@strav/database`'s self-FK pass.
 * Composite FKs come back as CASCADE (framework constraint — SET NULL is
 * impossible for NOT NULL composite FKs); functionally fine because
 * ADR-0007 forbids revision deletion under normal flow.
 */
export default defineSchema('revision', {
  archetype: Archetype.Event,
  parents: ['doc'],
  tenanted: true,
  fields: {
    id: t.tenantedBigSerial().primaryKey(),
    author: t.reference('user').required(),
    message: t.text().nullable(),
    content: t.text().required(),
    parentRevision: t.reference('revision').nullable(),
    status: t.enum(['draft', 'published']).required().default('draft'),
  },
})
