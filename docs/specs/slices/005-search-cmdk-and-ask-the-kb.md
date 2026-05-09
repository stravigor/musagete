```yaml
slice_id:        005
status:          drafted
owner_turn:
resource_type:   Component
tenancy:         tenant
runtime:         island
strav_packages:  [@strav/search, @strav/rag, @strav/brain, @strav/http, @strav/database]
```

---

## Story

As a **reader or editor**
I want to **press ⌘K to fuzzy-search docs, and open an "Ask the KB" drawer that answers my question with paragraph citations from indexed docs**
so that **I can navigate quickly and ask grounded questions without leaving the workspace**.

---

## Context

The search showcase: Meilisearch (dev + prod, via Docker compose) accessed through `@strav/search`'s driver abstraction so the controller never imports the Meili SDK directly. The Ask-the-KB agent is restricted to a single output tool, `cite_and_answer({ paragraph_ids[], answer_md })` — the agent literally cannot return ungrounded text. Embeddings are computed by slice 007's job; for v1's first ship, this slice can also run an inline backfill if no `embedding` rows exist yet.

Links:

- Discovery — `G3`, `G8`, `P2`.
- Design — `C3`, `C7`, `R2`.
- Tech Spec: [`./005-search-cmdk-and-ask-the-kb.tech.md`](./005-search-cmdk-and-ask-the-kb.tech.md).
- ADRs: [ADR-0004](../adr/0004-search-meilisearch.md), [ADR-0005](../adr/0005-ai-anthropic-via-strav-brain.md).
- Depends on: 004.

---

## BDD Scenarios

```gherkin
Scenario 1: ⌘K returns matching docs under 150ms p95
  Given 250 indexed docs in the workspace
  When the user submits the query "deploy" via the palette
  Then the response contains at most 8 hits ranked by relevance
    And p95 over 100 sequential queries is < 150ms

Scenario 2: Search results are workspace-scoped
  Given workspace A has indexed docs containing "deploy"
    And workspace B (with disjoint members) has different indexed docs also containing "deploy"
  When user-A (a member of workspace A only) submits the query "deploy" via the palette
  Then every hit belongs to workspace A
    And no hit from workspace B appears, regardless of relevance score

Scenario 3: Ask the KB cites paragraph sources
  Given an indexed corpus including a paragraph about "canary deploys"
  When the user asks "what's a canary deploy?"
  Then the response is a JSON envelope with paragraph_ids[] and answer_md
    And every paragraph_id resolves to a real revision paragraph in this workspace
    And the answer_md is non-empty

Scenario 4: Ungrounded queries refuse cleanly
  Given a query with zero retrieved paragraphs after RAG
  When the agent runs
  Then the response is { paragraph_ids: [], answer_md: "", reason: "no_grounding" }
    And the UI surfaces a "no answer found in this workspace" message
```

---

## Definition of Done

- [ ] `@strav/search` configured in `config/search.ts`; default driver is `meili`. `MUSAGETE_SEARCH_DRIVER` env var is wired so future deployments can swap, but only Meilisearch is supported in v1.
- [ ] `compose.yaml` ships a Meilisearch service for local dev.
- [ ] `Doc` model carries the `searchable()` mixin; reindex on revision publish.
- [ ] `@strav/rag` paragraph index over the `embedding` table; chunker handles paragraphs > 800 tokens.
- [ ] Ask-the-KB agent's tool allowlist is exactly `[retrieve, cite_and_answer]`.
- [ ] CmdKPalette and AskKBDrawer islands mount in the app shell template.
- [ ] BDD scenarios green; latency assertion runs in CI on a 250-doc fixture.
- [ ] **Smoke-check (browser):** a human runs `bun run dev`, signs in, presses ⌘K, queries a known-indexed term, and confirms hits ranked by relevance. Then opens the Ask-the-KB drawer, asks a grounded question, and confirms the answer cites paragraph IDs that resolve to real revision paragraphs. Asks an off-topic question and confirms the "no answer found in this workspace" UI surfaces. Recorded under "Smoke-check" in this slice's Integrate-T1 entry per AGON.
