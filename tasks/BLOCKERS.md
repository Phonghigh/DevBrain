# Blockers

Tasks paused because they need a decision or information only the owner can provide.
The loop appends here (ROUTINE step 8) and marks the task `- [!]` in
[INDEX.md](INDEX.md). Review these yourself, answer, then flip the task back to `- [ ]`.

Format:

```
## <task-id> <title>
- blocked on: <what's ambiguous or failing>
- need from owner: <the specific decision/info>
- date: <YYYY-MM-DD>
```

---

## DB4-01…DB4-05 — Deferred v2/v3/v4 work (intentional gate, not a real blocker)
- blocked on: nothing technical — these are the post-v1 phases (export `.md`, auth,
  Postgres+deploy, graph view, AI suggest). They're marked `- [!]` so the loop stops
  cleanly once v1 (P0–P3) is done rather than auto-continuing into them.
- need from owner: a decision to **start a specific later phase**. When ready, flip the
  chosen task to `- [ ]` in [INDEX.md](INDEX.md); the loop will pick it up next run and
  write its detailed spec (ROUTINE step 3).
- date: 2026-07-14
