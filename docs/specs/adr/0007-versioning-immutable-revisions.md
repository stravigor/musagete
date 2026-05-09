# ADR-0007 — Versioning: immutable revisions with `docs.current_revision_id` pointer

Status:       Proposed
Relationship:
Date:         2026-05-09
Decided by:

---

## Context

`P1` makes change first-class: readers should see what changed, not just what is. `R1` answers it with PR-style review and side-by-side word diff. The data model that supports this is git-like: a `docs` row is a stable identity; content lives in immutable `revisions`; the document's "current" content is a pointer to the latest published revision; PR-style proposals are unmerged revisions awaiting review.

The decision now is whether revisions are immutable, how the pointer works, and how diffs are computed.

---

## Decision

Revisions are **immutable**. Every save creates a new `revisions` row; `docs.current_revision_id` is a foreign key to the latest *published* revision; PR-style "changes" reference a `source_revision_id` (the new content) and a `base_revision_id` (the revision they branched from). On merge, `docs.current_revision_id` updates to `source_revision_id`. Diffs are computed at read time via `diff-match-patch` for word-level granularity; nothing about the diff is stored.

Drafts are also revisions but with `status = 'draft'` and are not eligible to be a `current_revision_id`.

---

## Tradeoffs

**What we gain:**
- A clean, git-like history that anyone can reason about.
- Diffs are reproducible from the data; no diff cache to invalidate.
- The model maps naturally onto PR-style review (`G5`, `R1`).
- Embeddings in `embeddings` are keyed by `revision_id` — they never go stale because revisions never mutate.

**What we give up:**
- Storage grows with edit volume; we accept it (markdown is small; v1 caps are documented).
- Reverting "the document to last week" requires a new revision pointing back — never a destructive edit; this is by design but unfamiliar to wiki users.

**Why the exchange is worth it:**
Immutability is a property the slice tests can assert; it's the foundation that makes the AI tagging and review-summarization features safe (they reference revisions by id).

---

## Alternatives considered

### Option A — Mutable `docs.content` with a `revision_history` audit table
- **Pros:** Familiar wiki model; storage is smaller.
- **Cons:** Diffs depend on the audit table being correct; concurrent edits and "last writer wins" become subtle; embeddings would need invalidation.
- **Why rejected:** trades simple read-time correctness for write-time complexity.

### Option B — Event-sourced edits (CRDT-style)
- **Pros:** Real-time collaboration becomes natural.
- **Cons:** Wildly out of scope; co-editing is a non-goal.
- **Why rejected:** non-goal; collapses the model.

### Option C — Immutable revisions with `current_revision_id` pointer (chosen)
- **Pros:** Reproducible diffs; safe AI keying; clean PR model.
- **Cons:** Storage grows linearly with edits.
- **Chosen because:** matches `G5`, `R1`, and the AI grounding invariants.

---

## Consequences

- **Positive:** PR-style review is straightforward (slice 006); embeddings are keyed by `revision_id` and never go stale (`G6`).
- **Negative:** Backups grow over time; we document a retention/compression strategy in the README post-v1.
- **Neutral / follow-ups:** A small "compact revisions" job may emerge in v2; not in v1.

---

## Verification hooks

- [ ] No UPDATE statement on `revisions.content` anywhere in `app/`.
- [ ] `docs.current_revision_id` foreign keys to `revisions.id` with `ON DELETE RESTRICT`.
- [ ] Tests verify that two reads of the same `(doc_id, revision_id)` always return the same content.

---

## Signature

```
Decided by:
Date:
```

---

## Amendment log

*(Append-only.)*
