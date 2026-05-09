import { defineSchema, t, Archetype } from '@strav/database'

/**
 * Audit row written for *every* auth attempt (magic-link request,
 * magic-link consume, OAuth callback, TOTP verify) regardless of
 * outcome. Drives the rate-limit windows (5 magic-link requests per
 * email per rolling 10-minute window) and feeds the future audit log.
 *
 * No FK to `user` — at attempt time the user may not yet exist
 * (e.g. first-time magic-link request).
 */
export default defineSchema('login_attempt', {
  archetype: Archetype.Event,
  fields: {
    id: t.bigserial().primaryKey(),
    email: t.varchar(254).nullable().index(),
    ip: t.inet().nullable().index(),
    kind: t.enum(['magic_request', 'magic_consume', 'oauth', 'totp']).required(),
    success: t.boolean().required(),
  },
})
