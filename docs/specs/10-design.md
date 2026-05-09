```
project:       musagete-kb
status:        Signed
relationship:
date:          2026-05-09
signed by:     Liva
references:
  discovery:   ./00-discovery.md
  adrs:        ./adr/
  adapter:     ./adapters/strav.md
```

---

## Gain creators & Pain relievers

### Gain creators

- **C1** — Strav schema-first pipeline used for auth, spaces, and docs slices; each slice's Tech Spec lists the schema → migration → model → controller → route → BDD test artifacts → creates `G1, G7`.
- **C2** — `.strav` server-rendered reading template wired to `@layer tokens` CSS, hydrating zero Vue islands on the read path → creates `G2`.
- **C3** — `@strav/rag` paragraph index over revisions, joined to a `@strav/brain` agent whose only output tool is `cite_and_answer({ paragraph_ids[], answer_md })`; the agent is configured with `allowed_tools = [cite_and_answer]` so ungrounded text cannot be returned → creates `G3`.
- **C4** — TipTap Vue island exposes a slash menu whose commands (`/rewrite`, `/summarize`, `/outline`, `/tone`) call HTTP endpoints backed by `@strav/brain` agents, streaming results back into the editor → creates `G4`.
- **C5** — A "review" Vue island renders side-by-side word diff + an AI summary panel populated by a `review-summarizer` agent, plus a "suggested reviewers" chip rail derived from doc maintainership and embedding similarity to the diff → creates `G5`.
- **C6** — Save handler enqueues an `@strav/queue` job that computes embeddings for the new revision and runs a `tagger` agent over them; agent output writes to the `tag_suggestion` table surfaced to the author, never auto-applied → creates `G6`.
- **C7** — `@strav/search` driver abstraction; the ⌘K controller uses the unified API. Meilisearch is the v1 driver in dev and prod (Docker compose for the dev container); the abstraction itself is the showcase artifact → creates `G8`.

### Pain relievers

- **R1** (relieves `P1`) — Inline diff in the reader and a dedicated PR-style review surface with threaded comments make change first-class.
- **R2** (relieves `P2`) — AI woven through editor (C4), review (C5), discovery (C6), and search (C3) — not a single drawer.
- **R3** (relieves `P3`) — Markdown is the storage format on `revision.content`; TipTap projects onto it through a markdown serializer, round-trip lossless for headings, lists, code, tables, callouts, and links.
- **R4** (relieves `P4`) — Five-role permission model (owner / admin / editor / reader / guest) with per-space overrides, enforced by Postgres RLS on `workspace_id` and per-table policy functions in `@strav/database`.
- **R5** (relieves `P6`) — Token set in [ADR-0003](./adr/0003-styling-tokens-css-modules.md) wired as CSS custom properties; Newsreader serif display with `font-variation-settings: 'opsz' …` on headlines; drop caps on `.lede::first-letter`. The product's editorial opinion is delivered through tokens, not screenshots.

*Reference shortcoming **P5** is addressed by the Discovery's Non-goals (no SAML/SCIM in v1) and is intentionally absent from this map. Every other G/P from the Discovery appears here.*

---

## In scope for v1

```
Release tag:   TBD
Tagged on:
```

The capabilities v1 will deliver. Each cites at least one gain creator or pain reliever.

- **Auth surface (magic link + Google/GitHub OAuth + TOTP)** — instantiates `C1` — supports `G7`.
- **Workspace and space bootstrap with templates and per-space defaults** — instantiates `C1, R4` — supports `G1, P4`.
- **Editorial reader** (typography, light/dark, density, accent presets, drop cap, marginalia, code blocks with Mermaid) — instantiates `C2, R5` — supports `G2, P6`.
- **TipTap Vue-island editor with markdown round-trip and AI authoring slash commands** — instantiates `C4, R3` — supports `G4, P3`.
- **⌘K palette (full-text search) + Ask the KB drawer (grounded RAG)** — instantiates `C3, C7` — supports `G3, G8`.
- **PR-style review with side-by-side word diff, threaded comments, AI summary, and suggested reviewers** — instantiates `C5, R1` — supports `G5, P1`.
- **Auto-tagging and suggested links on save** — instantiates `C6` — supports `G6`.

---

## Out of scope for v1

