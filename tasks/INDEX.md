# Backlog — atomic tasks (single source of truth for status)

One task per loop iteration. Status: `- [ ]` todo · `- [x]` done · `- [!]` blocked.
Pick the **first `- [ ]` whose `deps` are all done** (see [ROUTINE.md](ROUTINE.md)).
Each line: **id** — title · *deps:* … · *done:* acceptance criterion.

Spec: [../docs/superpowers/specs/001-devbrain-v1.md](../docs/superpowers/specs/001-devbrain-v1.md).
Phases: **P0** Foundations · **P1** Capture + DB core · **P2** Distill + lint (the heart) ·
**P3** Browse + search · **P4+** Deferred (v2–v4).

---

## Phase 0 — Foundations
- [x] **DB0-01** — `.editorconfig` + refresh root `README.md` (`.gitignore` seeded by harness — extend if needed) · *deps:* none · *done:* editorconfig present; README describes the project + how to run the loop.
- [ ] **DB0-02** — pnpm workspace (`pnpm-workspace.yaml`, root `package.json` private + scripts, `.npmrc`) · *deps:* DB0-01 · *done:* `pnpm install` succeeds on empty workspace.
- [ ] **DB0-03** — Shared TS config (`tsconfig.base.json` strict + root solution `tsconfig.json`) · *deps:* DB0-02 · *done:* base extended by a package; `tsc --noEmit` passes.
- [ ] **DB0-04** — ESLint + Prettier + lint-staged + husky pre-commit · *deps:* DB0-02 · *done:* `pnpm lint` runs; pre-commit formats staged files.
- [ ] **DB0-05** — Scaffold `packages/shared` (pkg.json, tsconfig, `src/index.ts`, vitest) — home for DTOs + `LINT_LIMITS` constants · *deps:* DB0-03 · *done:* package builds; a sample vitest test passes.
- [ ] **DB0-06** — Scaffold `apps/api` (NestJS skeleton + `/health`) · *deps:* DB0-03 · *done:* server boots; `GET /health` returns 200.
- [ ] **DB0-07** — Prisma in `apps/api` (`prisma init`, SQLite datasource, `PrismaModule`/`PrismaService` + lifecycle) · *deps:* DB0-06 · *done:* `prisma generate` ok; `PrismaService` injectable; empty `migrate dev` runs.
- [ ] **DB0-08** — Scaffold `apps/web` (Vite + React + TS + router; `/inbox` `/distill` `/browse` stubs) · *deps:* DB0-05 · *done:* `pnpm --filter web dev` serves a shell with the 3 routes.
- [ ] **DB0-09** — Vitest + supertest in `apps/api` + first e2e (`/health`) · *deps:* DB0-06 · *done:* `pnpm --filter api test` green.
- [ ] **DB0-10** — Vitest + Testing Library in `apps/web` + first render test · *deps:* DB0-08 · *done:* `pnpm --filter web test` green.
- [ ] **DB0-11** — GitHub Actions CI (install, typecheck, lint, test, build) · *deps:* DB0-04, DB0-05, DB0-06, DB0-08 · *done:* workflow file present; green logic.

## Phase 1 — Capture + DB core
- [ ] **DB1-01** — Prisma schema `Capture`/`Concept`/`Link` (spec §5) + first migration · *deps:* DB0-07 · *done:* `migrate dev` creates the 3 tables; typed client generated.
- [ ] **DB1-02** — Shared Capture DTOs (`CreateCaptureDto`, `CaptureDto`, `CaptureStatus`) · *deps:* DB0-05, DB1-01 · *done:* types exported; consumed by api.
- [ ] **DB1-03** — `CapturesModule`: `POST /captures` (+ validation) · *deps:* DB1-01, DB1-02 · *done:* creates a capture `status=raw`; e2e test.
- [ ] **DB1-04** — `GET /captures?status=raw` (inbox, newest first) · *deps:* DB1-03 · *done:* returns filtered list; e2e test.
- [ ] **DB1-05** — Web API client (typed fetch wrapper via shared) · *deps:* DB0-08, DB1-02 · *done:* `createCapture`/`listCaptures`; unit-tested with a mock.
- [ ] **DB1-06** — Web **Inbox/Capture** screen (textarea + source/task + submit; raw list) · *deps:* DB1-04, DB1-05 · *done:* paste → Save → capture appears in list; render test.

