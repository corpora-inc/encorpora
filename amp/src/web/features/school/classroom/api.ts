import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  experienceResource,
  marksResource,
  savedMarksResource,
  stackResource,
  standingsBoardResource,
  standingsBoardsResource,
  type Experience,
  type ExperienceKey,
  type PaperMark,
} from "../../../../schools/classroom-contracts";
import type { AuthSession } from "../../../auth";
import { request } from "../../../lib/api";
import { AppError } from "../../../lib/AppError";

type Session = AuthSession | null;
export type ExperienceScope = { kind: "org" | "class"; id: string };
const key = (session: Session, ...rest: unknown[]) =>
  ["account", session?.accountId, "school", "classroom", ...rest] as const;

/** What a failed classroom action means, and what to do about it. */
const messages: Record<string, string> = {
  setting_locked:
    "A level above just locked this, so it can’t be changed here. It now shows who set it.",
  needs_seat: "This student needs a seat first. Add seats on the License page.",
  workbook_date: "Workbooks can be made for today through a week ahead.",
  workbook_stale:
    "Some problems in this workbook have changed since it was printed. Print a new set for this student.",
  workbook_renderer_unavailable:
    "The print service is busy. Try again in a moment.",
  agreement_required:
    "Your school’s data agreement has ended. Ask your school’s admin to renew it.",
  not_found:
    "This isn’t open to your account. Check the link, or ask your school’s admin.",
};
/** What happened and what to do: `fallback` names the action that failed. */
export function say(error: unknown, fallback: string) {
  if (error instanceof AppError) {
    if (error.code && messages[error.code]) return messages[error.code]!;
    if (error.kind === "network")
      return `${fallback} Check your connection and try again.`;
    if (error.message) return `${fallback} ${error.message}`;
  }
  return `${fallback} Try again in a moment.`;
}

const experiencePath = ({ kind, id }: ExperienceScope) =>
  kind === "org"
    ? `/school/orgs/${id}/experience`
    : `/school/classes/${id}/experience`;
export const experienceOptions = (session: Session, scope: ExperienceScope) =>
  queryOptions({
    queryKey: key(session, "experience", scope.kind, scope.id),
    enabled: !!session,
    queryFn: ({ signal }) =>
      request(experiencePath(scope), experienceResource, {
        token: session?.token,
        signal,
      }),
  });

export type ExperienceWrite = {
  values?: Partial<Record<ExperienceKey, string | null>>;
  locks?: Partial<Record<ExperienceKey, boolean>>;
};
/** The screen shows a choice the moment it's made, and returns to what the
 * server has if it's refused. Every other scope below re-reads. */
export function useExperienceWrite(session: Session, scope: ExperienceScope) {
  const client = useQueryClient();
  const queryKey = experienceOptions(session, scope).queryKey;
  return useMutation({
    mutationFn: (body: ExperienceWrite) =>
      request(experiencePath(scope), experienceResource, {
        token: session?.token,
        body,
      }),
    onMutate: async (body) => {
      await client.cancelQueries({ queryKey });
      const before = client.getQueryData<Experience>(queryKey);
      if (before) {
        const settings = { ...before.settings } as Record<
          ExperienceKey,
          Experience["settings"][ExperienceKey]
        >;
        for (const [name, value] of Object.entries(body.values ?? {})) {
          const entry = name as ExperienceKey;
          settings[entry] = {
            ...settings[entry],
            value: (value ?? settings[entry].inherited.value) as never,
            own: value !== null,
          } as never;
        }
        client.setQueryData(queryKey, {
          ...before,
          settings: settings as Experience["settings"],
        });
      }
      return { before };
    },
    onError: (_error, _body, context) => {
      if (context?.before) client.setQueryData(queryKey, context.before);
    },
    onSuccess: (saved) => client.setQueryData(queryKey, saved),
    onSettled: () =>
      client.invalidateQueries({ queryKey: key(session, "experience") }),
  });
}
export function useLeaveOff(session: Session, classId: string) {
  const client = useQueryClient();
  const queryKey = experienceOptions(session, {
    kind: "class",
    id: classId,
  }).queryKey;
  return useMutation({
    mutationFn: ({ id, leftOff }: { id: string; leftOff: boolean }) =>
      request(
        `/school/classes/${classId}/students/${id}/standings`,
        experienceResource,
        { token: session?.token, body: { leftOff } },
      ),
    onMutate: async ({ id, leftOff }) => {
      await client.cancelQueries({ queryKey });
      const before = client.getQueryData<Experience>(queryKey);
      if (before)
        client.setQueryData(queryKey, {
          ...before,
          students: before.students?.map((student) =>
            student.id === id ? { ...student, leftOff } : student,
          ),
        });
      return { before };
    },
    onError: (_error, _body, context) => {
      if (context?.before) client.setQueryData(queryKey, context.before);
    },
    onSuccess: (saved) => client.setQueryData(queryKey, saved),
  });
}

