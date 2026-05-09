# ADR-0003 — Styling: design tokens via CSS @layer + CSS Modules

Status:       Proposed
Relationship:
Date:         2026-05-09
Decided by:

---

## Context

Discovery makes the editorial typography and the named token set a binding deliverable (`P6`, `R5`). The audience is mixed power users + casual readers; the look is "paper, ink, terracotta, and one accent" — a magazine, not a wiki. The token set named below is therefore part of this ADR rather than referenced externally.

The decision now is where tokens live, how component styles consume them, and which static-extraction tool (if any) is used for type-safe styles. Tailwind is excluded by project constraint ("no Tailwind, only CSS Modules or vanilla-extract").

---

## Decision

Tokens are delivered as **CSS custom properties inside an `@layer tokens` block** in `resources/css/tokens.css`, loaded once at the top of the root `.strav` template. Theme switching is `data-theme="light|dark"` on `<html>`; density is `data-density="regular|compact"`; accent is set inline as `style="--accent: …; --accent-soft: …; --accent-soft-2: …; --accent-2: …;"` on `<html>` per user preference. Component styles use **CSS Modules by default**; **vanilla-extract** is permitted per slice when type-safe themes or static extraction provides a measurable benefit. Tailwind is explicitly forbidden.

The full token set, type scale, and motion rules are defined in the *Token reference* section below; that section is the binding contract.

---

## Tradeoffs

**What we gain:**
- Tokens live in one CSS file owned by the design; components reference them by name; theme/density/accent swap is a one-line attribute change.
- CSS Modules give scoped class names without a build-time framework dependency; works natively with Bun + Vue SFCs.
- vanilla-extract remains available as an opt-in for slices where typed tokens add real value (e.g. `tokens.ts` consumed by both Vue and `.strav` templates).
- No utility-first churn; no framework conflict with the editorial type and density.

**What we give up:**
- Less utility ergonomics; styles tend to grow per-component rather than be composed inline.
- Mixing CSS Modules and vanilla-extract in the same project requires an explicit boundary (which we draw in this ADR).

**Why the exchange is worth it:**
The token set below *is* the design system. It cannot be expressed cleanly through Tailwind without re-mapping every value into `theme.extend` — a maintenance liability that adds a dependency without adding capability.

---

## Alternatives considered

### Option A — Tailwind with tokens in `theme.extend`
- **Pros:** Familiar; utility ergonomics.
- **Cons:** Tokens live twice (in source CSS and in `tailwind.config`); editorial typography forces a lot of `[font-feature-settings]` arbitrary values; explicitly excluded by project constraint.
- **Why rejected:** explicit project constraint; offers no benefit the chosen tools lack.

### Option B — vanilla-extract for everything
- **Pros:** Type-safe themes; static extraction.
- **Cons:** Build-tool integration with Strav's `.strav` templates is unproven; tokens would need to be mirrored between TypeScript theme contracts and `.strav` template references.
- **Why rejected:** premature; costs are concrete, benefits are speculative for v1.

### Option C — CSS @layer tokens + CSS Modules default + vanilla-extract opt-in (chosen)
- **Pros:** Tokens live once as plain CSS, readable from `.strav` and `.vue` alike; CSS Modules give scoping without build complexity; vanilla-extract is available where it earns its keep.
- **Cons:** Authors choose between two tools; mitigated by the default rule above.
- **Chosen because:** simplest path that delivers the *Token reference* below verbatim.

---

## Consequences

- **Positive:** A single token file lives at `resources/css/tokens.css`; all components consume it; the file is also the canonical reference for the design system.
- **Negative:** Authors must remember the CSS-Modules-default rule; a short PR-template checkbox helps.
- **Neutral / follow-ups:** If vanilla-extract appears in two slices, promote a "vanilla-extract slice pattern" to `patterns/`.

---

## Token reference (binding)

The values below are the **authoritative design tokens**. `resources/css/tokens.css` must implement them exactly.

### Color — light mode (default)

| Token         | Value                       | Usage                                      |
|---------------|-----------------------------|--------------------------------------------|
| `--paper`     | `#FAF7F2`                   | App background                             |
| `--paper-2`   | `#F2EDE3`                   | Hover surface, inputs, callouts            |
| `--paper-3`   | `#E8E1D2`                   | Code-block header, raised surfaces         |
| `--surface`   | `#FFFFFF`                   | Cards, table bodies                        |
| `--ink`       | `#1A1614`                   | Primary text, primary CTA background       |
| `--ink-2`     | `#4A4540`                   | Secondary text                             |
| `--ink-3`     | `#8A8278`                   | Tertiary / metadata                        |
| `--ink-4`     | `#B8B0A4`                   | Quaternary / placeholder                   |
| `--rule`      | `rgba(26,22,20,0.08)`       | Hairline dividers                          |
| `--rule-2`    | `rgba(26,22,20,0.14)`       | Borders on inputs / buttons                |
| `--rule-3`    | `rgba(26,22,20,0.22)`       | Hover borders                              |
| `--ok`        | `#4A7A3D`                   | Status: active / healthy; diff additions   |
| `--warn`      | `#B58A2E`                   | Status: expiring / warning                 |
| `--danger`    | `#B83A2E`                   | Errors, deletions                          |
| `--add`       | `#2D6A3F`                   | Diff additions                             |
| `--del`       | `#B83A2E`                   | Diff removals                              |

