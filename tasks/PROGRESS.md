# Progress log

Append-only. Newest at the bottom. One section per completed task.
Written by the routine loop (see [ROUTINE.md](ROUTINE.md) step 7).

Format:

```
## <YYYY-MM-DD> — <task-id> <title>
- changed: <what>
- files: <key paths>
- verify: <typecheck/lint/test result>
- follow-up: <anything noticed, or none>
- commit: <short message>
```

---

<!-- entries below -->

## 2026-07-14 — DB0-01 .editorconfig + refresh root README.md
- changed: added `.editorconfig` (UTF-8, LF, final newline, trim trailing whitespace, 2-space indent; markdown exempted from trailing-whitespace trimming so hard line breaks survive). Rewrote `README.md` in English: what/why, a Stack line, and a "How it builds itself" section pointing at `tasks/README.md` + the `/loop` one-liner.
- files: `.editorconfig`, `README.md`
- verify: config/docs only — no build tooling exists yet (pnpm workspace lands in DB0-02), so nothing to typecheck/lint/test. Confirmed both files present and correct; touches neither `apps/**` nor `packages/**`, so no learn-log report required (Stop hook doesn't ask).
- follow-up: none. Next eligible: DB0-02 (pnpm workspace).
- commit: tasks(DB0-01): editorconfig + english readme

## 2026-07-14 — DB0-02 pnpm workspace
- changed: turned the repo into a pnpm monorepo. `pnpm-workspace.yaml` globs `apps/*` + `packages/*`; root `package.json` (`private`, `packageManager: pnpm@11.9.0`, `engines.node >=20`, passthrough scripts build/dev/lint/test/typecheck delegating to `pnpm -r`); `.npmrc` (`auto-install-peers`, non-strict peer deps). Also added `.gitattributes` (`* text=auto eol=lf`) to enforce LF and clear the CRLF/`.editorconfig` mismatch Git warned about on DB0-01.
- files: `pnpm-workspace.yaml`, `package.json`, `.npmrc`, `.gitattributes`, `pnpm-lock.yaml` (generated)
- verify: `pnpm install` → "Already up to date", exit 0, using pnpm v11.9.0 (matches the pinned version, no corepack issue); `pnpm-lock.yaml` generated; `node_modules/` correctly git-ignored. Root scripts are no-ops until packages exist (DB0-05+). Config only — touches neither `apps/**` nor `packages/**`, so no learn-log required.
- follow-up: `.gitattributes` bundled here (one line, foundational repo config) rather than as its own task. pnpm noted 11.9.0 → 11.13.0 available; left pinned intentionally for reproducibility. Next eligible: DB0-03 (shared TS config).
- commit: tasks(DB0-02): pnpm workspace

## 2026-07-14 — DB0-03 Shared TS base config
- changed: added `tsconfig.base.json` — strict (+ `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`), ES2022 target/lib, Bundler/ESM flavor (`module ESNext` + `moduleResolution Bundler` + `verbatimModuleSyntax` + `isolatedModules`), `declaration`/`declarationMap`/`sourceMap`, `skipLibCheck`. Added solution-style root `tsconfig.json` (`files: []`, `references: []` — packages register themselves later). Added `typescript@^5.9.2` (resolved 5.9.3) as a root devDependency so `tsc` can run.
- files: `tsconfig.base.json`, `tsconfig.json`, `package.json` (+ devDep), `pnpm-lock.yaml` (generated)
- verify: created a throwaway `_tsprobe/` package extending the base with a strict source file, ran `pnpm exec tsc -p _tsprobe/tsconfig.json --noEmit` → passes (exit 0), then removed the probe. Config only — touches neither `apps/**` nor `packages/**`, so no learn-log required.
- follow-up: base is deliberately Bundler/ESM; `apps/api` (NestJS) will override `module=CommonJS` + `emitDecoratorMetadata`/`experimentalDecorators` + `verbatimModuleSyntax=false` in its own tsconfig (noted in the base file's comment). typescript pinned to a caret 5.9 range (5.9.3 installed; 7.0.2 available but not adopted). Next eligible: DB0-04 (ESLint + Prettier + husky).
- commit: tasks(DB0-03): shared ts base config

