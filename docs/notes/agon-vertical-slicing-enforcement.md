# AGON method update — enforce vertical-slicing mandates

**Audience:** a Claude Code session with the AGON method repo open at `/Users/liva/Projects/Strav.dev/method/`.

**Goal:** translate the failure pattern documented below into concrete method-doc / template / checklist changes that *prevent* the same failure mode from recurring on future projects.

**Status:** feedback note. Not a framework-issue (those go to `stravigor/strav`); this is a method-level concern (goes to `strav-dev/method`).

---

## What happened (the failure)

Musagete shipped slices 001 (Auth) and 002 (Workspace + Space bootstrap) following AGON. After Integrate-T1 of slice 002 closed:

- All 14 BDD scenarios across both slices were green.
- All Tech Spec invariants were covered by tests.
- All DoD items were ticked.
- 30-log.md had clean Integrate entries.

And yet **a human running `bun run dev` and opening `localhost:3000` could not perform any of the shipped capabilities in a browser** — not because of a bug, but because:

1. Slice 001 deferred its `.strav` auth view + AuthForm island to slice 003 (Tech Spec amendment, treated as routine).
2. Slice 002's wizard view exists at `GET /workspaces/:slug/spaces/new` but is unreachable: there's no auth UI to sign in with, and no UI to create a workspace (POST exists, no GET form).
3. The Tech Spec lists `GET /workspaces/:slug/spaces/:space_slug` (read view) but slice 002 didn't implement it — that's slice 003's job.

Net result: two slices "shipped" with green tests and a real demonstrability gap. This violates AGON's vertical-slicing core mandate. The method was followed to the letter and produced a layer-cake outcome.

The failure isn't subtle — it took the human zero seconds to spot it once they tried to use the product. The interesting question is **why the AGON ceremonies didn't catch it before Integrate close**.

---

## Failure inventory + AGON citations

For each failure: what AGON says (with file:line in the method repo), why the mandate didn't fire, and a concrete method-doc change that would make it fire.

### F1 — Slice 001 deferred UI to slice 003 via routine Tech Spec amendment

**What AGON says:** *"If a slice needs two distinct UI entry points, it's actually two slices."* — `method/06-framework-adapter.md:135-145`. UI is part of the slice if the framework has UI; deferring UI to a later slice is not a recognized pattern.

**Why it didn't fire:**
- The mandate lives in `method/06-framework-adapter.md` (framework-adapter section, not the core ceremony list). It reads as guidance for framework adapters, not as a hard rule for slice closure.
- The Tech Spec amendment template (`templates/spec.md` if present, otherwise inline in `method/01-phases.md`) accepts "defer X to slice N" as a valid amendment shape. There's no callout that *deferring an observable surface (UI) to a later slice* is qualitatively different from *deferring a non-observable refinement (composite index, mail templating)*.
- BDD scenarios were HTTP-level ("response is 302"), so the absent UI didn't break any scenario. The deferral was self-consistent inside the BDD frame.

**Proposed method change:**
- **Promote the UI-is-part-of-the-slice rule from framework-adapter to core method.** Add a section to `method/01-phases.md` (or carve a new `method/02-vertical-slicing.md`) titled "What may not be deferred between slices." Enumerate: observable user-facing surface, the entry-point that makes the slice's capability demonstrable, the smoke-check path. Cite the rule by anchor from the slice template's DoD checklist.
- **Add a Tech Spec amendment guard.** When an amendment proposes deferring an observable surface, the amendment template requires:
  1. A "Scope-split rationale" field: explain why this is a scope-split (capability splits into two slices), not a deferral.
  2. The receiving slice's DoD updated *atomically* in the same amendment, signed by the receiving slice's owner.
  3. A `defers_observable_surface: true` boolean in the amendment frontmatter. Linters / Integrate-close checks read this and require both items above before close.
- **Cite this rule in the Tech Spec amendment template's "Why" field guidance** so authors see it at write time.

### F2 — BDD scenarios were authored at the system level, not the user-flow level

**What AGON says:** *"Format: Given / When / Then, one scenario per observable outcome. Observable means: HTTP status + state (row exists), file presence, signal emission — something tickable without human judgement."* — `method/05-ceremonies.md:32-48`, `templates/slice.md:102`.

**Why it didn't fire:**
- "Observable" is ambiguous: a database row is observable, an HTTP response is observable, a rendered DOM element is observable. The current definition doesn't push toward "observable to the user in the product's primary surface (browser / CLI)."
- The slice template's example scenarios mix levels. Most read like *"a Workspace row is created with the user as owner"* (system observable). Few read like *"the user clicks Create and lands at /workspaces/<slug>"* (user-flow observable). The mix legitimizes both shapes equally.
- No automated lint or template field forces at least one user-flow scenario per slice.

