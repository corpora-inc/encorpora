import { acknowledgeConsentSchema } from "../parent-consent/contracts.js";
export type ConsentChallenge = {
  requestId: string;
  stage: "initial" | "confirmation";
  token: string;
  noticeDigest: string;
};
/** Call before authentication or analytics initialization. Keep the returned
 * challenge in memory only; after an external sign-in, reopen the email link. */
export function takeConsentChallenge(
  location: Pick<Location, "hash" | "pathname" | "search">,
  history: Pick<History, "replaceState">,
): ConsentChallenge | null {
  const q = new URLSearchParams(location.hash.slice(1));
  if (!q.has("consent")) return null;
  history.replaceState({}, "", location.pathname + location.search);
  const parsed = acknowledgeConsentSchema.safeParse({
    requestId: q.get("consent"),
    stage: q.get("stage"),
    token: q.get("token"),
    noticeDigest: q.get("notice"),
    parentAttestation: true,
  });
  if (!parsed.success) return null;
  const { parentAttestation: _ignored, ...challenge } = parsed.data;
  return challenge;
}
