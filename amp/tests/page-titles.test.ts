import test from "node:test";
import assert from "node:assert/strict";
import {
  appPageTitle,
  pitchTitles,
  programNames,
  publicAppPageTitle,
  signUpTitles,
} from "../src/analytics/page-titles.js";
import { PITCH_PROGRAMS } from "../src/analytics/events.js";
import { fundedPrograms } from "../src/web/lib/funded-entry.js";
import { pitchEntries } from "../src/parent-followup/contracts.js";

test("the pitch title names the funded program its link carries", () => {
  assert.equal(
    appPageTitle("/"),
    "AMP: Adaptive Math Pathways, a complete math curriculum",
  );
  assert.equal(
    appPageTitle("/?program=ar-efa&utm_source=google&gclid=Valid_Click_123"),
    "AMP: Adaptive Math Pathways for Arkansas EFA families",
  );
  assert.equal(
    appPageTitle("/?program=az-esa"),
    "AMP: Adaptive Math Pathways for Arizona ESA families",
  );
  assert.equal(
    appPageTitle("/?program=nh-efa"),
    "AMP: Adaptive Math Pathways for New Hampshire EFA families",
  );
});

test("an unknown, repeated-case or free-text program reads as the plain pitch", () => {
  for (const program of [
    "tx-esa",
    "AR-EFA",
    "ar-efa ",
    "parent@example.test",
    "",
    "__proto__",
    "hasOwnProperty",
  ])
    assert.equal(
      appPageTitle(`/?program=${encodeURIComponent(program)}`),
      pitchTitles.default,
      program,
    );
});

test("the signed-in home keeps the app title, which GA never receives", () => {
  assert.equal(appPageTitle("/", "app"), "AMP · Adaptive Math Pathways");
  assert.equal(
    appPageTitle("/?program=ar-efa", "app"),
    appPageTitle("/", "app"),
  );
  assert.equal(publicAppPageTitle("/", "app"), undefined);
});

test("sign-up titles follow the pitch choice, then the free-trial return", () => {
  const cases: [string, string][] = [
    ["/sign-up", "Create Your Account | AMP"],
    ["/sign-up?entry=pitch-try&return=free-practice", "Try AMP Free | AMP"],
    ["/sign-up?return=free-practice", "Try AMP Free | AMP"],
    [
      "/sign-up?entry=pitch-workbook&return=free-practice",
      "Get Your Free Workbook | AMP",
    ],
    [
      "/sign-up?entry=pitch-buy&program=ar-efa",
      "Create Your Account to Buy | AMP",
    ],
    ["/sign-up?entry=openai-math-path", "Create Your Account | AMP"],
    ["/sign-up?entry=free-practice", "Create Your Account | AMP"],
    ["/sign-up?entry=parent%40example.test", "Create Your Account | AMP"],
    ["/sign-up/?entry=pitch-try#private", "Try AMP Free | AMP"],
  ];
  for (const [location, title] of cases)
    assert.equal(appPageTitle(location), title, location);
  // Every pitch choice has its own row in the one table.
  for (const entry of pitchEntries)
    assert.ok(Object.hasOwn(signUpTitles, entry));
});

test("titles never carry URL values", () => {
  for (const location of [
    "/?email=parent%40example.test&program=ar-efa",
    "/sign-up?email=parent%40example.test&entry=pitch-buy",
    "/purchase/arizona-esa?token=private-invoice",
    "/family/learners?learner=private",
  ]) {
    const title = appPageTitle(location)!;
    assert.ok(title, location);
    assert.doesNotMatch(title, /example|private|token|@/, location);
  }
});

test("program names are the purchase flow's, for every pitch program", () => {
  assert.deepEqual(
    Object.keys(programNames).sort(),
    [...PITCH_PROGRAMS].sort(),
  );
  for (const program of Object.values(fundedPrograms))
    assert.equal(programNames[program.id], program.name);
  for (const id of PITCH_PROGRAMS)
    assert.ok(pitchTitles[id].includes(`for ${programNames[id]} families`));
});

test("private screens and the skill map keep their existing titles", () => {
  assert.equal(appPageTitle("/practice"), "Math Practice | AMP");
  assert.equal(appPageTitle("/start/parent"), "What Brings You to AMP? | AMP");
  assert.equal(appPageTitle("/plans"), "Plans | AMP");
  assert.equal(appPageTitle("/pathways"), undefined);
  assert.equal(appPageTitle("/pathways/count-to-20"), undefined);
});

test("the public school pages have titles, and a family's link is never public", () => {
  assert.equal(
    publicAppPageTitle("/schools", "pitch"),
    "AMP for Schools: a complete math curriculum",
  );
  assert.equal(
    publicAppPageTitle("/schools/scope-and-sequence", "pitch"),
    "Scope and Sequence | AMP for Schools",
  );
  assert.equal(
    publicAppPageTitle("/schools/trust", "pitch"),
    "Student Data | AMP for Schools",
  );
  assert.equal(publicAppPageTitle("/p", "pitch"), undefined);
  assert.equal(appPageTitle("/p"), "Progress from School | AMP");
});
