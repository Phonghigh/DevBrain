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

## 2026-07-14 — DB0-04 ESLint + Prettier + lint-staged + husky
- changed: added flat ESLint v9 config (`eslint.config.mjs`) — `@eslint/js` + `typescript-eslint` recommended (non-type-checked, no tsconfig project needed), `eslint-config-prettier` last so Prettier owns formatting; ignores dist/build/coverage/node_modules. Prettier config (`.prettierrc`: semi, single quotes, 100 cols, trailing-comma all, LF) + `.prettierignore` (build/deps/lockfile + all `*.md`, so hand-authored docs aren't reflowed). husky v9 (`prepare: husky`) + `.husky/pre-commit` running `pnpm exec lint-staged`; lint-staged runs `eslint --fix` + `prettier --write` on staged code, `prettier --write` on staged json/yaml/css/html (md excluded, matching .prettierignore). Root scripts: `lint:root` (`eslint .`), `format`, `format:check`, `prepare`.
- files: `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.husky/pre-commit`, `package.json` (devDeps + scripts + lint-staged block), `pnpm-lock.yaml` (generated)
- verify: `pnpm install` OK (husky prepare set `core.hooksPath=.husky/_`); `pnpm exec eslint .` → exit 0 (clean); staged a deliberately mis-formatted `_fmtprobe.ts` (`export const x=1`) and ran `pnpm exec lint-staged` → auto-fixed to `export const x = 1;`, then discarded the probe. Config only — touches neither `apps/**` nor `packages/**`, so no learn-log required.
- follow-up: root `lint` still delegates to `pnpm -r lint` (no-op until packages define a lint script, starting DB0-05); direct repo linting is `pnpm lint:root`. Newer majors available (eslint 10, lint-staged 17) but left on stable current majors. Next eligible: DB0-05 (scaffold packages/shared — first code task, ships the first learn-log lesson).
- commit: tasks(DB0-04): eslint + prettier + lint-staged + husky

## 2026-07-14 — DB0-05 Scaffold packages/shared
- changed: created `packages/shared` (`@devbrain/shared`), the first real code package: `package.json` (ESM `type: module`, `exports` map for `.` -> `./dist/index.js`, `build`/`typecheck`/`lint`/`test` scripts matching the root passthrough names), `tsconfig.json` (extends the base config, `composite: true` for project references, `outDir: dist`, excludes `src/__tests__` from the build), `src/index.ts` (first real export: `LINT_LIMITS` — the copy-overlap % and max-word thresholds from spec §6.3), `vitest.config.ts` (Node environment, no DOM), and `src/__tests__/smoke.test.ts` asserting the two threshold values. Wired the root `tsconfig.json`'s `references` array to `./packages/shared`.
- files: `packages/shared/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/__tests__/smoke.test.ts}`, `tsconfig.json`, `pnpm-workspace.yaml` (approved the `esbuild` build script), `pnpm-lock.yaml` (generated)
- verify: `pnpm --filter @devbrain/shared build` -> compiles cleanly, `dist/` contains only `index.*` (no leaked test files after excluding `src/__tests__`); `test` -> 2 passed; `typecheck` (both package-level and root `tsc -b tsconfig.json` via project references) -> clean; `pnpm exec eslint packages/shared` -> clean.
- follow-up: hit `ERR_PNPM_IGNORED_BUILDS` (pnpm blocking esbuild's postinstall script) — approved it explicitly in `pnpm-workspace.yaml` with a comment explaining why (well-known package, script just downloads its binary). First learn-log report written: [docs/learn-log/DB0-05-scaffold-shared.md](../docs/learn-log/DB0-05-scaffold-shared.md). Next eligible: DB0-06 (scaffold apps/api).
- commit: tasks(DB0-05): scaffold packages/shared

## 2026-07-14 — DB0-06 Scaffold apps/api (NestJS + /health)
- changed: created `apps/api` (name `api`, matches `pnpm --filter api`): a NestJS 11 API skeleton, hand-written (not via `nest new`, same approach as DB0-05's `packages/shared`). `AppModule` → `HealthModule` → `HealthController` (`@Controller('health')` + `@Get()`) returning `{status:'ok'}`. `apps/api/tsconfig.json` overrides the shared ESM/Bundler base with CommonJS + `experimentalDecorators`/`emitDecoratorMetadata` (required for NestJS's decorator-based DI) + `moduleResolution: Node10`. Uses `@nestjs/cli` (`nest build`/`nest start --watch`) rather than a fast/esbuild-based runner, since those skip decorator-metadata emission that Nest's DI needs.
- files: `apps/api/{package.json,tsconfig.json,nest-cli.json,src/main.ts,src/app.module.ts,src/health/{health.module,health.controller}.ts}`, `pnpm-lock.yaml` (generated)
- verify: `pnpm --filter api typecheck` clean (after adding `@types/node`, see follow-up); `pnpm --filter api build` → `dist/` produced; booted the compiled server directly (`node dist/main.js`) and curled it for real: `curl -i http://localhost:3000/health` → `HTTP/1.1 200 OK` `{"status":"ok"}`, boot log showed `AppModule`/`HealthModule` dependencies initialized + `Mapped {/health, GET} route`; `pnpm exec eslint apps/api` clean; root `pnpm build`/`typecheck`/`lint` (via `pnpm -r`) all pick up `apps/api` automatically alongside `packages/shared`.
- follow-up: hit a real typecheck error — `Cannot find name 'process'` in `main.ts` — fixed by adding `@types/node` as a devDependency (any package touching Node built-ins needs it; `packages/shared` didn't need it since `LINT_LIMITS` never touches Node APIs). Second learn-log report written: [docs/learn-log/DB0-06-scaffold-api.md](../docs/learn-log/DB0-06-scaffold-api.md). Next eligible: DB0-07 (Prisma in apps/api).
- commit: tasks(DB0-06): scaffold apps/api

## 2026-07-14 — DB0-07 Prisma in apps/api
- changed: wired Prisma + SQLite into `apps/api`. Ran `prisma init --datasource-provider sqlite`; the installed Prisma version (7.8.0) turned out to use a materially different architecture than the task notes assumed — no inline `url` in `schema.prisma` anymore, a separate `prisma.config.ts` (needs `dotenv`), and the client now requires an explicit driver adapter (`@prisma/adapter-better-sqlite3` + `better-sqlite3`) rather than reading a schema-baked URL. Added `PrismaService` (extends the generated `PrismaClient`, constructs it with the adapter, implements `onModuleInit`/`onModuleDestroy` for connect/disconnect) and `@Global()` `PrismaModule` (exports `PrismaService`), imported into `AppModule`. Added `import 'dotenv/config'` to `main.ts` so the running app (not just the CLI) loads `DATABASE_URL`. Added a `postinstall: "prisma generate"` script so the git-ignored generated client regenerates automatically on fresh installs. Cleaned up: removed the redundant auto-created `apps/api/.gitignore` (root `.gitignore` already covers `.env`/`*.db`; added `apps/api/src/generated/` there instead), added `apps/api/.env.example`, trimmed an irrelevant promotional comment from `schema.prisma`.
- files: `apps/api/{package.json,tsconfig.json,nest-cli.json,.env.example,prisma.config.ts,prisma/schema.prisma,src/main.ts,src/app.module.ts,src/prisma/{prisma.module,prisma.service}.ts}`, `.gitignore`, `pnpm-workspace.yaml` (approved `@prisma/engines`/`prisma`/`better-sqlite3` build scripts), `pnpm-lock.yaml` (generated)
- verify: `pnpm --filter api typecheck`/`build` clean; `prisma migrate dev --name init-empty` → created `dev.db`, correctly reported "already in sync" (schema has zero models by design — real models land in DB1-01); simulated a fresh clone (deleted `src/generated/` + `dev.db`, ran plain `pnpm install`) and confirmed `postinstall` regenerated the client automatically; booted the real compiled server and confirmed the boot log shows `PrismaModule dependencies initialized` (proves DI + `$connect()` succeeded) with `dev.db` present on disk, `/health` still 200 OK; root `pnpm build`/`typecheck`/`lint` all green across all 3 workspace packages.
- follow-up: hit and fixed two real bugs beyond the Prisma version mismatch — (1) a stale `.tsbuildinfo` (from `"incremental": true`, shared between the `build` and `typecheck` scripts) made `tsc` silently skip emitting after `dist/` was manually deleted; removed `incremental` from `apps/api/tsconfig.json` entirely to close off this class of bug. (2) On this Git Bash/Windows environment, bash's `$!` PID didn't match the real OS process for a backgrounded `node` process, leaving a zombie server holding port 3000 for a while (from the DB0-06 boot test) — killed it via the real PID read from the process's own boot log, and used that method for all subsequent boot tests. Third learn-log report written: [docs/learn-log/DB0-07-prisma-in-api.md](../docs/learn-log/DB0-07-prisma-in-api.md). Next eligible: DB0-08 (scaffold apps/web — its dep DB0-05 was already satisfied, so it's next despite DB1-01 also now being unblocked, per file order).
- commit: tasks(DB0-07): prisma in apps/api