- **SAML, SCIM, GitLab OAuth, passkeys** — Discovery non-goal; relieves nothing because Strav doesn't ship the primitives. Cited from `P5`.
- **People & Access admin (members table, invites, groups, roles, audit log)** — deferred to v2; the showcase loop is reader → edit → review → search → AI, not workspace administration.
- **Community page (stars/forks/contributors landing)** — deferred to v2; OSS marketing is not a Strav-capability showcase.
- **Public spaces with sitemap / robots policy** — deferred to v2.
- **Domain-capture auto-provisioning** — deferred; no Strav primitive yet.
- **Multi-region, native mobile, Excalidraw, real-time co-editing** — deferred; cited in Discovery non-goals.

---

## Non-functional targets

### Security posture

- **Authentication:** magic link (default for new users), Google OAuth, GitHub OAuth; TOTP 2FA optional per user. No passwords. Sessions via `@strav/http` session middleware; cookie + database-backed.
- **Tenancy isolation:** hard. Every tenant table carries `workspace_id`; Postgres RLS policies enforce no cross-workspace reads or writes via `@strav/database`. Verified by per-slice boundary tests.
- **Data at rest:** application has no opinion; deployer chooses (host-encrypted volume / Postgres-level encryption). Document this in the README.
- **Data in transit:** HTTPS only; HSTS on; secure + HTTPOnly + SameSite=Lax session cookies.
- **Secrets:** environment variables only; rotated by deployer. No secret material in logs.
- **AI safety:** prompts and tool outputs logged at INFO with PII redaction stub; AI agents may only use registered tools (`@strav/brain` tool registry); no shell or filesystem tools.

### Performance budgets

- **⌘K palette:** p95 < 150ms server roundtrip on a 250-doc corpus, both backends.
- **Ask the KB:** first-token p95 < 2s; full answer p95 < 8s for typical queries (single-paragraph answer over ≤10 cited paragraphs).
- **Reader cold paint:** p50 < 100ms server-rendered on commodity hardware (4-core, 8 GB, single-region Postgres on the same host).
- **Editor save → embedding completion:** p95 < 30s end-to-end (including queue dispatch).
- **API writes (POST/PATCH/DELETE):** p95 < 300ms excluding AI-tagged code paths.

### Scalability horizon

- **Workspaces / instance:** up to 50 small workspaces or 5 large (≤ 5000 docs) on a single Bun process + Postgres.
- **Docs / workspace:** ≤ 5000 in v1; revisit at 3000.
- **Revisions / doc:** unbounded; queries must paginate.
- **AI usage:** rate-limited per workspace; documented limits ship in default config.

### Maintainability stance

- **Code reviewability:** AGON batching applies; no file over ~300 lines without justification; one slice = one PR (or coherent PR series).
- **Documentation:** the spec is the documentation. No separate docs per package.
- **Testing:** every slice has BDD scenarios mapped to tests; full suite must be green before merge.

---

## Conventions

- **V1** — Timestamps stored as UTC `timestamptz` in Postgres; rendered in the user's timezone at display time.
- **V2** — Slugs are lowercase ASCII, dash-joined, URL-safe; reserved words listed in `config/slugs.ts`.
- **V3** — IDs are bigserial primary keys for tenant tables; uuid only when an external system requires opacity.
- **V4** — All tenant tables carry a non-null `workspace_id` with a foreign key to `workspace.id`; RLS policy is `tenant_isolation` defined in `@strav/database` config.
- **V5** — Markdown is the storage format for `revision.content`. Editor → markdown → editor must be lossless for the supported subset (CommonMark + tables + fenced code with language + footnotes + Mermaid fences); the test suite asserts the round-trip.
- **V6** — Application logs are English-only and structured (`pino`-style JSON via Strav's logger); user-facing strings are wrapped through `t()` from day one even though only English ships in v1.
- **V7** — All AI tool calls are logged with workspace_id, user_id, agent name, tool name, input hash, output token count; never with raw prompt text in production logs.
- **V8** — Project-internal modules are referenced via `#`-prefixed subpath imports declared in `package.json`'s `imports` field — never via relative `../` paths. The aliases are: `#controllers/*`, `#middleware/*`, `#policies/*`, `#services/*`, `#models/*`, `#enums/*`, `#jobs/*`, `#schemas/*`, `#routes/*`, `#config/*`. (Code emitted by `@strav/cli` generators may use relative paths until the framework adopts subpath imports; that's a future improvement, not a slice-001 blocker.)

---

## Architecture sketch

