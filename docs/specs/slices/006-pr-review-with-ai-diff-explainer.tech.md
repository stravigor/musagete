```
slice_id:      006-pr-review-with-ai-diff-explainer
status:        Draft
date:          2026-05-09
signed by:
references:
  slice:       ./006-pr-review-with-ai-diff-explainer.md
  design:      ../10-design.md
  adrs:
    - ../adr/0007-versioning-immutable-revisions.md
    - ../adr/0005-ai-anthropic-via-strav-brain.md
  adapter:     ../adapters/strav.md
```

---

## Interface contract

- `POST /d/:slug/changes` — body `{ source_revision_id }` → creates a Change open against the doc's current revision as base.
- `GET /d/:slug/review/:change_id` — returns the review page (mounts ReviewPanel island).
- `POST /changes/:change_id/threads` — body `{ anchor: { paragraph_idx, char_range }, text }` → creates a Thread + first Message.
- `POST /threads/:thread_id/messages` — body `{ text }` → adds a Message; emits to `@strav/signal` channel.
- `POST /changes/:change_id/merge` — admin or maintainer; advances `doc.current_revision_id` to source.
- `POST /ai/review/summarize` — body `{ change_id }` → JSON `{ summary_md, paragraph_indices: number[] }`.
- *Errors:* 403 role insufficient; 404 RLS-denied; 409 merge against stale base.

## Data model

| Resource           | Boundary | Notes |
|--------------------|----------|-------|
| `change`           | tenant   | id, workspace_id, doc_id, source_revision_id, base_revision_id, author_id, status enum(open/approved/merged/closed), created_at, merged_at |
| `thread`           | tenant   | id, change_id, anchor jsonb (paragraph_idx + char range), author_id, resolved_at |
| `message`          | tenant   | id, thread_id, author_id, text, created_at |
| `change_reviewer`  | tenant   | (change_id, user_id, source enum(maintainer/embedding/manual)) |

## Policy & invariants

- **Authz:** propose change ≥ `editor`; merge ≥ `admin` or doc maintainer; comment ≥ `reader` if `space_defaults.allow_comments`. Tenancy enforced per Design `V4`.
- **Validation:** anchor.paragraph_idx within source revision; text ≤ 5000 chars.
- **Domain:**
  - A Change cannot be merged if its base ≠ doc's current revision (409).
  - The review-summarizer agent's `summarize_diff` tool takes paragraph deltas and returns the structured envelope; no free-form output.
  - Suggested reviewers union = maintainers ∪ top-3 by max(cosine similarity) of diff-paragraph embeddings vs. authored-paragraph embeddings.
- **Cross-cutting:** Design `V7` — every AI summarizer call writes an `ai_call` row.

## NFR targets

- Review page paint p95 < 400ms (without summary).
- Summary first-token p95 < 2s, full p95 < 6s.
- Thread message broadcast p95 < 500ms via `@strav/signal`.

## Dependencies

- Upstream: 004 (revision rows, `ai_call` table), 005 (`embedding` table).
- Framework: `@strav/database`, `@strav/http`, `@strav/signal`, `@strav/brain`, `@strav/rag`.
- Third-party: `diff-match-patch` for word-level diff.

## Observability

- Logs: `change.created`, `change.merged`, `thread.message`, `ai.review.summarize`.
- Metrics: `change_open_total`, `change_merge_latency_seconds`, `ai_review_summary_seconds`, `signal_broadcast_latency_seconds`.

## Test strategy

- Per-scenario tests under `tests/review/`.
- Signal broadcast scenario uses two `@strav/testing` ws clients in the same test.

## Open questions

- [ ] Suggested-reviewers cold-start (no embeddings yet) — fall back to maintainers only? Decide before signing.

## Signature
```
Signed by:
Date:
```

## Amendment log
