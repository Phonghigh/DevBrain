import { describe, expect, it } from 'vitest';
import { LINT_LIMITS } from '../index.js';

describe('LINT_LIMITS', () => {
  it('caps distilled notes at 200 words', () => {
    expect(LINT_LIMITS.maxWords).toBe(200);
  });

  it('flags copy-overlap above 35%', () => {
    expect(LINT_LIMITS.overlapPct).toBe(0.35);
  });
});
