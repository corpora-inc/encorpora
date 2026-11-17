import { beforeEach, expect, test } from "vitest";
import { initialProgressView } from "../../ProgressWorkspace";
import {
  progressFocus,
  progressKey,
  progressPath,
  shownProgress,
  useProgressViews,
} from "../progress-view";

beforeEach(() => useProgressViews.setState({ views: {} }));

test("an area and an open skill are Progress's address", () => {
  expect(progressPath({ strand: "", skillId: null })).toBe("/progress");
  expect(progressPath({ strand: "fractions", skillId: null })).toBe(
    "/progress/areas/fractions",
  );
  // An open skill is the address, whatever area it was opened from.
  expect(progressPath({ strand: "fractions", skillId: "a b" })).toBe(
    "/progress/skills/a%20b",
  );
  expect(progressFocus("/progress/skills/a%20b")).toEqual({ skill: "a b" });
  expect(progressFocus("/progress/areas/fractions")).toEqual({
    strand: "fractions",
  });
  expect(progressFocus("/progress")).toEqual({});
});

test("the shown view is the address's area or skill over how it was left", () => {
  const left = { filter: "review", page: 3, strand: "data", skillId: null };
  const kept = left as typeof initialProgressView;
  // Plain /progress: no area and no skill, the rest as it was left.
  expect(shownProgress("/progress", kept)).toEqual({
    ...left,
    strand: "",
    skillId: null,
  });
  expect(shownProgress("/progress/areas/fractions", kept)).toEqual({
    ...left,
    strand: "fractions",
  });
  // A skill keeps the area it was opened from, for its way back.
  expect(shownProgress("/progress/skills/s1", kept)).toEqual({
    ...left,
    skillId: "s1",
  });
});

test("each account's learner keeps its own view", () => {
  const set = useProgressViews.getState().set;
  set(progressKey("amp|a", "pip"), { ...initialProgressView, page: 2 });
  expect(
    useProgressViews.getState().views[progressKey("amp|a", "pip")]?.page,
  ).toBe(2);
  expect(
    useProgressViews.getState().views[progressKey("amp|b", "pip")],
  ).toBeUndefined();
  expect(
    useProgressViews.getState().views[progressKey("amp|a", "wren")],
  ).toBeUndefined();
});
