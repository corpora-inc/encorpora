import { expect, test } from "vitest";
import {
  closeDepth,
  FOR_KEY,
  isLearnerId,
  layerKeysLeft,
  popLayer,
  pushLayer,
  readsKey,
  readStack,
  replaceTop,
  staffOnly,
  work,
  writeStack,
} from "../entities";

const S1 = "577b5ef6-03eb-4963-9ee4-508311640ece";
const S2 = "a289b93a-c7ab-4117-9a32-013ee1a3da27";
const A = "b47a1fe7febbaceff2a7ceec1e205927783d8f89a5a59be21f8474eb1005a540";

test("a stack reads only well-formed layers, oldest first", () => {
  expect(
    readStack(`student:${S1},work:${S1}.${A},lesson:find-what-was-added`),
  ).toEqual([
    { kind: "student", id: S1 },
    { kind: "work", id: `${S1}.${A}` },
    { kind: "lesson", id: "find-what-was-added" },
  ]);
  for (const raw of [
    "student:not-a-uuid",
    "evil:x",
    `work:${S1}`,
    `work:${S1}.${A}.x`,
    "lesson:../../etc",
    "skill:<script>",
    ["student", S1],
    "x".repeat(1001),
  ])
    expect(readStack(raw)).toEqual([]);
});

test("opening, popping and stepping", () => {
  const one = pushLayer(undefined, { kind: "student", id: S1 });
  expect(one).toBe(`student:${S1}`);
  const two = pushLayer(one, work(S1, A));
  expect(two).toBe(`student:${S1},work:${S1}.${A}`);
  // Opening what is lower brings the stack back to it.
  expect(pushLayer(two, { kind: "student", id: S1 })).toBe(one);
  expect(popLayer(two)).toBe(one);
  expect(popLayer(one)).toBeUndefined();
  expect(replaceTop(one, { kind: "student", id: S2 })).toBe(`student:${S2}`);
  // Never deeper than five: the newest replaces the top.
  let deep: string | undefined;
  for (const id of ["a", "b", "c", "d", "e", "f"])
    deep = pushLayer(deep, { kind: "skill", id });
  expect(readStack(deep).map((layer) => layer.id)).toEqual([
    "a",
    "b",
    "c",
    "d",
    "f",
  ]);
  expect(writeStack([])).toBeUndefined();
});

test("an answer's `skill` leaves with the last answer", () => {
  const withAnswer = readStack(`student:${S1},work:${S1}.${A}`);
  expect(layerKeysLeft(withAnswer, withAnswer.slice(0, 1))).toEqual(["skill"]);
  expect(layerKeysLeft(withAnswer, withAnswer)).toEqual([]);
});

test("own practice opens skills and lessons; students and answers are staff-only", () => {
  expect(staffOnly("student")).toBe(true);
  expect(staffOnly("work")).toBe(true);
  expect(staffOnly("skill")).toBe(false);
  expect(staffOnly("lesson")).toBe(false);
});

test("a lesson opens over any stack, and an old `?lesson=` becomes one", () => {
  expect(pushLayer(undefined, { kind: "lesson", id: "unit-cube-volume" })).toBe(
    "lesson:unit-cube-volume",
  );
  expect(
    readStack(pushLayer(`student:${S1}`, { kind: "lesson", id: "a-type" })),
  ).toEqual([
    { kind: "student", id: S1 },
    { kind: "lesson", id: "a-type" },
  ]);
  expect(readStack("lesson:Not A Slug")).toEqual([]);
});

test("closing puts the stack away, except back to an answer replay below", () => {
  const stack = readStack(
    `student:${S1},work:${S1}.${A},lesson:count-objects,skill:count-to-20`,
  );
  expect(stack).toHaveLength(4);
  // The student sheet and the replay close back to the page.
  expect(closeDepth(stack, 0)).toBe(0);
  expect(closeDepth(stack, 1)).toBe(0);
  // A lesson (and anything over it) closes back to the replay.
  expect(closeDepth(stack, 2)).toBe(2);
  expect(closeDepth(stack, 3)).toBe(2);
  // With no replay in the stack, everything closes to the page.
  expect(closeDepth(readStack("skill:a,lesson:b"), 1)).toBe(0);
});

test("a skill, a lesson and an area say whose they were opened for; a record and an answer are their own", () => {
  for (const kind of ["skill", "lesson", "area"] as const)
    expect(readsKey(kind, FOR_KEY)).toBe(true);
  // A student's record and an answer name their student in their id.
  for (const kind of ["student", "work", "own-work"] as const)
    expect(readsKey(kind, FOR_KEY)).toBe(false);
  expect(readsKey("work", "skill")).toBe(true);
  expect(readsKey("skill", "skill")).toBe(false);
  // `for` leaves the address with the last layer that reads it.
  const stack = readStack("skill:fractions,lesson:a-type");
  expect(layerKeysLeft(stack, stack.slice(0, 1))).toEqual([]);
  expect(layerKeysLeft(stack, [])).toEqual([FOR_KEY]);
});

test("a learner's id is a uuid, and nothing else", () => {
  expect(isLearnerId(S1)).toBe(true);
  for (const value of [
    "",
    "pip",
    `${S1} `,
    `${S1},${S2}`,
    "../kids",
    undefined,
    null,
    [S1],
    42,
  ])
    expect(isLearnerId(value)).toBe(false);
});
