# Learn-Log — teach-back reports for every build task

This folder is your **study companion** to the build. While the routine loop builds
DevBrain one task at a time, it also writes a plain-English report here explaining
*what the problem was, how it was solved, how it was researched, where it got stuck,
and how you (a newbie) could redo it*.

Think of it as the difference between a receipt and a lesson:

| File | What it is | Who it's for |
|---|---|---|
| [tasks/PROGRESS.md](../../tasks/PROGRESS.md) | Terse build ledger (changed / files / verify / commit) | The build machine |
| **`docs/learn-log/<task>.md`** (this folder) | A beginner lesson per task | **You, learning** |
| [docs/LEARNING_LOG.md](../LEARNING_LOG.md) | Your concept-mastery tracker + mind map | Tracking what *you* know |

## How it works (automatic)

1. The build agent finishes a task's code, then — **before committing** — copies
   [`_TEMPLATE.md`](_TEMPLATE.md) to `docs/learn-log/<task-id>-<slug>.md` and fills it
   in, in simple-English newbie tone (see the golden rules in the template).
2. It adds a row to the **[Index](#index)** below and updates the concept tracker in
   [LEARNING_LOG.md](../LEARNING_LOG.md).
3. Report + code are committed **together**, so each commit ships its own lesson.

Two hooks keep this honest (see [.claude/settings.json](../../.claude/settings.json)):

- **Research trail** (`trace-tool.ps1`, PostToolUse): every web search / fetched page /
  shell command Claude runs is auto-appended to `docs/learn-log/.trace/<date>.md`. That
  raw trail (git-ignored, noisy) is the *source material* for sections 6 & 7 of a
  report — so "how I researched it" and "where I got stuck" are grounded in fact, not
  memory.
- **Strict enforcer** (`check-learnlog.ps1`, Stop): if product code under `apps/**` or
  `packages/**` changed but no report was written, the agent **cannot finish** until it
  writes one. This is why reports never get skipped.

## Reading a report

Each report follows the same shape (see [`_TEMPLATE.md`](_TEMPLATE.md)):
one-sentence ELI5 → why it matters → the problem → **concepts you need** (the meat) →
how I approached it → research trail → where I got stuck → step-by-step solution → how
to verify → gotchas → glossary → what to learn next.

**Status marker** at the top of each report tracks *your* study progress — flip it
yourself as you go:

- `not-studied` — written by the agent, you haven't read it yet
- `studying` — you're working through it
- `studied` — you understand it (consider updating [LEARNING_LOG.md](../LEARNING_LOG.md))

## Index

Newest at the top. One row per task report.

| Task | Report | Difficulty | Status |
|---|---|---|---|
| DB0-09 | [Vitest + supertest in apps/api (first e2e)](DB0-09-vitest-supertest-api.md) | ⭐⭐⭐ | not-studied |
| DB0-08 | [Scaffold apps/web (Vite + React + router)](DB0-08-scaffold-web.md) | ⭐⭐ | not-studied |
| DB0-07 | [Prisma in apps/api](DB0-07-prisma-in-api.md) | ⭐⭐⭐ | not-studied |
| DB0-06 | [Scaffold apps/api (NestJS + /health)](DB0-06-scaffold-api.md) | ⭐⭐⭐ | not-studied |
| DB0-05 | [Scaffold packages/shared](DB0-05-scaffold-shared.md) | ⭐⭐ | not-studied |
