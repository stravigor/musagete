import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Per-space toggles for review, comments, and AI indexing. 1:1 with
 * `space` — the parent's `unique: true` flag emits a UNIQUE constraint
 * on the auto-generated `space_id` column.
 *
 * `space_id` lookup runs through the auto-promoted composite FK
 * `(workspace_id, space_id) → space(workspace_id, id)`, courtesy of
 * `space.id` being a `tenantedBigSerial`.
 *
 * Defaults match the security-conservative posture: review on, comments
 * on, AI indexing on. The wizard inverts any of these per template
 * (e.g., the Security & Compliance template forces review on).
 */
export default defineSchema('space_defaults', {
  archetype: Archetype.Component,
  parents: [{ name: 'space', unique: true }],
  tenanted: true,
  fields: {
    id: t.tenantedBigSerial().primaryKey(),
    requireReview: t.boolean().required().default(true),
    allowComments: t.boolean().required().default(true),
    aiIndex: t.boolean().required().default(true),
  },
})
