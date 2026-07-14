# DB0-07 — Prisma in apps/api

**Status:** not-studied · **Difficulty:** ⭐⭐⭐ · **Date:** 2026-07-14
**Commit:** `tasks(DB0-07): prisma in apps/api` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

We connected the server to a real (if currently empty) database file, and proved the
connection actually works by watching the server boot and create that file live.

## 2. Why this task matters / where it fits

Phase 0 (Foundations) — spec §4 names Prisma + SQLite as the database layer for
`apps/api`. Before this task, the server (DB0-06) could answer `/health` but had no
way to store or read anything. After this task, any future controller can *ask* for a
`PrismaService` (dependency injection — see [DB0-06's lesson](DB0-06-scaffold-api.md)
§4) and get a working, already-connected database client. The actual data tables
(`Capture`, `Concept`, `Link` — spec §5) land in DB1-01; this task is purely "does the
plumbing work," on purpose.

## 3. The problem

This task turned out to be **much harder than the task notes assumed**, and that
mismatch is the real lesson here: the version of Prisma this project installed (7.8.0)
has a noticeably different architecture than the Prisma version the task's original
notes were written against. Instead of forcing the old pattern to fit, I had to read
what the tool *actually* generated, test hypotheses empirically, and adapt. That's a
skill in itself — tooling moves faster than any written instructions, and "the docs/
notes say X" is a starting guess, not a guarantee.

## 4. Concepts you need to know

### ORM (Object-Relational Mapper)
- **Plain definition:** a library that lets you read/write a database using normal
  code (`prisma.user.findMany()`) instead of writing raw SQL strings by hand.
- **Analogy:** a translator between two languages — you speak TypeScript, the database
  speaks SQL, and the ORM translates both ways.
- **Why we use it here:** Prisma is the ORM (spec §2, decision #5) — chosen
  specifically to *learn* the schema → migrate → typed-client workflow.

### Driver adapter (new in this Prisma version)
- **Plain definition:** a small bridge package that tells Prisma's client *how* to
  actually talk to a specific database driver (here: `better-sqlite3`, the standard
  Node.js SQLite library), instead of Prisma reaching into the database on its own.
- **Analogy:** a universal power adapter for travel — the appliance (Prisma Client)
  stays the same, but you plug in a different adapter depending on which "wall socket"
  (database driver) you're actually connecting to.
- **Why we use it here:** in this Prisma version, the schema no longer contains a
  connection URL — the client must be constructed with an explicit adapter
  (`PrismaBetterSqlite3`, from `@prisma/adapter-better-sqlite3`) that's told the URL
  directly. See §7 for how I discovered this was required.

### Prisma migration
- **Plain definition:** a versioned, saved record of a change to the database's
  structure (e.g. "add a `title` column"), stored as a numbered file, so the database
  can be rebuilt or upgraded step by step, and everyone's database stays in sync.
- **Analogy:** a git commit, but for your database's *shape* instead of your code.
- **Why we use it here:** `prisma migrate dev` is how future tasks (starting DB1-01)
  will add real tables. This task deliberately has **zero models**, so there's nothing
  to migrate yet — running the migration command here just proves the toolchain
  (schema → engine → SQLite file) works end-to-end before anything real depends on it.

### Incremental compilation (and why I turned it off)
- **Plain definition:** a TypeScript compiler mode that remembers what it already
  compiled (in a `.tsbuildinfo` file) so a later run can skip re-checking files that
  didn't change — faster, but relies on that cache staying trustworthy.
- **Analogy:** a chef who keeps notes on what's already prepped, so they don't re-chop
  onions that are already chopped — but if someone else throws out the prepped onions
  without telling the chef, the notes now lie.
- **Why it bit us here:** see §7 — a leftover `.tsbuildinfo` file made the compiler
  believe the build output still existed, even after it had been deleted.

## 5. How I approached it

- **Followed the task notes first, adapted when reality disagreed.** The original
  detailed spec (written when the harness was set up, before any Prisma version was
  actually installed) assumed the classic pattern: `url = env("DATABASE_URL")` inline
  in `schema.prisma`. I ran `prisma init` and read what it *actually* generated —
  which had no `url` field at all — rather than hand-writing the old pattern into a
  file the installed tool doesn't expect.
- **Migration timing decision:** the task's notes offered two options — keep the
  schema empty, or add a throwaway model then remove it. I kept it empty, because
  adding-then-removing a fake model creates a migration file that immediately becomes
  historical noise for no benefit; an empty schema honestly represents "no tables
  exist yet," and `prisma migrate dev` handles that gracefully (see §7).
- **Verification philosophy:** rather than writing a throwaway dependency-injection
  test script, I verified `PrismaService` is injectable by watching the *real* server
  boot log — `PrismaModule dependencies initialized` only appears if Nest successfully
  constructed `PrismaService` and its `onModuleInit()` (which calls `$connect()`)
  didn't throw. That's stronger evidence than a synthetic test, and it doesn't step on
  DB0-09's job (setting up the project's actual permanent test infrastructure).

## 6. Research trail — how I figured it out

No web search was available/used — everything here came from **reading the tool's own
generated output** and testing hypotheses directly, which turned out to be faster and
more reliable than guessing from possibly-outdated general knowledge:
- Ran `prisma init --datasource-provider sqlite` and read the actual files it created
  (`schema.prisma`, `prisma.config.ts`, `.env`) instead of assuming the old shape.
- Read the generated client's own source (`src/generated/prisma/client.ts` and
  `internal/class.ts`) to find the real `PrismaClient` export and its documented
  constructor example (which showed a Postgres adapter, `PrismaPg` — the first clue
  that adapters were now required, not optional).
