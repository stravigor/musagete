/**
 * Musagete-flavored wrapper around `@strav/testing`'s `BrowserTestCase`.
 *
 * Why a wrapper over `DemoFlow`:
 *   - musagete uses its own session cookie (`musagete_session`, see
 *     `app/services/auth/session_service.ts`) — distinct from the framework's
 *     `strav_session` so OAuth state and our session don't collide.
 *   - `@strav/testing`'s `signInWithMagicLink` parses Set-Cookie hardcoded
 *     against `strav_session` (see `node_modules/@strav/testing/src/browser/test_case.ts`
 *     `pickSessionCookie`), so the framework helper can't capture
 *     `musagete_session`. The wrapper does the magic-link → cookie inject
 *     dance with our cookie name. Tracked upstream in
 *     `docs/notes/strav-testing-app-cookie-name.md`.
 *
 * Boot side-effects:
 *   - registers musagete's `MailProvider` so `mail.raw(...)` from
 *     `@strav/signal` resolves; the framework swaps the transport for an
 *     in-memory one when `mail: 'capture'` (default).
 *   - registers musagete's `ViewProvider` and seeds template globals via
 *     `setupViewGlobals()` so layouts/partials don't throw ReferenceError
 *     on bare identifiers (`{{ theme }}`, `{{ sidebarSpaces }}`, ...).
 */
import { BrowserTestCase } from '@strav/testing'
import { app } from '@strav/kernel'
import { MailProvider } from '@strav/signal'
import { ViewProvider } from '@strav/view'
import { SESSION_COOKIE_NAME } from '#services/auth/session_service'
import { setupViewGlobals } from '#start/view_globals'

export interface MusageteDemoFlowOptions {
  fresh?: boolean
}

export class MusageteDemoFlow {
  readonly tc: BrowserTestCase

  constructor(tc: BrowserTestCase) {
    this.tc = tc
  }

  static async boot(opts: MusageteDemoFlowOptions = {}): Promise<MusageteDemoFlow> {
    const tc = await BrowserTestCase.boot({
      fresh: opts.fresh ?? true,
      mail: 'capture',
      auth: false,
      // 15s default action timeout — Vue island hydration + redirect chains
      // sometimes overshoot the framework's 5s default on cold runs.
      timeout: 15_000,
      bootstrap: async () => {
        const mailProvider = new MailProvider()
        mailProvider.register(app)
        await mailProvider.boot(app)

        const viewProvider = new ViewProvider()
        viewProvider.register(app)
        await viewProvider.boot(app)

        setupViewGlobals()

        // Tests don't run IslandBuilder (it's a multi-second esbuild step)
        // — point @islands at the pre-built bundle on disk so Vue can
        // hydrate. The bundle is rebuilt as a side-effect of `bun run dev`;
        // if a Vue island is changed without `bun run dev` having rebuilt,
        // the test exercises the stale JS. Acceptable trade-off because the
        // smoke-check's job is end-to-end-with-the-shipped-bundle, not
        // developer-loop watch-mode.
        const { ViewEngine } = await import('@strav/view')
        ViewEngine.setGlobal('__islandsSrc', '/builds/islands.js')
      },
      routes: () => import('#start/routes'),
    })
    return new MusageteDemoFlow(tc)
  }

  get page() { return this.tc.page }
  get baseUrl() { return this.tc.baseUrl }
  get hostname() { return this.tc.hostname }

  goto(path: string) { return this.tc.goto(path) }
  click(selector: string) { return this.tc.click(selector) }
  fill(selector: string, value: string) { return this.tc.fill(selector, value) }
  expectUrl(url: string | RegExp) { return this.tc.expectUrl(url) }
  expectVisible(selector: string, text?: string | RegExp) { return this.tc.expectVisible(selector, text) }
  expectComputedStyle(
    selector: string,
    property: string,
    matcher: Parameters<BrowserTestCase['expectComputedStyle']>[2],
  ) {
    return this.tc.expectComputedStyle(selector, property, matcher)
  }
  waitFor(selector: string, opts?: { state?: 'attached' | 'visible' | 'hidden' | 'detached'; timeout?: number }) {
    return this.tc.waitFor(selector, opts)
  }

  /**
   * Magic-link sign-in. Posts to `/auth/magic`, follows the captured email's
   * redeem link out-of-band (so we can read the Set-Cookie header), then
   * injects `musagete_session` into Playwright's browser context.
   */
  async signIn(email: string): Promise<void> {
    const issueRes = await fetch(`${this.baseUrl}/auth/magic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!issueRes.ok) {
      throw new Error(`signIn: POST /auth/magic returned ${issueRes.status}: ${await issueRes.text()}`)
    }

    const mail = this.tc.capturedMail()
    const captured = await mail.waitFor({ to: email })
    const rawLink = mail.extractLink(captured, /https?:\/\/[^\s"'<>]+\/auth\/magic\/[^\s"'<>?&]+/)
    if (!rawLink) throw new Error(`signIn: no /auth/magic/<token> link found in mail to ${email}`)

    // The magic-link service builds the URL from config('http.app_url')
    // (see app/services/auth/magic_link_service.ts) — typically
    // http://localhost:3000 in dev. The test listener is on an ephemeral
    // port, so rewrite host:port to baseUrl before following.
    const linkPath = new URL(rawLink).pathname
    const link = `${this.baseUrl}${linkPath}`

    const verifyRes = await fetch(link, { redirect: 'manual' })
    const setCookieRaw =
      (verifyRes.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
      [verifyRes.headers.get('set-cookie') ?? '']
    const sessionValue = pickMusageteSession(setCookieRaw)
    if (!sessionValue) {
      throw new Error(
        `signIn: ${link} did not return a Set-Cookie for ${SESSION_COOKIE_NAME} (status ${verifyRes.status}).`,
      )
    }

    await this.tc.context.addCookies([{
      name: SESSION_COOKIE_NAME,
      value: sessionValue,
      domain: this.hostname,
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    }])
  }
}

function pickMusageteSession(setCookies: string[]): string | null {
  const re = new RegExp(`^${SESSION_COOKIE_NAME}=([^;]+)`)
  for (const raw of setCookies) {
    const match = raw.match(re)
    if (match) return decodeURIComponent(match[1]!)
  }
  return null
}
