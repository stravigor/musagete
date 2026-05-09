# Log — musagete-kb

Integrate-phase entries. One entry per shipped slice,
plus release entries when a version is tagged.

Append-only. Read top-to-bottom for status; read each entry's
"what surprised us" section for retro content.

---

## Slice 001 — Auth (magic link + Google/GitHub OAuth + TOTP)

- **Built in:** `Build-T1` (2026-05-09) — preceded by `Build-T0` setup precursor.
- **Shipped:** 2026-05-09
- **Commit:** [`1bf1915`](https://github.com/stravigor/musagete/commit/1bf1915) — *Build slice 001: auth surface (magic link + Google/GitHub OAuth + TOTP)*
- **Turn chain:** `Planning` (signed at slice ready / Tech Spec sign) → `Build-T0` → `Build-T1` (with redo loops on planning/harness/practice causes) → `Integrate-T1`

### What was built

Auth contract for the showcase. Slice 001 ships endpoints + storage + tests; the editorial HTML for the auth screen is owned by slice 003 per the deferral amendment.

- **Magic-link sign-in.** `POST /auth/magic` issues a 32-byte URL-safe token, stores its SHA-256 in `magic_link`, dispatches the email through `@strav/signal`'s `mail` facade. `GET /auth/magic/:token` consumes atomically (TOCTOU-guarded), find-or-creates the user, opens a session, sets the `musagete_session` cookie, and redirects.
- **OAuth sign-in for Google + GitHub.** `GET /auth/oauth/:provider/{start,callback}` — `@strav/social` (`SocialProvider` + per-provider classes) handles the OAuth dance with `@strav/http`'s `session()` middleware binding CSRF state. Verified email is the authoritative key for find-or-create + `oauth_identity` upsert.
- **TOTP 2FA.** `POST /auth/2fa/setup` provisions the secret (encrypted via `EncryptionManager`) and 10 hashed recovery codes, returns the otpauth URL. `POST /auth/2fa/verify` accepts a 6-digit code or a recovery code; the same endpoint covers both *setup confirmation* (flips `enabled=true`) and *sign-in second factor* (promotes session `step1 → full`).
- **Sign-out.** `POST /auth/sign-out` deletes the session row and clears the cookie.
- **Rate limit.** ≤ 5 magic-link requests per email per rolling 10-minute window, fed by `login_attempt` rows the slice writes for every attempt regardless of outcome.
- **Schema layer.** Seven platform tables (`user`, `session`, `oauth_identity`, `magic_link`, `totp_secret`, `recovery_code`, `login_attempt`) with three PG enums, CASCADE FKs to `user`, single + composite UNIQUEs emitted natively by `@strav/database`'s `parents:[{name,unique}]` and schema-level `uniques:` syntax — both shipped upstream during this slice's Build phase. Migration `1778313714015` is the single bundle, no hand-edits.

### Acceptance criteria → verification

All 9 BDD scenarios from `spec/slices/001-auth-magic-link-and-oauth.md` mapped to a green test:

- [x] Scenario 1: First-time user signs in with a magic link → `tests/auth/magic_link_request.test.ts` (also asserts the email dispatch via memory `MailTransport`).
- [x] Scenario 2: User redeems a valid magic link → `tests/auth/magic_link_consume.test.ts`.
- [x] Scenario 3: An expired magic link is rejected → `tests/auth/magic_link_expired.test.ts`.
- [x] Scenario 4: User signs in with Google OAuth → `tests/auth/oauth_google.test.ts` (`GoogleProvider.prototype.user` mocked).
- [x] Scenario 5: User signs in with GitHub OAuth → `tests/auth/oauth_github.test.ts`.
- [x] Scenario 6: User enables TOTP 2FA (setup + first verify) → `tests/auth/totp_setup.test.ts`.
- [x] Scenario 7: User signs in with TOTP enabled (valid + invalid code) → `tests/auth/totp_signin.test.ts`.
- [x] Scenario 8: Rate limit on magic-link requests → `tests/auth/rate_limit.test.ts`.
- [x] Scenario 9: Sign-out destroys the session → `tests/auth/sign_out.test.ts`.

Test surface at ship: **13 pass / 0 fail / 78 expect() calls / 10 files**. Zero project-local TypeScript errors.

### What surprised us

**What took longer than expected, and why?** The OAuth pair (Scenarios 4 + 5) — not because of the OAuth dance itself, but because `@strav/social` requires `@strav/http`'s `SessionProvider` for state binding (non-optional after a security fix). That meant registering Strav's session machinery alongside this project's own `session` table, renaming our cookie to `musagete_session` to avoid collision with framework-default `strav_session`, and accepting that two session schemes coexist (Strav's for OAuth state, ours for app auth). Worth it — the alternative of subclassing `AbstractProvider` to plug in custom state would have doubled the code volume.

