export type { CaptureDto, CaptureStatus, CreateCaptureDto } from './capture.js';

/**
 * Thresholds the distill-lint rule uses (spec §6.3). Shared so the api's lint
 * service and the web UI's warning display always agree on the same numbers.
 */
export const LINT_LIMITS = {
  /** Above this 5-gram overlap ratio between body and rawText, warn "you're copying". */
  overlapPct: 0.35,
  /** Above this word count in body, warn "distill it shorter". */
  maxWords: 200,
} as const;