```
                                  Browser
                                    │
                                    │  HTTPS
                                    ▼
                          ┌──────────────────┐
                          │  @strav/http     │  sessions, routes, middleware
                          │  + @strav/view   │  .strav templates
                          └────────┬─────────┘
                                   │ renders HTML; mounts Vue islands
                                   ▼
                          ┌──────────────────┐
                          │  Vue 3 islands   │  Reader (none), Editor,
                          │  resources/      │  ⌘K Palette, Review,
                          │  islands/        │  AskKBDrawer
                          └────────┬─────────┘
                                   │ HTTP / WebSocket
                                   ▼
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
 ┌────────────┐            ┌──────────────┐           ┌──────────────┐
 │ controllers│            │  signal hub  │           │  AI services │
 │ (HTTP)     │            │ @strav/signal│           │  app/services│
 └──────┬─────┘            └──────┬───────┘           │  /ai         │
        │                          │                  └──────┬───────┘
        ▼                          ▼                         │
 ┌────────────────────────────────────────┐    ┌─────────────┴────────┐
 │ services + models (RLS-aware)          │    │  @strav/brain agents │
 │ app/services/{kb,auth,ai}/, app/models │    │  + tools registry    │
 └──────┬─────────────────────────┬───────┘    └──────────┬───────────┘
        │                         │                       │
        ▼                         ▼                       ▼
 ┌──────────────┐         ┌──────────────┐         ┌────────────────┐
 │ PostgreSQL   │         │ @strav/queue │         │ Anthropic /    │
 │ + pgvector   │◀────────│ jobs:        │         │ provider API   │
 │ (RLS on      │         │ - embed      │         └────────────────┘
 │  workspace)  │         │ - tag        │
 └──────┬───────┘         │ - summarize  │
        │                 └──────┬───────┘
        │                        │
        ▼                        ▼
 ┌──────────────┐         ┌──────────────┐
 │ @strav/search│         │ @strav/rag   │
 │   Meili      │         │ pgvector     │
 │ (dev + prod) │         │ paragraph    │
 └──────────────┘         │ index        │
                          └──────────────┘
```

- **Framework:** Strav `@strav/* ^0.4.11` (pin advances per release).
- **Runtime:** Bun ≥ 1.3.9; PostgreSQL ≥ 18 with `pgvector`; Meilisearch via Docker compose in dev and prod.
- **UI shape:** server-rendered `.strav` templates with selective Vue 3 island hydration.
- **Deployment:** single-process Bun + single Postgres + Meilisearch container; Docker compose for dev.
- **Key integrations:** Anthropic Claude (default AI provider; configurable per deploy); OpenAI Embeddings (`text-embedding-3-small`, 1536-d); Meilisearch; Google + GitHub OAuth.
- **Adapter:** see `./adapters/strav.md` for the concrete pipeline mapping.

---

## Schema sketch

```
boundary: platform
  | Resource           | Classification   | Purpose                                           |
  |--------------------|------------------|---------------------------------------------------|
  | user               | Entity           | Platform user accounts (cross-workspace identity)  |
  | session            | Event            | Active user sessions (cookie-keyed, TTL'd)         |
  | oauth_identity     | Association      | (user, provider, provider_user_id) tuples           |
  | magic_link         | Event            | Issued magic-link tokens; consumed-once, TTL'd     |
  | totp_secret        | Component        | Per-user TOTP secret + enabled flag                 |
  | recovery_code      | Component        | Per-user single-use 2FA recovery codes              |
  | login_attempt      | Event            | Magic-link / OAuth / TOTP attempts; rate-limit basis |

boundary: tenant (workspace_id FK on every row, RLS-enforced)
  | Resource           | Classification   | Purpose                                           |
  |--------------------|------------------|---------------------------------------------------|
  | workspace          | Entity           | Tenant root                                        |
  | membership         | Association      | (workspace, user, role)                             |
  | space              | Entity           | Top-level containers; tree of folders inside       |
  | space_defaults     | Component        | Per-space toggles: review, comments, ai_index      |
  | doc                | Entity           | Logical document; pointer to current revision      |
  | revision           | Event            | Immutable content snapshots (markdown)             |
  | change             | Entity           | PR-style proposals (revision → revision)           |
  | thread             | Entity           | Comment threads anchored on a change or revision   |
  | message            | Event            | Individual comments within threads                 |
  | tag                | Reference        | Workspace-scoped tag pool                           |
  | doc_tag            | Association      | (doc, tag) with applied_by + applied_at             |
  | tag_suggestion     | Event            | AI-proposed tags awaiting author action             |
  | embedding          | Component        | (revision_id, paragraph_idx, vector) for RAG       |
  | search_document    | Component        | Mirror table (or Meili index) for FTS              |
  | ai_call            | Event            | Tool-call audit trail (workspace, user, agent, tool) |
  | audit_log          | Event            | Stub in v1; structured user actions for v2 admin    |
```

