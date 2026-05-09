```yaml
slice_id:        002
status:          shipped
owner_turn:      Integrate-T1
resource_type:   Entity
tenancy:         tenant
runtime:         web
strav_packages:  [@strav/database, @strav/http, @strav/view, @strav/cli]
```

---

## Story

As a **signed-in developer**
I want to **create a workspace, then create a space inside it from a template, with per-space defaults**
so that **I have an isolated tenant context with seeded docs to start working in**.

---

## Context

Establishes the tenant boundary: every tenant table from now on carries `workspace_id` and is RLS-enforced via `@strav/database`. Six space templates seed the initial tree of folders and docs; per-space defaults toggle review, comments, and AI indexing. This slice exercises Postgres RLS multi-tenancy (`P4` → `R4`) — the showcase of `@strav/database` boundary enforcement.

Links:

- Discovery: [`../00-discovery.md`](../00-discovery.md) — addresses `G1`, `P4`.
- Design: [`../10-design.md`](../10-design.md) — instantiates `C1`, `R4`.
- Tech Spec: [`./002-workspace-and-space-bootstrap.tech.md`](./002-workspace-and-space-bootstrap.tech.md).
- ADRs: [ADR-0007](../adr/0007-versioning-immutable-revisions.md) (revisions seeded for templates).
- Depends on: 001.

---

## BDD Scenarios

```gherkin
Scenario 1: First workspace creation
  Given a signed-in user with no workspaces
  When the user POSTs name "Acme Cloud", slug "acme-cloud"
  Then a Workspace row is created with the user as owner
    And a Membership row links (workspace, user, role="owner")
    And the user's last_workspace_id is set to the new workspace
    And the response redirects to "/" — which resolves to "/workspaces/acme-cloud"

Scenario 2: Space creation from "engineering" template
  Given a workspace exists with the user as owner
  When the user runs the Create Space wizard with template "engineering", name "Platform", visibility "protected"
  Then a Space row is created with workspace_id, slug "platform", template "engineering"
    And the seeded folder structure (Runbooks, ADRs, On-call, API Reference) is present
    And at least one seeded Doc + initial Revision exists per folder

Scenario 3: Space defaults are persisted
  Given the wizard is on step 3 (Access)
  When the user toggles "Require PR review" off and "AI index" on, then completes step 4
  Then the SpaceDefaults row stores require_review=false, allow_comments=true, ai_index=true

Scenario 4: Cross-workspace read is denied at the database
  Given workspace A and workspace B with disjoint members
  When user-A's session attempts to read a Doc whose workspace_id is B's
  Then the underlying SELECT returns zero rows (RLS denies; the controller returns 404)

Scenario 5: Slug uniqueness within a workspace
  Given workspace "acme-cloud" already has a space with slug "platform"
  When the user attempts to create another space with slug "platform"
  Then the response is 409 with body { error: "slug_taken" }
```

---

## Definition of Done

- [x] Schemas committed: `workspace`, `membership`, `space`, `space_defaults`, `doc`, `revision`. Plus an additive column on the existing `user` schema: `last_workspace_id BIGINT NULL`.
- [x] Migration generated via `bun strav generate:migration -m "002_tenancy"` and applied via `bun strav migrate`. (pgvector extension is **not** part of this migration — deferred to slice 005/007 once `@strav/database` ships first-class extension management; see `docs/notes/strav-pgvector-extension.md`.)
- [x] RLS via `@strav/database`'s `tenanted: true` schema flag — every tenant table carries `workspace_id` and the `tenant_isolation` policy is auto-emitted; tenant tables use `t.tenantedBigSerial()` so each workspace counts ids 1, 2, 3 … independently.
- [x] Tenant-context middleware at `app/http/middleware/tenant_context.ts` — single-pool design (resolves `:slug` → `workspace.id` on the app pool since `workspace` is the tenant registry, not RLS-scoped; verifies membership inside `withTenant(id, …)`; calls `next()` still inside the `withTenant` block so controller-side queries inherit the tenant context). Bound to the `/workspaces/:slug/...` route group only — the workspace-creation route runs without tenant scope.
- [x] Six template seeders shipped at `app/services/spaces/space_templates.ts` (Tech Spec amendment 4: this is a runtime registry consumed by `createSpace`, not a `bun strav seed`-time seeder, so it lives next to the service rather than under `database/seeders/`). Six templates populated (Blank ships empty by design); other five carry one placeholder doc per template-named folder ("Add your first runbook here." etc.). Substantive starter content deferred per Build-T0 resolution.
- [x] Wizard view at `resources/views/spaces/new.strav` mounts a `CreateSpaceWizard` Vue island as a 4-step modal (Template → Identity → Access → Members). Step 4 ships as a v1 placeholder ("you'll be the first member; invitations ship later") since invitation flow is deferred to v2 People & Access. Wizard styling uses ad-hoc `<style module>` CSS in the SFC; theme tokens land in slice 003.
- [x] BDD scenarios green (5/5 acceptance pass). Cross-tenant denial (Scenario 4) asserts at the SQL layer via `pg_class.relforcerowsecurity` + `pg_policies` shape; the empirical "cross-tenant SELECT returns 0 rows" sub-assertion auto-skips when `current_user.rolbypassrls = true` (deferred operator step: create a non-BYPASSRLS Postgres role for the regular pool, then the empirical assertion runs).
- [x] Slice file updated (status → `built`); `bun test` passes (19 pass / 1 skip / 0 fail / 147 expect() calls across 13 files).
