# DB1-06 — Web Inbox/Capture screen

**Status:** not-studied · **Difficulty:** ⭐⭐⭐ · **Date:** 2026-07-18
**Commit:** `tasks(DB1-06): web inbox capture screen` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

DevBrain now has a real screen you could actually open in a browser: paste some text,
pick where it came from, hit Save, and it shows up in a list right there — and this
task also found and fixed the reason that wouldn't have worked for a real user opening
the real app.

## 2. Why this task matters / where it fits

This is the last task of **Phase 1** (spec §6.1, §8.1) — it closes the loop from "empty
database" (DB1-01) all the way to "a human can use this." Everything before this was
either backend-only or a typed helper nobody could see. This is also the point where
the **web app and the api are two separate running processes talking over the
network** for the first time in a real browser — which is exactly what exposed this
task's real bug.

## 3. The problem

Two layers: (1) build a normal, stateful React form + list — routine React work — and
(2) actually prove the whole vertical slice works, not just that a jsdom-simulated test
passes. The second part is what turned into the real story of this task.

## 4. Concepts you need to know

### CORS (Cross-Origin Resource Sharing)
- **Plain definition:** a security rule browsers enforce — a web page loaded from one
  address (origin) can't freely fetch data from a *different* address unless that other
  server explicitly says "requests from you are allowed."
- **Analogy:** it's like a company that will only accept deliveries from couriers on an
  approved list — even if the delivery itself is completely legitimate, the front desk
  turns it away unless the courier's badge is recognized.
- **Why we use it here:** `apps/web` (Vite dev server, `http://localhost:5173`) and
  `apps/api` (NestJS, `http://localhost:3000`) are different **origins** — different
  ports count as different origins, even on the same machine. Without telling the api
  "allow requests from anywhere," the browser silently blocks every request the web app
  makes to it — the request never even reaches the controller.

### Why jsdom tests can't catch a CORS bug
- **Plain definition:** the render tests (`InboxRoute.test.tsx`) mock the api client
  module entirely (`vi.mock('../../api/client', ...)`) — `fetch` never actually runs,
  so there's no real HTTP request for a browser's CORS policy to block in the first
  place.
- **Analogy:** it's like rehearsing a play with a stunt double for the one scene that
  involves an actual locked door — the rehearsal proves the *other* actors know their
  lines, but tells you nothing about whether the door opens on opening night.
- **Why we use it here:** this is exactly why DB1-06's spec explicitly called for a
  **manual dev-server check** in addition to the automated test — and exactly why that
  check mattered: it caught a bug the automated suite structurally could not.

### Mutation testing a UI assertion
- **Plain definition:** deliberately breaking the code a test is supposed to protect,
  confirming the test actually fails, then restoring the code — proof the test would
  catch a real regression, not just proof it currently passes.
- **Analogy:** testing a smoke detector by holding a lit match under it, not just
  checking the light on the front is on.
- **Why we use it here:** removed the `setCaptures((prev) => [created, ...prev])` line
  that makes a newly-saved capture appear in the list, re-ran the "paste → Save →
  appears" test, watched it correctly fail (`No raw captures yet.` stayed on screen),
  then restored the real code — this is the same discipline DB0-10 established for the
  first render test, applied here to a stateful interaction instead of a static render.

## 5. How I approached it

- Kept the screen intentionally plain (a `<select>`, two inputs, a list) — spec §8
  explicitly says "no fancy design system needed in v1," and this task's job is the
  capture flow working, not visual polish.
- Chose to **prepend the newly-created capture locally** after a successful save
  (`setCaptures((prev) => [created, ...prev])`) rather than re-fetching the whole list
  from the api — the response from `createCapture` already contains everything a
  re-fetch would return, so skipping the extra round trip is free.
- On a failed save, deliberately **did not clear the form** — spec §6.1's "friction = 0
  on purpose" principle means a validation failure shouldn't force the user to retype a
  long paste; only a successful save clears the textarea.
- Added `@testing-library/user-event` back — DB0-10 had removed it, noting "it earns
  its place in DB2-08 (Distill editor)" was the *guess* at the time; this task (which
  needs real typing/selecting/clicking) is where it was actually needed first, and that
  guess being slightly off doesn't matter — the reasoning ("nothing types or clicks
  yet, so don't carry unused weight") was correct until this task changed that.
- After the automated suite passed, deliberately went looking for what an automated
  jsdom test *couldn't* prove: whether the two real processes (web dev server, api
  server) actually talk to each other in a real browser. This is what surfaced the CORS
  gap.

## 6. Research trail — how I figured it out

- Booted the real compiled api server and the real Vite dev server (`vite --port
  5173`) together, then used headless Edge with `--dump-dom` (the same tool DB0-08
  established) to render `/inbox` for real.
- First dump showed `Loading…` (captured before the async fetch resolved) — re-ran
  with `--virtual-time-budget=3000` to give the page time to finish its request before
  the snapshot.
- The second dump showed **"Could not load captures."** — the render test's mocked
  version of this exact code path had never failed, so this was the first real sign
  something environmental (not logical) was wrong.
