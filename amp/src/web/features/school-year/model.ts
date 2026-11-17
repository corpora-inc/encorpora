import {
  divisionKinds,
  divisionLabels,
  formatDay,
  splitYear,
  yearName,
  type DivisionKind,
} from "../../../schools/calendar";
import type { GradingKind } from "../../../schools/contracts";
import type { SessionResource } from "../../../schools/setup-contracts";

/*
 * One school year, as a family or a small class sees it: its dates, its
 * grading periods (none, semesters, trimesters or quarters) and one report
 * card a period. Pure arithmetic over the calendar's sessions, shared by the
 * section, its edit sheet and the save, so all three agree.
 */

/** A choice of grading periods. None is the whole year. */
export type Choice = "year" | DivisionKind;
export const gradingChoices: Choice[] = ["year", ...divisionKinds];

export type Span = { startsOn: string; endsOn: string };
export type Period = Span & {
  name: string;
  /** The saved session; a period not saved yet has none. */
  id?: string;
  /** Set by a district above: shown, never changed here. */
  inherited?: boolean;
};

/** A grading choice in words: Full year, Semesters, Trimesters, Quarters. */
export const gradingWords = (kind: GradingKind) =>
  kind === "year"
    ? "Full year"
    : kind === "custom"
      ? "Custom"
      : divisionLabels[kind].plural;

/** The picker's word for a choice: None, Semesters, Trimesters, Quarters. */
export const choiceWords = (choice: Choice) =>
  choice === "year" ? "None" : divisionLabels[choice].plural;

/** A class's grading kind as a choice. "Custom" has no periods of its own
 * here, so its report card covers the whole year, as None's does. */
export const choiceOf = (kind: GradingKind): Choice =>
  kind === "custom" ? "year" : kind;

export const isDivision = (choice: Choice): choice is DivisionKind =>
  choice !== "year";

/** The year in use: the calendar lists the latest year first. */
export const yearOf = (sessions: readonly SessionResource[]) =>
  sessions.find((entry) => entry.kind === "year");

/** A year's periods of one kind, in order. */
export function periodsOf(
  sessions: readonly SessionResource[],
  yearId: string,
  kind: DivisionKind,
): Period[] {
  return sessions
    .filter((entry) => entry.kind === kind && entry.parentId === yearId)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
    .map(({ id, name, startsOn, endsOn, inherited }) => ({
      id,
      name,
      startsOn,
      endsOn,
      inherited,
    }));
}

/** The division kinds a year already has periods for. */
export const kindsOf = (
  sessions: readonly SessionResource[],
  yearId: string,
): DivisionKind[] =>
  divisionKinds.filter((kind) =>
    sessions.some((entry) => entry.kind === kind && entry.parentId === yearId),
  );

const sameSpans = (a: readonly Span[], b: readonly Span[]) =>
  a.length === b.length &&
  a.every(
    (span, index) =>
      span.startsOn === b[index]!.startsOn && span.endsOn === b[index]!.endsOn,
  );

/** Equal parts of a year, keeping the names and ids of the periods they
 * replace where there is one for each. */
function equalParts(
  periods: readonly Period[],
  year: Span,
  kind: DivisionKind,
): Period[] {
  return splitYear(year.startsOn, year.endsOn, kind).map((part, index) => {
    const before =
      periods.length === divisionLabels[kind].parts
        ? periods[index]
        : undefined;
    return before ? { ...before, ...part, name: before.name } : part;
  });
}

/**
 * A year's periods, moved to the year's new dates. Equal parts stay equal
 * parts. Otherwise the boundaries inside the year stay where a person put
 * them and the outer edges follow the year; if a period no longer fits, the
 * year is split into equal parts again.
 */
