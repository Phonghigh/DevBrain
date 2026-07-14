<!--
  LEARN-LOG REPORT TEMPLATE
  Copy this file to  docs/learn-log/<task-id>-<slug>.md  (e.g. DB0-05-scaffold-shared.md)
  and fill it in. Write for a COMPLETE BEGINNER in plain, simple English.

  Golden rules:
  - Explain like the reader has never seen this tool/concept before. No unexplained jargon.
  - Every technical term the first time it appears gets a 3-8 word plain-English gloss.
  - Prefer a short analogy over a formal definition when introducing an idea.
  - Be honest about dead-ends and mistakes — that is the most useful part to learn from.
  - Depth scales with difficulty. A trivial config task can leave optional sections as
    one line ("Nothing tricky here"). A hard task fills every section.
  - Delete these HTML comments and any section that genuinely does not apply.
-->

# <task-id> — <Short title>

**Status:** not-studied · **Difficulty:** ⭐ / ⭐⭐ / ⭐⭐⭐ · **Date:** <YYYY-MM-DD>
**Commit:** `<short-sha or commit subject>` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md#<anchor>)

---

## 1. In one sentence (ELI5)
> One or two plain sentences a beginner understands. What did we make, and what is
> it for? No jargon.

## 2. Why this task matters / where it fits
- Which phase / part of DevBrain is this? (link the relevant section of the
  [spec](../superpowers/specs/001-devbrain-v1.md))
- What can the project do *after* this that it couldn't before?

## 3. The problem
What made this task require thought? What were we actually trying to solve, in
human terms? (If it was routine, say "This was standard setup — the interesting
part is understanding *why* each piece exists," then focus section 4 on that.)

## 4. Concepts you need to know
> The core of the report. Pick the 2–4 ideas a newbie must grasp. For EACH:

### <Concept name>
- **Plain definition:** what it is, in one sentence, no jargon.
- **Analogy:** "It's like …" — an everyday comparison.
- **Why we use it here:** the concrete reason it showed up in this task.

*(repeat per concept)*

## 5. How I approached it
- The options I considered (even the ones I rejected).
- What I chose and **why** — the trade-off in beginner terms.
- If a well-known pattern/convention drove the choice, name it and link a doc.

## 6. Research trail — how I figured it out
> What I looked up and read to solve this. Curate this from the auto-captured
> trail in `docs/learn-log/.trace/<date>.md` (searches, fetched URLs, commands
> run) into a readable story. Keep the useful links.

- Searched: "…" → found …
- Read: [doc/page](url) — the key thing it told me was …
- Context I needed from this repo: [file](path) …

## 7. Where I got stuck & how I recovered
> The honest, most-instructive part. Errors hit, wrong turns, and the fix.
> If it went smoothly, write "No real snags." Don't invent drama.

- **Symptom:** what went wrong (paste the real error if short).
- **Cause:** why it happened.
- **Fix:** what resolved it, and how I'd avoid it next time.

## 8. The solution, step by step
> A beginner could follow these and reproduce the result. Number the steps.
1. …
2. …

## 9. How to verify it yourself
> Exact commands to run and what a passing result looks like.

```bash
<command>
```
Expected: `<what you should see>`

## 10. Gotchas / things to remember
- Short, punchy reminders. The traps a newbie would fall into.

## 11. Glossary
| Term | Plain meaning |
|---|---|
| <term> | <one line> |

## 12. Learn next
- 1–3 concrete pointers (a doc to read, a concept to look up, the next task this unlocks).
