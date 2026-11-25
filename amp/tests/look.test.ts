import assert from "node:assert/strict";
import test from "node:test";
import {
  colorfulAllowed,
  resolveLook,
  startingLook,
  shownLook,
  type ClassLook,
  type Look,
} from "../src/learning/look";
import {
  allowsColorful,
  defaultPracticeSettings,
  practiceChangeSchema,
  practiceSettingsSchema,
} from "../src/learning/practice-settings";
import {
  lockedKeys,
  resolveSettings,
  storedLook,
  type SettingsScope,
} from "../src/schools/settings";

const id = "6f1d1c33-3f73-4f5b-9f52-6d4c1f3f6a10";
type Stored = Look | null;

test("the one rule for what is stored: Colorful is off only as Calm, held", () => {
  const table: [stored: Stored, held: boolean, allowed: boolean][] = [
    [null, false, true],
    ["calm", false, true],
    ["bold", false, true],
    // A hold beside Colorful never meant anything.
    ["bold", true, true],
    // A hold with nothing to hold is not Calm, held.
    [null, true, true],
    ["calm", true, false],
  ];
  for (const [stored, held, allowed] of table)
    assert.equal(
      colorfulAllowed(stored, held),
      allowed,
      `${stored}, ${held ? "held" : "not held"}`,
    );
});

/**
 * Every scope × what it stores × the learner's own choice × where their age
 * starts. `school`, `klass` and `adult` are what is stored at a school (or
 * district), the learner's class and the child's own settings: a look and
 * whether it is held.
 */
type Pair = [look: Stored, held: boolean];
const NOTHING: Pair = [null, false];
const OFF: Pair = ["calm", true];
/** What a learner's class says, the school above it resolved in, as the
 * server reads it (schools/learner-look.ts). */
function classLook(school: Pair, klass: Pair): ClassLook {
  const scope = (kind: "org" | "class", [look, held]: Pair): SettingsScope => ({
    kind,
    id: kind,
    values: look ? { look } : {},
    locked: held ? ["look"] : [],
  });
  const { look } = resolveSettings([
    scope("org", school),
    scope("class", klass),
  ]);
  return {
    value: look.value,
    set: look.setBy !== null,
    locked: look.lockedBy !== null,
  };
}
const seen = (
  school: Pair,
  klass: Pair,
  adult: Pair,
  own: Stored,
  starting: Look,
) => {
  const [adultLook, adultHeld] = adult;
  // The child's settings as the lock before the switch left them: the
  // child's own choice shares the stored look with that lock.
  const settings = {
    look: adultHeld ? adultLook : own,
    lookAdultLock: adultHeld,
    colorfulAllowed: true,
  };
  return resolveLook({
    own: settings.look,
    ownOff: !allowsColorful(settings),
    classes: [classLook(school, klass)],
    starting,
  });
};

test("the look a learner sees: every scope, what it stores, their own choice and their age", () => {
  const stores: Pair[] = [
    NOTHING,
    ["calm", false],
    ["bold", false],
    ["bold", true],
    OFF,
  ];
  const off = (pair: Pair) => pair[0] === "calm" && pair[1];
  let rows = 0;
  for (const school of stores)
    for (const klass of stores)
      for (const adult of stores)
        for (const own of [null, "calm", "bold"] as Stored[])
          for (const starting of ["calm", "bold"] as Look[]) {
            const result = seen(school, klass, adult, own, starting);
            const where = JSON.stringify({
              school,
              klass,
              adult,
              own,
              starting,
            });
            rows++;
            if (off(school) || off(klass)) {
              // Off at a class or anywhere above it: Calm, by the class.
              assert.deepEqual(
                result,
                { look: "calm", locked: true, lockedBy: "class" },
                where,
              );
              continue;
            }
            if (off(adult)) {
              assert.deepEqual(
                result,
                { look: "calm", locked: true, lockedBy: "adult" },
                where,
              );
              continue;
            }
            // Allowed: theirs to choose. What a school or a class stored
            // (Calm not held, Colorful, Colorful held) changes nothing; an
            // older held Colorful of a grown-up's is the stored look itself.
            const theirs = adult[1] ? adult[0] : own;
            assert.deepEqual(
              result,
              { look: theirs ?? starting, locked: false, lockedBy: null },
              where,
            );
          }
  assert.equal(rows, 5 * 5 * 5 * 3 * 2);
});

