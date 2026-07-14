# Phase 0 — Foundations (detailed task specs)

Detailed specs for P0 tasks. The loop reads these (ROUTINE step 3). Later phases
(P1+) are derived on demand from the `INDEX.md` line + the spec.

Spec: [../../docs/superpowers/specs/001-devbrain-v1.md](../../docs/superpowers/specs/001-devbrain-v1.md).

---

### DB0-01 — .editorconfig + refresh root README.md

**Objective.** Establish baseline repo hygiene so every later file is consistent.

**Depends on.** _none_.

**Touches.** `.editorconfig`, `README.md`. (`.gitignore` already exists — extend only if a gap shows up.)

**Steps.**
1. Add `.editorconfig`: UTF-8, LF, final newline, trim trailing whitespace; 2-space indent for ts/tsx/js/json/yaml/md.
2. Rewrite `README.md`: one-paragraph what/why (knowledge base, learn-backend project), a "Stack" line (pnpm · NestJS · Prisma · SQLite · React/Vite), and a "How it builds itself" section pointing at `tasks/README.md` + the `/loop` one-liner.

**Done when.**
- `.editorconfig` present and valid.
- `README.md` explains the project and how to run the loop.
- Config/docs only — no learn-log report required (Stop hook won't ask).

**Notes.** Pure setup. Keep README short; the spec is the deep doc.

---

### DB0-02 — pnpm workspace

**Objective.** Turn the repo into a pnpm monorepo so `apps/*` and `packages/*` can coexist.

**Depends on.** `DB0-01`.

**Touches.** `pnpm-workspace.yaml`, `package.json`, `.npmrc`.

**Steps.**
1. `pnpm-workspace.yaml` with `packages: [apps/*, packages/*]`.
2. Root `package.json`: `private: true`, `packageManager: pnpm@<current>`, `engines.node >= 20`, and passthrough scripts `build`/`dev`/`lint`/`test`/`typecheck` (they can be simple `pnpm -r` recursions for now).
3. `.npmrc`: `auto-install-peers=true`, `strict-peer-dependencies=false`.

**Done when.**
- `pnpm install` succeeds against the (still empty) workspace.
- Config only — no learn-log required.

**Notes.** No Turborepo in v1 (spec keeps it minimal); `pnpm -r` is enough. Revisit if builds get slow.

---

### DB0-03 — Shared TS base config

**Objective.** One strict TypeScript config every package extends.

**Depends on.** `DB0-02`.

**Touches.** `tsconfig.base.json`, `tsconfig.json`.

**Steps.**
1. `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, target/lib ES2022, `module` NodeNext (or ESNext + Bundler for the web/shared packages — pick per consumer), `declaration`, `skipLibCheck`.
2. Root solution `tsconfig.json` with `files: []` + `references: []` (packages add themselves later).

**Done when.**
- A throwaway package extending the base compiles with `tsc --noEmit`.
- Config only — no learn-log required.

**Notes.** NestJS needs `emitDecoratorMetadata`/`experimentalDecorators` + CommonJS — `apps/api` will override those in its own tsconfig (don't force them globally).

---

### DB0-04 — ESLint + Prettier + lint-staged + husky

**Objective.** Automated formatting + linting, enforced on commit.

**Depends on.** `DB0-02`.

**Touches.** `eslint.config.mjs`, `.prettierrc`, `.prettierignore`, `.husky/pre-commit`, `package.json`.

**Steps.**
1. Flat ESLint v9 config: `@eslint/js` + `typescript-eslint` recommended, `eslint-config-prettier` last.
2. Prettier config (2-space, single quotes, 100 cols, trailing commas) + `.prettierignore` (dist, lockfile, `*.md`).
3. husky v9 (`prepare: husky`) + `.husky/pre-commit` running `pnpm exec lint-staged`; lint-staged runs eslint --fix + prettier on staged files.

**Done when.**
- `pnpm lint` runs clean.
- A deliberately mis-formatted staged file gets auto-fixed by the pre-commit hook.
- Config only — no learn-log required.

**Notes.** Ignore `*.md` in Prettier so hand-authored tasks/specs aren't reflowed.

---

### DB0-05 — Scaffold packages/shared

**Objective.** The shared package for DTOs, types, and the lint thresholds — reused by both api and web.

**Depends on.** `DB0-03`.

**Touches.** `packages/shared/{package.json,tsconfig.json,src/index.ts,src/__tests__/smoke.test.ts,vitest.config.ts}`.

**Steps.**
1. Package `@devbrain/shared`, ESM, `exports` map, scripts `build`/`typecheck`/`lint`/`test`.
2. `src/index.ts`: export a `LINT_LIMITS` const (`overlapPct: 0.35`, `maxWords: 200`) as the first real shared value.
3. vitest config + one smoke test asserting `LINT_LIMITS.maxWords === 200`.
4. Add the package to the root solution `tsconfig.json` references.

**Done when.**
- `pnpm --filter @devbrain/shared build` + `test` pass.
- **This changes `packages/**` → write a learn-log report** (concepts: what a workspace package is, why share a `LINT_LIMITS` constant).

**Notes.** First code task — the Stop hook will require a lesson. Keep it beginner-level.

---

### DB0-06 — Scaffold apps/api (NestJS + /health)

**Objective.** A booting NestJS server with a health check.

**Depends on.** `DB0-03`.

**Touches.** `apps/api/{package.json,tsconfig.json,nest-cli.json,src/main.ts,src/app.module.ts,src/health/*}`.

**Steps.**
1. NestJS skeleton via `@nestjs/cli` tooling (`nest build`/`nest start --watch`).
2. `AppModule` → `HealthModule` → `HealthController` `@Get('health')` returning `{ status: 'ok' }`.
3. `apps/api/tsconfig.json` overrides base for Nest: `module: CommonJS`, `emitDecoratorMetadata`, `experimentalDecorators`, `verbatimModuleSyntax: false`.

**Done when.**
- Server boots; `curl http://localhost:3000/health` → `200 {"status":"ok"}`.
- **Changes `apps/**` → learn-log report** (concepts: module/controller/provider, DI, decorators).

**Notes.** esbuild transpilers can't emit decorator metadata Nest needs — use the Nest CLI build.

---

### DB0-07 — Prisma in apps/api

**Objective.** Wire Prisma + SQLite and expose a `PrismaService` for later modules.

**Depends on.** `DB0-06`.

**Touches.** `apps/api/prisma/schema.prisma`, `apps/api/src/prisma/{prisma.module,prisma.service}.ts`, `.env.example`.

**Steps.**
1. `prisma init` with SQLite datasource (`url = env("DATABASE_URL")`, `file:./dev.db`). Add `DATABASE_URL` to `.env.example`.
2. `PrismaService extends PrismaClient` with `onModuleInit` connect; `PrismaModule` (global) exporting it.
3. Run `prisma generate` and an empty `migrate dev --name init-empty` (or defer the first real migration to DB1-01 — note which).

**Done when.**
- `prisma generate` succeeds; `PrismaService` injects into a test provider.
- **Changes `apps/**` → learn-log report** (concepts: ORM, schema→client, migrations, DI lifecycle).

**Notes.** Keep the schema empty here (models land in DB1-01) or add a throwaway model then remove — decide and record in the report.

---

### DB0-08 — Scaffold apps/web (Vite + React + router)

**Objective.** A React app shell with the three v1 routes stubbed.

**Depends on.** `DB0-05`.

**Touches.** `apps/web/{package.json,tsconfig.json,vite.config.ts,index.html,src/main.tsx,src/app/router.tsx,src/app/routes/{Inbox,Distill,Browse}Route.tsx}`.

**Steps.**
1. Vite + React + TS; `react-router` with routes `/inbox`, `/distill`, `/browse` (+ redirect `/` → `/inbox`).
2. A minimal top-nav linking the three; each route renders a placeholder heading.
3. Import `LINT_LIMITS` from `@devbrain/shared` somewhere visible to prove the workspace wiring works.

**Done when.**
- `pnpm --filter web dev` serves the shell; all three routes render.
- **Changes `apps/**` → learn-log report** (concepts: SPA routing, Vite dev server, workspace imports).

**Notes.** No styling system needed yet (spec: no design system in v1).

---

### DB0-09 — Vitest + supertest in apps/api

**Objective.** The api's test harness + a first e2e proving the app boots and routes.

**Depends on.** `DB0-06`.

**Touches.** `apps/api/{package.json,test/health.e2e-spec.ts,vitest.config.ts or jest config}`.

**Steps.**
1. Add the test runner (vitest + supertest, or Nest's default jest — pick one and note why).
2. First e2e: boot the Nest app, `GET /health` → 200 `{status:'ok'}`.
3. Add a `test` script matching the root passthrough.

**Done when.**
- `pnpm --filter api test` green.
- **Changes `apps/**` → learn-log report** (concepts: e2e vs unit, supertest, spinning a Nest test app).

**Notes.** This test becomes the template every later api route reuses.

---

### DB0-10 — Vitest + Testing Library in apps/web

**Objective.** The web unit-test harness + a first render test.

**Depends on.** `DB0-08`.

**Touches.** `apps/web/{package.json,vite.config.ts,src/test/setup.ts,src/app/routes/InboxRoute.test.tsx}`.

**Steps.**
1. vitest (`environment: jsdom`) + `@testing-library/react` + jest-dom matchers; setup file.
2. First render test: render `InboxRoute` in a `MemoryRouter`, assert its heading.
3. `test` script matching the root passthrough.

**Done when.**
- `pnpm --filter web test` green.
- **Changes `apps/**` → learn-log report** (concepts: jsdom, render testing, roles/queries).

**Notes.** Keep e2e (Playwright) out of scope for v1 unless a screen needs it; render tests are enough.

---

### DB0-11 — GitHub Actions CI

**Objective.** Gate every push/PR on install → typecheck → lint → test → build.

**Depends on.** `DB0-04`, `DB0-05`, `DB0-06`, `DB0-08`.

**Touches.** `.github/workflows/ci.yml`.

**Steps.**
1. One `verify` job on `ubuntu-latest`: checkout → setup pnpm + Node 20 (cache pnpm) → `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build`.
2. `concurrency` group with `cancel-in-progress`.

**Done when.**
- Workflow file present; each step maps 1:1 to a root script.
- Config only — no learn-log required (touches neither `apps/**` nor `packages/**`).

**Notes.** Can't run Actions locally; validate YAML + that referenced scripts exist. Don't push unless the owner set up a remote.
