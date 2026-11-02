import { takeConsentChallenge, type ConsentChallenge } from "./consent-link";
// This module must be the first main entry import: consume sensitive fragments
// before the authentication module can initialize redirect handling.
let initial = takeConsentChallenge(window.location, window.history);
let owner: string | null = null;
/** Entry routing can preserve the handoff without consuming its private proof. */
export function hasInitialConsentChallenge() {
  return initial !== null;
}
/** Keep an explicit email entry in memory until its destination can consume it. */
export function rememberConsentChallenge(
  challenge: ConsentChallenge,
  identity: string | null,
) {
  initial = challenge;
  owner = identity;
}
export function claimInitialConsentChallenge(identity: string) {
  if (!identity || !initial || (owner !== null && owner !== identity))
    return false;
  owner = identity;
  return true;
}
export function clearInitialConsentChallenge() {
  initial = null;
  owner = null;
}
export function consumeInitialConsentChallenge(identity: string) {
  if (!claimInitialConsentChallenge(identity)) return null;
  const challenge = initial;
  clearInitialConsentChallenge();
  return challenge;
}
