```yaml
slice_id:        002
status:          drafted
owner_turn:
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
  When the user POSTs name "Acme Cloud", slug "acme-cloud", region "self-hosted"
  Then a Workspace row is created with the user as owner
    And a Membership row links (workspace, user, role="owner")
    And the response redirects to "/" inside that workspace

Scenario 2: Space creation from "engineering" template
  Given a workspace exists with the user as owner
  When the user runs the Create Space wizard with template "engineering", name "Platform", visibility "workspace"
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

- [ ] Schemas committed: `workspaces`, `memberships`, `spaces`, `space_defaults`, `docs`, `revisions`.
- [ ] Migrations applied via `bun strav db:migrate`; pgvector extension enabled (used by later slices but installed here).
- [ ] RLS policies registered via `@strav/database` for each tenant table; `workspace_id` is required on every tenant-table query.
- [ ] Six template seeders ship under `database/seeders/space-templates/`.
- [ ] Wizard view at `resources/views/spaces/new.strav` mounts a CreateSpaceWizard Vue island as a 4-step modal (Template → Identity → Access → Members). Six templates: Blank, Engineering (runbooks/ADRs/on-call/API ref), Product (roadmap/specs/changelog), People & Process (handbook/onboarding/retros), Security & Compliance (SOC2/threat models, PR-review on by default), Public API Docs (OpenAPI ingestion, code samples, versioned).
- [ ] BDD scenarios green; cross-tenant denial test asserts at the SQL layer, not just the controller.
- [ ] Slice file updated; `bun test` passes.