**What was easier than expected, and why?** The schema layer. Mid-slice, `@strav/database` shipped the missing composite-UNIQUE DSL features (`parents: [{ name, unique }]` and schema-level `uniques: […]`); the framework-issue ticket I'd written and the hand-edited migration both got removed in a single regenerate. From hand-edited workaround to fully generator-clean migration in one Turn redo.

**What did we learn that the Discovery / Design / slice file didn't capture?**

- **Project-wide conventions surface during Build, not Planning.** Two of them came up here: subpath imports (`#policies/auth_policy` rather than `../../policies/auth_policy`) and the cookie-hash convention (writer ↔ reader must agree on whether they hash raw bytes or the encoded string). Subpath imports got promoted to a Design `V*` (`V8`); the cookie-hash helper was centralized in `session_service.ts` as `hashCookieValue()`. **Pattern for future slices:** any project-wide invariant discovered during Build that survives past one slice belongs in Design's Conventions section, cited from each Tech Spec by `V-ID`.
- **The slice DoD is a real gate, not boilerplate.** The first close attempt missed three unfilled DoD items (mail dispatch, auth `.strav` view, global tokens.css). The second close was honest: mail dispatch landed in this slice; auth view + tokens.css formally deferred to slice 003 via Tech Spec amendment. The deferral pattern is reusable: when a slice's DoD strays into territory that another slice owns more naturally, amend the Tech Spec and update the inheriting slice's backlog row.
- **Tests force precision.** The `canVerifyTotp` policy ("session in step1") was wrong as written — the same endpoint serves both setup-confirmation (`full`) and sign-in second factor (`step1`). Surfaced when the Scenario 6 test needed verify with `state='full'`. Tech Spec amended; policy relaxed to "session required, any state"; handler branches at runtime. Without the test, this would have shipped as a 403 bug.

### Harness signals

- **`redo` count:** 5 across Build-T1.
  - Causes: `planning` (×3 — Tech Spec singularization, totp_secret PK, verify-policy state-strict), `harness` (×1 — `@strav/database` shipped composite-UNIQUE DSL upstream mid-slice), `practice` (×1 — cookie-hash convention bug between writer and reader).
  - All resolved within the same Turn; no escalations to upstream phases.
- **`escalate` count:** 0.
- **Checkpoint halts:** 3 (Build-T1's three AGON-mandated checkpoints) + 1 (Build-T0's single ack gate) + 4 inner-loop halts (one per BDD scenario pair).
- **Notes:** Build-T1 was opened too eagerly with the full slice scope — paused immediately at its `ai_of_human` gate; setup work carved into Build-T0 as a predecessor. Pattern worth remembering: Build Turns that bundle setup and feature work tend to surface their preconditions later than they should.

### Follow-ups / backlog deltas

- **Slice 003 inherits two scope items** from this slice: `resources/css/tokens.css` and the auth `.strav` view + AuthForm Vue island. Backlog row 3 records the inheritance.
- **Mail templating.** Slice 001 dispatches plain HTML/text bodies for the magic-link email. A follow-up Micro-Turn (or a future polishing slice) could move to `mail.to(...).template('auth.magic_link', { url })` once the editorial mail templates exist.
- **OAuth provider HTTP** is mocked in tests at the `@strav/social` boundary per Tech Spec § Test strategy — full end-to-end Google / GitHub flow is out of scope for the build pipeline. If we ever add a manual smoke-test ceremony, this is where it goes.
- **No new Patterns promoted.** Three candidate patterns are watch-listed in `spec/20-backlog.md`: AI tool-restricted agent (slice 005), Vue island with server-streamed AI calls (slice 004), RLS-aware service (slice 002) — slice 001 is platform-only so it didn't surface a tenancy pattern.
- **No ADR amendments triggered.** ADR-0001..0007 still describe what's being built; the spec deltas all landed as Design / Tech-Spec / adapter amendments.

### Signed

- Integrate closed by: Liva — 2026-05-09

---

## Slice 002 — Workspace + Space bootstrap

