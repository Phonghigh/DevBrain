# ROUTINE — execute exactly ONE task per run

You are a build agent for **DevBrain** (a knowledge base — see the spec at
[../docs/superpowers/specs/001-devbrain-v1.md](../docs/superpowers/specs/001-devbrain-v1.md)).
Each run you complete **one** atomic task from the backlog, then stop. You start cold
with no memory of previous runs — all state is in the repo. Follow these steps exactly.

## 0. Orient (read first)
- Read [tasks/INDEX.md](INDEX.md) — the backlog + status.
- Skim the spec ([../docs/superpowers/specs/001-devbrain-v1.md](../docs/superpowers/specs/001-devbrain-v1.md))
  for context as needed — especially §5 (data model) and §6 (distill + lint).
- Read the tail of [tasks/PROGRESS.md](PROGRESS.md) to see what just shipped.

## 1. Pick the next task
- Scan `INDEX.md` top-to-bottom. The next task is the **first `- [ ]`** whose
  **dependencies (`deps:`) are all `- [x]`**.
- If a `- [!]` blocked task is next, skip it and take the next eligible one.
- If no task is eligible (all done, or all remaining are blocked), **stop** and write
  a short status summary. Do not invent work.

## 2. Confirm scope
- You implement **only this one task**. Do not start the next one, even if small.
- If the task is too large for one run (many files / multiple distinct efforts),
  **split it**: replace its line in `INDEX.md` with 2–4 smaller `- [ ]` sub-tasks
  (suffix ids like `DB2-04a`, `DB2-04b`), then implement only the first.

## 3. Get the detailed spec
- Open `tasks/backlog/phase-<N>.md` and find this task's section.
- **If no detailed section exists** (P1+ are not pre-written): create one now using
  [_TEMPLATE.md](_TEMPLATE.md), deriving the detail from the `INDEX.md` line plus the
  spec. Append it to the correct `backlog/phase-<N>.md` (create the file if missing).
  Then implement against it.

## 4. Implement
- Stack per the spec §4: pnpm workspace · `apps/api` = NestJS + **Prisma** + SQLite ·
  `apps/web` = React + Vite · `packages/shared` = types/DTOs + lint constants.
- TypeScript **strict**. Put pure logic (lint, wikilink parse, DTOs) in
  `packages/shared` so both api and web reuse it. Match surrounding conventions.
- Keep the change focused. Add/update tests for the behavior you add.
- **Do not weaken the distill discipline** (spec §6): lint is warn-only but must
  stay; the Peek/split-pane editor must not become a paste-through box.

## 5. Verify (must pass before marking done)
Run what applies to the files you touched (use the repo's scripts once they exist):
- Typecheck: `pnpm -w typecheck` (or per-package `tsc --noEmit`).
- Lint: `pnpm -w lint`.
- Tests: `pnpm -w test` (or the package's `vitest run` / api e2e).
- Meet the task's **Done when** acceptance criteria explicitly.

If verification fails and you cannot fix it this run, see step 8 (blocked).

## 6. Teach it back — write the learn-log report (before committing)
This is a **learning project** (owner is learning backend by watching it get built).
Every task that changes product code must ship a beginner lesson alongside it
(see [../CLAUDE.md](../CLAUDE.md) → the Learn-Log Rule).
1. Copy [../docs/learn-log/_TEMPLATE.md](../docs/learn-log/_TEMPLATE.md) to
   `docs/learn-log/<task-id>-<slug>.md` and fill it in for a **complete beginner in
   simple English**: the problem, the concepts (with analogies), how you approached it
   and what you rejected, how you researched it, where you got stuck, and how to redo
   + verify it. Scale depth to difficulty (trivial config = short; hard task = full).
2. Ground the "Research trail" / "Where I got stuck" sections in the auto-captured
   trail at `docs/learn-log/.trace/<today>.md` — curate it into a readable story.
3. Add a row to the index in [../docs/learn-log/README.md](../docs/learn-log/README.md).
4. Update the concept tracker + mind map in [../docs/LEARNING_LOG.md](../docs/LEARNING_LOG.md)
   using the `learning-log` skill (new concepts this task introduces → `not-started`).
> A Stop hook enforces this: if `apps/**`/`packages/**` changed but no report was
> written, you will be blocked from finishing until you write it. (Pure config/docs
> tasks that touch neither don't need a report.)

## 7. Bookkeeping + commit (on success)
1. Mark the task `- [x]` in `INDEX.md`.
2. Append one entry to `PROGRESS.md`:
   `## <YYYY-MM-DD> — <task-id> <title>` then bullets: changed, files, verify result,
   any follow-up.
3. Commit everything (**including the learn-log report from step 6**):
   - Stage all changes. Commit message: `tasks(<task-id>): <title>` + short body.
   - The repo is already a git repo (branch `main`). Do **not** push. Do **not** use
     `--no-verify`.
4. **Stop.** One task per run.

## 8. If blocked
- Mark the task `- [!]` in `INDEX.md`.
- Append to [BLOCKERS.md](BLOCKERS.md): the task id, what's blocking, and the specific
  decision/info you need from the owner.
- Then either take the next eligible task (back to step 1) **or**, if the blocker is
  fundamental, stop and report. Never thrash retrying the same failing approach.

## Guardrails
- **One task, every run.** Extra ideas → a `PROGRESS.md` follow-up or a new `- [ ]`
  line in `INDEX.md`, not into this commit.
- Don't fake green. If tests fail, the task isn't done — block it instead.
- **Teach every code change** (step 6) — the Stop hook enforces it.
- Don't delete or rewrite earlier tasks' work unless this task says to.
- Keep `INDEX.md` ordering intact; only change checkboxes or split lines.
