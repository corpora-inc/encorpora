import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { meOptions, sessionOptions } from "../../lib/query";
import { learningIdentity, type AddressedIdentity } from "./identity";

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
