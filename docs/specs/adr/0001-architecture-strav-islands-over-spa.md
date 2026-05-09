# ADR-0001 — Architecture: Strav islands over decoupled SPA

Status:       Proposed
Relationship:
Date:         2026-05-09
Decided by:

---

## Context

Musagete is a reference application for the Strav framework (Discovery `00-discovery.md` — Showcase Subject). Strav is a Bun-native, server-first framework: it renders `.strav` templates server-side and supports hydrating Vue 3 components as **islands** within those templates. A decoupled SPA is the obvious alternative shape, but it discards the very capability the showcase exists to demonstrate.

Two viable shapes for a Vue-based rebuild:

1. Use Strav's native island architecture — server renders pages, Vue islands hydrate only the interactive bits (editor, palette, AI drawer, review).
2. Run a decoupled Vue 3 + Vite SPA against Strav as a headless API.

Reading is the headline job (Discovery `G2`). Editing, search, and review are interactive but localized. The decision is now because all subsequent slices depend on where templates live and where Vue components mount.

---

## Decision

We adopt **Strav's island architecture**: pages are `.strav` server-rendered templates under `resources/views/`; Vue 3 single-file components live under `resources/ts/islands/` and mount in the templates that need interactivity. No SPA shell, no client router, no global state library on the client.

---

## Tradeoffs

**What we gain:**
- Read paths return fully-rendered HTML with zero JavaScript required (`G2`).
- The full Strav surface (`@strav/view`, sessions, route groups) is exercised, satisfying the showcase Subject.
- Smaller frontend build; per-island bundles; faster cold paint.
- Authentication and authorization stay server-authoritative; no token-juggling in the browser.

**What we give up:**
- We cannot write the entire app as a single Vue tree; islands are isolated and must communicate through HTTP and `@strav/signal` channels.
- Some patterns familiar from SPAs (client-side route transitions, global Pinia stores) don't apply; teams transferring from SPA work need to relearn island boundaries.
- Sharing state between islands on the same page requires explicit wiring (props, custom events on `window`, or signal channels).

**Why the exchange is worth it:**
The showcase exists to demonstrate Strav. A decoupled SPA would showcase Vite, not Strav. The cost is paid once (mental model shift); the benefit compounds across every slice that exercises a Strav package.

---

## Alternatives considered

### Option A — Decoupled Vue 3 + Vite SPA against Strav as headless API
- **Pros:** Familiar SPA model; rich client routing; easy global state.
- **Cons:** Bypasses `@strav/view`; two deploy artifacts; loses no-JS reading; reduces showcase value.
- **Why rejected:** doesn't honor the Showcase Subject.

### Option B — Hybrid (SSR for reading, SPA for editor/admin)
- **Pros:** Preserves no-JS reading; SPA ergonomics where they matter.
- **Cons:** Two architectures in one repo; auth boundary across SSR ↔ SPA shell adds complexity; doubles the integration test surface.
- **Why rejected:** complexity outweighs the marginal SPA benefit for a vertical-slice v1.

### Option C — Strav islands (chosen)
- **Pros:** Native to the framework; demonstrates `@strav/view` + island hydration; keeps auth simple; fastest path to a no-JS reading surface.
- **Cons:** Island communication patterns are project-new and need to be documented.
- **Chosen because:** it is the only option that honors `G1`, `G2`, and the Showcase intent simultaneously.

---

## Consequences

- **Positive:** Read paths trivially satisfy `G2`'s no-JS requirement; layout and typography ship as `.strav` template + global tokens. Server-side auth is straightforward.
- **Negative:** Editor, palette, review, and AI drawer must be designed as standalone Vue mount points; cross-island state goes via HTTP fetch or `@strav/signal`.
- **Neutral / follow-ups:** A small "island communication" pattern will likely emerge; promote it to `patterns/` after its second instance.

---

## Verification hooks

- [ ] Reader route's **main content** (title, body, byline, code blocks, marginalia) renders correctly with JavaScript disabled. Topbar (theme/density toggles) and footnote popovers may require hydration.
- [ ] No client-side router code in `resources/ts/`.
- [ ] Each island file under `resources/ts/islands/` is mounted from at least one `.strav` template.
- [ ] No interactive surface (editor, palette, AI drawer, review) is mounted on read-only doc routes.

---

## Signature

```
Decided by:
Date:
```

---

## Amendment log

*(Append-only.)*
