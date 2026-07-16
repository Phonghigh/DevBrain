# DB0-10 — Vitest + Testing Library in apps/web (first render test)

**Status:** not-studied · **Difficulty:** ⭐⭐ · **Date:** 2026-07-16
**Commit:** `tasks(DB0-10): vitest + testing library in apps/web` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

We taught the *front end* to test itself: a script that draws a React screen into a
pretend browser, looks for the "Inbox" heading the way a screen reader would, and says
so if it's missing — no real browser, no clicking, about a third of a second.

## 2. Why this task matters / where it fits

Phase 0 (Foundations), and the mirror image of DB0-09 (which did this for the api).

Recall DB0-08: to prove the three screens rendered, I had to boot a dev server and drive
**headless Edge** — after three failed attempts at it. That was slow, fiddly, and
nobody is ever going to re-run it by hand. This task replaces that ceremony with
`pnpm --filter web test`. After this, all three packages have tests, `pnpm -w test`
runs everything, and DB0-11 (CI) has something real to run on every push.

Every later screen copies this file's shape: the Inbox screen (DB1-06), the Distill
editor (DB2-08), Browse (DB3-03).

## 3. The problem

This was mostly standard setup — the interesting part is understanding *why* each piece
exists. Two questions were worth actual thought:

1. **React needs a browser; tests don't have one.** `document.getElementById`,
   `<div>`, clicking — none of that exists in Node. So what does React draw *into*?
2. **What should a UI test actually assert?** It's easy to write a test that passes and
   proves nothing (DB0-09 taught that the hard way). "Is the text 'Inbox' somewhere on
   the page" is a much weaker claim than it looks.

## 4. Concepts you need to know

### jsdom
- **Plain definition:** a fake browser, written in JavaScript, that runs inside Node —
  it has a `document`, elements, and events, but no window you can see.
- **Analogy:** a flight simulator. Real controls, real instrument readings, real
  responses to what you do — just no actual aeroplane and no actual sky.
- **Why we use it here:** `environment: 'jsdom'` in the config tells Vitest to set up
  this fake browser before tests run. React then renders into it exactly as it would
  into a real page. Fast (no browser to launch) and reliable (nothing to time out) —
  compare the three dead ends I hit driving real headless Edge in DB0-08.

### Testing Library + `render`/`screen`
- **Plain definition:** `render()` draws a component into the fake DOM; `screen` is how
  you then look for things in it.
- **Analogy:** `render` puts the poster on the wall; `screen` is you standing back and
  reading it.
- **Why we use it here:** `render(<InboxRoute/>)` then `screen.getByRole(...)` — the
  test interacts with the result the way a person would, rather than reaching inside
  the component to inspect its internals.

### Querying by *role* — the idea that makes the test worth writing
- **Plain definition:** find elements by what they *are* to a user
  (`getByRole('heading', { name: 'Inbox' })`), not by CSS class or a test-only id.
- **Analogy:** asking for "the emergency exit" rather than "the third door from the
  left." If someone rearranges the room, the first request still finds the right door —
  and it also checks the door is genuinely *marked* as an exit.
- **Why we use it here:** `getByRole('heading', { name: 'Inbox' })` asserts two things
  at once: the text is there, **and** it's a real heading — the thing a screen-reader
  user navigates by. A test looking only for the *text* "Inbox" would happily pass if
  someone replaced `<h1>` with a plain `<p>`, silently breaking accessibility. I proved
  this rather than assumed it (section 7).

### MemoryRouter
- **Plain definition:** a router that keeps the current URL in a plain variable instead
  of touching the browser's address bar.
- **Analogy:** rehearsing with a prop phone. It behaves like a phone for the scene's
  purposes; it isn't connected to anything.
- **Why we use it here:** this is why DB0-08 deliberately kept `router.tsx` free of its
  own Router — `main.tsx` supplies `BrowserRouter` for the real app, and tests supply
  `MemoryRouter`. `InboxRoute` needs no routing *today*, but it will the moment it
  links anywhere, and this file is the template later screens copy.

### `cleanup()` between tests
- **Plain definition:** unmount everything a test rendered, so the next test starts with
  an empty page.
- **Analogy:** wiping the whiteboard between meetings. Skip it and the next meeting
  starts arguing with yesterday's diagram.
- **Why we use it here:** jsdom's document persists across tests in a file. Without
  cleanup, a second test looking for a heading might find the *previous* test's — a
  false pass, which is the exact failure mode DB0-09 warned about.

## 5. How I approached it

**Config lives in `vite.config.ts`, not a separate `vitest.config.ts`** — the opposite
of what `apps/api` does, and the difference is worth understanding. A standalone
`vitest.config.ts` **replaces** `vite.config.ts` rather than merging with it. For web,
that would drop the `@vitejs/plugin-react` plugin and the tests would render without
React's JSX transform. The api has no such plugin to lose, so a separate file is fine
there. Same repo, two different answers, for a concrete reason.

