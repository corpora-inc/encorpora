import type { Pool, PoolClient } from "pg";
import { adultLearnerName } from "../account/adult.js";
import { refreshAdultAccess } from "../account/adult-access.js";
import { ensureFamilyClass } from "../family/family-class.js";
import { familyHasLearnerRoom } from "../learning/free-allowance.js";
import { isSchoolAccount } from "../schools/principal.js";
import { lockLearningAccount } from "./account-access.js";
import { allocatePictureIdentity } from "./picture-identity.js";

/** `ensureFamilyClass` only stores this. Enrollment runs on the caller's client. */
const enrollmentPool = {
  connect() {
    return Promise.reject(
      new Error("absorbLiveTrial enrolls on its own client"),
    );
  },
} as unknown as Pool;

/**
 * Moves an owner's live free trial into their account. The trial asked only
 * for the learner's birth year (with an "Adult" choice), so the birth year
 * decides: an adult's trial becomes the account holder's own adult learner,
 * under their name; a child's becomes an unnamed learner in the family.
 * The learner row is updated in place, so its answers, evidence, frontier,
 * instances and workbooks stay with it. Marking the trial adopted is what
 * takes it out of `currentTrial` and `/me.trial`. An unnamed learner has no
 * name, so this does not ask for consent.
 *
 * The client must be idle. This opens and commits one transaction when
 * there is something to move, and returns how many learners moved. With
 * nothing live it is one lookup on `amp_trials_owner` and takes no account lock.
 */
export async function absorbLiveTrial(
  client: PoolClient,
  ownerAccountId: string,
): Promise<number> {
  if (isSchoolAccount(ownerAccountId)) return 0;
  let pending: number;
  try {
    pending =
      (
        await client.query(
          `SELECT 1 FROM amp_trials
         WHERE owner_account_id=$1 AND adopted_at IS NULL AND expires_at>now()
         LIMIT 1`,
          [ownerAccountId],
        )
      ).rowCount ?? 0;
  } catch (error) {
    // A fixture migrated before trials, or before an owner column, has none.
    if (isMissingTrialSchema(error)) return 0;
    throw error;
  }
  if (!pending) return 0;
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    await lockLearningAccount(client, ownerAccountId);
    // A trial with no practice carries nothing worth keeping; it expires as
    // before rather than adding an empty learner.
    const found = await client.query<{
      id: string;
      learner_id: string;
      birth_year: number | null;
    }>(
      `SELECT t.id,t.learner_id,l.birth_year
       FROM amp_trials t JOIN amp_learners l ON l.id=t.learner_id
       WHERE t.owner_account_id=$1 AND t.adopted_at IS NULL AND t.expires_at>now()
         AND (EXISTS(SELECT 1 FROM amp_attempts a WHERE a.learner_id=l.id)
           OR l.free_online_used>0)
       FOR UPDATE OF t`,
      [ownerAccountId],
    );
    let moved = 0;
    let children = 0;
    // The trial's screens are retired, so a practised trial is only
    // reachable in the family: a child's joins it as another picture learner
    // beside any children already there. Two rare cases still expire as
    // before (`purgeExpiredTrials`): a trial with no birth year (migration
    // 0101 refuses an unnamed learner without one) and an adult's trial when
    // the account already has its adult learner.
    for (const trial of found.rows) {
      if (trial.birth_year == null) continue;
      if (!(await familyHasLearnerRoom(client, ownerAccountId))) break;
      if (new Date().getUTCFullYear() - trial.birth_year >= ADULT_AGE) {
        if (await moveAdultTrial(client, ownerAccountId, trial)) moved++;
        continue;
      }
      const identity = await allocatePictureIdentity(
        client,
        `family:${ownerAccountId}`,
      );
      const updated = await client.query(
        `UPDATE amp_learners SET account_id=$1,name_pending=true,picture_identity=$2,
           picture_number=$3,identity_scope=$4,name=$5
         WHERE id=$6 AND deleted_at IS NULL AND birth_year IS NOT NULL AND NOT adult
         RETURNING id`,
        [
          ownerAccountId,
          identity.picture,
          identity.number,
          identity.scope,
          identity.name,
          trial.learner_id,
        ],
      );
      if (!updated.rowCount) continue;
      await client.query(
        "UPDATE amp_trials SET adopted_at=now(),adopted_by=$2 WHERE id=$1",
        [trial.id, ownerAccountId],
      );
      moved++;
      children++;
    }
    if (children)
      await ensureFamilyClass(client, enrollmentPool, ownerAccountId, {
        converting: false,
      });
    await client.query("COMMIT");
    return moved;
  } catch (error) {
    await client.query("ROLLBACK");
    if (isMissingTrialSchema(error)) return 0;
    throw error;
  }
}

/** The age from which a trial's learner is the account holder themself. */
const ADULT_AGE = 18;

/** An adult's trial becomes the account's one adult learner, in place (an
 * adult learner has no birth year). With an adult learner already there, the
 * trial is left to expire as before. */
async function moveAdultTrial(
  client: PoolClient,
  ownerAccountId: string,
  trial: { id: string; learner_id: string },
) {
  const existing = await client.query(
    "SELECT 1 FROM amp_learners WHERE account_id=$1 AND adult AND deleted_at IS NULL",
    [ownerAccountId],
  );
  if (existing.rowCount) return false;
  const updated = await client.query(
    `UPDATE amp_learners SET account_id=$1,adult=true,birth_year=NULL,name=$2
     WHERE id=$3 AND deleted_at IS NULL AND NOT name_pending AND NOT adult
     RETURNING id`,
    [
      ownerAccountId,
      await adultLearnerName(client, ownerAccountId),
      trial.learner_id,
    ],
  );
  if (!updated.rowCount) return false;
  await client.query(
    "INSERT INTO amp_adult_activity(learner_id,seen_at) VALUES($1,now()) ON CONFLICT (learner_id) DO NOTHING",
    [trial.learner_id],
  );
  await refreshAdultAccess(client, ownerAccountId, trial.learner_id);
  await client.query(
    "UPDATE amp_trials SET adopted_at=now(),adopted_by=$2 WHERE id=$1",
    [trial.id, ownerAccountId],
  );
  return true;
}

function isMissingTrialSchema(error: unknown) {
  const code = (error as { code?: string }).code;
  return code === "42P01" || code === "42703";
}
