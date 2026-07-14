"""SessionStart brain hook for DevBrain — the automatic progress reporter.

Reads the repo's own state files and injects a short status block into every new
session, so the build always knows where it is without the user asking:

- tasks/INDEX.md   -> done/todo/blocked counts, current phase, next eligible task
- docs/LEARNING_LOG.md -> concept mastery counts (understood / shaky / not-started)

State lives entirely in the repo (the loop is stateless), so this is the single
place that turns those files back into "where am I". Fails open: any parse error
just prints less context, never blocks the session.

Adapted from d:/project/UnSuff/.claude/hooks/session_start_brain.py.
"""

import json
import os
import re
import sys


def read_file(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return None


# ---- tasks/INDEX.md parsing -------------------------------------------------

# A task line looks like:
#   - [ ] **DB0-01** — <title> · *deps:* DB0-01, DB0-02 · *done:* ...
# Status char is one of: " " (todo), "x" (done), "!" (blocked).
TASK_RE = re.compile(r"^\s*-\s*\[([ x!])\]\s*\*\*([A-Za-z0-9]+-[0-9]+[a-z]?)\*\*")
PHASE_RE = re.compile(r"^##\s+(Phase\s+[^\n]+?)\s*$")
ID_RE = re.compile(r"[A-Za-z0-9]+-[0-9]+[a-z]?")


def parse_index(text):
    """Return (counts, current_phase, next_task_id, next_task_title, blocked_ids)."""
    counts = {"done": 0, "todo": 0, "blocked": 0}
    status_by_id = {}
    tasks = []  # ordered list of (id, status, title, deps, phase)
    current_phase_label = None
    phase_of_first_todo = None
    blocked_ids = []

    if not text:
        return counts, None, None, None, blocked_ids

    for line in text.splitlines():
        ph = PHASE_RE.match(line)
        if ph:
            current_phase_label = ph.group(1)
            continue

        m = TASK_RE.match(line)
        if not m:
            continue

        flag, task_id = m.group(1), m.group(2)
        status = {" ": "todo", "x": "done", "!": "blocked"}[flag]
        counts[status] += 1
        status_by_id[task_id] = status
        if status == "blocked":
            blocked_ids.append(task_id)
        if status == "todo" and phase_of_first_todo is None:
            phase_of_first_todo = current_phase_label

        # title = text after the closing ** up to the first " · " separator
        rest = line.split("**", 2)[-1].lstrip(" —-").strip()
        title = re.split(r"\s+·\s+", rest)[0].strip()

        # deps: substring after "*deps:*" up to the next " · "
        deps = []
        dm = re.search(r"\*deps:\*\s*(.+?)(?:\s+·\s+|$)", line)
        if dm:
            deps_str = dm.group(1)
            if "none" not in deps_str.lower():
                deps = ID_RE.findall(deps_str)

        tasks.append((task_id, status, title, deps, current_phase_label))

    # next eligible task: first todo whose deps are all done
    next_id = next_title = None
    for task_id, status, title, deps, _phase in tasks:
        if status != "todo":
            continue
        if all(status_by_id.get(d) == "done" for d in deps):
            next_id, next_title = task_id, title
            break

    return counts, phase_of_first_todo, next_id, next_title, blocked_ids


# ---- docs/LEARNING_LOG.md concept table parsing -----------------------------

def parse_table_rows(text, heading):
    """Return list of cell-lists for the first markdown table under `heading`."""
    if text is None:
        return []
    pattern = re.compile(r"^##\s+" + re.escape(heading) + r"\s*$", re.MULTILINE)
    m = pattern.search(text)
    if not m:
        return []
    rest = text[m.end():]
    rows = []
    in_table = False
    seen_separator = False
    for line in rest.splitlines():
        stripped = line.strip()
        if stripped.startswith("|"):
            in_table = True
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            if not seen_separator:
                if re.match(r"^:?-+:?$", cells[0].replace(" ", "")):
                    seen_separator = True
                continue
            rows.append(cells)
        elif in_table:
            break
    return rows


def status_counts(rows, status_col=1):
    counts = {"understood": 0, "shaky": 0, "not-started": 0}
    for r in rows:
        if len(r) > status_col:
            status = r[status_col].strip().lower()
            if status in counts:
                counts[status] += 1
    return counts


# ---- main -------------------------------------------------------------------

def main():
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
    index_text = read_file(os.path.join(project_dir, "tasks", "INDEX.md"))
    learning_text = read_file(os.path.join(project_dir, "docs", "LEARNING_LOG.md"))

    lines = []

    counts, phase, next_id, next_title, blocked = parse_index(index_text)
    total = counts["done"] + counts["todo"] + counts["blocked"]
    if total:
        lines.append(
            "Build backlog — {done} done · {todo} todo · {blocked} blocked (of {total})".format(
                done=counts["done"], todo=counts["todo"], blocked=counts["blocked"], total=total
            )
        )
        if phase:
            lines.append("Current phase: " + phase)
        if next_id:
            lines.append("Next eligible task: {id} — {title}".format(id=next_id, title=next_title))
        elif counts["todo"] == 0:
            lines.append("All tasks done — no eligible task remains.")
        else:
            lines.append("No eligible task (remaining todos are dependency-blocked).")
        if blocked:
            lines.append("Blocked (see tasks/BLOCKERS.md): " + ", ".join(blocked))

    concept_rows = parse_table_rows(learning_text, "Concepts & Knowledge")
    if concept_rows:
        c = status_counts(concept_rows)
        lines.append(
            "Concepts — understood: {u}, shaky: {s}, not-started: {n}".format(
                u=c["understood"], s=c["shaky"], n=c["not-started"]
            )
        )
        shaky = [r[0] for r in concept_rows if len(r) > 1 and r[1].strip().lower() == "shaky"]
        if shaky:
            lines.append("Shaky (revisit): " + ", ".join(shaky))

    if lines:
        context = "[DevBrain build context]\n" + "\n".join(lines) + (
            "\n\nRun the next task with: Read tasks/ROUTINE.md and execute exactly ONE task, then stop."
        )
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": context,
            }
        }))

    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(0)  # fail open
