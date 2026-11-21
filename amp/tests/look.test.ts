import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveLook,
  shownLook,
  type ClassLook,
  type Look,
} from "../src/learning/look";
import {
  defaultPracticeSettings,
  practiceChangeSchema,
  practiceSettingsSchema,
} from "../src/learning/practice-settings";
import { resolveSettings } from "../src/schools/settings";

const cls = (value: Look, set = true, locked = false): ClassLook => ({
  value,
  set,
  locked,
});
const id = "6f1d1c33-3f73-4f5b-9f52-6d4c1f3f6a10";

test("no one has chosen: calm", () => {
  assert.deepEqual(resolveLook({ own: null, classes: [] }), {
    look: "calm",
    locked: false,
    lockedBy: null,
  });
  // A class that only carries the default is no choice.
  assert.deepEqual(resolveLook({ own: null, classes: [cls("calm", false)] }), {
    look: "calm",
    locked: false,
    lockedBy: null,
  });
});

test("the learner's own choice beats an unlocked class", () => {
  assert.equal(
    resolveLook({ own: "calm", classes: [cls("bold")] }).look,
    "calm",
  );
  assert.equal(
    resolveLook({ own: "bold", classes: [cls("calm")] }).look,
    "bold",
  );
  assert.equal(resolveLook({ own: "bold", classes: [] }).look, "bold");
});

test("a learner with no choice follows the class", () => {
  assert.deepEqual(resolveLook({ own: null, classes: [cls("bold")] }), {
    look: "bold",
    locked: false,
    lockedBy: null,
  });
  // One class chose, one is on the default: the choice stands.
  assert.equal(
    resolveLook({ own: null, classes: [cls("bold"), cls("calm", false)] }).look,
    "bold",
  );
});

test("two unlocked classes that disagree: calm", () => {
  assert.equal(
    resolveLook({ own: null, classes: [cls("bold"), cls("calm")] }).look,
    "calm",
  );
});

test("a locked class wins over the learner's own choice", () => {
  assert.deepEqual(
    resolveLook({ own: "calm", classes: [cls("bold", true, true)] }),
    { look: "bold", locked: true, lockedBy: "class" },
  );
  assert.deepEqual(
    resolveLook({ own: "bold", classes: [cls("calm", true, true)] }),
    { look: "calm", locked: true, lockedBy: "class" },
  );
});

test("a lock beats an unlocked class beside it", () => {
  assert.deepEqual(
    resolveLook({
      own: null,
      classes: [cls("calm"), cls("bold", true, true)],
    }),
    { look: "bold", locked: true, lockedBy: "class" },
  );
});

test("two locked classes agree or fall back to calm", () => {
  assert.equal(
    resolveLook({
      own: "calm",
      classes: [cls("bold", true, true), cls("bold", true, true)],
    }).look,
    "bold",
  );
  assert.deepEqual(
    resolveLook({
      own: "bold",
      classes: [cls("bold", true, true), cls("calm", true, true)],
    }),
    { look: "calm", locked: true, lockedBy: "class" },
  );
});

test("the recorded look keeps reduced motion apart", () => {
  assert.equal(shownLook("calm", false), "calm");
  assert.equal(shownLook("calm", true), "calm");
  assert.equal(shownLook("bold", false), "bold");
  assert.equal(shownLook("bold", true), "bold-reduced");
});

test("stored settings: look is null until chosen, old states read as null", () => {
  assert.equal(defaultPracticeSettings().look, null);
  const saved = practiceSettingsSchema.parse({
    revision: 1,
    epoch: 0,
    workingTogether: false,
    focusSkillId: null,
    strandStarts: {},
  });
  assert.equal(saved.look, null);
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

test("through resolveSettings: a lock above holds, a class value is read", () => {
  const org = { kind: "org", id: "o" } as const;
  const klass = { kind: "class", id: "c" } as const;
  const locked = resolveSettings([
    { ...org, values: { look: "bold" }, locked: ["look"] },
    { ...klass, values: { look: "calm" }, locked: [] },
  ]).look;
  assert.equal(locked.value, "bold");
  assert.ok(locked.lockedBy);
  const free = resolveSettings([
    { ...org, values: {}, locked: [] },
    { ...klass, values: { look: "bold" }, locked: [] },
  ]).look;
  assert.deepEqual(
    [free.value, free.lockedBy, free.setBy?.id],
    ["bold", null, "c"],
  );
  assert.equal(resolveSettings([]).look.value, "calm");
});

test("a grown-up's lock holds the child's own choice", () => {
  assert.deepEqual(
    resolveLook({ own: "bold", ownLocked: true, classes: [cls("calm")] }),
    { look: "bold", locked: true, lockedBy: "adult" },
  );
  // Without a look to hold there is nothing to lock.
  assert.deepEqual(resolveLook({ own: null, ownLocked: true, classes: [] }), {
    look: "calm",
    locked: false,
    lockedBy: null,
  });
  // A solo, unlocked learner keeps full control.
  assert.equal(resolveLook({ own: "bold", classes: [] }).locked, false);
});

test("a class's lock beats a grown-up's, and disagreeing locked classes are calm", () => {
  assert.deepEqual(
    resolveLook({
      own: "bold",
      ownLocked: true,
      classes: [cls("calm", true, true)],
    }),
    { look: "calm", locked: true, lockedBy: "class" },
  );
  assert.equal(
    resolveLook({
      own: "bold",
      ownLocked: true,
      classes: [cls("bold", true, true), cls("calm", true, true)],
    }).look,
    "calm",
  );
});

test("the look lock is a grown-up's change with one boolean", () => {
  assert.equal(
    practiceChangeSchema.parse({
      kind: "lookLock",
      locked: true,
      requestId: id,
      revision: 0,
    }).kind,
    "lookLock",
  );
  assert.throws(() =>
    practiceChangeSchema.parse({
      kind: "lookLock",
      requestId: id,
      revision: 0,
    }),
  );
  assert.equal(defaultPracticeSettings().lookAdultLock, false);
});
