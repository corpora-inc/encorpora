import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { useLearnerStore } from "../../learner-store";
import { meOptions, sessionOptions } from "../query";
import { useLearningView } from "../learning-view";

/** The router's state: the location being loaded, and the one on view. */
const router = vi.hoisted(() => ({
  location: { pathname: "/pathways", search: {} as Record<string, unknown> },
  resolvedLocation: {
    pathname: "/pathways",
    search: {} as Record<string, unknown>,
  },
}));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: typeof router) => unknown }) =>
    select(router),
}));
afterEach(cleanup);

const session = { accountId: "amp|jonah", token: "t" };
const child = (id: string, name: string) => ({
  id,
  name,
  birthYear: 2017,
  entitlement: { active: true, plan: null, endsAt: null },
});
const me = (learners: ReturnType<typeof child>[]) => ({
  signedIn: true,
  account: { id: session.accountId, email: null, emailVerified: true },
  learners,
  family: { learners: [] },
});
function mount(client: QueryClient) {
  return renderHook(() => useLearningView({ records: false }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}
const queries = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(sessionOptions.queryKey, session);
  client.setQueryData(
    meOptions(session).queryKey,
    me([child("pip", "Pip"), child("wren", "Wren")]) as never,
  );
  return client;
};

test("CP-2 r2 H2: the screen on view is the learner its address names, whatever the device chose", () => {
  useLearnerStore.getState().select("wren");
  router.location = router.resolvedLocation = {
    pathname: "/pathways",
    search: { learner: "pip" },
  };
  const view = mount(queries());
  expect(view.result.current.learner?.id).toBe("pip");
  expect(useLearnerStore.getState().learnerId).toBe("wren");
});

test("CP-2 r2 H2: a navigation still loading changes nobody on the screen on view", () => {
  useLearnerStore.getState().select("wren");
  router.resolvedLocation = { pathname: "/pathways", search: {} };
  router.location = { pathname: "/practice", search: { learner: "pip" } };
  const view = mount(queries());
  expect(view.result.current.learner?.id).toBe("wren");
});

test("CP-2 r2 H2: the named learner gone while mounted is nobody, never another", async () => {
  useLearnerStore.getState().select("pip");
  router.location = router.resolvedLocation = {
    pathname: "/pathways",
    search: { learner: "pip" },
  };
  const client = queries();
  const view = mount(client);
  expect(view.result.current.learner?.id).toBe("pip");
  await act(async () => {
    client.setQueryData(
      meOptions(session).queryKey,
      me([child("wren", "Wren")]) as never,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(view.result.current.learner).toBeUndefined();
  // The device's choice is not moved to Wren behind the screen.
  expect(useLearnerStore.getState().learnerId).toBe("pip");
});