test("the grown-up's switch: off is Calm and keeps the child's own choice for later", () => {
  const off = { ...defaultPracticeSettings(), colorfulAllowed: false };
  for (const own of [null, "calm", "bold"] as Stored[]) {
    assert.equal(allowsColorful({ ...off, look: own }), false);
    assert.deepEqual(
      resolveLook({ own, ownOff: true, classes: [], starting: "bold" }),
      { look: "calm", locked: true, lockedBy: "adult" },
    );
    // On again: what they had chosen, else where their age starts.
    assert.equal(
      resolveLook({ own, ownOff: false, classes: [], starting: "bold" }).look,
      own ?? "bold",
    );
  }
  // Stored before the switch: only a lock on Calm reads as off.
  const before = defaultPracticeSettings();
  assert.equal(
    allowsColorful({ ...before, look: "calm", lookAdultLock: true }),
    false,
  );
  assert.equal(
    allowsColorful({ ...before, look: "bold", lookAdultLock: true }),
    true,
  );
  assert.equal(
    allowsColorful({ ...before, look: null, lookAdultLock: true }),
    true,
  );
  assert.equal(allowsColorful(before), true);
});

test("two classes: off in either is off; nothing else of a class matters", () => {
  const held: ClassLook = { value: "calm", set: true, locked: true };
  const colorful: ClassLook = { value: "bold", set: true, locked: false };
  assert.deepEqual(
    resolveLook({ own: "bold", classes: [colorful, held], starting: "bold" }),
    { look: "calm", locked: true, lockedBy: "class" },
  );
  assert.equal(
    resolveLook({ own: null, classes: [colorful, colorful], starting: "calm" })
      .look,
    "calm",
  );
  // A class's off comes before a grown-up's.
  assert.equal(
    resolveLook({ own: "bold", ownOff: true, classes: [held] }).lockedBy,
    "class",
  );
});

test("through the scopes: off above holds below; a hold beside Colorful holds nothing", () => {
  const org = { kind: "org", id: "o" } as const;
  const klass = { kind: "class", id: "c" } as const;
  // Off at the school: the class is off, set by the school, whatever it has.
  const off = resolveSettings([
    { ...org, values: { look: "calm" }, locked: ["look"] },
    { ...klass, values: { look: "bold" }, locked: [] },
  ]).look;
  assert.deepEqual([off.value, off.lockedBy?.id], ["calm", "o"]);
  // Stored before: a school's Colorful, locked. Nothing is held, and the
  // class below may turn it off for itself.
  const above: SettingsScope[] = [
    { ...org, values: { look: "bold" }, locked: ["look"] },
  ];
  assert.equal(resolveSettings(above).look.lockedBy, null);
  assert.deepEqual(lockedKeys(above, { look: "calm" }), []);
  const below = resolveSettings([
    ...above,
    { ...klass, values: { look: "calm" }, locked: ["look"] },
  ]).look;
  assert.deepEqual([below.value, below.lockedBy?.id], ["calm", "c"]);
  // A hold with no value of its own holds the Calm in effect there.
  assert.equal(
    resolveSettings([{ ...org, values: {}, locked: ["look"] }]).look.lockedBy
      ?.id,
    "o",
  );
  // Every other setting's lock holds whatever it holds.
  const levels = resolveSettings([
    { ...org, values: { levels: "shown" }, locked: ["levels"] },
  ]).levels;
  assert.equal(levels.lockedBy?.id, "o");
  assert.deepEqual(
    lockedKeys([{ ...org, values: { look: "calm" }, locked: ["look"] }], {
      look: "bold",
    }),
    ["look"],
  );
  assert.equal(resolveSettings([]).look.value, "calm");
});

