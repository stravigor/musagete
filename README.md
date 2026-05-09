# Musagete

> An editorial, AI-augmented open-source knowledge base, rebuilt on the [Strav](https://strav.dev) framework as the canonical reference application — exercising the full Strav surface (schema/migration pipeline, Vue islands, search drivers, brain/RAG agents, signal channels, OAuth/magic-link/TOTP auth) end-to-end.

Status: **drafted spec**, not yet implemented. The spec under [`docs/specs/`](./docs/specs/) is the binding contract for what gets built.

---

## What this is

Musagete replaces the traditional dev-team wiki (Confluence, MediaWiki, Notion-as-wiki) with something that reads like a finished publication. The Reference is [Outline](https://github.com/outline/outline); Musagete deliberately diverges from it on six points (see [`docs/specs/00-discovery.md`](./docs/specs/00-discovery.md) § Reference shortcomings).

Core jobs (all in v1):

1. **Read** — editorial typography, light/dark, density, accent presets; no JavaScript required for the read path.
2. **Edit** — TipTap Vue island with markdown round-trip and AI authoring slash commands (`/rewrite`, `/summarize`, `/outline`, `/tone`).
3. **Review** — PR-style proposed changes with side-by-side word diff, threaded comments, an AI diff summary, and suggested reviewers.
4. **Search** — ⌘K palette + grounded "Ask the KB" drawer that cites paragraph sources and refuses ungrounded generation.
5. **Discover** — auto-tagging and suggested related-doc links computed in the background after every save.

The full Discovery (Showcase Subject, Reference, goals, shortcomings, non-goals) is in [`docs/specs/00-discovery.md`](./docs/specs/00-discovery.md).

---

## What this showcases

This project is a [Reference-driven AGON Showcase](https://github.com/strav-dev/method) — its purpose is to exercise the [Strav framework](https://strav.dev) under realistic load. The Strav packages this codebase exercises in v1:

| Package           | What it powers                                                  |
|-------------------|-----------------------------------------------------------------|
| `@strav/kernel` + `@strav/cli` | Schema → migration → model → controller → route generators |
| `@strav/http`     | Sessions, route groups, mailer for magic links                   |
| `@strav/view`     | Server-rendered `.strav` templates with selective Vue island hydration |
| `@strav/database` | PostgreSQL ORM + multi-tenant Row-Level Security                 |
| `@strav/auth`     | Magic links, TOTP 2FA, signed opaque tokens                       |
| `@strav/social`   | Google + GitHub OAuth                                             |
| `@strav/brain`    | AI agents and tool use (Anthropic primary; provider-swappable)   |
| `@strav/rag`      | pgvector-backed retrieval; paragraph chunking                    |
| `@strav/search`   | Meilisearch (dev + prod) behind a driver abstraction              |
| `@strav/signal`   | WebSocket broadcasts for PR threads and presence                  |
| `@strav/queue`    | Background jobs (embedding, tagging)                              |

Auth in Musagete is Strav-native only: **magic link + Google OAuth + GitHub OAuth + TOTP 2FA**. SAML, SCIM, GitLab OAuth, and passkeys are explicit non-goals — see [ADR-0002](./docs/specs/adr/0002-auth-strategy-strav-native-only.md).

---

## Tech stack

- **Runtime:** [Bun](https://bun.sh) ≥ 1.3.9
- **Database:** PostgreSQL ≥ 18 with the [`pgvector`](https://github.com/pgvector/pgvector) extension
- **Frontend:** Vue 3 islands inside `.strav` server-rendered templates (no SPA)
- **Editor:** [TipTap](https://tiptap.dev) headless + a markdown serializer
- **Search:** [Meilisearch](https://www.meilisearch.com) via `@strav/search` in dev and prod (Docker compose ships the dev container). The driver abstraction is preserved so a future deploy can swap to SQLite FTS5, Postgres FTS, Typesense, or Algolia with one config line.
- **AI:** Anthropic Claude via `@strav/brain` (provider-swappable per deploy); embeddings via OpenAI `text-embedding-3-small` (1536-d)
- **Styling:** binding design tokens defined in [ADR-0003](./docs/specs/adr/0003-styling-tokens-css-modules.md), loaded as CSS custom properties in an `@layer tokens` block; **CSS Modules** by default, **vanilla-extract** as opt-in. **No Tailwind. No UI kit.**

---

## Quick start

> The implementation is being built per the slices in [`docs/specs/20-backlog.md`](./docs/specs/20-backlog.md). The commands below describe the intended developer flow once slice 002 has shipped.

```sh
# 1. Install dependencies (Bun)
bun install

# 2. Configure environment
cp .env.example .env
# Fill in: DATABASE_URL, MEILI_MASTER_KEY, MAGIC_LINK_FROM,
# GOOGLE_OAUTH_*, GITHUB_OAUTH_*, ANTHROPIC_API_KEY, OPENAI_API_KEY

# 3. Start Meilisearch via Docker compose (Postgres assumed already running)
docker compose up -d meili

# 4. Apply migrations (creates pgvector extension and tables) and seed
bun strav migrate
bun strav seed

# 5. Run the dev server with hot reload
bun run dev
# → http://localhost:3000
```

---

## The spec

The spec is the source of truth. Read it in this order:

1. [`docs/specs/00-discovery.md`](./docs/specs/00-discovery.md) — what the project is (Showcase Subject + Reference) and what success looks like.
2. [`docs/specs/10-design.md`](./docs/specs/10-design.md) — value map, scope, NFRs, architecture sketch, schema sketch.
3. [`docs/specs/adr/`](./docs/specs/adr/) — the seven Architectural Decision Records:
   - [0001 — Architecture: Strav islands over decoupled SPA](./docs/specs/adr/0001-architecture-strav-islands-over-spa.md)
   - [0002 — Auth: Strav-native only](./docs/specs/adr/0002-auth-strategy-strav-native-only.md)
   - [0003 — Styling: design tokens via CSS @layer + CSS Modules](./docs/specs/adr/0003-styling-tokens-css-modules.md)
   - [0004 — Search: Meilisearch via `@strav/search` (dev + prod)](./docs/specs/adr/0004-search-meilisearch.md)
   - [0005 — AI: `@strav/brain` with Anthropic primary](./docs/specs/adr/0005-ai-anthropic-via-strav-brain.md)
   - [0006 — Editor: TipTap headless + markdown serializer](./docs/specs/adr/0006-editor-tiptap-vue-binding.md)
   - [0007 — Versioning: immutable revisions](./docs/specs/adr/0007-versioning-immutable-revisions.md)
4. [`docs/specs/20-backlog.md`](./docs/specs/20-backlog.md) — the ordered slice list.
5. [`docs/specs/slices/`](./docs/specs/slices/) — one user-facing slice + one machine-facing tech spec per capability:
   - [001 — Auth (magic link + OAuth + TOTP)](./docs/specs/slices/001-auth-magic-link-and-oauth.md) *(deeply specified — canonical example)*
   - [002 — Workspace + Space bootstrap](./docs/specs/slices/002-workspace-and-space-bootstrap.md)
   - [003 — Reader (editorial layout)](./docs/specs/slices/003-reader-editorial-layout.md)
   - [004 — Editor (TipTap + AI authoring)](./docs/specs/slices/004-editor-tiptap-with-ai-authoring.md)
   - [005 — Search (⌘K + Ask the KB)](./docs/specs/slices/005-search-cmdk-and-ask-the-kb.md)
   - [006 — PR review (AI diff explainer)](./docs/specs/slices/006-pr-review-with-ai-diff-explainer.md)
   - [007 — Auto-tagging + suggested links](./docs/specs/slices/007-auto-tagging-and-suggested-links.md)
6. [`docs/specs/adapters/strav.md`](./docs/specs/adapters/strav.md) — concrete pipeline mapping (CLI commands, file paths, checkpoint placement).
7. [`docs/specs/30-log.md`](./docs/specs/30-log.md) — Integrate-phase log, populated as slices ship.

---

## What's explicitly **not** in v1

- SAML, SCIM, GitLab OAuth, passkeys — Strav doesn't ship the primitives; see [ADR-0002](./docs/specs/adr/0002-auth-strategy-strav-native-only.md).
- People & Access admin (members table, invites, groups, roles, audit log) — deferred to v2.
- Community / OSS landing page — deferred to v2.
- Public-space sharing with sitemap and robots policy — deferred to v2.
- Domain-capture auto-provisioning — no Strav primitive yet.
- Native mobile apps, multi-region deployment, real-time collaborative cursors, Excalidraw embeds.

The full non-goal list with reasons is in [`docs/specs/00-discovery.md`](./docs/specs/00-discovery.md) § Non-goals.

---

## License & contributing

License: TBD at v1 tag. Contributions are welcomed once the Discovery and Design are signed; until then the spec is in active draft and PRs against `docs/specs/` should go through the AGON [Amendment](./docs/specs/00-discovery.md#post-signature-changes) flow rather than free-form edits.

This project follows the [Strav AGON method](https://strav.dev/method) for specification, planning, and build. Every decision worth more than a day to reverse lives as an ADR; every shipped slice has an Integrate entry in [`docs/specs/30-log.md`](./docs/specs/30-log.md).
