import { useEffect } from "react";
import { brandTitle } from "../../../brand";
import { applyRouteHead } from "../../app/route-head";
import { NotFoundScreen } from "../not-found/NotFoundScreen";

/** `/versus/<slug>` for a slug with no comparison: the app's not-found
 * screen. The head says so too, since these addresses' heads are their
 * screens' to write. (A browser arriving at one gets the server's 404.) */
export function VersusMissingScreen() {
  useEffect(
    () =>
      applyRouteHead(document, {
        title: `Page not found | ${brandTitle}`,
        description:
          "Find AMP mathematics, free lessons and printable workbooks.",
        canonical: null,
        robots: "noindex, follow",
      }),
    [],
  );
  return <NotFoundScreen />;
}
