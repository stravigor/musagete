```
slice_id:      002-workspace-and-space-bootstrap
status:        Signed
date:          2026-05-09
signed by:     Liva
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

| Resource         | Boundary    | Key columns | Notes |
|------------------|-------------|-------------|-------|
| `workspace`      | tenant root | id (bigserial), slug unique, name, owner_id (FK user), created_at | `tenantRegistry: true`; not `tenanted` (it *is* the tenant table); seeded by Scenario 1 |
| `membership`     | tenant      | id (tenantedBigSerial), user_id (FK user), role enum(owner/admin/editor/reader/guest), created_at | unique(workspace_id, user_id) — `workspace_id` injected by `tenanted: true`. Cross-workspace listing (sign-in landing, workspace switcher) lives in a service function under `withoutTenant(...)` with explicit `WHERE user_id = $1`. |
| `space`          | tenant      | id (tenantedBigSerial), slug, name, icon, visibility enum(protected/private), template | unique(workspace_id, slug); `protected` = visible to all members, `private` = visible to invited subset; public is v1 non-goal |
| `space_defaults` | tenant      | id (tenantedBigSerial), space_id (FK space, unique 1:1), require_review bool, allow_comments bool, ai_index bool | one row per space |
| `doc`            | tenant      | id (tenantedBigSerial), space_id (FK space), slug, title, folder_path, current_revision_id (FK revision, ON DELETE RESTRICT), created_at | unique(space_id, slug); pointer-to-current-revision shape per ADR-0007 |
| `revision`       | tenant      | id (tenantedBigSerial), doc_id (FK doc), author_id (FK user), message, content (text/markdown), parent_revision_id (FK revision nullable), status enum(draft/published), created_at | immutable; ADR-0007 |

Additive change on the existing platform-side `user` schema (slice 001): `last_workspace_id BIGINT NULL` — no FK (cross-boundary; column self-heals on next workspace selection). Used by Scenario 1's `/` redirect to resolve the user's last-opened workspace.

Per-tenant id sequences (`t.tenantedBigSerial()`) on the five tenant tables: each workspace counts ids 1, 2, 3 … independently. Backed by the framework's `_strav_tenant_sequences` table + `strav_assign_tenanted_id()` trigger function (installed by `TenantManager.setup()`). URL aesthetics: `/workspaces/acme/spaces/3` rather than global-bigserial 6-digit ids.

pgvector is **not** added in this migration. Slice 002 doesn't consume it; slice 005/007 do. Once `@strav/database` ships first-class extension management (`schema.extensions: ['vector']` proposal — see `docs/notes/strav-pgvector-extension.md`), the consuming slice will enable it.

## Policy & invariants

- **RLS:** Per Design `V4` — tenant tables are flagged `tenanted: true` in their schema; `@strav/database` auto-injects the `workspace_id` column + `tenant_isolation` policy DDL. The `app` (NOBYPASSRLS) connection pool wraps each transaction with `set_config('app.tenant_id', $1, true)`, gated by an `AsyncLocalStorage` context entered via `withTenant(uuid|bigint, fn)`.
- **RLS request-side wiring:** `app/http/middleware/tenant_context.ts` is bound to the `/workspaces/:slug/...` route group. It (a) resolves `:slug` → `workspace.id` under `db.bypass`, (b) verifies the current user's membership, then (c) wraps the request body in `withTenant(id, () => next())`. The workspace-creation route (`POST /workspaces`) runs **without** tenant scope (it creates the tenant row itself); cross-workspace listing endpoints (sign-in landing, workspace switcher) call into service functions wrapped in `withoutTenant(...)` and filter by `user_id` explicitly.
- **Authz:** workspace creation is open to any signed-in user; space creation requires role ≥ `editor`; default toggles require role ≥ `admin`. The full membership role enum (`owner | admin | editor | reader | guest`) ships now even though only `owner` and `editor` are written by this slice — forward-compatible for the v2 People & Access slice.
- **Validation:** slugs follow Design `V2` (lowercased, dash-joined, URL-safe). Names 1–80 chars. `space.visibility ∈ {protected, private}`.
- **Timestamps:** Design `V1` (UTC `timestamptz` in storage; user-tz at display).
- **Domain:** new `revision` rows are `status = 'published'` only when wired into `doc.current_revision_id`; templates emit one published revision per seeded doc.
- **Boundary:** no controller in this slice accepts `workspace_id` from input; it is always derived from the URL `/workspaces/:slug/...` and verified against membership by the tenant-context middleware.
- **Default-workspace resolution:** `GET /` (when authenticated and `user.last_workspace_id IS NOT NULL`) issues a 302 to `/workspaces/<workspaces[last_workspace_id].slug>`; if `NULL`, it picks the user's most-recent membership; if there are no memberships, it routes to `/workspaces/new` (the create-workspace screen).

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
Signed by: Liva
Date: 2026-05-09
```

