```
slice_id:      005-search-cmdk-and-ask-the-kb
status:        Draft
date:          2026-05-09
signed by:
references:
  slice:       ./005-search-cmdk-and-ask-the-kb.md
  design:      ../10-design.md
  adrs:
    - ../adr/0004-search-meilisearch.md
    - ../adr/0005-ai-anthropic-via-strav-brain.md
  adapter:     ../adapters/strav.md
```

---

## Interface contract

- `GET /search?q=<string>&limit=<n>` — returns `{ hits: [{ doc_id, title, snippet, score }] }`; default limit 8, max 20.
- `POST /ai/ask` — body `{ question: string }` → JSON `{ paragraph_ids: number[], answer_md: string, reason?: "no_grounding" }`. Streaming optional; not required for v1.
- *Errors:* 400 if q empty; 429 on rate limit (per-user, per-workspace).

## Data model

| Resource           | Boundary | Notes |
|--------------------|----------|-------|
| `embeddings`       | tenant   | id, workspace_id, doc_id, revision_id, paragraph_idx, vector vector(1536), content_hash; unique(revision_id, paragraph_idx). Dimension matches `text-embedding-3-small` per ADR-0005. |
| `search_documents` | tenant   | denormalized projection for the search backend (mirrors title, body, tags, updated_at, slug); also indexed in Meilisearch (prod) |

## Policy & invariants

- **Authz:** workspace member ≥ `reader`. Tenancy enforced per Design `V4`.
- **Validation:** query length ≤ 256; question length ≤ 1024.
- **Domain:**
  - Hits are scoped to the current `workspace_id` via RLS; the search backend is also workspace-partitioned.
  - The Ask-the-KB agent must call `cite_and_answer` exactly once; if it returns without that call, the response is `{ paragraph_ids: [], answer_md: "", reason: "no_grounding" }`.
- **Cross-cutting:** Design `V7` — every Ask call writes `ai_calls`; the agent's input_hash is the SHA-256 of `(workspace_id, question)`.

## NFR targets

- Search p95 < 150ms over 250 docs (BDD Scenario 1).
- Ask first-token p95 < 2s, full p95 < 8s.

## Dependencies

- Upstream: 004 (revisions exist; `ai_calls` table exists).
- Framework: `@strav/search`, `@strav/rag`, `@strav/brain`.
- Third-party: Meilisearch (dev + prod, run via Docker compose), pgvector (dev + prod), OpenAI Embeddings API (`text-embedding-3-small`).

## Observability

- Logs: `search.query { driver, ms, hits }`, `ai.ask { workspace_id, paragraphs_used, answer_tokens, success }`.
- Metrics: `search_latency_seconds{driver}`, `ai_ask_first_token_seconds`, `ai_ask_total_seconds`.

## Test strategy

- Tests run against Meilisearch via the dev Docker compose service; CI starts the same container.
- Workspace-scoping test (Scenario 2) seeds two disjoint workspaces and asserts strict isolation in the hit list — at the search backend, not just at the controller.
- Ungrounded test: seed a workspace with embeddings for unrelated topics, query something off-topic, assert `reason: "no_grounding"`.

## Open questions

*(None at signing — embedding model and search-driver questions resolved in the Discovery.)*

## Signature
```
Signed by:
Date:
```

## Amendment log
