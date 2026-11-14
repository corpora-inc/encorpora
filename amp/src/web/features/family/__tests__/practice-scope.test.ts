import { expect, test } from "vitest";
import { nameList, practiceScopeLine } from "../practice-scope";

test("a family wholly in its own class: every child", () => {
  expect(practiceScopeLine(["Pip", "Wren"], [])).toBe(
    "For every child in the family, and each child you add. The math is the same either way.",
  );
});

test("a child in another group is named as outside the defaults", () => {
  const line = practiceScopeLine(["Pip"], ["Elsewhere Kid"]);
  expect(line).toBe(
    "For Pip, and each child you add. Elsewhere Kid practices in another group, which sets theirs.",
  );
  expect(line).not.toMatch(/every child in the family/);
});

test("several elsewhere, and none at home", () => {
  expect(practiceScopeLine([], ["Ada", "Ben", "Cy"])).toBe(
    "For each child you add to your family’s class. Ada, Ben and Cy practice in other groups, which set theirs.",
  );
  expect(nameList(["Pip", "Wren"])).toBe("Pip and Wren");
});