**Deps:** vitest (already the repo's runner — DB0-05, DB0-09), jsdom, and Testing
Library's React bindings + jest-dom matchers. I also reflexively installed
`@testing-library/user-event` (for typing/clicking) and then **removed it**: nothing in
this task types or clicks. It'll earn its place in DB2-08 when the Distill editor needs
it. An unused dependency is a small lie about what the code needs.

**Scope note:** I was tempted to also test the *route table* from DB0-08 (mount
`AppRoutes` in a `MemoryRouter`, assert `/browse` renders Browse and `/` redirects) —
that's the logic I currently only verify by hand with a browser. But the backlog says
"first render test," and the routine's guardrail is one task per run, so I filed it as a
follow-up in [PROGRESS.md](../../tasks/PROGRESS.md) instead of quietly widening this
commit.

## 6. Research trail — how I figured it out

- Mostly read this repo rather than the internet. [apps/api/vitest.config.ts](../../apps/api/vitest.config.ts)
  (DB0-09) set the pattern; the merge-vs-replace point above is why web's differs.
- [apps/web/src/app/router.tsx](../../apps/web/src/app/router.tsx) — the DB0-08 decision
  to keep the route table Router-free is what made the `MemoryRouter` test trivial. That
  choice paid off exactly one task later.
- The decisive step, again, wasn't reading — it was **breaking the component on purpose**
  to see whether the test noticed (section 7).

## 7. Where I got stuck & how I recovered

No real snags — the setup worked on the first run. But DB0-09's lesson (*a green test
can mean "the test can't see the bug"*) meant a first-run pass was **not** enough
evidence, so I spent the time proving the test could fail:

- **The check:** I temporarily downgraded `<h1>Inbox</h1>` to `<p>Inbox</p>` — same
  text, no longer a heading — and re-ran.
- **The result:** it failed, with a genuinely useful message:
  ```
  TestingLibraryElementError: Unable to find an accessible element
  with the role "heading" and name "Inbox"
  ```
  That's the proof. The test isn't just checking that the word "Inbox" appears
  somewhere; it's checking the page still has a real, navigable heading. Then I restored
  the file and confirmed green again — and confirmed via `git status` that the restored
  file was byte-identical to the committed one, rather than trusting that my copy-back
  worked.
- **Why bother:** this is a *template*. Every later screen's test copies it. A weak
  assertion here would be copied into a dozen files before anyone noticed it never
  fails.
- **Small self-correction:** my restore command silently used the wrong path (I was
  already inside `apps/web`, so `apps/web/src/...` didn't exist). The `&&` chain
  short-circuited, so the backup survived and no harm was done — but it's a reminder to
  read the error, not just the exit code.

## 8. The solution, step by step

1. `pnpm --filter web add -D vitest jsdom @testing-library/react @testing-library/jest-dom`.
2. In `vite.config.ts`, add `/// <reference types="vitest/config" />` at the top (so TS
   knows about the `test` key) and a `test` block: `environment: 'jsdom'`,
   `setupFiles: ['./src/test/setup.ts']`, `include: ['src/**/*.test.{ts,tsx}']`.
3. `src/test/setup.ts`: `import '@testing-library/jest-dom/vitest'` (adds the matchers
   *and* their types), plus an `afterEach(cleanup)`.
4. `src/app/routes/InboxRoute.test.tsx`: `render(<MemoryRouter><InboxRoute/></MemoryRouter>)`,
   then `expect(screen.getByRole('heading', { name: 'Inbox' })).toBeInTheDocument()`.
5. `"test": "vitest run"` in `package.json`, matching the root passthrough.

## 9. How to verify it yourself

```bash
pnpm --filter web test
```
Expected: `✓ src/app/routes/InboxRoute.test.tsx (1 test)`.

Better — prove the test actually works, the way I did. Open
[InboxRoute.tsx](../../apps/web/src/app/routes/InboxRoute.tsx), change `<h1>Inbox</h1>`
to `<p>Inbox</p>`, and re-run. It should **fail** with "Unable to find an accessible
element with the role heading". Put the `<h1>` back. A test you've never seen fail is a
test you don't know you have.

```bash
pnpm -w test
```
Expected: all three packages — shared (2 tests), api (1), web (1).

## 10. Gotchas / things to remember

- **A test that has never failed is not yet evidence.** Break the thing on purpose once.
- **`getByRole` > `getByText` > test ids.** Roles assert *meaning*, so they catch
  accessibility regressions that a text search sails straight past.
- **A separate `vitest.config.ts` replaces `vite.config.ts`, it doesn't merge.** For web
  that would silently drop the React plugin.
- **Always `cleanup()` between tests** — jsdom's document is shared within a file, and a
  leftover element can make a broken test pass.
- **Don't install a dependency "for later."** `user-event` goes in when something
  actually types.
- **`getByRole` throws when it finds nothing** (that's why the failure message is so
  good); `queryByRole` returns null and is what you use to assert something is *absent*.

## 11. Glossary

| Term | Plain meaning |
|---|---|
| jsdom | A fake browser running inside Node; no visible window |
| Render test | Draw a component, then assert what's on the resulting page |
| Testing Library | Tools to query the DOM the way a user perceives it |
| `render` / `screen` | Draw the component / look at what got drawn |
| Role | What an element *is* to assistive tech (heading, button, link) |
| Accessible name | The text a screen reader announces for an element |
| jest-dom | Extra matchers like `toBeInTheDocument()` |
| `MemoryRouter` | Router that keeps the URL in memory, not the address bar |
| `cleanup` | Unmount everything between tests |
| Setup file | Code that runs before every test file |
| Mutation testing | Deliberately break code to check the test notices |

## 12. Learn next

- **DB0-11** (next, and the last of Phase 0) runs all of this in CI on every push —
  which is the point of everything since DB0-09.
- **DB1-06** builds the real Inbox screen, and its test starts from this file.
- Read Testing Library's [guiding principles](https://testing-library.com/docs/guiding-principles)
  — one short page, and it explains *why* `getByRole` is preferred over reaching for
  classes or test ids.
