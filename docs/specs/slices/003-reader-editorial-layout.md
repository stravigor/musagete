```yaml
slice_id:        003
status:          drafted
owner_turn:
resource_type:
tenancy:         tenant
runtime:         web
strav_packages:  [@strav/view, @strav/http]
```

---

## Story

As a **reader (any role)**
I want to **open a doc and read it in an editorial, typography-forward layout that respects my theme, density, and accent preferences**
so that **the reading experience feels like a finished publication, not a wiki dump**.

---

## Context

Pixel-faithful render of the binding token set ([ADR-0003](../adr/0003-styling-tokens-css-modules.md)) into a `.strav` server-rendered template. Read paths must work with JavaScript disabled (`G2`); Vue islands hydrate **only** the optional Topbar interactions and a footnote-popover behavior. Drop cap, marginalia, code blocks, and Mermaid blocks all render server-side.

Links:

- Discovery — `G2`, `P6`.
- Design — `C2`, `R5`.
- Tech Spec: [`./003-reader-editorial-layout.tech.md`](./003-reader-editorial-layout.tech.md).
- ADRs: [ADR-0001](../adr/0001-architecture-strav-islands-over-spa.md), [ADR-0003](../adr/0003-styling-tokens-css-modules.md).
- Depends on: 002.

---

## BDD Scenarios

```gherkin
Scenario 1: Reader main content renders without JavaScript
  Given a published doc "intro" in space "platform"
  When the user opens "/d/intro" with JavaScript disabled
  Then the response HTML contains the doc title, body, byline, code blocks, and marginalia
    And computed CSS shows Newsreader serif on h1/h2 and DM Sans uppercase on h3
    And the drop cap renders on the .lede paragraph
    And no interactive island (editor, palette, AI drawer, review) is mounted on this route

Scenario 2: Theme switch persists
  Given a reader with "data-theme" preference "dark" stored in cookie
  When the user opens any doc URL
  Then the rendered <html> carries data-theme="dark"
    And computed colors derive from the dark token palette

Scenario 3: Density and accent persist
  Given a reader with "data-density"="compact" and "--accent" set to iris (#5C4FB8)
  When the user opens any doc URL
  Then the rendered <html> carries data-density="compact"
    And the inline style on <html> sets --accent: #5C4FB8 (and accent soft variants)

Scenario 4: Mermaid block renders
  Given a doc whose markdown contains a ```mermaid``` fenced block
  When the doc is rendered
  Then the output contains an <svg> for the mermaid diagram (server-rendered)

Scenario 5: Marginalia anchors highlight
  Given a doc with inline highlights anchoring marginalia
  When the doc renders
  Then each highlight has a stable id and the marginalia column references the same id
```

---

## Definition of Done

- [ ] `resources/css/tokens.css` contains the token set verbatim per [ADR-0003](../adr/0003-styling-tokens-css-modules.md), including light/dark, density, and accent presets.
- [ ] `resources/views/docs/read.strav` renders a published doc end-to-end without invoking any Vue island for the read path.
- [ ] Mermaid is rendered server-side at template time (or pre-rendered at save time and cached on `revision`).
- [ ] Theme, density, and accent preferences are read from cookies set by the optional Topbar island.
- [ ] BDD scenarios all green, including the JS-disabled scenario asserted with a no-JS HTML fixture test.
