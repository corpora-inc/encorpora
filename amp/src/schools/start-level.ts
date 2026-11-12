import { SETTLED_SD } from "./growth.js";
import { levelSdSql } from "./student-sd.js";

/**
 * Where a student's term starts: the first stored level in the window whose
 * reported uncertainty has settled (`SETTLED_SD`). Before that the estimator
 * is still leaving its age prior, so growth never starts there. No such
 * reading means no start level. The growth figure itself is `termGrowth`
 * (`growth.ts`), not this level subtracted from the latest one.
 *
 * The one rule for the overview (`org-reads.ts`), the grade model
 * (`term-grades.ts`) and the standings board (`standings.ts`). `learner`,
 * `from` and `to` are SQL expressions; `select` is what to read from the row
 * (`d.` columns).
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
      AND ${levelSdSql("d")} > 0 AND ${levelSdSql("d")} <= ${SETTLED_SD}
    ORDER BY d.day LIMIT 1)`;
