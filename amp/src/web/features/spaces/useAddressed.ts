import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import type { Me } from "../../../account/contracts";
import type { AuthSession } from "../../auth";
import { meKey, meOptions, queryClient, sessionOptions } from "../../lib/query";
import { forSession, useSessionOrNull } from "../../lib/session";
import { familyOptions } from "../family/api";
import { currentLearner, useCurrentLearner } from "../../learner-store";
import {
  childAddress,
  learningIdentity,
  selfOf,
  type AddressedIdentity,
} from "./identity";

/** The displayed route's own pathname and search (the same snapshot the
 * shell reads: useSettledMatch), never the address still loading. */
type ShownState = {
  matches: { status: string; pathname: string; search: unknown }[];
  location: { pathname: string; search: unknown };
  resolvedLocation?: { pathname: string; search: unknown };
};
function shownLocation(state: ShownState) {
  const leaf = state.matches.at(-1);
  return leaf && leaf.status === "success"
    ? { pathname: leaf.pathname, search: leaf.search }
    : (state.resolvedLocation ?? state.location);
}
/** This session's `/me`, never another account's. */
function accountOf(session: AuthSession | null, me: Me | undefined) {
  return me?.signedIn && me.account.id === session?.accountId ? me : null;
}

/**
 * The learner or profile the displayed screen's address names, with self
 * filled in (an unnamed shared learning screen is the adult's own): the
 * committed location (the screen on view), never one still loading, so the
 * screen, its frame and practice change person only when the new screen
 * shows.
 */
export function useAddressedIdentity(): AddressedIdentity | null {
  const session = useSessionOrNull();
  const me = useQuery(forSession(session, meOptions)).data;
  const account = accountOf(session, me);
  // Self: the profile being practiced as, else the adult's own (selfOf).
  const self = selfOf(account, useCurrentLearner());
  const selfKey = self ? `${self.kind}:${self.id}` : "";
  const key = useRouterState({
    select: (state) => {
      const shown = shownLocation(state);
      const found = learningIdentity(
        shown.pathname,
        shown.search as Record<string, unknown>,
        selfKey ? self : null,
        account,
      );
      return found ? `${found.kind}:${found.id}` : "";
    },
  });
  if (!key) return null;
  const at = key.indexOf(":");
  return {
    kind: key.slice(0, at) as AddressedIdentity["kind"],
    id: key.slice(at + 1),
  };
}

/** `useAddressedIdentity`'s answer outside render (work finishing later
 * asks whose screen is on view now), from the same canonical sources: the
 * router's state and the Query cache. */
export function addressedIdentityNow(
  state: ShownState,
): AddressedIdentity | null {
  const session =
    queryClient.getQueryData<AuthSession | null>(sessionOptions.queryKey) ??
    null;
  const me = session
    ? queryClient.getQueryData<Me>(meKey(session.accountId))
    : undefined;
  const shown = shownLocation(state);
  const account = accountOf(session, me);
  return learningIdentity(
    shown.pathname,
    shown.search as Record<string, unknown>,
    selfOf(account, session ? currentLearner(session.accountId) : null),
    account,
  );
}

/**
 * Whether the displayed screen may read its learner's records: always, unless
 * its address is a family's child (`/family/<family>/kids/<learner>/…`). Then
 * only when that family's own projection holds the child and lets this
 * reader read their progress, the decision the family screens make, so a
 * screen never asks for a child its family doesn't show (CP-5 #6).
 */
export function useAddressedRecordsReadable(): boolean {
  const session = useSessionOrNull();
  const pathname = useRouterState({
    select: (state) => {
      const leaf = state.matches.at(-1);
      return leaf && leaf.status === "success"
        ? leaf.pathname
        : (state.resolvedLocation ?? state.location).pathname;
    },
  });
  const child = childAddress(pathname);
  const family = useQuery({
    ...familyOptions(
      session ?? { accountId: "", token: "" },
      child?.family ?? "",
    ),
  });
  if (!child) return true;
  return !!family.data?.children.find((entry) => entry.id === child.learner)
    ?.capabilities.readProgress;
}
