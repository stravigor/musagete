# ADR-0006 — Editor: TipTap headless wrapped as a Vue island; markdown serializer

Status:       Accepted
Relationship:
Date:         2026-05-09
Decided by:   Liva

---

## Context

`P3` (Outline's custom block model) and `R3` (markdown round-trip) commit Musagete to **markdown-as-storage**. The editor is a high-surface-area component: slash menu, mentions, callouts, tables, code blocks (with Mermaid), inline comments, and the AI authoring slash commands from `G4`. Candidate libraries are TipTap and ProseMirror, with CodeMirror 6 as a complementary option for an optional source-mode pane.

The decision now is which editor library and how it binds to Vue inside Strav's island model.

---

## Decision

Use **TipTap (headless mode) wrapped as a single Vue island** under `resources/islands/Editor.vue`. The editor stores content as markdown on `revisions.content`; TipTap projects onto a markdown document via a serializer/deserializer pair (TipTap's `@tiptap/extension-markdown`-style implementation, configured for our supported subset: CommonMark + tables + fenced code with language + footnotes + Mermaid fences). CodeMirror 6 is loaded lazily for the optional source-mode pane.

The markdown round-trip (`V5`) is asserted by tests; any markdown shape the editor cannot losslessly round-trip is either added to the supported subset or rejected by validation.

---

## Tradeoffs

**What we gain:**
- TipTap's prebuilt extensions cover the editor inventory above (slash menu, mentions, tables, code blocks); we pick what we need.
- Markdown storage gives us grep-friendly content, easy diffing, and natural serialization for AI prompts.
- A single Vue island keeps editor concerns local and lazily loaded.

**What we give up:**
- The supported-markdown subset must be declared and tested; un-roundtrippable input is a rejection or a degradation, not silent corruption.
- Lazy-loading CodeMirror requires an island-internal dynamic import.

**Why the exchange is worth it:**
TipTap's headless API + a markdown serializer is the cleanest path to `R3` and `V5`; ProseMirror raw is more flexibility than this slice needs and doubles author cognitive cost.

---

## Alternatives considered

### Option A — ProseMirror raw
- **Pros:** Maximum flexibility; no TipTap abstraction layer.
- **Cons:** Slow start; extension ecosystem must be built.
- **Why rejected:** TipTap covers our needs at a fraction of the cost.

### Option B — Custom block model (Outline-style) with markdown export
- **Pros:** Editor flexibility; rich features.
- **Cons:** Reintroduces the very `P3` we explicitly rejected.
- **Why rejected:** contradicts Discovery `P3`.

### Option C — TipTap headless + markdown serializer in a Vue island (chosen)
- **Pros:** Mature; markdown-first; binds naturally to Vue; works in an island.
- **Cons:** Round-trip discipline must be tested; the supported subset is explicit.
- **Chosen because:** balances ergonomics with `P3`/`R3`/`V5`.

---

## Consequences

- **Positive:** Editor extensions (slash commands, AI authoring) can be added without changing storage shape.
- **Negative:** Some markdown extensions (e.g. ::: containers, custom directives) need an explicit decision before they ship.
- **Neutral / follow-ups:** Slice 004's test pack includes a property-style round-trip test over a fixture corpus.

---

## Verification hooks

- [ ] `resources/islands/Editor.vue` is the single editor mount.
- [ ] A round-trip test exists for a fixture corpus (≥ 20 docs) and is part of the global suite.
- [ ] CodeMirror 6 is dynamically imported, not bundled into the editor's initial chunk.

---

## Signature

```
Decided by: Liva
Date: 2026-05-09
```

---

## Amendment log

*(Append-only.)*
