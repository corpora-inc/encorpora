import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";

const trendPoint = z.object({
  answered: z.number().int().nonnegative(),
  level: z.number().finite(),
  sd: z.number().finite().nonnegative(),
});
const levelTrendSchema = z.object({ trend: z.array(trendPoint) });
export type LevelTrendPoint = z.infer<typeof trendPoint>;

/** How a learner's overall estimate moved as their answers came in: the best
 * guess and its likely range, from the start to the latest answer. Under the
 * account's key, so a change to the account refreshes it with the rest. */
export const levelTrendOptions = (session: AuthSession, learnerId: string) =>
  queryOptions({
    queryKey: ["account", session.accountId, "level-trend", learnerId],
    queryFn: ({ signal }) =>
      request(
        `/learners/${encodeURIComponent(learnerId)}/level-trend`,
        levelTrendSchema,
        { token: session.token, signal },
      ).then((data) => data.trend),
  });
