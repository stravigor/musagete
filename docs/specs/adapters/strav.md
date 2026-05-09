# Adapter — Strav

framework:       Strav (Bun-native full-stack framework)
version:         @strav/* ^0.4.11 (pinned in package.json)
adapter status:  draft
date:            2026-05-09
signed by:
references:
  design:        ../10-design.md
  guide:         (Strav docs at /Users/liva/Projects/Strav.dev/sources/strav/docs)

---

## 1. Pipeline step map

| # | Generic step            | Your framework's step              | File location                                           | Hand-written or generated? |
|---|-------------------------|------------------------------------|---------------------------------------------------------|----------------------------|
| 1 | Data-shape sketch       | Strav schema definition             | `database/schemas/<name>.ts`                            | hand-written               |
| 2 | Migration               | Strav migration (timestamp)         | `database/migrations/<ts>_<name>.ts`                    | generated from schema      |
| 3 | Model / data-access     | Strav ORM model                     | `app/models/<name>.ts`                                  | generated; mixins added by hand |
| 4 | Validator / input rules | Zod schemas (in service or controller) | `app/services/<domain>/validators.ts`                | hand-written               |
| 5 | Policy / authorization  | Strav policies (RLS + per-route)    | `app/policies/<name>.policy.ts` + `@strav/database` RLS config | scaffolded; logic hand-written |
| 6 | Service / orchestration | Domain service                      | `app/services/<domain>/<name>.service.ts`               | hand-written               |
| 7 | Controller / handler    | Strav controller                    | `app/controllers/<name>.controller.ts`                  | generated; actions hand-written |
| 8 | Interface / route       | Strav route file                    | `routes/<area>.ts`                                      | hand-written               |
| 9 | Test                    | BDD tests via `@strav/testing`      | `tests/<slice>/<name>.test.ts`                          | hand-written               |

UI tail (Strav-specific — server-rendered template + Vue island):

| # | Generic step           | Your framework's step                       | File location                                   | Hand-written or generated? |
|----|------------------------|---------------------------------------------|-------------------------------------------------|----------------------------|
| 10 | View / template        | `.strav` server-rendered template            | `resources/views/<area>/<name>.strav`           | hand-written               |
| 11 | UI component (island)  | Vue 3 SFC mounted as an island               | `resources/ts/islands/<Name>.vue`               | hand-written               |
| 12 | Style                  | CSS Module (or vanilla-extract opt-in)       | `resources/ts/islands/<Name>.module.css`        | hand-written               |
| 13 | Token import           | Global CSS via `@layer tokens`               | `resources/css/tokens.css` (loaded once in root template) | hand-written       |

AI / RAG tail (when a slice ships AI features):

| # | Generic step           | Your framework's step                       | File location                                   | Hand-written or generated? |
|----|------------------------|---------------------------------------------|-------------------------------------------------|----------------------------|
| 14 | AI tool                | `@strav/brain` tool                          | `app/services/ai/tools/<name>.tool.ts`          | hand-written               |
| 15 | AI agent               | `@strav/brain` agent                         | `app/services/ai/agents/<name>.agent.ts`        | hand-written; tool allowlist explicit |
| 16 | Background job         | `@strav/queue` job                           | `app/jobs/<name>.job.ts`                        | hand-written               |

---

## 2. Checkpoint placement

AGON's Build Turn has three mandatory stop-and-confirm checkpoints. They land on:

| Checkpoint | Lands after step | What the human acks |
|------------|------------------|---------------------|
| **1** | Step 1 — schema definition committed | Resource shape, fields, boundary (platform vs. tenant), RLS classification |
| **2** | Step 5 — policy logic drafted        | Policy logic matches Tech Spec's *Policy & invariants*; RLS policy registered |
| **3** | Step 9 — first failing BDD test draft | Test encodes the acceptance criterion before any production code is written |

---

## 3. Generator commands

```sh
# Generate a schema scaffold
bun strav make:schema <name>

# Generate a migration from current schema state
bun strav make:migration --from-schema <name>

# Apply pending migrations
bun strav db:migrate

# Generate a model from a schema
bun strav make:model <name>

# Generate a controller (one action or RESTful set)
bun strav make:controller <name>

# Generate a policy
bun strav make:policy <name>

# Generate a job
bun strav make:job <name>

# Run the dev server with hot reload
bun --hot index.ts        # equivalent: bun run dev
```

*(Exact subcommand names follow `@strav/cli` 0.4.x. If a generator is renamed in a later version, amend this file with the rename and link the Build Turn that surfaced the change.)*

---

## 4. Test command

```sh
bun test
```

Per-slice variant inside the TDD inner loop:

```sh
bun test tests/<slice-folder>
```

A Build Turn cannot advance unless `bun test` exits 0 globally.

---

## 5. Destructive commands — AI must never run

```sh
# Generic (always)
git push --force
git reset --hard
git branch -D
rm -rf

# SQL (always)
DROP TABLE
DELETE FROM ... (no WHERE)

# Strav-specific (always)
bun strav db:fresh           # destroys the database
bun strav db:rollback --all  # destructive; rolls back every migration
bun strav db:seed --fresh    # implies fresh; destructive
```

The AI may *describe* these commands but never run them.

---

## 6. Slice-file framework extensions

Slice headers may add the following YAML fields when this adapter is in effect:

```yaml
# Optional — fill when meaningful for the slice:
resource_type:   Entity | Component | Attribute | Association | Event | Reference | Configuration | Contribution
tenancy:         platform | tenant
runtime:         api | web | job | island
strav_packages:  [@strav/http, @strav/database, @strav/brain, ...]   # used by this slice
```

If a slice introduces no new resource (e.g., a UI-only refinement), `resource_type` is omitted.

---

## 7. Framework-specific patterns

- **AI tool-restricted agent** — agent declares a single output tool that takes structured citations + answer; free-form text replies are not in the agent's surface. First instance: slice 005 Ask-the-KB. Re-noted in slice 006 review summary.
- **Vue island with server-streamed AI calls** — island POSTs to a controller that opens an `@strav/brain` agent, streams partial output back via chunked response (or SSE-over-fetch) which the island applies to local state. First instance: slice 004 slash commands.
- **RLS-aware service** — service functions take the current `(workspace_id, user_id)` from request context and never accept them as user-supplied parameters; the underlying `@strav/database` policy enforces tenancy at the SQL layer. First instance: slice 002 spaces.

---

## 8. Boundaries and tenancy

- **Boundary types:** `platform` (cross-workspace identity, sessions, OAuth) vs. `tenant` (everything else; carries `workspace_id`).
- **Slicing rule:** a single slice does not span both sides of the boundary. The auth slice (001) is platform-only; from slice 002 onward, all data is tenant. If a future capability needs both sides (e.g., a cross-workspace search), it decomposes into two slices.
- **Policy default:** authorization on tenant tables is enforced by Postgres RLS via `@strav/database` policy registration; controllers add per-action role checks (e.g., "writer or above"). Cross-tenant reads are *forbidden by the database*, not just by the controller.

---

## 9. Build Turn self-check

- [ ] Schema file committed at `database/schemas/<name>.ts`.
- [ ] Migration applied cleanly via `bun strav db:migrate`; schema diff matches the slice Tech Spec's data-model section.
- [ ] Model regenerated; mixins (e.g., `searchable()`) attached as required.
- [ ] Policy / RLS rule registered and matches Tech Spec's *Policy & invariants*.
- [ ] Every BDD scenario has a corresponding test file under `tests/`.
- [ ] Routes registered in `routes/<area>.ts` and surfaced via the slice's `.strav` view.
- [ ] If the slice ships a Vue island, it lives at `resources/ts/islands/<Name>.vue`, mounts from the slice's `.strav` template, and uses CSS Modules.
- [ ] If the slice ships AI: agent file declares an explicit tool allowlist; tools are registered; `ai_calls` audit row written per call.
- [ ] No files touched outside the slice (batching Rule 5).
- [ ] Slice file updated: `status: built`, `owner_turn: Build-TN`.
- [ ] `bun test` exits 0 globally.

---

## Signature

```
Signed by:
Date:
```

---

## Amendment log

*(Append entries here as the adapter evolves.)*
