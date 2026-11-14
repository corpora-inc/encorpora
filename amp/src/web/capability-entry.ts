import { prepareSchoolAdoption } from "./features/school/adoption-session";
import { prepareBuyerHandoff } from "./features/school/pilots/buyer-session";

/**
 * Links that carry their own authority in the fragment (docs/architecture/
 * spaces.md, "Continuations"): a staff, co-teacher or second-parent
 * invitation (`/school/invite#…`), a parent's approval (`/family/approve#…`),
 * a buyer's link (`/schools/continue#token=…`) and an adoption
 * (`/school/adopt#token=…`). Before the router, or any return built from the
 * address, can read the URL, the secret moves out of the address bar and
 * history. Only `main.tsx` imports this for its effect; `/c` and
 * `/join/continue` have `card-entry.ts`, `/p` has `share-entry.ts`.
 *
 * An invitation or approval is held:
 * - in this page's memory first, so a storage failure never loses the link
 *   just opened, and never lets an older held one stand in for it;
 * - in this tab's `sessionStorage`, so a reload of the same tab keeps it,
 *   bound to this tab by `window.name` (a tab opened from this one starts
 *   with a copy of `sessionStorage` but its own name, and reads nothing);
 * - for two hours at most, and never past an account change, a student's
 *   session on this device, or the link being accepted or ended.
 */
const HELD: Record<HeldPath, string> = {
  "/school/invite": "amp.capability.invite",
  "/family/approve": "amp.capability.approval",
};
type HeldPath = "/school/invite" | "/family/approve";
export const HELD_FOR_MS = 2 * 60 * 60 * 1000;

type Place = Pick<Location, "pathname" | "search" | "hash">;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Tab = { name: string };
type Entry = { value: string; tab: string; until: number };

const session = (): Store | null => {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
};
const browserTab = (): Tab | null =>
  typeof window === "undefined" ? null : window;

const memory = new Map<HeldPath, string>();

/** This tab's own mark: kept across its reloads, never given to a tab it
 * opens. */
function tabMark(tab: Tab | null) {
  if (!tab) return "";
  if (!tab.name.startsWith("amp-tab-"))
    tab.name = `amp-tab-${Math.random().toString(36).slice(2, 12)}`;
  return tab.name;
}

export function takeCapabilityFragment(
  location: Place = window.location,
  history: Pick<History, "replaceState" | "state"> = window.history,
  store: Store | null = session(),
  tab: Tab | null = browserTab(),
  now = Date.now(),
) {
  const path = (location.pathname.replace(/\/+$/, "") || "/") as HeldPath;
  const key = HELD[path];
  if (!key || location.hash.length < 2) return;
  const value = location.hash.slice(1);
  // Memory first: whatever storage does, this is the link just opened.
  memory.set(path, value);
  try {
    store?.setItem(
      key,
      JSON.stringify({
        value,
        tab: tabMark(tab),
        until: now + HELD_FOR_MS,
      } satisfies Entry),
    );
  } catch (error) {
    console.warn("The link couldn’t be kept for a reload of this tab", error);
    // An older held link must never stand in for this one.
    try {
      store?.removeItem(key);
    } catch {
      // Memory holds the link for this page.
    }
  }
  history.replaceState(history.state, "", location.pathname + location.search);
}

/** The invitation or approval this tab opened, without its leading `#`. */
export function heldCapability(
  path: HeldPath,
  store: Store | null = session(),
  tab: Tab | null = browserTab(),
  now = Date.now(),
): string | null {
  const kept = memory.get(path);
  if (kept) return kept;
  try {
    const raw = store?.getItem(HELD[path]);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<Entry>;
    if (
      typeof entry.value !== "string" ||
      typeof entry.until !== "number" ||
      entry.until <= now ||
      !tab ||
      entry.tab !== tab.name
    ) {
      store?.removeItem(HELD[path]);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

/** Done with it: accepted, declined, or ended. */
export function dropCapability(
  path: HeldPath,
  store: Store | null = session(),
) {
  memory.delete(path);
  try {
    store?.removeItem(HELD[path]);
  } catch {
    // Nothing was held.
  }
}

/** Every held link goes: another account signed in or out, or a student's
 * session began or ended on this device. */
export function dropAllCapabilities(store: Store | null = session()) {
  for (const path of Object.keys(HELD) as HeldPath[])
    dropCapability(path, store);
}

if (typeof window !== "undefined") {
  takeCapabilityFragment();
  if (window.location.pathname.startsWith("/school/adopt"))
    prepareSchoolAdoption();
  if (window.location.pathname.startsWith("/schools/continue"))
    prepareBuyerHandoff();
}
