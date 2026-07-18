# Phase 1 — Capture + DB core (detailed task specs)

Detailed specs for P1 tasks, derived on demand from the `INDEX.md` line + the spec
(ROUTINE step 3). Appended to as each task is picked up.

Spec: [../../docs/superpowers/specs/001-devbrain-v1.md](../../docs/superpowers/specs/001-devbrain-v1.md).

---

### DB1-02 — Shared Capture DTOs

**Objective.** Give `apps/api` and `apps/web` one shared set of types for the `Capture`
shape, so neither side hand-rolls its own copy or imports Prisma's generated types
directly across the api/web boundary.

**Depends on.** `DB0-05`, `DB1-01`.

**Touches.** `packages/shared/src/`.

**Steps.**
1. Add a `CaptureStatus` union type (`'raw' | 'distilled' | 'archived'`, spec §5's
   `Capture.status` values) — the single source of truth both api and web read from
   instead of hardcoding the 3 strings.
2. Add `CreateCaptureDto` — the shape `POST /captures` accepts (spec §6.1: `source`,
   optional `task`, `rawText`). No `id`/`status`/`createdAt` — those are server-assigned.
3. Add `CaptureDto` — the shape returned to clients: the full `Capture` row
   (`id`, `source`, `task`, `rawText`, `status: CaptureStatus`, `createdAt` as an ISO
   string, since DTOs cross a JSON boundary and `Date` doesn't serialize losslessly).
4. Export all three from `packages/shared/src/index.ts`.
5. Add unit tests proving the types compile/exercise correctly (a DTO is data-shape,
   not logic — so the test is really "this compiles and a value assignable to the type
   round-trips through JSON", not business-rule coverage).

**Done when.**
- `CreateCaptureDto`, `CaptureDto`, `CaptureStatus` exported from `@devbrain/shared`.
- Consumed by `apps/api` (proves the workspace wire — even before `CapturesModule`
  exists in DB1-03, something in `apps/api` imports and type-checks against these).
- typecheck/lint/test green across all 3 packages.

**Notes.** Keep this package "just types" (per spec §4 — "no heavy runtime logic").
Don't reach for `class-validator` decorators yet; DB1-03 (`POST /captures` + validation)
is where request validation actually gets wired into NestJS — this task only defines
the shape.

---

### DB1-03 — `CapturesModule`: `POST /captures` (+ validation)

**Objective.** The first real API route: accept a raw GPT dump and persist it as a
`Capture` row with `status=raw` (spec §6.1, §7).

**Depends on.** `DB1-01`, `DB1-02`.

**Touches.** `apps/api/src/captures/`, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`.

**Steps.**
1. Add `class-validator` + `class-transformer` (the standard NestJS request-validation
   pair) as `apps/api` dependencies.
2. `apps/api/src/captures/dto/create-capture.dto.ts` — a real **class** (not just the
   shared `CreateCaptureDto` interface — `class-validator` decorators need a class to
   attach to) implementing the shared shape: `@IsString() @IsNotEmpty() source`,
   `@IsOptional() @IsString() task?`, `@IsString() @IsNotEmpty() rawText`.
3. Wire a global `ValidationPipe` (`whitelist: true`, `transform: true`) in `main.ts` so
   every route validates its body against its DTO class and strips unknown fields.
4. `apps/api/src/captures/captures.service.ts` — injects `PrismaService`, `create(dto)`
   calls `prisma.capture.create` (status defaults to `"raw"` per the schema) and returns
   `toCaptureDto(row)` (the mapper DB1-02 already wrote).
5. `apps/api/src/captures/captures.controller.ts` — `@Controller('captures')`,
   `@Post()` accepting the DTO class, returning the service's `CaptureDto`.
6. `apps/api/src/captures/captures.module.ts` — registers controller + service (no need
   to import `PrismaModule`; it's `@Global()`, per DB0-07).
7. Register `CapturesModule` in `AppModule`.
8. `test/captures.e2e-spec.ts` — `POST /captures` with a valid body → 201, response has
   `status: 'raw'`; a request missing `rawText` → 400 (proves validation is wired, not
   just present in a DTO nobody checks).

**Done when.**
- `POST /captures` creates a capture with `status='raw'`.
- Missing/invalid fields are rejected with 400 before ever reaching Prisma.
- e2e test green; typecheck/lint/test green across all 4 packages.

**Notes.** Spec §7: `POST /captures` — "create a raw capture." Keep validation
**required-field presence only** here — the anti-copy discipline (lint, split-pane
Peek) is entirely a `ConceptsModule`/Distill concern (Phase 2), not a Captures one;
Capture intake is deliberately friction-free (spec §6.1).

---

### DB1-04 — `GET /captures?status=raw` (inbox, newest first)

**Objective.** Read side of DB1-03 — list captures, optionally filtered by `status`,
newest first. This is what the Inbox screen (DB1-06) will call to show the raw queue.

**Depends on.** `DB1-03`.

**Touches.** `apps/api/src/captures/`.

**Steps.**
1. `apps/api/src/captures/dto/list-captures-query.dto.ts` — a class with an optional
   `status?: CaptureStatus` field, validated with `@IsOptional() @IsIn([...])` against
   the 3 spec-defined values (reject a typo'd status with 400, same discipline as
   DB1-03's create validation, rather than silently matching zero rows).
2. `CapturesService.findAll(status?)` — `prisma.capture.findMany({ where: status ? {
   status } : undefined, orderBy: { createdAt: 'desc' } })`, mapped through
   `toCaptureDto`.
3. `CapturesController` — `@Get()` accepting `@Query() query: ListCapturesQueryDto`.
4. `test/captures.e2e-spec.ts` (extend, don't duplicate the file) — `?status=raw`
   returns only raw captures; no query param returns everything; newest-first
   ordering is actually asserted (not just "doesn't crash"); an invalid status value
   → 400.

**Done when.**
- `GET /captures?status=raw` returns only `raw` captures, newest first.
- Invalid `status` values are rejected with 400.
- e2e test green; typecheck/lint/test green across all 4 packages.

**Notes.** Spec §7 lists the route as `GET /captures?status=raw` specifically for the
inbox use case, but nothing in the spec says listing *all* captures should be
impossible — making `status` optional (list-all when omitted) is a strict superset of
what's asked for and costs nothing extra to implement or test.

---

### DB1-05 — Web API client (typed fetch wrapper via shared)

**Objective.** The first web-side code that talks to `apps/api` — a small typed
wrapper around `fetch` so DB1-06's Inbox screen doesn't hand-roll request/response
shapes.

**Depends on.** `DB0-08`, `DB1-02`.

**Touches.** `apps/web/src/api/`, `apps/web/.env.example`.

**Steps.**
1. `apps/web/src/api/client.ts` — `createCapture(dto: CreateCaptureDto):
   Promise<CaptureDto>` (`POST /captures`) and `listCaptures(status?: CaptureStatus):
   Promise<CaptureDto[]>` (`GET /captures` with an optional `?status=`), both typed
   entirely off `@devbrain/shared`'s `CreateCaptureDto`/`CaptureDto`/`CaptureStatus` —
   no shapes redeclared here.
2. Base URL from `import.meta.env.VITE_API_BASE_URL`, falling back to
   `http://localhost:3000` (matching the api's own default port from `main.ts`) so the
   app works out of the box in local dev with zero required config.
3. A shared error path: a non-2xx response throws an `Error` carrying the status code
   and response body, so callers get something actionable instead of a generic parse
   failure.
4. `apps/web/.env.example` documenting `VITE_API_BASE_URL` (matching `apps/api`'s
   existing `.env.example` convention).
5. `apps/web/src/api/client.test.ts` — unit tests with `fetch` mocked (`vi.fn()`), not
   a real network call: `createCapture` posts the right URL/method/body and returns the
   parsed JSON; `listCaptures` appends `?status=` only when given a status; a non-2xx
   response rejects with an `Error`.

**Done when.**
- `createCapture`/`listCaptures` exported, both typed against the shared DTOs.
- Unit-tested with a mocked `fetch` (spec's own wording for this task).
- typecheck/lint/test green across all 4 packages.

**Notes.** No real HTTP call in the test suite — DB1-06's render test (next task) is
where this client gets exercised against a real, running api in a manual/dev-server
check; the unit test here only proves the client builds the right request and parses
the right response.

---

### DB1-06 — Web Inbox/Capture screen

**Objective.** The last Phase 1 task: a real screen a human can use — paste a raw dump,
save it, see it land in the raw queue (spec §6.1, §8.1). This is the point Phase 1 stops
being api-only and becomes an actual usable capture flow end to end.

**Depends on.** `DB1-04`, `DB1-05`.

**Touches.** `apps/web/src/app/routes/InboxRoute.tsx`,
`apps/web/src/app/routes/InboxRoute.test.tsx` (replaces DB0-10's placeholder version).

**Steps.**
1. `InboxRoute` becomes stateful: a `<select>` for `source` (the 3 documented values
   from spec §5's schema comment — `chatgpt`/`claude`/`manual`), an optional `task`
   text input, and a `rawText` textarea, plus a Save button.
2. On mount, call `listCaptures('raw')` (DB1-05's client) and render the result —
   loading state while the request is in flight, an empty-state message if there are
   none yet.
3. On Save, call `createCapture` (DB1-05), then re-fetch the list (or prepend the
   returned capture locally) so it shows up without a manual refresh, and clear the
   form for the next paste.
4. Surface a save error (e.g. validation failure) without losing what the user typed —
   friction-free capture (spec §6.1) means a failed save shouldn't force retyping.
5. `InboxRoute.test.tsx` — mock `@devbrain/shared`'s sibling api client module (not the
   network), and assert: initial list renders from `listCaptures`; filling the form and
   clicking Save calls `createCapture` with the right payload and the new capture
   appears in the rendered list.

**Done when.**
- Paste text → Save → the capture appears in the on-screen list (proven by the render
  test, spec's own wording for this task).
- typecheck/lint/test green across all 4 packages.
- Manually verified against the real dev server + real api (this is the first task
  with an actual usable screen — worth seeing it work, not just trusting the test).

**Notes.** This closes Phase 1 (P1: 6/6). Keep the screen honestly minimal — no
styling system, no client-side validation duplicating the api's — matching spec §8's
"no fancy design system needed in v1."
