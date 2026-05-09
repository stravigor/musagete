```yaml
slice_id:        003
status:          ready
owner_turn:      Build-T0
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

- [ ] `resources/css/tokens.css` ships the §6 token set verbatim from the design handoff (`/Users/liva/Projects/Strav.dev/documents/musagete/design_handoff_musagete_kb/source/styles.css` lines 7–55): 14 paper/ink colors + dark theme overrides + 4 density tokens + density-compact overrides + layout vars + radii.
- [ ] Newsreader (with `opsz` axis), DM Sans, JetBrains Mono fonts loaded per handoff §6.4 (Google Fonts URL or self-hosted with `font-display: swap`).
- [ ] `resources/css/reset.css` ships the base reset (handoff `styles.css` lines 84–128: box-sizing, html/body bg/color/font, scrollbars, ::selection, button/input inheritance).
- [ ] `resources/css/app.css` ships the global stylesheet that imports tokens + reset + the editorial reading typography (`.read*`), code blocks (`.codeblock` + `.tok-*`), callouts, buttons + chips primitives. Pattern: one stylesheet per layer; not CSS-in-JS, not inline.
- [ ] `resources/views/layouts/shell.strav` ships the signed-in shell layout: `<html>` carries `data-theme` / `data-density` / `data-display` and inline `--accent` from cookies; loads `app.css`; defines `@show('sidebar')` and `@show('content')` slots.

**Reader (Build-T1):**

- [ ] `resources/views/docs/read.strav` renders a published doc end-to-end with **zero Vue islands on the read path** (the optional Topbar island is the only allowed island; default is no JS).
- [ ] URL: `GET /workspaces/:slug/spaces/:space_slug/d/:doc_slug` per Tech Spec § Interface contract. Mounted under `currentUser` + `tenantContext` + `authorize(spacePolicy, 'canViewSpace')`.
- [ ] **Markdown pipeline**: `markdown-it` configured at app boot (`config/markdown.ts`) with `markdown-it-footnote`, `markdown-it-anchor`, `markdown-it-attrs`, `markdown-it-task-lists`. Custom rules: `.lede` class on first paragraph after `<h1>`; ` ```mermaid ` fence → server-side Mermaid render → inline `<svg>` inside `.diagram`; ` ```<lang> ` fence → Shiki with the design's `.tok-*` classes inside `.codeblock`.
- [ ] **Mermaid server-rendering** at template time (per Tech Spec § Data model: precompute deferred to slice 004's save handler).
- [ ] **Shiki syntax highlighting** at template time, with a custom Shiki theme that maps tokens to the design's `--accent` / `--ok` / `--ink-3` / etc. so theme switching propagates.
- [ ] Right-margin `.toc` populated from heading IDs (via `markdown-it-anchor`); collapses below 1100px per the design's responsive rule.
- [ ] Theme/density/accent preferences are read from cookies set by the (deferred) Topbar island; for v1, defaults if cookies absent.

**App shell (Build-T1, minimal scope per Liva 2026-05-09):**

- [ ] `resources/views/partials/sidebar.strav` ships a minimal sidebar: workspace switcher card (`.ws-switch`), Spaces tree (current workspace's spaces, with a `+` link to `/workspaces/:slug/spaces/new`), user footer (`.sb-foot`). NOT included: ⌘K stub (slice 005), cross-doc nav (deferred to v2 admin), Pinned section.
- [ ] `resources/views/partials/topbar.strav` ships breadcrumbs only. View tabs / Find / Ask / Share — deferred to slices 004/005/006.
- [ ] Auth view stays full-bleed (does NOT use the shell); workspace forms + space read view + wizard mount inside the shell.

**Retroactive theming pass (Build-T1, slice-002 inheritance):**

- [ ] `resources/islands/AuthForm.vue` re-authored per design `auth.jsx` + `screens.css` `.auth-*` (split layout, SSO list, magic-link sent state, sign-in tabs). Drops `<style module>` block; uses tokens + classes from the global stylesheet.
- [ ] `resources/islands/WorkspaceForm.vue` re-themed: drops `<style module>`; uses `.field` + `.btn--primary` per `styles.css`.
- [ ] `resources/islands/CreateSpaceWizard.vue` re-authored per design `spaces.jsx` + `screens.css` `.modal-*` / `.tpl-*` / `.steps` / `.radio-card` / `.invite-*` (4-step wizard with template cards, identity step, access step, members step).
- [ ] `resources/views/auth/sign_in.strav` adopts full-bleed split (no shell); `resources/views/workspaces/{new,show}.strav` and `resources/views/spaces/{new,show}.strav` wrap in the shell layout.

**Quality gates:**

- [ ] BDD scenarios all green, including the user-flow Scenario 1 asserted via either Playwright or a no-JS HTML fixture test.
- [ ] Round-trip-shape test: a fixture markdown file → rendered HTML → assert specific class-attribute pairs (`.lede` on first p after h1; mermaid block becomes `<div class="diagram"><svg>`; code block has `.codeblock` + `.tok-*` tokens).
- [ ] **Smoke-check (browser):** a human runs `bun run dev`, signs in, walks the slice-001 + slice-002 + slice-003 flow:
  1. `/auth` → sign in → `/`
  2. `/workspaces/acme` → workspace landing in the shell
  3. `/workspaces/acme/spaces/new` → wizard with the design's modal/template-card layout
  4. `/workspaces/acme/spaces/platform` → space read view in the shell
  5. Click a seeded doc → `/workspaces/acme/spaces/platform/d/welcome-runbook` → editorial typography (Newsreader, drop cap, marginalia, design colors)
  6. (If accent / theme cookies set) → confirm theme/density/accent visibly reflect

  Recorded under "Smoke-check" in this slice's Integrate-T1 entry per AGON.
