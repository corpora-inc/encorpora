import { expect, test } from "vitest";
import { splitYear } from "../../../../schools/calendar";
import type { SessionResource } from "../../../../schools/setup-contracts";
import {
  caption,
  choiceOf,
  currentPeriod,
  draftPeriods,
  draftProblems,
  editPeriod,
  fitPeriods,
  moveYear,
  periodProblems,
  periodsOf,
  planSave,
  shortName,
  startDraft,
  todayIn,
  yearLine,
  type Saved,
} from "../model";

const YEAR = "00000000-0000-4000-8000-000000000001";
const year: SessionResource = {
  id: YEAR,
  parentId: null,
  kind: "year",
  name: "2026–27",
  startsOn: "2026-07-01",
  endsOn: "2027-06-30",
  inherited: false,
};
const quarters = splitYear(year.startsOn, year.endsOn, "quarter").map(
  (part, index): SessionResource => ({
    ...part,
    id: `00000000-0000-4000-8000-00000000010${index}`,
    parentId: YEAR,
    kind: "quarter",
    inherited: false,
  }),
);
const saved = (kind: Saved["kind"], sessions = [year, ...quarters]): Saved => ({
  year,
  sessions,
  kind,
});

test("the year's line and each period's short name", () => {
  expect(yearLine(year)).toBe("2026–27 · Jul 1, 2026 to Jun 30, 2027");
  expect(shortName("Quarter 2")).toBe("Q2");
  expect(shortName("Semester 1")).toBe("S1");
  expect(shortName("Fall")).toBe("Fall");
  expect(choiceOf("custom")).toBe("year");
});

test("the periods come in order, and the one today falls in is found", () => {
  const shuffled = [
    quarters[2]!,
    year,
    quarters[0]!,
    quarters[3]!,
    quarters[1]!,
  ];
  const periods = periodsOf(shuffled, YEAR, "quarter");
  expect(periods.map((p) => p.name)).toEqual([
    "Quarter 1",
    "Quarter 2",
    "Quarter 3",
    "Quarter 4",
  ]);
  expect(currentPeriod(periods, "2026-11-16")?.name).toBe("Quarter 2");
  expect(currentPeriod(periods, "2027-08-01")).toBeUndefined();
});

test("one caption: periods and the one now, the whole year, or no report cards", () => {
  const periods = periodsOf(quarters, YEAR, "quarter");
  const base = { year, periods, today: "2026-11-16" };
  expect(caption({ ...base, grading: true, choice: "quarter" })).toBe(
    "Quarters · Quarter 2 now, Sep 30 to Dec 29 · a report card each quarter",
  );
  expect(
    caption({ ...base, grading: true, choice: "quarter", today: "2027-08-01" }),
  ).toBe("Quarters · a report card each quarter");
  expect(caption({ ...base, grading: true, choice: "year" })).toBe(
    "One report card for the whole year",
  );
  expect(caption({ ...base, grading: false, choice: "quarter" })).toBe(
    "Report cards and time count from Jul 1",
  );
});

test("equal periods stay equal when the year moves", () => {
  const to = { startsOn: "2026-08-15", endsOn: "2027-06-15" };
  const moved = fitPeriods(
    periodsOf(quarters, YEAR, "quarter"),
    year,
    to,
    "quarter",
  );
  expect(moved.map(({ startsOn, endsOn }) => ({ startsOn, endsOn }))).toEqual(
    splitYear(to.startsOn, to.endsOn, "quarter").map(
      ({ startsOn, endsOn }) => ({
        startsOn,
        endsOn,
      }),
    ),
  );
  // Each keeps its saved id, so the save updates rather than adds.
  expect(moved.map((p) => p.id)).toEqual(quarters.map((q) => q.id));
});

test("hand-set boundaries stay; the outer edges follow the year; what no longer fits is split again", () => {
  const semesters = [
    { name: "Semester 1", startsOn: "2026-07-01", endsOn: "2026-12-18" },
    { name: "Semester 2", startsOn: "2027-01-05", endsOn: "2027-06-30" },
  ];
  const later = fitPeriods(
    semesters,
    year,
    { startsOn: "2026-08-17", endsOn: "2027-06-04" },
    "semester",
  );
  expect(later).toEqual([
    { name: "Semester 1", startsOn: "2026-08-17", endsOn: "2026-12-18" },
    { name: "Semester 2", startsOn: "2027-01-05", endsOn: "2027-06-04" },
  ]);
  const short = { startsOn: "2027-01-10", endsOn: "2027-06-30" };
  const refit = fitPeriods(semesters, year, short, "semester");
  expect(refit.map(({ startsOn, endsOn }) => ({ startsOn, endsOn }))).toEqual(
    splitYear(short.startsOn, short.endsOn, "semester").map(
      ({ startsOn, endsOn }) => ({ startsOn, endsOn }),
    ),
  );
});

