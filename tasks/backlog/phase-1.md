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