- **Built in:** `Build-T1` (2026-05-09) — preceded by `Build-T0` setup precursor (cross-cutting singularization sweep + tenant-pool config + framework-issue notes).
- **Shipped:** 2026-05-09
- **Commit:** TBD — to be filled in at commit time.
- **Turn chain:** `Planning` (signed at slice ready / Tech Spec sign) → `Build-T0` → `Build-T1` (with redo loops on planning / harness / practice causes; one mid-Build framework-upgrade follow-up) → `Integrate-T1`

### What was built

Tenant boundary for the showcase. Slice 002 ships the schema layer + endpoints + RLS wiring + the wizard UI; from this slice on, every tenant table carries `workspace_id` and is RLS-enforced via `@strav/database`.

- **Workspace creation.** `POST /workspaces` is open to any signed-in user; the controller writes a `workspace` row + a `membership(role='owner')` row + sets the user's `last_workspace_id`, atomically inside a single `sql.begin(...)` on the app pool. Slug uniqueness via `ON CONFLICT (slug) DO NOTHING + RETURNING` (TOCTOU-safe). 302 redirect to `/workspaces/<slug>` on success.
- **Space creation from a template.** `POST /workspaces/:slug/spaces` with a wizard payload `{ template, name, slug, visibility, requireReview?, allowComments?, aiIndex? }` creates a `space` + `space_defaults` + (per the chosen template) one Doc + initial Revision per folder. Wizard step 3 toggles override the template defaults per-field via `??` layering. Per-tenant id sequences (`tenantedBigSerial`) mean each workspace counts space/doc/revision ids 1, 2, 3 … independently.
- **Per-space defaults toggle.** `PATCH /workspaces/:slug/spaces/:space_slug/defaults` accepts any subset of the three booleans; `COALESCE(${field ?? null}, current)` keeps unspecified fields. Admin or owner only per `space_policy.canUpdateSpaceDefaults`.
- **Tenant-context middleware.** `app/http/middleware/tenant_context.ts` is bound to the `/workspaces/:slug/...` route group. Resolves `:slug` → `workspace.id` on the app pool (workspace is the tenant registry, not RLS-scoped); inside `withTenant(workspace.id, …)` it verifies membership (RLS now permits the read), augments `ctx.get('user')` with `membershipRole`, and calls `next()` still in the tenant context so controller-side queries inherit `app.tenant_id`. Single-pool design — sidesteps the bypass pool entirely.
- **Six space templates.** Registry at `app/services/spaces/space_templates.ts` (Tech Spec amendment 4: runtime registry, not `bun strav seed`-time data). `engineering` is the canonical example with 4 folders × 1 placeholder doc; `blank` ships empty by design; the other four (`product`, `people-and-process`, `security-and-compliance`, `public-api-docs`) carry one placeholder doc per template-named folder. `security-and-compliance` ships `requireReview: true` per slice DoD.
- **Wizard UI.** `resources/views/spaces/new.strav` (extends `layouts/app`; mounts the island) + `resources/islands/CreateSpaceWizard.vue` (4 steps: Template → Identity → Access → Members; auto-derive slug from name; auto-snap defaults to template; ad-hoc `<style module>` CSS until slice 003 lands `tokens.css`). Step 4 is a v1 placeholder ("invitations ship later") since the invitation flow is deferred to v2 People & Access.
- **Schema layer.** Six new tenant tables (`workspace`, `membership`, `space`, `space_defaults`, `doc`, `revision`) + an additive `last_workspace_id BIGINT NULL` on slice 001's `user`. Three PG enums (`space_visibility {protected, private}`, `membership_role {owner, admin, editor, reader, guest}`, `revision_status {draft, published}`). All five tenanted tables emit `ENABLE + FORCE ROW LEVEL SECURITY` with the `tenant_isolation` policy; FKs include `workspace.owner_id → user`, `revision.author_id → user`, `user.last_workspace_id → workspace`, plus three composite FKs the framework's mid-Build self/circular-FK fix made expressible (`doc.current_revision_id`, `revision.parent_revision_id`, `revision.doc_id`). Migration `1778327258929` is the single bundle, no hand-edits remain.

### Acceptance criteria → verification

All 5 BDD scenarios from `spec/slices/002-workspace-and-space-bootstrap.md` mapped to a green test:

- [x] Scenario 1: First workspace creation → `tests/spaces/workspace_create.test.ts`.
- [x] Scenario 2: Space creation from "engineering" template → `tests/spaces/space_create.test.ts` (test 1 of 3).
- [x] Scenario 3: Space defaults persisted via wizard step 3 toggles → `tests/spaces/space_create.test.ts` (test 2 of 3).
- [x] Scenario 4: Cross-workspace read denied at the database → `tests/spaces/cross_tenant_denial.test.ts` (structural via `pg_class` + `pg_policies`; empirical sub-assertion auto-skipped under `current_user.rolbypassrls = true`).
- [x] Scenario 5: Slug uniqueness within a workspace → `tests/spaces/space_create.test.ts` (test 3 of 3).

