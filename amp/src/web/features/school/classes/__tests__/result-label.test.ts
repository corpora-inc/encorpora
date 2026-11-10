import { expect, test } from "vitest";
import { resultLabel } from "../teacher-shared";

test("a learner reading their own work reads it to them; a teacher's reading is unchanged", () => {
  expect(resultLabel("independent", "self")).toBe("On your own");
  expect(resultLabel("independent")).toBe("On their own");
  for (const result of ["hint", "paper", "missed"] as const)
    expect(resultLabel(result, "self")).toBe(resultLabel(result));
});
