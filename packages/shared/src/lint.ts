import { LINT_LIMITS } from './lint-limits.js';

export type LintRule = 'copy-overlap' | 'missing-link' | 'too-long';

export interface LintWarning {
  rule: LintRule;
  message: string;
}

const WIKILINK_PATTERN = /\[\[[^[\]]+\]\]/;

/**
 * Lowercase + strip punctuation (keeps letters/numbers/whitespace, unicode-aware) +
 * collapse whitespace. Two phrases that only differ in case/punctuation should count
 * as the same 5-gram (spec §11).
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sliding-window 5-word phrases ("shingles") of already-normalized text. */
function fiveGrams(normalized: string): Set<string> {
  const words = normalized.length === 0 ? [] : normalized.split(' ');
  const grams = new Set<string>();
  for (let i = 0; i + 5 <= words.length; i++) {
    grams.add(words.slice(i, i + 5).join(' '));
  }
  return grams;
}

/** Fraction of `body`'s 5-grams that also appear in `rawText`. 0 if body has none. */
function copyOverlapRatio(body: string, rawText: string): number {
  const bodyGrams = fiveGrams(normalize(body));
  if (bodyGrams.size === 0) return 0;
  const rawGrams = fiveGrams(normalize(rawText));
  let matches = 0;
  for (const gram of bodyGrams) {
    if (rawGrams.has(gram)) matches++;
  }
  return matches / bodyGrams.size;
}

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Runs the 3 distill-lint rules (spec §6.3) against a self-written `body` and the
 * `rawText` it was distilled from. Warn-only: never throws, returns `[]` for a clean
 * note. Pure — no I/O, deterministic, safe to call from both the api and the web UI.
 */
export function lintNote(body: string, rawText: string): LintWarning[] {
  const warnings: LintWarning[] = [];

  const overlap = copyOverlapRatio(body, rawText);
  if (overlap > LINT_LIMITS.overlapPct) {
    warnings.push({
      rule: 'copy-overlap',
      message: `${Math.round(overlap * 100)}% of this note's phrasing matches the source — try rewriting it in your own words.`,
    });
  }

  if (!WIKILINK_PATTERN.test(body)) {
    warnings.push({
      rule: 'missing-link',
      message:
        'No [[links]] found — a distilled note should connect to at least one other concept.',
    });
  }

  const words = wordCount(body);
  if (words > LINT_LIMITS.maxWords) {
    warnings.push({
      rule: 'too-long',
      message: `This note is ${words} words — try distilling it down to under ${LINT_LIMITS.maxWords}.`,
    });
  }

  return warnings;
}
