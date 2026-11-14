import { prepareSchoolAdoption } from "./features/school/adoption-session";
import { prepareBuyerHandoff } from "./features/school/pilots/buyer-session";

/**
 * Links that carry their own authority in the fragment (docs/architecture/
 * spaces.md, "Continuations"): a staff, co-teacher or second-parent
 * invitation (`/school/invite#…`), a parent's approval (`/family/approve#…`),
 * a buyer's link (`/schools/continue#token=…`) and an adoption
 * (`/school/adopt#token=…`). Before the router, or any return built from the
 * address, can read the URL, the secret moves to this tab's own store and
 * leaves the address bar and history. Only `main.tsx` imports this for its
 * effect; `/c` and `/join/continue` have `card-entry.ts`, `/p` has
 * `share-entry.ts`.
 */
const HELD: Record<string, string> = {
  "/school/invite": "amp.capability.invite",
  "/family/approve": "amp.capability.approval",
};

type Place = Pick<Location, "pathname" | "search" | "hash">;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const session = (): Store | null => {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
};

export function takeCapabilityFragment(
  location: Place = window.location,
  history: Pick<History, "replaceState" | "state"> = window.history,
  store: Store | null = session(),
) {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const key = HELD[path];
  if (!key || location.hash.length < 2) return;
  try {
    store?.setItem(key, location.hash.slice(1));
  } catch (error) {
    console.warn("The link's secret couldn’t be held for this tab", error);
  }
  history.replaceState(history.state, "", location.pathname + location.search);
}

/** The invitation or approval this tab opened, without its leading `#`. */
export function heldCapability(
  path: "/school/invite" | "/family/approve",
  store: Store | null = session(),
): string | null {
  try {
    return store?.getItem(HELD[path]!) ?? null;
  } catch {
    return null;
  }
}

/** Done with it: accepted, declined, or replaced. */
export function dropCapability(
  path: "/school/invite" | "/family/approve",
  store: Store | null = session(),
) {
  try {
    store?.removeItem(HELD[path]!);
  } catch {
    // Nothing was held.
  }
}

if (typeof window !== "undefined") {
  takeCapabilityFragment();
  if (window.location.pathname.startsWith("/school/adopt"))
    prepareSchoolAdoption();
  if (window.location.pathname.startsWith("/schools/continue"))
    prepareBuyerHandoff();
}
