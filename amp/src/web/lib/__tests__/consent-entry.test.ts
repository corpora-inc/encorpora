import { afterEach, expect, test } from "vitest";
import {
  rememberConsentChallenge,
  claimInitialConsentChallenge,
  consumeInitialConsentChallenge,
  clearInitialConsentChallenge,
  hasInitialConsentChallenge,
} from "../../consent-entry";
const challenge = {
  requestId: "a0000000-0000-4000-8000-000000000001",
  stage: "initial" as const,
  token: "synthetic-proof",
  noticeDigest: "synthetic-notice",
};
afterEach(clearInitialConsentChallenge);
test("an explicit guest email entry can be claimed and consumed once by the signed-in destination", () => {
  rememberConsentChallenge(challenge, null);
  expect(hasInitialConsentChallenge()).toBe(true);
  expect(claimInitialConsentChallenge("")).toBe(false);
  expect(claimInitialConsentChallenge("parent-a")).toBe(true);
  expect(consumeInitialConsentChallenge("parent-b")).toBeNull();
  expect(consumeInitialConsentChallenge("parent-a")).toEqual(challenge);
  expect(consumeInitialConsentChallenge("parent-a")).toBeNull();
  expect(hasInitialConsentChallenge()).toBe(false);
});
test("dismissing a claimed or guest entry removes its proof", () => {
  for (const owner of [null, "parent-a"]) {
    rememberConsentChallenge(challenge, owner);
    clearInitialConsentChallenge();
    expect(claimInitialConsentChallenge("parent-a")).toBe(false);
    expect(consumeInitialConsentChallenge("parent-a")).toBeNull();
  }
});
