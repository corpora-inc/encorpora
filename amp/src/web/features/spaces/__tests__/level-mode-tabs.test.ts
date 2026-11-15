import { expect, test } from "vitest";
import { meTabs } from "../tabs";

test("practice at a level's Level tab goes back to its choice, never a profile's editor (CP-5 #2)", () => {
  const level = meTabs("own", "level-profile", true);
  expect(level.find((tab) => tab.id === "levels")).toMatchObject({
    label: "Level",
    path: "me/level",
  });
  expect(JSON.stringify(level)).not.toContain("me/profiles/level-profile");
  // A saved profile keeps its own editor.
  const saved = meTabs("own", "saved-profile");
  expect(saved.find((tab) => tab.id === "levels")?.path).toBe(
    "me/profiles/saved-profile",
  );
});
