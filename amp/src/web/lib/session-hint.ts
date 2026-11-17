/**
 * Whether this browser's last session check found someone signed in. Only a
 * hint, for speed: `/` (the light home entry, `home-entry.tsx`) starts the
 * whole app at once for a returning account instead of first asking whether
 * to show the pitch. The session check itself always decides; a wrong or
 * missing hint costs a moment, never a wrong screen.
 */
const key = "amp.signed-in";

export function noteSignedIn(signedIn: boolean) {
  try {
    if (signedIn) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch (error) {
    // Storage can be refused (some in-app browsers); `/` then asks first.
    console.warn("AMP: the signed-in hint wasn’t kept", error);
  }
}

export function signedInHint(): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch (error) {
    console.warn("AMP: the signed-in hint wasn’t read", error);
    return false;
  }
}
