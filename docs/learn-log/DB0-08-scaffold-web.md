# DB0-08 — Scaffold apps/web (Vite + React + router)

**Status:** not-studied · **Difficulty:** ⭐⭐ · **Date:** 2026-07-16
**Commit:** `tasks(DB0-08): scaffold apps/web` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

We built the front end — the part you actually see in a browser: an empty three-page
website (Inbox, Distill, Browse) where the pages are still just headings, but clicking
between them already works without the browser ever reloading.

## 2. Why this task matters / where it fits

Phase 0 (Foundations). Spec §4 names `apps/web` as React + Vite, and §7 names the three
v1 screens. Before this task the repo could *run* a server (`apps/api`, DB0-06) and
*import* shared code (`packages/shared`, DB0-05), but there was nothing a human could
look at. After this task there's a real website you can open.

It also proves something important for later: `apps/web` can import from
`packages/shared`. That matters because the lint rules (spec §6) must run in **both**
the api and the web UI, and they have to agree on the same numbers. This task is the
first time we proved that wire actually carries current — the Distill page really does
display `35%` and `200 words` read live from `LINT_LIMITS` in `packages/shared`.

## 3. The problem

Most of this is standard setup — the interesting part is understanding *why* each
piece exists. But one genuine problem showed up, and it's worth the whole report:

**How does `apps/web` import code from `packages/shared` when `shared` has to be
compiled first?** `packages/shared` is written in TypeScript, and its `package.json`
says "my code lives in `dist/`" — a folder that only exists *after* you build it. So on
a freshly cloned repo, `dist/` doesn't exist yet, and anything importing `@devbrain/shared`
can't find it. I got this wrong on the first attempt (section 7).

## 4. Concepts you need to know

### Vite (the dev server + bundler)
- **Plain definition:** a tool that serves your app to the browser while you're
  developing it, and packs it into a few small files when you're ready to ship.
- **Analogy:** a restaurant with two modes. During the day (dev mode) it cooks each
  dish to order the instant you ask — fast, one at a time. For catering (build mode)
  it prepares everything in advance and boxes it up to travel well.
- **Why we use it here:** browsers can't read `.tsx` files. In dev, Vite converts each
  file to browser-readable JavaScript *on demand* as the browser asks for it, which is
  why it started in **580ms**. `vite build` instead pre-packs everything into one
  232kB file for production.

### SPA routing (Single-Page Application)
- **Plain definition:** the website swaps the page content with JavaScript instead of
  asking the server for a whole new page.
- **Analogy:** a normal website is a book where turning a page means closing the book
  and fetching a different one. An SPA is a whiteboard — the frame stays, someone just
  wipes the middle and redraws it.
- **Why we use it here:** clicking Inbox → Distill should be instant, and shouldn't
  throw away anything you were typing. `react-router` watches the URL and decides
  which component to draw in the middle.

### The history fallback (why `/inbox` doesn't 404)
- **Plain definition:** the dev server answers *every* URL with the same `index.html`,
  and lets the JavaScript figure out which page to show.
- **Analogy:** a receptionist who sends every visitor to the same lobby, because the
  lobby's own directory board knows where they should actually go.
- **Why we use it here:** there is no `/inbox` file on disk — only `index.html`. When I
  curled `/inbox`, `/distill` and `/browse`, all returned **200** with identical
  `index.html`. That's not a bug; that's the fallback doing its job. The *real* page
  only appears once React runs and reads the URL.

### TypeScript project references + `tsc -b`
- **Plain definition:** a way to tell TypeScript "this project depends on that other
  project," so it can build them in the right order.
- **Analogy:** a recipe that says "requires pizza dough (see page 12)." Plain `tsc`
  reads the recipe and fails because there's no dough. `tsc -b` ("build mode") turns
  to page 12, *makes the dough*, then continues.
- **Why we use it here:** this is exactly what fixed the section 3 problem — see below.

## 5. How I approached it

Files: hand-written, not generated with `npm create vite`. Same choice as DB0-05/DB0-06 —
the generator would scatter demo counters, CSS and logos we'd delete anyway, and the
point of this project is that the owner can read every line and know why it's there.

For the `shared` import problem I considered three options:

1. **Require `pnpm build` before typechecking.** Rejected: it means a fresh clone can't
   run `pnpm -w typecheck` without a magic extra step, and CI (DB0-11) would hit this.
2. **Point `shared`'s exports at `src/` instead of `dist/`.** Rejected: it would work
   for web but break `apps/api`, which is CommonJS and consumes the built output.
3. **Declare a TypeScript project reference and use `tsc -b`.** ✅ Chosen. Web's
   `tsconfig.json` declares `"references": [{ "path": "../../packages/shared" }]`, and
   its `typecheck` script is `tsc -b` instead of `tsc --noEmit`. TypeScript sees the
   dependency and builds `shared` first, automatically.

