/** A printed card's link is `/c#<token>`. The first thing the app does is take
 * the token out of the address bar and history, before the router or anything
 * else can read the URL. Only `main.tsx` imports this for its effect. */
let taken: string | null = null;

export function takeCardFragment(
  location: Pick<Location, "pathname" | "hash"> = window.location,
  history: Pick<History, "replaceState" | "state"> = window.history,
) {
  if (location.pathname !== "/c" || location.hash.length < 2) return;
  taken = location.hash.slice(1);
  history.replaceState(history.state, "", "/c");
}
takeCardFragment();

/** The token, once. */
export function claimCardToken() {
  const token = taken;
  taken = null;
  return token;
}

/** Back from a school account's sign-in: `/join/continue#<grant>`. The same rule:
 * it's out of the address bar and history before anything else reads the URL. */
let grant: string | null = null;
export function takeGrantFragment(
  location: Pick<Location, "pathname" | "hash"> = window.location,
  history: Pick<History, "replaceState" | "state"> = window.history,
) {
  if (location.pathname !== "/join/continue" || location.hash.length < 2)
    return;
  grant = location.hash.slice(1);
  history.replaceState(history.state, "", "/join/continue");
}
takeGrantFragment();

/** The grant, once. */
export function claimGrant() {
  const held = grant;
  grant = null;
  return held;
}
