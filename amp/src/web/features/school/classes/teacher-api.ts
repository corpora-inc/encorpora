import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import {
  classSkillResponse,
  studentSkillResponse,
  evidenceResponse,
  gradebookResponse,
  mapResponse,
  reportCardsResponse,
  studentRecordResponse,
  studentTimeResponse,
  timeResponse,
  todayResponse,
  workReplayResponse,
  type EvidenceResponse,
  type GradebookResponse,
  type GradebookColumn,
  type TimePeriod,
} from "../../../../schools/teacher-contracts";
import {
  gradeCurveSchema,
  type GradeCurve,
} from "../../../../schools/grade-curve";
import type { AuthSession } from "../../../auth";
import { AppError } from "../../../lib/AppError";
import { request } from "../../../lib/api";

export type Place = { org: string; class: string };
type Session = AuthSession | null;
const CLASS = ({ class: id }: Place) => `/school/classes/${id}`;
/** One store: everything about a class lives under this key, so a change here
 * refreshes the map, the gradebook and the roster alike. */
const classKey = (session: Session, place: Place) =>
  ["account", session?.accountId, "school", place.org, place.class] as const;
const recordKey = (session: Session, student: string) =>
  ["account", session?.accountId, "school", "record", student] as const;
const read =
  <T>(
    session: Session,
    path: string,
    schema: z.ZodType<T>,
  ): ((context: { signal: AbortSignal }) => Promise<T>) =>
  ({ signal }) =>
    request(path, schema, { token: session?.token, signal });

export const todayOptions = (session: Session, place: Place) =>
  queryOptions({
    queryKey: [...classKey(session, place), "today"],
    enabled: !!session,
    queryFn: read(session, `${CLASS(place)}/today`, todayResponse),
  });
export const mapOptions = (session: Session, place: Place) =>
  queryOptions({
    queryKey: [...classKey(session, place), "map"],
    enabled: !!session,
    queryFn: read(session, `${CLASS(place)}/map`, mapResponse),
  });
export const gradebookOptions = (
  session: Session,
  place: Place,
  term: string | undefined,
) =>
  queryOptions({
    queryKey: [...classKey(session, place), "gradebook", term ?? "current"],
    enabled: !!session,
    placeholderData: keepPreviousData,
    queryFn: read(
      session,
      `${CLASS(place)}/gradebook${term ? `?term=${term}` : ""}`,
      gradebookResponse,
    ),
  });
export const evidenceOptions = (
  session: Session,
  place: Place,
  term: string,
  student: string,
  offset = 0,
) =>
  queryOptions({
    queryKey: [...classKey(session, place), "evidence", term, student, offset],
    enabled: !!session,
    queryFn: read(
      session,
      `${CLASS(place)}/students/${student}/evidence?term=${term}&offset=${offset}`,
      evidenceResponse,
    ),
  });
/** `&from=` for a read that names its start, never more than the limit
 * before its end. */
const fromQuery = (from?: string) => (from ? `&from=${from}` : "");
export const timeOptions = (
  session: Session,
  place: Place,
  period: TimePeriod,
  /** A start, for a range whose own would be too long to read. */
  from?: string,
) =>
  queryOptions({
    queryKey: [...classKey(session, place), "time", period, from ?? null],
    enabled: !!session,
    placeholderData: keepPreviousData,
    queryFn: read(
      session,
      `${CLASS(place)}/time?period=${period}${fromQuery(from)}`,
      timeResponse,
    ),
  });
export const studentTimeOptions = (
  session: Session,
  place: Place,
  period: TimePeriod,
  student: string,
  /** The class report's own start, so the two read the same days. */
  from?: string,
) =>
  queryOptions({
    queryKey: [
      ...classKey(session, place),
      "student-time",
      period,
      student,
      from ?? null,
    ],
    enabled: !!session,
    queryFn: read(
      session,
      `${CLASS(place)}/students/${student}/time?period=${period}${fromQuery(from)}`,
      studentTimeResponse,
    ),
  });
