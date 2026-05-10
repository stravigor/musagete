# `@strav/testing` — `signInWithMagicLink` hardcodes `strav_session` cookie name

**Status:** issue draft, ready to file against [stravigor/strav](https://github.com/stravigor/strav).
**Surfaced by:** musagete slice 003 Build-T1, while wiring `BrowserTestCase` for the slice's automated smoke-check.
**Severity:** medium — blocks `BrowserTestCase`'s built-in magic-link sign-in helper from working with apps that set their own session-cookie name. Apps with custom auth (musagete, any project that registers Strav's `SessionProvider` only for OAuth state binding while owning its own session table) must reimplement the helper locally.

---

## Reproducer

`BrowserTestCase.signInWithMagicLink` (and therefore `DemoFlow.signIn`) does the magic-link round-trip out-of-band — POST to `/auth/magic`, wait for captured mail, follow the link via `fetch`, parse Set-Cookie, inject the cookie into Playwright's context. The Set-Cookie parser is hardcoded to `strav_session`:

```ts
// node_modules/@strav/testing/src/browser/test_case.ts
function pickSessionCookie(setCookies: string[]): string | null {
  for (const raw of setCookies) {
    const match = raw.match(/^(?:strav_session)=([^;]+)/)
    if (match) return decodeURIComponent(match[1]!)
  }
  return null
}
```

…and the cookie injection re-uses `SessionManager.config.cookie` (also `strav_session` by default):

```ts
await this.context.addCookies([{
  name: SessionManager.config.cookie,
  value: sessionCookie,
  …
}])
```

For an app like musagete that owns `musagete_session` (chosen distinct from `strav_session` so OAuth state and the project's own session don't collide — see `app/services/auth/session_service.ts`), `signInWithMagicLink` returns `null` from `pickSessionCookie` and throws `did not return a Set-Cookie header` even though the verify request set a perfectly valid `musagete_session` cookie.

## Expected behavior

`signInWithMagicLink` (and `DemoFlow.signIn`) accept a `cookieName` option; the helper uses it both for the Set-Cookie regex and the Playwright `addCookies` call. Default stays `strav_session` so existing apps don't notice. Apps with custom session cookies pass their name explicitly:

```ts
await flow.signIn({ email: 'demo@example.com', cookieName: 'musagete_session' })
```

A nicer ergonomic: `DemoFlow.boot({ cookieName: 'musagete_session' })` sets it once for the test file.

## Acceptance criteria

- [ ] `signInWithMagicLink` and `DemoFlow.signIn` accept a `cookieName` option; default `strav_session`.
- [ ] `DemoFlow.boot({ cookieName })` threads the value through to every `signIn` call.
- [ ] An adversarial test in `@strav/testing` exercises the helper against a server that sets a non-default cookie name.
- [ ] Documentation (`docs/testing/testing.md` § BrowserTestCase) names the option and links the rationale (apps with custom auth).

## Workaround until upstream lands

`tests/utils/musagete_demo_flow.ts` reimplements the magic-link → cookie inject dance using `SESSION_COOKIE_NAME` from `app/services/auth/session_service.ts`. The wrapper (`MusageteDemoFlow`) re-exposes `BrowserTestCase`'s DSL so slice flow files import it instead of `DemoFlow` directly. Once upstream lands, the wrapper drops back to `DemoFlow` with `cookieName: SESSION_COOKIE_NAME` and the file shrinks by ~70 lines.
