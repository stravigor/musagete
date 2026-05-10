# Turn chain — slice `003-reader-editorial-layout`

```
slice_id:    003-reader-editorial-layout
started:     2026-05-09
last_turn:   Integrate-T1
```

*References:*
- [Slice file](./003-reader-editorial-layout.md)
- [Tech Spec](./003-reader-editorial-layout.tech.md)
- Design handoff: `/Users/liva/Projects/Strav.dev/documents/musagete/design_handoff_musagete_kb/` (out-of-repo; binding §6 token set + reader anatomy from `source/reader.jsx` + `source/styles.css` + `source/chrome.css`)

---

### `Build-T0` — token foundation, fonts, base reset, shell layout, third-party deps

```yaml
id:             Build-T0
phase:          Build
intent:         Bring slice 003's preconditions into the holding state — install markdown-it / shiki / mermaid, lay down tokens.css + reset.css + app.css from the design handoff, load the Newsreader / DM Sans / JetBrains Mono fonts, ship the minimal shell layout with theme/density/accent attributes wired from cookies — so Build-T1 can resume against a styled foundation when authoring the reader template + the retroactive theming pass.
owner:          ai
inputs:
  - ./003-reader-editorial-layout.md            (slice — status: ready, owner_turn: Build-T0)
  - ./003-reader-editorial-layout.tech.md       (Tech Spec — Signed 2026-05-09 by Liva)
  - ../00-discovery.md § Goals G2, P6           (signed)
  - ../10-design.md § Conventions V1–V8 (signed); § Architecture sketch (signed)
  - ../adr/0001-architecture-strav-islands-over-spa.md  (Accepted)
  - ../adr/0003-styling-tokens-css-modules.md           (Accepted — ADR specifies tokens via CSS @layer + CSS Modules; Tailwind/UI-kits explicitly rejected)
  - ../adapters/strav.md § 1 row 12–15 (UI tail), § 2 (checkpoints), § 9 (self-check)  (accepted)
  - /Users/liva/Projects/Strav.dev/documents/musagete/design_handoff_musagete_kb/README.md         § 6 (binding token set), § 5 (interaction & behavior)
  - /Users/liva/Projects/Strav.dev/documents/musagete/design_handoff_musagete_kb/source/styles.css (lines 7–55: tokens; 84–128: base reset; 142–240: editorial typography; 255–319: code blocks + callouts)
  - /Users/liva/Projects/Strav.dev/documents/musagete/design_handoff_musagete_kb/source/chrome.css (sidebar/topbar/reader-grid CSS — for Build-T1, but used here to scope T0's app.css imports)

preconditions:
  - All cited ADRs are Accepted; Discovery + Design + Tech Spec are Signed; adapter is accepted.
  - Slice 002 is shipped; the workspace + space + doc + revision tables are in place; the slice-002 surfaces (auth view, workspace forms, wizard) ship with ad-hoc CSS that this slice will retroactively theme in Build-T1.
  - The design handoff's `source/styles.css` § 6 token set is the *binding* spec for slice 003's tokens.css. Verbatim copy.
```

**verification (pre-act)**

```yaml
ai_of_human:
  missing_preconditions:
    - "**`markdown-it` + plugins not installed.** Tech Spec dependencies pin `markdown-it` + `markdown-it-footnote`, `markdown-it-anchor`, `markdown-it-attrs`, `markdown-it-task-lists`. None are in `package.json`. Build-T0 step 1: `bun add markdown-it markdown-it-footnote markdown-it-anchor markdown-it-attrs markdown-it-task-lists` + the matching `@types/markdown-it`."
    - "**`shiki` not installed.** Build-T0 step 2: `bun add shiki`. Shiki ships precompiled grammars; no separate language packages needed for the v1 set (typescript, javascript, json, sh/bash, yaml, sql)."
    - "**`@mermaid-js/mermaid-cli` not installed AND requires headless Chrome.** Server-side Mermaid → SVG renders via Puppeteer-driven Chromium. Two paths: (a) install `@mermaid-js/mermaid-cli` and rely on the bundled Puppeteer (~150MB Chromium download on first install — operator-visible); (b) use a lighter renderer like `mermaid` library + `jsdom` for headless DOM (no Chromium, but Mermaid library expects browser globals — flaky). Recommend (a) for accuracy; document the size in the slice retro. Decide before T0 commits the install."
    - "**Font loading strategy unpinned.** Tech Spec offers two paths: Google Fonts CSS link (latency cost on cold paint; CDN dependency) vs. self-hosted (zero-runtime-network; subsetting work). For v1, recommend Google Fonts with `font-display: swap` (handoff §6.4 specifies the exact URL); self-hosting becomes a polish task post-v1. Confirm."
    - "**Mermaid pre-render at save time vs. template time.** Tech Spec § Data model defers `revision.html_cache` to slice 004 (save). Slice 003 renders at template time (one-shot per request), accepting the latency cost. The NFR target `cold paint p50 < 100ms` is at risk if mermaid blocks are common — single-block render can be ~200-500ms via Puppeteer. Mitigation: cache rendered SVGs in-process keyed by `(workspace_id, revision_id, block_index)`. Confirm cache strategy or accept the latency for v1."

  ambiguities:
    - "**Shiki theme to design tokens — single light/dark theme or per-language?** Shiki's `cssVariables` pattern lets a single theme drive both light and dark via `var(--*)`. Recommend: write `shiki-musagete-light.json` and `shiki-musagete-dark.json` that emit `var(--accent)` / `var(--ok)` / `var(--ink)` / etc. — tokens propagate via existing `[data-theme]` switch. The trade-off is that some Shiki grammar tokens have no design equivalent (e.g., `attribute`, `regexp`, `parameter`); fall back to `--ink-2`. Pin before Checkpoint 1."
    - "**Heading IDs for TOC — `markdown-it-anchor` slug strategy.** Default uses `github-slugger` (lowercase, dash-joined, dedup with `-1`/`-2` suffixes). The design's TOC items show plain text; URL-fragment anchoring via `#stages-in-order` etc. Confirm the default; or pin a specific slugger if collisions matter (unlikely at v1 doc volumes)."
    - "**Topbar island scope — does the read path render `<vue:topbar/>` at all in v1?** Tech Spec says the read path mounts no islands by default; theme/density/accent toggles are deferred to a future Topbar island. For v1, the cookies-or-defaults approach means: no toggle UI; the user can only switch themes by editing cookies manually. Acceptable per the JS-disabled-by-default invariant; flag as a v1.5 polish task."

  conflicts: (none)

  # If you authorize T0 to install the deps + lay down tokens.css + reset.css
  # + app.css + shell.strav + the font loader, the Turn proceeds. Halts at
  # Checkpoint 1 (the "tokens.css ships verbatim" verification).
