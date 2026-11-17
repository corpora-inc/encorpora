import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fundedPrograms } from "../funded-entry";
import {
  PROGRAM_CHOICES,
  SIGN_UP_ENTRIES,
  arrivalLabels,
  arrivalQuery,
  keepSignUpIntent,
  signUpIntent,
  keepArrival,
  chooseProgram,
  chosenProgram,
  keepArrivalProgram,
  resetProgramChoiceForTests,
} from "../program-choice";

beforeEach(() => {
  sessionStorage.clear();
  resetProgramChoiceForTests();
});
afterEach(() => vi.restoreAllMocks());

test("the choices are exactly the programs AMP sells through", () => {
  expect([...PROGRAM_CHOICES].sort()).toEqual(
    Object.values(fundedPrograms)
      .map((program) => program.id)
      .sort(),
  );
});

test("an arrival's program is kept for the tab; a later visit without one keeps it", () => {
  expect(keepArrivalProgram({ program: "az-esa" })).toBe("az-esa");
  resetProgramChoiceForTests();
  expect(keepArrivalProgram({})).toBe("az-esa");
  expect(sessionStorage.getItem("amp.program-choice")).toBe("az-esa");
});

test("an unknown program is not a choice", () => {
  expect(keepArrivalProgram({ program: "tx-esa" })).toBeNull();
  chooseProgram("nh-efa");
  expect(keepArrivalProgram({ program: "../x" })).toBe("nh-efa");
});

test("blocked storage still holds the choice for the page", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  chooseProgram("ar-efa");
  expect(chosenProgram()).toBe("ar-efa");
  expect(warn).toHaveBeenCalled();
  chooseProgram(null);
  expect(chosenProgram()).toBeNull();
});

test("free text and an opted-out visitor's labels are never kept", () => {
  keepArrival({
    utm_campaign: "ar-efa-launch",
    utm_source: "private@example.test",
    utm_medium: "paid social",
  });
  expect(arrivalLabels()).toEqual({ utm_campaign: "ar-efa-launch" });
  resetProgramChoiceForTests();
  sessionStorage.clear();
  vi.stubGlobal("navigator", { globalPrivacyControl: true });
  keepArrival({ utm_campaign: "ar-efa-launch", program: "az-esa" });
  expect(arrivalLabels()).toEqual({});
  expect(chosenProgram()).toBe("az-esa");
  vi.unstubAllGlobals();
});

test("the sign-up entries are exactly the server's", async () => {
  const { signupEntrySchema } = await import(
    "../../../parent-followup/contracts"
  );
  expect([...SIGN_UP_ENTRIES].sort()).toEqual(
    [...signupEntrySchema.options].sort(),
  );
});

test("why a tab signs up is kept for the tab, never on an address", () => {
  keepSignUpIntent({ entry: "pitch-try" });
  resetProgramChoiceForTests();
  expect(signUpIntent()).toEqual({ entry: "pitch-try", free: true });
  keepSignUpIntent({ entry: "pitch-buy" });
  expect(signUpIntent()).toEqual({ entry: "pitch-buy" });
  // Only the handoff to another browser writes it as a query.
  chooseProgram("ar-efa");
  expect(arrivalQuery()).toEqual({ program: "ar-efa", entry: "pitch-buy" });
  keepSignUpIntent(null);
  expect(signUpIntent()).toEqual({});
  expect(sessionStorage.getItem("amp.sign-up-entry")).toBeNull();
});

test("an older sign-up address is read once into the tab", () => {
  keepArrival({ entry: "pitch-try", return: "free-practice" });
  expect(signUpIntent()).toEqual({ entry: "pitch-try", free: true });
  keepArrival({ return: "free-practice" });
  expect(signUpIntent()).toEqual({ free: true });
  expect(arrivalQuery()).toEqual({ return: "free-practice" });
  // A visit that names none keeps it.
  keepArrival({});
  expect(signUpIntent()).toEqual({ free: true });
});

test("a partner's entry label is measurement: dropped under GPC; a pitch choice is not", () => {
  vi.stubGlobal("navigator", { globalPrivacyControl: true });
  keepSignUpIntent({ entry: "openai-math-path" });
  expect(signUpIntent()).toEqual({});
  keepSignUpIntent({ entry: "pitch-buy" });
  expect(signUpIntent()).toEqual({ entry: "pitch-buy" });
  vi.unstubAllGlobals();
});
