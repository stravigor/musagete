# Backlog — musagete-kb

Ordering rule: each slice ships a **demonstrable** vertical — a capability a
human can walk in a browser after `bun run dev`. The backlog grows the
demonstrable surface monotonically: after slice N ships, every slice 1…N
remains exercisable in a single navigation flow. Capability coverage of the
Strav package matrix is a release-tag check, not a per-slice ordering
driver. (Per AGON method-feedback note `docs/notes/agon-vertical-slicing-enforcement.md`,
authored after slice 002 surfaced a layer-cake-vs-vertical-slice mismatch.)

Last re-order: 2026-05-09

---

## Ordered slices

Each row's **Demo flow** column lists the navigation steps a human walks to
exercise the slice's capability. The smoke-check DoD line in each slice
file requires this flow to be human-walked before Integrate closes.

| # | ID  | Title                                                          | Status   | Depends on | Demo flow (human walks this on `bun run dev`) | Notes |
|---|-----|----------------------------------------------------------------|----------|------------|-----------------------------------------------|-------|
| 1 | [001](./slices/001-auth-magic-link-and-oauth.md) | Auth — magic link + Google/GitHub OAuth + TOTP            | shipped     | —       | `/` → `/auth` → email + magic link → signed in. (Auth UI shipped under slice 002 Build-T2; original deferral rescinded.) | 9/9 BDD scenarios green; commit [`1bf1915`](https://github.com/stravigor/musagete/commit/1bf1915); see [log](./30-log.md#slice-001--auth-magic-link--googlegithub-oauth--totp). |
| 2 | [002](./slices/002-workspace-and-space-bootstrap.md) | Workspace + Space bootstrap (with templates and defaults) | shipped     | 001        | After sign in: `/` → `/workspaces/new` → create workspace → `/workspaces/<slug>` → `/spaces/new` → wizard → `/spaces/<space-slug>` → see seeded folder tree. | 5/5 BDD scenarios green (Scenario 4 structural; empirical sub-assertion auto-skipped under BYPASSRLS pending operator role separation); see [log](./30-log.md#slice-002--workspace--space-bootstrap). |
| 3 | [003](./slices/003-reader-editorial-layout.md) | Reader — editorial layout, light/dark, density, accent     | drafted  | 002        | After slice 002 flow: open a seeded doc URL → see editorial typography (Newsreader serif, drop cap, marginalia); toggle theme/density/accent and confirm it persists. **Plus retroactive theming of slice 002's auth view + workspace forms + wizard** once tokens.css ships. | No-JS read path; tokens per ADR-0003; `@strav/view`. **Inherits from slice 001:** owns `resources/css/tokens.css`. |
| 4 | [004](./slices/004-editor-tiptap-with-ai-authoring.md) | Editor — TipTap Vue island + AI authoring slash commands  | drafted  | 003        | After slice 003 flow: open a doc's edit URL → type → click Save → see updated read view; invoke `/rewrite` on a selection → see streamed rewrite. | Markdown round-trip; `@strav/brain` tools per command. |
| 5 | [005](./slices/005-search-cmdk-and-ask-the-kb.md) | Search — ⌘K palette + Ask the KB drawer                    | drafted  | 004        | From any signed-in page: ⌘K → query → ranked hits; open Ask drawer → ask grounded question → cited answer. | `@strav/search` driver swap; `@strav/rag` paragraph index. |
| 6 | [006](./slices/006-pr-review-with-ai-diff-explainer.md) | PR review — propose change, threads, AI summary, suggested reviewers | drafted | 004 | After slice 004 flow: edit a doc → "Propose change" → review page (diff + AI summary + suggested reviewers); add a thread comment → second tab receives it via `@strav/signal`. | `@strav/signal` for thread updates; `@strav/brain` review agent. |
| 7 | [007](./slices/007-auto-tagging-and-suggested-links.md) | Auto-tagging + suggested links on save                    | drafted  | 005        | After slice 004 + 005 flow (with `bun strav queue:work` running): save a doc → wait ≤ 30s → reopen doc → see tag suggestions + suggested links in byline; apply / dismiss. | `@strav/queue` background job; tagger agent over embeddings. |

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
- 2026-05-09 — slice 002 shipped (Integrate-T1). RLS-aware service is the first instance of that watch-listed pattern; promote after slice 004's editor-save second instance.
- 2026-05-09 — backlog re-shaped post slice-002-ship to enforce **vertical-slicing demonstrability** (per `docs/notes/agon-vertical-slicing-enforcement.md`). Each row gained a Demo flow column listing the navigation steps a human walks; each drafted slice's DoD gained a smoke-check line. Ordering rule rewritten from "foundation slices first" (layer-cake) to "demonstrable surface grows monotonically." The dependency graph (003→002, 004→003, …) is unchanged because the data dependencies haven't changed; what changed is the **gate** at slice close: a human walks the demo flow before Integrate-T1 closes, recorded under "Smoke-check" in 30-log.md.
