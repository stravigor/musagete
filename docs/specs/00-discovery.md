```
project:       musagete-kb
mode:          showcase
status:        Signed
relationship:
date:          2026-05-09
signed by:     Liva
```

## Elevator

Musagete is an editorial, AI-augmented open-source knowledge base, rebuilt on the **Strav** framework as the canonical reference application for Strav's full surface area — schema/migration pipeline, Vue islands, search drivers, brain/RAG agents, signal channels, and OAuth/magic-link/TOTP auth. Outline is the Reference; the rebuild deliberately diverges on six points.

---

## Showcase Subject

- **Subject:** Strav (Bun + TypeScript + PostgreSQL) framework, end-to-end build pipeline.
- **Why this subject:** Strav needs a non-trivial, production-shaped reference app that exercises every workspace package in a single coherent product, used in framework docs and onboarding.
- **Capabilities to exercise:**
  - `@strav/kernel`, `@strav/cli` — schema → migration → model → controller → route → BDD test pipeline (already wired in the project scaffold).
  - `@strav/http` — sessions, route groups, middleware, file uploads.
  - `@strav/view` — `.strav` server-rendered templates with **Vue 3 islands** for interactivity.
  - `@strav/database` — PostgreSQL with multi-tenant Row-Level Security on `workspace_id`.
  - `@strav/social` — OAuth providers (GitHub, Google).
  - `@strav/auth` — magic links, TOTP 2FA, signed opaque tokens.
  - `@strav/brain` — multi-provider AI agents and tool use (Anthropic primary).
  - `@strav/rag` — pgvector-backed retrieval with paragraph chunking.
  - `@strav/search` — driver abstraction (Meilisearch is the v1 driver in dev and prod, run via Docker compose); the abstraction itself is the showcase artifact.
  - `@strav/signal` — WebSocket channels for presence and PR-thread updates.
  - `@strav/queue` — background jobs for embeddings and AI tagging on save.
- **Implicit audience:** developers evaluating Strav, internal teams adopting it, contributors to the framework. Not a user role; an audience.

*The Subject is what the project is **for**; the Reference below is what the project is **measured against**.*

---

## Reference

- **Name:** Outline (`getoutline.com`, source at `github.com/outline/outline`).
- **Where to observe it:** the hosted demo workspace at `getoutline.com` and the open-source repository at `github.com/outline/outline`.
- **What it does (the baseline):**
  1. Workspace contains *collections*; each collection contains a tree of *documents* with rich-text content stored in a custom block model.
  2. Documents support markdown shortcuts, slash menus, mentions, code blocks, embeds, and inline comments. A revision history is kept and viewable in a side drawer.
  3. Permissions are workspace + collection scoped, with member/admin distinctions per collection.
  4. Auth includes email/password, magic link, OAuth (Google, Slack, etc.), and SAML/SCIM in the enterprise tier.
  5. Built-in full-text search; integrations with Slack and GitHub. An AI assistant is available as a chat drawer over indexed content (recent addition).
  6. Self-hostable; SSO and SCIM are paywalled features in the cloud product but available open-source with configuration.
- **What it does well:** an editorial, low-chrome reading experience; the *collection-as-space* metaphor; markdown-friendly interop; clean public sharing; thoughtful keyboard ergonomics.

---

## Showcase goals

- **G1** — Strav's full schema → migration → model → controller → route → BDD test pipeline is exercised in **at least three slices**, each cited from its Tech Spec, demonstrating the framework's end-to-end ergonomics.
- **G2** — The editorial reading surface (typography, density, light/dark, accent presets) renders pixel-faithful to the token set and type scale defined in [ADR-0003](./adr/0003-styling-tokens-css-modules.md). **The reader's main content (title, body, byline) renders without JavaScript**; the Topbar (theme/density toggles) and footnote popovers may progressively hydrate as small Vue islands; full interactive surfaces (editor, palette, AI drawer, review) are mounted only on their dedicated routes.
- **G3** — Grounded "Ask the KB" answers are produced by `@strav/brain` agents against a `@strav/rag` paragraph index; **every answer cites paragraph-level sources from indexed docs and refuses ungrounded generation**.
- **G4** — Authoring assistance (rewrite selection, summarize doc, generate outline, fix tone) runs as in-editor Vue island slash commands invoking `@strav/brain` tools server-side.
- **G5** — PR-style review surfaces an **AI-generated diff summary and suggested reviewers** per change, derived from doc maintainership and embedding similarity to the diff's content.
- **G6** — On save, a `@strav/queue` background job computes embeddings for the new revision and proposes tags + related-doc links; suggestions are surfaced to the author, **never auto-applied**.
- **G7** — The auth surface is **Strav-native only**: magic link + Google OAuth + GitHub OAuth + TOTP 2FA. Zero non-Strav identity code.
- **G8** — ⌘K palette returns results with **p95 < 150ms** on a 250-doc corpus on commodity hardware. Search runs through `@strav/search`'s driver abstraction (Meilisearch is the v1 driver in dev and prod) — swappable to other supported drivers via one config-line change.

