# ADR-0004 — Search: Meilisearch via `@strav/search` (dev + prod)

Status:       Proposed
Relationship:
Date:         2026-05-09
Decided by:

---

## Context

`G8` requires the ⌘K palette to return results with p95 < 150ms over 250 docs and to expose `@strav/search`'s pluggable-driver abstraction as part of the showcase. `@strav/search` ships drivers for SQLite FTS5, Postgres FTS, Meilisearch, Typesense, and Algolia behind a unified API and a `searchable()` mixin that auto-indexes ORM models on save and delete.

The Discovery resolved the dev-vs-prod driver question: **Meilisearch in both, with Docker compose for the dev container**. This ADR records the decision and its consequences.

---

## Decision

**Meilisearch is the v1 driver in both development and production**, accessed through `@strav/search`. A `compose.yaml` ships in the repository to run a Meilisearch container locally with one command. The driver abstraction in `@strav/search` is preserved (the controller calls the abstraction, never the Meilisearch SDK directly), so future deployments can swap drivers via `MUSAGETE_SEARCH_DRIVER` — but **only Meilisearch is the supported v1 driver**.

The `searchable()` mixin is applied to the `Doc` model; reindex on `revisions.create` (after the new revision becomes the current pointer) and on `docs.delete`.

---

## Tradeoffs

**What we gain:**
- Total dev/prod parity. Tokenizer, stemming, typo tolerance, ranking — all behave the same in CI and on developer laptops as they do in production.
- A single test surface; tests run against the backend prod actually uses.
- Predictable latency at the documented 250-doc scale.
- The driver-swap showcase remains: the controller code is driver-agnostic, even if only one driver is exercised in v1.

**What we give up:**
- Zero-deps dev startup: developers now need Docker (or a compatible container runtime) running locally before `bun run dev`.
- Marginal pressure on Discovery success criterion #3 ("under 5 minutes from a fresh checkout"): the docker compose step adds 30–90s on first pull, well within budget but not free.

**Why the exchange is worth it:**
At 250+ docs the FTS5/Meilisearch divergence (analyzer differences, ranking, typo tolerance) is large enough to mask real bugs in CI; dev/prod parity catches them at the right time. Docker is a near-universal dev assumption for Bun + Postgres setups already.

---

## Alternatives considered

### Option A — Postgres FTS in both dev and prod
- **Pros:** No additional service.
- **Cons:** Slower typo tolerance; less predictable latency at the upper end of the scale; doesn't exercise `@strav/search` driver swapping in any meaningful way.
- **Why rejected:** under-uses a Strav capability and underperforms at the documented scale.

### Option B — SQLite FTS5 (dev) + Meilisearch (prod)
- **Pros:** Zero-deps dev startup; fastest first-run.
- **Cons:** Dev/prod divergence (analyzer differences, ranking, stemming); requires a parallel test pack to catch driver-specific edge cases; tests in CI rarely catch real production bugs because they run against a different backend.
- **Why rejected (now):** the dev/prod gap is large enough at 250+ docs that the parallel test pack and the bugs it would *not* catch outweigh the onboarding savings. Docker is acceptable as a dev dep.

### Option C — Meilisearch via Docker compose in both dev and prod (chosen)
- **Pros:** Total dev/prod parity; one driver to test against; better latency and ergonomics.
- **Cons:** Docker becomes a hard dev dependency; first-checkout adds the compose step.
- **Chosen because:** Discovery resolved the open question in this direction; parity outweighs onboarding latency at the project's stated scale.

---

## Consequences

- **Positive:** Slice 005's tests run against the same backend production uses; no analyzer-difference test pack needed.
- **Negative:** Quick-start docs include `docker compose up -d meili` before `bun strav db:migrate`. Anyone without Docker has a hard stop.
- **Neutral / follow-ups:** Production deployments document `MEILI_MASTER_KEY` and a one-shot reindex command. If a future deploy needs a different driver, the swap remains a single config change — but the test suite would need to be re-run against the new driver before that deploy is supported.

---

## Verification hooks

- [ ] `config/search.ts` reads `MUSAGETE_SEARCH_DRIVER`; default is `meili`.
- [ ] `compose.yaml` (or `docker-compose.yml`) exists at the repo root and defines the Meilisearch service used by dev.
- [ ] README "Quick start" includes the docker-compose step before migrations.
- [ ] No file under `app/` or `routes/` imports a Meilisearch SDK directly; all queries go through `@strav/search`.

---

## Signature

```
Decided by:
Date:
```

---

## Amendment log

*(Append-only.)*