test("each period's problem is said at its field", () => {
  expect(
    periodProblems(
      [
        { name: "Semester 1", startsOn: "2026-06-01", endsOn: "2026-12-31" },
        { name: "Semester 2", startsOn: "2026-12-20", endsOn: "2027-06-30" },
      ],
      year,
    ),
  ).toEqual([
    { startsOn: "Before the year starts." },
    { startsOn: "Overlaps Semester 1." },
  ]);
  expect(
    periodProblems(
      [{ name: "Semester 1", startsOn: "2026-09-01", endsOn: "2026-08-01" }],
      year,
    ),
  ).toEqual([{ endsOn: "Ends before it starts." }]);
});

test("the draft: periods follow the year's new dates, and an edit holds", () => {
  const start = saved("quarter");
  let draft = startDraft(start);
  expect(draft.choice).toBe("quarter");
  draft = editPeriod(draft, start, "quarter", 0, { endsOn: "2026-09-20" });
  expect(draftPeriods(draft, start, "quarter")[0]!.endsOn).toBe("2026-09-20");
  // The year moves later: the edited boundary stays, the first day follows.
  draft = moveYear(draft, { startsOn: "2026-08-01", endsOn: "2027-06-30" });
  const periods = draftPeriods(draft, start, "quarter");
  expect(periods[0]).toMatchObject({
    startsOn: "2026-08-01",
    endsOn: "2026-09-20",
  });
  expect(draftProblems(draft, start, true).periods.every((p) => !p)).toBe(true);
});

test("Save plans the year, the periods' kind, then each changed period, in that order", () => {
  const start = saved("quarter");
  expect(planSave(start, startDraft(start), true)).toEqual([]);
  // Quarters to semesters, which the year has none of: the server makes
  // them in equal parts, so nothing more is sent.
  const semesters = { ...startDraft(start), choice: "semester" as const };
  expect(planSave(start, semesters, true)).toEqual([
    { kind: "grading", gradingKind: "semester" },
  ]);
  // …unless they were set by hand before the save.
  const edited = editPeriod(semesters, start, "semester", 0, {
    endsOn: "2026-12-18",
  });
  expect(planSave(start, edited, true)).toEqual([
    { kind: "grading", gradingKind: "semester" },
    {
      kind: "new-periods",
      division: "semester",
      dates: [
        { startsOn: "2026-07-01", endsOn: "2026-12-18" },
        { startsOn: "2026-12-30", endsOn: "2027-06-30" },
      ],
    },
  ]);
  // A new first day moves the year, and with it every quarter it holds.
  const moved = moveYear(startDraft(start), {
    startsOn: "2026-08-01",
    endsOn: "2027-06-30",
  });
  const steps = planSave(start, moved, true);
  expect(steps[0]).toEqual({
    kind: "year",
    id: YEAR,
    dates: { startsOn: "2026-08-01", endsOn: "2027-06-30" },
  });
  expect(steps.slice(1).every((step) => step.kind === "period")).toBe(true);
  expect(steps).toHaveLength(5);
  // Without report cards, the kind is never changed.
  expect(planSave(start, semesters, false)).toEqual([]);
});

test("inherited periods are never saved", () => {
  const district = quarters.map((q) => ({ ...q, inherited: true }));
  const start = saved("quarter", [year, ...district]);
  const moved = moveYear(startDraft(start), {
    startsOn: "2026-08-01",
    endsOn: "2027-06-30",
  });
  expect(planSave(start, moved, true).map((s) => s.kind)).toEqual(["year"]);
});

test("today is the place's own calendar day", () => {
  const late = new Date("2026-11-17T03:00:00Z");
  expect(todayIn("America/Los_Angeles", late)).toBe("2026-11-16");
  expect(todayIn("Europe/Berlin", late)).toBe("2026-11-17");
});