export const reportCardsOptions = (
  session: Session,
  place: Place,
  term: string,
) =>
  queryOptions({
    queryKey: [...classKey(session, place), "report-cards", term],
    enabled: !!session,
    queryFn: read(
      session,
      `${CLASS(place)}/report-cards?term=${term}`,
      reportCardsResponse,
    ),
  });
/** One answer replayed (`work-replay.ts`), under the student's record so a
 * change to the record refreshes it too. `skill` narrows Previous and Next. */
export const workReplayOptions = (
  session: Session,
  student: string,
  attempt: string,
  skill?: string,
) =>
  queryOptions({
    queryKey: [...recordKey(session, student), "work", attempt, skill ?? null],
    enabled: !!session,
    // An answer never changes once given.
    staleTime: Infinity,
    queryFn: read(
      session,
      `/school/students/${student}/work/${encodeURIComponent(attempt)}${
        skill ? `?skill=${encodeURIComponent(skill)}` : ""
      }`,
      workReplayResponse,
    ),
  });
/** One of the adult's own answers replayed (`/me`), under their own
 * practice's key, so a change to it refreshes this too. */
export const ownWorkReplayOptions = (
  session: Session,
  attempt: string,
  skill?: string,
) =>
  queryOptions({
    queryKey: [
      "account",
      session?.accountId ?? "",
      "own-practice",
      "work",
      attempt,
      skill ?? null,
    ],
    enabled: !!session,
    staleTime: Infinity,
    queryFn: read(
      session,
      `/me/practice/work/${encodeURIComponent(attempt)}${
        skill ? `?skill=${encodeURIComponent(skill)}` : ""
      }`,
      workReplayResponse,
    ),
  });
/** A student on one skill (a skill layer over their record). */
export const studentSkillOptions = (
  session: Session,
  student: string,
  skill: string,
) =>
  queryOptions({
    queryKey: [...recordKey(session, student), "skill", skill],
    enabled: !!session,
    queryFn: read(
      session,
      `/school/students/${student}/skills/${encodeURIComponent(skill)}`,
      studentSkillResponse,
    ),
  });
/** A class on one skill (a skill layer over a class page). */
export const classSkillOptions = (
  session: Session,
  place: Place,
  skill: string,
) =>
  queryOptions({
    queryKey: [...classKey(session, place), "skill", skill],
    enabled: !!session,
    queryFn: read(
      session,
      `${CLASS(place)}/skills/${encodeURIComponent(skill)}`,
      classSkillResponse,
    ),
  });
export const studentRecordOptions = (session: Session, student: string) =>
  queryOptions({
    queryKey: recordKey(session, student),
    enabled: !!session,
    queryFn: read(
      session,
      `/school/students/${student}/record`,
      studentRecordResponse,
    ),
  });

const messages: Record<string, string> = {
  term_closed: "This term is closed, so its grades can’t change.",
  term_empty: "This term has no students to close.",
  setting_locked:
    "Your school set this and locked it, so it can’t change here.",
  not_found: "This isn’t available to your account. Reload to see what is.",
  invalid_school_request: "Check what you entered and try again.",
  school_service_unavailable: "That didn’t save. Try again in a moment.",
  too_many_requests: "Too many requests just now. Wait a minute and try again.",
};
/** What a failed action means and what to do. Every failure is also logged. */
export function failureMessage(error: unknown, fallback: string): string {
  console.error(fallback, error);
  if (error instanceof AppError)
    return (error.code && messages[error.code]) || error.message || fallback;
  return fallback;
}

function useClassRefresh(session: Session, place: Place) {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: classKey(session, place) }),
      client.invalidateQueries({
        queryKey: ["account", session?.accountId, "school", "record"],
      }),
    ]);
}

/** Saves one final grade. The new value is in the store before the refetch, so
 * a row and its evidence sheet never disagree. */