```

**Human resolution (2026-05-09 — Liva)**

```yaml
ai_of_human (resolution):
  missing_preconditions:
    - "markdown-it + 4 plugins: install via bun add."
    - "shiki: install via bun add."
    - "Mermaid renderer: accept the @mermaid-js/mermaid-cli + Chromium path. Document the size in the slice retro."
    - "Font loading: Google Fonts CSS + font-display: swap for v1. Self-hosting becomes post-v1 polish."
    - "Mermaid render latency: in-process LRU cache keyed by (workspace_id, revision_id, block_index)."
  ambiguities:
    - "Shiki theme: single cssVariables theme that emits var(--accent) / var(--ok) / etc.; theme switching propagates via existing [data-theme] switch."
    - "Heading slugger: github-slugger default."
    - "Topbar island: deferred for v1; theme/density/accent via cookies + defaults; manual cookie editing only."

decision (Build-T0): advance.
```

**work**

Decisions and their rationale, in execution order:

1. **Installed dependencies.** `bun add markdown-it markdown-it-footnote markdown-it-anchor markdown-it-attrs markdown-it-task-lists shiki` (66 packages). `bun add -d @types/markdown-it`. `bun add @mermaid-js/mermaid-cli` (344 packages including the bundled Chromium download for headless Mermaid SVG rendering — ~150MB on first install per the operator note in T0's `ai_of_human`).

2. **Wrote `resources/css/_tokens.scss`** — the design handoff §6 token set, verbatim from `source/styles.css` lines 7–82. Wrapped in `@layer tokens` per ADR-0003. 14 paper/ink colors + dark theme overrides + density-compact overrides + 4 accent variables (defaulted to terracotta `#B8442C`; user-overridable via inline style on `<html>`). Three type-family stacks (`--serif`/`--sans`/`--mono`). Layout vars (`--sidebar-w`, `--rail-w`, `--topbar-h`, `--maxread`, `--radius`, `--radius-lg`).

3. **Wrote `resources/css/_reset.scss`** — base reset from handoff `source/styles.css` lines 84–128. Box-sizing, html/body bg/color/font-family driven by tokens, scrollbars, `::selection` accent.

4. **Wrote `resources/css/_typography.scss`** — `.read*` editorial typography from handoff lines 142–252. `.read h1` (`opsz 48`, clamp(36px, 4vw, 52px)), `.read h2` (`opsz 32`), `.read h3` (sans uppercase tracked), `.read p` / `.read strong` / `.read code` / `.read kbd`, the `.lede::first-letter` drop cap (`opsz 72`, `4.4em`, accent), and the `[data-display="sans"]` overrides.

5. **Wrote `resources/css/_components.scss`** — `.codeblock` + Shiki `.tok-*` token classes (light + dark), `.callout` with italic serif glyph, `.diagram` (Mermaid container), `.btn` family, `.chip`, `.field`/`.field-input`/`.field-lbl` form primitives. The `.field` cluster is the design's form-primitive set; the retroactive theming pass at T1 drops slice 002's ad-hoc `<style module>` and adopts these classes.

6. **Refactored `resources/css/app.scss`** — was the demo SCSS shipped by Strav's scaffold; replaced with `@import 'tokens'; @import 'reset'; @import 'typography'; @import 'components';`. Sass `@import` of `.scss` partials inlines them at compile time (verified: bundle grew from 0.8kB CSS-only-imports to 12.9kB inlined). The first try used `@import './foo.css'` which sass preserves as runtime CSS imports; corrected to `.scss` partial naming.

7. **Updated `resources/views/layouts/app.strav`** — universal layout. Sets `<html data-theme/data-density/data-display style="--accent: …">` from optional view-data props (defaults: `light`/`regular`/`serif`/`#B8442C`). Loads the Newsreader/DM Sans/JetBrains Mono Google Fonts CSS (handoff §6.4 URL, `font-display: swap`). Loads `app.css`. Body has only `@show('content')` + `@islands` — no shell chrome at this layout level. (`shell.strav` deferred to T1 — see amendment below.)