Option 3 is the standard TS monorepo pattern and needed no compromise anywhere else.

Routing detail worth naming: `router.tsx` exports the route table **without** wrapping
it in a Router. `main.tsx` wraps it in `BrowserRouter` (real browser). That leaves the
next task (DB0-10) free to wrap the same table in a `MemoryRouter` (a fake pretend URL
bar) for tests. A component that hard-codes its own Router is painful to test.

## 6. Research trail — how I figured it out

- Read this repo first — [packages/shared/package.json](../../packages/shared/package.json)
  (its `exports` map points at `dist/`, the root of the whole problem),
  [tsconfig.base.json](../../tsconfig.base.json) (strict, ESM/Bundler — web can extend
  it as-is, unlike api which had to override it), and
  [apps/api/package.json](../../apps/api/package.json) for the version-pinning style.
- Checked what actually installed rather than trusting the `^` ranges I wrote:
  React **19.2.7**, react-router **7.18.1**, Vite **7.3.6**.
- Checked react-router v7's own type definitions to confirm `StaticRouter` is exported
  from the main entry (it is) — I needed it for the render probe in section 9.
- The decisive experiment wasn't reading docs at all; it was deleting `dist/` and
  watching what broke (section 7).

## 7. Where I got stuck & how I recovered

**Snag 1 — I wrote a comment that was a lie, and the experiment caught it.**

- **Symptom:** I'd added the project reference to web's `tsconfig.json` with a comment
  claiming it "lets tsc resolve `@devbrain/shared` straight from its source, so
  typecheck doesn't require a build first." `pnpm --filter web typecheck` passed, so it
  looked true. But it only passed because `dist/` happened to already exist from an
  earlier task. When I moved `dist/` away to check:
  ```
  src/app/routes/DistillRoute.tsx(1,29): error TS2307: Cannot find module '@devbrain/shared'
  ```
- **Cause:** I'd assumed project references *redirect* module resolution from `dist/`
  to `src/`. They don't do it the way I thought. TypeScript first follows the `exports`
  map to `dist/index.d.ts`; if that file doesn't exist, resolution **fails outright**,
  and there's nothing left for a redirect to act on.
- **Fix:** switch the script from `tsc --noEmit` to `tsc -b`, which *builds* `shared`
  rather than trying to peek at its source. Then I rewrote the comment to say what's
  actually true.
- **Lesson:** a passing check proves nothing if the thing it depends on was already
  lying around from before. To test "does this work on a fresh clone?", you have to
  actually create fresh-clone conditions.

**Snag 2 — the "it's already up to date" trap, again.**

- **Symptom:** my first `tsc -b` attempt *still* failed with the same TS2307, and
  didn't rebuild `dist/` at all.
- **Cause:** `packages/shared/tsconfig.tsbuildinfo` — a notes-to-self file TypeScript
  writes recording what it built last time. I had deleted `dist/` behind its back, so
  the buildinfo still insisted everything was up to date, and `tsc -b` believed it.
- **Fix:** delete the `.tsbuildinfo` too, then `tsc -b` correctly rebuilt `dist/` and
  typechecked clean. **This is the same class of bug as DB0-07's stale `.tsbuildinfo`
  in `apps/api`** — twice in two tasks now. If a build tool insists there's nothing to
  do and you know that's wrong, suspect its cache file.

**Snag 3 — proving the pages actually render (three dead ends).**

- **Symptom:** curl gave `200` for every route, but that only proves the *shell* was
  served — it can't run JavaScript, so it can't tell me React rendered anything.
- **Attempt 1:** launch the dev server with `Start-Process pnpm ...` → `%1 is not a
  valid Win32 application` (on Windows, `pnpm` is a `.cmd` script, not a real program).
  Ran `node vite.js` directly instead — but the obvious path didn't exist either,
  because pnpm doesn't put real folders in `node_modules`; it symlinks them into a
  `.pnpm` store. Found the true path with `readlink -f`.
- **Attempt 2:** headless Edge with `--dump-dom` → produced **zero bytes**, three
  different ways. Rather than keep poking it, I switched approach entirely.
- **Attempt 3:** rendered the routes in Node using React's server renderer + a
  throwaway probe bundled with esbuild. First try crashed (`Dynamic require of "util"
  is not supported` — an ESM/CommonJS mismatch); bundling as `--format=cjs` fixed it.
  This printed the real HTML for all four routes and proved the `LINT_LIMITS` import.
- **Resolution:** the probe flagged one thing it *couldn't* judge —
  `<Navigate> must not be used on the initial render in a <StaticRouter>`, so `/`
  rendered empty. That warning is specific to server-rendering (a server can't
  "navigate"), and our app is browser-only — but I didn't want to hand-wave the
  redirect. So I went back to Edge, and it turned out `Start-Process` with
  `-RedirectStandardOutput` (rather than shell redirection) worked fine. `/` rendered
  the Inbox heading: the redirect is real.
