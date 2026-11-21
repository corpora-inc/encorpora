import { useLoaderData } from "@tanstack/react-router";
import { VersusHubScreen } from "./VersusHubScreen";
import { VersusPageScreen } from "./VersusPageScreen";
import { VERSUS } from "./links";

/** The comparisons' one route: `/versus` is the hub, `/versus/<slug>` the
 * comparison its loader brought (features/versus/load.ts). */
export function VersusScreen() {
  const page = useLoaderData({ from: VERSUS });
  return page ? <VersusPageScreen page={page} /> : <VersusHubScreen />;
}
