import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fundedPrograms } from "../funded-entry";
import {
  PROGRAM_CHOICES,
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