**Tech Spec amendment (recorded next under Amendment log):**

The Tech Spec § App shell line said `resources/views/layouts/shell.strav` ships at T0. Moving it to T1 alongside the sidebar + topbar partials it composes — Strav's nested-layout support (`@layout('layouts/app')` inside another layout) is not yet verified, and shell.strav as an empty placeholder at T0 doesn't earn its slot. T1 ships it with the partials filled in.

**outputs**

```yaml
- package.json                                              edited       — added markdown-it (+4 plugins), shiki, @mermaid-js/mermaid-cli; @types/markdown-it (dev)
- bun.lock                                                  generated    — `bun install` lockfile updated; ~410 packages added (66 + 344) — Chromium bundle is the heaviest
- resources/css/_tokens.scss                                new          — §6 binding token catalog + dark + density-compact + accent presets, wrapped in @layer tokens
- resources/css/_reset.scss                                 new          — base reset (box-sizing, body type, scrollbars, ::selection)
- resources/css/_typography.scss                            new          — .read* editorial typography + drop cap + sans-display variant
- resources/css/_components.scss                            new          — codeblock + .tok-* (light + dark), callout, diagram, btn family, chip, field
- resources/css/app.scss                                    edited       — replaces Strav demo SCSS with @imports of the four partials
- resources/views/layouts/app.strav                         edited       — universal layout: fonts + data-attrs from cookies + design CSS; full-bleed (no shell)
```

**postconditions**

```yaml
postconditions:
  - [x] `bun install` exits 0; node_modules has markdown-it + 4 plugins + shiki + @mermaid-js/mermaid-cli.
  - [x] `bun run dev` builds CSS to `public/css/app.css` at ≥10kB (token catalog + reset + typography + components inlined). Observed: 12.9kB.
  - [x] `bun run dev` builds Vue islands to `public/builds/islands.js`; the existing 4 islands compile clean. Observed: 274.6kB / 4 components.
  - [x] `bun run typecheck` exits 0 for project-local sources.
  - [x] `bun test` exits 0 globally — slice 003 introduces no new tests at T0; slice 001 + slice 002 tests still pass. Observed: 19 pass / 1 skip / 0 fail / 147 expect() calls.
  - [x] No new schema files; no migrations.
  - [ ] Slice 003 Tech Spec amended (first entry) — `shell.strav` moved from T0 to T1. Entered next.
  - [x] No source-code changes to slice 001 / slice 002 surfaces (T0 is foundation only; retroactive theming lands at T1).
```

**decision (Build-T0):** `advance` — Liva, 2026-05-09. Build-T1 opens.

---

### `Build-T1` — reader path + markdown pipeline + shell + retroactive theming

```yaml
id:             Build-T1
phase:          Build
intent:         Implement slice 003 end-to-end against the foundation Build-T0 laid down. Six interlocking pieces: (1) markdown-it pipeline + Shiki theme + Mermaid renderer (the rendering machinery), (2) the read route + read.strav template, (3) shell.strav + sidebar/topbar partials (the signed-in chrome the reader inhabits), (4) retroactive theming of slice-002 surfaces (AuthForm/WorkspaceForm/CreateSpaceWizard), (5) BDD tests + round-trip-shape test, (6) browser smoke-check of the full slice-001 → slice-002 → slice-003 flow.
owner:          ai
inputs:
  - ./003-reader-editorial-layout.md            (slice — status: ready, owner_turn: Build-T0 → Build-T1)
  - ./003-reader-editorial-layout.tech.md       (Tech Spec — Signed; amended once at T0 close)
  - ./003-reader-editorial-layout.turns.md § Build-T0 (foundation: tokens, fonts, base reset, .read* typography, components)
  - ../00-discovery.md § Goals G2 (no-JS read path), P6 (editorial typography)
  - ../10-design.md § Conventions (V1 timestamps, V2 slugs, V4 RLS, V5 markdown storage)
  - ../adr/0001-architecture-strav-islands-over-spa.md  (Accepted)
  - ../adr/0003-styling-tokens-css-modules.md           (Accepted)
  - ../adr/0007-versioning-immutable-revisions.md       (Accepted — current_revision_id pointer is what the read path serves)
  - ../adapters/strav.md § 1 row 12–15 (UI tail), § 2 (checkpoints)
  - /Users/liva/Projects/Strav.dev/documents/musagete/design_handoff_musagete_kb/source/reader.jsx     (binding reader anatomy)
  - /Users/liva/Projects/Strav.dev/documents/musagete/design_handoff_musagete_kb/source/chrome.css    (.scroller / .reader-grid / .read-meta-left / .read-margin / .doc-* / .toc / .margin-note / sidebar / topbar)
  - /Users/liva/Projects/Strav.dev/documents/musagete/design_handoff_musagete_kb/source/auth.jsx + screens.css `.auth-*`     (auth retroactive theming target)
  - /Users/liva/Projects/Strav.dev/documents/musagete/design_handoff_musagete_kb/source/spaces.jsx + screens.css `.modal-*`/`.tpl-*`/`.steps`/`.radio-card`     (wizard retroactive theming target)
  - /Users/liva/Projects/Strav.dev/documents/musagete/design_handoff_musagete_kb/source/components.jsx Sidebar/Topbar         (shell-partials reference)

preconditions:
  - All Build-T0 postconditions ticked; deps installed; tokens / reset / typography / components SCSS partials shipped; layouts/app.strav loads them with fonts + data-attrs.
  - Slice 002 is shipped with seeded docs (engineering template's 4 placeholder docs) — they're the natural test fixtures for the read path.
  - The slice-002 surfaces (AuthForm/WorkspaceForm/CreateSpaceWizard + their .strav views) are demonstrable in browsers but use ad-hoc `<style module>` CSS pending this Turn's retroactive theming pass.
```

