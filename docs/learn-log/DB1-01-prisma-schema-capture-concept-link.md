# DB1-01 — Prisma schema `Capture`/`Concept`/`Link` + first migration

**Status:** not-studied · **Difficulty:** ⭐⭐ · **Date:** 2026-07-18
**Commit:** `tasks(DB1-01): prisma schema capture/concept/link` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

We told the database "here are the 3 kinds of things you will store" (raw pastes,
self-written notes, and the links between notes), and asked Prisma to build the actual
tables for them — this is the first task where DevBrain has a real, shaped database
instead of an empty shell.

## 2. Why this task matters / where it fits

This is the first task of **Phase 1 — Capture + DB core**, and it implements the data
model from [spec §5](../superpowers/specs/001-devbrain-v1.md#5-data-model-prisma--3-tables)
exactly as written there. Before this task, `apps/api` had Prisma *wired up* (DB0-07)
but the schema was deliberately empty — zero tables. After this task, the database has
3 real tables (`Capture`, `Concept`, `Link`) and a typed client that knows about them.
Every later Phase 1/2 task (creating captures, distilling notes, wikilinks, backlinks)
builds directly on top of these 3 tables — nothing after this point is possible without
them existing.

## 3. The problem

This was mostly "copy the schema from the spec into the real file" — the shape was
already decided in the brainstorm (spec §2, decision 5). The actual thinking was in two
places: (1) understanding *why* the schema is shaped the way it is (self-relations,
optional fields, unique constraints), and (2) a real gotcha in step 4 below where the
migration ran successfully but the generated code was silently stale.

## 4. Concepts you need to know

### Schema-first ORM (Prisma)
- **Plain definition:** you write down the "shape" of your data once, in a `.prisma`
  file, and a tool generates both the SQL to build the tables *and* the TypeScript
  types/functions you call in code — from the same source.
- **Analogy:** it's like drawing a blueprint once, and getting both the actual building
  *and* the furniture catalogue automatically generated from it, instead of building the
  house by hand and then writing the catalogue separately (and risking the two drifting
  apart).
- **Why we use it here:** the schema is the single source of truth for both the SQLite
  tables and the `prisma.capture.create(...)`-style typed calls used later in
  `CapturesModule`/`ConceptsModule`.

### Migration (a versioned, replayable change to the database)
- **Plain definition:** a small SQL file that describes *one* change to the database
  (e.g. "add these 3 tables"), saved to disk and given a timestamped name, so the
  history of database changes is tracked the same way git tracks code changes.
- **Analogy:** think of it like a git commit, but for the database's structure instead
  of your source files — each migration is a step you can replay on any machine to
  arrive at the same database shape.
- **Why we use it here:** `prisma migrate dev --name capture-concept-link` compared the
  new schema to the (empty) database, generated
  `prisma/migrations/20260718015621_capture_concept_link/migration.sql`, and applied it
  to `dev.db`. Anyone who clones the repo and runs migrations gets the identical 3
  tables.

### Self-relation / reverse query ("backlinks")
- **Plain definition:** a table that refers to *itself* through another table (here:
  `Concept` → `Link` → `Concept`), so you can ask "who points at me?" as well as "who do
  I point at?".
- **Analogy:** it's like a footnote system where every footnote also secretly remembers
  which page cited it — so you can jump either direction: forward to what a note links
  to, or backward to everyone who links to a given note.
- **Why we use it here:** `Link.toSlug` is just a plain string (not a foreign key to
  `Concept.id`), on purpose — it can point at a slug that doesn't have a `Concept` row
  yet (a "stub", spec §5). Backlinks are computed later by literally querying
  `Link.where(toSlug = X)`, not stored redundantly.

### Stale generated code
- **Plain definition:** generated files (code a tool writes for you, not code a human
  types) can silently fall out of sync with their source if the generator doesn't
  re-run — you keep the old generated output even though the source changed.
- **Analogy:** it's like updating a recipe in a cookbook but the printed shopping list
  taped to your fridge still shows the old ingredients — it looks fine until you notice
  it's missing something.
- **Why we use it here:** this bit me directly in step 7 below.

## 5. How I approached it

- Copied the 3 models (`Capture`, `Concept`, `Link`) from spec §5 into
  `apps/api/prisma/schema.prisma` verbatim — the schema was already fully decided, so
  there was no design choice to make here, only faithful transcription plus removing the
  now-stale "no models yet" comment DB0-07 had left at the top of the file.
- Considered whether to name the migration something generic like `init` vs. descriptive
  like `capture-concept-link`. Chose the descriptive name (matches how DB0-07 named its
  empty migration `init-empty`) — a migration folder name is permanent history, so a
  name that says *what* changed is more useful than a generic one when you're scrolling
  `prisma/migrations/` later.
- For verification, went one step further than "did `migrate dev` exit 0": wrote a
  throwaway e2e test that actually created a `Capture`, a `Concept` sourced from it, and
  a `Link`, then ran the exact "backlink" query pattern spec §5 describes
  (`Link.where(toSlug = X)` + join `fromConcept`) — proving the schema works at runtime,
  not just that a migration file was written. Deleted the probe test after (same
  disposable-probe pattern DB0-07/DB0-08/DB0-09 used).

## 6. Research trail — how I figured it out

- Ran `pnpm exec prisma migrate dev --name capture-concept-link` inside `apps/api` →
  it printed "Applying migration ... Your database is now in sync with your schema" —
  looked like full success.
- Read the generated `migration.sql` directly to sanity-check the SQL matched the
  schema: 3 `CREATE TABLE` statements, the `Concept_sourceCaptureId_fkey` foreign key,
  and both unique indexes (`Concept.slug`, `(fromConceptId, toSlug)` on `Link`) — all
  correct.
- Went looking inside `apps/api/src/generated/prisma/` to confirm the typed client
  actually knew about the new models (the DB1-01 "done when" line explicitly says
  "typed client generated", not just "migration applied" — two different claims).
  `grep`-ing for `Capture`/`Concept`/`Link` across the generated files came back with
  almost nothing, which was the first sign something was wrong (see §7).
- Re-ran `pnpm exec prisma generate` directly, then re-grepped
  `src/generated/prisma/internal/class.ts` and found the embedded `inlineSchema` /
  `runtimeDataModel` now contained the 3 real models.
- Read `apps/api/src/prisma/prisma.service.ts` (from DB0-07) to confirm how the app
  actually imports the generated client (`from '../generated/prisma/client'`), so the
  probe test could import it the same way instead of guessing an import path.

## 7. Where I got stuck & how I recovered

- **Symptom:** `prisma migrate dev` reported full success and created/applied the
  migration correctly, but `apps/api/src/generated/prisma/internal/class.ts` still
  embedded the *old, empty* schema (`"inlineSchema": "...Deliberately no models
  yet..."`, `"runtimeDataModel": {"models": {}}`) — the typed client had zero knowledge
  of `Capture`/`Concept`/`Link` even though the database tables existed and `tsc`
  reported no errors (because nothing in the code yet referenced the new models, so
  there was nothing for the type checker to catch).
- **Cause:** in this Prisma version/setup, `migrate dev` didn't trigger a fresh
  `prisma generate` the way I expected — the client generation step didn't pick up the
  schema change on its own in this run.
- **Fix:** ran `pnpm exec prisma generate` explicitly, then verified by re-reading the
  generated `internal/class.ts` and `client.ts` — the `inlineSchema` and
  `runtimeDataModel` now matched the new schema, and `client.ts` exported `Capture`,
  `Concept`, `Link` types with a JSDoc example showing `prisma.capture.findMany()`. This
  is exactly the class of bug DB0-07's follow-up warned about with stale
  `.tsbuildinfo` — "trust, but verify the generated artifact, don't just trust the exit
  code." I'd recommend always running `prisma generate` as an explicit, separate step
  after any schema change, rather than assuming `migrate dev` covers it.

## 8. The solution, step by step

1. Opened `apps/api/prisma/schema.prisma` and pasted in the `Capture`, `Concept`, `Link`
   models from spec §5, removing the stale "no models yet" header comment.
2. Ran `pnpm exec prisma migrate dev --name capture-concept-link` from `apps/api/` —
   this created `prisma/migrations/20260718015621_capture_concept_link/migration.sql`
   and applied it to `dev.db`.
3. Ran `pnpm exec prisma generate` explicitly (see §7 for why this couldn't be skipped)
   to regenerate `src/generated/prisma/`.
4. Verified the generated client actually contains the 3 models by reading
   `internal/class.ts` (`runtimeDataModel`) and `client.ts` (exported `Capture`/
   `Concept`/`Link` types).
5. Wrote a throwaway vitest e2e test that created a `Capture` → `Concept` → `Link` and
   ran a backlink-style query, confirmed it passed, then deleted the test file (it isn't
   part of this task's permanent test suite — `CapturesModule`/`ConceptsModule` will get
   their own real tests in DB1-03+).
6. Ran the full verification suite (`pnpm -w typecheck`, `pnpm -w lint`, `pnpm -w test`)
   from a clean root state to confirm nothing else broke.

## 9. How to verify it yourself

```bash
cd apps/api
pnpm exec prisma migrate dev --name capture-concept-link
pnpm exec prisma generate
cat prisma/migrations/*/migration.sql   # should show 3 CREATE TABLE statements
cd ../..
pnpm -w typecheck && pnpm -w lint && pnpm -w test
```
Expected: the migration output ends with "Your database is now in sync with your
schema"; `migration.sql` shows `Capture`, `Concept`, `Link` tables plus the
`Concept_sourceCaptureId_fkey` foreign key and the two unique indexes
(`Concept.slug`, `(fromConceptId, toSlug)` on `Link`); typecheck/lint/test all exit 0
across all 3 workspace packages.

## 10. Gotchas / things to remember

- **Don't trust `migrate dev`'s success message alone** for "is the typed client
  up to date" — it answers "is the *database* in sync with the schema", not "is the
  *generated TypeScript* in sync with the schema." Run `prisma generate` explicitly and
  check its own output too.
- `Link.toSlug` is a plain `String`, not a foreign key — this is intentional (spec §5,
  "may be a body-less stub"), not a missing constraint. Don't "fix" it to a relation
  later without re-reading why.
- `apps/api/src/generated/prisma/` is git-ignored (`.gitignore`, added in DB0-07) — it
  regenerates from `postinstall: "prisma generate"` on every fresh `pnpm install`, so it
  never needs to be committed.

## 11. Glossary

| Term | Plain meaning |
|---|---|
| Schema | The written description of what tables/fields your database has |
| Migration | A saved, timestamped SQL file describing one change to the database's structure |
| Generated client | Auto-written TypeScript code that lets you call `prisma.capture.create(...)` with full autocomplete/type-checking |
| Foreign key | A column that points at another table's row, enforced by the database |
| Unique index | A database rule saying "no two rows may have the same value(s) here" |
| Stub | A `Concept` row auto-created because something linked to a slug that didn't exist yet (has no real `body`) |

## 12. Learn next

- DB1-02 (Shared Capture DTOs) — the next task turns these Prisma models into
  request/response shapes (`CreateCaptureDto`, `CaptureDto`) that `apps/api` and
  `apps/web` both import from `packages/shared`, instead of leaking Prisma types
  straight into the API.
- Worth reading later: [Prisma migrate docs](https://pris.ly/d/migrate) on the
  difference between `migrate dev` (local, interactive) and `migrate deploy` (CI/prod,
  non-interactive) — DevBrain is single-user/local for v1 so only `migrate dev` is used
  so far.
