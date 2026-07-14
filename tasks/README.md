# Task System — how DevBrain builds itself one task at a time

This folder turns the [spec](../docs/superpowers/specs/001-devbrain-v1.md) into a
backlog of **atomic tasks**, each sized for a single agent run. A self-paced loop
executes **one task per iteration**, teaches it back, marks it done, and commits — so
the project builds itself incrementally while the owner learns backend from the
per-task lessons.

## Files

| File | Role |
|---|---|
| [INDEX.md](INDEX.md) | The full ordered backlog. Checkboxes are the **single source of truth** for status. |
| [ROUTINE.md](ROUTINE.md) | The per-iteration playbook — the prompt the loop runs each time. |
| [PROGRESS.md](PROGRESS.md) | Append-only log of completed tasks (date, id, summary, commit). |
| [BLOCKERS.md](BLOCKERS.md) | Questions/decisions that paused a task. Review these yourself. |
| [_TEMPLATE.md](_TEMPLATE.md) | Shape of a detailed task spec. |
| `backlog/phase-*.md` | Detailed specs per phase. `phase-0.md` is written; later phases are derived on demand (ROUTINE step 3). |
| [../docs/learn-log/](../docs/learn-log/) | **Beginner lesson per task** — the "teach it back" report the loop writes each run. Your study companion. |
| [../CLAUDE.md](../CLAUDE.md) | Agent guide + the **Learn-Log Rule** (loaded every session). |

## Status markers in INDEX.md
- `- [ ]` todo · `- [x]` done · `- [!]` blocked (see BLOCKERS.md)

## How to run the loop (self-paced `/loop`)

Each iteration runs a fresh agent with this prompt:

```
Read tasks/ROUTINE.md and execute exactly ONE task, then stop.
```

Drive it self-paced (no interval — the model paces itself, so you can read each task's
learn-log lesson before the next one runs):

```
/loop Read tasks/ROUTINE.md and execute exactly ONE task, then stop.
```

Other options if you ever want them:
- **Timed:** add an interval, e.g. `/loop 1h Read tasks/ROUTINE.md and execute exactly ONE task, then stop.`
- **Manual:** just send the prompt yourself whenever you want the next task done.

> The loop is **resumable and stateless**: all state lives in `INDEX.md` +
> `PROGRESS.md`, so it survives restarts and runs on any machine.

## Every session shows progress automatically

A SessionStart hook (`.claude/hooks/session-start-brain.py`) reads `INDEX.md` and
`../docs/LEARNING_LOG.md` and injects a status line at the top of each session —
done/todo/blocked counts, current phase, and the next eligible task. You never have to
ask "where am I".
