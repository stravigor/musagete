# `@strav/database` — first-class Postgres extension management

**Status:** issue draft, ready to file against [stravigor/strav](https://github.com/stravigor/strav).
**Surfaced by:** musagete slice 002 (Workspace + Space bootstrap), Build-T0.
**Slice 001 precedent:** `docs/notes/strav-parent-fk-uniqueness.md` (deleted after upstream resolution; pattern reused here).

---

## Reproducer

A slice's Tech Spec requires a Postgres extension to be installed in the same migration as the schema work that depends on it (or a migration that runs before that work). Concrete case from musagete:

> *(slice 002 Tech Spec, original signed wording)* "Migration adds pgvector via `CREATE EXTENSION IF NOT EXISTS vector;` in the same migration."

`bun strav generate:migration -m "<message>"` produces schema-driven SQL by diffing `database/schemas/*.ts` against the live database. Every statement it emits maps to a schema construct (table, column, index, FK, enum, RLS policy DDL). Postgres extensions have no schema source — there is no `defineSchema(..., { extensions: [...] })` field, no project-level config that the migration generator reads — so the generated migration cannot include `CREATE EXTENSION`.

The author's options today are all workarounds:

1. **Hand-edit the generated migration.** Slice 001 hand-edited `constraints/up.sql` for composite UNIQUEs (later obsoleted by the framework's `parents:[{ name, unique }]` and schema-level `uniques:` DSL — *that* upstream fix is the precedent for what this issue proposes). A `HAND-EDITED — DO NOT REMOVE` banner protects against regenerate. Costs: regenerate workflow loses a clean idempotent path; the banner becomes a project-wide custom convention; review burden every time the migration changes.
2. **Ship a separate hand-written SQL migration that runs first.** Adds a parallel migration shape the runner has to understand; deviates from the "every migration is generated from schemas" invariant.
3. **Defer the extension to a later migration.** Acceptable for musagete (slice 002 doesn't *consume* pgvector — only slice 005's RAG and slice 007's tagging do), but it pushes the same problem downstream: slice 005 will face it again.

The musagete v1 plan **defers pgvector** out of slice 002 entirely (option 3 above) and relies on this issue resolving before slice 005 ships.

---

## Expected behavior — proposed DSL

`@strav/database` exposes a project-level extension list that the migration generator picks up the same way it picks up schemas. Two equally good shapes; either one (or both) works:

### Option A — Schema-level `extensions` field

```ts
// database/schemas/embedding.ts (slice 005 — illustrative)
export default defineSchema('embedding', {
  archetype: Archetype.Component,
  parents: ['doc', 'revision'],
  tenanted: true,
  extensions: ['vector'],     // ← new
  fields: {
    id: t.tenantedBigSerial().primaryKey(),
    vector: t.vector(1536).required(),
    contentHash: t.varchar(64).required(),
    paragraphIdx: t.integer().required(),
  },
})
```

The generator collects every `extensions: [...]` declaration across all schemas, deduplicates, and emits a prologue block in the generated migration:

```sql
-- migration prologue (auto-generated, before any CREATE TABLE)
CREATE EXTENSION IF NOT EXISTS "vector";
```

…with a matching `DROP EXTENSION IF EXISTS "vector";` in the down (idempotent; `IF EXISTS` makes the drop safe even when other migrations reference the extension).

### Option B — Project-level config

```ts
// config/database.ts
export default {
  // … existing keys …
  extensions: ['vector', 'citext', 'pg_trgm'],
}
```

Same generator behavior, but the declaration lives once at the project root rather than next to the consuming schema.

**Recommendation:** Option A. It keeps the schema file authoritative ("everything this table needs to exist is declared here") and makes the dependency obvious during code review. Option B becomes second-best when an extension isn't tied to a specific schema (e.g., a `pg_stat_statements` setup migration).

---

## Acceptance criteria

- [ ] A schema declaring `extensions: ['vector']` causes `bun strav generate:migration -m "..."` to emit `CREATE EXTENSION IF NOT EXISTS "vector";` in the migration's prologue (or a sibling SQL file the runner applies before any `CREATE TABLE`).
- [ ] The generated `down` mirrors with `DROP EXTENSION IF EXISTS "vector";`.
- [ ] Multiple schemas declaring the same extension produce one prologue statement, not duplicates.
- [ ] Adding a new extension to an existing schema produces a fresh migration that contains only the new `CREATE EXTENSION` (not a re-emission of every existing extension).
- [ ] Removing an extension from every schema produces a migration that contains the matching `DROP EXTENSION` and nothing else extension-related.
- [ ] `bun strav compare` reports schema/database drift correctly when an extension is missing on the live database.
- [ ] A typecheck-time error is raised if a schema declares `extensions: [...]` containing a non-string or an unknown identifier (typed as a literal union of supported extension names? Or open `string` for forward compatibility — call it).

---

## Affected files in musagete (forward path once upstream lands)

- `docs/specs/slices/002-workspace-and-space-bootstrap.tech.md` — the "pgvector deferred" paragraph reverts to a normal Tech Spec entry; the consuming slice picks it up.
- `docs/specs/slices/005-search-cmdk-and-ask-the-kb.md` — `database/schemas/embedding.ts` declares `extensions: ['vector']` (or equivalent per the chosen shape).
- This file is deleted, mirroring slice 001's `strav-parent-fk-uniqueness.md` removal pattern.

---

## Likely framework implementation surface

- `database/schemas/<n>.ts` schema files: a new `extensions?: string[]` key in `defineSchema`'s second-arg type.
- `SchemaRegistry.register(...)` (or wherever schemas are walked at generate time): collect + deduplicate.
- `MigrationGenerator` (the diff-and-emit code): produce the prologue/down statements; ensure idempotence; ensure the prologue runs before any `CREATE TABLE` in the generated transaction.
- `MigrationRunner`: nothing to change if the prologue is part of the same transaction file.
- Tests under `node_modules/@strav/database/tests/` (an `extensions.test.ts` mirroring `tenanted_*.test.ts`).
