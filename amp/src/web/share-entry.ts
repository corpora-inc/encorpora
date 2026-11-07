/** A family's link is `/p#<token>`. The first thing the app does is take the
 * token out of the address bar and history, before the router or anything else
 * can read the URL. It stays in this tab's session storage so a reload keeps
 * working, and it goes when the tab closes. Only `main.tsx` imports this for its
 * effect. */
const storageKey = "amp.family-link";
let held: string | null = null;

export function takeShareFragment(
  location: Pick<Location, "pathname" | "hash"> = window.location,
  history: Pick<History, "replaceState" | "state"> = window.history,
) {
  if (location.pathname !== "/p" || location.hash.length < 2) return;
  held = location.hash.slice(1);
  try {
    sessionStorage.setItem(storageKey, held);
  } catch (error) {
    console.warn("This link won’t survive a reload on this device", error);
  }
  history.replaceState(history.state, "", "/p");
}

/** The link this tab was opened with, if any. */
export function shareToken(): string | null {
  if (held) return held;
  try {
    return sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

/** Search engines stay away, and nothing downstream learns where a reader came
 * from. The server sends the same headers; a tag covers any other host. */
function keepPrivate(doc: Document) {
  for (const [name, content] of [
    ["robots", "noindex, nofollow"],
    ["referrer", "no-referrer"],
  ] as const) {
    const tag = doc.createElement("meta");
    tag.name = name;
    tag.content = content;
    doc.head.append(tag);
  }
}

if (typeof window !== "undefined" && window.location.pathname === "/p") {
  takeShareFragment();
  keepPrivate(document);
}
