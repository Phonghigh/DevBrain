# Spec 001 — DevBrain v1

> **Status:** Draft (brainstorm approved, not yet planned)
> **Date:** 2026-07-14
> **Phase:** v1 (local, single user, no auth)
> **Source:** Locked during the brainstorm session — 6 decisions in §2.

---

## 1. Context & Motivation

DevBrain is a personal knowledge base that turns **raw GPT dumps into self-written,
linked notes** (`[[wikilink]]`), replacing the clunky old CLI flow (paste in terminal +
Ctrl+Z + `code -w`).

**Motivation (in the owner's priority order):**

1. **Learn backend for real** ← the primary driver. The knowledge store is just the
   excuse to practice BE + DB + API + FE + deploy. That's why "over-engineering" here
   is actually on-target.
2. Easier data entry than the CLI.
3. Nicer lookup / browsing.
4. Multi-device access (later phase).

**Anti-goal (the thing to avoid at all costs):** becoming a *copy machine with a pretty
UI*. The owner just rejected an "archive-style learning vault" precisely because it
encouraged pasting. A web form that makes "paste → Save" **too easy** drags us right
back into that trap. So the **capture → distill → lint** discipline (§6) is the core —
not an optional feature, and it must not be cut.

---

## 2. Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Repo | New standalone repo `devbrain` (this repo) |
| 2 | BE stack | NestJS + **Prisma** + SQLite |
| 3 | Storage | **DB is source-of-truth**; export to `.md` deferred to a later phase |
| 4 | Discipline | Keep `capture → distill → lint` (anti-copy) |
| 5 | ORM | **Prisma** (learn schema → migrate → typed client; a new pattern vs XmindClone) |
| 6 | Monorepo | **Keep `packages/shared`**, minimal (share types/DTOs between api ↔ web) |

---

## 3. Scope

### In v1
- Capture: paste a raw GPT dump into an inbox.
- Distill: write a self-authored note from one capture, in a split-pane editor with a
  "Peek" at the source.
- Lint on save (warn-only, never blocks): copy-overlap, missing `[[link]]`, too long.
- Auto-create stub concepts + backlinks from `[[wikilink]]`.
- Browse: list / view (with backlinks) / simple full-text search.
- Local, single user, no auth, one SQLite file.

### Out of v1 (phased — to avoid overload)
| Phase | Content |
|-------|---------|
| **v2** | Export endpoint to `.md` (keep an Obsidian/git mirror). |
| **v3** | Auth (login). |
| **v4** | Deploy: SQLite → Postgres, host → use from phone. Graph view. AI suggestions (does NOT auto-write notes). |

---

## 4. Architecture & Stack

Lean pnpm workspace, 3 parts (same shape as XmindClone, so nothing is re-learned from
scratch):

```
devbrain/
├─ apps/
│  ├─ api/          # NestJS REST API
│  └─ web/          # React + Vite (3 screens)
├─ packages/
│  └─ shared/       # shared types/DTOs (minimal)
├─ docs/superpowers/specs/
└─ pnpm-workspace.yaml
```

- **DB:** SQLite + Prisma. Zero setup (one `.db` file), explicit migrations.
- **shared:** only TypeScript types/DTOs + lint constants (thresholds, word limits). No
  heavy runtime logic.

---

## 5. Data model (Prisma) — 3 tables

No `tags` table (per the decision "empty tags forever is fine").

```prisma
model Capture {
  id        String   @id @default(cuid())
  source    String   // e.g. "chatgpt", "claude", "manual"
  task      String?  // context: what you were doing when you dumped it
  rawText   String   // the raw GPT dump
  status    String   @default("raw")  // "raw" | "distilled" | "archived"
  createdAt DateTime @default(now())
  concepts  Concept[]  // notes born from this capture
}

model Concept {
  id              String   @id @default(cuid())
  slug            String   @unique          // identifier for [[wikilink]]
  title           String
  body            String   @default("")     // the self-written note
  type            String   @default("concept") // "concept" | "stub"
  sourceCaptureId String?
  sourceCapture   Capture? @relation(fields: [sourceCaptureId], references: [id])
  firstSeen       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  outLinks        Link[]   @relation("out")  // outgoing edges
}

model Link {
  id            String  @id @default(cuid())
  fromConceptId String
  fromConcept   Concept @relation("out", fields: [fromConceptId], references: [id])
  toSlug        String  // points at the target slug (may be a body-less stub)
  @@unique([fromConceptId, toSlug])
}
```

- **Backlink = reverse query:** "who points at slug X" = `Link.where(toSlug = X)` → join
  `fromConcept`.
- **Stub:** when parsing `[[slug-that-doesnt-exist-yet]]`, the server auto-creates a
  `Concept{ type: "stub", body: "" }` so the edge isn't broken — same behavior as the
  old `brain` links.

---

## 6. Distill + Lint flow — THE CORE (anti "copy machine")

### 6.1 Capture (friction = 0, on purpose)
One textarea to paste + pick `source` / `task` → `POST /captures`. Raw entry must be
easy.

### 6.2 Distill (friction is high, on purpose)
Pick one `status=raw` capture. **Split-pane** screen:

```
┌─────────────────────────┬─────────────────────────┐
│  Note editor (EMPTY)     │  GPT source — hidden     │
│  you type it yourself    │  behind a [Peek] button. │
│  ≥1 [[link]] required    │  Readable, but NOT       │
│                          │  pasted straight into    │
│                          │  the editor.             │
└─────────────────────────┴─────────────────────────┘
```

UX constraint: the source sits behind "Peek" to force **read-then-rewrite**, not a
one-shot copy.

### 6.3 Lint on Save (server-side, WARN-ONLY)
Like a warn-only pre-commit: **warns but still saves.**

| Rule | Condition | Level |
|------|-----------|-------|
| Copy-overlap | 5-gram overlap between `body` and `rawText` > **35%** | ⚠️ "you're copying" |
| Missing link | `body` has no `[[...]]` at all | ⚠️ flag it (≥1 link expected) |
| Too long | `body` > **200 words** | ⚠️ "distill it shorter" |

> Thresholds (35%, 200) live in `packages/shared` so they're reused by both the server
> lint and the web display.

### 6.4 After save
The server parses `[[wikilink]]`s in `body` → creates a `Link` per edge; any slug
without a `Concept` gets an auto-created **stub**. Sets `Capture.status` → `distilled`.

---

## 7. API (NestJS)

| Method | Route | Notes |
|--------|-------|-------|
| POST | `/captures` | create a raw capture |
| GET | `/captures?status=raw` | inbox |
| POST | `/concepts` | create a note → **run lint** → parse links → create stubs |
| GET | `/concepts` | list |
| GET | `/concepts/:slug` | one note + **backlinks** |
| PUT | `/concepts/:slug` | edit a note (re-run lint + re-sync links) |
| GET | `/search?q=` | simple full-text over title + body |

Lint response accompanies POST/PUT `/concepts`: `{ concept, warnings: LintWarning[] }` —
the web shows warnings, never blocks.

---

## 8. Web UI — 3 minimal screens

1. **Inbox / Capture** — one textarea + source/task pickers + list of `raw` captures.
2. **Distill editor** — split pane + Peek (§6.2), shows lint warnings after Save.
3. **Browse** — concept list + view (with backlinks) + a search box.

No fancy design system needed in v1.

---

## 9. Testing

Same vitest/playwright pattern learned on XmindClone:

- **api** — unit tests for **lint logic** (most important: 5-gram overlap, link count,
  word count) + e2e (supertest) for routes.
- **web** — one render test per screen (smoke).
- **shared** — unit tests for the lint constants/functions if the logic lives here.

---

## 10. Build order (input for the plan)

1. Scaffold the pnpm workspace + `packages/shared` (types/DTOs + lint constants).
2. `apps/api`: Prisma schema + migrate + `CapturesModule` (POST/GET).
3. `apps/api`: `ConceptsModule` — lint service (tests first) → POST/PUT → parse
   links/stubs.
4. `apps/api`: `GET /concepts/:slug` (backlinks) + `/search`.
5. `apps/web`: Inbox → Distill (Peek + show warnings) → Browse.
6. E2E + smoke tests, cleanup.

---

## 11. Open questions / risks

- **Full-text search on SQLite:** v1 uses `LIKE %q%` for simplicity; if it's slow or
  insufficient, consider FTS5 in v2 (not now).
- **5-gram overlap** needs text normalization (lowercase, strip punctuation) before
  comparing — decide the normalization approach when implementing lint.
- **Slug format:** kebab-case from the title? or user-specified inside `[[ ]]`? → decide
  when building `ConceptsModule` (proposal: `[[Title With Words]]` → auto-slugify, keep
  the original title).