**verification (pre-act)**

```yaml
ai_of_human:
  missing_preconditions:
    - "Seeded doc bodies are plain text ('Add your first runbook here.'). The reader's editorial typography only shines on real markdown — headings, lists, code blocks, callouts, tables, mermaid. **For the smoke-check to be meaningful**, the engineering template's seed bodies should be markdown-shaped (e.g. an H1 + lede paragraph + a code block + a callout). Two paths: (a) update `app/services/spaces/space_templates.ts` to ship richer seed bodies during this Turn (small spec drift — Build-T0 resolution said 'placeholder bodies'); (b) keep the placeholder bodies and add a separate test fixture markdown file under `tests/fixtures/reader/` for the round-trip-shape test, demoing the typography there. Recommend (a) — slight drift, but the demo flow becomes self-contained: a freshly-seeded engineering space directly demos the editorial typography. Confirm."
  ambiguities:
    - "**Auth view theming scope.** `auth.jsx` ships a left-split editorial canvas (logo + serif italic wordmark + pull-quote + 'in this knowledge base' table-of-contents-mood block) + right form (SSO list, magic-link, sign-up tab). The pull-quote + ToC mood-block are pure decoration. Two paths: (a) ship the full auth.jsx anatomy verbatim — heaviest visual fidelity; (b) ship the right-form half token-themed (real product surface) + a simpler editorial canvas on the left for v1 (e.g., logo + wordmark + brand quote, no ToC mood-block). Recommend (b) for v1 — keeps the visual payoff per the design without authoring static decoration that adds little value. Confirm."
    - "**Sidebar partial — workspace switcher behavior.** Per minimal scope: workspace switcher card with current workspace's name + slug + chevron. Clicking the chevron should open a dropdown of the user's other workspaces (per `app.jsx` switcher pattern). Two paths: (a) ship a real switcher dropdown in this Turn (needs a Vue island + a service-layer call to list user's workspaces under withoutTenant — overlap with slice-002's pattern note); (b) ship a static workspace card with no dropdown for v1, link the chevron to a future workspace-list page. Recommend (b) — the switcher is a slice-006/admin-slice concern; v1 just needs the workspace name visible in the chrome. Confirm."
    - "**Spaces tree partial — collapsibility / pinned.** Per the design, the Spaces tree shows space → folder → doc with active highlighting. Folders are collapsible. For v1: ship space-level only (each space links to its read view), defer folder collapsibility + active-doc highlighting (the latter requires the current doc context which only the reader page has). Confirm."

  conflicts: (none)

  # If you authorize T1 to proceed with the recommendations above, the
  # Turn proceeds in this order:
  #   1. Markdown pipeline (config/markdown.ts) + Shiki theme + Mermaid wrapper
  #   2. Read route + read.strav + DocController.show
  #   3. shell.strav + partials/sidebar.strav + partials/topbar.strav
  #   4. Retroactive theming pass: AuthForm + WorkspaceForm + CreateSpaceWizard
  #      (re-author per design source) + .strav views adopt shell layout where
  #      appropriate (auth stays full-bleed)
  #   5. Update space_templates.ts seed bodies to markdown-shaped (per resolution above)
  #   6. BDD tests + round-trip-shape test
  #   7. Browser smoke-check
  # Halts at the smoke-check for human walk-through before close.
```

**Human resolution (2026-05-09 — Liva): defaults on all three.**

```yaml
ai_of_human (resolution):
  missing_preconditions:
    - "Seed bodies: update space_templates.ts to markdown-shaped (h1 + lede + code + callout). Small drift from Build-T0's 'placeholder bodies' resolution; demo flow becomes self-contained."
  ambiguities:
    - "Auth view: slim left canvas (logo + wordmark + brand quote) + token-themed right form. ToC mood-block deferred."
    - "Sidebar switcher: static card for v1 (no dropdown)."
    - "Spaces tree: space-level only; no folder collapsibility or active-doc highlighting (baked-in default)."

decision (Build-T1): advance.
```

*(Build-T1 work begins. Records below land as artifacts ship; the Turn halts at the browser smoke-check before close.)*

**work — first pass (markdown pipeline + read path + shell + page primitives)**

