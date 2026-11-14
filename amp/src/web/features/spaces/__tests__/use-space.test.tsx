import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import { meOptions, sessionOptions } from "../../../lib/query";
import { classYearOptions } from "../../school/org/org-api";
import { useSpace } from "../useSpace";

afterEach(cleanup);
const FAMILY = "11111111-1111-4111-8111-111111111111";
const CLASS = "22222222-2222-4222-8222-222222222222";
const holder = (id: string) => ({
  signedIn: true,
  account: { id, email: null, emailVerified: true },
  learners: [
    {
      id: "pip",
      name: "Pip",
      birthYear: 2019,
      entitlement: { active: true, plan: null, endsAt: null },
    },
  ],
  family: { learners: [] },
  familyClass: {
    orgId: FAMILY,
    classId: CLASS,
    className: "Pell",
    notice: false,
  },
});

function space(
  setup: (
    client: QueryClient,
    session: { accountId: string; token: string },
  ) => void,
  accountId = "amp|jonah",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const session = { accountId, token: "t" };
  client.setQueryData(sessionOptions.queryKey, session);
  setup(client, session);
  const hook = renderHook(
    () => useSpace({ pathname: `/school/${FAMILY}/classes/${CLASS}/today` }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  const result = hook.result.current;
  hook.unmount();
  client.clear();
  return result;
}

test("this account's /me makes the family's class address its tutoring group", () => {
  const result = space((client, session) => {
    client.setQueryData(
      meOptions(session).queryKey,
      holder("amp|jonah") as never,
    );
    client.setQueryData(classYearOptions(session, CLASS).queryKey, {
      past: false,
      orgId: FAMILY,
      path: [FAMILY],
      can: ["students.read"],
    });
  });
  // A parent's own family opens at /family; at its class address it is the
  // whole group, a teaching place of its own.
  expect(result?.space).toBe("classroom");
  expect(result?.label).toBe("Tutoring group");
});

test("another account's /me (a stale answer after switching) is never read", () => {
  const result = space((client, session) => {
    client.setQueryData(
      meOptions(session).queryKey,
      holder("amp|someone-else") as never,
    );
  });
  // Without the account's own relationship or the org's answer, the place
  // is still loading: nobody's family, no tabs.
  expect(result?.space).toBe("classroom");
  expect(result?.tabs).toEqual([]);
  expect(result?.space === "classroom" && result.status).toBe("loading");
});

test("before the org answers, the account's own relationship names the group", () => {
  const result = space((client, session) => {
    client.setQueryData(
      meOptions(session).queryKey,
      holder("amp|jonah") as never,
    );
    client.setQueryData(classYearOptions(session, CLASS).queryKey, {
      past: false,
      orgId: FAMILY,
      path: [FAMILY],
      can: ["students.read"],
    });
  });
  expect(result?.space).toBe("classroom");
  expect(result?.label).toBe("Tutoring group");
});
