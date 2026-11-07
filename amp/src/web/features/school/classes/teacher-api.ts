import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { z } from "zod";
import {
  evidenceResponse,
  gradebookResponse,
  mapResponse,
  reportCardsResponse,
  studentRecordResponse,
  studentTimeResponse,
  timeResponse,
  todayResponse,
  type EvidenceResponse,
  type GradebookResponse,
  type GradebookColumn,
  type TimePeriod,
} from "../../../../schools/teacher-contracts";
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
export const timeOptions = (
  session: Session,
  place: Place,
  period: TimePeriod,
) =>
  queryOptions({
    queryKey: [...classKey(session, place), "time", period],
    enabled: !!session,
    placeholderData: keepPreviousData,
    queryFn: read(
      session,
      `${CLASS(place)}/time?period=${period}`,
      timeResponse,
    ),
  });
export const studentTimeOptions = (
  session: Session,
  place: Place,
  period: TimePeriod,
  student: string,
) =>
  queryOptions({
    queryKey: [...classKey(session, place), "student-time", period, student],
    enabled: !!session,
    queryFn: read(
      session,
      `${CLASS(place)}/students/${student}/time?period=${period}`,
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

/** A file from the server, carrying the sign-in a plain link couldn't. */
async function download(session: Session, path: string): Promise<string> {
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
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
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
) => download(session, `${CLASS(place)}/exports/time.csv?period=${period}`);
