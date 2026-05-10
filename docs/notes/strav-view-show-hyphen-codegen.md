# `@strav/view` — `@show('name')` breaks when name contains a hyphen

**Status:** issue draft, ready to file against [stravigor/strav](https://github.com/stravigor/strav).
**Surfaced by:** musagete slice 003 Build-T1, smoke-check automation (`tests/spaces/slice-003-demo.flow.ts` first run).
**Severity:** medium — silent in development if the section name happens to contain only valid identifier characters; loud (500 ReferenceError) the moment it doesn't.

---

## Reproducer

`@strav/view` compiles `@show('section-name')` into:

```js
if (typeof section-name !== 'undefined' && section-name !== null) {
  __out += section-name;
} else if (__blocks["section-name"]) {
  __out += __blocks["section-name"];
} else {
  __out += "";
}
```

(See `node_modules/@strav/view/src/compiler.ts` — `case 'show'`.)

The compiler injects `${name}` raw as an identifier on the `typeof` branch instead of using a JSON-encoded key against `__blocks`. JS parses `typeof section-name` as `(typeof section) - name`, and `name` (or whichever literal trails the dash) throws `ReferenceError` at render time.

The companion `@section('section-name')` directive *does* JSON-encode the name (`__blocks["section-name"] = …`), so authoring a section is fine. The mismatch only surfaces when the parent layout's `@show` runs.

Concrete instance in musagete that broke:

```jinja2
{# resources/views/layouts/shell.strav (before fix) #}
@show('shell-content')

{# resources/views/workspaces/show.strav (before fix) #}
@section('shell-content')
  …
@end
```

`GET /workspaces/<slug>` returned 500 with `ReferenceError: content is not defined` (the second half of `shell-content` after JS subtracted `shell` from it).

## Expected behavior

`@show('section-name')` should compile to the same JSON-keyed lookup `@section` uses on the writer side — never inject the name as a raw identifier. Suggested codegen:

```js
const __sectionVar = (function() { try { return eval(${JSON.stringify(name)}); } catch { return undefined; } })();
if (typeof __sectionVar !== 'undefined' && __sectionVar !== null) {
  __out += __sectionVar;
} else if (__blocks[${JSON.stringify(name)}]) {
  __out += __blocks[${JSON.stringify(name)}];
} else {
  __out += ${JSON.stringify(fallback)};
}
```

(Or any equivalent that keeps the "child-provided variable wins" semantic without identifier injection.)

A simpler alternative: drop the "child-provided variable" first branch entirely. `@section`/`@show` is the documented authoring path; the variable-fallback path is undocumented and creates this footgun.

## Acceptance criteria

- [ ] `@show('a-b-c')` compiles to valid JS and returns `__blocks["a-b-c"]` when set, fallback otherwise.
- [ ] An adversarial test in `@strav/view`'s own tests covers section names with hyphens, dots, and spaces.
- [ ] A migration note for app authors mentions the prior identifier injection pattern in the changelog (since some templates may rely on the variable-shadow semantic).

## Workaround until upstream lands

Use only identifier-safe section names — letters, digits, underscores. musagete renamed `shell-content` → `shell_content` across `layouts/shell.strav` and the four child templates that defined the section. Caught immediately by `tests/spaces/slice-003-demo.flow.ts`'s first red run; documented here so future slices avoid the trap.
