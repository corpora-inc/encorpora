import { useQuery } from "@tanstack/react-query";
import type { AuthSession } from "../../auth";
import { queryClient } from "../../lib/query";
import { useSession } from "../../lib/session";
import {
  calendarOptions,
  classesOptions,
  orgOptions,
  refreshSchool,
  school,
} from "../school/api";
import { periodsOf, todayIn, yearOf, type Saved, type Step } from "./model";

/** Where a school year lives: a place (an org) and the class whose report
 * cards it divides. */
export type YearPlace = { org: string; classId: string };

/**
 * One place's school year, read from the canonical Query cache: the org (what
 * the reader can do there, its time zone), its calendar and the class's
 * grading kind. Every key is the school module's (`qk.account(…, "school",
 * …)`), so a save that refreshes the account refreshes this, family
 * Settings, report cards and the gradebook together.
 */
export function useSchoolYear({ org: orgId, classId }: YearPlace) {
  const session = useSession();
  const org = useQuery(orgOptions(session, orgId));
  const can = org.data?.can ?? [];
  const readable = can.includes("calendar.read");
  const calendar = useQuery({
    ...calendarOptions(session, orgId),
    enabled: readable,
  });
  const classes = useQuery({
    ...classesOptions(session, orgId),
    enabled: readable,
  });
  const klass = classes.data?.find((entry) => entry.id === classId);
  const year = calendar.data ? yearOf(calendar.data) : undefined;
  const saved: Saved | null =
    year && klass && calendar.data
      ? { year, sessions: calendar.data, kind: klass.gradingKind }
      : null;
  return {
    /** Known once the org has loaded: whether this reader sees a year. */
    readable: org.data ? readable : undefined,
    saved,
    /** The year's dates and periods may be changed here. */
    canEditYear: can.includes("calendar.write") && !!year && !year.inherited,
    /** The class's grading periods may be chosen here. */
    canChooseKind:
      can.includes("classes.update") || !!org.data?.teaches?.includes(classId),
    today: todayIn(org.data?.timezone),
    failed: org.isError || calendar.isError || classes.isError,
    pending:
      !org.data ||
      (readable && !saved && !calendar.isError && !classes.isError),
    retry: () => {
      if (org.isError) void org.refetch();
      if (calendar.isError) void calendar.refetch();
      if (classes.isError) void classes.refetch();
    },
  };
}

/** The calendar as the server has it now, past any cached copy. */
const freshCalendar = (session: AuthSession, orgId: string) =>
  queryClient.fetchQuery({ ...calendarOptions(session, orgId), staleTime: 0 });

/**
 * Runs one Save's steps in order (model.ts `planSave`). Whatever happens,
 * everything the account shows of its schools is refreshed after, so a
 * partial save never leaves a screen showing what's no longer true; the
 * failure still reaches the caller.
 */
export async function saveSchoolYear(
  session: AuthSession,
  { org: orgId, classId }: YearPlace,
  steps: readonly Step[],
) {
  try {
    for (const step of steps) {
      if (step.kind === "year" || step.kind === "period")
        await school.updateSession(session, orgId, step.id, step.dates);
      else if (step.kind === "grading")
        await school.updateClass(session, orgId, classId, {
          gradingKind: step.gradingKind,
        });
      else {
        // The grading step has just made these periods in equal parts.
        const sessions = await freshCalendar(session, orgId);
        const year = yearOf(sessions);
        const made = year ? periodsOf(sessions, year.id, step.division) : [];
        for (const [index, period] of made.entries()) {
          const dates = step.dates[index];
          if (
            period.id &&
            dates &&
            (dates.startsOn !== period.startsOn ||
              dates.endsOn !== period.endsOn)
          )
            await school.updateSession(session, orgId, period.id, dates);
        }
      }
    }
  } finally {
    await refreshSchool(session);
  }
}
