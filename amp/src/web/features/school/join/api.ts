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
import { notifyAccountSessionChanged } from "../../../auth";
import { AppError } from "../../../lib/AppError";
import { meOptions, queryClient } from "../../../lib/query";
import { rememberStudentSession } from "../../../lib/student-device";

/** In a child's words: what happened, and what to do. */
const messages: Record<string, string> = {
  class_not_found: "That code didn’t work. Look at the board and try again.",
  class_locked: "This class is paused for a few minutes. Ask your teacher.",
  student_locked: "Ask your teacher",
  wrong_pictures: "Try again",
  card_expired:
    "This card doesn’t work anymore. Ask your teacher for a new one.",
  too_many_requests: "Too many tries right now. Wait a minute, then try again.",
};
const OFFLINE = "AMP can’t connect. Check the Wi-Fi, then try again.";
const UNAVAILABLE = "AMP isn’t answering right now. Try again in a minute.";

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

/** These answer with what went wrong, not a sign-in that ended, so they don't
 * go through the shared `request` and its redirect to sign-in. */
async function post<T>(
  path: string,
  body: object,
  schema: z.ZodType<T>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/school/join/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    const failure = new JoinError(OFFLINE, true, null, null, null, null);
    failure.log();
    throw failure;
  }
  const data = (await response.json().catch(() => null)) as {
    error?: unknown;
    retryAfter?: unknown;
  } | null;
  const requestId = response.headers.get("x-request-id");
  if (!response.ok) {
    const code = typeof data?.error === "string" ? data.error : null;
    const failure = new JoinError(
      (code && messages[code]) ?? UNAVAILABLE,
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

/** Straight to the first problem. `replace`: Back goes to the class, not to
 * the pictures that just worked. `handed`: a parent gave their own device to
 * their child, who hands it back by signing out. */
export function useFinishSignIn() {
  const navigate = useNavigate();
  return useCallback(
    async (grant: StudentGrant, handed = false, returnTo?: string) => {
      const session = { accountId: grant.accountId, token: grant.token };
      finishing = true;
      rememberStudentSession(session, grant.mode, handed, returnTo);
      notifyAccountSessionChanged(session);
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
          replace: true,
        });
      } finally {
        finishing = false;
      }
    },
    [navigate],
  );
}
