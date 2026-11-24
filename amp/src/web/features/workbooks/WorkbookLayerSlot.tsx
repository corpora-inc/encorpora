import type { QueryClient } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import type { AuthSession } from "../../auth";
import { logAhead } from "../../lib/ahead";
import { LayerWait } from "../../nav/LayerWait";
import { Sheet } from "../../ui/Sheet";

/* The workbook maker loads on the way in, so a screen that only offers it
   never carries it. Its code is asked for once: where the control that
   opens it shows (`warmWorkbookLayer`), so it is there before the press. */
const code: { load?: Promise<typeof import("./WorkbookLayer")> } = {};
const load = () => (code.load ??= import("./WorkbookLayer"));
const Maker = lazy(() =>
  load().then((module) => ({ default: module.WorkbookLayer })),
);

/** The maker's code and the day's reads, ahead of the press that opens it:
 * the layer then opens whole, nothing arriving after it. */
export function warmWorkbookLayer(
  client: QueryClient,
  session: AuthSession,
  learner: string,
  date: string,
) {
  void Promise.all([load(), import("./api")])
    .then(([, api]) =>
      Promise.all([
        client.ensureQueryData(
          api.workbookHistoryOptions(session, learner, date),
        ),
        client.ensureQueryData(api.workbookAreasOptions(session, learner)),
      ]),
    )
    .catch((error: unknown) =>
      logAhead("A skill's workbook didn’t load ahead", error),
    );
}

/** The `workbook` layer's panel (nav/LayerHost.tsx). Until the maker's code
 * arrives the layer holds its wait, in the panel the maker then fills. */
export function WorkbookLayerSlot(props: Parameters<typeof Maker>[0]) {
  return (
    <Suspense
      fallback={
        <Sheet open tall title="Workbook" onOpenChange={() => {}}>
          <LayerWait />
        </Sheet>
      }
    >
      <Maker {...props} />
    </Suspense>
  );
}
