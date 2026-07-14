# DB0-06 — Scaffold apps/api (NestJS + /health)

**Status:** not-studied · **Difficulty:** ⭐⭐⭐ · **Date:** 2026-07-14
**Commit:** `tasks(DB0-06): scaffold apps/api` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

We built the first real backend server: a small program that, when you run it, sits
and listens for web requests, and answers one URL (`/health`) with "yes, I'm alive."

## 2. Why this task matters / where it fits

This is Phase 0 (Foundations) — spec §4 "Architecture & Stack" names `apps/api` as
NestJS + Prisma + SQLite. Before this task, the repo had no server at all — only a
library package (`packages/shared`, DB0-05) that nothing can *run* on its own. After
this task, there is a real, bootable HTTP server. Every future backend feature
(captures, concepts, lint, search — spec §7) will be added *inside* this same server,
as new NestJS modules alongside `HealthModule`.

## 3. The problem

NestJS is a *framework* (a structured way of organizing backend code), not just a
library — it comes with its own vocabulary (module, controller, provider) and its own
way of wiring pieces together (dependency injection, decorators). The real problem here
wasn't "make an HTTP server respond" (that's a few lines in plain Node) — it was
understanding *why* NestJS wants you to split that into three separate files
(`health.module.ts`, `health.controller.ts`, and registering the module in
`app.module.ts`) instead of just one file with a route handler.

## 4. Concepts you need to know

### Decorator (e.g. `@Controller('health')`, `@Get()`)
- **Plain definition:** a special `@Something` annotation placed right above a class
  or method that attaches extra metadata/behavior to it, without changing the code
  inside.
- **Analogy:** it's like a sticky note on a filing folder that says "this folder is
  the HEALTH folder" — the folder's contents don't change, but now the filing system
  knows how to route things to it.
