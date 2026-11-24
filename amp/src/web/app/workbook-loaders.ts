import type { AuthSession } from "../auth";
import { meOptions, queryClient, sessionOptions } from "../lib/query";
import { logAhead } from "../lib/ahead";

/** A learner's workbook screen paints whole: what it shows first (the list,
 * a day's workbook and its areas, a workbook's results) arrives with it, for
 * a learner this account may read (the account is known by now: the root's
 * `beforeLoad`). A failed read is the screen's own to say. */
const loader =
  (
    reads: (
      api: typeof import("../features/workbooks/api"),
      session: AuthSession,
      params: Record<string, string>,
    ) => { queryKey: readonly unknown[] }[],
  ) =>
  async ({ params }: { params: Record<string, string> }) => {
    const session = queryClient.getQueryData(sessionOptions.queryKey);
    if (!session) return;
    const me = queryClient.getQueryData(meOptions(session).queryKey);
    const learner = me?.signedIn
      ? me.family.learners.find(
          (entry) => entry.id === params.learnerId && !entry.deletedAt,
        )
      : undefined;
    const [api, { canReadWorkbooks }] = await Promise.all([
      import("../features/workbooks/api"),
      import("../features/workbooks/model"),
    ]);
    if (!learner || !canReadWorkbooks(learner)) return;
    await Promise.all(
      reads(api, session, params).map((options) =>
        queryClient
          .ensureQueryData(options as never)
          .catch((error: unknown) =>
            logAhead("The workbook didn’t load ahead", error),
          ),
      ),
    );
  };

export const workbookLoaders = {
  history: loader((api, session, { learnerId }) => [
    api.workbookHistoryOptions(session, learnerId!),
  ]),
  day: loader((api, session, { learnerId, date }) => [
    api.workbookHistoryOptions(session, learnerId!),
    api.workbookHistoryOptions(session, learnerId!, date),
    api.workbookAreasOptions(session, learnerId!),
  ]),
  results: loader((api, session, { learnerId, workbookId }) => [
    api.workbookResultsOptions(session, learnerId!, workbookId!),
  ]),
};
