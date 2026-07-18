# DB1-05 — Web API client (typed fetch wrapper via shared)

**Status:** not-studied · **Difficulty:** ⭐ · **Date:** 2026-07-18
**Commit:** `tasks(DB1-05): web api client` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

The browser app now has a small, typed toolbox for talking to the server — two
functions, `createCapture` and `listCaptures`, instead of every screen writing its own
raw `fetch()` calls.

## 2. Why this task matters / where it fits

This is the first web-side code in Phase 1 (everything before was api-side). It's the
bridge DB1-06 (the Inbox screen) needs: instead of a React component calling `fetch`
directly and guessing at response shapes, it calls `createCapture(...)` and gets back a
real `CaptureDto` — the exact same type `packages/shared` already defines and the api
already returns.

## 3. The problem

Nothing conceptually hard here — the interesting part was making sure the client is
*actually testable without a network*, and proving the base-URL fallback really works
by testing it against a real, running server, not just trusting the mocked unit tests.

## 4. Concepts you need to know

### `import.meta.env` (Vite's way of injecting config at build time)
- **Plain definition:** Vite replaces `import.meta.env.VITE_SOMETHING` with an actual
  value when it builds the app — reading from a `.env` file (or the shell environment)
  — so config like "which server to talk to" doesn't have to be hardcoded.
- **Analogy:** it's like a fill-in-the-blank form that gets filled out once, at print
  time, rather than the reader having to know the answer themselves.
- **Why we use it here:** `VITE_API_BASE_URL` lets the api's address be swapped
  (different port, different host, hosted vs. local) without touching code — falls back
  to `http://localhost:3000` (the api's own default port) so nothing has to be
  configured for local dev to just work.

### Mocking `fetch` for a unit test (no real network)
- **Plain definition:** replacing the browser's built-in `fetch` function with a fake
  one (`vi.fn()`) that returns a canned response, so a test can check "did my code build
  the right request" without actually reaching a server.
- **Analogy:** like testing a vending machine's coin-slot logic with a fake coin on a
  workbench, instead of installing the whole machine in a mall food court first.
- **Why we use it here:** `client.test.ts` uses `vi.stubGlobal('fetch', vi.fn(...))` to
  assert the exact URL, method, headers, and body `createCapture`/`listCaptures` send —
  fast, deterministic, no api process needs to be running for `pnpm test` to pass.

## 5. How I approached it

- Typed everything off `@devbrain/shared`'s `CreateCaptureDto`/`CaptureDto`/
  `CaptureStatus` — zero new types declared in `apps/web`. If the api's response shape
  ever changes, this client's types change with it automatically (both sides import
  from the same source).
- Made `listCaptures`'s `status` parameter optional, matching DB1-04's optional query
  param — appends `?status=` only when given a value, via `URL.searchParams`, rather
  than string-concatenating query strings by hand (which is easy to get wrong with
  encoding).
- Threw a real `Error` (with the status code and response body) on a non-2xx response,
  instead of letting `res.json()` fail with a confusing parse error on an empty/HTML
  error body — gives DB1-06 something a UI can actually show the user later.
- Went beyond the task's literal "unit-tested with a mock" requirement: after the mock
  based tests passed, booted the real compiled api server and ran a throwaway Vitest
  probe that called the actual `createCapture`/`listCaptures` functions (not mocked)
  against it — confirming the `VITE_API_BASE_URL` fallback really resolves to a working
  URL, not just that the mock believes it does. Deleted the probe afterward.

## 6. Research trail — how I figured it out

- Checked whether `import.meta.env.VITE_API_BASE_URL` would even typecheck, since
  nothing in this project had used a custom env var yet — read
  `node_modules/vite/types/importMeta.d.ts` directly and found `ImportMetaEnv extends
  Record<ImportMetaEnvFallbackKey, any>` (arbitrary keys allowed as `any` unless a
  project opts into `strictImportMetaEnv`), so no extra `.d.ts` augmentation file was
  needed — confirmed by running `pnpm -w typecheck` clean afterward.
- Read `apps/api/.env.example` to match its existing comment style/format for the new
  `apps/web/.env.example`.
- Read `apps/web/src/app/routes/InboxRoute.test.tsx` to confirm the test-import
  convention (explicit `vi`/`describe`/`it`/`expect` from `'vitest'`, no test globals
  enabled) before writing `client.test.ts`.
- Tried running the client directly via plain `node` first (to sanity check the module
  loads) — failed immediately since `import.meta.env` only exists inside Vite's
  transform, not plain Node. Recovered by using Vitest itself (which already runs
  everything through Vite) for the real-network probe instead of reaching for a
  separate tool.

## 7. Where I got stuck & how I recovered

No real snags — the `import.meta.env` typing question was resolved by reading the
actual `.d.ts` file rather than guessing, and the rest reused patterns already proven
in DB1-03/DB1-04 (error handling shape, mocked-request assertions). The only dead end
was the plain-`node` attempt described above, recovered in under a minute by switching
to Vitest.

## 8. The solution, step by step

1. Wrote DB1-05's detailed spec into `tasks/backlog/phase-1.md`.
2. `apps/web/src/api/client.ts` — `createCapture`/`listCaptures`, both typed off
   `@devbrain/shared`, base URL from `VITE_API_BASE_URL` with a local-dev fallback, a
   shared `parseOrThrow` helper for the error path.
3. `apps/web/.env.example` — documents `VITE_API_BASE_URL`.
4. `apps/web/src/api/client.test.ts` — 4 unit tests with a mocked `fetch`: correct
   POST request shape, GET with no query string, GET with `?status=`, and a non-2xx
   response rejecting with an `Error`.
5. Ran the full clean-state CI sequence (typecheck/lint/test/build), all green.
6. Booted the real compiled api server, wrote a throwaway live probe calling the real
   `createCapture`/`listCaptures` against it, confirmed it round-tripped correctly,
   deleted the probe, and cleaned up the row it created in `dev.db`.

## 9. How to verify it yourself

```bash
cd apps/web
pnpm exec vitest run src/api/client.test.ts
```
Expected: 4 passed.

```bash
# from repo root, full clean-state check
find . -name dist -not -path "*/node_modules/*" -exec rm -rf {} +
find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete
pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build
```
Expected: all exit 0.

## 10. Gotchas / things to remember

- `import.meta.env.VITE_*` variables typecheck as `any` by default in this project
  (no `strictImportMetaEnv` opt-in) — convenient, but means a typo'd env var name won't
  be caught by TypeScript; the `as string | undefined` cast in `client.ts` is a manual
  reminder of the real (possibly-missing) type, not a real safety net.
- Anything using `import.meta.env` can't be run with plain `node` — it needs Vite (or
  Vitest, which wraps Vite) to do the substitution.
- `listCaptures` passes a real `URL` object to `fetch`, not a string — matters for
  tests asserting on the call args (`fetchMock.mock.calls[0][0]` is a `URL`, not a
  `string`, for that function specifically).

## 11. Glossary

| Term | Plain meaning |
|---|---|
| `import.meta.env` | Vite's way of injecting `.env`-file config into client code at build time |
| `vi.stubGlobal` | Vitest helper that temporarily replaces a global (like `fetch`) for a test |
| `URLSearchParams` | Browser API for building a query string safely (handles encoding) |

## 12. Learn next

- DB1-06 (Web Inbox/Capture screen) — the next task wires this client into an actual
  React component: a textarea + submit button calling `createCapture`, and a list
  rendered from `listCaptures('raw')`.