1. **`config/markdown.ts`** — markdown-it instance with `markdown-it-anchor`, `markdown-it-footnote`, `markdown-it-attrs` (with `{` `}` delimiters so `{ .callout }` blocks work), `markdown-it-task-lists`. Custom `paragraph_open` rule tags the first paragraph after `<h1>` with `class="lede"`. Pre-pass extracts ` ```mermaid ` and ` ```<lang> ` fenced blocks via regex (markdown-it's render is sync but Shiki + Mermaid are async); placeholders are spliced back after render. Output wrapped in `<div class="read">` so `.read*` editorial typography applies.

2. **`app/services/reader/mermaid_renderer.ts`** — Mermaid → SVG via `mmdc` subprocess. SHA-256-keyed in-process LRU cache (200 entries). Falls back to a styled `<pre>` placeholder if `mmdc` is unavailable.

3. **`app/http/controllers/doc_controller.ts`** — `DocController.show(ctx)` resolves space-by-slug under tenant context, joins to `revision` via `current_revision_id` (per ADR-0007), renders markdown, fetches `sidebarSpaces` for the chrome.

4. **`resources/views/docs/read.strav`** — extends `layouts/shell`; fills `shell-content` with `.reader-page` wrapper containing `.doc-eyebrow` + the rendered `<div class="read">{!! html !!}</div>`.

5. **`resources/views/layouts/shell.strav`** — extends `layouts/app`. Defines `.app` grid (sidebar + main column with topbar + scrollable content). Includes `partials/sidebar` and `partials/topbar`. Verified Strav supports nested layouts via `MAX_INCLUDE_DEPTH`.

6. **`resources/views/partials/sidebar.strav`** + **`partials/topbar.strav`** — workspace switcher card (static), Spaces tree (space-level only), user footer; breadcrumbs only.

7. **`resources/css/_shell.scss`** — `.app` grid + sidebar + topbar + `.reader-page` + page primitives (`.page-container`, `.page-title`, `.page-deck`, `.page-meta`, `.page-section`, `.page-list`, `.list-row`, `.link-accent`) + `.slo-table`. Single-column reader (3-column grid deferred). Imported via `app.scss` `@use 'shell'`.

8. **`tenant_context` middleware** — also sets `ctx.membershipRole` as a sibling key.

9. **Slice 002 controllers extended** to pass `{ user, workspace, membershipRole, sidebarSpaces, ... }` to their views.

10. **`workspaces/show.strav`** + **`spaces/show.strav`** + **`spaces/new.strav`** switched to `@layout('layouts/shell')`. **`workspaces/new.strav`** stays full-bleed (`layouts/app`) wrapped in `.page-bleed > .page-container.narrow`.

11. **`space_templates.ts` engineering bodies upgraded** from one-line placeholders to markdown-shaped (h1 + lede + h2 + code-fence + callout-syntax + lists). Engineering's seeded space directly demos the editorial typography.

**Deferred within T1 (queued behind smoke-check):**

- **Vue island retheme** (AuthForm / WorkspaceForm / CreateSpaceWizard `<style module>` → design classes).
- **BDD tests + round-trip-shape test** for the read path.
- **3-column reader grid** with `.toc` + `.margin-note`.

**outputs (first pass)**

```yaml
- config/markdown.ts                                              new
- app/services/reader/mermaid_renderer.ts                         new
- app/services/shell/shell_data.ts                                new
- app/http/controllers/doc_controller.ts                          new
- app/http/middleware/tenant_context.ts                           edited       — sets ctx.membershipRole sibling key
- app/http/controllers/workspace_controller.ts                    edited       — show() passes sidebarSpaces
- app/http/controllers/space_controller.ts                        edited       — show() + newForm() pass shell data
- resources/views/layouts/shell.strav                             new          — extends layouts/app
- resources/views/partials/sidebar.strav                          new
- resources/views/partials/topbar.strav                           new
- resources/views/docs/read.strav                                 new
- resources/views/workspaces/show.strav                           edited       — switched to layouts/shell
- resources/views/workspaces/new.strav                            edited       — full-bleed centered card
- resources/views/spaces/show.strav                               edited       — switched to layouts/shell
- resources/views/spaces/new.strav                                edited       — switched to layouts/shell
- resources/css/_shell.scss                                       new          — .app + sidebar + topbar + reader-page + page primitives
- resources/css/app.scss                                          edited       — added @use 'shell'
- routes/workspaces.ts                                            edited       — added GET /workspaces/:slug/spaces/:space_slug/d/:doc_slug
- app/services/spaces/space_templates.ts                          edited       — engineering template seed bodies markdown-shaped
```

**postconditions — first pass (smoke-check pending)**

```yaml
postconditions:
  - [x] `bun run typecheck` exits 0 for project-local sources.
  - [x] `bun test` exits 0 globally — 19 pass / 1 skip / 0 fail / 147 expect() calls.
  - [x] `bun run dev` builds CSS to `public/css/app.css` at ~21KB; islands still build clean.
  - [x] All routes still respond: /auth 200, / 302, /workspaces/new 401 no-cookie, /workspaces/x 401 no-cookie.
  - [ ] **Smoke-check (browser):** human walks the slice-001 → slice-002 → slice-003 flow and confirms shell renders, seeded engineering doc renders with editorial typography (Newsreader, drop cap, Shiki code, callout), breadcrumbs reflect navigation. **First-pass close gate.**
```

*(Halting first pass for the human smoke-check. Retroactive Vue-island theming + BDD tests + 3-column reader-grid are queued as the follow-up Micro-Turn(s) inside T1 once smoke-check passes.)*

**work — Micro-Turn (smoke-check automation, 2026-05-10)**

When the human went to walk the smoke-check, the same regression pattern that drove `docs/notes/agon-vertical-slicing-enforcement.md` resurfaced: the manual flow takes ~3 minutes per re-walk, gets boring on the 5th repeat, and a 200-instead-of-302 redirect is exactly the class of bug the human eye skips past. The framework note proposing an automated primitive (`docs/notes/strav-testing-browser-smoke-check.md`) was authored, fed back to the AGON method (commit `61c5c43` in the method repo), and `@strav/testing` shipped `BrowserTestCase` + `DemoFlow` upstream the same day.

This Micro-Turn wires the new framework primitive into musagete:

1. **`tests/utils/musagete_demo_flow.ts`** — project-local wrapper around `BrowserTestCase`. Reimplements the magic-link → cookie inject dance using `SESSION_COOKIE_NAME` (musagete owns `musagete_session`, distinct from the framework default `strav_session` so OAuth state and our session don't collide). Boots with `auth: false` (we don't use Strav's `Auth`/`SessionManager`), registers musagete's `MailProvider` + `ViewProvider`, and sets `__islandsSrc` to `/builds/islands.js` so server-rendered island markers find the pre-built bundle without running `IslandBuilder` at test time. Two upstream gaps surfaced and noted: `signInWithMagicLink` hardcodes `strav_session` (`docs/notes/strav-testing-app-cookie-name.md`), and `@show('a-b')` codegen breaks on hyphens (`docs/notes/strav-view-show-hyphen-codegen.md`).
2. **`tests/spaces/slice-003-demo.flow.ts`** — full slice-001 + slice-002 + slice-003 walk: magic-link sign-in via captured mail → `/workspaces/new` form → POST → `/workspaces/acme-cloud` → `/spaces/new` wizard (4 steps) → `/spaces/platform` → click "Welcome to Runbooks" → assert URL ends `/d/welcome-runbook`, h1 font-family contains `Newsreader`, `.lede::first-letter` font-size > 40px. 60s test timeout (Chromium cold launch + fresh DB rebuild + redirect chain). Runs in ~2.5s once warm.
3. **`start/view_globals.ts`** — extracted the index.ts `onBooted` setGlobal block so the test bootstrap installs the same view defaults without the production listener + island-builder watch loop.
4. **Two real defects caught on first green run.** (a) `read.strav` wrapped its `<article>` in `class="reader-page"` while `_typography.scss` targets `.read` — CSS rules silently didn't apply to seeded docs in the manual smoke-check (the human read the markdown but not the editorial typography). Fix: `class="read reader-page"`. (b) `shell.strav` used `@show('shell-content')` and the `@strav/view` compiler injects section names as raw JS identifiers; the hyphen broke parsing (`typeof shell-content` → `typeof shell - content` → `ReferenceError: content is not defined`). Fix: rename section to `shell_content` across `layouts/shell.strav` + the four child views (`workspaces/show.strav`, `spaces/show.strav`, `spaces/new.strav`, `docs/read.strav`). The flow file caught this instantly with a 500 response on `/workspaces/<slug>` — exactly the behavioral regression the manual smoke-check would have shipped past, since the workspace landing isn't typography-loud.
5. **Adapter and slice DoD updated.** `docs/specs/adapters/strav.md` gained §4b "Smoke-check automation" naming `BrowserTestCase`/`DemoFlow`/`MusageteDemoFlow` and the visual-vs-behavioral split the AGON method now mandates. The slice 003 DoD smoke-check line replaced the prose checklist with two lines: automated (the flow file exits 0) + visual (human review).
6. **Framework-issue note retired.** `docs/notes/strav-testing-browser-smoke-check.md` deleted — upstream landed the proposal verbatim. Mirrors the slice-001 / slice-002 framework-note removal pattern.

**work — scope-split (Tech Spec amendment, 2026-05-10)**

The deferred-within-T1 items — Vue island retheme to the design source (AuthForm/WorkspaceForm/CreateSpaceWizard), BDD scenario tests + round-trip-shape test, 3-column reader grid (`.toc` + `.margin-note`) — close T1 by being scope-split out of slice 003 into a new backlog row, not by being completed inside this Turn.

The slice 003 DoD's primary acceptance (Scenario 1 — signed-in user opens a doc and sees editorial typography) is met by the automated flow file's behavioral assertions plus the human visual review at Integrate. Scenarios 2–5 (theme/density/accent persistence, Mermaid SVG, Shiki tokens) assert invariants the read path already carries; their formal BDD-test coverage is independent of the slice's vertical-slicing demonstrability claim. The Vue island retheme is genuinely larger than a Micro-Turn (auth.jsx is a multi-section editorial canvas; spaces.jsx is a redesigned 4-step modal) — it's slice-shaped, not refinement-shaped. The 3-column reader grid is a composability feature whose acceptance is "marginalia visible at ≥1100px width" — also slice-shaped given it ships its own `.toc` + `.margin-note` rendering rules.

The receiving backlog row is **slice 008 — Reader polish + island retheme**, depending on slice 003. Per `templates/tech-spec.md` § Post-signature changes — scope-split, the amendment is recorded with From / To / Why + Downstream impact + Defers observable surface? fields. Recorded next.

**outputs (Micro-Turn + scope-split)**

```yaml
- tests/utils/musagete_demo_flow.ts                              new          — BrowserTestCase wrapper handling musagete_session cookie + view-globals + MailProvider boot
- tests/spaces/slice-003-demo.flow.ts                             new          — automated end-to-end smoke-check (sign-in → workspace → wizard → reader, with computed-style assertions)
- start/view_globals.ts                                          new          — extracted setupViewGlobals() so test bootstrap reuses index.ts's onBooted defaults
- index.ts                                                        edited       — onBooted now calls setupViewGlobals() instead of inlining setGlobal calls
- resources/views/layouts/shell.strav                             edited       — @show('shell-content') → @show('shell_content') (hyphen breaks @strav/view codegen)
- resources/views/workspaces/show.strav                           edited       — @section('shell-content') → @section('shell_content')
- resources/views/spaces/show.strav                               edited       — @section('shell-content') → @section('shell_content')
- resources/views/spaces/new.strav                                edited       — @section('shell-content') → @section('shell_content')
- resources/views/docs/read.strav                                 edited       — class="reader-page" → class="read reader-page" + @section rename; .read typography rules now apply
- docs/specs/adapters/strav.md                                    edited       — new §4b Smoke-check automation; amendment-log entry
- docs/specs/slices/003-reader-editorial-layout.md                edited       — DoD smoke-check line split into automated (behavioral) + visual (human)
- docs/specs/slices/003-reader-editorial-layout.tech.md           edited       — scope-split amendment (deferred items punted to slice 008)
- docs/notes/strav-testing-browser-smoke-check.md                 deleted      — upstream landed; @strav/testing now ships BrowserTestCase + DemoFlow
- docs/notes/strav-testing-app-cookie-name.md                     new          — follow-up for hardcoded strav_session cookie picker
- docs/notes/strav-view-show-hyphen-codegen.md                    new          — follow-up for @show codegen breaking on hyphenated section names
- bun.lock + package.json                                         edited       — bun add -D playwright-core (Chromium binary cached at ~/Library/Caches/ms-playwright)
- database/migrations/{1778343040543 → 1778385599645}              renamed      — `bun strav fresh` regenerated migration timestamp; schema content identical
```

**postconditions — Build-T1 close**

```yaml
postconditions:
  # Foundation (T0) — already ticked above.
  # Reader (T1):
  - [x] resources/views/docs/read.strav renders the seeded "Welcome to Runbooks" doc end-to-end with zero Vue islands; verified by tests/spaces/slice-003-demo.flow.ts.
  - [x] GET /workspaces/:slug/spaces/:space_slug/d/:doc_slug responds 200 under currentUser + tenantContext + spacePolicy.canViewSpace; verified by the flow file.
  - [x] markdown-it pipeline (footnote / anchor / attrs / task-lists), Shiki, Mermaid all wired at boot; .lede class on first paragraph after <h1>; ` ```mermaid ` → server-side <svg>; ` ```<lang> ` → Shiki .tok-* tokens.
  - [x] markdown-it-anchor populates heading IDs (used by the deferred TOC; rule survives the scope-split because the IDs are emitted regardless).
  - [x] Theme/density/accent default cookies wired; layout reads data-* attributes and inline --accent.

  # App shell (T1, minimal):
  - [x] Sidebar partial: workspace switcher card + space-level Spaces tree + user footer.
  - [x] Topbar partial: breadcrumbs only.
  - [x] Auth view stays full-bleed; workspace forms / space view / wizard / reader inhabit the shell.

  # Retroactive theming pass — SCOPE-SPLIT to slice 008 per the Tech Spec amendment recorded next:
  - [N/A] AuthForm.vue / WorkspaceForm.vue / CreateSpaceWizard.vue retheme to design source — slice 008.
  - [N/A] auth/sign_in.strav full-bleed split + workspaces/{new,show}.strav + spaces/{new,show}.strav shell wrap — partially done (shell wrap landed in T1 first pass); design-faithful split-canvas auth shipping in slice 008.

  # Quality gates:
  - [N/A] BDD scenarios 1–5 unit-test coverage — scope-split to slice 008. Scenario 1 is covered behaviorally by the flow file (the slice's primary acceptance); Scenarios 2–5 are invariants the read path carries that get formal tests in 008.
  - [N/A] Round-trip-shape test (markdown fixture → rendered HTML → assert .lede / .diagram / .codeblock / .tok-*) — scope-split to slice 008.
  - [x] **Smoke-check (automated, behavioral):** `bun test ./tests/spaces/slice-003-demo.flow.ts` exits 0 (1 pass / 0 fail / ~2.5s warm). Asserts URL transitions, redirect chains, computed font-family contains "Newsreader" on h1, computed `.lede::first-letter` font-size > 40px.
  - [ ] **Smoke-check (visual, human):** human-walked review of typography fidelity (drop-cap weight + accent color), Shiki theme propagation, Mermaid SVG render (vs `<pre>` fallback), dark-mode swap. Recorded in this slice's Integrate-T1 entry's Smoke-check (visual) subsection.
  - [x] Full test suite (`bun test`) passes — 19 pass / 1 skip / 0 fail / 147 expect() calls (the flow file is invoked separately by path; bun:test discovery only matches `*.test.ts` / `*.spec.ts`).
  - [x] No source-code changes in slice 001 / slice 002 surfaces beyond the .strav section-name rename driven by the framework codegen bug.
```

**decision (Build-T1):** `advance` — Liva, 2026-05-10. The Build-T1 record closes here; Integrate-T1 opens.

---

### `Integrate-T1` — Tech Spec amendment (scope-split), log entry, backlog update, slice file flip

```yaml
id:             Integrate-T1
phase:          Integrate
intent:         Close slice 003 by recording the scope-split amendment in the Tech Spec (deferred items punted to a new slice 008), authoring the integrate-phase log entry per slice 002's shape, updating 20-backlog.md (row 3 drafted → shipped + new row 8 for the scope-split target), and flipping the slice file (status: built → shipped, owner_turn: Build-T1 → Integrate-T1).
owner:          ai
inputs:
  - ./003-reader-editorial-layout.md            (slice — status: built as of T1 close 2026-05-10)
  - ./003-reader-editorial-layout.tech.md       (Tech Spec — Signed; amended once at T0 close; about to gain a second amendment)
  - ./003-reader-editorial-layout.turns.md      (Build-T0 + Build-T1 + Build-T1 close)
  - ../30-log.md § Slice 002                     (template for the Integrate entry shape)
  - ../20-backlog.md                             (row 3 to update + new row 8)
  - ../../method/templates/tech-spec.md § Post-signature changes — Scope-split  (amendment shape)

preconditions:
  - Build-T1 closed `advance`.
  - The flow file's first green run is the behavioral acceptance of Scenario 1 (the slice's primary acceptance per AGON's user-flow-scenario rule).
  - The deferred items have an explicit receiving slice in the backlog so cumulative demonstrability is preserved (slice 8 ships the formal BDD coverage + reader polish; slice 4's editor depends on slice 3's read path which is shipped here).
```

**work**

1. **Recorded the scope-split amendment** in `003-reader-editorial-layout.tech.md`'s Amendment log. Per `templates/tech-spec.md` § Post-signature changes, the entry uses the Scope-split shape (Changed / From / To / Why / Downstream impact / Defers observable surface? / By). The deferred items move to slice 008 with explicit demo flow.
2. **Wrote the slice 003 entry in `docs/specs/30-log.md`** mirroring slice 002's shape: header (Built in / Shipped / Commit / Turn chain), What was built, Acceptance criteria → verification (Scenario 1 covered by the flow file, Scenarios 2–5 punted to slice 008), the new Smoke-check subsection (automated path + visual path with the human's checklist), What surprised us (smoke-check automation landed mid-slice; two real defects caught by the flow file's first run), framework-DSL learnings (the `@show` hyphen footgun, the cookie-name hardcoding), Harness signals, Follow-ups, Signed.
3. **Updated `docs/specs/20-backlog.md`** — row 3 status `drafted` → `shipped`; notes column references the log entry. Added row 8 for the scope-split target. Re-ordering history gained a 2026-05-10 entry naming the scope-split + the smoke-check automation milestone.
4. **Flipped the slice file** — `status: built → shipped`, `owner_turn: Build-T1 → Integrate-T1`. Filled the Built / Shipped status block.

**outputs**

```yaml
- docs/specs/slices/003-reader-editorial-layout.tech.md           edited       — Amendment log gained the scope-split entry (deferred items → slice 008)
- docs/specs/30-log.md                                            edited       — appended slice 003 Integrate-T1 entry mirroring slice 002's shape, with new Smoke-check subsection
- docs/specs/20-backlog.md                                         edited       — row 3 drafted → shipped; new row 8 for scope-split target; re-ordering history entry
- docs/specs/slices/003-reader-editorial-layout.md                edited       — status: shipped, owner_turn: Integrate-T1; Built/Shipped status filled
- docs/specs/slices/003-reader-editorial-layout.turns.md          edited       — last_turn: Integrate-T1; this Integrate-T1 record appended
```

**postconditions**

```yaml
postconditions:
  - [x] `docs/specs/30-log.md` has a slice 003 entry; entry is structurally consistent with slice 002's shape (same section headers + new Smoke-check subsection per the AGON method update).
  - [x] `docs/specs/20-backlog.md` row 3 status is `shipped`; row 8 lists the scope-split items with explicit demo flow; re-ordering history records the date.
  - [x] Slice file header reads `status: shipped, owner_turn: Integrate-T1`; Built / Shipped status block filled with commit SHAs.
  - [x] Tech Spec amendment log shows the scope-split entry with all six fields.
  - [x] Turns file header `last_turn` reads `Integrate-T1`.
  - [x] No source-code changes in this Turn (Integrate is spec + log work only).
  - [x] `bun test` still passes (19 pass / 1 skip / 0 fail). The flow file (`bun test ./tests/spaces/slice-003-demo.flow.ts`) still exits 0.
```

**Smoke-check (visual, human review)**

To be recorded here by Liva as the visual half of the smoke-check. Default checklist:

- [ ] Newsreader serif on `<h1>`/`<h2>` reads editorial; weight + opsz axis matches the design handoff.
- [ ] `.lede::first-letter` drop cap renders in accent color (terracotta `#B8442C`); float-left + line-height harmony with the lede paragraph.
- [ ] Code blocks render with Shiki `.tok-*` token classes mapped to design accents (light + dark themes).
- [ ] Mermaid fenced blocks render as inline `<svg>`, not the `<pre>` fallback.
- [ ] Sidebar Spaces tree + workspace switcher card readable; user footer shows the email.
- [ ] Breadcrumbs reflect the workspace → space → doc path.
- [ ] (If a `musagete_theme=dark` cookie is set) `<html data-theme="dark">` attaches; paper goes near-black, ink goes warm-cream.

**Signed**

- Integrate-T1 closed by: <to be signed by Liva>

*(Slice 003 shipped. Next-up per `20-backlog.md`: slice 004 — Editor (TipTap + AI authoring slash commands), depending on the read path shipped here. Slice 008 — Reader polish + island retheme — sits at the end of the backlog and gets sequenced by Planning when its dependencies (current slice 003) and prerequisites (design source under `documents/musagete/`) are both stable.)*