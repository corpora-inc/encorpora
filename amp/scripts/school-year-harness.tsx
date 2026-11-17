/** Local synthetic-only preview of the school year section, served by
 * verify-school-year-ui.ts. The API is the script's fake (page routes). */
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import "../src/web/app/styles";
import {
  CLASS,
  ORG,
} from "../src/web/features/school-year/__tests__/fake-school";
import { SchoolYearSection } from "../src/web/features/school-year/SchoolYearSection";
import { queryClient, sessionOptions } from "../src/web/lib/query";
import { Button } from "../src/web/ui/Button";
import { Page } from "../src/web/ui/Page";
import { PageHeader } from "../src/web/ui/PageHeader";
import { PageSection } from "../src/web/ui/PageSection";

const search = new URLSearchParams(location.search);
queryClient.setQueryData(sessionOptions.queryKey, {
  accountId: "harness-parent",
  token: "synthetic-token",
} as never);

function Screen() {
  return (
    <div className="shell app-shell">
      <Page>
        <PageHeader title="Settings" />
        <SchoolYearSection
          org={ORG}
          classId={CLASS}
          grading={search.get("grading") !== "0"}
          setBy={search.get("shared") ? "Your tutoring group" : undefined}
        />
        {/* What follows the year on Settings: it must never move. */}
        <PageSection title="Devices">
          <Button variant="secondary">Their own devices</Button>
        </PageSection>
      </Page>
    </div>
  );
}

const router = createRouter({
  routeTree: createRootRoute({ component: Screen }),
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
