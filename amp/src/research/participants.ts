/** Study enrolment (migration 0156). The consent flow calls these when a
 * parent gives or takes back research permission; the export job reads the
 * table and exports only learners who are enrolled and not withdrawn
 * (docs/research-export.md). Withdrawal is the participant's right under the
 * study's consent (45 CFR 46.116(b)(8) where the Common Rule applies). */
import type { PoolClient, Pool } from "pg";

type Database = Pick<Pool | PoolClient, "query">;

/** A study's short code, as in `--study rr3`. */
export const STUDY_CODE = /^[a-z][a-z0-9-]{1,31}$/;

export function assertStudyCode(study: string): string {
  if (!STUDY_CODE.test(study))
    throw new Error(
      "A study code is 2-32 lowercase letters, digits or hyphens, starting with a letter",
    );
  return study;
}

/** Enrols a learner in a study, from now: the moment permission is recorded.
 * There is no backdating, so no extract reaches before consent or into a
 * withdrawn period. The household comes from the learner's own row, so a
 * caller can't attach a learner to another family. Enrolling again
 * while enrolled changes nothing; enrolling after a withdrawal starts a new
 * enrolment (its weeks count from the new date). Returns false when the
 * learner doesn't exist or is deleted. */
export async function enrollParticipant(
  db: Database,
  input: {
    study: string;
    learnerId: string;
    consentRef?: string | null;
  },
): Promise<boolean> {
  const study = assertStudyCode(input.study);
  const result = await db.query(
    `INSERT INTO amp_research_participants(study,learner_id,account_id,enrolled_at,consent_ref)
     SELECT $1,l.id,l.account_id,now(),$3
       FROM amp_learners l WHERE l.id=$2 AND l.deleted_at IS NULL
     ON CONFLICT (study,learner_id) DO UPDATE SET
       enrolled_at=CASE WHEN amp_research_participants.withdrawn_at IS NULL
         THEN amp_research_participants.enrolled_at ELSE EXCLUDED.enrolled_at END,
       consent_ref=CASE WHEN amp_research_participants.withdrawn_at IS NULL
         THEN COALESCE(EXCLUDED.consent_ref,amp_research_participants.consent_ref)
         ELSE EXCLUDED.consent_ref END,
       account_id=EXCLUDED.account_id,
       withdrawn_at=NULL`,
    [study, input.learnerId, input.consentRef ?? null],
  );
  return (result.rowCount ?? 0) > 0;
}

/** Withdraws a learner from a study, now. Their data leaves every later
 * extract. Withdrawing twice keeps the first date. Returns false when the learner was
 * never enrolled. */
export async function withdrawParticipant(
  db: Database,
  input: { study: string; learnerId: string },
): Promise<boolean> {
  const study = assertStudyCode(input.study);
  const result = await db.query(
    `UPDATE amp_research_participants
        SET withdrawn_at=COALESCE(withdrawn_at,GREATEST(enrolled_at,now()))
      WHERE study=$1 AND learner_id=$2`,
    [study, input.learnerId],
  );
  return (result.rowCount ?? 0) > 0;
}