## Phase 2 — Distill + lint (the heart — spec §6)
- [ ] **DB2-01** — Lint core in `packages/shared`: `lintNote(body, rawText)` → warnings (5-gram overlap >35%, missing `[[link]]`, >200 words) + text normalization · *deps:* DB0-05 · *done:* **unit tests** per rule + boundaries; pure function, no deps.
- [ ] **DB2-02** — Shared Concept DTOs (`CreateConceptDto`, `ConceptDto`, `LintWarning`, `BacklinkDto`) · *deps:* DB0-05, DB1-01 · *done:* types exported.
- [ ] **DB2-03** — Wikilink parser in `packages/shared`: `parseWikilinks(body)` + `slugify(title)` · *deps:* DB0-05 · *done:* unit-tested (dedupe, diacritics/unicode, edge cases).
- [ ] **DB2-04** — `ConceptsModule` `POST /concepts`: lint → create Concept → parse `[[..]]` → upsert `Link` rows + auto-create `stub` Concepts · *deps:* DB1-01, DB2-01, DB2-02, DB2-03 · *done:* returns `{concept, warnings}`; stubs + links created; e2e test.
- [ ] **DB2-05** — `PUT /concepts/:slug`: re-lint + re-sync links (add new / drop stale) · *deps:* DB2-04 · *done:* editing body updates the Link set; e2e test.
- [ ] **DB2-06** — `GET /concepts/:slug` + backlinks (reverse `Link.toSlug`) · *deps:* DB2-04 · *done:* returns concept + backlinks array; e2e test.
- [ ] **DB2-07** — Web API client for concepts (create/update/get) · *deps:* DB1-05, DB2-02 · *done:* typed methods; unit-tested.
- [ ] **DB2-08** — Web **Distill editor**: split pane (blank editor | source behind **Peek**), Save → show lint warnings (non-blocking) · *deps:* DB1-06, DB2-07 · *done:* pick a raw capture → write note → Peek reveals source → Save shows warnings + persists; render test.
- [ ] **DB2-09** — On distill success flip `Capture.status` → `distilled`; drop from inbox · *deps:* DB2-04, DB2-08 · *done:* distilled captures leave the raw inbox; e2e/render.

## Phase 3 — Browse + search
- [ ] **DB3-01** — `GET /concepts` (list; flag stubs) · *deps:* DB2-04 · *done:* returns concepts; e2e test.
- [ ] **DB3-02** — `GET /search?q=` (LIKE on title + body) · *deps:* DB2-04 · *done:* returns matches; e2e test.
- [ ] **DB3-03** — Web **Browse**: list + concept view (render body, `[[links]]` clickable) + backlinks panel · *deps:* DB2-06, DB3-01 · *done:* list → open concept → see body + backlinks; render test.
- [ ] **DB3-04** — Web search box → `/search` → open result · *deps:* DB3-02, DB3-03 · *done:* type query → results → click opens concept; render test.
- [ ] **DB3-05** — v1 polish: nav across the 3 screens, empty states, stub badge · *deps:* DB3-03 · *done:* nav between Inbox/Distill/Browse; stubs visually distinct.

## Phase 4+ — Deferred (gated `- [!]` on purpose — see below + BLOCKERS.md)
> These are **intentionally blocked** so the loop **stops after v1 (P0–P3)** instead
> of rolling into v2/v3/v4. When you decide to start a later phase, flip that task to
> `- [ ]` (and write its detailed spec via ROUTINE step 3).
- [!] **DB4-01** — Export endpoint: DB → `.md` files (Obsidian/git mirror) · *deps:* DB2-04 · *done:* [v2] a folder of `.md` notes mirrors the DB.
- [!] **DB4-02** — Auth (signup/login, hashed password, JWT) · *deps:* DB1-01 · *done:* [v3] protected routes require a token.
- [!] **DB4-03** — Migrate SQLite → Postgres + deploy · *deps:* DB4-02 · *done:* [v4] hosted; usable from another device.
- [!] **DB4-04** — Graph view (concepts + links) · *deps:* DB2-06 · *done:* [v4] renders the link graph.
- [!] **DB4-05** — AI suggest links (never auto-writes a note) · *deps:* DB2-04 · *done:* [v4] suggests `[[links]]`; user accepts.

---

### Counts
P0: 11 · P1: 6 · P2: 9 · P3: 5 · P4+: 5 (deferred) — **31 v1 tasks**.
