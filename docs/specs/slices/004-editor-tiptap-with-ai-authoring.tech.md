```
slice_id:      004-editor-tiptap-with-ai-authoring
status:        Draft
date:          2026-05-09
signed by:
references:
  slice:       ./004-editor-tiptap-with-ai-authoring.md
  design:      ../10-design.md
  adrs:
    - ../adr/0006-editor-tiptap-vue-binding.md
    - ../adr/0005-ai-anthropic-via-strav-brain.md
    - ../adr/0007-versioning-immutable-revisions.md
  adapter:     ../adapters/strav.md
```

---

## Interface contract

- `GET /d/:slug/edit` — returns the edit view (mounts the Editor island with the current revision content).
- `POST /d/:slug/save` — body `{ content: string, status: "draft" | "published", message?: string }` → creates a new revision; returns `{ revision_id }`.
- `POST /ai/authoring/rewrite` — body `{ doc_id, selection: string, instruction: string }` → streams chunks `{ delta: string }` and a final `{ done: true, ai_call_id }`.
- `POST /ai/authoring/summarize`, `POST /ai/authoring/outline`, `POST /ai/authoring/tone` — same envelope; per-command tool.
- *Errors:* 400 invalid input; 404 RLS-denied or unknown; 502 provider error (sanitized).

## Data model

| Resource    | Boundary | Notes |
|-------------|----------|-------|
| `revisions` | tenant   | adds `message` text and `status` enum(draft/published); existing FK to `docs` |
| `ai_calls`  | tenant   | id, workspace_id, user_id, agent, tool, input_hash, output_tokens, success, error_class, created_at |

## Policy & invariants

- **Authz:** save and AI commands require role ≥ `editor`. Tenancy enforced per Design `V4`.
- **Validation:** content is UTF-8 markdown ≤ 1 MB; selection ≤ 8 KB; instruction ≤ 1 KB.
- **Domain:**
  - Storage format is markdown (Design `V5`); the round-trip is asserted by tests over the fixture corpus.
  - Save with `status="published"` updates `docs.current_revision_id`; with `status="draft"` does not.
  - Rate limit: ≤ 30 AI authoring calls per user per minute.
- **Cross-cutting:** Design `V7` — every AI call writes `ai_calls` (workspace_id, user_id, agent, tool, input_hash, output token count); raw prompt text never appears in production logs. Provider error messages are never echoed to the client (only an error class).

## NFR targets

- Save p95 < 250ms (excluding embedding job which is async).
- Authoring `/rewrite` first-token p95 < 1.5s; full-response p95 < 6s.

## Dependencies

- Upstream: 003.
- Framework: `@strav/view` (template), `@strav/http`, `@strav/database`, `@strav/brain`.
- Third-party: TipTap; CodeMirror 6 (lazy); Anthropic API.

## Observability

- Logs: `editor.save { revision_id, status }`, `ai.authoring.invoke { agent, tool, success }`.
- Metrics: `editor_save_total`, `ai_authoring_duration_seconds{agent}`.

## Test strategy

- BDD scenarios → tests under `tests/editor/`.
- Round-trip property test under `tests/editor/markdown_roundtrip.test.ts` over `tests/fixtures/markdown/`.
- Provider transport mocked at `@strav/brain` boundary.

## Open questions

- [ ] Streaming transport: chunked HTTP response vs. fetch-based SSE? Decide before signing.

## Signature
```
Signed by:
Date:
```

## Amendment log
