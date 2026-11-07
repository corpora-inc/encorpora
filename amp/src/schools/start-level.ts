import { PLACEMENT_ATTEMPTS } from "../learning/placement.js";

/**
 * Where a student's term starts: the first stored level on or after the term
 * began whose estimate stands on at least a placement's worth of answers.
 * Before that the estimator is still placing them and can sit well above or
 * below where they settle, so growth never starts there. No such reading
 * means no start level, and so no growth figure rather than a zero.
 *
 * The one rule for the overview (`org-reads.ts`), the grade model
 * (`term-grades.ts`) and the standings board (`standings.ts`), so a student
 * never sees a growth number that disagrees with their teacher's. `learner`, `from` and `to`
 * are SQL expressions; `select` is what to read from the row (`d.` columns).
 */
export const startLevelSql = ({
  select,
  learner,
  from,
  to,
}: {
  select: string;
  learner: string;
  from: string;
  to?: string;
}) =>
  `(SELECT ${select} FROM amp_level_days d
    WHERE d.learner_id=${learner} AND d.day>=${from}${to ? ` AND d.day<=${to}` : ""}
      AND d.overall_answered>=${PLACEMENT_ATTEMPTS}
    ORDER BY d.day LIMIT 1)`;
