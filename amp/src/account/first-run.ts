import type { Pool, PoolClient } from "pg";
import { STARTER_ANSWERS } from "../analytics/events.js";

type Database = Pick<Pool | PoolClient, "query">;
export type SetupPersona = (typeof STARTER_ANSWERS)[number];
/** An account's first run, as `/me` says it (`me.setup`): the answer it gave
 * to "What brings you to AMP?", and whether that first run is done. Routing
 * and the starter read this; they never infer it from what exists. */
export type Setup = { persona: SetupPersona | null; done: boolean };

/* One owner for first-run progress (docs/product-model.md, "First run"). An
   answer is recorded when it is chosen, and can change until the first run
   is done. It is done when a parent goes to Today from setup, when a child of
   the account first practices here, or when an adult's own practice starts.
   An account from before this record (no row) that already has a place
   finished its first run then. */

/** Whether the account already has somewhere to go: a child or its own
 * learner, a family, or a place it works at. Only for accounts with no
 * first-run record. */
async function hasPlace(db: Database, accountId: string) {
  return !!(
    await db.query(
      `SELECT 1 FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL
       UNION ALL SELECT 1 FROM amp_families WHERE account_id=$1
       UNION ALL SELECT 1 FROM amp_people WHERE account_id=$1 AND deleted_at IS NULL
       LIMIT 1`,
      [accountId],
    )
  ).rowCount;
}

export async function readSetup(
  db: Database,
  accountId: string,
): Promise<Setup> {
  const row = (
    await db.query<{ persona: SetupPersona; done_at: Date | null }>(
      "SELECT persona,done_at FROM amp_first_runs WHERE account_id=$1",
      [accountId],
    )
  ).rows[0];
  if (!row) return { persona: null, done: await hasPlace(db, accountId) };
  return { persona: row.persona, done: row.done_at !== null };
}

/** The answer just chosen. It replaces the last one until the first run is
 * done; an account that already finished one (before this record) is
 * recorded as done. */
export async function chooseSetup(
  db: Database,
  accountId: string,
  persona: SetupPersona,
) {
  const finished = await hasPlace(db, accountId);
  const exists = !!(
    await db.query("SELECT 1 FROM amp_first_runs WHERE account_id=$1", [
      accountId,
    ])
  ).rowCount;
  await db.query(
    `INSERT INTO amp_first_runs(account_id,persona,done_at) VALUES($1,$2,$3)
     ON CONFLICT(account_id) DO UPDATE SET persona=EXCLUDED.persona,updated_at=now()
     WHERE amp_first_runs.done_at IS NULL`,
    [accountId, persona, !exists && finished ? new Date() : null],
  );
}

/** The first run is done. Idempotent; the first answer stands if one was
 * given, else this one. */
export async function finishSetup(
  db: Database,
  accountId: string,
  persona: SetupPersona,
) {
  await db.query(
    `INSERT INTO amp_first_runs(account_id,persona,done_at) VALUES($1,$2,now())
     ON CONFLICT(account_id) DO UPDATE SET done_at=COALESCE(amp_first_runs.done_at,now()),updated_at=now()`,
    [accountId, persona],
  );
}
