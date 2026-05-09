```yaml
slice_id:        007
status:          drafted
owner_turn:
resource_type:   Event
tenancy:         tenant
runtime:         job
strav_packages:  [@strav/queue, @strav/brain, @strav/rag, @strav/database]
```

---

## Story

As an **author**
I want to **see AI-suggested tags and related-doc links a few seconds after I save a doc**
so that **discoverability improves without me having to remember to tag things, but I retain editorial control over what is applied**.

---

## Context

The save handler enqueues a job. The job computes paragraph embeddings (the same ones slice 005 retrieves over), runs a `tagger` agent against the new revision, and writes `tag_suggestion` rows the author can apply or dismiss. Crucially, suggestions are never auto-applied — `G6` is "surface, not write".

Links:

- Discovery — `G6`, `P2`.
- Design — `C6`, `R2`.
- Tech Spec: [`./007-auto-tagging-and-suggested-links.tech.md`](./007-auto-tagging-and-suggested-links.tech.md).
- ADRs: [ADR-0005](../adr/0005-ai-anthropic-via-strav-brain.md).
- Depends on: 005.

---

## BDD Scenarios

```gherkin
Scenario 1: Save enqueues an embedding + tagging job
  Given a doc with current revision r10
  When the user saves a published revision r11
  Then a job is enqueued in @strav/queue with payload { revision_id: r11_id }
    And the job dispatch is < 30s p95 from save

Scenario 2: Job computes embeddings for new paragraphs only
  Given r10 had 12 paragraphs with embedding rows, r11 changes 3 paragraphs
  When the job runs
  Then exactly 3 new embedding rows are created for r11
    And the unchanged 9 embedding rows are reused from r10 by content_hash

Scenario 3: Tagger proposes tags via tag_suggestion
  Given a workspace tag pool [deploy, runbook, postgres, security]
  When the job runs against a revision about Postgres tuning
  Then tag_suggestion rows exist with tag_id ∈ pool, score > threshold
    And no doc_tag row is auto-created

Scenario 4: Suggested links surface to the author
  Given the embedding index includes 5 docs cosine-similar to r11 above 0.7
  When the author opens the doc
  Then up to 5 "Suggested links" appear in the byline area
    And clicking "Add" creates a doc_tag row or stores the link in a maintained suggestions box

Scenario 5: Author dismisses a suggestion
  Given a tag_suggestion row
  When the author clicks "Dismiss"
  Then the row's status becomes "dismissed"
    And the same tag is not re-suggested for the next 30 days on this doc
```

---

## Definition of Done

- [ ] `tag_suggestion` table created with status enum (proposed/applied/dismissed).
- [ ] `embed_revision` job computes embedding rows; reuses by content_hash.
- [ ] `tagger` agent declares tool allowlist `[propose_tags]` (no free-form text).
- [ ] Suggestions UI appears in the doc byline (non-intrusive).
- [ ] BDD scenarios all green.
- [ ] **Smoke-check (browser):** a human runs `bun run dev` (with `bun strav queue:work` running in a second terminal so the embed_revision job actually fires), signs in, saves a doc, waits ≤ 30 seconds, reopens the doc, and confirms the byline area shows tag suggestions + suggested links from the workspace's other docs. Applies one suggestion and confirms a `doc_tag` row appears; dismisses another and confirms it disappears from the suggestion list. Recorded under "Smoke-check" in this slice's Integrate-T1 entry per AGON.
