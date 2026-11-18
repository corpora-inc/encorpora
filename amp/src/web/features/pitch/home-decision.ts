import { fetchAuthConfig } from "../../auth-config";
import { hasInitialConsentChallenge } from "../../consent-entry";
import { signedInHint } from "../../lib/session-hint";
import { studentSession } from "../../lib/student-device";
import { nativeRuntime } from "../../native-runtime";
import { hasPurchaseReturn } from "../../purchase-return";
import { showsPitch } from "./shows-pitch";

function providerHint() {
  try {
    return /(?:^|;\s*)amp\.provider=1(?:;|$)/.test(document.cookie);
  } catch (error) {
    console.warn("Cookies are unreadable; no provider sign-in hint", error);
    return false;
  }
}

/**
 * Whether `/` could be the pitch, before any answer from the API: the light
 * home entry (`home-entry.tsx`) paints it only then. A returning account, a
 * school or student sign-in, an external sign-in provider, an email's consent
 * link, a payment return, a sign-in link or a provider's return from one go
 * straight to the app, which
 * decides `/` as it always has (`app/router.tsx`, `home`).
 */
export function mayShowPitch(search: Record<string, unknown>): boolean {
  return (
    location.pathname === "/" &&
    !nativeRuntime &&
    // An external sign-in provider built into this deployment.
    !(
      import.meta.env.VITE_AMP_AUTHORITY && import.meta.env.VITE_AMP_CLIENT_ID
    ) &&
    !signedInHint() &&
    !studentSession() &&
    !providerHint() &&
    !location.hash.includes("clever-session") &&
    !hasInitialConsentChallenge() &&
    !hasPurchaseReturn(location.search) &&
    !("sign-in" in search) &&
    // A provider's sign-in coming back.
    !("signed-in" in search) &&
    !("reset-password" in search)
  );
}

/**
 * No one is signed in on this browser: AMP's own session endpoint answers
 * that no one is. These are the two answers the home document preloads
 * (`scripts/build-home-document.ts`), asked as the app asks them, so each
 * preload is used once. The sign-in configuration only rules out a
 * deployment that signs in elsewhere: when it doesn't load, the session's
 * answer decides (its endpoint exists only with AMP's own accounts), so the
 * pitch never waits on the sign-in methods, which only the sign-in screens
 * need (and retry). A session that can't be read is the app's to decide.
 */
export async function signedOutVisitor(): Promise<boolean> {
  const [config, session] = await Promise.all([
    fetchAuthConfig().catch((error: unknown) => {
      console.warn("`/` decides without the sign-in configuration", error);
      return null;
    }),
    fetch("/api/auth/get-session", {
      credentials: "include",
      signal: AbortSignal.timeout(10000),
    }).then((response) => (response.ok ? response.json() : undefined)),
  ]);
  return (
    (config === null || config.mode === "accounts") &&
    session === null &&
    showsPitch(null)
  );
}
