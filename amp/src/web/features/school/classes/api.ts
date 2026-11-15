import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { keepRefusal } from "../../../lib/AppError";
import {
  issuedCardsResource,
  orgResource,
  presenceResource,
  signInRosterResource,
} from "../../../../schools/contracts";
import type { AuthSession } from "../../../auth";
import { request } from "../../../lib/api";
import { sessionOptions } from "../../../lib/query";

type Place = { org: string; class: string };
const classPath = ({ class: id }: Place) => `/school/classes/${id}`;
type Session = AuthSession | null;
const key = (session: Session, place: Place, leaf: string) =>
  [
    "account",
    session?.accountId,
    "school",
    place.org,
    place.class,
    leaf,
  ] as const;

/** The staff member's session. The router's guard required one on the way in;
 * if it ends here (another tab signed out), this leaves for sign-in. */
export function useStaffSession() {
  const session = useQuery(sessionOptions);
  const navigate = useNavigate();
  const ended = session.isSuccess && !session.data;
  useEffect(() => {
    if (ended) void navigate({ to: "/sign-in" });
  }, [ended, navigate]);
  return session.data ?? null;
}

export const presenceOptions = (session: Session, place: Place) => {
  const queryKey = key(session, place, "presence");
  return queryOptions({
    queryKey,
    enabled: !!session,
    // A refusal stands until a successful read (CP-3 r8): a later 503
    // never brings back the code and names it cleared.
    queryFn: ({ signal }) =>
      keepRefusal(queryKey, () =>
        request(`${classPath(place)}/presence`, presenceResource, {
          token: session?.token,
          signal,
        }),
      ),
  });
};
export const rosterOptions = (session: Session, place: Place) =>
  queryOptions({
    queryKey: key(session, place, "roster"),
    enabled: !!session,
    queryFn: ({ signal }) =>
      request(`${classPath(place)}/roster`, signInRosterResource, {
        token: session?.token,
        signal,
      }),
  });
export const orgOptions = (session: Session, org: string) =>
  queryOptions({
    queryKey: ["account", session?.accountId, "school", org, "org"],
    enabled: !!session,
    queryFn: ({ signal }) =>
      request(
        `/school/orgs/${org}`,
        z.object({ org: orgResource.nullable() }),
        { token: session?.token, signal },
      ),
    staleTime: 60_000,
  });
export const classListOptions = (session: Session, org: string) =>
  queryOptions({
    queryKey: ["account", session?.accountId, "school", org, "classes"],
    enabled: !!session,
    queryFn: ({ signal }) =>
      request(
        `/school/orgs/${org}/classes`,
        z.object({
          classes: z.array(z.object({ id: z.uuid(), name: z.string() })),
        }),
        { token: session?.token, signal },
      ),
    staleTime: 60_000,
  });

/** One store: whatever changes sign-in refreshes the roster and the board. */
function useClassMutation<Input, Output>(
  session: Session,
  place: Place,
  send: (token: string, input: Input) => Promise<Output>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => send(session?.token ?? "", input),
    onSettled: async () => {
      if (!session) return;
      await Promise.all(
        ["roster", "presence"].map((leaf) =>
          client.invalidateQueries({ queryKey: key(session, place, leaf) }),
        ),
      );
    },
  });
}
/** A new class code. Besides the roster and the board, every list that
 * shows the code (class Settings, the org's classes) refreshes. */
export function useRotateCode(session: Session, place: Place) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      request(
        `${classPath(place)}/rotate-code`,
        z.object({ joinCode: z.string() }),
        { token: session?.token ?? "", body: {} },
      ),
    onSettled: async () => {
      if (!session) return;
      const account = ["account", session.accountId, "school"];
      await Promise.all(
        [
          key(session, place, "roster"),
          key(session, place, "presence"),
          [...account, place.org, "classes"],
          [...account, "org", place.org, "classes"],
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
    },
  });
}
export const useResetPictures = (session: Session, place: Place) =>
  useClassMutation(session, place, (token, person: string) =>
    request(
      `${classPath(place)}/students/${person}/reset-pictures`,
      z.object({ reset: z.boolean() }),
      { token, body: {} },
    ),
  );
export const useRevokeSessions = (session: Session, place: Place) =>
  useClassMutation(session, place, (token, person: string) =>
    request(
      `${classPath(place)}/students/${person}/revoke-sessions`,
      z.object({ revoked: z.number() }),
      { token, body: {} },
    ),
  );
export const useIssueCards = (session: Session, place: Place) =>
  useClassMutation(
    session,
    place,
    (token, input: { personIds?: string[]; missingOnly?: boolean }) =>
      request(`${classPath(place)}/cards`, issuedCardsResource, {
        token,
        body: input,
      }),
  );
