```
slice_id:      003-reader-editorial-layout
status:        Signed
date:          2026-05-09
signed by:     Liva
references:
  slice:       ./003-reader-editorial-layout.md
  design:      ../10-design.md
  design_handoff: /Users/liva/Projects/Strav.dev/documents/musagete/design_handoff_musagete_kb/  (out-of-repo; binding §6 token set + reader anatomy from `source/reader.jsx` + `source/styles.css` + `source/chrome.css`)
  adrs:
    - ../adr/0001-architecture-strav-islands-over-spa.md
    - ../adr/0003-styling-tokens-css-modules.md
  adapter:     ../adapters/strav.md
```

---

## Interface contract

- `GET /workspaces/:slug/spaces/:space_slug/d/:doc_slug` — returns the read view for the most recently published revision of the doc. Mounted under the `tenantContext` middleware; `canViewSpace` policy (≥ reader role).
- *Errors:* 404 if workspace / space / doc / current-revision not found or RLS-denied; 403 if role insufficient.

## Data model

No new tables. Reads from `doc`, `revision`, `space`. ADR-0007's `revision.html_cache` denormalization is **deferred to slice 004** — slice 004 owns save and is the natural home for the precompute. Slice 003 renders markdown → HTML at template time (one-shot per request); precompute swaps in transparently when slice 004 ships.

## Policy & invariants

