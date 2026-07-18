import { describe, expect, it } from 'vitest';
import { lintNote } from '../lint.js';

function words(n: number, prefix = 'word'): string {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');
}

describe('lintNote — copy-overlap rule', () => {
  // body: word0..word23 (24 words -> 20 five-word "grams", since 24-5+1=20).
  const body = words(24);

  it('does not warn when overlap sits exactly at the 35% boundary', () => {
    // rawText shares body's first 11 words (word0..word10), which produce
    // 11-5+1 = 7 overlapping grams. 7/20 = 0.35 exactly — the rule is "> 35%", so
    // this must NOT warn.
    const rawText = `${words(11)} ${words(50, 'filler')}`;
    const warnings = lintNote(body, rawText);
    expect(warnings.find((w) => w.rule === 'copy-overlap')).toBeUndefined();
  });

  it('warns when overlap is just over the 35% boundary', () => {
    // rawText shares body's first 12 words -> 12-5+1 = 8 overlapping grams.
    // 8/20 = 0.4 > 0.35 — must warn.
    const rawText = `${words(12)} ${words(50, 'filler')}`;
    const warnings = lintNote(body, rawText);
    const warning = warnings.find((w) => w.rule === 'copy-overlap');
    expect(warning).toBeDefined();
    expect(warning?.message).toMatch(/40%/);
  });

  it('treats matching phrases as the same regardless of case/punctuation (normalization)', () => {
    // noteBody normalizes to exactly "the quick brown fox jumps" (5 words -> 1 gram).
    const noteBody = 'The Quick, Brown Fox Jumps!';
    // Differently cased/punctuated, but normalizes to start with the same 5 words —
    // should still be detected as a match, giving 100% overlap (1/1 grams).
    const rawText = 'THE QUICK BROWN FOX JUMPS over the lazy dog, apparently.';
    const warnings = lintNote(noteBody, rawText);
    expect(warnings.find((w) => w.rule === 'copy-overlap')).toBeDefined();
  });

  it('does not crash or false-warn on a body shorter than 5 words', () => {
    const warnings = lintNote('too short', 'too short to have any five word overlap at all');
    expect(warnings.find((w) => w.rule === 'copy-overlap')).toBeUndefined();
  });
});

describe('lintNote — missing-link rule', () => {
  it('warns when body has no [[wikilink]]', () => {
    const warnings = lintNote('a note with no links in it', 'source text');
    expect(warnings.find((w) => w.rule === 'missing-link')).toBeDefined();
  });

  it('does not warn when body has at least one [[wikilink]]', () => {
    const warnings = lintNote('a note that links to [[some-concept]]', 'source text');
    expect(warnings.find((w) => w.rule === 'missing-link')).toBeUndefined();
  });
});

describe('lintNote — too-long rule', () => {
  it('does not warn at exactly 200 words', () => {
    const warnings = lintNote(words(200), 'source');
    expect(warnings.find((w) => w.rule === 'too-long')).toBeUndefined();
  });

  it('warns at 201 words', () => {
    const warnings = lintNote(words(201), 'source');
    const warning = warnings.find((w) => w.rule === 'too-long');
    expect(warning).toBeDefined();
    expect(warning?.message).toMatch(/201 words/);
  });
});

describe('lintNote — overall shape', () => {
  it('returns an empty array for a clean, short, linked, non-copied note', () => {
    const warnings = lintNote(
      'a short original note about [[some-concept]]',
      'a totally different source text',
    );
    expect(warnings).toEqual([]);
  });

  it('can return multiple warnings at once', () => {
    const body = words(300); // too long AND no link; overlap stays low (source differs)
    const warnings = lintNote(body, 'nothing in common with the body at all here');
    const rules = warnings.map((w) => w.rule).sort();
    expect(rules).toEqual(['missing-link', 'too-long']);
  });
});
