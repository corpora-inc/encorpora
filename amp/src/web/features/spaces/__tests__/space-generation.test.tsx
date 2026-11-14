import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import { AppError } from "../../../lib/AppError";
import { meOptions, retireSession, sessionOptions } from "../../../lib/query";
import { orgOptions } from "../../school/api";
import { classYearOptions } from "../../school/org/org-api";
import { pilotOptions } from "../../school/pilots/api";
import { useSpace } from "../useSpace";

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
const year = {
  past: false,
  orgId: SCHOOL,
  path: [SCHOOL],
  can: ["students.read" as const, "signin.read" as const],
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

test("CP-2 r2 M1: an answer asked with the old session never lands after a new one", async () => {
  const queries = client();
  const first = { accountId: "amp|gen-1", token: "first" };
  queries.setQueryData(sessionOptions.queryKey, first);
  // A request asked with the first session, still on its way.
  let answer!: (value: unknown) => void;
  const pending = queries
    .fetchQuery({
      queryKey: orgOptions(first, SCHOOL).queryKey,
      queryFn: () => new Promise((resolve) => (answer = resolve)),
    })
    .catch(() => undefined);
  // The same account signs in again.
  const second = { accountId: "amp|gen-1", token: "second" };
  expect(retireSession(first, second, queries)).toBe(true);
  queries.setQueryData(sessionOptions.queryKey, second);
  answer(org);
  await pending;
  expect(queries.getQueryData(orgOptions(second, SCHOOL).queryKey)).toBe(
    undefined,
  );
  const after = render(queries);
  expect(after?.space === "classroom" && after.status).toBe("loading");
  expect(after?.actions).toEqual([]);
  // A token check with the same token retires nothing.
  expect(retireSession(second, { ...second }, queries)).toBe(false);
});

test("CP-2 M1: practice that can't be confirmed running offers nothing to start", () => {
  const queries = client();
  const session = { accountId: "amp|gen-2", token: "t" };
  queries.setQueryData(sessionOptions.queryKey, session);
  queries.setQueryData(orgOptions(session, SCHOOL).queryKey, org as never);
  queries.setQueryData(classYearOptions(session, ROOM).queryKey, year);
  queries.setQueryData(pilotOptions(session, ROOM).queryKey, {
    coverage: { students: 3, covered: 3, paid: 0 },
  } as never);
  expect(render(queries)?.actions).toEqual(["start-class"]);
  queries
    .getQueryCache()
    .find({ queryKey: pilotOptions(session, ROOM).queryKey })!
    .setState({ status: "error", error: new Error("offline") });
  expect(render(queries)?.actions).toEqual([]);
});

test("CP-2 M1: a refused /me leaves no relationship behind; a failed lookup is failed", () => {
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
  expect(render(queries)?.space).toBe("family");
  queries
    .getQueryCache()
    .find({ queryKey: meOptions(session).queryKey })!
    .setState({
      status: "error",
      error: new AppError("permission", "Signed out", false, null, null, 401),
    });
  expect(render(queries)?.space).toBe("classroom");
  queries.setQueryData(orgOptions(session, SCHOOL).queryKey, org as never);
  queries
    .getQueryCache()
    .find({ queryKey: orgOptions(session, SCHOOL).queryKey })!
    .setState({ status: "error", error: new Error("offline") });
  const failed = render(queries);
  expect(failed?.space === "classroom" && failed.status).toBe("failed");
});
