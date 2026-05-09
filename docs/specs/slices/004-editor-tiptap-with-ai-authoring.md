```yaml
slice_id:        004
status:          drafted
owner_turn:
resource_type:   Event
tenancy:         tenant
runtime:         island
strav_packages:  [@strav/view, @strav/http, @strav/database, @strav/brain]
```

---

## Story

As an **editor**
I want to **write and save markdown in a TipTap editor with AI slash commands for rewrite, summarize, outline, and tone**
so that **I can compose a doc faster while keeping markdown as the storage format**.

---

## Context

The Editor is the first Vue island that performs a full server roundtrip with `@strav/brain`. Storage stays markdown (`V5`); the editor projects onto it via a TipTap markdown serializer. Slash commands invoke server-side agents whose output streams back into the editor selection.

Links:

- Discovery — `G4`, `P3`.
- Design — `C4`, `R3`.
- Tech Spec: [`./004-editor-tiptap-with-ai-authoring.tech.md`](./004-editor-tiptap-with-ai-authoring.tech.md).
- ADRs: [ADR-0006](../adr/0006-editor-tiptap-vue-binding.md), [ADR-0005](../adr/0005-ai-anthropic-via-strav-brain.md), [ADR-0007](../adr/0007-versioning-immutable-revisions.md).
- Depends on: 003.

---

## BDD Scenarios

```gherkin
Scenario 1: Save creates a new immutable revision
  Given an editor with content matching the current revision
  When the user types changes and clicks "Save"
  Then a new Revision row exists with parent_revision_id = the previous revision
    And doc.current_revision_id is updated to the new revision (if status="published")

Scenario 2: Markdown round-trip is lossless for the supported subset
  Given a markdown fixture from the round-trip corpus
  When the editor loads the fixture, then saves it without edits
  Then the saved content equals the original byte-for-byte (or via the canonical normalization)

Scenario 3: /rewrite slash command rewrites the selection
  Given an editor with a selected paragraph
  When the user invokes /rewrite with instruction "make this more concise"
  Then the server agent returns a rewritten paragraph
    And the editor replaces the selection with the rewrite (streamed)
    And an ai_call row is recorded with agent="authoring.rewrite", workspace_id, user_id

Scenario 4: AI command failure is surfaced, not swallowed
  Given the AI provider returns an error
  When /rewrite is invoked
  Then the editor shows an inline error toast and leaves the selection unchanged
    And the ai_call row records success=false with the error class (not the message)

Scenario 5: Save fails on cross-tenant doc id
  Given a doc id whose workspace_id ≠ the session's workspace_id
  When a save is attempted against that id
  Then the response is 404 (RLS denies the SELECT before the UPDATE)
```

---

## Definition of Done

- [ ] `resources/islands/Editor.vue` mounts TipTap headless with the supported extensions.
- [ ] Markdown serializer round-trip test runs over a ≥ 20-doc fixture corpus.
- [ ] Slash commands `/rewrite`, `/summarize`, `/outline`, `/tone` route to `POST /ai/authoring/<command>` controllers.
- [ ] Each authoring controller invokes a `@strav/brain` agent with an explicit tool allowlist.
- [ ] `ai_call` row written for each invocation.
- [ ] BDD scenarios green; round-trip property test green.
- [ ] **Smoke-check (browser):** a human runs `bun run dev`, signs in, opens a doc's edit URL, types a paragraph, clicks Save, and confirms the doc updates in the read view. Then invokes `/rewrite` on a selection and confirms the streamed rewrite replaces the selection in-editor. Recorded under "Smoke-check" in this slice's Integrate-T1 entry per AGON.
