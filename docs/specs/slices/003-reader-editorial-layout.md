```yaml
slice_id:        003
status:          shipped
owner_turn:      Integrate-T1
resource_type:
tenancy:         tenant
runtime:         web
strav_packages:  [@strav/view, @strav/http]
```

---

## Story

As a **reader (any role)**
I want to **open a doc and read it in an editorial, typography-forward layout that respects my theme, density, and accent preferences**
so that **the reading experience feels like a finished publication, not a wiki dump**.

---

## Context

Pixel-faithful render of the binding token set ([ADR-0003](../adr/0003-styling-tokens-css-modules.md)) into a `.strav` server-rendered template. Read paths must work with JavaScript disabled (`G2`); Vue islands hydrate **only** the optional Topbar interactions and a footnote-popover behavior. Drop cap, marginalia, code blocks, and Mermaid blocks all render server-side.

Links:

- Discovery — `G2`, `P6`.
- Design — `C2`, `R5`.
- Tech Spec: [`./003-reader-editorial-layout.tech.md`](./003-reader-editorial-layout.tech.md).
- ADRs: [ADR-0001](../adr/0001-architecture-strav-islands-over-spa.md), [ADR-0003](../adr/0003-styling-tokens-css-modules.md).
- Depends on: 002.

---

## BDD Scenarios