- **Authz:** workspace member with role ≥ `reader`. (Public-space sharing is a v1 non-goal per Discovery; for v1 every space's read path requires membership.)
- **Validation:** slug shape `[a-z0-9](-[a-z0-9]+)*` for both `:space_slug` and `:doc_slug`.
- **Domain:** the served revision is always `doc.current_revision_id`; never a draft.
- **Boundary:** `tenantContext` middleware (slice 002) handles the workspace-id binding; the doc + revision SELECTs run under the tenant's `app.tenant_id`.
- **Cross-cutting:** no Vue island is mounted on the read path by default. The optional Topbar island (theme/density/accent toggles, opt-in via `data-want-topbar="true"` on `<body>` or a future user-preference) is the only island slice 003 may mount; the read content itself is fully server-rendered.

## NFR targets

- Cold paint p50 < 100ms server-rendered (excludes the network leg + font-load FOFT — the Newsreader serif loads via `font-display: swap`, so first paint is sans, then the type swaps).
- HTML size p95 < 80 KB for typical docs (≤ 5000 words excluding code blocks).

## Dependencies

- Upstream: 002 (tenant tables + tenantContext middleware + `canViewSpace` policy).
- Framework: `@strav/view` (templates), `@strav/http` (routes).
- Third-party (pinned at signing — Liva 2026-05-09):
  - **`markdown-it`** for markdown → HTML at template time. Plugins: `markdown-it-footnote`, `markdown-it-anchor` (heading IDs for the TOC), `markdown-it-attrs` (class hooks for `.callout`/`.lede`), `markdown-it-task-lists`. Custom rule: detect ` ```mermaid ` fenced blocks and pass through to the Mermaid renderer below.
  - **`@mermaid-js/mermaid-cli`** (or equivalent headless renderer) for server-side Mermaid → SVG at template time. SVG output is inlined into the doc body per the design's `.diagram` block.
  - **`shiki`** for code-block syntax highlighting at template time. Shiki's precompiled grammars + the design's `.tok-*` classes connect via Shiki's `cssVariables` theme — write a small Shiki theme that maps to `var(--accent)` / `var(--ok)` / etc. so theme switching (`[data-theme="dark"]`) propagates.
- Fonts: Newsreader serif (with `opsz` axis, `:ital,wght`), DM Sans, JetBrains Mono via Google Fonts CSS or self-hosted (handoff §6.4 specifies the URL). Self-host or link with `font-display: swap`.

## App shell (minimal — Liva 2026-05-09)

A minimal app shell ships with slice 003 to give the reader (and the slice 002 surfaces) a home. **Minimal scope** (full sidebar/topbar deferred to a future admin slice):

- `resources/views/layouts/shell.strav` — extends nothing; root layout for any signed-in page. Sets `<html data-theme="..." data-density="..." data-display="..." style="--accent:...">` from cookies; loads `tokens.css`, fonts, `app.css`. Two slots: `@show('sidebar')` and `@show('content')`.
- **Sidebar** (`<aside class="sidebar">` per `chrome.css`): workspace switcher card (`.ws-switch`), Spaces tree (per the current workspace's spaces, with `+` to launch the wizard), user footer (`.sb-foot`). NOT included in this slice: `.sb-search` ⌘K stub (slice 005), `.sb-nav` cross-doc navigation (All Docs / Recent / Inbox / Review Queue / People & Access / Community — deferred to a v2 admin slice), Pinned section.
- **Topbar** (`<header class="topbar">`): breadcrumbs only. View tabs (Read/Edit/History/Review), Find (⌘K), Ask, avatar stack, Share — all deferred to slices 004, 005, 006 as their respective surfaces ship.

The auth view does NOT use the shell — it stays full-bleed per the design's auth split (`.auth-shell` from `screens.css`).

## Retroactive theming pass (Build-T2 inheritance — Liva 2026-05-09)

Slice 002's Build-T2 shipped four UI surfaces with ad-hoc `<style module>` CSS to close the demonstrability gap. Slice 003 retroactively themes them via tokens:

- `resources/islands/AuthForm.vue` → re-author per design `auth.jsx` + `screens.css` `.auth-*` (sign-in form anatomy, SSO list, magic-link sent state). Drops the `<style module>` block; uses tokens + classes from the global stylesheet.
- `resources/islands/WorkspaceForm.vue` → token-driven via `.field`/`.btn--primary` per `styles.css`.
- `resources/islands/CreateSpaceWizard.vue` → re-author per design `spaces.jsx` + `screens.css` `.modal-*`/`.tpl-*`/`.steps`/`.radio-card` (4-step wizard with template cards, identity step, access step, members step).
- `resources/views/auth/sign_in.strav`, `resources/views/workspaces/{new,show}.strav`, `resources/views/spaces/{new,show}.strav` → wrap in shell layout where appropriate; auth view stays full-bleed split.

Each conversion is mechanical (ad-hoc CSS → token classes); the visual outcome is the design.

## Markdown rendering pipeline

- `markdown-it` instance configured at app boot (`config/markdown.ts`) with the plugin set above.
- Custom render rules wire markdown elements to design CSS hooks:
  - `# Heading` → `<h1>` inside `.read` (no class needed; `.read h1` per `styles.css`).
  - `paragraph` first-after-h1 → `.lede` class (drop cap kicks in via `.read .lede::first-letter`).
  - ` ```mermaid ... ``` ` → call Mermaid renderer at template time; output `<div class="diagram"><svg>...</svg></div>`.
  - ` ```<lang> ... ``` ` → Shiki render → `<div class="codeblock"><div class="codeblock-hd">...</div><pre>...</pre></div>` with `.tok-*` token classes per design.
  - `> Note` callout syntax (`> :memo: ...` or `markdown-it-attrs` `{ .callout }` block) → `<div class="callout"><div class="callout-icon">¶</div><div>...</div></div>`.
  - Heading IDs from `markdown-it-anchor` populate the right-margin `.toc`.

Sanitization: server-rendered output is HTML-escaped at the markdown layer; no user-submitted HTML rendered raw. Mermaid SVG output trusted (we generated it).

## Observability

- Logs: `doc.read { workspace_id, space_id, doc_id, revision_id, user_id, ms }`.
- Metrics: `doc_read_latency_seconds` histogram + `markdown_render_seconds` + `mermaid_render_seconds` (separate so we can spot which is slow).

## Test strategy

- BDD test per scenario in `tests/reader/`. The no-JS scenario asserts on raw HTML response (no DOM, no JS).
- One Playwright-shaped test for the user-flow scenario (sign-in → navigate to doc URL → assert visible elements). Optional in v1 if Playwright isn't yet wired; smoke-check covers it manually.
- Round-trip-shape: a fixture markdown file → rendered HTML → assert specific class-attribute pairs (e.g., first paragraph after `<h1>` has `.lede`; mermaid block becomes `<div class="diagram">`).

## Open questions

*(None at signing — URL design, app-shell scope, library choices all resolved by Liva 2026-05-09.)*

## Signature
```
Signed by: Liva
Date: 2026-05-09
```

## Amendment log

### 2026-05-09 — `shell.strav` deferred from Build-T0 to Build-T1
Changed: `App shell (minimal — Liva 2026-05-09)`
From:    `resources/views/layouts/shell.strav` listed as a Build-T0 deliverable, alongside tokens.css and the universal layout.
To:      Moved to Build-T1, where it composes with the sidebar + topbar partials it depends on. Build-T0 keeps `layouts/app.strav` as the universal full-bleed layout with the design's data-attrs + fonts + CSS — sufficient for slice 001 / slice 002 surfaces to keep rendering through T0; the shell wrapper lands when the partials are real.
Why:     `shell.strav` would have been an empty placeholder at T0 — its meaningful contents (sidebar + topbar partials) don't exist yet, and Strav's nested-layout support (`@layout('layouts/app')` inside another layout) isn't yet verified by this codebase. Co-locating shell.strav with the partials at T1 means T1's smoke-check exercises the layout end-to-end, instead of T0 shipping a slot that nothing fills.
By:      Liva
