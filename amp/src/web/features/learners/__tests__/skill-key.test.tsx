import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { SkillKey } from "../SkillKey";

afterEach(cleanup);

test("the key defines Strong and Earned in place, with every standing", () => {
  render(<SkillKey level="Likely level" />);
  const items = screen.getAllByRole("listitem").map((item) => item.textContent);
  expect(items).toEqual([
    "Likely level",
    "Strong4 of the last 5 right without help",
    "Earnedright once without help",
    "Triednot yet right without help",
    "Not asked yetno problem on it so far",
  ]);
});