/** A teacher's own line on this class's map and board. The map reads it too,
 * so it refreshes with the settings. */
export function useTeacherShown(session: Session, classId: string) {
  const client = useQueryClient();
  const queryKey = experienceOptions(session, {
    kind: "class",
    id: classId,
  }).queryKey;
  return useMutation({
    mutationFn: (shown: boolean) =>
      request(`/school/classes/${classId}/experience/me`, experienceResource, {
        token: session?.token,
        body: { shown },
      }),
    onMutate: async (shown) => {
      await client.cancelQueries({ queryKey });
      const before = client.getQueryData<Experience>(queryKey);
      if (before?.teacherLine)
        client.setQueryData(queryKey, { ...before, teacherLine: { shown } });
      return { before };
    },
    onError: (_error, _shown, context) => {
      if (context?.before) client.setQueryData(queryKey, context.before);
    },
    onSuccess: (saved) => client.setQueryData(queryKey, saved),
    onSettled: () =>
      client.invalidateQueries({
        predicate: ({ queryKey: key }) =>
          key[0] === "account" &&
          key[1] === session?.accountId &&
          key[2] === "school" &&
          key[4] === classId &&
          key[5] === "map",
      }),
  });
}

export const stackOptions = (
  session: Session,
  classId: string,
  skill?: string,
) =>
  queryOptions({
    queryKey: key(session, "stack", classId, skill ?? null),
    enabled: !!session,
    queryFn: ({ signal }) =>
      request(
        `/school/classes/${classId}/workbooks${skill ? `?skill=${encodeURIComponent(skill)}` : ""}`,
        stackResource,
        { token: session?.token, signal },
      ),
  });
export const invalidateStack = (
  client: ReturnType<typeof useQueryClient>,
  session: Session,
) => client.invalidateQueries({ queryKey: key(session, "stack") });

export const marksOptions = (
  session: Session,
  classId: string,
  date: string,
  set?: number,
) =>
  queryOptions({
    queryKey: key(session, "marks", classId, date, set ?? null),
    enabled: !!session,
    queryFn: ({ signal }) =>
      request(
        `/school/classes/${classId}/workbooks/marks?date=${date}${set ? `&set=${set}` : ""}`,
        marksResource,
        { token: session?.token, signal },
      ),
  });
export function saveMarks(
  session: Session,
  classId: string,
  studentId: string,
  workbookId: string,
  entries: { n: number; mark: PaperMark }[],
) {
  return request(
    `/school/classes/${classId}/students/${studentId}/workbooks/${workbookId}/marks`,
    savedMarksResource,
    { token: session?.token, body: { entries } },
  );
}

export const standingsBoardsOptions = (session: Session) =>
  queryOptions({
    queryKey: key(session, "standings"),
    enabled: !!session,
    queryFn: ({ signal }) =>
      request("/school/student/standings", standingsBoardsResource, {
        token: session?.token,
        signal,
      }),
  });
export const standingsBoardOptions = (session: Session, classId: string) =>
  queryOptions({
    queryKey: key(session, "standings", classId),
    enabled: !!session,
    queryFn: ({ signal }) =>
      request(`/school/student/standings/${classId}`, standingsBoardResource, {
        token: session?.token,
        signal,
      }),
    staleTime: 30_000,
  });
