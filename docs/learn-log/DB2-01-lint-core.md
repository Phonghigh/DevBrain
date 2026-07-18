# DB2-01 — Lint core in packages/shared

**Status:** not-studied · **Difficulty:** ⭐⭐⭐ · **Date:** 2026-07-18
**Commit:** `tasks(DB2-01): lint core` · **Build note:** [PROGRESS.md](../../tasks/PROGRESS.md)

---

## 1. In one sentence (ELI5)

DevBrain can now look at a note you wrote next to the raw text it came from and tell
you three things: "you're basically copying this," "you didn't link it to anything,"
or "this is too long" — without ever stopping you from saving.

## 2. Why this task matters / where it fits

This is the first task of **Phase 2 — "the heart"** (spec §6, §6.3). Everything in
Phase 1 was plumbing to get text into a database; this is the actual anti-copy
discipline the whole project exists to enforce (spec §1: "the owner just rejected an
archive-style learning vault... a web form that makes paste → Save too easy drags us
right back into that trap"). `lintNote()` is the function DB2-04 (`POST /concepts`)
will call on every save, and DB2-08 (the Distill editor) will use to show warnings —
but it's deliberately built and proven here first, on its own, with no api or UI
attached.

## 3. The problem

The 3 rules sound simple, but 2 of them hide real decisions: "5-gram overlap" needs an
actual definition (5-gram of *what*, exactly, and overlap measured *how*?), and the
spec itself flags this as unresolved (§11: "5-gram overlap needs text normalization...
decide the normalization approach when implementing lint"). The other risk is proving
a boundary condition (">35%", not "≥35%") is actually implemented as specified,
not just "warns when it looks like a lot of overlap."

## 4. Concepts you need to know

### Shingling / n-grams (here, 5-grams)
- **Plain definition:** breaking a text into overlapping chunks of N consecutive
  words — "shingles" — so you can compare two texts chunk-by-chunk instead of
  word-by-word (too noisy) or whole-document-by-whole-document (too coarse).
- **Analogy:** think of sliding a 5-word window across a sentence one word at a time,
  like a magnifying glass moving along a strip of text, taking a snapshot ("cat sat on
  the mat", "sat on the mat quietly", ...) at every position.
- **Why we use it here:** two notes can share individual words constantly ("the",
  "and", "concept") without meaning anything — but sharing whole 5-word runs is a much
  stronger signal of literal copying, which is exactly the "you're copying" case spec
  §6.3 wants flagged.

### Overlap ratio (which side is the denominator matters)
- **Plain definition:** `lintNote` measures **what fraction of the note's own 5-grams
  also show up in the source** (`matches / bodyGrams.size`), not the other way around.
- **Analogy:** it's like asking "what percentage of *my* sentences also appear in the
  textbook," not "what percentage of the *textbook* do I quote" — a huge source with a
  tiny quoted note should still get flagged hard, even though the quote is a small
  fraction of the source itself.
- **Why we use it here:** this choice determines whether a short, heavily-copied note
  from a long source correctly triggers the warning. Getting the denominator backwards
  would make the check nearly useless for the exact case it's meant to catch (a short
  note that's mostly copy-paste).

### Text normalization before comparing
- **Plain definition:** lowercase everything, strip punctuation, collapse repeated
  whitespace — so two phrases that are "the same words" but typed differently ("Hello,
  World!" vs "hello world") are recognized as identical when building 5-grams.
- **Analogy:** it's like alphabetizing a filing cabinet by content, not by whatever
  capitalization or spacing the label happened to use.
- **Why we use it here:** without this, a note that rephrases the source with different
  capitalization/punctuation (but is still effectively copied) would slip past the
  check entirely — normalization is what makes the overlap check actually catch
  "same words, cosmetically different," not just byte-for-byte identical text.

## 5. How I approached it

- Kept `lintNote` a genuinely pure function — no imports beyond `LINT_LIMITS` (also
  pure), no NestJS/Prisma/DOM — matching the task's explicit "pure function, no deps"
  acceptance criterion and `packages/shared`'s existing minimalism (spec §4: "only
  TypeScript types/DTOs + lint constants... no heavy runtime logic").
- Split `LINT_LIMITS` out of `index.ts` into its own `lint-limits.ts` file so `lint.ts`
  could import it without creating a circular import (`index.ts` → `lint.ts` →
  `index.ts` would have been a cycle if `LINT_LIMITS` had stayed inline).
- Ran the missing-link check against the **original, unmodified** `body` — not the
  normalized version — because normalization strips `[` and `]` as punctuation, which
  would destroy the exact syntax the check is looking for. Two different text
  representations for two different checks, on purpose.
- Defined `LintWarning` here (in DB2-01) rather than waiting for DB2-02, since
  `lintNote` needs *some* return type to exist at all — DB2-02 (Shared Concept DTOs)
  will import and reuse this type rather than redefining it, even though the INDEX.md
  line lists `LintWarning` under DB2-02's deliverables.
- For the boundary tests, rejected "roughly some text that's mostly the same" in favor
  of **precisely constructed word counts** — e.g. a 24-word body engineered to have
  exactly 20 five-grams, with a raw text sharing exactly 11 or 12 of those words to
  land exactly on or just past the 35% line. Approximate fixtures can't prove a strict
  `>` boundary; only exact ones can.

## 6. Research trail — how I figured it out

- Re-read spec §6.3's table and §11's open question closely — the spec is honest that
  normalization wasn't decided in the brainstorm, so this task had to make and justify
  that call, not just implement a fully-specified algorithm.
- Worked the boundary math by hand before writing any test code: for a body of N
  words, gram count = N − 4 (sliding window of 5 requires at least 5 words, and each
  additional word adds one more gram position). Picked N=24 → 20 grams, then solved for
  how many leading words rawText needs to share to land at exactly 7/20 = 0.35 (11
  words → 7 grams) versus 8/20 = 0.40 (12 words → 8 grams).
- Wrote the first version of the normalization test with an *assumed* overlap ratio
  that turned out wrong (see §7) — caught by actually running the test rather than
  trusting the hand-wavy comment I'd written next to it.
- Followed `packages/shared`'s existing file-per-concern pattern (`capture.ts`
  alongside `index.ts`, from DB1-02) for where to put `lint.ts` and `lint-limits.ts`.

## 7. Where I got stuck & how I recovered

- **Symptom:** the first test run had 3 failures — the normalization test (expected a
  warning, got none) and both too-long boundary tests (both off by exactly one word).
  **Cause (too-long):** I appended `' [[a-link]]'` to the `words(200)`/`words(201)`
  fixtures thinking I needed a link present too, but `' [[a-link]]'` is itself 1 more
  whitespace-separated token — so `words(200) + ' [[a-link]]'` is actually 201 words,
  not 200. The "boundary" test was silently testing the wrong boundary.
  **Fix:** dropped the unnecessary link entirely — the too-long test only needs to
  isolate the too-long rule, and `.find(w => w.rule === 'too-long')` already ignores
  any other warnings that might also fire.
  **Cause (normalization):** my first fixture used a 9-word note body and assumed (in a
  comment, not verified) it produced "exactly 1 gram" — it actually produces 5 grams,
  and only 1 of the 5 happened to match the raw text, giving 20% overlap — correctly
  *below* the 35% threshold, so no warning, which was the test's actual bug, not the
  implementation's.
  **Fix:** shrank the note body to exactly 5 words so there's genuinely only 1 possible
  gram, and made sure the raw text's first 5 words (after normalization) matched it
  exactly — 1/1 = 100% overlap, unambiguously over the threshold.
  **Lesson:** a comment asserting "this fixture produces X" is a claim, not a fact —
  I'd caught myself doing exactly the kind of unverified assumption this project has
  flagged before (DB0-08's false comment about project references); the fix here was
  the same as there: run it and look, don't just reason and assume.
- Also mutation-tested the `> 0.35` boundary itself afterward (flipped it to `>=`,
  confirmed the exact-boundary test failed, reverted) — this one worked correctly the
  first time, unlike the fixtures above.

## 8. The solution, step by step

1. Wrote DB2-01's detailed spec into a new `tasks/backlog/phase-2.md` (no P2 file
   existed yet).
2. Extracted `LINT_LIMITS` from `index.ts` into `lint-limits.ts` to avoid a circular
   import.
3. `lint.ts` — `normalize()` (lowercase, strip punctuation, collapse whitespace),
   `fiveGrams()` (sliding-window shingles), `copyOverlapRatio()` (body-grams-matched ÷
   body-grams-total), a `WIKILINK_PATTERN` regex check against the raw body, a
   whitespace-based `wordCount()`, and `lintNote()` combining all 3 rules.
4. `__tests__/lint.test.ts` — exact boundary pairs for copy-overlap (35% exactly vs.
   just over) and too-long (200 vs. 201 words), a normalization-matters case, a
   short-body edge case, missing-link on/off, and an "all clean" / "multiple warnings
   at once" pair.
5. Hit and fixed 3 fixture bugs (§7), verified all 10 tests pass.
6. Mutation-tested the copy-overlap boundary (`>` → `>=`), confirmed the boundary test
   catches it, reverted.
7. Ran the full clean-state CI sequence; confirmed no test files leaked into
   `packages/shared/dist`.

## 9. How to verify it yourself

```bash
cd packages/shared
pnpm exec vitest run src/__tests__/lint.test.ts
```
Expected: 10 passed.

```bash
# from repo root, full clean-state check
find . -name dist -not -path "*/node_modules/*" -exec rm -rf {} +
find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete
pnpm -w typecheck && pnpm -w lint && pnpm -w test && pnpm -w build
```
Expected: all exit 0; `packages/shared/dist/` contains no `__tests__` files.

## 10. Gotchas / things to remember

- **Overlap is measured against the body's own gram count, not the source's** — a
  short, heavily-copied note from a huge source should still warn hard. Don't
  "simplify" this to compare against the source's gram count later; that would break
  the exact case the rule exists for.
- Appending extra text to a word-count fixture (like `' [[a-link]]'`) silently changes
  the word count by however many whitespace-separated tokens you added — verify the
  actual count, don't eyeball it.
- The missing-link check must run on the **original** body, never the normalized one —
  normalization strips `[[`/`]]` along with all other punctuation.
- A comment claiming "this fixture produces X grams / Y% overlap" is unverified until
  the test actually runs and passes for the *right* reason — check the real numbers,
  don't just assert them in a comment.

## 11. Glossary

| Term | Plain meaning |
|---|---|
| Shingle / n-gram | A sliding window of N consecutive words used to compare texts chunk-by-chunk |
| Overlap ratio | Here: fraction of the note's own 5-grams that also appear in the source |
| Normalization | Lowercasing + stripping punctuation + collapsing whitespace before comparing text |
| Warn-only | The lint result is informational — `lintNote` never throws or blocks a save |

## 12. Learn next

- DB2-02 (Shared Concept DTOs) — will import `LintWarning` from this task rather than
  redefining it, and build `ConceptDto`/`CreateConceptDto`/`BacklinkDto` around it.
- DB2-04 (`POST /concepts`) is where `lintNote` actually gets called for real, on a
  real save — worth revisiting this report once that's wired up, to see the warnings
  flow through an actual request/response.
