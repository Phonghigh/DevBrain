# Progress log

Append-only. Newest at the bottom. One section per completed task.
Written by the routine loop (see [ROUTINE.md](ROUTINE.md) step 7).

Format:

```
## <YYYY-MM-DD> — <task-id> <title>
- changed: <what>
- files: <key paths>
- verify: <typecheck/lint/test result>
- follow-up: <anything noticed, or none>
- commit: <short message>
```

---

<!-- entries below -->

## 2026-07-14 — DB0-01 .editorconfig + refresh root README.md
- changed: added `.editorconfig` (UTF-8, LF, final newline, trim trailing whitespace, 2-space indent; markdown exempted from trailing-whitespace trimming so hard line breaks survive). Rewrote `README.md` in English: what/why, a Stack line, and a "How it builds itself" section pointing at `tasks/README.md` + the `/loop` one-liner.
- files: `.editorconfig`, `README.md`
- verify: config/docs only — no build tooling exists yet (pnpm workspace lands in DB0-02), so nothing to typecheck/lint/test. Confirmed both files present and correct; touches neither `apps/**` nor `packages/**`, so no learn-log report required (Stop hook doesn't ask).
- follow-up: none. Next eligible: DB0-02 (pnpm workspace).
- commit: tasks(DB0-01): editorconfig + english readme

