import type { AuthSession } from "../../auth";
import { hasInitialConsentChallenge } from "../../consent-entry";
import { nativeRuntime } from "../../native-runtime";
import { hasPurchaseReturn } from "../../purchase-return";

/** A signed-out web visitor at `/` meets the parent pitch. A consent email
 * or a payment return opened signed out keeps the app's sign-in prompt,
 * which resumes it. Shared by the router's `/` and the light home entry. */
export function showsPitch(session: AuthSession | null | undefined) {
  return (
    !nativeRuntime &&
    session === null &&
    !hasInitialConsentChallenge() &&
    !hasPurchaseReturn(window.location.search)
  );
}
