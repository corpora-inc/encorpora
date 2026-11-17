import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { qk } from "../../../lib/keys";
import { queryClient, sessionOptions } from "../../../lib/query";
import { saveSchoolYear } from "../api";
import { SchoolYearSection } from "../SchoolYearSection";
import { CLASS, fakeSchool, ORG, YEAR } from "./fake-school";

const fake = vi.hoisted(() => ({
  handle: null as null | ((path: string, body: unknown) => Promise<unknown>),
}));
vi.mock("../../../lib/api", async (actual) => ({
  ...(await actual<typeof import("../../../lib/api")>()),
  request: vi.fn(
    (path: string, _schema: unknown, options?: { body?: unknown }) =>
      fake.handle!(path, options?.body),
  ),
}));

const SESSION = { accountId: "parent", token: "test-token" };
let school: ReturnType<typeof fakeSchool>;
beforeEach(() => {
  school = fakeSchool();
  fake.handle = school.handle;
  queryClient.setQueryData(sessionOptions.queryKey, SESSION as never);
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});

function mount(grading = true, setBy?: string) {
  const history = createMemoryHistory({
    initialEntries: ["/family/f/settings"],
  });
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <SchoolYearSection
          org={ORG}
          classId={CLASS}
          grading={grading}
          setBy={setBy}
        />
      ),
    }),
    history,
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return history;
}

const section = () =>
  screen.getByRole("region", { name: "School year" }) as HTMLElement;
const barNames = (root: ParentNode) =>
  [...root.querySelectorAll("[data-labelled] > span")]
    .map((part) => part.textContent)
    .filter(Boolean);

test("one section: the year's line, the bar, one caption and one Edit", async () => {
  mount();
  await screen.findByText("2026–27 · Jul 1, 2026 to Jun 30, 2027");
  expect(screen.getAllByRole("heading")).toHaveLength(1);
  expect(
    within(section()).getByText("One report card for the whole year"),
  ).toBeTruthy();
  expect(
    within(section())
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Edit"]);
  expect(barNames(section())).toEqual([]);
});

test("Edit, choose Quarters, Save: one sheet saves it, and the bar and caption follow", async () => {
  const history = mount();
  await screen.findByText("2026–27 · Jul 1, 2026 to Jun 30, 2027");
  // Something else the account shows: the save refreshes it too.
  const other = qk.account(SESSION.accountId, "families");
  queryClient.setQueryData(other, ["before"]);
  fireEvent.click(screen.getByRole("button", { name: "Edit the school year" }));
  const sheet = await screen.findByRole("dialog");
  // The sheet is a history entry at the same address (nav/sheet.ts).
  expect(history.location.pathname).toBe("/family/f/settings");
  expect((history.location.state as { sheet?: string }).sheet).toBe(
    "school-year",
  );
  expect(within(sheet).getByText("First day")).toBeTruthy();
  expect(within(sheet).getByText("Last day")).toBeTruthy();
  fireEvent.click(within(sheet).getByRole("radio", { name: "Quarters" }));
  // The live bar and the period list follow the choice before any save.
  expect(barNames(sheet)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
  expect(within(sheet).getByText("Quarter 4")).toBeTruthy();
  expect(school.state.calls.filter((c) => c.body !== undefined)).toEqual([]);
  fireEvent.click(within(sheet).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(school.state.calls.filter((c) => c.body !== undefined)).toEqual([
    {
      path: `/school/orgs/${ORG}/classes/${CLASS}`,
      body: { gradingKind: "quarter" },
    },
  ]);
  expect(barNames(section())).toEqual(["Q1", "Q2", "Q3", "Q4"]);
  expect(
    within(section()).getByText(/^Quarters · .*a report card each quarter$/),
  ).toBeTruthy();
  expect(queryClient.getQueryState(other)?.isInvalidated).toBe(true);
  expect((history.location.state as { sheet?: string }).sheet).toBeUndefined();
});

test("a year step saves the year's dates and nothing else", async () => {
  school.state.gradingKind = "semester";
  await school.handle(`/school/orgs/${ORG}/classes/${CLASS}`, {
    gradingKind: "semester",
  });
  school.state.calls = [];
  await saveSchoolYear(SESSION, { org: ORG, classId: CLASS }, [
    {
      kind: "year",
      id: YEAR,
      dates: { startsOn: "2026-08-17", endsOn: "2027-06-04" },
    },
  ]);
  expect(school.state.calls.map((c) => c.path)).toEqual([
    `/school/orgs/${ORG}/calendar/sessions/${YEAR}`,
  ]);
});

test("Save with hand-set new periods: the kind, then those periods' days", async () => {
  await saveSchoolYear(SESSION, { org: ORG, classId: CLASS }, [
    { kind: "grading", gradingKind: "semester" },
    {
      kind: "new-periods",
      division: "semester",
      dates: [
        { startsOn: "2026-07-01", endsOn: "2026-12-18" },
        { startsOn: "2027-01-05", endsOn: "2027-06-30" },
      ],
    },
  ]);
  const semesters = school.state.sessions.filter((s) => s.kind === "semester");
  expect(semesters.map((s) => [s.startsOn, s.endsOn])).toEqual([
    ["2026-07-01", "2026-12-18"],
    ["2027-01-05", "2027-06-30"],
  ]);
});

test("a failed save says so in the sheet, keeps the draft, and still refreshes", async () => {
  mount();
  await screen.findByText("2026–27 · Jul 1, 2026 to Jun 30, 2027");
  school.state.refuse = /classes/;
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "Edit the school year" }));
  const sheet = await screen.findByRole("dialog");
  fireEvent.click(within(sheet).getByRole("radio", { name: "Semesters" }));
  fireEvent.click(within(sheet).getByRole("button", { name: "Save" }));
  await within(sheet).findByText(/didn’t save/);
  expect(
    within(sheet)
      .getByRole("radio", { name: "Semesters" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});

test("a tutoring group's year: read-only, with who sets it", async () => {
  mount(true, "Your tutoring group");
  await screen.findByText("Your tutoring group sets these dates.");
  expect(within(section()).queryByRole("button")).toBeNull();
});

test("without report cards: the year unsplit, and nothing to choose", async () => {
  school.state.gradingKind = "quarter";
  mount(false);
  await screen.findByText("Report cards and time count from Jul 1");
  expect(barNames(section())).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Edit the school year" }));
  const sheet = await screen.findByRole("dialog");
  expect(within(sheet).queryByRole("radiogroup")).toBeNull();
});