**Proposed method change:**
- **Tighten the BDD definition in `method/05-ceremonies.md`.** Add: *"At least one scenario per slice MUST be a user-flow scenario — Given the user is at <starting URL or state>, When the user takes <observable action: clicks, types, navigates>, Then the user sees <observable result on the primary surface>. System-observable scenarios (row exists, response status) are allowed in addition; they cannot replace the user-flow scenario."*
- **Update `templates/slice.md` example scenarios.** Lead with one user-flow scenario per slice. Demote system-observable scenarios to "supporting" — they verify invariants the user-flow scenario relies on.
- **Add a Discovery / Planning checklist line:** *"Each slice's BDD set includes at least one user-flow scenario whose When and Then refer to the product's primary surface."*

### F3 — DoD didn't include the browser smoke-check; Integrate close didn't gate on it

**What AGON says:** *"Smoke-check required post-deploy: human confirms live capability (e.g., `curl` or browser-test the endpoint before closing Integrate)."* — `testing.md:25`, `roadmap-spe.md` § 3.4.

**Why it didn't fire:**
- The mandate lives in `testing.md` (a testing-strategy doc), not in the slice template's DoD checklist.
- `templates/slice.md:115-118` ends the DoD list with "Full test suite passes." There's no DoD line for human-in-loop smoke-check.
- Integrate-T1 closure had no template field for "Smoke-check script + result" — the close ceremony accepted "tests green + log entry written" as sufficient evidence.

**Proposed method change:**
- **Add a DoD line to `templates/slice.md`:** *"`[ ]` The capability has been smoke-checked end-to-end by a human before Integrate closes. The smoke-check script (sequence of clicks / `curl`s) and its observed result are recorded in the slice's Integrate-T1 entry under a 'Smoke-check' subsection."*
- **Add a "Smoke-check" subsection to the 30-log.md template** between "Acceptance criteria → verification" and "What surprised us." Example shape:
  ```
  ### Smoke-check
  - **Script:** `bun run dev` → open `localhost:3000` → sign in via magic link → navigate to /workspaces → see workspace list.
  - **Result:** ✓ all steps performed; one screenshot at /workspaces showing the seed workspace.
  - **Performed by:** <name>, <date>.
  ```
- **Integrate-T1 close gate** explicitly checks for the smoke-check subsection presence + a non-empty result. Block close if absent.

### F4 — Foundation-first backlog ordering disguised as vertical-slicing

**What AGON says:** *"Vertical (not horizontal): touches the full stack in one coherent capability. Not 'add a User model' (no capability) or 'refactor auth' (no new capability)."* — `method/05-ceremonies.md:146-157`. *"User-visible capability, end-to-end."* — `method/01-phases.md:110`.

**Why it didn't fire:**
- AGON warns against trivial-horizontal slicing ("add a User model") but doesn't explicitly call out **the layer-cake anti-pattern**: ordering slices as `auth → tenancy → reader → editor → search → review → tagging`. Each layer of that stack *is* a capability the user can use eventually, but the *first* layer alone is not demonstrable, and the second is unreachable without the third's UI, and so on.
- The Discovery template doesn't enforce that **the first slice must be a "hello world" of the product** — a vertical that takes a user from cold to seeing their first piece of value, however degraded.
- The backlog template (`templates/backlog.md`) lists slices in dependency order without requiring the first row to be demonstrable.
- The "Capability-coverage check" in Discovery (every framework package gets exercised) implicitly favors layer-cake ordering, because layers map cleanly to packages.

**Proposed method change:**
- **Add a section to `method/05-ceremonies.md`** titled "Slice ordering: vertical, not layer-cake." Body:
  - The first slice must be the smallest demonstrable vertical — sign-in + first-action + first-result, even degraded (one auth method, no styling, placeholder data).
  - Subsequent slices add capability *to* the demonstrable surface, not *under* it.
  - Anti-pattern: ordering slices as a layer cake (`auth → tenancy → UI → reader → ...`). If slice 1 alone isn't demonstrable, the ordering is wrong.
- **Add a Discovery / backlog signing check:** *"After slice N ships, can a user perform a single navigation flow that exercises every shipped capability? If not, the ordering is wrong — re-slice before Build opens."*
- **Update `templates/backlog.md`** to mark the first row's notes column with a "demonstrable: <flow description>" field. The flow description must be a concrete URL path or click sequence.
- **Soften the "Capability-coverage check"** in Discovery: capability coverage is a *release-tag* check, not a per-slice ordering driver. Slice ordering is driven by demonstrability.

