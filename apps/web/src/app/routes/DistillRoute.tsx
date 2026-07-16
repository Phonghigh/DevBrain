import { LINT_LIMITS } from '@devbrain/shared';

export function DistillRoute() {
  return (
    <section>
      <h1>Distill</h1>
      <p>Rewrite a raw capture in your own words. The source stays behind Peek. (DB2-08)</p>
      <p>
        Lint will warn (never block) above {Math.round(LINT_LIMITS.overlapPct * 100)}% overlap with
        the source, or past {LINT_LIMITS.maxWords} words.
      </p>
    </section>
  );
}
