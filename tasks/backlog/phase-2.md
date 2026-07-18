# Phase 2 — Distill + lint (the heart — spec §6) (detailed task specs)

Detailed specs for P2 tasks, derived on demand from the `INDEX.md` line + the spec
(ROUTINE step 3). Appended to as each task is picked up.

Spec: [../../docs/superpowers/specs/001-devbrain-v1.md](../../docs/superpowers/specs/001-devbrain-v1.md).

---

### DB2-01 — Lint core in `packages/shared`

**Objective.** The anti-copy discipline's actual logic (spec §6.3): a pure function
that looks at a self-written note (`body`) next to the raw dump it came from
(`rawText`) and returns warnings if the note looks copied, has no outgoing link, or
runs too long. This is the check the rest of Phase 2 is built around.

**Depends on.** `DB0-05`.

**Touches.** `packages/shared/src/lint.ts`, `packages/shared/src/index.ts`,
`packages/shared/src/__tests__/lint.test.ts`.

**Steps.**
1. Text normalization helper: lowercase, strip punctuation (unicode-aware — keep
   letters/numbers, drop everything else), collapse whitespace. Needed so
   "Hello, World!" and "hello world" produce the same 5-gram, per spec §11's open
   question ("needs text normalization... decide the normalization approach when
   implementing lint").
2. 5-gram copy-overlap: build the set of 5-word sliding-window phrases ("shingles")
   for the normalized `body`, and separately for `rawText`. Overlap ratio = (body
   5-grams that also appear in `rawText`) / (total body 5-grams). Warn when this ratio
   is **strictly greater than** `LINT_LIMITS.overlapPct` (0.35) — not `>=`, so a note
   sitting exactly at the boundary doesn't get flagged.
3. Missing-link check: does `body` (unmodified — normalization would destroy the
   `[[`/`]]` syntax) contain at least one `[[...]]`? Warn if not.
4. Too-long check: word count of `body` (whitespace-split, not normalized) strictly
   greater than `LINT_LIMITS.maxWords` (200).
5. `lintNote(body: string, rawText: string): LintWarning[]` — runs all 3 rules, returns
   only the warnings that actually fired (empty array = clean note). Define
   `LintWarning` (`{ rule, message }`) here; DB2-02 will reuse it when it builds the
   full `ConceptDto` set rather than redefining it.
6. Unit tests: one boundary pair per rule (exactly at the threshold → no warning; just
   over → warning) using precisely constructed fixtures, not approximate text, plus a
   normalization-matters case and a short-body edge case (fewer than 5 words → no
   crash, no false overlap warning).

**Done when.**
- `lintNote` exported from `@devbrain/shared`.
- Unit tests cover each rule's boundary (not just "it warns sometimes").
- Pure function — no NestJS/Prisma/DOM imports, deterministic, no I/O.
- typecheck/lint/test green across all 4 packages.

**Notes.** Lint is warn-only forever (spec §6.3) — `lintNote` only ever *reports*, it
never throws or blocks. Keep the 3 rules exactly as spec'd; don't add extra rules here
(e.g. no spell-check, no tone analysis) — that's explicitly out of scope for v1.
