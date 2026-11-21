import { queryOptions } from "@tanstack/react-query";
import { familyDashboardSchema } from "../../../family/dashboard-contracts";
import type { AuthSession } from "../../auth";
import { request } from "../../lib/api";
import { adult, key } from "./api";

// Apart from ./api: the family's Today loads it with its route, so the
// dashboard's contract is never in the entry's code.

/** One family's dashboard: per own child, the week (days, minutes,
 * problems, right answers), each day of it, the five areas with what was
 * checked below each, and why AMP picked the recent problems; the children's
 * code when this reader may manage devices. A child's actions and access
 * stay on `familyOptions` (same learner IDs, same order). */
export const familyDashboardOptions = (session: AuthSession, family: string) =>
  queryOptions({
    queryKey: key(session, family, "dashboard"),
    enabled: adult(session) && !!family,
    queryFn: ({ signal }) =>
      request(
        `/families/${encodeURIComponent(family)}/dashboard`,
        familyDashboardSchema,
        { token: session.token, signal },
      ),
  });
