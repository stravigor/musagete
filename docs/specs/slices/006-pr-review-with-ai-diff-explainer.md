```yaml
slice_id:        006
status:          drafted
owner_turn:
resource_type:   Entity
tenancy:         tenant
runtime:         island
strav_packages:  [@strav/database, @strav/http, @strav/signal, @strav/brain, @strav/rag]
```

---

## Story

As an **editor**
I want to **propose changes to a published doc as a PR-style change with side-by-side word diff, threaded comments, an AI-generated summary, and suggested reviewers**
so that **edits are reviewable, change is first-class in the reading experience, and reviewers find the right context fast**.

---

## Context

The review surface — the load-bearing answer to `P1`. AI shows up as a diff summarizer agent and a suggested-reviewers signal, joining slice 005's grounding pattern. `@strav/signal` powers thread updates without polling.

Links:

- Discovery — `G5`, `P1`, `P2`.
- Design — `C5`, `R1`, `R2`.
- Tech Spec: [`./006-pr-review-with-ai-diff-explainer.tech.md`](./006-pr-review-with-ai-diff-explainer.tech.md).
- ADRs: [ADR-0007](../adr/0007-versioning-immutable-revisions.md), [ADR-0005](../adr/0005-ai-anthropic-via-strav-brain.md).
- Depends on: 004.

---

## BDD Scenarios

```gherkin
Scenario 1: Propose a change against a published doc
  Given a published doc at revision r10
  When an editor saves a draft revision r11 and clicks "Propose change"
  Then a Change row is created with source=r11, base=r10, status=open
    And the doc page shows a "1 change open" pill in the byline

Scenario 2: Side-by-side word-level diff renders
  Given a Change between r10 (base) and r11 (source)
  When the review page renders
  Then the response includes word-level diff annotations (added/removed segments)

Scenario 3: AI summary appears and cites the diff
  Given a Change with non-trivial textual edits
  When the review page loads
  Then an AI-generated summary appears in a side panel within first-token p95 < 2s
    And the summary references the specific paragraphs changed (by paragraph index)

Scenario 4: Suggested reviewers reflect maintainership and content
  Given the doc has maintainers [@ada, @grace]
    And the diff body is highly similar (cosine > 0.85) to embedding rows authored by @hopper
  When the review page loads
  Then the "Suggested reviewers" rail lists @ada, @grace, @hopper

Scenario 5: Adding a thread comment fires a signal to subscribers
  Given two clients viewing the same Change page
  When client A posts a comment to a thread
  Then client B receives the new comment via @strav/signal within 500ms
```

---

## Definition of Done

- [ ] `change`, `thread`, `message` tables created with FKs to `revision` and `user`.
- [ ] Word-level diff computed on demand via `diff-match-patch`; cached on `change.diff_cache_html` for the AI summarizer.
- [ ] `review-summarizer` agent ships in `app/services/ai/agents/review-summarizer.agent.ts`; tool allowlist = `[summarize_diff]`.
- [ ] Suggested reviewers computed from doc maintainership + embedding similarity to the diff.
- [ ] `@strav/signal` channel `change:<change_id>:threads` carries new-message events.
- [ ] BDD scenarios all green.