export function useSaveFinal(session: Session, place: Place) {
  const client = useQueryClient();
  const refresh = useClassRefresh(session, place);
  return useMutation({
    mutationFn: (input: { student: string; term: string; value: string }) =>
      request(
        `${CLASS(place)}/students/${input.student}/final`,
        z.object({ final: z.string().nullable() }),
        {
          token: session?.token,
          body: { term: input.term, value: input.value },
        },
      ),
    onSuccess: ({ final }, { student, term }) => {
      client.setQueriesData<GradebookResponse>(
        { queryKey: [...classKey(session, place), "gradebook"] },
        (book) =>
          book && book.term?.id === term
            ? {
                ...book,
                students: book.students.map((row) =>
                  row.id === student ? { ...row, final } : row,
                ),
              }
            : book,
      );
      client.setQueriesData<EvidenceResponse>(
        { queryKey: [...classKey(session, place), "evidence", term, student] },
        (evidence) => evidence && { ...evidence, final },
      );
      return refresh();
    },
  });
}
export function useSetTarget(session: Session, place: Place) {
  const refresh = useClassRefresh(session, place);
  return useMutation({
    mutationFn: (minutes: number | null) =>
      request(
        `${CLASS(place)}/target`,
        z.object({ minutes: z.number().nullable(), locked: z.boolean() }),
        { token: session?.token, body: { minutes } },
      ),
    onSettled: () => refresh(),
  });
}
/** Sets the teacher's curve for one term, or null for the standard scale. The
 * whole class refetches: every suggested range moves with it. */
export function useSetCurve(session: Session, place: Place) {
  const refresh = useClassRefresh(session, place);
  return useMutation({
    mutationFn: (input: { term: string; curve: GradeCurve | null }) =>
      request(
        `${CLASS(place)}/gradebook/curve`,
        z.object({ curve: gradeCurveSchema.nullable() }),
        { token: session?.token, body: input },
      ),
    onSettled: () => refresh(),
  });
}
export function useCloseTerm(session: Session, place: Place) {
  const refresh = useClassRefresh(session, place);
  return useMutation({
    mutationFn: (term: string) =>
      request(
        `${CLASS(place)}/gradebook/close`,
        z.object({ frozen: z.number() }),
        { token: session?.token, body: { term } },
      ),
    onSettled: () => refresh(),
  });
}

/** A file's response from the server, carrying the sign-in a plain link
 * couldn't; a failure is an error that says what to do. */
async function fetchFile(
  session: Session,
  path: string,
): Promise<{ name: string; response: Response }> {
  const response = await fetch(`/api/v1${path}`, {
    headers: { Authorization: `Bearer ${session?.token ?? ""}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new AppError(
      "unavailable",
      "That file didn’t download. Check your connection and try again.",
      true,
      response.headers.get("x-request-id"),
      body?.error ?? null,
      response.status,
    );
  }
  const name =
    /filename="([^"]+)"/.exec(
      response.headers.get("content-disposition") ?? "",
    )?.[1] ?? "export";
  return { name, response };
}
/** Save a file the browser downloads. */
function save(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
async function download(session: Session, path: string): Promise<string> {
  const { name, response } = await fetchFile(session, path);
  return save(name, await response.blob());
}
/** A CSV's text and name, without saving it (to combine several). */
export async function fetchCsv(
  session: Session,
  path: string,
): Promise<{ name: string; text: string }> {
  const { name, response } = await fetchFile(session, path);
  return { name, text: await response.text() };
}
/** Save text as a CSV file the browser downloads, marked UTF-8 for a
 * spreadsheet. */
export const saveCsv = (name: string, text: string) =>
  save(name, new Blob([`\uFEFF${text}`], { type: "text/csv" }));
/** A class's time export's address, for a range that may start on a given
 * day (`from`). */
export const timeCsvPath = (place: Place, period: TimePeriod, from?: string) =>
  `${CLASS(place)}/exports/time.csv?period=${period}${fromQuery(from)}`;
export const downloadGradebook = (
  session: Session,
  place: Place,
  term: string,
  columns: readonly GradebookColumn[],
) =>
  download(
    session,
    `${CLASS(place)}/exports/gradebook.csv?term=${term}&columns=${columns.join(",")}`,
  );
export const downloadOneRoster = (
  session: Session,
  place: Place,
  term: string,
) => download(session, `${CLASS(place)}/exports/oneroster.zip?term=${term}`);
export const downloadTime = (
  session: Session,
  place: Place,
  period: TimePeriod,
  from?: string,
) => download(session, timeCsvPath(place, period, from));
