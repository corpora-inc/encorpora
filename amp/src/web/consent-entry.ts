import { takeConsentChallenge } from "./consent-link";
// This module must be the first main entry import: consume sensitive fragments
// before the authentication module can initialize redirect handling.
let initial = takeConsentChallenge(window.location, window.history);
/** Entry routing can preserve the handoff without consuming its private proof. */
export function hasInitialConsentChallenge() {
  return initial !== null;
}
export function consumeInitialConsentChallenge() {
  const challenge = initial;
  initial = null;
  return challenge;
}
