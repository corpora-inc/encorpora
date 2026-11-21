import type { AuthSession } from "../auth";
import { queryClient } from "../lib/query";
import { preload } from "../features/school/core-api";
import { familyOptions } from "../features/family/api";

/** A family's workbook results sheet opens whole: the page under it, and the
 * results themselves (fetched with the route, apart from the entry's code). */
export async function resultsLoader(
  input: { context: unknown; params: unknown },
  childLoader: (input: never) => Promise<unknown>,
  onFailure: (error: unknown) => null,
) {
  const { session } = input.context as { session: AuthSession };
  const {
    family: id,
    learner,
    workbookId,
  } = input.params as { family: string; learner: string; workbookId: string };
  const [data, { workbookResultsOptions }] = await Promise.all([
    queryClient.ensureQueryData(familyOptions(session, id)).catch(onFailure),
    import("../features/workbooks/api"),
    childLoader(input as never),
  ]);
  const child = data?.children.find((entry) => entry.id === learner);
  if (child?.capabilities.readWorkbooks)
    await preload(workbookResultsOptions(session, learner, workbookId));
}