test("what a scope keeps after a write: Calm, held, or nothing", () => {
  const OFF = { value: "calm", held: true };
  const NOTHING = { value: undefined, held: false };
  // The switch off, and on.
  assert.deepEqual(storedLook("calm", true, "calm"), OFF);
  assert.deepEqual(storedLook(undefined, false, "calm"), NOTHING);
  // A hold sent with Colorful is dropped; so is Colorful itself.
  assert.deepEqual(storedLook("bold", true, "calm"), NOTHING);
  assert.deepEqual(storedLook("bold", false, "calm"), NOTHING);
  // Choosing Colorful over a held Calm frees it in the same write.
  assert.deepEqual(storedLook("bold", true, "calm"), NOTHING);
  // Calm nobody holds starts nobody anywhere: not kept.
  assert.deepEqual(storedLook("calm", false, "calm"), NOTHING);
  // A hold alone holds the look in effect from above.
  assert.deepEqual(storedLook(undefined, true, "calm"), OFF);
  assert.deepEqual(storedLook(undefined, true, "bold"), NOTHING);
  // A stored value the schema no longer takes is no value.
  assert.deepEqual(storedLook("neon", true, "calm"), OFF);
});

test("the recorded look keeps reduced motion apart", () => {
  assert.equal(shownLook("calm", false), "calm");
  assert.equal(shownLook("calm", true), "calm");
  assert.equal(shownLook("bold", false), "bold");
  assert.equal(shownLook("bold", true), "bold-reduced");
});

test("stored settings: look is null until chosen, Colorful allowed; old states read the same", () => {
  assert.equal(defaultPracticeSettings().look, null);
  assert.equal(defaultPracticeSettings().colorfulAllowed, true);
  const saved = practiceSettingsSchema.parse({
    revision: 1,
    epoch: 0,
    workingTogether: false,
    focusSkillId: null,
    strandStarts: {},
  });
  assert.equal(saved.look, null);
  assert.equal(saved.colorfulAllowed, true);
  assert.equal(allowsColorful(saved), true);
});

test("the look change takes calm, bold or null, nothing else", () => {
  for (const look of ["calm", "bold", null])
    assert.equal(
      practiceChangeSchema.parse({
        kind: "look",
        look,
        requestId: id,
        revision: 0,
      }).kind,
      "look",
    );
  assert.throws(() =>
    practiceChangeSchema.parse({
      kind: "look",
      look: "bold-reduced",
      requestId: id,
      revision: 0,
    }),
  );
});

test("Allow Colorful is a grown-up's change with one boolean; the old lock is no change any more", () => {
  assert.equal(
    practiceChangeSchema.parse({
      kind: "allowColorful",
      allowed: false,
      requestId: id,
      revision: 0,
    }).kind,
    "allowColorful",
  );
  assert.throws(() =>
    practiceChangeSchema.parse({
      kind: "allowColorful",
      requestId: id,
      revision: 0,
    }),
  );
  assert.throws(() =>
    practiceChangeSchema.parse({
      kind: "lookLock",
      locked: true,
      requestId: id,
      revision: 0,
    }),
  );
});

test("where a learner starts when they have not chosen: Colorful through grade 5, Calm after and for anyone whose grade isn't known", () => {
  for (const grade of [0, 1, 5]) assert.equal(startingLook(grade), "bold");
  for (const grade of [6, 9, 12, 13, null])
    assert.equal(startingLook(grade), "calm");
  assert.equal(
    resolveLook({ own: null, classes: [], starting: "bold" }).look,
    "bold",
  );
  assert.equal(
    resolveLook({ own: "calm", classes: [], starting: "bold" }).look,
    "calm",
  );
  assert.equal(resolveLook({ own: null, classes: [] }).look, "calm");
});
