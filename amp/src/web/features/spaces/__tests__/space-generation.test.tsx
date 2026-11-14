import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import { AppError } from "../../../lib/AppError";
import { meOptions, sessionOptions } from "../../../lib/query";
import { orgOptions } from "../../school/api";
import { classYearOptions } from "../../school/org/org-api";
import { pilotOptions } from "../../school/pilots/api";
import { sessionGeneration, useSpace } from "../useSpace";

afterEach(cleanup);
const SCHOOL = "33333333-3333-4333-8333-333333333333";
const ROOM = "44444444-4444-4444-8444-444444444444";
const org = {
  id: SCHOOL,
  kind: "school",
  name: "Alder Grove",
  parentId: null,
  timezone: "UTC",
  roles: ["teacher"],
  can: ["org.read", "classes.read"],
  teaches: [ROOM],
};

function render(client: QueryClient) {
  const hook = renderHook(
    () => useSpace({ pathname: `/school/${SCHOOL}/classes/${ROOM}/today` }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  const result = hook.result.current;
  hook.unmount();
  return result;
}
const client = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });

test("CP-2 M1: a new session for the same account never reads the old one's answers", () => {
  const queries = client();
  const first = { accountId: "amp|gen-1", token: "first" };
  sessionGeneration(first, 1_000);
  queries.setQueryData(sessionOptions.queryKey, first);
  queries.setQueryData(orgOptions(first, SCHOOL).queryKey, org as never, {
    updatedAt: 2_000,
  });
  queries.setQueryData(
    classYearOptions(first, ROOM).queryKey,
    { past: false },
    { updatedAt: 2_000 },
  );
  expect(render(queries)?.tabs.length).toBeGreaterThan(0);
  // Signed in again as the same account: same keys, a new generation. The
  // answers from before stay unread until they are asked again.
  const second = { accountId: "amp|gen-1", token: "second" };
  sessionGeneration(second, 3_000);
  queries.setQueryData(sessionOptions.queryKey, second);
  const after = render(queries);
  expect(after?.space === "classroom" && after.status).toBe("loading");
  expect(after?.tabs).toEqual([]);
  queries.setQueryData(orgOptions(second, SCHOOL).queryKey, org as never, {
    updatedAt: 4_000,
  });
  queries.setQueryData(
    classYearOptions(second, ROOM).queryKey,
    { past: false },
    { updatedAt: 4_000 },
  );
  expect(render(queries)?.tabs.length).toBeGreaterThan(0);
});

test("CP-2 M1: practice that can't be confirmed running offers nothing to start", async () => {
  const queries = client();
  const session = { accountId: "amp|gen-2", token: "t" };
  queries.setQueryData(sessionOptions.queryKey, session);
  queries.setQueryData(orgOptions(session, SCHOOL).queryKey, org as never);
  queries.setQueryData(classYearOptions(session, ROOM).queryKey, {
    past: false,
  });
  queries.setQueryData(pilotOptions(session, ROOM).queryKey, {
    coverage: { students: 3, covered: 3, paid: 0 },
  } as never);
  expect(render(queries)?.actions).toEqual(["start-class"]);
  // The refetch failed: the cached coverage no longer counts.
  const cache = queries
    .getQueryCache()
    .find({ queryKey: pilotOptions(session, ROOM).queryKey })!;
  cache.setState({ status: "error", error: new Error("offline") });
  expect(render(queries)?.actions).toEqual([]);
});

test("CP-2 M1: a refused /me leaves no relationship behind", () => {
  const queries = client();
  const session = { accountId: "amp|gen-3", token: "t" };
  queries.setQueryData(sessionOptions.queryKey, session);
  queries.setQueryData(meOptions(session).queryKey, {
    signedIn: true,
    account: { id: session.accountId, email: null, emailVerified: true },
    learners: [],
    family: { learners: [] },
    familyClass: {
      orgId: SCHOOL,
      classId: ROOM,
      className: "Old",
      notice: false,
    },
  } as never);
  // Before: the account's relationship names it a family.
  expect(render(queries)?.space).toBe("family");
  queries
    .getQueryCache()
    .find({ queryKey: meOptions(session).queryKey })!
    .setState({
      status: "error",
      error: new AppError("permission", "Signed out", false, null, null, 401),
    });
  expect(render(queries)?.space).toBe("classroom");
});
