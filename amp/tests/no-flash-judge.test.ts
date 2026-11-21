import assert from "node:assert/strict";
import { test } from "node:test";
import {
  judge,
  prerenderedInProduction,
  type Id,
} from "../scripts/no-flash-judge";

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

// A skill's page: production serves it prerendered, with its own title; the
// check's server serves the bare index.html (the pitch's static title) and
// the map writes the skill's title when its catalog arrives.
const PITCH = "AMP: Adaptive Math Pathways, a complete math curriculum";
const SKILL = "Counting objects to 20 | AMP Pathways";
const skillFrame = (t: number, part: Partial<Id>): Id =>
  frame(t, {
    url: "/pathways/count-to-20",
    bar: "me/tabs/",
    tabs: "Practice|Levels|Workbooks|Pathways|Inventory",
    ...part,
  });
const bareWave = skillFrame(1, {
  bar: "",
  tabs: "",
  boot: true,
  title: PITCH,
  titled: false,
});
const skillShell = skillFrame(200, { wait: true, title: PITCH, titled: false });
const skillOpen = { main: "Pathways", sheet: "Counting objects to 20" };

test("prerendered in production: the skill map and each skill's page", () => {
  assert.equal(prerenderedInProduction("/pathways"), true);
  assert.equal(prerenderedInProduction("/pathways/count-to-20"), true);
  assert.equal(prerenderedInProduction("/me"), false);
  assert.equal(prerenderedInProduction("/pathways/a/b"), false);
});

test("a bare stand-in's static title, before the app writes one, is no identity", () => {
  const skill = skillFrame(400, { ...skillOpen, title: SKILL, titled: true });
  assert.deepEqual(
    judge({
      ids: [bareWave, skillShell, skill],
      hops: [],
      shifts: [],
      prerendered: true,
    }).problems,
    [],
  );
  // The same frames at an address production does not prerender: the
  // static title was the document's, so its change is a flash.
  assert.deepEqual(
    judge({ ids: [bareWave, skillShell, skill], hops: [], shifts: [] })
      .problems,
    [`title changed: ${PITCH} → ${SKILL}`],
  );
});

test("a title the app wrote, then another, fails even where production prerenders", () => {
  const MAP = "Explore Math Skills | AMP Pathways";
  const written = skillFrame(200, { wait: true, title: MAP, titled: true });
  const skill = skillFrame(400, { ...skillOpen, title: SKILL, titled: true });
  assert.deepEqual(
    judge({
      ids: [bareWave, written, skill],
      hops: [],
      shifts: [],
      prerendered: true,
    }).problems,
    [`title changed: ${MAP} → ${SKILL}`],
  );
  // A recording without the mark counts every title as the app's.
  const unmarked = skillFrame(200, { wait: true, title: PITCH });
  assert.deepEqual(
    judge({
      ids: [bareWave, unmarked, { ...skill, titled: undefined }],
      hops: [],
      shifts: [],
      prerendered: true,
    }).problems,
    [`title changed: ${PITCH} → ${SKILL}`],
  );
});