```gherkin
Scenario 1: User signs in, navigates to a seeded doc, sees editorial typography
  Given a signed-in user who has created the "acme" workspace with the "engineering" template space "platform"
  When the user clicks "Welcome to Runbooks" from the workspace landing
  Then the URL is "/workspaces/acme/spaces/platform/d/welcome-runbook"
    And the rendered page shows the doc title in Newsreader serif (computed font-family contains "Newsreader")
    And the first paragraph after <h1> renders with a drop cap (.lede::first-letter computed font-size > 3em, color matches --accent)
    And no Vue island other than the optional Topbar mounts on the read path
    And the page renders end-to-end with JavaScript disabled (response HTML alone contains title + body + byline + code-block markup)

Scenario 2: Theme switch persists across navigation
  Given a reader with "musagete_theme=dark" stored in cookie
  When the user opens any doc URL
  Then the rendered <html> carries data-theme="dark"
    And the page background uses the dark-mode --paper token (#14110E or its computed value)

Scenario 3: Density and accent persist
  Given a reader with "musagete_density=compact" and "musagete_accent=#5C4FB8" cookies (iris)
  When the user opens any doc URL
  Then the rendered <html> carries data-density="compact"
    And the inline style on <html> sets --accent: #5C4FB8 (with corresponding --accent-soft and --accent-soft-2 from the design's ACCENT_PRESETS map)

Scenario 4: Mermaid fenced block renders to inline SVG
  Given a doc whose markdown contains a ```mermaid``` fenced block
  When the doc is rendered
  Then the output replaces the fenced block with <div class="diagram"><svg>...</svg></div>
    And the SVG is server-rendered (no client-side mermaid.js mount on the read path)

Scenario 5: Code block renders with Shiki syntax tokens
  Given a doc whose markdown contains a ```typescript fenced block with `const x = 1;`
  When the doc is rendered
  Then the output contains <div class="codeblock"> with .codeblock-hd "typescript" header
    And the `const` keyword carries class .tok-key, the `1` carries .tok-num, etc. (Shiki theme maps to design's --accent / --ok / etc.)
```

---

## Definition of Done

**Foundation (Build-T0):**

- [x] `resources/css/tokens.css` ships the §6 token set verbatim from the design handoff (`/Users/liva/Projects/Strav.dev/documents/musagete/design_handoff_musagete_kb/source/styles.css` lines 7–55): 14 paper/ink colors + dark theme overrides + 4 density tokens + density-compact overrides + layout vars + radii. (Implemented as `_tokens.scss` partial under `@layer tokens`, imported via `app.scss`.)
- [x] Newsreader (with `opsz` axis), DM Sans, JetBrains Mono fonts loaded per handoff §6.4 (Google Fonts URL with `font-display: swap`).
- [x] `resources/css/reset.css` ships the base reset (handoff `styles.css` lines 84–128). Implemented as `_reset.scss`.
- [x] `resources/css/app.css` ships the global stylesheet importing tokens + reset + editorial reading typography (`.read*`), code blocks (`.codeblock` + `.tok-*`), callouts, buttons + chips primitives. Sass partials, one stylesheet per layer; not CSS-in-JS.
- [x] `resources/views/layouts/shell.strav` ships the signed-in shell layout: `<html>` carries `data-theme` / `data-density` / `data-display` and inline `--accent`; loads `app.css`; defines `@show('shell_content')` slot. (Underscore not hyphen; `@strav/view`'s `@show` codegen breaks on hyphens — `docs/notes/strav-view-show-hyphen-codegen.md`.)

**Reader (Build-T1):**

- [x] `resources/views/docs/read.strav` renders a published doc end-to-end; the read path mounts no Vue islands by default (the optional Topbar island is deferred to a future slice).
- [x] URL: `GET /workspaces/:slug/spaces/:space_slug/d/:doc_slug` mounted under `currentUser` + `tenantContext` + `authorize(spacePolicy, 'canViewSpace')`.
- [x] **Markdown pipeline**: `markdown-it` configured at app boot (`config/markdown.ts`) with `markdown-it-footnote`, `markdown-it-anchor`, `markdown-it-attrs`, `markdown-it-task-lists`. Custom rules: `.lede` class on first paragraph after `<h1>`; ` ```mermaid ` fence → server-side Mermaid render → inline `<svg>` inside `.diagram`; ` ```<lang> ` fence → Shiki with the design's `.tok-*` classes inside `.codeblock`.
- [x] **Mermaid server-rendering** at template time via `mmdc` subprocess + SHA-256-keyed in-process LRU cache.
- [x] **Shiki syntax highlighting** at template time with a `cssVariables` theme so token colors propagate via `[data-theme]` switching.
- [x] Heading IDs emitted via `markdown-it-anchor` (default github-slugger). The right-margin `.toc` rendering rule is scope-split to slice 008 — IDs are present so 008's TOC can target them without re-renders.
- [x] Theme/density/accent preferences are read from cookies; for v1, `ViewEngine.setGlobal()` defaults applied at boot if cookies absent.

**App shell (Build-T1, minimal scope per Liva 2026-05-09):**

- [x] `resources/views/partials/sidebar.strav` ships a minimal sidebar: workspace switcher card, Spaces tree (space-level), user footer.
- [x] `resources/views/partials/topbar.strav` ships breadcrumbs only.
- [x] Auth view stays full-bleed; workspace forms + space view + wizard mount inside the shell.

**Retroactive theming pass (Build-T1, slice-002 inheritance):** **scope-split to slice 008** per Tech Spec amendment of 2026-05-10 — see `003-reader-editorial-layout.tech.md` § Amendment log.

- [~] `resources/islands/AuthForm.vue` retheme — slice 008.
- [~] `resources/islands/WorkspaceForm.vue` retheme — slice 008.
- [~] `resources/islands/CreateSpaceWizard.vue` retheme — slice 008.
- [x] `resources/views/auth/sign_in.strav` stays full-bleed; `resources/views/workspaces/{new,show}.strav` and `resources/views/spaces/{new,show}.strav` wrap in the shell layout (the design-faithful split-canvas auth ships in slice 008).

**Quality gates:**

- [~] Formal BDD scenario unit-tests for Scenarios 1–5 — scope-split to slice 008. Scenario 1's behavioral acceptance is covered by the smoke-check flow file (the slice's primary acceptance per AGON's user-flow-scenario rule).
- [~] Round-trip-shape test (markdown fixture → rendered HTML → assert class-attribute pairs) — scope-split to slice 008.
- [x] **Smoke-check — automated (behavioral):** `bun test ./tests/spaces/slice-003-demo.flow.ts` exits 0. The flow signs in via captured magic-link mail, creates the `acme-cloud` workspace, walks the wizard to create a `platform` engineering space, opens the seeded `Welcome to Runbooks` doc, and asserts editorial typography (Newsreader serif on `<h1>`, drop-cap font-size > 40px on `.lede::first-letter`). URL transitions and redirect chains are part of the flow's assertions.
- [x] **Smoke-check — visual (human):** the visual checklist (drop-cap weight, Mermaid SVG vs `<pre>` fallback, Shiki tokens, dark-mode swap) recorded under "Smoke-check (visual)" in this slice's Integrate-T1 entry per AGON's visual / behavioral split (see `method/05-ceremonies.md` § What may not be deferred).
