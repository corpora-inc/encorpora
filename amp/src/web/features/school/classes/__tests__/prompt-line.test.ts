import { expect, test } from "vitest";
import { promptLine } from "../prompt-line";

test("a mark set after an expression never breaks from it (Q-4)", () => {
  const line = promptLine(
    "Angle $ABD$ measures $(4x-17)$° and angle $DBC$ measures $(3x+16)$°.",
  );
  expect(line).toContain("(3x+16)\u2060°.");
  expect(line).toContain("(4x-17)\u2060° and");
  expect(promptLine("About 40% of $12$")).toBe("About 40\u2060% of 12");
  // Nothing else changes: words still break at spaces.
  expect(promptLine("Ray $BD$ splits\nright angle")).toBe(
    "Ray BD splits right angle",
  );
});
