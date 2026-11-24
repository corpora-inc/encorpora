import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type {
  ReportRow,
  SessionReport,
} from "../../../../schools/live/contracts";
import { reportTotals } from "../../../../schools/live/status";
import { queryClient, sessionOptions } from "../../../lib/query";
import { Report } from "../../school/classes/SessionReportScreen";
import { ChildReportRow, FAMILY_REPORT_WORDS } from "../FamilyReport";
import { PastSessions } from "../PastSessions";
import { sessionsOptions } from "../../live/api";

/* A family's session report and past sessions: the class report's own
 * component in a family's words, each child opening their page, levels as
 * each child's setting says. The pixels, the print and the cold load are
 * measured in a real browser by scripts/verify-family-live-ui.ts. */

const auth = { accountId: "amp|parent", token: "synthetic" };
const family = "11111111-1111-4111-8111-111111111111";
const place = { org: "o", class: "22222222-2222-4222-8222-222222222222" };
const START = Date.parse("2026-11-30T14:00:00.000Z");
const iso = (ms: number) => new Date(START + ms).toISOString();
const person = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const learner = (n: number) => `99999999-0000-4000-8000-00000000000${n}`;
const skill = { id: "s1", title: "Adding fractions", strand: "Number" };
const row = (
  n: number,
  name: string,
  patch: Partial<ReportRow>,
): ReportRow => ({
  personId: person(n),
  name,
  problems: 0,
  correct: 0,
  independent: 0,
  assisted: 0,
  hints: 0,
  lessons: 0,
  examples: 0,
  videos: 0,
  skills: [],
  skill: null,
  level: 3.6,
  firstSeenAt: null,
  firstAnswerAt: null,
  lastAnswerAt: null,
  status: "not_signed_in",
  ...patch,
});
const rows = [
  row(1, "Pip", {
    problems: 8,
    correct: 6,
    independent: 5,
    skills: [skill],
    skill,
    firstSeenAt: iso(1000),
    firstAnswerAt: iso(30_000),
    lastAnswerAt: iso(600_000),
    status: "working",
  }),
  row(2, "Wren", {
    firstSeenAt: iso(5000),
    status: "idle",
  }),
  row(3, "Theo", {}),
];
const report: SessionReport = {
  session: {
    id: "33333333-3333-4333-8333-333333333333",
    classId: place.class,
    startedAt: iso(0),
    plannedEndAt: null,
    endsAt: iso(4 * 3_600_000),
    endedAt: iso(11 * 60_000),
    endReason: "stopped",
    startedBy: null,
    endedBy: null,
    rulesVersion: 1,
  },
  rows,
  totals: reportTotals(rows),
};
const people = new Map(rows.map((r, i) => [r.personId, learner(i + 1)]));
const kit = (shown: (id: string) => boolean) => ({
  words: FAMILY_REPORT_WORDS,
  link: ({
    personId,
    className,
    children,
  }: {
    personId: string;
    className?: string;
    children: React.ReactNode;
  }) => (
    <Link
      to="/$"
      params={{ _splat: `family/${family}/kids/${people.get(personId)}` }}
      className={className}
      data-child-link={people.get(personId)}
    >
      {children}
    </Link>
  ),
  levelShown: shown,
});
const FOREIGN = /\bstudents?\b|\bclass(?:es|room)?\b|\bteachers?\b/i;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