Test surface at ship: **19 pass / 1 skip / 0 fail / 147 expect() calls / 13 files**. Zero project-local TypeScript errors.

### What surprised us

**What took longer than expected, and why?** The test-isolation detour around Bun's `sql.begin(...)`. TestCase's transaction-rollback strategy reserves the app connection and BEGINs on it; expected behavior is that nested `sql.begin(...)` inside a controller call would create a SAVEPOINT and roll back with the outer transaction. Bun's behavior empirically: it issues a fresh BEGIN/COMMIT pair regardless of outer-transaction state, so service-side commits leak past the test's ROLLBACK. Verified with a minimal repro before believing it. Resolution: switched slice 002 tests to `transaction: false` + `tests/utils/reset_tenant_tables.ts` (TRUNCATE the slice 002 tenant tables + DELETE `s2-%@example.com` users) called from `beforeEach`. The detour also triggered a cross-slice amendment to slice 001's `magic_link_expired.test.ts` — its unscoped `SELECT FROM session` was racing against committed slice 002 sessions in parallel test files; scoped by user.email.

**What was easier than expected, and why?** Self-FK + circular-FK support in `t.reference()` shipped upstream mid-Build, exactly as the framework-issue note (`docs/notes/strav-self-and-circular-fk.md`) requested. Adopted natively, deleted the note, regenerated the migration. Slice 001's UNIQUE-constraint precedent applies again: the framework-issue → upstream-fix → cleanup cycle is now precedented twice.

**What did we learn that the Discovery / Design / slice file didn't capture?**

- **`Archetype.Entity` silently drops `parents:`.** `@strav/database`'s `PARENT_FK_ARCHETYPES = {Component, Attribute, Event}` excludes Entity; setting `parents: ['space']` on an Entity-archetype schema is a no-op and the FK column never lands. Surfaced empirically when `bun strav fresh` errored on `column "space_id" named in key does not exist` for the `doc` schema. Fixed by switching `doc` to `Component`. Recorded as a deferred framework note (one-line workaround, no maintenance burden); pattern: when a schema with `parents:` doesn't get a parent FK column, suspect the archetype.
- **Explicit `uniques:` does NOT auto-include the tenant FK column.** The `parents:[{name, unique:true}]` shape auto-promotes to `(workspace_id, parent_id)` for tenanted schemas; `uniques: [['parent', 'field']]` does not. For a tenanted child whose parent's PK is `tenantedBigSerial` (per-tenant), failing to include `'workspace_id'` in the explicit `uniques:` makes the constraint global → cross-tenant collisions on shared per-tenant ids. Surfaced when Scenario 4 seeded two engineering spaces (each with `space_id=1` per workspace) and the doc-slug uniqueness collided across workspaces. Fix: explicit `uniques: [['workspace_id', 'space', 'slug']]`. Pattern for any future tenanted-table `uniques:`.
- **Empirical RLS denial requires role separation.** A Postgres role with `BYPASSRLS` skips RLS even on `FORCE`-protected tables. In dev, defaulting both `DB_USER` and `DB_BYPASS_USER` to the same superuser-shaped role is convenient but defeats the empirical denial test. Resolution: structural tests (RLS DDL via `pg_class.relforcerowsecurity` + `pg_policies` shape) cover the schema contract in any env; the empirical test auto-skips on BYPASSRLS and runs only when role separation is configured. **Pattern:** any future RLS-dependent test should pair a structural assertion (always meaningful) with an empirical one (auto-skipped under BYPASSRLS). Operator follow-up before production: a non-BYPASSRLS app role for `DB_USER`.
- **`authorize()` reads only `ctx.get('user')` as the actor.** Stashing the membership role on a separate ctx key is invisible to policies. Augment the user object inline in tenant_context to satisfy `SpaceActor = CurrentUser & { membershipRole }`. Pattern for any future role-aware policy: the actor is always `ctx.get('user')`; if the policy needs a property, the upstream middleware must put it there.
- **`@strav/testing` doesn't warm the bypass pool.** TestCase calls `Database.init()` (app pool only) but not `db.bypass` (lazy). `withoutTenant` calls in services or middleware fail with `ConfigurationError: Bypass connection requested but not initialised`. Avoided in slice 002 by restructuring tenant_context to a single-pool design. Pattern: any future code that uses `withoutTenant` will need either a TestCase fix upstream (`tenant: true` flag that warms the pool) or a manual `app.resolve(Database).bypass` in tests.

