import { familyPracticeState } from "../../../lib/family-practice-history";
import type { PracticeFilter } from "../../practice/curriculum-filter";
import { requestFetch } from "../../../lib/request-transport";
import { queryOptions } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import type { z } from "zod";
import {
  joinRosterResource,
  studentGrantResource,
  type SchoolPicture,
  type StudentGrant,
} from "../../../../schools/contracts";
import { notifyDeviceSessionChanged } from "../../../auth";
import { AppError } from "../../../lib/AppError";
import { meOptions, queryClient } from "../../../lib/query";
import { rememberStudentSession } from "../../../lib/student-device";

/** In a child's words: what happened, and what to do. */
const messages: Record<string, string> = {
  class_not_found: "That code didn’t work. Look at the board and try again.",
  class_locked:
    "Sign-in is paused for a few minutes. Ask your parent or teacher for help.",
  student_locked: "Ask your parent or teacher to reset your sign-in pictures.",
  wrong_pictures: "Try again",
  card_expired:
    "This card doesn’t work anymore. Ask your parent or teacher for a new one.",
  too_many_requests: "Too many tries right now. Wait a minute, then try again.",
  request_origin_invalid:
    "AMP can’t sign in from this address. Ask a grown-up for the link.",
};
const OFFLINE = "AMP can’t connect. Check the Wi-Fi, then try again.";
const UNAVAILABLE = "AMP isn’t answering right now. Try again in a minute.";
/** AMP answered and said no, for a reason this screen has no words for. */
const REFUSED = "AMP couldn’t open this. Ask a grown-up for help.";

/** What a failed answer means here: AMP answered, so only a 5xx (or a
 * garbled answer) is "isn't answering"; any other refusal says so. */
export const joinMessage = (status: number, code: string | null) =>
  (code && messages[code]) ?? (status >= 500 ? UNAVAILABLE : REFUSED);

export class JoinError extends AppError {
  constructor(
    message: string,
    retry: boolean,
    code: string | null,
    status: number | null,
    requestId: string | null,
    /** Seconds until this is worth trying again. */
    readonly retryAfter: number | null,
  ) {
    super(
      status === null
        ? "network"
        : status >= 500
          ? "unavailable"
          : "validation",
      message,
      retry,
      requestId,
      code,
      status,
    );
  }
}

/** Keep the child-specific error contract without sign-out recovery,
 * using the shared transport boundary for the request itself. */
async function post<T>(
  path: string,
  body: object,
  schema: z.ZodType<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await requestFetch(`/api/v1/school/join/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const failure = new JoinError(OFFLINE, true, null, null, null, null);
    failure.log();
    throw failure;
  }
  const data = (await response.json().catch((error) => {
    // In the entry bundle: logs itself (no lib/report-error chunk).
    console.warn("A join answer wasn’t JSON", error);
    return null;
  })) as {
    error?: unknown;
    retryAfter?: unknown;
  } | null;
  const requestId = response.headers.get("x-request-id");
  if (!response.ok) {
    const code = typeof data?.error === "string" ? data.error : null;
    const failure = new JoinError(
      joinMessage(response.status, code),
      response.status >= 500 || response.status === 429,
      code,
      response.status,
      requestId,
      typeof data?.retryAfter === "number" ? data.retryAfter : null,
    );
    failure.log();
    throw failure;
  }
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;
  const failure = new JoinError(UNAVAILABLE, true, null, 200, requestId, null);
  failure.log();
  throw failure;
}

export const joinRosterOptions = (code: string) =>
  queryOptions({
    queryKey: ["join", code],
    queryFn: () => post("lookup", { code }, joinRosterResource),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

export const signInWithPictures = (input: {
  code: string;
  personId: string;
  pictures: SchoolPicture[];
  set: boolean;
}) => post("picture", input, studentGrantResource);

export const signInWithCard = (token: string) =>
  post("card", { token }, studentGrantResource);

/** The app remounts for a new identity, including whichever sign-in screen is
 * up. A remounted screen checks this and keeps the wave going until practice
 * replaces it, rather than starting over. */
let finishing = false;
export const finishingSignIn = () => finishing;

/** Straight to the first problem. A class sign-in replaces the pictures.
 * A parent handoff preserves the curriculum entry for browser Back; the
 * child hands the parent's account back by signing out. */
export function useFinishSignIn() {
  const navigate = useNavigate();
  return useCallback(
    async (
      grant: StudentGrant,
      handed = false,
      returnTo?: string,
      filter?: PracticeFilter,
      learnerId?: string,
    ) => {
      const session = { accountId: grant.accountId, token: grant.token };
      finishing = true;
      rememberStudentSession(session, grant.mode, handed, returnTo);
      notifyDeviceSessionChanged(session);
      // The app remounts for a new identity, and that would cancel a `/me`
      // started during the move. Wait here, so practice opens with it in hand.
      await queryClient
        .fetchQuery(meOptions(session))
        .catch((error) =>
          console.warn("Practice will load `/me` itself", error),
        );
      try {
        await navigate({
          to: "/$",
          params: { _splat: "practice" },
          search: filter ?? {},
          replace: !handed,
          state:
            learnerId && returnTo
              ? familyPracticeState({ learnerId, returnTo })
              : undefined,
        });
      } finally {
        finishing = false;
      }
    },
    [navigate],
  );
}
