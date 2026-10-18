import { useEffect } from "react";
/** Log only the displayed explanation; never request bodies, tokens, or URLs. */
export function useLoggedError(message: string) {
  useEffect(() => {
    if (message) console.error("AMP action failed:", message);
  }, [message]);
}
export function requestMessage(code: string, action: string): string {
  const messages: Record<string, string> = {
    consent_required:
      "Parent consent is required. Continue setup to review the learning notice.",
    parental_consent_required:
      "Parent consent is required. Continue setup to review the learning notice.",
    license_required:
      "This learner needs access. Choose an AMP plan to continue.",
    sign_in_required: "Your session ended. Sign in again to continue.",
    invalid_family_request: "Check the learner’s name and try again.",
    learner_not_found:
      "This learner is no longer available. Refresh your family details.",
  };
  return (
    messages[code] ?? `${action} failed. Check your connection and try again.`
  );
}