### Harness signals

- **`redo` count:** ~6 across Build-T0 + Build-T1.
  - Causes: `planning` (×3 — `doc` archetype Entity → Component, `doc.uniques` tenant scope, redirect-target literal `/` → `/workspaces/<slug>` clarification at Build-T0); `harness` (×2 — Bun's `sql.begin` no-savepoint discovery, `@strav/testing` doesn't warm bypass pool); `practice` (×1 — first cross-tenant test failure on FK violation due to single-pool vs. bypass-pool mismatch).
  - One mid-Build framework-upgrade obsoleted three deferrals (`docs/notes/strav-self-and-circular-fk.md` deleted on regen).
  - All resolved within the same Turn; no escalations to upstream phases.
- **`escalate` count:** 0.
- **Checkpoint halts:** 3 (Build-T1's three AGON-mandated checkpoints, each closed `advance` after redo loops) + 1 (Build-T0's single ack gate) + 5 inner-loop halts (one per BDD scenario) + 1 (Build-T1 close DoD-cleanup). Total: 10.
- **Notes:** Build-T1 was opened first, paused at its `verification (pre-act)` gate when 15 `ai_of_human` items surfaced; setup work + cross-cutting singularization carved into Build-T0 as a predecessor. Slice 001's "open too eagerly" pattern repeated here, even with the precedent fresh in mind — pattern continues to be: tenancy-introducing slices have wider preconditions than auth-shaped slices, and the AGON cadence accommodates that with the T0/T1 split.

### Follow-ups / backlog deltas

- **Operator follow-up before production:** create a non-BYPASSRLS Postgres role for the regular pool (currently `DB_USER` defaults to a BYPASSRLS superuser in dev). Once `current_user.rolbypassrls = false`, Scenario 4's empirical denial test runs + passes. Documented in turns.md.
- **PATCH `/workspaces/:slug/spaces/:space_slug/defaults`** ships without test coverage (no BDD scenario gates it; the Tech Spec § Interface contract listed it). A happy-path + 404 unit test would be a useful follow-up Micro-Turn before slice 002 ship if confidence is wanted.
- **Wizard UI** has no E2E coverage. The 4-step modal exists; behavior under real-browser flow (slug auto-derive on Next, defaults snap on template change, 409/422 error paths back-stepping) is uncovered. A Playwright/E2E harness is a slice-002-or-later polishing concern; not in scope here.
- **Five stub templates** (`blank` is empty by design; `product`, `people-and-process`, `security-and-compliance`, `public-api-docs`) ship with one placeholder doc per folder. Substantive starter content was deferred per Build-T0 resolution — a content-design pass before public release would replace each placeholder body with usable starter content.
- **Pattern watch-list:** RLS-aware service had its **first instance** in slice 002 (`workspace_service.createWorkspace`'s mid-transaction `set_config('app.tenant_id', …)` for the membership INSERT; `tenant_context` middleware's single-pool `withTenant` design). Per the candidate-pattern rule, promote after the second instance. Slice 003 reads from tenanted tables but doesn't introduce new write paths; slice 004 (editor save) and slice 005 (Ask-the-KB) are the next candidates.
- **Spec amendment count:** 4 in the slice 002 Tech Spec log (Build-T0 sweep; Checkpoint 1 resolutions; framework-upgrade follow-up; templates location). 1 in 10-design.md (singularization). 1 in ADR-0007 (singularization). All recorded with From / To / Why blocks.
- **Three framework-issue notes still open** under `docs/notes/`: pgvector extension management (slice 005/007 will consume the resolution), framework-managed table exclusion from migration diff (self-resolved during regen but kept as documentation), and the deferred-but-not-noted-yet items from this slice (Bun savepoint nesting, TestCase bypass-pool warm-up, archetype `parents:` no-op, explicit `uniques:` tenant-scope) — captured inline in turns.md as one-line workarounds rather than separate notes (4 in-flight notes already at peak).
- **No ADR amendments triggered for slice-002 decisions.** ADR-0007's verification hook #2 (RESTRICT on `doc.current_revision_id`) is technically diverged from (composite FKs emit CASCADE), but the divergence is functionally unreachable (ADR-0007 forbids revision deletion under normal flow); a future amendment could relax the hook to "RESTRICT or CASCADE if revisions are not normally deletable."

### Signed

- Integrate closed by: Liva — 2026-05-09