*These goals are project-unique with stable IDs so the Design value map (`C*` gain creators, `R*` pain relievers) cites them unchanged.*

---

## Reference shortcomings

- **P1** — Outline's revision history is hidden in a side drawer; readers cannot see what changed between revisions inline.
  *Reason: a knowledge base that documents change should make change first-class. Musagete surfaces PR-style review with side-by-side word-level diff and threaded inline comments — the act of editing is part of the editorial product, not back-office plumbing.*
- **P2** — Outline's AI features are bolted on as a single chat drawer over indexed content.
  *Reason: a credible AI showcase requires AI woven through authoring (in-editor commands), review (diff summarization, suggested reviewers), and discovery (auto-tagging, suggested links) — not one drawer. The showcase exists to demonstrate `@strav/brain` and `@strav/rag` across surfaces.*
- **P3** — Outline's editor uses a custom block model; documents are not portable as plain markdown without export.
  *Reason: the rebuild's stated philosophy is **markdown-first** for grep/portability/git-friendliness. Storage is markdown; the editor (TipTap) projects onto it with a markdown serializer round-trip.*
- **P4** — Outline's permissions are coarse: member / admin per collection.
  *Reason: the showcase exercises `@strav/database` Postgres RLS multi-tenancy and per-space role permissions (owner / admin / editor / reader / guest). Finer-grained roles justify the schema and demonstrate tenancy enforcement under load.*
- **P5** — Outline's enterprise tier includes SAML and SCIM.
  *Reason: out of scope. Strav does not ship enterprise SSO primitives, and the showcase honors that boundary rather than smuggling non-Strav identity code into a "framework reference app".*
- **P6** — Outline's typography is utilitarian sans-serif; reading feels like a wiki, not an edited publication.
  *Reason: this project's binding token set (defined in [ADR-0003](./adr/0003-styling-tokens-css-modules.md)) prescribes editorial typography — Newsreader serif display with optical-size axis, drop caps, accent presets, density tokens. The token set is a binding deliverable; the design opinion is the product.*

*Each shortcoming carries a one-line **Reason** clause. Without it, Design has nothing principled to cite. A shortcoming the rebuild explicitly chooses **not** to address in v1 — P5 — is cited in the Design's "Out of scope for v1" section with the same Reason.*

---

## Constraints

- **Budget:** bootstrapped, no external funding.
- **Timeline:** 4 weeks.
- **Regulatory:** none. Self-hosted OSS distribution; no PII obligations beyond reasonable defaults (HTTPS, hashed passwords-where-applicable, no raw secrets in logs).
- **Technical givens:**
  - Bun ≥ 1.3.9; PostgreSQL ≥ 18 with `pgvector` extension.
  - Strav workspace packages, version pinned in `package.json` (currently `^0.4.11`); the project scaffold (`bun.lock`, `strav.ts`, `config/`, `resources/`, `start/`, `index.ts`) is the binding starting point.
  - Frontend: Vue 3 islands inside `.strav` server-rendered templates; **no decoupled SPA**.
  - Styling: token set (ADR-0003) as CSS custom properties in a `@layer tokens` block; component styles via **CSS Modules** (default) or **vanilla-extract** (per slice if static extraction is preferred). **No Tailwind. No UI kit (Shadcn / MUI / similar).**
  - Fonts: Newsreader (serif, optical-size axis) + DM Sans + JetBrains Mono. Self-hosted in production; Google Fonts only for prototype.
- **Team:** solo-developer + AI assistant.

---

## Success criteria

