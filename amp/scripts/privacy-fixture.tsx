import React, { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { AuthSession } from "../src/web/auth";
import { queryClient, sessionOptions } from "../src/web/lib/query";
import { PrivacyPanel } from "../src/web/features/privacy/PrivacyPanel";
import "../src/web/ui/tokens.css";

/** The account's Privacy (features/privacy/PrivacyPanel), as its overlay
 * holds it, for one signed-in account: the browser check's harness
 * (scripts/verify-family-ui.ts). Its API answers are the check's. */
export function PrivacyFixture({
  token,
  identity,
}: {
  token: string;
  identity: string;
}) {
  const [router] = useState(() => {
    const session: AuthSession = { token, accountId: identity };
    queryClient.setQueryData(sessionOptions.queryKey, () => session);
    return createRouter({
      routeTree: createRootRoute({
        component: () => (
          <main
            data-privacy-harness
            data-account={identity}
            style={{ padding: 16, maxWidth: 760 }}
          >
            <h1>Privacy &amp; data</h1>
            <PrivacyPanel />
          </main>
        ),
      }),
      history: createMemoryHistory({ initialEntries: ["/account/privacy"] }),
    });
  });
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
