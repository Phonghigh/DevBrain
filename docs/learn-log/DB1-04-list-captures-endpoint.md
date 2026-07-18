# DB1-04 — GET /captures?status=raw (inbox, newest first)

**Status:** not-studied · **Difficulty:** ⭐ · **Date:** 2026-07-18
**Commit:** `tasks(DB1-04): list captures endpoint` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

The API can now hand back the list of saved captures — newest first, optionally
filtered to just the raw (not-yet-distilled) ones — which is exactly what an Inbox
screen needs to show.

## 2. Why this task matters / where it fits

This is the read half of DB1-03's write half (spec §6.1, §7). It's what DB1-06 (the
web Inbox screen) will call to render the raw queue. Nothing else in Phase 1 depends on
new concepts here — it's mostly applying patterns DB1-03 already established
(controller → service → Prisma → shared DTO mapper) to a second route.

## 3. The problem

This was standard CRUD work — the interesting part is less "how do you build a list
endpoint" and more "how do you *prove* filtering and ordering actually work," since
both are easy to get subtly wrong (e.g. ordering by insertion order instead of
`createdAt`, or a filter that silently matches everything when the value is wrong).

## 4. Concepts you need to know

### Query parameter validation (same DTO pattern, applied to `@Query()`)
- **Plain definition:** just like a `POST` body gets validated against a DTO class,
  `?status=raw` in a URL can be validated the same way — NestJS's `@Query()` decorator
  plus the same global `ValidationPipe` from DB1-03 handles both.
- **Analogy:** it's the same bouncer at the door, just also checking people's tickets
  (query string), not only their bags (request body).
- **Why we use it here:** `ListCapturesQueryDto` uses `@IsIn(['raw','distilled',
  'archived'])` instead of `@IsNotEmpty()` — the field is optional (`@IsOptional()`),
  but *if* it's present, it must be one of the 3 real status values. Without this, a
  typo'd `?status=rawr` would silently return an empty list instead of a clear 400 —
  a much harder bug to notice.

### Deterministic ordering tests (don't race the clock)
- **Plain definition:** when a test needs to check that results come back in a specific
  order (like "newest first"), relying on rows created milliseconds apart in real time
  is fragile — explicitly setting each row's timestamp when seeding the test makes the
  order unambiguous.
- **Analogy:** if you want to prove a race result is closest-first, you don't actually
  run three runners and hope the gaps are timeable — you just assign each one a known
  finish time and check the sort.
- **Why we use it here:** the `GET /captures` e2e tests seed 3 rows directly via
  `prisma.capture.create` with explicit `createdAt` values 1 second apart, rather than
  `POST`-ing them back to back and hoping the real wall-clock gap was enough to sort
  correctly (on a fast machine, it might not be — `createdAt`'s default
  is millisecond-precision, and 3 requests could easily land in the same millisecond).

## 5. How I approached it

- Made `status` an **optional** query param rather than mandatory — the INDEX.md line
  names the route `GET /captures?status=raw` for its inbox use case, but nothing in the
  spec says listing everything should be unreachable, and an optional filter is a
  strict superset of "just raw" for free.
- Reused `toCaptureDto` again (now used from 2 places: `create` and `findAll`) —
  exactly the payoff DB1-02/DB1-03 were building toward.
- Seeded the ordering/filtering tests directly through Prisma (not `POST /captures`),
  specifically so a `distilled`-status row could exist for the filter test — there's no
  API to create one yet (that's `ConceptsModule`, Phase 2), so going around the API for
  *test setup only* was the only option, same pattern DB1-01's probe test used.

## 6. Research trail — how I figured it out

- Re-read `apps/api/src/captures/captures.controller.ts` and `.service.ts` (from
  DB1-03) to match the established shape rather than inventing a new one.
- Checked `class-validator`'s docs mentally against what was already imported in
  `create-capture.dto.ts` — `@IsIn()` was the natural fit for "must be one of these
  literal values," no new package needed.
- Ran the new e2e tests in isolation (`pnpm exec vitest run test/captures.e2e-spec.ts`)
  first — 7/7 passed on the first try, no debugging needed.
- After the automated suite passed, booted the compiled server and used `curl` to
  create two real captures and then list them — confirmed the JSON really does come
  back newest-first, and that `?status=bogus` really does 400 on the live server, not
  just inside vitest's in-memory Nest instance.

## 7. Where I got stuck & how I recovered

No real snags — this task built directly on DB1-03's already-proven pattern
(controller/service/DTO/mapper), so there was nothing new to debug. The only thing
worth a note: manual `curl` testing (as always) left real rows in `dev.db`
(`source: 'manual-test-2'`), cleaned up afterward with the same throwaway-probe pattern
used in DB1-02 and DB1-03.

## 8. The solution, step by step

1. Wrote DB1-04's detailed spec into `tasks/backlog/phase-1.md`.
2. `apps/api/src/captures/dto/list-captures-query.dto.ts` — optional `status`, validated
   with `@IsIn(['raw','distilled','archived'])`.
3. `CapturesService.findAll(status?)` — `prisma.capture.findMany({ where: status ? {
   status } : undefined, orderBy: { createdAt: 'desc' } })`, mapped through
   `toCaptureDto`.
4. `CapturesController` — added `@Get()` accepting `@Query() query:
   ListCapturesQueryDto`.
5. Extended `test/captures.e2e-spec.ts` with a nested `describe('GET /captures', ...)`
   block: seeds 3 captures with explicit, spaced-out `createdAt` values (2 raw, 1
   distilled), then asserts `?status=raw` returns only the 2 raw ones newest-first,
   no-query returns all 3 in the same relative order, and `?status=bogus` → 400.
6. Ran the full clean-state CI sequence, booted the compiled server, drove real `curl`
   requests, cleaned up the rows they created.

## 9. How to verify it yourself

```bash
cd apps/api
pnpm exec vitest run test/captures.e2e-spec.ts
```
Expected: 7 passed (the 4 from DB1-03 plus 3 new `GET /captures` cases).

```bash
cd apps/api && node dist/main.js &
curl -s -X POST http://localhost:3000/captures -H "Content-Type: application/json" -d '{"source":"t","rawText":"a"}'
curl -s -X POST http://localhost:3000/captures -H "Content-Type: application/json" -d '{"source":"t","rawText":"b"}'
curl -s http://localhost:3000/captures?status=raw
# expect: an array with "b" before "a" (newest first)
curl -i http://localhost:3000/captures?status=bogus   # expect: 400
```

## 10. Gotchas / things to remember

- Never trust wall-clock timing to prove ordering in a test — set `createdAt`
  explicitly when seeding rows for an ordering assertion.
- Test setup that needs a database state the public API can't produce yet (like a
  `distilled` capture, before `ConceptsModule` exists) is fine to seed directly via
  Prisma — that's test setup, not a shortcut around the feature being tested.

## 11. Glossary

| Term | Plain meaning |
|---|---|
| `@Query()` | NestJS decorator that pulls URL query-string params into a typed/validated object |
| `@IsIn([...])` | class-validator rule: value must be one of a fixed list |
| `orderBy: { createdAt: 'desc' }` | Prisma's way of saying "newest row first" |

## 12. Learn next

- DB1-05 (Web API client) — the next task builds the typed `fetch` wrapper the web app
  will use to actually call `POST /captures` and `GET /captures?status=raw` from a
  browser.