### Color — dark mode

Activated via `:root[data-theme="dark"]`. Ink/paper invert; accents brighten slightly. Required token names match the light set; values are tuned at implementation time and verified visually against the light palette for parity of contrast and intent.

### Accent presets (4 user-selectable)

```ts
const ACCENT_PRESETS = {
  '#B8442C': { soft: 'rgba(184,68,44,0.10)',  soft2: 'rgba(184,68,44,0.18)',  dark: '#9A3622' }, // terracotta
  '#5C4FB8': { soft: 'rgba(92,79,184,0.10)',  soft2: 'rgba(92,79,184,0.20)',  dark: '#4A3FA0' }, // iris
  '#2D6A3F': { soft: 'rgba(45,106,63,0.10)',  soft2: 'rgba(45,106,63,0.20)',  dark: '#235430' }, // forest
  '#7A2E5A': { soft: 'rgba(122,46,90,0.10)',  soft2: 'rgba(122,46,90,0.20)',  dark: '#5E2244' }, // plum
};
```

The selected preset is applied as inline style on `<html>` setting `--accent`, `--accent-soft`, `--accent-soft-2`, `--accent-2` (the `dark` variant). The rest of the system reads from these custom properties.

### Type — families

```css
--serif: 'Newsreader', 'Iowan Old Style', Charter, Georgia, serif;
--sans:  'DM Sans', ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
--mono:  'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
```

**Newsreader** uses the optical-size axis: display headlines must set `font-variation-settings: 'opsz' <px>` matching the rendered size. Self-host all three families in production; Google Fonts is acceptable for prototype only.

### Type scale

| Use                                                  | Family | Size                         | Weight  | Line | Tracking         |
|------------------------------------------------------|--------|------------------------------|---------|------|------------------|
| Page title (`.docs-title`, `.admin-title`)           | serif  | 44px                         | 600     | 1.05 | -0.02em          |
| Auth h1 (`.auth-h`)                                  | serif  | 34px                         | 600     | 1.10 | -0.02em          |
| Reader h1 (`.read h1`)                               | serif  | clamp(36px, 4vw, 52px)       | 600     | 1.05 | -0.018em         |
| Reader h2                                            | serif  | 28px                         | 600     | 1.20 | -0.012em         |
| Reader h3                                            | sans   | 14px                         | 600     | 1.5  | 0.06em uppercase |
| Reader body                                          | serif  | 19px                         | 400     | 1.65 | 0                |
| Section title (`.tpl-name`, `.group-name`)           | serif  | 18–22px                      | 600     | 1.2  | -0.01em          |
| Body sans                                            | sans   | 13–14px                      | 400/500 | 1.5  | 0                |
| Eyebrow                                              | sans   | 10.5px                       | 600     | —    | 0.12–0.14em uppercase |
| Mono meta                                            | mono   | 11–13px                      | 400/500 | —    | 0.04em           |

**Display-font axis.** A `data-display="serif|sans"` attribute on `<html>` swaps page titles (`.docs-title`, `.admin-title`, `.read h1`, `.read h2`, `.tpl-name`, `.group-name`, `.modal-title`) from Newsreader to DM Sans 700 with `letter-spacing: -0.022em`.

### Spacing, density, layout

```css
--row-h:    30px;   /* 26px in compact (data-density="compact") */
--pad:      28px;   /* 20px in compact                            */
--gap:      18px;   /* 12px in compact                            */
--read-lh:  1.65;   /* 1.55 in compact                            */
--sidebar-w:264px;
--rail-w:   320px;  /* AI drawer width  */
--topbar-h: 52px;
--maxread:  720px;  /* reading column max-width */
--radius:    6px;
--radius-lg: 10px;
```

**Modals** use `border-radius: 14px` and the modal shadow `0 24px 60px rgba(0, 0, 0, 0.18)`. **Avatars** are 22 / 24 / 28 / 32 px circles. **Focus ring** everywhere is `box-shadow: 0 0 0 3px var(--accent-soft)`. **Selection** uses `::selection { background: var(--accent-soft-2); color: var(--ink); }`. **Hover transitions** are `0.12s ease` on `background-color` and `border-color`.

The design uses near-zero elevation by intent. The only shadow is the modal shadow above; do not introduce others.

---

## Verification hooks

- [ ] No `tailwindcss` in `package.json`.
- [ ] `resources/css/tokens.css` exists, contains an `@layer tokens` block, and is imported once from the root `.strav` template.
- [ ] Token values exactly match the *Token reference* section above (color hexes, opacity values, font names, type scale).
- [ ] No `style="…"` arbitrary values in templates except for the runtime accent override on `<html>`.

---

## Signature

```
Decided by:
Date:
```

---

## Amendment log

*(Append-only.)*
