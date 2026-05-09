# ADR-0005 — AI: `@strav/brain` with Anthropic primary; `@strav/rag` over pgvector

Status:       Accepted
Relationship:
Date:         2026-05-09
Decided by:   Liva

---

## Context

Discovery commits to **high AI integration** across four surfaces: grounded "Ask the KB" (`G3`), in-editor authoring assistance (`G4`), PR-review summarization plus suggested reviewers (`G5`), and auto-tagging plus suggested links on save (`G6`). `@strav/brain` is multi-provider (Anthropic, OpenAI, Gemini, DeepSeek), provides agent + tool primitives, and serializes thread state. `@strav/rag` provides vector retrieval; `pgvector` is the native Postgres extension.

The decision now is which provider to default to, where embeddings live, and how AI agents are constrained so generation is grounded.

---

## Decision

Default AI provider is **Anthropic Claude** (current generation; pinned in `config/ai.ts`); the provider is configurable per deployment via `MUSAGETE_AI_PROVIDER` and `MUSAGETE_AI_MODEL`. Embeddings live in **pgvector** (`embeddings` table keyed by `(revision_id, paragraph_idx)`); chunking is **paragraph-level**, with a fallback split for paragraphs over 800 tokens.

The **embedding model is `text-embedding-3-small` (1536-dimensional)**, pinned in `config/ai.ts`; the `embeddings.vector` column is therefore typed `vector(1536)`. The embedding model is also configurable via `MUSAGETE_EMBED_MODEL`, but a model swap is a corpus-rewrite event (every existing embedding must be recomputed) and is documented as such.

`@strav/brain` agents are configured with an explicit tool registry; each agent declares its allowed tools. The "Ask the KB" agent is restricted to a single output tool, `cite_and_answer({ paragraph_ids: number[], answer_md: string })`, plus the retrieval tool. Free-form text replies are not part of its surface — answers cannot be returned without paragraph_ids.

---

## Tradeoffs

**What we gain:**
- A single provider for v1 keeps prompts, latency budgets, and cost predictable.
- Claude's grounding behavior is well-understood and reliable for citation-only output.
- pgvector keeps embeddings in the existing Postgres database; no extra service for v1.
- Tool-restricted agents make grounding mechanically enforced (`G3`'s "no ungrounded generation").

**What we give up:**
- We don't multi-provider on day one; deployments are encouraged to swap via env vars but the agent prompts may need light tuning per provider.
- pgvector at very high scale would be replaced by a dedicated vector store; we accept v1 limits.

**Why the exchange is worth it:**
Grounding by tool restriction is a strong invariant; multi-provider at launch would weaken that invariant per-provider tuning. The bound on usage is documented and reasonable.

---

## Alternatives considered

### Option A — OpenAI primary
- **Pros:** Larger ecosystem of pre-built prompts.
- **Cons:** No clear technical advantage for our use cases; tool-restricted output works on either.
- **Why rejected:** lateral move; Anthropic's tool-use story is at least as strong.

### Option B — Multi-provider with per-feature pinning (Anthropic for review, OpenAI for tagging, etc.)
- **Pros:** "Right tool for each job."
- **Cons:** Triples the test surface; observability and cost tracking fragment.
- **Why rejected:** premature optimization for a vertical-slice v1.

### Option C — Anthropic primary + tool-restricted agents over pgvector (chosen)
- **Pros:** Single provider; mechanical grounding; native Postgres for vectors.
- **Cons:** Capacity ceiling tied to Postgres + Anthropic.
- **Chosen because:** simplest configuration that satisfies `G3` mechanically.

---

## Consequences

- **Positive:** Slice 005 (Ask the KB) and slice 006 (review assist) can share a single agent factory under `app/services/ai/agents/`; tools live under `app/services/ai/tools/`.
- **Negative:** Replacing pgvector with a dedicated store is a future migration; document the table shape in the slice Tech Specs so the migration is local.
- **Neutral / follow-ups:** Cost / token usage telemetry per agent ships in `ai_calls`; review at first-week post-ship.

---

## Verification hooks

- [ ] Every agent file under `app/services/ai/agents/` declares a static `tools` allowlist.
- [ ] The Ask-the-KB agent's allowlist contains exactly one output tool, `cite_and_answer`.
- [ ] Tests assert that an Ask-the-KB call with no retrieved paragraphs returns a structured "no answer" response (not free-form text).
- [ ] pgvector extension creation is included in the migrations.
- [ ] `embeddings.vector` is typed `vector(1536)` matching `text-embedding-3-small`.

---

## Signature

```
Decided by: Liva
Date: 2026-05-09
```

---

## Amendment log

*(Append-only.)*
