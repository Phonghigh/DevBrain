# DB1-02 — Shared Capture DTOs

**Status:** not-studied · **Difficulty:** ⭐⭐⭐ · **Date:** 2026-07-18
**Commit:** `tasks(DB1-02): shared capture dtos` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

We wrote down, once, in a shared place, exactly what a "Capture" looks like when it
travels between the browser and the server — so both sides agree on the shape without
either of them copying it from the other or trusting the database's internal shape
directly.

## 2. Why this task matters / where it fits

This is the second task of **Phase 1 — Capture + DB core**
([spec §5](../superpowers/specs/001-devbrain-v1.md#5-data-model-prisma--3-tables) and
[§6.1](../superpowers/specs/001-devbrain-v1.md#61-capture-friction--0-on-purpose)). It
sits between DB1-01 (the database has a `Capture` table) and DB1-03 (`POST /captures`,
the first real route). DTOs are the contract for that route before the route exists —
DB1-03 will import `CreateCaptureDto`/`CaptureDto` straight from `packages/shared`
instead of inventing its own request/response shapes.

## 3. The problem

The DTO shapes themselves were simple (spec §5/§6.1 basically dictate them). The real
problem was **making `apps/api` able to import from `packages/shared` at all** — this
is literally the first time `apps/api` imports anything from the shared package (only
`apps/web` had done it before, in DB0-08). That triggered the exact same category of
bug DB0-08 hit, in a place nobody had tested yet.

## 4. Concepts you need to know

### DTO (Data Transfer Object)
- **Plain definition:** a plain type describing the *shape of data crossing a
  boundary* (like an HTTP request/response), deliberately kept separate from your
  database's internal representation.
- **Analogy:** it's like a customs declaration form — it doesn't need every detail
  about what's inside your suitcase, just the specific fields the border needs to see,
  in a fixed, agreed format.
- **Why we use it here:** `Capture` (the Prisma model) and `CaptureDto` (what the API
  sends over JSON) look similar but aren't identical on purpose — Prisma's
  `createdAt` is a real `Date` object; `CaptureDto.createdAt` is a `string` (ISO format),
  because JSON has no native date type. Keeping them as separate types stops a Prisma
  schema change from silently changing the API's public contract.

### Workspace dependency (`workspace:*`)
- **Plain definition:** in a pnpm monorepo, one package can depend on another package
  that lives in the *same repo* (not on npm) by writing `"workspace:*"` as its version.
- **Analogy:** it's like two departments in the same building sharing a filing cabinet
  down the hall, instead of one department mailing photocopies to the other every time
  something changes.
- **Why we use it here:** `apps/api/package.json` now lists
  `"@devbrain/shared": "workspace:*"` — `pnpm install` links it straight to
  `packages/shared` on disk (no publishing, no version bumps needed).

### TypeScript project references + `tsc -b` (build mode)
- **Plain definition:** a way to tell TypeScript "this project depends on that other
  project — build the other one first if its output is missing or stale," instead of
  assuming the dependency's compiled output already exists.
- **Analogy:** it's like a recipe that says "first make the sauce (see page 12), *then*
  assemble the dish" — rather than assuming a jar of sauce is already sitting in the
  fridge.
- **Why we use it here:** `@devbrain/shared` resolves through its `package.json`
  `exports` map to `dist/index.js` — a file that only exists after `packages/shared` is
  built. Without a project reference, `tsc` just says "file not found" (`TS2307`) if
  nobody built it first. DB0-08 already solved this for `apps/web`; this task hit the
  identical problem for `apps/api` and applied the identical fix: add
  `"references": [{ "path": "../../packages/shared" }]` to `apps/api/tsconfig.json`,
  and change its `typecheck` script from `tsc --noEmit` to `tsc -b` (build mode, which
  understands references and builds dependencies on demand).

### `noEmit` vs. a build tool that needs real output
- **Plain definition:** `noEmit: true` tells TypeScript "only check my code for errors,
  don't actually write any `.js` files" — useful when something *else* (Vite, NestJS's
  builder) produces the real output.
- **Analogy:** it's like a proofreader who marks up a manuscript in red pen but never
  prints a clean final copy — someone else's job is to actually print the book.
- **Why we use it here (and the near-miss):** `apps/web`'s tsconfig already sets
  `noEmit: true` because Vite does the real compiling. I assumed the same pattern would
  be safe for `apps/api` — but `apps/api/tsconfig.json` is the *same file* `nest build`
  reads to produce the real, runnable server. Setting `noEmit: true` there made
  `nest build` silently produce **no `dist/main.js` at all**. Caught by testing, not by
  reasoning — see §7.

## 5. How I approached it

- Put `CaptureStatus`/`CreateCaptureDto`/`CaptureDto` in a new `capture.ts` file inside
  `packages/shared/src/`, re-exported from `index.ts` — rather than piling everything
  into the existing single-file `index.ts`, since this package will grow more DTOs as
  Phase 2 lands (`ConceptDto`, `LintWarning`, etc.), and one file per data area is
  easier to navigate than one giant file.
- Chose `task: string | null` (not `task?: string`) for `CaptureDto`, matching exactly
  what Prisma's generated `Capture.task` type actually is (`string | null` — a real
  database column that's either filled in or SQL `NULL`, never simply "absent" the way
  an optional object property would be). `CreateCaptureDto.task` **is** optional
  (`task?: string`) instead, because that's the *input* side — the caller can just
  omit it entirely when POSTing.
- For "consumed by api" (the task's explicit "done when" line), rejected touching the
  existing `HealthController` just to prove an import works (that would be a
  misleading, unrelated change to an unrelated endpoint). Instead wrote
  `apps/api/src/captures/capture.mapper.ts` — a small, real, forward-looking piece of
  work: converting a Prisma `Capture` row into a `CaptureDto` (Date → ISO string) is
  something `CapturesModule` will need in DB1-03 regardless, so this isn't invented
  scope, it's the natural place the DTO gets consumed *first*. Deliberately did **not**
  build the `CapturesModule`/controller/route itself — that's DB1-03's job.
- Excluded `*.spec.ts` from `apps/api`'s `tsconfig.json` `include`/`build` output. This
  is the api's first colocated unit-test file (everything before this was `test/*.e2e-
  spec.ts`, already outside `include`) — without the exclusion, `nest build` would have
  compiled `capture.mapper.spec.ts` straight into `dist/`, the same "test code leaking
  into the shipped build" bug DB0-05 already fixed once for `packages/shared`.

## 6. Research trail — how I figured it out

- Read `packages/shared/src/index.ts` and `package.json` first, to see the existing
  export shape and the `LINT_LIMITS` precedent before adding new exports.
- Checked `tasks/backlog/` — found only `phase-0.md` existed; per `ROUTINE.md` step 3,
  wrote `tasks/backlog/phase-1.md`'s DB1-02 section from the `INDEX.md` line + spec
  §5/§6.1 before implementing.
- Read `apps/web/package.json` and `apps/web/tsconfig.json` to copy the exact
  `workspace:*` + `references` pattern DB0-08 already proved works, rather than
  reinventing it.
- Read `apps/api/vitest.config.ts` to find the real unit-test include pattern
  (`src/**/*.spec.ts`) so the new test file would actually get picked up (as opposed to
  guessing a `__tests__/` folder name that only `packages/shared` uses).
- Read `apps/api/nest-cli.json` to check whether `nest build` reads a separate tsconfig
  from the one `tsc` uses for typechecking — it doesn't; both read the same
  `tsconfig.json`, which is exactly what made the `noEmit` mistake in §7 possible.
- Deliberately **reproduced the DB0-08-style bug on purpose** before trusting the fix:
  deleted `packages/shared/dist` and ran `pnpm --filter api typecheck` alone, watched it
  fail with the real `TS2307: Cannot find module '@devbrain/shared'`, *then* applied the
  reference fix and re-ran the same clean-state test to confirm it now passes. Proof
  before trust, not the other way round.

## 7. Where I got stuck & how I recovered

- **Symptom 1 (expected, reproduced on purpose):** `pnpm --filter api typecheck` failed
  with `TS2307: Cannot find module '@devbrain/shared'` right after adding the import,
  when `packages/shared/dist` didn't exist yet.
  **Cause:** `apps/api` had never imported `@devbrain/shared` before this task, so this
  fresh-clone failure mode (identical to DB0-08's) had simply never been exercised for
  `apps/api`.
  **Fix:** added `"references": [{ "path": "../../packages/shared" }]` to
  `apps/api/tsconfig.json` and switched its `typecheck` script to `tsc -b tsconfig.json`
  — same fix DB0-08 already validated for `apps/web`. Re-ran the clean-state test; it
  passed, `packages/shared/dist` got built automatically as a side effect.

- **Symptom 2 (a real near-miss, not just "it worked"):** after the fix above worked,
  I noticed `tsc -b` also emits `apps/api`'s own compiled output into `dist/` (unlike
  `apps/web`, which sets `noEmit: true` and never emits from `tsc` at all — Vite does
  the real build). To match that cleaner pattern, I added `noEmit: true` to
  `apps/api/tsconfig.json` too. **This silently broke the real build**: running
  `pnpm --filter api build` (`nest build`) afterward produced **no `dist/main.js` at
  all**, with no obvious error — because `nest build` reads the *same*
  `apps/api/tsconfig.json` that `tsc -b` uses, and it respects `noEmit` exactly like raw
  `tsc` would.
  **Cause:** unlike `apps/web` (where Vite is the sole thing that ever produces real
  output, so `tsc` can safely be "just a checker"), `apps/api/tsconfig.json` is shared
  between the typecheck script *and* the actual application build (`nest build`) — the
  two roles that are cleanly separated for `web` are the same file for `api`.
  **Fix:** reverted `noEmit: true`. Confirmed the "problem" it was meant to solve
  (typecheck also writing to `dist/`) is actually harmless: `nest-cli.json` sets
  `"deleteOutDir": true`, so the real `nest build` step (which always runs after
  `typecheck` in the CI order) deletes and rebuilds `dist/` from scratch anyway — the
  intermediate files `tsc -b` leaves behind never survive to be shipped. I'd flag this
  lesson clearly: **don't copy a convention (`noEmit: true`) from one package to another
  just because it looked clean — check first whether the target file is shared with
  something that needs real output.** Verified the fix by testing `nest build` in
  isolation both before and after touching `noEmit`, not just re-running the full suite
  and hoping.

## 8. The solution, step by step

1. Wrote `tasks/backlog/phase-1.md`'s DB1-02 section (no P1 detailed specs existed yet).
2. Added `CaptureStatus`, `CreateCaptureDto`, `CaptureDto` to
   `packages/shared/src/capture.ts`, re-exported from `src/index.ts`.
3. Added `packages/shared/src/__tests__/capture.test.ts` (JSON round-trip + the 3-status
   check).
4. Added `"@devbrain/shared": "workspace:*"` to `apps/api/package.json`, ran
   `pnpm install` to link it.
5. Added `apps/api/src/captures/capture.mapper.ts` (`toCaptureDto`) — the first real
   consumer of the shared DTO inside `apps/api`.
6. Added `apps/api/src/captures/capture.mapper.spec.ts` (colocated unit test, the api's
   first one — added `src/**/*.spec.ts` to `tsconfig.json`'s `exclude` so it doesn't
   leak into `nest build`'s `dist/`, matching `packages/shared`'s existing convention).
7. Hit the `TS2307` fresh-clone failure (§7) — fixed with a project reference +
   `tsc -b`.
8. Tried `noEmit: true` to match `apps/web`'s pattern, broke `nest build` (§7), reverted.
9. Ran the full CI-equivalent sequence (`typecheck` → `lint` → `test` → `build`) from a
   **fully clean state** (deleted every `dist/` and `.tsbuildinfo` in the repo first),
   then booted the compiled server for real and curled `/health` — 200 OK, clean
   shutdown by real PID (per DB0-07's Windows PID lesson).

## 9. How to verify it yourself

```bash
# from repo root
find . -name dist -not -path "*/node_modules/*" -exec rm -rf {} +
find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete
pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build
```
Expected: all 4 commands exit 0. `apps/api typecheck` should print nothing but still
build `packages/shared`'s `dist/` as a side effect (proof the project reference worked).
`apps/api/dist/main.js` should exist afterward, with no `.spec.js` files anywhere under
`apps/api/dist/`.

```bash
cd apps/api && node dist/main.js &
curl -i http://localhost:3000/health   # expect: 200 OK, {"status":"ok"}
```

## 10. Gotchas / things to remember

- **A shared tsconfig.json used by two different tools (typecheck *and* the real
  build) can't blindly copy `noEmit: true` from a package where those two roles are
  separate.** Check who else reads the file before adding it.
- Any *new* cross-package import (`apps/api` → `packages/shared`, or the reverse) is
  worth a clean-state test immediately — the failure mode (`TS2307`) only shows up once
  the consuming package's `tsconfig.json` doesn't already have the reference declared,
  and it's easy to not notice because a dirty local `dist/` masks it.
- `CaptureDto.task` is `string | null` (Prisma's real shape); `CreateCaptureDto.task` is
  `string | undefined` (an optional request field). They look similar but mean
  different things — don't unify them into one type.

## 11. Glossary

| Term | Plain meaning |
|---|---|
| DTO | A type describing data as it crosses a boundary (e.g. an HTTP request/response), kept separate from the database's internal shape |
| `workspace:*` | pnpm's way of saying "depend on another package in this same monorepo," linked from disk, not npm |
| Project reference | TypeScript config telling `tsc -b` "build that other project first if needed" |
| `tsc -b` (build mode) | The TypeScript compiler mode that understands and resolves project references, unlike plain `tsc` |
| `noEmit` | A tsconfig option meaning "check for errors only, don't write output files" |

## 12. Learn next

- DB1-03 (`POST /captures` + validation) — the next task builds the actual
  `CapturesModule`, using `CreateCaptureDto` for the request body and `toCaptureDto`
  (written in this task) to shape the response.
- Worth a closer look later: NestJS's `class-validator`/`class-transformer` pattern for
  turning a DTO from "just a TypeScript type" into something that actually validates
  incoming JSON at runtime — this task deliberately left that for DB1-03, per the spec's
  build order (§10).
