import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { meOptions, sessionOptions } from "../../lib/query";
import { familyOptions } from "../family/api";
import {
  childAddress,
  learningIdentity,
  type AddressedIdentity,
} from "./identity";

/**
 * The learner or profile the displayed screen's address names, with self
 * filled in (an unnamed shared learning screen is the adult's own): the
 * committed location (the screen on view), never one still loading, so the
 * screen, its frame and practice change person only when the new screen
 * shows.
 */
export function useAddressedIdentity(): AddressedIdentity | null {
  const session = useQuery(sessionOptions).data ?? null;
  const me = useQuery({
    ...meOptions(session ?? { accountId: "", token: "" }),
    enabled: !!session,
  }).data;
  const own =
    me?.signedIn && me.account.id === session?.accountId
      ? (me.adultPractice?.learner?.id ?? null)
      : null;
  const key = useRouterState({
    select: (state) => {
      // The displayed route's own pathname and search (the same snapshot
      // the shell reads: useSettledMatch), never the address still loading.
      const leaf = state.matches.at(-1);
      const shown =
        leaf && leaf.status === "success"
          ? { pathname: leaf.pathname, search: leaf.search }
          : (state.resolvedLocation ?? state.location);
      const found = learningIdentity(
        shown.pathname,
        shown.search as Record<string, unknown>,
        own,
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

/**
 * Whether the displayed screen may read its learner's records: always, unless
 * its address is a family's child (`/family/<family>/kids/<learner>/…`). Then
 * only when that family's own projection holds the child and lets this
 * reader read their progress, the decision the family screens make, so a
 * screen never asks for a child its family doesn't show (CP-5 #6).
 */
export function useAddressedRecordsReadable(): boolean {
  const session = useQuery(sessionOptions).data ?? null;
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
    enabled: !!session && !!child,
  });
  if (!child) return true;
  return !!family.data?.children.find((entry) => entry.id === child.learner)
    ?.capabilities.readProgress;
}
