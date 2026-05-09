# Turn chain — slice `003-reader-editorial-layout`

```
slice_id:    003-reader-editorial-layout
started:     2026-05-09
last_turn:   Build-T0
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

*(Halting Build-T0 here. Awaiting human ack on the postconditions and a `decision: advance | redo`. Once T0 advances, Build-T1 resumes from this foundation: `read.strav` + markdown-it config + Shiki theme + Mermaid renderer + shell.strav + sidebar/topbar partials + retroactive theming pass on slice-002 islands.)*