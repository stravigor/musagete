```
slice_id:      003-reader-editorial-layout
status:        Draft
date:          2026-05-09
signed by:
references:
  slice:       ./003-reader-editorial-layout.md
  design:      ../10-design.md
  adrs:
    - ../adr/0001-architecture-strav-islands-over-spa.md
    - ../adr/0003-styling-tokens-css-modules.md
  adapter:     ../adapters/strav.md
```

---

## Interface contract

- `GET /d/:slug` — returns the read view for the most recently published revision of the doc within the current workspace.
- *Errors:* 404 if not found or RLS-denied; 403 if visibility blocks the user.

## Data model

No new tables. Reads from `doc`, `revision`, `space`. May denormalize `revision.html_cache` (text) for pre-rendered Mermaid + sanitized HTML, populated by the save handler in slice 004.

## Policy & invariants

- **Authz:** workspace member with role ≥ `reader` for non-public spaces.
- **Validation:** slug shape `[a-z0-9](-[a-z0-9]+)*`.
- **Domain:** the served revision is always `doc.current_revision_id`; never a draft.
- **Boundary:** RLS scopes all reads to the current `workspace_id`.
- **Cross-cutting:** no Vue island is mounted unless `data-want-topbar="true"` is on the body; default is no JavaScript.

## NFR targets

- Cold paint p50 < 100ms server-rendered.
- HTML size p95 < 80 KB for typical docs (≤ 5000 words excluding code blocks).

## Dependencies

- Upstream: 002.
- Framework: `@strav/view` (templates), `@strav/http` (routes).
- Third-party: a Markdown → HTML library that supports CommonMark + tables + footnotes + Mermaid (e.g. `markdown-it` with mermaid plugin); Mermaid SVG renderer.

## Observability

- Logs: `doc.read { workspace_id, space_id, doc_id, revision_id, user_id }`.
- Metrics: `doc_read_latency_seconds` histogram.

## Test strategy

- One Playwright (or `@strav/testing` HTTP) test per BDD scenario; the no-JS scenario asserts on the raw HTML response.

## Open questions

- [ ] Pre-render Mermaid at save time vs. at template time? (Decision before signing.)

## Signature
```
Signed by:
Date:
```

## Amendment log
