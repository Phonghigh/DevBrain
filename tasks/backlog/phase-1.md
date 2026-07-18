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
