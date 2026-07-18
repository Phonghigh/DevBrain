# DB1-03 — CapturesModule: POST /captures (+ validation)

**Status:** not-studied · **Difficulty:** ⭐⭐ · **Date:** 2026-07-18
**Commit:** `tasks(DB1-03): captures module post endpoint` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

DevBrain now has its first real feature: you can send it a raw text dump over the
network and it saves it to the database as a "raw" capture — rejecting the request up
front if the required pieces are missing.

## 2. Why this task matters / where it fits

This is Phase 1's third task
([spec §6.1](../superpowers/specs/001-devbrain-v1.md#61-capture-friction--0-on-purpose),
[§7](../superpowers/specs/001-devbrain-v1.md#7-api-nestjs)). Everything before this was
plumbing (Prisma tables in DB1-01, shared types in DB1-02) — this is the first task
where the API actually *does* something a user-facing screen could call. It's also the
first time this project wires up **request validation**, which every later `POST`/`PUT`
route (concepts, links) will reuse the same pattern for.

## 3. The problem

Two things needed solving: (1) how does a plain JSON body get checked against the
`CreateCaptureDto` shape *before* touching the database, and (2) how do you prove a
`POST` route that changes the database actually works, and doesn't leave a mess behind
when you test it by hand.

## 4. Concepts you need to know

### `class-validator` + `class-transformer` (NestJS's request validation pair)
- **Plain definition:** `class-validator` lets you attach rules (`@IsString()`,
  `@IsNotEmpty()`, `@IsOptional()`) to a class's properties as decorators;
  `class-transformer` turns a plain JSON object into a real instance of that class so
  the rules actually have something to check.
- **Analogy:** it's like a form with printed instructions next to each box ("required",
  "must be text") — but someone still has to actually copy your answers onto that form
  before the instructions mean anything. `class-transformer` is the copying step;
  `class-validator` is the instructions.
- **Why we use it here:** `CreateCaptureDto` in `packages/shared` is just a *type* — it
  vanishes at compile time and enforces nothing when the server is actually running.
  `apps/api/src/captures/dto/create-capture.dto.ts` is a **separate, real class** that
  `implements` that shared shape (keeping the two in sync) but also carries the
  decorators the shared interface can't.

### Global `ValidationPipe`
- **Plain definition:** one line of setup (`app.useGlobalPipes(new ValidationPipe(...))`)
  that makes *every* route in the app automatically validate its incoming body against
  whatever DTO class the controller method declares — no per-route wiring needed.
- **Analogy:** it's like a single security checkpoint at the building entrance instead
  of a separate guard posted at every office door.
- **Why we use it here:** `{ whitelist: true, transform: true }` — `whitelist` strips
  any field the DTO doesn't declare (so a client can't sneak `status: 'distilled'`
  straight past `POST /captures` and fake a distilled capture), `transform` is what
  actually turns the plain JSON body into a `CreateCaptureDto` instance so the
  decorators run at all.

### e2e test hygiene (cleaning up after yourself)
- **Plain definition:** when a test creates real rows in a real database, it should
  delete them afterward, so running the test suite repeatedly doesn't pollute the
  database with junk or make later tests see stale data.
- **Analogy:** like washing the mixing bowls after baking — the recipe isn't "done"
  just because the cake came out right.
- **Why we use it here:** `test/captures.e2e-spec.ts` tags every row it creates with
  `source: 'e2e-test'` and deletes them all in `afterAll`. Verified this actually
  worked (not just trusted it) by writing a throwaway probe that counted leftover
  `e2e-test` rows after the suite ran, confirming zero, then deleting the probe.

## 5. How I approached it

- Considered validating inside the service (`CapturesService.create`) with hand-written
  `if` checks instead of `class-validator`. Rejected it: NestJS's whole ecosystem
  assumes DTO-class + `ValidationPipe`, every later module (`ConceptsModule`, DB2-04+)
  will need the same pattern, and hand-rolled checks would mean re-inventing (and
  re-testing) the same logic per route.
- Kept the validation rules to **presence/type only** (`@IsNotEmpty()`, `@IsString()`,
  `@IsOptional()`) — no length limits, no content rules. The spec is explicit that
  capture intake must be zero-friction (§6.1); the anti-copy discipline (lint,
  Peek-behind-a-button) belongs entirely to `ConceptsModule` in Phase 2, not here.
- `CapturesService.create` reuses `toCaptureDto` (`capture.mapper.ts`), written back in
  DB1-02 specifically so this task wouldn't need to re-derive the Prisma-row → DTO
  conversion — that groundwork paid off immediately, one task later.
- For proving the route really works, went beyond "the e2e test passed": booted the
  actual compiled server (`node dist/main.js`) and drove real `curl` requests — one
  successful `POST`, one that should fail validation — reading the literal HTTP
  responses, not just trusting vitest's green checkmark.

## 6. Research trail — how I figured it out

- Read `apps/api/src/health/*` and `apps/api/src/prisma/prisma.service.ts` first, to
  match the existing module/controller/service shape rather than inventing a new
  structure.
- Read `apps/api/test/health.e2e-spec.ts` to copy its `Test.createTestingModule` +
  supertest pattern for the new `captures.e2e-spec.ts`.
- Confirmed `PrismaModule` is `@Global()` (from DB0-07's notes) before writing
  `CapturesModule` — meaning `CapturesModule` doesn't need to import it to get
  `PrismaService` injected, it just declares the dependency in its own constructor.
- Ran the new e2e test in isolation first (`pnpm exec vitest run
  test/captures.e2e-spec.ts`) before running the full suite, to see its own output
  cleanly (4/4 passed) before mixing it with everything else.
- After the automated suite passed, manually booted `dist/main.js` and used `curl` to
  send a real `POST /captures` (201, correct body, `task: null` when omitted) and a
  request missing `rawText` (400, with the actual `class-validator` error messages) —
  proof the `ValidationPipe` is really wired into the running app, not just present in
  a test's in-memory Nest instance.
- The manual `curl` test left a real row in `dev.db` (`source: 'manual-test'`) —
  cleaned it up afterward with a throwaway probe script, the same pattern used to
  verify the e2e test's own cleanup.

## 7. Where I got stuck & how I recovered

No real snags on the NestJS/validation side — the pattern is well-documented and
matched the existing module shape closely. The one hiccup was tooling, not code:

- **Symptom:** tried to write a one-off Node script to directly query `dev.db` via
  `better-sqlite3` (to confirm the e2e test's cleanup worked) and got
  `Cannot find module 'better-sqlite3'`, even when the script lived inside
  `apps/api/`.
  **Cause:** `better-sqlite3` is a dependency of `@prisma/adapter-better-sqlite3`, not
  a direct dependency of `apps/api` itself — pnpm's strict, non-hoisting node_modules
  layout means only packages actually listed in `apps/api/package.json` are resolvable
  from `apps/api`'s own scripts.
  **Fix:** used the already-direct dependency instead — a throwaway vitest e2e spec
  that imports the generated `PrismaClient` (same pattern DB1-01's probe test used) to
  query and clean up rows, rather than reaching for `better-sqlite3` directly.

## 8. The solution, step by step

1. Wrote DB1-03's detailed spec into `tasks/backlog/phase-1.md` (appended after
   DB1-02's section).
2. Added `class-validator` + `class-transformer` to `apps/api`.
3. `apps/api/src/captures/dto/create-capture.dto.ts` — a class implementing the shared
   `CreateCaptureDto` interface, decorated for validation.
4. `apps/api/src/main.ts` — added the global `ValidationPipe({ whitelist: true,
   transform: true })`.
5. `apps/api/src/captures/captures.service.ts` — `create()` calls
   `prisma.capture.create` then `toCaptureDto` (from DB1-02).
6. `apps/api/src/captures/captures.controller.ts` — `POST /captures` wired to the
   service.
7. `apps/api/src/captures/captures.module.ts`, registered in `AppModule`.
8. `apps/api/test/captures.e2e-spec.ts` — 4 cases: creates with `status=raw`, succeeds
   without `task` (returns `null`), rejects a missing `rawText` with 400, strips an
   unknown `status` field instead of persisting it.
9. Verified cleanup worked with a throwaway probe, then deleted the probe.
10. Ran the full clean-state CI sequence (delete every `dist/`/`.tsbuildinfo`, then
    typecheck → lint → test → build), then booted the compiled server and drove real
    `curl` requests, then cleaned up the row that test created.

## 9. How to verify it yourself

```bash
cd apps/api
pnpm exec vitest run test/captures.e2e-spec.ts
```
Expected: 4 passed (create with status=raw, optional task, 400 on missing rawText,
unknown fields stripped).

```bash
# from repo root, full clean-state check
find . -name dist -not -path "*/node_modules/*" -exec rm -rf {} +
find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete
pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build
```
Expected: all exit 0.

```bash
cd apps/api && node dist/main.js &
curl -i -X POST http://localhost:3000/captures -H "Content-Type: application/json" \
  -d '{"source":"manual-test","rawText":"hello"}'
# expect: 201, {"id":"...","source":"manual-test","task":null,"rawText":"hello","status":"raw","createdAt":"..."}
curl -i -X POST http://localhost:3000/captures -H "Content-Type: application/json" -d '{"source":"manual-test"}'
# expect: 400, {"message":["rawText should not be empty","rawText must be a string"],...}
```

## 10. Gotchas / things to remember

- The shared `CreateCaptureDto` (an interface, `packages/shared`) and the api's
  `CreateCaptureDto` (a class, `apps/api/src/captures/dto/`) are **two different
  things with the same name** — the class `implements` the interface so they can't
  silently drift apart, but only the class carries validation decorators.
- `whitelist: true` on the global `ValidationPipe` is what stops a client from setting
  `status` or `id` directly in the POST body — without it, extra fields would just pass
  through untouched (though Prisma would still ignore fields that aren't in the
  `data:` object of `create()`, since the service builds that object explicitly).
- A package used only *transitively* (like `better-sqlite3` here) isn't resolvable by
  name from your own scripts under pnpm's strict layout — reach for something that's
  actually a direct dependency instead.

## 11. Glossary

| Term | Plain meaning |
|---|---|
| DTO validation decorator | A tag like `@IsString()` on a class property that `class-validator` checks against incoming data |
| `ValidationPipe` | NestJS's built-in request-validation step, wired in once for the whole app |
| Whitelist (validation) | Strip any field not explicitly declared on the DTO, instead of passing it through |
| e2e test hygiene | Deleting the rows a test created so re-running the suite doesn't leave junk behind |

## 12. Learn next

- DB1-04 (`GET /captures?status=raw`) — the next task reads captures back out, newest
  first; a natural pairing with this task's write path.
- Worth a closer look later: how `class-validator`'s error messages
  (`"rawText should not be empty"`) get formatted — NestJS's default exception filter
  shapes them into the `{message: string[], error, statusCode}` response seen in the
  curl test above; a custom exception filter could reshape that later if the web UI
  needs a different error format.