export function fitPeriods(
  periods: readonly Period[],
  from: Span,
  to: Span,
  kind: DivisionKind,
): Period[] {
  if (
    (from.startsOn === to.startsOn && from.endsOn === to.endsOn) ||
    yearProblem(to)
  )
    return [...periods];
  if (
    !periods.length ||
    sameSpans(periods, splitYear(from.startsOn, from.endsOn, kind))
  )
    return equalParts(periods, to, kind);
  const moved = periods.map((period) => ({ ...period }));
  const first = moved[0]!;
  const last = moved[moved.length - 1]!;
  if (first.startsOn === from.startsOn || first.startsOn < to.startsOn)
    first.startsOn = to.startsOn;
  if (last.endsOn === from.endsOn || last.endsOn > to.endsOn)
    last.endsOn = to.endsOn;
  return periodProblems(moved, to).some(Boolean)
    ? equalParts(periods, to, kind)
    : moved;
}

export type Problem = { startsOn?: string; endsOn?: string } | null;

/** What's wrong with a year's dates, said at the field. */
export function yearProblem(year: Span): Problem {
  if (!year.startsOn) return { startsOn: "Choose the first day." };
  if (!year.endsOn) return { endsOn: "Choose the last day." };
  return year.endsOn < year.startsOn
    ? { endsOn: "Ends before the first day." }
    : null;
}

/** What's wrong with each period, said at its field: in order, inside the
 * year, each ending after it starts, none overlapping the one before. */
export function periodProblems(
  periods: readonly Period[],
  year: Span,
): Problem[] {
  return periods.map((period, index) => {
    const before = periods[index - 1];
    if (period.endsOn < period.startsOn)
      return { endsOn: "Ends before it starts." };
    if (period.startsOn < year.startsOn)
      return { startsOn: "Before the year starts." };
    if (period.endsOn > year.endsOn) return { endsOn: "After the year ends." };
    if (before && period.startsOn <= before.endsOn)
      return { startsOn: `Overlaps ${before.name}.` };
    return null;
  });
}

/** The period today falls in, if any. */
export const currentPeriod = (periods: readonly Period[], today: string) =>
  periods.find((period) => period.startsOn <= today && today <= period.endsOn);

/** A period's name inside the bar: "Quarter 2" is Q2; any other name is
 * itself. */
export function shortName(name: string) {
  const match = /^(Semester|Trimester|Quarter) (\d+)$/.exec(name);
  return match ? `${match[1]![0]}${match[2]}` : name;
}

/** The year's line: "2026–27 · Jul 1, 2026 to Jun 30, 2027". */
export const yearLine = (year: Span) =>
  `${yearName(year.startsOn, year.endsOn)} · ${formatDay(year.startsOn)} to ${formatDay(year.endsOn)}`;

/** The one caption under the bar: what the periods mean for report cards,
 * and which one is now. */
export function caption({
  grading,
  choice,
  periods,
  year,
  today,
}: {
  /** A child here has report cards. */
  grading: boolean;
  choice: Choice;
  periods: readonly Period[];
  year: Span;
  today: string;
}) {
  if (!grading)
    return `Report cards and time count from ${formatDay(year.startsOn, false)}`;
  if (!isDivision(choice)) return "One report card for the whole year";
  const { plural, one } = divisionLabels[choice];
  const now = currentPeriod(periods, today);
  const each = `a report card each ${one.toLowerCase()}`;
  return now
    ? `${plural} · ${now.name} now, ${formatDay(now.startsOn, false)} to ${formatDay(now.endsOn, false)} · ${each}`
    : `${plural} · ${each}`;
}

/** Today in a place's own time zone, as a calendar day. */
export function todayIn(timeZone: string | undefined, now = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch (cause) {
    // An unknown zone (never from the server's list): the device's day.
    console.warn("The place's time zone is unknown; using this device's", {
      timeZone,
      cause,
    });
    return new Intl.DateTimeFormat("en-CA").format(now);
  }
}

/* The edit sheet's draft. */

/** What the sheet holds while someone edits: the year's dates, the chosen
 * periods, and any period dates they've changed, by kind. */
export type Draft = Span & {
  choice: Choice;
  edits: Partial<Record<DivisionKind, Period[]>>;
};

/** What is saved now, which the draft starts from and is compared with. */
export type Saved = {
  year: SessionResource;
  sessions: readonly SessionResource[];
  /** The class's grading kind. */
  kind: GradingKind;
};

export const startDraft = (saved: Saved): Draft => ({
  startsOn: saved.year.startsOn,
  endsOn: saved.year.endsOn,
  choice: choiceOf(saved.kind),
  edits: {},
});

