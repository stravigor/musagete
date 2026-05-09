```
slice_id:      002-workspace-and-space-bootstrap
status:        Draft
date:          2026-05-09
signed by:
references:
  slice:       ./002-workspace-and-space-bootstrap.md
  design:      ../10-design.md
  adrs:
    - ../adr/0007-versioning-immutable-revisions.md
  adapter:     ../adapters/strav.md
```

---

## Interface contract

- `POST /workspaces` — creates a workspace; auth required; assigns owner.
- `POST /workspaces/:slug/spaces` — creates a space; member role ≥ `editor`; body matches the wizard state.
- `GET /workspaces/:slug/spaces/:space_slug` — returns the space's tree (folders + docs); RLS-scoped.
- `PATCH /workspaces/:slug/spaces/:space_slug/defaults` — toggles per-space defaults; admin or owner.
- *Errors:* `400` validation, `409` slug conflict, `403` role insufficient, `404` cross-tenant or unknown.

## Data model

| Resource         | Boundary | Key columns | Notes |
|------------------|----------|-------------|-------|
| `workspaces`     | tenant root | id, slug unique, name, region, owner_id, created_at | seeded by Scenario 1 |
| `memberships`    | tenant   | workspace_id, user_id, role enum(owner/admin/editor/reader/guest), created_at | unique(workspace_id, user_id) |
| `spaces`         | tenant   | id, workspace_id, slug, name, icon, visibility, template, parent_space_id nullable | unique(workspace_id, slug) |
| `space_defaults` | tenant   | space_id PK, require_review bool, allow_comments bool, ai_index bool | one row per space |
| `docs`           | tenant   | id, workspace_id, space_id, slug, title, folder_path, current_revision_id, created_at | unique(space_id, slug) |
| `revisions`      | tenant   | id, doc_id, author_id, message, content (text/markdown), parent_revision_id, status enum(draft/published), created_at | immutable; ADR-0007 |

Migration adds pgvector via `CREATE EXTENSION IF NOT EXISTS vector;` in the same migration.

## Policy & invariants

- **RLS:** Per Design `V4` — every SELECT/INSERT/UPDATE/DELETE on tenant tables filters by current `workspace_id` from session context (set via `@strav/database` SET LOCAL on every request).
- **Authz:** workspace creation is open to any signed-in user; space creation requires role ≥ `editor`; default toggles require role ≥ `admin`.
- **Validation:** slugs follow Design `V2` (lowercased, dash-joined, URL-safe). Names 1–80 chars.
- **Timestamps:** Design `V1` (UTC `timestamptz` in storage; user-tz at display).
- **Domain:** new revision rows are `status = 'published'` only when wired into `docs.current_revision_id`; templates emit one published revision per seeded doc.
- **Boundary:** no controller in this slice accepts `workspace_id` from input; it is always derived from the URL `/workspaces/:slug/...` and verified against membership.

## NFR targets

- Workspace creation p95 < 200ms; space creation including template seed p95 < 800ms (template = ~10–30 docs).

## Dependencies

- Upstream: 001.
- Framework: `@strav/database` (RLS), `@strav/http` (controllers), `@strav/view` (wizard template), `@strav/cli` (generators).
- Third-party: none.

## Observability

- Logs: `space.created { workspace_id, space_id, template }`, `workspace.created { workspace_id, owner_user_id }`.
- Metrics: `workspaces_created_total`, `spaces_created_total{template}`.

## Test strategy

- One test per BDD scenario in `tests/spaces/`. Cross-tenant denial test runs at the connection level (calls SELECT directly with different session-scoped workspace_id) to prove RLS is the gate.

## Open questions

*(Empty before signing.)*

## Signature
```
Signed by:
Date:
```

## Amendment log
