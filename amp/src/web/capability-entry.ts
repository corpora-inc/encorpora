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
 * An invitation or approval is held in this page's memory only, for two
 * hours at most. Nothing is written where another tab, or a later page, could
 * read it: a tab opened from this one, or this one reloaded, has nothing
 * held, and opens the link from the email again. The one deliberate carry is
 * a sign-in the person starts from the link (the screens' own
 * `rememberInvite`/`rememberApproval`), which `forgetEveryLink` clears.
 */
type HeldPath = "/school/invite" | "/family/approve";
const PATHS: readonly HeldPath[] = ["/school/invite", "/family/approve"];
export const HELD_FOR_MS = 2 * 60 * 60 * 1000;
/** Where an earlier version kept them: removed whenever a link is taken. */
const RETIRED_KEYS = ["amp.capability.invite", "amp.capability.approval"];

type Place = Pick<Location, "pathname" | "search" | "hash">;
const memory = new Map<HeldPath, { value: string; until: number }>();

export function takeCapabilityFragment(
  location: Place = window.location,
  history: Pick<History, "replaceState" | "state"> = window.history,
  now = Date.now(),
) {
  const path = (location.pathname.replace(/\/+$/, "") || "/") as HeldPath;
  if (!PATHS.includes(path) || location.hash.length < 2) return;
  memory.set(path, { value: location.hash.slice(1), until: now + HELD_FOR_MS });
  try {
    for (const key of RETIRED_KEYS) sessionStorage.removeItem(key);
  } catch {
    // Nothing kept there, then.
  }
  history.replaceState(history.state, "", location.pathname + location.search);
}

/** The invitation or approval this page opened, without its leading `#`. */
export function heldCapability(
  path: HeldPath,
  now = Date.now(),
): string | null {
  const held = memory.get(path);
  if (!held) return null;
  if (held.until <= now) {
    memory.delete(path);
    return null;
  }
  return held.value;
}

/** Done with it: accepted, refused, ended or expired. */
export function dropCapability(path: HeldPath) {
  memory.delete(path);
}

/** Every link this page holds goes (`forgetEveryLink` also clears the
 * screens' sign-in carry). */
export function dropAllCapabilities() {
  memory.clear();
}

if (typeof window !== "undefined") {
  takeCapabilityFragment();
  if (window.location.pathname.startsWith("/school/adopt"))
    prepareSchoolAdoption();
  if (window.location.pathname.startsWith("/schools/continue"))
    prepareBuyerHandoff();
}
