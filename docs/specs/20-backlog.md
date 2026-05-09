# Backlog — musagete-kb

Ordering rule: foundation slices first (auth, tenancy, reader); interactive
surfaces (editor, search, AI, review) in the order they enable the next; AI
auto-tagging last because it depends on revisions, embeddings, and the queue.

Last re-order: 2026-05-09

---

## Ordered slices

| # | ID  | Title                                                          | Status   | Depends on | Notes |
|---|-----|----------------------------------------------------------------|----------|------------|-------|
| 1 | [001](./slices/001-auth-magic-link-and-oauth.md) | Auth — magic link + Google/GitHub OAuth + TOTP            | shipped     | —       | 9/9 BDD scenarios green; commit [`1bf1915`](https://github.com/stravigor/musagete/commit/1bf1915); see [log](./30-log.md#slice-001--auth-magic-link--googlegithub-oauth--totp). |
| 2 | [002](./slices/002-workspace-and-space-bootstrap.md) | Workspace + Space bootstrap (with templates and defaults) | drafted  | 001        | Multi-tenant RLS via `@strav/database`. Six space templates. |
| 3 | [003](./slices/003-reader-editorial-layout.md) | Reader — editorial layout, light/dark, density, accent     | drafted  | 002        | No-JS read path; tokens per ADR-0003; `@strav/view`. **Inherits from slice 001:** owns `resources/css/tokens.css` and the auth `.strav` view (deferred per slice 001 Tech Spec amendment 2026-05-09). |
| 4 | [004](./slices/004-editor-tiptap-with-ai-authoring.md) | Editor — TipTap Vue island + AI authoring slash commands  | drafted  | 003        | Markdown round-trip; `@strav/brain` tools per command. |
| 5 | [005](./slices/005-search-cmdk-and-ask-the-kb.md) | Search — ⌘K palette + Ask the KB drawer                    | drafted  | 004        | `@strav/search` driver swap; `@strav/rag` paragraph index. |
| 6 | [006](./slices/006-pr-review-with-ai-diff-explainer.md) | PR review — propose change, threads, AI summary, suggested reviewers | drafted | 004 | `@strav/signal` for thread updates; `@strav/brain` review agent. |
| 7 | [007](./slices/007-auto-tagging-and-suggested-links.md) | Auto-tagging + suggested links on save                    | drafted  | 005        | `@strav/queue` background job; tagger agent over embeddings. |

---

## Candidate patterns

- **AI tool-restricted agent** — noticed in slice 005's "Ask the KB" agent. Re-appears if slice 006's review-summarizer also restricts output to a single citation tool. Promote to `patterns/ai-tool-restricted-agent.md` after the second instance.
- **Vue island with server-streamed AI tool calls** — noticed in slice 004's slash commands. Re-appears in slice 006's review summary panel. Promote after the second instance.
- **RLS-aware service** — noticed in slice 002. Re-appears whenever a new tenant table is added. Promote after the second instance.

---

## Deferred / rejected

- **People & Access admin (members table, invites, groups, roles, audit log)** — Discovery non-goal for v1; deferred to v2.
- **Community / OSS landing page** — Discovery non-goal for v1; not a Strav-capability showcase.
- **Public spaces with sitemap and robots policy** — Discovery non-goal for v1.
- **Domain-capture auto-provisioning** — Discovery non-goal; no Strav primitive yet.
- **SAML and SCIM** — `P5`, ADR-0002 rejects.
- **GitLab OAuth** — `@strav/social` does not support it in v1; ADR-0002.
- **Native mobile apps** — Discovery non-goal.
- **Excalidraw embed** — Discovery non-goal; Mermaid in code fences is enough.
- **Real-time co-editing (collaborative cursors in the editor)** — Discovery non-goal; presence on PR threads only.

---

## Re-ordering history

- 2026-05-09 — initial order. Foundation-first heuristic; AI features sequenced by data dependency (search → tagging requires the index). Authored at Discovery + Design draft time.
- 2026-05-09 — slice 001 shipped (Integrate-T1). Slice 003's row gained an inheritance note: it now owns `resources/css/tokens.css` and the auth `.strav` view (deferred from slice 001 per Tech Spec amendment 2026-05-09).
