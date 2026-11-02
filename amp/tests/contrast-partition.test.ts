import assert from "node:assert/strict";
import test from "node:test";
import {
  assertContrastCoverage,
  contrastPairs,
  contrastPartition,
  contrastStates,
} from "../scripts/contrast-partition";

test("four contrast pairs cover the full 96-state sweep exactly once", () => {
  const full = contrastPartition(["--strict"]);
  assert.deepEqual(full, contrastPairs);
  const visited = contrastPairs.flatMap(({ id, theme, width }) => {
    const selected = contrastPartition(["--strict", `--only=${id}`]);
    assert.equal(selected.length, 1);
    const states = contrastStates.map((state) => `${theme} ${width} ${state}`);
    assert.equal(states.length, 24);
    assertContrastCoverage(states, selected);
    return states;
  });
  assert.equal(visited.length, 96);
  assert.equal(new Set(visited).size, 96);
  assertContrastCoverage(visited, full);
});

test("invalid selectors and incomplete or duplicated coverage fail closed", () => {
  for (const args of [
    ["--only="],
    ["--only=light:320"],
    ["--only=dark"],
    ["--only=light:390", "--only=dark:390"],
    ["--only"],
    ["--unknown"],
  ])
    assert.throws(() => contrastPartition(args));
  const pair = contrastPartition(["--only=light:390"]);
  const states = contrastStates.map((state) => `light 390 ${state}`);
  for (const invalid of [
    [],
    states.slice(1),
    [...states, states[0]!],
    ["light 390 unknown", ...states.slice(1)],
    states.map((state) => state.replace("light", "dark")),
  ])
    assert.throws(() => assertContrastCoverage(invalid, pair));
  assert.throws(() => assertContrastCoverage([], []));
});