async function mount(body: React.ReactNode) {
  queryClient.setQueryData(sessionOptions.queryKey, auth);
  const root = createRootRoute();
  const leaf = createRoute({
    getParentRoute: () => root,
    path: "/$",
    component: () => <main>{body}</main>,
  });
  const router = createRouter({
    routeTree: root.addChildren([leaf]),
    history: createMemoryHistory({ initialEntries: [`/family/${family}`] }),
  });
  await act(async () => {
    await router.load();
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole("main");
}

test("the report in a family's words, each child opening their page", async () => {
  await mount(
    <Report
      report={report}
      className="The Pell family"
      kit={kit((id) => id === person(1))}
    />,
  );
  expect(screen.getByText("Every child")).toBeTruthy();
  expect(screen.getByText("Didn’t start")).toBeTruthy();
  expect(screen.getByText("Started, no answers")).toBeTruthy();
  expect(document.body.textContent).not.toMatch(FOREIGN);
  const links = new Set(
    [...document.querySelectorAll("a[data-child-link]")].map((a) =>
      a.getAttribute("href"),
    ),
  );
  expect(links).toEqual(
    new Set([1, 2, 3].map((n) => `/family/${family}/kids/${learner(n)}`)),
  );
  // "Not started", never "Not signed in".
  expect(document.body.textContent).toContain("Not started");
  expect(document.body.textContent).not.toContain("Not signed in");
});

test("levels: grade words for a child whose setting is on, a blank for the rest", async () => {
  await mount(
    <Report
      report={report}
      className={undefined}
      kit={kit((id) => id === person(1))}
    />,
  );
  expect(document.body.textContent).toContain("Gr 4");
  expect(document.body.textContent).not.toMatch(/\b3\.6\b/);
  cleanup();
  await mount(
    <Report report={report} className={undefined} kit={kit(() => false)} />,
  );
  // None on: no Level column at all.
  expect(screen.queryByText("Level")).toBeNull();
  expect(document.body.textContent).not.toContain("Gr 4");
});

test("on a phone each child is a row of their own: every fact under the table's own name, every skill whole", async () => {
  const long = {
    id: "s2",
    title: "Equations for addition and subtraction stories",
    strand: "Operations",
  };
  const helped = rows.map((entry, index) =>
    index === 0 ? { ...entry, skills: [skill, long], hints: 2 } : entry,
  );
  await mount(
    <Report
      report={{ ...report, rows: helped, totals: reportTotals(helped) }}
      className={undefined}
      kit={{
        ...kit((id) => id === person(1)),
        card: (entry, columns) => (
          <ChildReportRow row={entry} columns={columns} />
        ),
      }}
    />,
  );
  // (The test's page has no width: the grid is in its phone form.)
  const child = (n: number) =>
    document.querySelector<HTMLElement>(`[data-report-child="${person(n)}"]`)!;
  expect(document.querySelectorAll("[data-report-child]").length).toBe(3);
  const facts = (n: number) =>
    Object.fromEntries(
      [...child(n).querySelectorAll("dl > div")].map((fact) => [
        fact.querySelector("dt")!.textContent,
        fact.querySelector("dd")!.textContent,
      ]),
    );
  const pip = facts(1);
  expect(pip.Problems).toBe("8");
  expect(pip.Correct).toBe("75%");
  expect(pip["On their own"]).toBe("5");
  expect(pip["Right with help"]).toBe("1");
  expect(pip.Level).toBe("Gr 4");
  expect(Object.keys(pip)).toContain("Help opened");
  expect(
    child(1).querySelector('[aria-label^="Help:"]')?.getAttribute("aria-label"),
  ).toBe("Help: 2 hints, 0 lessons, 0 explanations, 0 videos");
  // The name opens the child's page; how they ended is said beside it.
  expect(
    child(1).querySelector("a[data-child-link]")?.getAttribute("href"),
  ).toBe(`/family/${family}/kids/${learner(1)}`);
  expect(child(1).textContent).toContain("At the endWorking");
  expect(child(3).textContent).toContain("At the endNot started");
  // Every skill by its whole name, each a link, in a line that wraps.
  const skills = child(1).querySelector("[data-report-child-skills]")!;
  expect(skills.textContent).toBe(
    "Skills Adding fractions, Equations for addition and subtraction stories",
  );
  expect(skills.querySelectorAll("a").length).toBe(2);
  // No skills, no line; a level kept off, no Level.
  expect(child(2).querySelector("[data-report-child-skills]")).toBeNull();
  expect(Object.keys(facts(2))).not.toContain("Level");
  expect(document.body.textContent).not.toMatch(FOREIGN);
});

test("past sessions: nothing before the first has ended; then a line each, opening its report", async () => {
  const empty = { sessions: [], nextOffset: null };
  queryClient.setQueryData(sessionsOptions(auth, place, 0).queryKey, empty);
  await mount(<PastSessions family={family} place={place} />);
  expect(document.querySelector("[data-past-sessions]")).toBeNull();
  cleanup();
  const totals = report.totals;
  queryClient.setQueryData(sessionsOptions(auth, place, 0).queryKey, {
    sessions: [
      { ...report.session, totals },
      // Running: not a past session.
      {
        ...report.session,
        id: "44444444-4444-4444-8444-444444444444",
        endedAt: null,
        totals: null,
      },
    ],
    nextOffset: null,
  });
  await mount(<PastSessions family={family} place={place} />);
  const links = [...document.querySelectorAll("a[data-past-session]")];
  expect(links.length).toBe(1);
  expect(links[0]!.getAttribute("href")).toBe(
    `/family/${family}/sessions/${report.session.id}`,
  );
  expect(links[0]!.textContent).toMatch(/11 min · 8 problems · 75%/);
  expect(document.body.textContent).not.toMatch(FOREIGN);
});