## Amendment log

### 2026-05-09 — Templates ship under `app/services/spaces/`, not `database/seeders/space-templates/`
Changed: `Test strategy` (implicit), `Dependencies`
From:    Slice DoD specified six template seeders under `database/seeders/space-templates/`.
To:      Templates ship as a runtime registry at `app/services/spaces/space_templates.ts`, consumed by `createSpace` at request time.
Why:     `database/seeders/` is the canonical location for `bun strav seed`-time data (initial DB seeding via the `DatabaseSeeder.call()` chain). Space templates are *not* initial seed data — they're applied at request time when a user picks "engineering" in the wizard. Putting them under `database/seeders/` would imply they get inserted globally on `bun strav seed`, which is wrong: a template's docs should only materialize inside the workspace+space the wizard creates. Co-locating with the service that consumes them (`space_service.ts → createSpace`) keeps the dependency local and the typing tight (the registry is typed; the seeder pattern is loosely-typed by convention).
By:      Liva

### 2026-05-09 — Framework upgrade follow-up: self-FK + circular-FK in `t.reference()` landed
Changed: `Data model`
From:    *(three FKs deferred to framework note: `workspace.owner_id`, `doc.current_revision_id`, `revision.parent_revision_id`)*
To:      *(all three FKs emitted natively by `t.reference()` after upstream fix)*

| Column | FK strategy | Framework-emitted ON DELETE |
|---|---|---|
| `workspace.owner_id → user(id)` | `owner: t.reference('user').required()` | RESTRICT |
| `doc.current_revision_id → revision(workspace_id, id)` | `currentRevision: t.reference('revision').nullable()` | CASCADE (composite FK; framework forces CASCADE because SET NULL is impossible on NOT NULL tenant FK column) |
| `revision.parent_revision_id → revision(workspace_id, id)` | `parentRevision: t.reference('revision').nullable()` | CASCADE (same reason) |

`@strav/database` shipped self-FK and 2-schema circular-FK support in `t.reference()` mid-Build-T1. Adopted natively; deleted `docs/notes/strav-self-and-circular-fk.md`. The two cycles in this slice (doc↔revision = Pair A, workspace↔user = Pair B) plus the self-FK on `revision.parent_revision_id` (Shape 1) now all emit at the schema level — no application-layer integrity checks remain.

ADR-0007 verification hook #2 specified `ON DELETE RESTRICT` on `doc.current_revision_id`; framework emits CASCADE on this composite FK. Functionally equivalent: ADR-0007 forbids revision deletion under normal flow, so the CASCADE pathway is unreachable in practice. ADR-0007 verification hook may be amended in a future slice if the divergence becomes load-bearing; not amending now.

Why:    Same pattern as slice 001's UNIQUE-constraint hand-edit getting obsoleted by an upstream DSL fix. The framework note → upstream fix → schema regenerate → note deletion cycle is now precedented twice; future slices can rely on it.
By:     Liva

