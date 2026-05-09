import { describe, test, expect } from 'bun:test'
import { TestCase } from '@strav/testing'
import { sql } from '@strav/database'
import { app } from '@strav/kernel'
import {
  MailManager,
  MailProvider,
  type MailTransport,
  type MailMessage,
  type MailResult,
} from '@strav/signal'

/**
 * Slice 001 — Scenario 1 (Build-T1 Checkpoint 3, first failing BDD test).
 *
 * Encodes the acceptance criterion BEFORE any production handler logic
 * exists in the magic-link service. With the current TODO bodies, the
 * controller returns 202 (so the response-shape assertions pass) but no
 * `magic_link` row is INSERTed — so the row-presence assertion fails.
 * That failure is the test's job at this checkpoint.
 *
 * Once Build-T1 fills the magic-link service body (Checkpoint 3+), this
 * test goes green; further scenarios then file in alongside.
 *
 * Preconditions to run:
 *   - Postgres up at $DB_HOST:$DB_PORT (per .env / config/database.ts).
 *   - `bun strav migrate` has applied slice 001's migration (creates
 *     `magic_link`, `user`, `session`, … tables).
 *
 * Test isolation: TestCase.boot() wraps each test in a transaction that
 * auto-rolls-back after the test, so no manual cleanup is required.
 */

const t = await TestCase.boot({
  routes: () => import('#routes/auth'),
})

// MailProvider isn't booted by TestCase; register so MailManager loads
// `config/mail.ts` (the `default`/`inlineCss`/`tailwind` keys it reads
// during PendingMail.build()).
const mailProvider = new MailProvider()
mailProvider.register(app)
await mailProvider.boot(app)

// Memory transport — captures every dispatched message so the test can
// assert on it without contacting any real provider.
const sentMail: MailMessage[] = []
const memoryTransport: MailTransport = {
  async send(message: MailMessage): Promise<MailResult> {
    sentMail.push(message)
    return {
      messageId: `memory-${sentMail.length}`,
      accepted: ([] as string[]).concat(message.to),
      rejected: [],
    }
  },
}
MailManager.useTransport(memoryTransport)

describe('POST /auth/magic — Scenario 1: First-time user signs in with a magic link', () => {
  test('returns 202 + creates a magic_link row + email is dispatched', async () => {
    // ── Given: no existing user with this email
    //    (transaction rollback per test ensures the precondition; we don't
    //    need to truncate any table by hand)
    const email = 'ada@example.com'

    // ── When: the user submits the email and chooses "Email me a link"
    const res = await t.post('/auth/magic', { email })

    // ── Then:
    // 1) HTTP response is 202 with the documented shape
    expect(res.status).toBe(202)
    const body = (await res.json()) as { status: string; expires_in_seconds: number }
    expect(body.status).toBe('sent')
    expect(body.expires_in_seconds).toBe(15 * 60) // 15-minute expiry per Tech Spec

    // 2) Exactly one magic_link row exists for this email
    const rows = (await sql`
      SELECT id, email, expires_at, consumed_at
      FROM "magic_link"
      WHERE email = ${email}
    `) as Array<{ id: number; email: string; expires_at: Date; consumed_at: Date | null }>

    expect(rows).toHaveLength(1)

    const link = rows[0]!
    expect(link.consumed_at).toBeNull()

    // 3) The expiry sits 15 minutes ± 5s in the future (clock-tolerant)
    const now = Date.now()
    const expiresAtMs = new Date(link.expires_at).getTime()
    const ttlMs = expiresAtMs - now
    expect(ttlMs).toBeGreaterThan(15 * 60 * 1000 - 5_000)
    expect(ttlMs).toBeLessThan(15 * 60 * 1000 + 5_000)

    // 4) Exactly one email is dispatched, addressed to the requested email,
    //    with a subject and a body containing the magic-link URL.
    //    NB: `sentMail` is module-scoped — capture from prior tests can
    //    accumulate within a single bun-test run. We assert at-least-one
    //    matching message rather than `length === 1`.
    const matching = sentMail.filter((m) => stringTo(m.to) === email)
    expect(matching.length).toBeGreaterThanOrEqual(1)

    const last = matching[matching.length - 1]!
    expect(last.subject).toContain('Sign in to Musagete')
    expect(last.html ?? '').toMatch(/href="[^"]*\/auth\/magic\//)
    expect(last.text ?? '').toMatch(/\/auth\/magic\//)
  })
})

function stringTo(to: string | string[]): string {
  return Array.isArray(to) ? to[0] ?? '' : to
}