- Grepped the installed `@prisma/adapter-better-sqlite3` package's own `.d.ts` file
  for its exact exported class name (`PrismaBetterSqlite3`) and constructor shape,
  rather than guessing a plausible-sounding name.
- Once wired, **tested empirically by booting the real compiled app** and watching
  stdout/stderr and the filesystem (did `dev.db` actually get created?), rather than
  trusting a clean `tsc` typecheck alone to mean "this works."

## 7. Where I got stuck & how I recovered

This task had **three separate real snags**, each genuinely instructive:

- **Snag 1 — schema shape mismatch.** `prisma init` produced
  `datasource db { provider = "sqlite" }` with no `url` field, and a new
  `prisma.config.ts` file (needing `dotenv`) instead. **Cause:** this Prisma version's
  connection configuration moved out of `schema.prisma` and into a separate config
  file used by the CLI. **Fix:** installed `dotenv`, and — since `prisma.config.ts` is
  only read by the `prisma` CLI (migrate/generate), *not* by the running app — figured
  out the app itself also needs `import 'dotenv/config'` in `main.ts` to load
  `DATABASE_URL` from `.env` at runtime.

- **Snag 2 — the client needs an explicit adapter.** A bare `new PrismaClient()`
  seemed plausible at first, but the generated client's own doc comment showed a
  constructor example with an `adapter` option. **Cause:** since the schema has no
  `url`, the client has no way to know where the database lives unless you tell it
  explicitly via a driver adapter object. **Fix:** installed
  `@prisma/adapter-better-sqlite3` (confirming the package name and export by reading
  its actual `.d.ts`, not guessing), and passed
  `new PrismaBetterSqlite3({ url: process.env.DATABASE_URL })` into `super()` in
  `PrismaService`. Verified by watching the real boot log show
  `PrismaModule dependencies initialized` and `dev.db` actually appear on disk.

- **Snag 3 — a stale build cache lied about the build being done.** After manually
  deleting `dist/` to test a clean rebuild, `nest build` reported success (exit 0) but
  created **no `dist/` folder at all**. **Cause:** `apps/api/tsconfig.json` had
  `"incremental": true`, and a leftover `tsconfig.tsbuildinfo` file (written by an
  earlier `typecheck` run, which shares the same tsconfig) made the compiler believe
  its cached output was still current — even though the actual `dist/` files were
  gone. **Fix:** deleted the stale `.tsbuildinfo` file, and — since this app is small
  enough that incremental builds add no real benefit — removed `"incremental": true`
  from the tsconfig entirely, so this whole class of "silently stale build" bug can't
  recur. **Lesson for next time:** a `tsc`/`nest build` that reports success but
  produces no output is a red flag worth investigating immediately, not brushing past.

- **Bonus environment gotcha (not a Prisma issue, but worth recording):** when I
  backgrounded the Node server with `node dist/main.js &` and later tried
  `kill $BOOT_PID` using bash's own `$!` variable, the kill silently did nothing —
  the process kept running, invisibly holding port 3000 for the rest of the session
  (I only found it later via `netstat -ano`). **Cause:** in this Git Bash / Windows
  environment, bash's job-control PID doesn't reliably match the actual Windows
  process ID for a backgrounded Node process. **Fix:** read the *real* PID from the
  server's own boot log (Nest prints its own process ID, e.g. `[Nest] 23104 -`) and
  used `taskkill //F //PID <that>` instead of trusting `$!`.

## 8. The solution, step by step

1. Installed `@prisma/client` (runtime) and `prisma` + `@nestjs/testing` (dev tools)
   in `apps/api`. Hit pnpm's build-script safety block twice (`@prisma/engines`/
   `prisma`, then later `better-sqlite3`) — approved each explicitly in
   `pnpm-workspace.yaml` with a comment explaining why (same pattern as `esbuild` in
   DB0-05: legitimate, well-known packages whose postinstall just fetches binaries).