### 2026-05-09 — Build-T1 Checkpoint 1 resolutions
Changed: `Data model`
From:    *(implicit — every cross-table FK was assumed to land at the schema level via `parents:` or hand-edit; revision's archetype was Component, inheriting `updated_at` + `deleted_at` despite ADR-0007 immutability)*
To:      *(explicit per-edge FK strategy, captured below)*

| Column | FK strategy | Why |
|---|---|---|
| `revision.author_id → user(id)` | `author: t.reference('user').required()` | ON DELETE RESTRICT — blocks user delete until authored revisions are reassigned |
| `user.last_workspace_id → workspace(id)` | `lastWorkspace: t.reference('workspace').nullable()` | ON DELETE SET NULL — UI memory is stale-tolerant |
| `workspace.owner_id → user(id)` | plain `t.bigint().required()`; FK deferred | 2-schema cycle with `user.lastWorkspace`; cycle broken on this side because membership(role='owner') already encodes ownership with a CASCADE FK |
| `doc.current_revision_id → revision(...)` | plain `t.bigint().nullable()`; FK deferred | doc↔revision circular; framework `t.reference()` does not yet model 2-schema cycles |
| `revision.parent_revision_id → revision(...)` | plain `t.bigint().nullable()`; FK deferred | self-FK; framework `t.reference()` does not yet model self-references |

The three deferred FKs are tracked at the framework level via `docs/notes/strav-self-and-circular-fk.md` (Shape 1 = self-FK, Shape 2 Pair A = doc↔revision, Shape 2 Pair B = workspace↔user). Application-layer integrity per case lives in slice 002's create-workspace controller (workspace-owner) and slice 004's save handler (parent-revision validation + current-revision-pointer maintenance).

`revision` archetype switched from `Component` to `Event` so the framework only emits `created_at` (no `updated_at`, no `deleted_at`) — encoding ADR-0007 immutability at the schema level. First instance of Event-with-`parents:`-and-`tenanted:true` in the project; confirmed working by Checkpoint 1's regen.

A second framework note `docs/notes/strav-framework-tables-migration-exclusion.md` documents an issue surfaced and self-resolved at Checkpoint 1: an early generation pass produced drops of `_strav_access_tokens` and `_strav_sessions`, framework-managed tables created by `SessionProvider`. Subsequent regenerations did not surface the drops. The note remains as documentation if the issue resurfaces.

Why:    Build-T1 Checkpoint 1 surfaced three framework-DSL gaps the schemas couldn't express cleanly. Liva chose "no hand-edit, framework-only" — every gap gets either a `t.reference()`-or-equivalent fix at the schema level, or a framework-issue note for upstream resolution. Slice 001's UNIQUE-constraint hand-edits got obsoleted by an upstream DSL fix mid-Build; the same pattern is expected here for self/circular FK support.
By:     Liva

### 2026-05-09 — Pre-Build resolutions captured (Build-T0 sweep)
Changed: `Data model`, `Policy & invariants`
From:    *(plural table names; `workspaces.region`; `spaces.parent_space_id`; pgvector `CREATE EXTENSION` line; visibility column unenumerated; role enum scope unstated; id-sequence kind unstated; memberships RLS classification unstated; RLS middleware location unstated; `/` redirect resolution unstated)*
To:      *(singular table names per Strav convention; `workspace.region` dropped — multi-region is a v1 non-goal per Discovery; `space.parent_space_id` dropped — no sub-spaces in v1; pgvector deferred to slice 005/007 once `@strav/database` ships first-class extension management; `space.visibility` enum pinned to `{protected, private}`; full role enum `{owner, admin, editor, reader, guest}` shipped now; tenant tables use `t.tenantedBigSerial()`; `membership` is `tenanted: true` with `withoutTenant(...)` for cross-workspace listing; tenant-context middleware lives at `app/http/middleware/tenant_context.ts` bound to `/workspaces/:slug/...`; `/` redirect resolves via `user.last_workspace_id` → most-recent membership → `/workspaces/new`)*
Why:     Captured at Build-T1's `verification (pre-act)` gate; resolved by Liva on the same date and folded into a Build-T0 setup Turn (precedent: slice 001's Build-T0). The Tech Spec was signed before these implementation-shape questions were surfaced; this amendment records the answers. Also adds the `user.last_workspace_id BIGINT NULL` additive column to slice 001's `user` schema — slice 002's only platform-side change, applied as an `ALTER TABLE user ADD COLUMN` in the same migration.
By:      Liva
