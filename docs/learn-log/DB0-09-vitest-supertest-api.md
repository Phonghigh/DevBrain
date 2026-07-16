# DB0-09 — Vitest + supertest in apps/api (first e2e)

**Status:** not-studied · **Difficulty:** ⭐⭐⭐ · **Date:** 2026-07-16
**Commit:** `tasks(DB0-09): vitest + supertest in apps/api` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

We taught the backend to test itself: a script that starts the whole server in memory,
asks it `GET /health`, checks the answer is `200 {"status":"ok"}`, and shuts it down —
all automatically, in about a second, with no browser and no real network.

## 2. Why this task matters / where it fits

Phase 0 (Foundations). Until now the only proof the api worked was **me manually
starting it and curling it** (DB0-06, DB0-07). That doesn't scale and nobody re-runs it.

The backlog note on this task says it best: *"This test becomes the template every later
api route reuses."* Every future endpoint — `POST /captures` (DB1-03), `POST /concepts`
(DB2-04), `GET /search` (DB3-02) — copies this file's shape. That's why it was worth
being fussy here: a subtle flaw in the template propagates into every test that follows.
It's also what DB0-11 (CI) will run on every push.

## 3. The problem

Two real decisions hid inside "add a test runner."

1. **Which runner?** NestJS ships with Jest by default. But this repo already uses
   **Vitest** in `packages/shared` (DB0-05).
2. **The one that actually bit:** the fast tools that make Vitest fast (esbuild) *cannot
   do something NestJS fundamentally depends on*. The test would have passed anyway —
   and that's precisely what made it dangerous.

## 4. Concepts you need to know

### Unit test vs. e2e test
- **Plain definition:** a *unit* test checks one small piece in isolation; an *e2e*
  ("end-to-end") test checks the whole thing wired together, the way a real user hits it.
- **Analogy:** a unit test checks that a light switch clicks. An e2e test flips the
  switch and confirms the bulb lights — wiring, fuse box and all.
- **Why we use it here:** `GET /health` returning `{status:'ok'}` is trivial *logic* —
  a unit test would prove almost nothing. The valuable part is that the **whole app
  boots**: every module loads, DI resolves, Prisma connects, the route is mapped. Our
  one test proves all of that.

### supertest
- **Plain definition:** a library that sends fake HTTP requests directly to your app,
  without a real network port.
- **Analogy:** a rehearsal with a stand-in actor. Real lines, real timing, no audience
  and no theatre to rent.