2. Ran `prisma init --datasource-provider sqlite`, read what it actually generated,
   and installed `dotenv` (needed by the generated `prisma.config.ts`).
3. Ran `prisma generate` — succeeded even with zero models, producing a typed but
   currently table-less client under `src/generated/prisma/`.
4. Discovered the adapter requirement (§7, snag 2), installed
   `@prisma/adapter-better-sqlite3`, and wrote `PrismaService` (extends the generated
   `PrismaClient`, constructs it with the adapter, implements `onModuleInit`/
   `onModuleDestroy` for connect/disconnect) and `PrismaModule` (`@Global()`, exports
   `PrismaService`) — imported into `AppModule`.
5. Added `import 'dotenv/config'` to `main.ts` so the running app (not just the CLI)
   loads `DATABASE_URL`.
6. Hit and fixed the stale-build-cache bug (§7, snag 3) by removing `incremental` from
   `apps/api/tsconfig.json`.
7. Ran `prisma migrate dev --name init-empty` — created `dev.db`, correctly reported
   "already in sync" since the schema has no models (no migration folder was created —
   expected, since there's genuinely nothing to record yet).
8. Added a `postinstall: "prisma generate"` script to `apps/api/package.json` so the
   generated client (which is git-ignored, like all generated code) regenerates
   automatically on every fresh `pnpm install` — verified by deleting
   `src/generated/` entirely and confirming a plain `pnpm install` recreated it.
9. Cleaned up: removed the auto-created `apps/api/.gitignore` (redundant — the root
   `.gitignore` already covers `.env`/`*.db`; added `apps/api/src/generated/` there
   instead), created a checked-in `.env.example`, trimmed an irrelevant promotional
   comment from `schema.prisma`.
10. Final end-to-end verification: typecheck, build, boot the real compiled server,
    curl `/health`, confirm the boot log shows `PrismaModule dependencies initialized`
    and `dev.db` exists on disk — then killed the server by its real PID (§7).

## 9. How to verify it yourself

```bash
cd apps/api
pnpm typecheck && pnpm build         # both must exit 0
pnpm exec prisma migrate dev --name init-empty   # creates dev.db, reports "already in sync"
node dist/main.js &                  # boot the real compiled server
curl -i http://localhost:3000/health # expect 200 {"status":"ok"}
```
Expected in the boot output: `AppModule dependencies initialized`, then
`PrismaModule dependencies initialized` (proves DI + `$connect()` succeeded), then
`HealthModule dependencies initialized`. Check `ls apps/api/dev.db` — it should exist.
Stop the server afterward — find its real PID from the boot log line
(`[Nest] <pid> -`), don't trust a bash job-control PID on Windows.

## 10. Gotchas / things to remember

- A `tsc`/`nest build` that exits 0 but produces no output file is a red flag —
  check for a stale `.tsbuildinfo` before assuming the code itself is broken.
- On Git Bash / Windows, backgrounding a process with `&` and killing it via bash's
  `$!` variable is unreliable — read the real PID from the process's own log output
  and use `taskkill //F //PID <pid>`, or you'll leave zombie processes holding ports.
- Generated code (`src/generated/prisma/`) is git-ignored on purpose — it's rebuilt by
  `postinstall`. If you ever see "cannot find module '../generated/prisma/client'",
  just run `pnpm install` (or `pnpm exec prisma generate` directly) again.
- `DATABASE_URL` in `.env` is read by two *separate* things that don't share loading
  automatically: `prisma.config.ts` (for CLI commands like `migrate`) and the app's
  own `main.ts` (via the explicit `import 'dotenv/config'` we added) — both need
  their own way of loading it.

## 11. Glossary

| Term | Plain meaning |
|---|---|
| ORM | a library that lets you read/write a database with normal code instead of raw SQL |
| Driver adapter | a bridge package telling Prisma's client which database driver to actually use |
| Migration | a saved, versioned record of a change to the database's structure |
| Incremental compilation | a compiler mode that skips re-checking unchanged files, using a cache file |
| `postinstall` script | code that runs automatically right after `pnpm install` finishes for a package |

- The next task in the backlog is actually **DB0-08** (scaffold `apps/web`) — it comes
  before the real database work because its dependency (DB0-05) was already satisfied
  and it's earlier in the file. **DB1-01** (adds the actual `Capture`/`Concept`/`Link`
  models, spec §5) is the one to watch for after that — that's when you'll see a
  *real* migration folder get created for the first time, and where `PrismaService`
  starts being genuinely useful (queried from a real controller).
- Worth understanding better later (not needed yet): why Prisma moved to a
  driver-adapter architecture at all — it's related to letting Prisma Client run in
  more environments (like edge/serverless runtimes) without bundling a full database
  engine binary into every deployment.
