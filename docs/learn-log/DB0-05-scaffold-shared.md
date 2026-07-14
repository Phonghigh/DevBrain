# DB0-05 — Scaffold packages/shared

**Status:** not-studied · **Difficulty:** ⭐⭐ · **Date:** 2026-07-14
**Commit:** `tasks(DB0-05): scaffold packages/shared` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

We created the first real piece of code in the project: a small shared "library"
package that both the backend and the frontend will import from, so they always
agree on the same rules and data shapes instead of each guessing separately.

## 2. Why this task matters / where it fits

This is Phase 0 (Foundations) — see the [spec](../superpowers/specs/001-devbrain-v1.md)
§4 "Architecture & Stack". Before this task, the repo only had *config* (linters,
TypeScript rules, the pnpm workspace) — nothing you could actually `import` and run.
`packages/shared` is the first package with real, importable code: it holds the
`LINT_LIMITS` constant (the numbers that decide when the app warns you "you're just
copying, not writing your own note" — see spec §6.3). After this task, `apps/api` and
`apps/web` (built in later tasks) can both `import { LINT_LIMITS } from '@devbrain/shared'`
and get the exact same numbers — no risk of the backend and frontend quietly
disagreeing about what counts as "too much copying."

## 3. The problem

Nothing conceptually hard here — the interesting part is *why* each piece of
boilerplate exists, because a beginner copy-pasting a `package.json` without
understanding it will be lost the moment something breaks.

## 4. Concepts you need to know

### Monorepo package (a "workspace package")
- **Plain definition:** a small, self-contained folder of code that lives inside your
  main project but has its own `package.json`, and can be `import`ed by other folders
  in the same project as if it were a real installed npm package.
- **Analogy:** think of your repo as an apartment building. Each package is its own
  apartment with its own front door (`package.json`) — but they all share the same
  building utilities (the root `pnpm-workspace.yaml`, the root `tsconfig.base.json`).
- **Why we use it here:** `apps/api` and `apps/web` are two *separate* npm packages.
  Without a shared package, you'd have to copy the `LINT_LIMITS` numbers into both —
  and the moment someone changes one but forgets the other, the app lies to itself.

### `exports` map in package.json
- **Plain definition:** a field in `package.json` that tells Node.js/bundlers exactly
  which file to load when someone writes `import ... from '@devbrain/shared'`.
- **Analogy:** it's the building directory in the lobby — "apartment 3B is reached
  through this door," not through a random window.
- **Why we use it here:** we point `"."` at `./dist/index.js` (the *compiled* output,
  not the raw TypeScript source) — so consumers always get plain, already-checked
  JavaScript, never `.ts` files their own tools might not understand.

### `tsc -b` (TypeScript project references / "composite" build)
- **Plain definition:** a mode where TypeScript understands that your monorepo is made
  of multiple connected packages, and can build them *in the right dependency order*
  from one root command.
- **Analogy:** like a recipe with sub-recipes — `tsc -b` reads "make the sauce before
  the pasta" instead of you remembering to run each step by hand.
- **Why we use it here:** the root `tsconfig.json` now has
  `"references": [{ "path": "./packages/shared" }]`. Later, when `apps/api` also
  becomes a reference, running `tsc -b` once at the root will type-check everything
  in the correct order automatically.

### Vitest (a test runner)
- **Plain definition:** a tool that runs your test files (functions that check "does
  my code actually do what I think it does?") and reports pass/fail.
- **Analogy:** a very literal friend who runs your recipe exactly as written and tells
  you if the cake didn't rise, instead of just tasting it and saying "seems fine."
- **Why we use it here:** we wrote one tiny test file
  (`src/__tests__/smoke.test.ts`) that checks `LINT_LIMITS.maxWords === 200` and
  `LINT_LIMITS.overlapPct === 0.35` — a "smoke test" (a very basic check that just
  proves the package works at all, named after "check for smoke before checking for
  fire").

## 5. How I approached it

- **Build tool choice:** I considered using `tsup` (a bundler that also compiles
  TypeScript) — that's what the reference project (XmindClone) used for its packages.
  I chose plain `tsc` instead, because this task's acceptance criteria only asked for
  "package builds; a sample vitest test passes," and plain `tsc` is simpler to explain
  to a beginner (one tool, one job: compile TypeScript to JavaScript) than a bundler
  with its own config layer. If a package later needs bundling (e.g. for a browser
  target), that's a decision for that task, not this one.
- **What to export first:** the spec (§6.3) already names the two numbers the lint
  rule needs (`overlapPct: 0.35`, `maxWords: 200`), so `LINT_LIMITS` was the obvious
  first real export — it's genuinely needed by two different apps later (api and web),
  which is exactly the situation `packages/shared` exists for.
- **Test file location:** kept `__tests__` next to the code it tests
  (`src/__tests__/`) rather than a separate top-level `tests/` folder — this is a
  common convention (keeps related files close) and matches XmindClone.

## 6. Research trail — how I figured it out

No web research was needed for this task — it's a direct continuation of the
config work from DB0-01 through DB0-04, using patterns already established in the
harness. What I *did* do was read the reference project's already-scaffolded package
(`D:/project/XmindClone/packages/core/tsconfig.json`) to confirm the shape of a
`composite: true` monorepo package `tsconfig.json`, then adapted it (dropped the
`tsup` bundling layer they used, since I chose plain `tsc` for this simpler package).

## 7. Where I got stuck & how I recovered

- **Symptom:** `pnpm install` failed with
  `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.28.1` (exit code 1).
- **Cause:** `vitest` (the test runner) depends on `esbuild` under the hood, and
  `esbuild` has a "postinstall script" — a bit of code that runs automatically right
  after it's installed, to download a small platform-specific program. Recent `pnpm`
  versions **block postinstall scripts by default** as a security measure (a
  malicious package could otherwise run arbitrary code on your machine just from
  `pnpm install`), and it wrote a placeholder line into `pnpm-workspace.yaml`
  (`allowBuilds: esbuild: set this to true or false`) asking me to decide.
- **Fix:** `esbuild` is a very well-known, widely-used tool (not some random
  unverified package), and its postinstall script only downloads its own binary — so
  I changed the placeholder to `esbuild: true` (with a comment explaining why) and
  re-ran `pnpm install`, which then succeeded. **Lesson for next time:** when pnpm
  blocks a build script, don't blanket-allow everything — check what the package is
  and what its script does first. Blanket-allowing is how supply-chain attacks sneak
  malicious postinstall scripts through.
- **Smaller snag:** my first `tsconfig.json` for the package included the whole `src`
  folder, which meant the compiled `dist/` output also contained the *test* files
  (`dist/__tests__/...`) — tests should never ship in a package's build output. I
  fixed it by adding `"exclude": ["src/__tests__"]` to the package's `tsconfig.json`,
  rebuilt, and confirmed `dist/` only contained `index.*` files afterward.

## 8. The solution, step by step

1. Created `packages/shared/package.json` — name `@devbrain/shared`, `"type": "module"`
   (so Node treats `.js` files as ES modules), an `exports` map pointing at
   `./dist/index.js`, and scripts for `build`/`typecheck`/`lint`/`test`.
2. Created `packages/shared/tsconfig.json` extending the root `tsconfig.base.json`,
   with `composite: true` (required for project references), `outDir: dist`, and
   `exclude: ["src/__tests__"]` (keep tests out of the shipped build).
3. Created `packages/shared/src/index.ts` exporting the `LINT_LIMITS` constant.
4. Created `packages/shared/vitest.config.ts` (Node environment — this package has no
   browser code) and `packages/shared/src/__tests__/smoke.test.ts`.
5. Added `packages/shared` to the root `tsconfig.json`'s `references` array, so
   `tsc -b` at the root picks it up.
6. Ran `pnpm install` (hit the esbuild build-script block, see §7, fixed it), then
   verified with the commands in §9.

## 9. How to verify it yourself

```bash
pnpm --filter @devbrain/shared build     # compiles src/ -> dist/
pnpm --filter @devbrain/shared test      # runs the vitest smoke test
pnpm --filter @devbrain/shared typecheck # tsc --noEmit, no dist output
pnpm exec tsc -b tsconfig.json           # root-level build via project references
pnpm exec eslint packages/shared         # lint the new package
```
Expected: build produces `packages/shared/dist/{index.js,index.d.ts,...}` (no
`__tests__` folder inside `dist/`); the test command shows `2 passed`; both
typecheck commands exit with no errors; eslint reports no problems.

## 10. Gotchas / things to remember

- If `pnpm install` ever fails with `ERR_PNPM_IGNORED_BUILDS` again (a new dependency
  with a postinstall script), **check what the package is before allowing it** — run
  `pnpm approve-builds` and look at the package name, don't just flip everything to
  `true`.
- Keep test files out of a package's `tsconfig.json` `include`/emit path (via
  `exclude`) so they never leak into `dist/` — a shipped package should only contain
  the actual product code.
- The package name is `@devbrain/shared` (scoped, with an `@`) — when importing it
  elsewhere, it's `import { LINT_LIMITS } from '@devbrain/shared'`, not
  `'shared'` or `'packages/shared'`.

## 11. Glossary

| Term | Plain meaning |
|---|---|
| Monorepo | one git repository containing multiple related packages/apps, instead of one repo per package |
| Workspace package | a package inside a monorepo, importable by its `name` field, without being published to npm |
| `composite: true` | a TypeScript setting that lets a package be part of a multi-package "project reference" build |
| Postinstall script | code a package runs automatically right after `npm`/`pnpm install` finishes installing it |
| Smoke test | a very basic test that just checks "does this even work at all," before testing edge cases |

## 12. Learn next

- The next task, **DB0-06**, scaffolds `apps/api` (a real NestJS server) — that's
  where you'll meet *modules*, *controllers*, and *dependency injection* for the
  first time, which are the core ideas of how NestJS organizes a backend.
- Worth skimming later: how `tsc -b` (project references) decides *when* to rebuild a
  package versus skip it (it uses the `.tsbuildinfo` file we saw get created/removed
  during verification) — not needed yet, but it'll matter once there are 3+ packages.
