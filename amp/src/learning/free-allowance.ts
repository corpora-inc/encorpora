import type { PoolClient } from "pg";
import type { TrialWorkbookAllowance } from "./trial-workbooks.js";
import { z } from "zod";

export const FREE_ONLINE_PROBLEMS = 100;
/** A sanity limit, not a plan: live learners in one family account (its
 * children and its adult learner). Adding and removing learners is otherwise
 * free. Schools have no such limit. */
export const MAX_FAMILY_LEARNERS = 1000;
export const TOO_MANY_LEARNERS = `This account has ${MAX_FAMILY_LEARNERS.toLocaleString("en-US")} learners, the most one account can hold. Delete a learner to add another.`;

/** Whether a family account has room for one more live learner. Count it
 * inside the creation transaction, after the account's lock. */
export async function familyHasLearnerRoom(
  db: Pick<PoolClient, "query">,
  accountId: string,
) {
  const { rows } = await db.query<{ live: number }>(
    "SELECT count(*)::int AS live FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL",
    [accountId],
  );
  return rows[0]!.live < MAX_FAMILY_LEARNERS;
}

export type FreeAllowance = {
  problems: {
    total: typeof FREE_ONLINE_PROBLEMS;
    used: number;
    remaining: number;
  };
  workbooks: TrialWorkbookAllowance;
};

export const freeAllowanceSchema = z.object({
  problems: z.object({
    total: z.literal(FREE_ONLINE_PROBLEMS),
    used: z.number().int().min(0).max(FREE_ONLINE_PROBLEMS),
    remaining: z.number().int().min(0).max(FREE_ONLINE_PROBLEMS),
  }),
  workbooks: z.object({
    total: z.number().int().min(0).max(5),
    earned: z.number().int().min(0).max(5),
    made: z.number().int().min(0).max(5),
    available: z.number().int().min(0).max(5),
    nextAt: z.number().int().positive().nullable(),
  }),
});

/** Online answers/skips and issued workbooks have independent counters.
 * Recording results from an issued workbook spends neither allowance. */
export function freeAllowance(
  onlineUsed: number,
  workbooksMade: number,
): FreeAllowance {
  return {
    problems: {
      total: FREE_ONLINE_PROBLEMS,
      used: onlineUsed,
      remaining: Math.max(0, FREE_ONLINE_PROBLEMS - onlineUsed),
    },
    workbooks: {
      total: 5,
      earned: 5,
      made: workbooksMade,
      available: Math.max(0, 5 - workbooksMade),
      nextAt: null,
    },
  };
}
