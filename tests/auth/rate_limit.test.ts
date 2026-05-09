import { describe, test, expect } from 'bun:test'
import { TestCase } from '@strav/testing'
import { sql } from '@strav/database'

/**
 * Slice 001 — Scenario 8: Rate limit on magic-link requests.
 *
 * 5 successful magic_request login_attempts within the 10-minute window
 * cap the email; the 6th request is rejected with 429 + retry_after.
 */

const t = await TestCase.boot({
  routes: () => import('#routes/auth'),
})

describe('POST /auth/magic — Scenario 8: Rate limit on magic-link requests', () => {
  test('6th request within 10 minutes is rejected with 429 + retry_after; no new magic_link row', async () => {
    const email = 'ada@example.com'

    // ── Given: 5 magic_request login_attempts within the window.
    for (let i = 0; i < 5; i++) {
      await sql`
        INSERT INTO "login_attempt" ("email", "kind", "success")
        VALUES (${email}, 'magic_request', true)
      `
    }

    // ── When: a 6th request lands.
    const res = await t.post('/auth/magic', { email })

    // ── Then:
    // 1) 429 with the documented body shape
    expect(res.status).toBe(429)
    const body = (await res.json()) as { error: string; retry_after: number }
    expect(body.error).toBe('rate_limited')
    expect(body.retry_after).toBeGreaterThanOrEqual(1)
    expect(body.retry_after).toBeLessThanOrEqual(10 * 60)

    // 2) No magic_link row created for this email
    const links = (await sql`
      SELECT count(*)::int AS "count" FROM "magic_link" WHERE "email" = ${email}
    `) as Array<{ count: number }>
    expect(links[0]!.count).toBe(0)

    // 3) The denial itself was recorded as a failed login_attempt
    const failed = (await sql`
      SELECT count(*)::int AS "count"
      FROM "login_attempt"
      WHERE "email" = ${email}
        AND "kind"  = 'magic_request'
        AND "success" = false
    `) as Array<{ count: number }>
    expect(failed[0]!.count).toBe(1)
  })
})