- **Why we use it here:** `@Controller('health')` tells Nest "every route inside this
  class starts with `/health`"; `@Get()` on the `check()` method tells Nest "answer
  `GET` requests to that path by calling this method." NestJS reads these decorators
  at startup to build its routing table — you never manually register `/health` GET`
  → some function like you might in plain Express.

### Controller
- **Plain definition:** a class whose job is *only* to receive an incoming HTTP
  request and decide what to send back.
- **Analogy:** the receptionist at a front desk — takes the request, doesn't do the
  actual work itself, just directs it and returns an answer.
- **Why we use it here:** `HealthController` (`src/health/health.controller.ts`) has
  one method, `check()`, that returns `{ status: 'ok' }`. NestJS turns that into a
  JSON HTTP response automatically — we never touch `req`/`res` directly.

### Module
- **Plain definition:** a way of grouping related controllers (and, later, services)
  into one labeled unit that the app can import as a whole.
- **Analogy:** a department in a company. "Health" is a tiny department with one
  employee (the controller); later, "Captures" and "Concepts" will be their own
  departments, each imported into the company's org chart (`AppModule`).
- **Why we use it here:** `HealthModule` declares `controllers: [HealthController]`,
  and the root `AppModule` declares `imports: [HealthModule]`. This is how Nest builds
  its whole app: one root module that imports feature modules, which is exactly the
  shape every later feature (Captures, Concepts) will follow.

### Dependency Injection (DI)
- **Plain definition:** instead of a class creating the other objects it needs by
  hand (`new Something()`), it just *declares* what it needs, and the framework
  hands it the right instance automatically.
- **Analogy:** ordering food at a restaurant vs. cooking it yourself — you just say
  what you want (declare a dependency), and the kitchen (Nest's DI container)
  prepares and delivers it.
- **Why we use it here:** `HealthController` doesn't need any dependencies yet (it's
  the simplest possible example), but this is the exact mechanism that will later let
  `ConceptsController` just *ask* for a `PrismaService` in its constructor and receive
  a working, already-connected database client — without writing any wiring code
  itself. Understanding this now, on the simplest possible example, makes it much less
  mysterious later.

## 5. How I approached it

- **CLI vs. hand-written files:** NestJS ships a CLI (`nest new`) that scaffolds a
  project interactively. I hand-wrote the files instead (same approach as
  `packages/shared` in DB0-05), because `nest new` prompts for a package manager
  choice interactively, which doesn't work well in an automated loop — and hand-writing
  a 6-file skeleton is small enough to do directly while keeping full control over
  naming (`api`, matching the `pnpm --filter api` convention already used in the
  backlog).
- **Build tool: `nest build`, not plain `tsc`:** the task notes flagged that esbuild-
  style fast transpilers (used by tools like `tsx`/`ts-node-dev`) can't emit the
  `emitDecoratorMetadata` output Nest's dependency injection needs — they strip types
  without running a full type-checking compile pass, so the decorator metadata Nest
  reads at runtime (e.g. "what type does this constructor parameter expect?") never
  gets generated. `nest build` wraps the real TypeScript compiler, so it's the safe
  choice for anything decorator-based.
- **Separate `tsconfig.json` for `apps/api`:** the shared `tsconfig.base.json`
  (DB0-03) is deliberately ESM/Bundler-flavored (`module: ESNext`,
  `moduleResolution: Bundler`) for `packages/shared` and the future `apps/web`. NestJS's
  traditional tooling expects `module: CommonJS` — so `apps/api/tsconfig.json`
  overrides `module`, `moduleResolution`, `verbatimModuleSyntax`, and turns on
  `experimentalDecorators`/`emitDecoratorMetadata`, while still extending the base for
  everything else (strict mode, etc.).

## 6. Research trail — how I figured it out

This was mostly applying already-established patterns rather than fresh research:
- Reused the `packages/shared` hand-scaffold approach from DB0-05 instead of running
  the interactive `nest new` CLI.
- Followed the task's own detailed notes in
  [tasks/backlog/phase-0.md](../../tasks/backlog/phase-0.md) (written when the harness
  was set up), which already named the exact tsconfig overrides needed and the
  esbuild/decorator-metadata gotcha — so I didn't need to search for that, just apply
  it and verify it was actually true (see §7).
- Used `pnpm add`/`pnpm add -D` (rather than hand-typing dependency versions into
  `package.json`) specifically so pnpm would resolve and pin the *actual current*
  NestJS 11.x versions instead of me guessing a version number that might not exist.

## 7. Where I got stuck & how I recovered

- **Symptom:** `pnpm typecheck` failed with
  `src/main.ts(6,20): error TS2580: Cannot find name 'process'. Do you need to install
  type definitions for node? Try npm i --save-dev @types/node.`
- **Cause:** `main.ts` reads `process.env.PORT` — but `process` is a Node.js global,
  and TypeScript doesn't know about Node's globals unless you install `@types/node`
  (a package of *type definitions only*, no actual code) so the compiler knows what
  shape `process` has.
- **Fix:** ran `pnpm add -D @types/node` in `apps/api`, then typecheck passed clean.
  **Lesson for next time:** any package that touches Node built-ins (`process`, `fs`,
  `path`, etc.) needs `@types/node` as a devDependency — `packages/shared` didn't need
  it because its only code (`LINT_LIMITS`) never touches Node APIs.

## 8. The solution, step by step

1. Created `apps/api/package.json` (name `api`, scripts for `build`/`start`/
   `start:dev`/`typecheck`/`lint`), then used `pnpm add` to install the NestJS runtime
   (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `reflect-metadata`,
   `rxjs`) and `pnpm add -D` for the dev tools (`@nestjs/cli`, `typescript`,
   `@types/node` — added after hitting the error in §7).
2. Created `apps/api/tsconfig.json` extending the base config with the CommonJS/
   decorator overrides described in §5.
3. Created `apps/api/nest-cli.json` (points the CLI at `src` as the source root).
4. Created `src/main.ts` (boots the app, listens on `process.env.PORT ?? 3000`).
5. Created `src/app.module.ts` (the root module, imports `HealthModule`).
6. Created `src/health/health.module.ts` (declares `HealthController`).
7. Created `src/health/health.controller.ts` (`@Controller('health')`, one
   `@Get()` method returning `{ status: 'ok' }`).
8. Verified everything end-to-end (see §9) — including actually booting the compiled
   server and curling it, not just trusting a clean typecheck.

## 9. How to verify it yourself

```bash
pnpm --filter api typecheck   # tsc --noEmit — no type errors
pnpm --filter api build       # nest build — compiles src/ -> dist/
node apps/api/dist/main.js &  # boot the compiled server in the background
curl -i http://localhost:3000/health
```
Expected: the curl response is `HTTP/1.1 200 OK` with body `{"status":"ok"}`; the
server's boot log shows `AppModule dependencies initialized`, `HealthModule
dependencies initialized`, and `Mapped {/health, GET} route`. Stop the background
server afterward (it doesn't exit on its own).

Also: `pnpm build` / `pnpm typecheck` / `pnpm lint` at the **repo root** now pick up
`apps/api` automatically alongside `packages/shared` (both are pnpm workspace
packages) — no per-package command needed once you're just checking "does everything
still work."

## 10. Gotchas / things to remember

- Any package whose code touches Node.js built-ins (`process`, `fs`, `path`, …) needs
  `@types/node` as a devDependency, or `tsc` won't know those globals exist.
- Don't use a fast/esbuild-based dev runner for NestJS code — it silently breaks
  dependency injection by skipping decorator metadata emission. Always build through
  `nest build` (or `nest start`/`nest start --watch` for dev, which use the same
  compiler under the hood).
- `dist/` is git-ignored (set up back in the harness's `.gitignore`) — you'll see it
  locally after building, but it should never show up in `git status`.
- The compiled server (`node dist/main.js`) does **not** exit on its own — if you boot
  it manually to test, remember to kill the process afterward.

## 11. Glossary

| Term | Plain meaning |
|---|---|
| Decorator | a `@Something` annotation that attaches metadata/behavior to a class or method |
| Controller | a class that receives HTTP requests and returns responses |
| Module | a group of related controllers/services that Nest can import as one unit |
| Dependency Injection (DI) | a class declares what it needs; the framework supplies the actual instance |
| `@types/node` | a package of type definitions (no runtime code) so TypeScript understands Node.js globals |

## 12. Learn next

- **DB0-07** (next task) adds Prisma — this is where dependency injection stops being
  abstract: you'll write a `PrismaService` and *inject* it into future controllers,
  using the exact mechanism explained in §4 here.
- Worth reading later (not needed yet): NestJS's own "First Steps" docs, which cover
  the same module/controller/provider trio in more depth once you've seen it work
  once with your own hands.