- Checked with `curl -X OPTIONS ... -H "Origin: http://localhost:5173"` (a real
  cross-origin preflight request) and got `404 Cannot OPTIONS /captures` with no
  `Access-Control-Allow-Origin` header at all — confirmed the api had no CORS handling,
  and a plain same-origin `curl` (used in every prior task's boot test) could never have
  revealed this, since `curl` doesn't enforce or even simulate CORS.
- Fixed with NestJS's built-in `app.enableCors()` in `main.ts`, rebuilt, restarted,
  reran the same OPTIONS preflight — got `204` with `Access-Control-Allow-Origin: *`.
- Re-dumped the DOM: now showed `No raw captures yet.` (the real GET succeeded). Then
  `POST`-ed a capture via `curl` with the `Origin` header set (simulating exactly what
  the browser's Save button would send) and re-dumped again — the new capture appeared
  in the real, server-rendered-then-hydrated list, proving read *and* write both work
  end to end through a real browser against a real, separately-running api.

## 7. Where I got stuck & how I recovered

- **Symptom:** the real dev-server + real api check (not the automated test suite,
  which was already green) showed `"Could not load captures."` on `/inbox`.
  **Cause:** `apps/api` had no CORS configuration — `NestFactory.create(AppModule)`
  defaults to same-origin-only, and the web app (port 5173) and api (port 3000) are
  different origins even both running on `localhost`.
  **Fix:** `app.enableCors()` in `apps/api/src/main.ts`. Spec §3 confirms v1 is
  local/single-user with no auth, so allowing any origin is the right amount of
  permissiveness for now — this will need tightening once DB4-02 (auth, v3) lands.
  **Why the automated suite missed it:** `InboxRoute.test.tsx` mocks the entire api
  client module, so no real `fetch` call — and therefore no real CORS check — ever
  happens inside a jsdom test. This is a structural gap between "render test passes"
  and "the feature works," not a flaw in the test itself; the render test is still
  correctly proving the *component's* behavior given a working client, it just can't
  prove the client and the server actually agree to talk to each other.

## 8. The solution, step by step

1. Wrote DB1-06's detailed spec into `tasks/backlog/phase-1.md`.
2. Rewrote `InboxRoute.tsx`: source `<select>`, optional task `<input>`, `rawText`
   `<textarea>`, a Save button; loads `listCaptures('raw')` on mount; on save, calls
   `createCapture` and prepends the result to the list; keeps typed input on a failed
   save.
3. Added `@testing-library/user-event` back to `apps/web`.
4. Rewrote `InboxRoute.test.tsx` with `vi.mock('../../api/client', ...)`: renders the
   initial list, the paste→Save→appears flow, and a failed-save-keeps-input case.
5. Mutation-tested the core assertion (removed the state update, watched the test fail,
   restored it) before trusting the suite.
6. Ran the full clean-state CI sequence (typecheck/lint/test/build) — green.
7. Booted the real api + real web dev server together, hit the CORS bug via headless
   Edge, diagnosed it with a real `curl` preflight, fixed it (`app.enableCors()` in
   `main.ts`), rebuilt, and re-verified both the read and write paths work through a
   real browser against a real, separately-running api.
8. Cleaned up: killed both boot-test servers by their real PIDs, deleted the row the
   manual `curl` POST created, deleted temp DOM dump files, reran the full clean-state
   CI sequence once more to confirm the CORS fix broke nothing.

## 9. How to verify it yourself

```bash
cd apps/web
pnpm exec vitest run src/app/routes/InboxRoute.test.tsx
```
Expected: 4 passed.

```bash
# from repo root, full clean-state check
find . -name dist -not -path "*/node_modules/*" -exec rm -rf {} +
find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete
pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build
```
Expected: all exit 0.

```bash
# real-browser check (the one that matters most for this task)
cd apps/api && node dist/main.js &
cd apps/web && pnpm exec vite --port 5173 &
# open http://localhost:5173/inbox in a real browser, paste text, click Save
# expect: the capture appears in "Raw captures" without a page reload
```

## 10. Gotchas / things to remember

- **A passing render test with a mocked api client proves the component's logic, not
  that the app actually works end to end.** Anything crossing a real network boundary
  (CORS, real HTTP status codes, real serialization) needs a real-browser check at
  least once — this project's own convention, reconfirmed here.
- `curl` never enforces or reveals CORS — it's a browser-only policy. A boot test that
  only uses `curl` (every prior task's pattern) cannot catch a CORS bug; the check has
  to go through an actual browser (or send an explicit `Origin` header and inspect the
  response headers, as done in §6).
- `app.enableCors()`'s permissive default (`*`) is a deliberate v1 choice matching
  "local, single user, no auth" — revisit when DB4-02 (auth) lands.

## 11. Glossary

| Term | Plain meaning |
|---|---|
| Origin | Protocol + host + port together — `localhost:5173` and `localhost:3000` are different origins |
| CORS preflight | An automatic `OPTIONS` request the browser sends first, asking "am I allowed to do this?" |
| `Access-Control-Allow-Origin` | The response header that answers the preflight's question |
| Mutation testing | Breaking code on purpose to prove a test would catch the break |

## 12. Learn next

- **Phase 1 is complete (6/6).** Next eligible is DB2-01 (Lint core in
  `packages/shared`) — the start of Phase 2, "the heart" of DevBrain (spec §6): the
  copy-overlap/missing-link/too-long warnings that make this a distillation tool
  instead of a paste archive.
- Worth a closer look later: NestJS's `enableCors()` accepts an options object
  (`origin`, `credentials`, `methods`) for when the default `*` needs to be scoped down
  — relevant once auth (DB4-02) introduces cookies/credentials that `*` doesn't work
  with.
