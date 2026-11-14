import process from "node:process";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import type { OrgResource } from "../../../../schools/contracts";
import { sessionOptions } from "../../../lib/query";
import { classesOptions, orgOptions } from "../../school/api";
import { classYearOptions } from "../../school/org/org-api";
import { pilotOptions } from "../../school/pilots/api";
import { useSchoolNavigation } from "../school-navigation";

// Use Node directly: Vite stubs node:crypto in browser modules.
const { randomBytes } = process.getBuiltinModule("node:crypto");
afterEach(cleanup);
function navigation({
  kind = "school",
  roles = ["admin"],
  past = false,
  listed = true,
  can = ["calendar.read"],
}: {
  kind?: OrgResource["kind"];
  roles?: OrgResource["roles"];
  past?: boolean | null;
  listed?: boolean;
  can?: OrgResource["can"];
} = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const session = {
    accountId: "review",
    token: randomBytes(24).toString("hex"),
  };
  client.setQueryData(sessionOptions.queryKey, session);
  client.setQueryData(orgOptions(session, "org").queryKey, {
    id: "org",
    name: "Place",
    kind,
    roles,
    can,
    parentId: null,
    timezone: "UTC",
    solo: true,
  });
  client.setQueryData(
    classesOptions(session, "org").queryKey,
    Array.from({ length: listed ? 1 : 500 }, (_, i) => ({
      id: listed ? "current" : `other-${i}`,
      orgId: "org",
      sessionId: "year",
      name: "Class",
      courseBands: [],
      gradingKind: "year" as const,
      joinCode: "ABCDEF",
      studentCount: 0,
      teachers: [],
    })),
  );
  // Practice is running for the class: Start class has someone to start.
  client.setQueryData(pilotOptions(session, "current").queryKey, {
    status: "active",
    startedAt: "2026-11-01T00:00:00Z",
    endsAt: "2026-12-01T00:00:00Z",
    graceEndsAt: "2026-12-08T00:00:00Z",
    eligible: true,
    authorized: true,
    coverage: { students: 3, covered: 3, paid: 0 },
  });
  if (past !== null)
    client.setQueryData(classYearOptions(session, "current").queryKey, {
      past,
    });
  const hook = renderHook(
    () =>
      useSchoolNavigation({
        kind: "class",
        org: "org",
        classId: "current",
        active: "today",
        leaf: "today",
        board: false,
      }),
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

test.each([["admin", "teacher"], ["teacher"]] as OrgResource["roles"][])(
  "a family-kind class at its class address, for roles %j: a tutoring group, the classroom's tabs, no Start class",
  (...roles) => {
    // A parent's own family class opens at /family; what renders at the
    // class address is the whole group, in a classroom's composition.
    const { tabs, start } = navigation({ kind: "family", roles });
    expect(tabs.map((tab) => tab.id)).toEqual([
      "today",
      "map",
      "gradebook",
      "roster",
      "time",
      "workbooks",
      "settings",
    ]);
    void start;
  },
);

test("a tutoring group's past year keeps its grades and time", () => {
  expect(
    navigation({ kind: "family", past: true }).tabs.map((tab) => tab.id),
  ).toEqual(["gradebook", "time"]);
  expect(navigation().tabs.some((tab) => tab.id === "calendar")).toBe(false);
});

test("review regression: a current class beyond the first 500 keeps its tabs and Start class", () => {
  const result = navigation({ listed: false });
  expect(result.tabs.map((tab) => tab.id)).toEqual([
    "today",
    "map",
    "gradebook",
    "roster",
    "time",
    "workbooks",
    "settings",
  ]);
  expect(result.start).toBe(true);
});

test("past classes keep records without Start class; an unresolved year grants no navigation", () => {
  expect(navigation({ past: true, listed: false })).toMatchObject({
    start: false,
  });
  expect(
    navigation({ past: true, listed: false }).tabs.map((tab) => tab.id),
  ).toEqual(["gradebook", "time"]);
  // An unresolved year grants no tabs and no Start class (the hook also
  // reports whether the place is a demo or a one-class school).
  expect(navigation({ past: null, listed: false })).toMatchObject({
    tabs: [],
    start: false,
  });
});
