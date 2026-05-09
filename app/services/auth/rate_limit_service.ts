/**
 * Rate-limit windows for the auth surface.
 *
 * Tech Spec § Idempotency / rate limits — magic-link requests are capped
 * at 5 per email per rolling 10-minute window (the per-IP cap from earlier
 * drafts was dropped; per-email is the operative bound).
 *
 * Implementation reads `login_attempt` rows for the relevant email +
 * `kind = 'magic_request'` within the window. Read-only here; writing
 * the attempt row is the magic-link service's responsibility.
 */

import { sql } from '@strav/database'

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

export const MAGIC_REQUESTS_PER_EMAIL_PER_10MIN = 5
const WINDOW_SECONDS = 10 * 60

export async function checkMagicLinkRequestRate(email: string): Promise<RateLimitVerdict> {
  const normalized = email.trim().toLowerCase()

  const rows = (await sql`
    SELECT
      COUNT(*)::int       AS "count",
      MIN("created_at")   AS "oldest"
    FROM "login_attempt"
    WHERE "kind"  = 'magic_request'
      AND "email" = ${normalized}
      AND "created_at" > now() - interval '10 minutes'
  `) as Array<{ count: number; oldest: Date | null }>

  const row = rows[0]!
  if (row.count < MAGIC_REQUESTS_PER_EMAIL_PER_10MIN || !row.oldest) {
    return { allowed: true }
  }

  // Window slides forward as the oldest attempt ages out — retry_after is
  // when the oldest attempt leaves the 10-minute window.
  const windowEndMs = new Date(row.oldest).getTime() + WINDOW_SECONDS * 1000
  const retryAfterMs = windowEndMs - Date.now()
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
  }
}