- **Why we use it here:** `request(app.getHttpServer()).get('/health').expect(200)` —
  no port to pick, nothing to collide with, nothing left running. (Compare DB0-07,
  where a real backgrounded server left a **zombie process holding port 3000**. This
  is why tests don't do that.)

### Decorator metadata — the heart of this task
- **Plain definition:** when TypeScript compiles a class with decorators, it can
  *secretly write down the types of the constructor's parameters* so they can be read
  back at runtime. This is the `emitDecoratorMetadata` setting.
- **Analogy:** a piece of furniture arrives with a parts list taped to the box. The
  assembler (Nest) reads the list to know what to fetch. Without the list, the
  assembler looks at the box, sees no list, and cheerfully concludes **"this needs no
  parts"** — then hands you a chair with no legs. It doesn't complain. That's the
  problem.
- **Why we use it here:** this is exactly how Nest's dependency injection knows what to
  give a controller. `constructor(private prisma: PrismaService)` only works because
  the compiler wrote down "param 0 is a PrismaService." Normal builds
  (`nest build` → `tsc`) do this because `apps/api/tsconfig.json` sets
  `emitDecoratorMetadata: true`. **Vitest doesn't use tsc** — it uses esbuild, which
  strips types fast but *cannot* emit this metadata. So under Vitest, the parts list is
  missing.

### SWC
- **Plain definition:** a very fast TypeScript/JavaScript compiler written in Rust —
  like esbuild, but it *can* emit decorator metadata.
- **Analogy:** same express courier, but this one actually tapes the parts list to the box.
- **Why we use it here:** `unplugin-swc` makes Vitest compile the api's code with SWC
  instead of esbuild, so tests see the same DI behavior as the real build.

## 5. How I approached it

**Runner: Vitest, not Jest.** The task explicitly said "pick one and note why." Vitest,
because `packages/shared` already uses it — one runner, one config style, one set of
concepts for the owner to learn. Jest is Nest's default and would work, but a repo where
`pnpm -w test` means two different runners with two different configs is a worse repo to
learn from. The cost of this choice is precisely the decorator-metadata problem below —
Jest with `ts-jest` wouldn't have had it, because it compiles with real tsc. I judged
one extra dev dependency (SWC) cheaper than a permanently split toolchain.

**The DI risk: I predicted it, then insisted on proving it.** I knew esbuild doesn't emit
decorator metadata. But nothing in `apps/api` injects anything *yet* — `HealthController`
has an empty constructor — so the test passed on the first run. **A passing test proved
nothing about the setup's correctness.** Rather than trust my prediction or wave it away,
I wrote a throwaway probe controller that does what DB1-03's `CapturesController` will
do (`constructor(private prisma: PrismaService)`), and measured. Details in section 7 —
including the part where the evidence briefly said I was wrong.

## 6. Research trail — how I figured it out

- Read the api's own source first — `app.module.ts` imports `PrismaModule`, so booting
  `AppModule` in a test connects to SQLite for real. That shaped both the DI experiment
  and the CI check.
- Read [apps/api/tsconfig.json](../../apps/api/tsconfig.json): `emitDecoratorMetadata: true`
  is set there. That line is why `nest build` works — and the whole point is that
  **Vitest never reads it**, because Vitest doesn't run tsc.
- The decisive research wasn't reading anything. It was building the probe and running
  the same test twice — once with esbuild, once with SWC — and diffing the output.
  Two runs settled a question no amount of documentation-reading would have.

## 7. Where I got stuck & how I recovered

**Snag 1 — the test that passed for the wrong reason.**

- **Symptom:** first run: `✓ test/health.e2e-spec.ts (1 test)`. Green.
- **Cause:** green only because nothing injects anything yet. The setup was already
  broken for every future task; the test just couldn't see it.
- **Fix:** added a probe controller injecting `PrismaService`. It **still passed** — so
  I made the probe *assert* the injection instead of merely allowing it. That failed:
  ```
  PROBE RESPONSE: {"injected":false,"typeofPrisma":"undefined","paramtypes":"undefined"}
  ```
  `paramtypes: undefined` = the parts list was never written. And note Nest **did not
  throw** — it silently built the controller with no arguments, leaving `this.prisma`
  as `undefined`. A crash would have been kinder. This would have surfaced in DB1-03 as
  a baffling `Cannot read properties of undefined (reading 'capture')` at runtime, with
  a green test suite insisting everything was fine.

**Snag 2 — the evidence said I was wrong, and I nearly believed the wrong thing twice.**

- **Symptom:** after adding SWC, the probe *still* reported `injected: false`. So I
  added more detail to the probe rather than assuming — and the fuller picture flipped
  the conclusion:
  ```
  {"injected":false,"typeofPrisma":"object","ctorName":"PrismaService","hasConnect":"function"}
  ```
  Injection was **working perfectly**. A real `PrismaService` with a real `$connect`
  method was there. My `instanceof` assertion was the broken part, not the DI.
- **Cause:** under Vite's SSR transform, `instanceof` isn't trustworthy for this — the
  class can end up with two identities in the module graph. **I did not fully
  root-cause this**, because the probe was temporary and the other three signals were
  unambiguous. I'm flagging it as unexplained rather than inventing a tidy reason.
- **The dangerous moment:** at that point the evidence looked like "SWC changed
  nothing" — which would have meant I'd added a dependency for no reason. Instead of
  concluding either way, I re-ran the **esbuild baseline with the same detailed probe**.
  That's what settled it:

  | | `paramtypes` | what got injected |
  |---|---|---|
  | esbuild (no SWC) | `undefined` | `undefined` — silently nothing |
  | SWC | present | real `PrismaService`, `$connect` works |

  SWC was necessary after all. But I only *knew* that after comparing like with like.
- **Lesson:** when a result contradicts your expectation, the first suspect is your
  *measurement*, not the world — and the fix is a better measurement, not a louder
  opinion. A bad probe can make a working system look broken just as easily as a
  shallow test makes a broken system look fine. Both happened here, in that order.

**Snag 3 — pnpm blocked SWC's installer.** `ERR_PNPM_IGNORED_BUILDS: @swc/core`. Same
security gate DB0-05 hit with esbuild: pnpm won't run a package's install script unless
you say so. Approved it in `pnpm-workspace.yaml` with a comment explaining what it does
and why it's safe — matching the existing entries.

**Snag 4 — lint caught what I'd overlooked.** `'expect' is defined but never used`. I'd
imported Vitest's `expect` out of habit, but supertest's own `.expect(200)` does the
asserting. Deleted. Small, but it's the kind of thing that gets copied forever if it
lands in the template file.

## 8. The solution, step by step

1. `pnpm --filter api add -D vitest supertest @types/supertest`.
2. `test/health.e2e-spec.ts`: `Test.createTestingModule({ imports: [AppModule] })` →
   `.compile()` → `createNestApplication()` → `app.init()` in `beforeAll`;
   `app.close()` in `afterAll` (skip this and the process hangs, holding the DB open).
3. The test itself: `request(app.getHttpServer()).get('/health').expect(200).expect({status:'ok'})`.
4. `pnpm --filter api add -D unplugin-swc @swc/core`, then approve `@swc/core` in
   `pnpm-workspace.yaml`.
5. `vitest.config.ts`: add `swc.vite({ jsc: { parser: { decorators: true },
   transform: { legacyDecorator: true, decoratorMetadata: true } } })`. Those last two
   flags **are the whole point** — SWC doesn't infer them from `tsconfig.json`.
6. `"test": "vitest run"` in `package.json`, matching the root passthrough.

## 9. How to verify it yourself

```bash
pnpm --filter api test
```
Expected: `✓ test/health.e2e-spec.ts (1 test)` — one file, one test, about a second.

Prove the *interesting* part yourself — that DI really works under the test runner.
Temporarily comment out the `swc.vite(...)` plugin in `apps/api/vitest.config.ts`, then
add a controller with `constructor(private readonly prisma: PrismaService) {}` and log
`typeof this.prisma`. Without SWC it's `undefined` and **nothing errors**; with SWC it's
a real object. That silent `undefined` is the entire reason SWC is in this repo.

```bash
pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build
```
Expected: green across all 3 packages.

## 10. Gotchas / things to remember

- **A green test can mean "the test can't see the bug."** This one passed while the
  setup was broken for every future task. Ask what a test would have to *do* to fail.
- **Missing decorator metadata fails silently.** Nest doesn't shout "no parts list!" —
  it hands you an object with `undefined` where a service should be.
- **SWC needs `decoratorMetadata: true` spelled out.** It does not read your tsconfig.
- **Don't use `instanceof` to assert DI under Vitest** — Vite's SSR transform makes it
  unreliable. Assert *behavior* (is the method there and does it work?) instead.
- **When a result surprises you, suspect the probe first**, and re-measure the baseline
  before concluding your fix did nothing.
- **`app.close()` in `afterAll`**, always — otherwise the run hangs.
- **pnpm blocks install scripts by default.** Not a bug; approve deliberately, with a
  comment saying why.

## 11. Glossary

| Term | Plain meaning |
|---|---|
| e2e test | Tests the whole app wired together, as a user would hit it |
| Unit test | Tests one small piece in isolation |
| supertest | Sends fake HTTP requests to your app; no real port |
| Test runner | The program that finds your tests, runs them, reports results |
| Vitest / Jest | Two test runners; we use Vitest repo-wide |
| esbuild | Very fast compiler; strips types, **can't** emit decorator metadata |
| SWC | Very fast Rust compiler; **can** emit decorator metadata |
| Decorator metadata | Constructor param types written down for runtime reading |
| `design:paramtypes` | The exact key Nest reads that parts list from |
| DI container | The thing that constructs your classes and supplies their deps |
| `Test.createTestingModule` | Nest's way of booting the app inside a test |
| Transpile | Convert TS to JS without necessarily type-checking it |

## 12. Learn next

- **DB0-10** does the mirror image for the web app (jsdom + Testing Library), then
  **DB0-11** wires all of this into CI so it runs on every push.
- **DB1-03** is where this template gets its real workout — the first controller that
  actually injects `PrismaService`. If SWC were missing, that's where the silent
  `undefined` would have shown up.
- Concept worth your time: read `apps/api/tsconfig.json`'s `emitDecoratorMetadata` line
  and make sure you can explain *why a test runner ignoring it is a problem*. That one
  idea explains this whole task.