Field-level shapes are deferred to slice Tech Specs.

---

## Key decisions (ADR index)

- [ADR-0001 — Architecture: Strav islands over decoupled SPA](./adr/0001-architecture-strav-islands-over-spa.md)
- [ADR-0002 — Auth: Strav-native only (magic link + OAuth + TOTP)](./adr/0002-auth-strategy-strav-native-only.md)
- [ADR-0003 — Styling: design tokens via CSS @layer + CSS Modules](./adr/0003-styling-tokens-css-modules.md)
- [ADR-0004 — Search: Meilisearch via `@strav/search` (dev + prod)](./adr/0004-search-meilisearch.md)
- [ADR-0005 — AI: `@strav/brain` with Anthropic primary, swappable; `@strav/rag` over pgvector](./adr/0005-ai-anthropic-via-strav-brain.md)
- [ADR-0006 — Editor: TipTap headless wrapped as a Vue island; markdown serializer](./adr/0006-editor-tiptap-vue-binding.md)
- [ADR-0007 — Versioning: immutable revisions with `docs.current_revision_id` pointer](./adr/0007-versioning-immutable-revisions.md)

---

## Open questions

- [ ] Embedding model and dimension (Discovery open question carried forward).
- [ ] AI provider pin vs. configurable (Discovery open question carried forward).
- [ ] Topbar hydration strategy on read paths — no-JS fallback or progressive island?
- [ ] How is "suggested reviewers" computed at zero-corpus (workspace just created, no maintainership history)?

---

## Signature

```
Signed by: Liva
Date: 2026-05-09
```

---

## Post-signature changes

### Amendment (in-place, default)

NFR adjustments, scope deltas within the current architecture, a new ADR linked, schema-sketch row added, open question resolved.

### Supersession (new file, rare)

Architecture-level reversal: e.g., framework changed, tenancy model changed, or enough ADRs superseded that the Design no longer describes what is being built.

---

## Amendment log

### 2026-05-09 — Add convention V8 (subpath imports)
Section: `Conventions`
From:    Conventions list ended at V7 (AI tool-call logging).
To:      Added V8 — project-internal modules use `#`-prefixed subpath imports declared in `package.json`'s `imports` field; relative `../` paths are forbidden in hand-written code. Lists the 10 aliases (`#controllers/*`, `#middleware/*`, `#policies/*`, `#services/*`, `#models/*`, `#enums/*`, `#jobs/*`, `#schemas/*`, `#routes/*`, `#config/*`).
Why:     Surfaced during Build-T1 Checkpoint 2 — the Tech Spec said *where* files live but not *how* they import each other, and the auth-slice scaffold drifted into 17 relative `../../policies/auth_policy` style imports. Subpath imports are stable under refactors (move a file → relatives break, `#` aliases survive) and self-document where each module fits in the project's vocabulary. Pinning the convention here means every Tech Spec from now on can cite V8 by reference instead of re-arguing the import style per slice. The matching adapter amendment teaches the pipeline step map to point at V8.
By:      Liva

### 2026-05-09 — Singularize table names in Schema sketch + Conventions V4/V5
Section: `Conventions`, `Schema sketch`
From:    V4 referenced `workspaces.id`; V5 referenced `revisions.content`. Schema sketch used plural names throughout (users, sessions, …, workspaces, memberships, spaces, docs, revisions, changes, threads, messages, tags, doc_tags, tag_suggestions, embeddings, search_documents, ai_calls).
To:      V4 references `workspace.id`; V5 references `revision.content`. Schema sketch uses singular names (user, session, oauth_identity, magic_link, totp_secret, recovery_code, login_attempt, workspace, membership, space, space_defaults, doc, revision, change, thread, message, tag, doc_tag, tag_suggestion, embedding, search_document, ai_call). `space_defaults` and `audit_log` already singular and unchanged.
Why:     Strav uses singular table names (`defineSchema('user', …)` → table `user`); slice 001's Build-T1 Checkpoint 1 surfaced this convention and amended its Tech Spec accordingly. The Design schema sketch was not updated at that time. Slice 002 is the next slice to author schemas, so the Build-T0 sweep brings every spec document into alignment before any new schema files exist. Forward-looking benefit: future Tech Specs cite Design table names by reference and inherit the singular form automatically.
By:      Liva