/** The periods of one kind as the draft has them: as edited, or the saved
 * ones moved to the draft's dates, or equal parts of the draft's year. */
export function draftPeriods(
  draft: Draft,
  saved: Saved,
  kind: DivisionKind,
): Period[] {
  const edited = draft.edits[kind];
  if (edited) return edited;
  const existing = periodsOf(saved.sessions, saved.year.id, kind);
  return existing.length
    ? fitPeriods(existing, saved.year, draft, kind)
    : splitYear(draft.startsOn, draft.endsOn, kind);
}

/** The draft with new year dates; periods someone edited move with it. */
export function moveYear(draft: Draft, next: Span): Draft {
  const edits: Draft["edits"] = {};
  const valid = !yearProblem(next) && !yearProblem(draft);
  for (const kind of divisionKinds) {
    const edited = draft.edits[kind];
    if (edited)
      edits[kind] = valid ? fitPeriods(edited, draft, next, kind) : edited;
  }
  return { ...draft, ...next, edits };
}

/** The draft with one period's dates changed. */
export function editPeriod(
  draft: Draft,
  saved: Saved,
  kind: DivisionKind,
  index: number,
  change: Partial<Span>,
): Draft {
  const periods = draftPeriods(draft, saved, kind).map((period, at) =>
    at === index ? { ...period, ...change } : period,
  );
  return { ...draft, edits: { ...draft.edits, [kind]: periods } };
}

/** Whether the draft can be saved: every field holds. */
export function draftProblems(
  draft: Draft,
  saved: Saved,
  grading: boolean,
): { year: Problem; periods: Problem[] } {
  const year = yearProblem(draft);
  const periods =
    grading && isDivision(draft.choice) && !year
      ? periodProblems(draftPeriods(draft, saved, draft.choice), draft)
      : [];
  return { year, periods };
}

/* Saving. */

export type Step =
  | { kind: "year"; id: string; dates: Span }
  | { kind: "grading"; gradingKind: Choice }
  | { kind: "period"; id: string; dates: Span }
  /** Periods the grading step creates (in equal parts), then set to these
   * dates: the server makes them, so their ids are known only after. */
  | { kind: "new-periods"; division: DivisionKind; dates: Span[] };

const changed = (a: Span, b: Span) =>
  a.startsOn !== b.startsOn || a.endsOn !== b.endsOn;
const dates = ({ startsOn, endsOn }: Span): Span => ({ startsOn, endsOn });

/**
 * One Save, in order: the year's dates, then the class's grading periods
 * (the server adds that kind of period when the year has none,
 * schools/roster.ts `updateClass`), then each period whose dates differ.
 * When the year moves, every set of periods it holds moves with it, so none
 * is left outside the year.
 */
export function planSave(saved: Saved, draft: Draft, grading: boolean): Step[] {
  const steps: Step[] = [];
  if (changed(draft, saved.year))
    steps.push({ kind: "year", id: saved.year.id, dates: dates(draft) });
  if (grading && draft.choice !== choiceOf(saved.kind))
    steps.push({ kind: "grading", gradingKind: draft.choice });
  const chosen = grading && isDivision(draft.choice) ? draft.choice : null;
  for (const kind of kindsOf(saved.sessions, saved.year.id)) {
    const existing = periodsOf(saved.sessions, saved.year.id, kind);
    const target =
      kind === chosen
        ? draftPeriods(draft, saved, kind)
        : fitPeriods(existing, saved.year, draft, kind);
    existing.forEach((period, index) => {
      const next = target[index];
      if (period.id && !period.inherited && next && changed(next, period))
        steps.push({ kind: "period", id: period.id, dates: dates(next) });
    });
  }
  if (chosen && !kindsOf(saved.sessions, saved.year.id).includes(chosen)) {
    const target = draftPeriods(draft, saved, chosen);
    if (!sameSpans(target, splitYear(draft.startsOn, draft.endsOn, chosen)))
      steps.push({
        kind: "new-periods",
        division: chosen,
        dates: target.map(dates),
      });
  }
  return steps;
}
