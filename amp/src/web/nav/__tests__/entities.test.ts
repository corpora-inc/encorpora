import { expect, test } from "vitest";
import {
  layerKeysLeft,
  popLayer,
  pushLayer,
  readStack,
  replaceTop,
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
