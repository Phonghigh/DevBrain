# CLAUDE.md — guide for agents working in this repo

This is **DevBrain**: a personal knowledge base that turns raw GPT/Claude dumps into
self-written, `[[wikilinked]]` notes. Read the spec
([docs/superpowers/specs/001-devbrain-v1.md](docs/superpowers/specs/001-devbrain-v1.md))
for scope, stack, data model, and the distill/lint discipline. The project **builds
itself** one atomic task at a time — see [tasks/README.md](tasks/README.md) and
[tasks/ROUTINE.md](tasks/ROUTINE.md).

## Repo map (once scaffolded)
- `apps/api` — NestJS + Prisma + SQLite REST API.
- `apps/web` — React + Vite (3 screens: Inbox, Distill, Browse).
- `packages/shared` — types/DTOs + the lint constants (`LINT_LIMITS`), reused by both.
- `docs/` — the [spec](docs/superpowers/specs/001-devbrain-v1.md), the learn-log (below),
  and [LEARNING_LOG.md](docs/LEARNING_LOG.md).
- `tasks/` — the backlog, routine loop, progress ledger.

## Conventions
- TypeScript **strict**. Put pure logic (lint, wikilink parsing, DTOs) in
  `packages/shared` so api and web reuse one implementation.
- Match surrounding code style. Add/update tests for behavior you add.
- Verify before marking a task done: `pnpm -w typecheck`, `pnpm -w lint`, `pnpm -w test`.
- Don't push or use `--no-verify` unless the owner set that up.
- **Never weaken the distill discipline** (spec §6). Lint is warn-only but stays; the
  Distill editor's Peek/split-pane must not degrade into a paste-through box. This
  discipline is the whole reason DevBrain exists instead of a copy-paste archive.

## ⭐ The Learn-Log Rule (this project is a learning project)

The owner is a **beginner learning backend by watching this project get built**. So
teaching is a first-class deliverable, not an afterthought.

**Whenever a session changes product code (anything under `apps/**` or
`packages/**`), you MUST write a learn-log report before you finish:**

1. Copy [docs/learn-log/_TEMPLATE.md](docs/learn-log/_TEMPLATE.md) to
   `docs/learn-log/<task-id>-<slug>.md` (for ad-hoc work with no task id, use a short
   descriptive slug, e.g. `fix-lint-overlap.md`).
2. Fill it in for a **complete beginner**, in **simple English**: explain the problem,
   the concepts involved (with analogies), how you approached it and what you rejected,
   how you researched it, where you got stuck, and how they could redo and verify it.
   Follow the golden rules at the top of the template.
3. Ground the "Research trail" and "Where I got stuck" sections in the auto-captured
   trail at `docs/learn-log/.trace/<today>.md` (every search / fetched page / shell
   command you ran is logged there) — curate it into a readable story.
4. Add a row to the index in [docs/learn-log/README.md](docs/learn-log/README.md), and
   update the concept tracker + mind map in [docs/LEARNING_LOG.md](docs/LEARNING_LOG.md)
   (use the `learning-log` skill).
5. Commit the report **together with** the code it explains.

**Depth scales with difficulty** — a one-line config change gets a short report; a
lint-engine or Prisma task gets the full treatment. But the report is never skipped: a
**Stop hook blocks finishing** a code-changing session until the report exists (see
[docs/learn-log/README.md](docs/learn-log/README.md) and
[.claude/settings.json](.claude/settings.json)).

Tone everywhere in the learn-log: **assume no prior knowledge, define jargon on first
use, prefer analogies, be honest about mistakes** — the dead-ends are the most useful
part to learn from.

## Progress is surfaced automatically
A SessionStart hook (`.claude/hooks/session-start-brain.py`) reads `tasks/INDEX.md` +
`docs/LEARNING_LOG.md` and injects the current phase, done/todo/blocked counts, and the
next eligible task at the start of every session.
