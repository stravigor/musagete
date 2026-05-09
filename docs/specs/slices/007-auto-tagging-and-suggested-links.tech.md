```
slice_id:      007-auto-tagging-and-suggested-links
status:        Draft
date:          2026-05-09
signed by:
references:
  slice:       ./007-auto-tagging-and-suggested-links.md
  design:      ../10-design.md
  adrs:
    - ../adr/0005-ai-anthropic-via-strav-brain.md
  adapter:     ../adapters/strav.md
```

---

## Interface contract

- *(No new public HTTP routes.)* Internal:
- Job: `embed_revision` — payload `{ revision_id }` → computes embeddings, runs tagger, writes `tag_suggestions`.
- `POST /docs/:doc_id/suggestions/:id/apply` — author or maintainer; promotes a tag suggestion to `doc_tags`.
- `POST /docs/:doc_id/suggestions/:id/dismiss` — author or maintainer; status → "dismissed".

## Data model

| Resource          | Boundary | Notes |
|-------------------|----------|-------|
| `tags`            | tenant   | id, workspace_id, name, slug; unique(workspace_id, slug) |
| `doc_tags`        | tenant   | (doc_id, tag_id, applied_by, applied_at) |
| `tag_suggestions` | tenant   | id, doc_id, revision_id, tag_id, score, status enum(proposed/applied/dismissed), created_at, decided_at |

`embeddings.content_hash` (already in slice 005) is used to dedupe paragraph embeddings between revisions.

## Policy & invariants

- **Authz:** apply/dismiss require role ≥ `editor` (author) or maintainer.
- **Validation:** score ∈ [0, 1]; only suggestions with score > threshold (configurable, default 0.5) are written.
- **Domain:**
  - The tagger agent calls `propose_tags({ candidates: [{ tag_id, score }] })` exactly once; tags must be from the workspace pool.
  - Embeddings are reused across revisions by `content_hash` to avoid re-embedding unchanged paragraphs.
  - Dismissed tags are not re-suggested for the same `(doc_id, tag_id)` for 30 days.
- **Cross-cutting:** every job execution writes an `ai_calls` row when an agent is invoked.

## NFR targets

- Job latency: p95 < 30s end-to-end from save (Discovery NFR carry-through).
- Tagger token usage capped per call; over-budget calls fail loudly.

## Dependencies

- Upstream: 005 (embeddings table + RAG infrastructure).
- Framework: `@strav/queue`, `@strav/brain`, `@strav/rag`, `@strav/database`.
- Third-party: Anthropic API.

## Observability

- Logs: `job.embed_revision { revision_id, paragraphs_new, paragraphs_reused, success }`, `ai.tagger { tag_count, top_score }`.
- Metrics: `embed_revision_duration_seconds`, `tagger_proposed_tags_total`.

## Test strategy

- Run the job inline in tests via `@strav/queue`'s in-memory driver.
- Property test: across a fixture corpus, applied + dismissed + proposed counts equal generated suggestions.

## Open questions

- [ ] Threshold default (0.5 vs. tuned per workspace) — decide before signing.

## Signature
```
Signed by:
Date:
```

## Amendment log
