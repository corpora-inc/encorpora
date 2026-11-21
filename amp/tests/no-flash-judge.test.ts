import assert from "node:assert/strict";
import { test } from "node:test";
import { judge, type Id } from "../scripts/no-flash-judge";

const url = "/learners/l1/workbooks/w1/results";
const frame = (t: number, part: Partial<Id>): Id => ({
  t,
  url,
  title: "Adaptive Math Pathways | AMP",
  bar: "",
  tabs: "",
  main: "",
  h1: "",
  sheet: "",
  boot: false,
  wait: false,
  ...part,
});
const wave = frame(1, { boot: true });
const family = { bar: "family/tabs/", tabs: "Today|Settings", main: "page" };
const results = frame(400, { ...family, h1: "No. 1 · Friday, November 20" });

test("the wave, then the destination, is clean", () => {
  assert.deepEqual(
    judge({ ids: [wave, results], hops: [], shifts: [] }).problems,
    [],
  );
});

test("the destination's own skeleton under its own bar is the one frame", () => {
  const skeleton = frame(300, { ...family, wait: true });
  assert.deepEqual(
    judge({ ids: [wave, skeleton, results], hops: [], shifts: [] }).problems,
    [],
  );
});

test("the founder's 2026-11-20 sequence flashes", () => {
  // As recorded before the fix: another place's bar saying "not
  // available", then a placeholder heading, then the workbook.
  const blocked = frame(250, {
    bar: "me/tabs/",
    main: "spaceBlocked",
    title: "AMP: Adaptive Math Pathways, a complete math curriculum",
  });
  const placeholder = frame(274, {
    ...family,
    h1: "Workbook results",
    wait: true,
  });
  const { problems, trail } = judge({
    ids: [wave, blocked, placeholder, results],
    hops: [],
    shifts: [{ t: 409, v: 0.0036 }],
  });
  assert.match(problems.join("\n"), /2 other screen\(s\) before it/);
  assert.match(problems.join("\n"), /title changed/);
  assert.match(problems.join("\n"), /layout shift 0.004/);
  assert.match(trail, /^wave → me\/tabs\/ spaceBlocked → family/);
});

test("one hop before the first paint is allowed; a second, or a late one, is not", () => {
  const hop = { t: 100, from: "/old", to: url, how: "replaceState" };
  assert.deepEqual(
    judge({ ids: [wave, results], hops: [hop], shifts: [] }).problems,
    [],
  );
  const late = { ...hop, t: 500 };
  assert.match(
    judge({ ids: [wave, results], hops: [late], shifts: [] }).problems.join(),
    /moved after the first paint/,
  );
  assert.match(
    judge({
      ids: [wave, results],
      hops: [hop, hop],
      shifts: [],
    }).problems.join(),
    /2 hops/,
  );
});

test("the destination's bar with its wave, before its main, is the one frame", () => {
  const shell = frame(200, { ...family, main: "", wait: true });
  assert.deepEqual(
    judge({ ids: [wave, shell, results], hops: [], shifts: [] }).problems,
    [],
  );
  // Another place's bar with a wave is not.
  const other = frame(200, { bar: "me/tabs/", tabs: "Practice", wait: true });
  assert.match(
    judge({
      ids: [wave, other, results],
      hops: [],
      shifts: [],
    }).problems.join(),
    /other screen/,
  );
});