### F5 — Tech Spec amendments lacked downstream review

**What AGON says:** Less explicitly. The Amendment log convention is documented but the amendment ceremony doesn't require downstream-impact review.

**Why it didn't fire:**
- The Tech Spec amendment template captures "From / To / Why" but not "downstream impact: which other slices does this amendment change scope on, and have their owners signed?"
- For deferral amendments specifically, the receiving slice's DoD update is recommended-by-convention, not enforced.

**Proposed method change:**
- **Tech Spec amendment template adds a "Downstream impact" field** — list of slices whose scope or DoD this amendment touches, and the resolution status of each. For deferrals: receiving slice's DoD must be updated atomically.
- **Discovery / Design level:** the Amendment log entry that defers an observable surface to a later slice needs a co-signature from the receiving slice's owner.

---

## Root-cause synthesis (one line each)

- **F1**: vertical-slicing rule lives in framework-adapter, not core method → easy to interpret as guidance, not law.
- **F2**: "observable" is ambiguous; templates legitimize system-level scenarios as the default.
- **F3**: smoke-check rule lives in `testing.md`, doesn't appear in DoD or Integrate close gate.
- **F4**: AGON warns against trivial-horizontal slicing but not layer-cake horizontal slicing; backlog ordering has no demonstrability gate.
- **F5**: Amendment ceremony has no downstream-impact field; deferrals don't trigger receiving-slice review.

---

## Suggested order of method changes

If the method-update session has time for one change, do **F3** (smoke-check DoD line + Integrate gate). It's the cheapest to add and would have caught all five failures at the latest possible moment — slice 002's Integrate-T1 close would have failed because no human could replay the capability in a browser, forcing a reopening of Build.

If time for three, add **F1** (UI-not-deferrable rule promoted to core) and **F4** (slice-ordering demonstrability gate). These prevent the failure at planning time rather than catching it at Integrate.

If time for all five, **F2** and **F5** harden the ceremonies against future drift.

---

## Concrete artifacts to update

In rough priority order:

1. `method/01-phases.md` — add or expand a section on "What may not be deferred between slices." Cite by anchor from the slice DoD.
2. `templates/slice.md` — add `[ ]` smoke-check DoD line; rewrite example BDD scenarios to lead with user-flow framings; add "demonstrable" column requirement.
3. `method/05-ceremonies.md` — add "Slice ordering: vertical, not layer-cake" section; tighten BDD definition with the user-flow-scenario requirement.
4. `templates/backlog.md` — add "demonstrable: <flow>" field on the first row; add backlog-signing check ("after slice N, single navigation flow exercises everything shipped").
5. `templates/integrate-log.md` (if present, otherwise inline guidance in `method/01-phases.md` or `30-log.md` template) — add "Smoke-check" subsection between "Acceptance criteria → verification" and "What surprised us."
6. Tech Spec amendment template (wherever it lives) — add "Downstream impact" field; for deferral amendments, require receiving-slice DoD update atomically.
7. `method/06-framework-adapter.md` — soften the UI-rule there to "see core method `<anchor>`" so the rule has one canonical home.

---

## Concrete evidence (musagete artifacts)

For the method-update session, the failure case is reproducible from these files in `/Users/liva/Projects/Strav.dev/sources/musagete/`:

- `docs/specs/slices/001-auth-magic-link-and-oauth.md` — slice file with shipped status; DoD ticked; no auth UI shipped.
- `docs/specs/slices/001-auth-magic-link-and-oauth.tech.md` Amendment log — the deferral amendment that punted UI to slice 003. Treated as routine.
- `docs/specs/slices/002-workspace-and-space-bootstrap.md` — shipped status; DoD ticked; wizard shipped but no entry-point flow exists.
- `docs/specs/30-log.md § Slice 001` and `§ Slice 002` — Integrate entries. Note the absence of any "Smoke-check" content — neither entry records a human running the live capability.
- `docs/specs/20-backlog.md` — the layer-cake ordering: auth → tenancy → reader → editor → search → review → tagging. Slice 003 is the first slice that ships demonstrable UI; everything before it is unreachable in a browser.

The pattern would have been caught at Integrate-T1 if AGON's `testing.md` smoke-check rule had been promoted to the slice DoD checklist. Five mandates exist in the method docs; none of them fired because each lives in a doc that isn't on the slice-author's daily path.