- **Lesson:** when a tool fights you three times, change tools instead of flags. Also:
  two imperfect checks that fail *differently* can together be stronger than one — the
  Node probe proved the shared import, the browser proved the redirect.

## 8. The solution, step by step

1. Write `apps/web/package.json` (name `web`, so `pnpm --filter web dev` works) with
   react, react-dom, react-router, and `"@devbrain/shared": "workspace:*"` — the
   `workspace:*` protocol means "use the local copy in this repo, never download it."
2. `pnpm install`.
3. `tsconfig.json`: extend the strict base, add `"lib": [... "DOM"]` (browser APIs),
   `"jsx": "react-jsx"` (React 19's automatic runtime — no `import React` in every
   file), `"noEmit": true` (Vite compiles; tsc only checks), plus the project
   reference to `shared`.
4. `vite.config.ts` — just the React plugin. `index.html` with `<div id="root">`, the
   one element React draws into.
5. Three route components, each a heading and a placeholder. `DistillRoute` imports
   `LINT_LIMITS` and displays the real numbers.
6. `router.tsx`: an `AppLayout` (nav + `<Outlet/>`, the hole routes render into) with
   the three routes nested inside, plus `index` → `<Navigate to="/inbox" replace/>`.
7. `main.tsx`: find `#root`, wrap `AppRoutes` in `BrowserRouter` + `StrictMode`.
8. Set `typecheck` to `tsc -b` so `shared` builds on demand.

## 9. How to verify it yourself

```bash
pnpm --filter web dev
```
Expected: `VITE v7.3.6 ready in ~600 ms` and a Local URL. Open it — the browser lands
on **Inbox** (redirected from `/`). Click Distill and Browse: the heading changes, the
active link is highlighted, and the browser never shows a reload spinner. Distill shows
"above 35% overlap ... past 200 words" — those numbers come from `packages/shared`, not
from that file.

The stronger check — that everything still works from nothing:

```bash
rm -rf packages/shared/dist apps/web/dist apps/api/dist
find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete
pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build
```
Expected: all green across all three packages. The interesting line is
`apps/web typecheck$ tsc -b tsconfig.json` succeeding **even though `shared/dist` was
just deleted** — that's the section 7 fix doing its job.

## 10. Gotchas / things to remember

- **`200` from curl on `/inbox` doesn't mean the page works.** It means the shell was
  served. Only a browser (or a renderer) can tell you React actually drew something.
- **If a build tool says "nothing to do" and you know it's wrong, delete its
  `.tsbuildinfo`.** Second time this has bitten this project.
- **A green check on a dirty machine proves nothing.** Delete the build output and try
  again before you believe "it works from scratch."
- **`tsc --noEmit` doesn't build dependencies; `tsc -b` does.**
- **Don't wrap your route table in a Router.** Let the entry point choose — real
  browser gets `BrowserRouter`, tests get `MemoryRouter`.
- **On Windows, `pnpm`/`npx` are `.cmd` shims** — `Start-Process` can't launch them
  directly. Launch `node` with the real script path.

## 11. Glossary

| Term | Plain meaning |
|---|---|
| Vite | Serves your app instantly while developing; packs it for shipping |
| SPA | A site that swaps content with JS instead of loading new pages |
| Bundler | Packs many source files into a few files a browser can load fast |
| History fallback | Server answers every URL with `index.html`; JS picks the page |
| JSX / `.tsx` | HTML-looking syntax inside TypeScript; compiled to real JS |
| `react-jsx` | React 19's automatic runtime — no `import React` needed |
| Route | A rule: "when the URL is X, show component Y" |
| `<Outlet/>` | The hole in a layout where the current route is drawn |
| `workspace:*` | "Use the local package in this repo," never the internet |
| Project reference | "This TS project needs that one built first" |
| `tsc -b` | Build mode — builds referenced projects, then this one |
| `.tsbuildinfo` | TypeScript's memory of its last build; goes stale, lies |
| `StrictMode` | Dev-only double-checking that surfaces sloppy React code |
| SSR | Rendering React to HTML on a server instead of in a browser |

## 12. Learn next

- **DB0-10** (the next web task) adds real render tests — it will mount `InboxRoute`
  in a `MemoryRouter`, which is exactly why `router.tsx` doesn't own its Router.
- Read react-router's [tutorial](https://reactrouter.com/start/declarative/routing) —
  the declarative mode is what we use here.
- The concept most worth your time from this task: **why `dist/` vs `src/` matters**.
  Almost every confusing monorepo error traces back to "the built output isn't there
  yet, or is stale."