1. **Capability-coverage check:** every Strav workspace package named in *Capabilities to exercise* appears in shipped slices, with at least one slice's Tech Spec citing each package as a dependency. A grep over `docs/specs/slices/*.tech.md` finds every name.
2. **Performance bands:** ⌘K palette p95 < 150ms over 250 docs; "Ask the KB" first-token p95 < 2s, full-answer p95 < 8s; reader cold paint p50 < 100ms server-rendered on commodity hardware (4-core / 8 GB).
3. **Onboarding latency:** an external developer can clone, run migrations, seed the demo workspace, and reach a rendered doc on `localhost` in **under five minutes** from a fresh checkout.
4. **Adoption signal:** featured as Strav's canonical reference application within four weeks of v1 ship — linked from the Strav docs landing and from at least one slice's reading.

---

## Non-goals

What this project explicitly **will not** do in v1:

- **SAML, SCIM, GitLab OAuth, passkeys.** Strav doesn't ship them; cites P5. The showcase honors the framework's boundary.
- **Multi-region deployment.** Single-region self-hosted only. Multi-region is a deployment-topology concern not interesting to showcase.
- **Native mobile apps.** Web-only. The reading surface is responsive; that is enough.
- **Excalidraw or other diagramming embeds.** Mermaid in fenced code blocks is in scope; richer diagram embeds are deferred.
- **Domain-capture auto-provisioning** (auto-promote new users on a verified email domain). Outline supports it; Strav has no equivalent primitive. Deferred until a clean Strav design exists.
- **Real-time collaborative cursors in the editor.** Presence on PR threads is in scope (`@strav/signal`); co-editing the same document live is not.
- **Admin surfaces (People & Access, audit log, community page, public-space sharing).** The vertical-slice showcase covers reader → edit → review → search → AI; admin surfaces are deferred to v2 with explicit reasons in `10-design.md` "Out of scope for v1."

---

## Open questions

*All five resolved before signing; answers are propagated into the named spec sections, which become the load-bearing references after sign.*

- [x] AI provider primary: pin Anthropic (default) or make per-deploy configurable from launch?
  *Resolved: per-deploy configurable, default Anthropic. Captured in [ADR-0005](./adr/0005-ai-anthropic-via-strav-brain.md) Decision.*
- [x] Search provider in dev: SQLite FTS5 default with Meilisearch optional, or always Meilisearch (Docker compose for dev)?
  *Resolved: Meilisearch in both dev and prod, via Docker compose. Captured in [ADR-0004](./adr/0004-search-meilisearch.md) Decision.*
- [x] Embedding model and dimension for `@strav/rag`?
  *Resolved: `text-embedding-3-small` (1536-d). Captured in [ADR-0005](./adr/0005-ai-anthropic-via-strav-brain.md) Decision and slice 005's Tech Spec data model.*
- [x] Token set delivery: a single global CSS file imported once in the root `.strav` template, or per-island scoped via vanilla-extract?
  *Resolved: a single global CSS file imported once. Already matches [ADR-0003](./adr/0003-styling-tokens-css-modules.md) Decision.*
- [x] How aggressive is "no JavaScript on read paths" — does the Topbar (theme/density toggles) hydrate, or is it a no-JS form?
  *Resolved: relaxed. Reader's main content renders without JavaScript; Topbar and footnote popovers may progressively hydrate. Captured in G2 above, [ADR-0001](./adr/0001-architecture-strav-islands-over-spa.md) Verification hooks, and slice 003 Scenario 1.*

---

## Signature

```
Signed by: Liva
Date: 2026-05-09
```

*The signature is the immutability trigger. Before it is filled, edit freely. After it is filled, **everything above the Amendment log is frozen** — every change goes into a new amendment entry with a written reason, or (for genuine pivots — changing the Showcase Subject or swapping the Reference) into a new superseding Discovery file.*

---

## Post-signature changes

A signed Discovery is immutable above the Amendment log.

### Amendment (in-place, default)

Use for: corrections, clarifications, added nuance, a newly-discovered constraint, a success criterion sharpened by early feedback, a Reference shortcoming whose reason needs sharpening, a non-goal that needs explicit naming.

### Supersession (new file, rare)

Reserved for: the Showcase Subject changes (we now demonstrate a different framework), the Reference changes (we now rebuild a different existing solution), or the philosophy shifts so far (e.g. markdown-first → block-tree-first) that prior decisions are effectively for a different project.

---

## Amendment log

*(Append-only. Do not edit existing entries.)*
