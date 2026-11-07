import test from "node:test";
import assert from "node:assert/strict";
import {
  assertSettingsWritable,
  defaultSettings,
  lockedKeys,
  resolveSettings,
  schoolSettingsSchema,
  SettingLockedError,
  studentDeviceMode,
  studentLevelVisibility,
  type SettingsScope,
} from "../src/schools/settings.js";

const scope = (
  kind: SettingsScope["kind"],
  id: string,
  values: SettingsScope["values"] = {},
  locked: string[] = [],
): SettingsScope => ({ kind, id, values, locked });
const district = "district-id";
const school = "school-id";
const period = "class-id";
const student = "person-id";

test("with nothing set, every setting is the default and nobody set it", () => {
  const settings = resolveSettings([]);
  assert.equal(settings.levels.value, defaultSettings.levels);
  assert.equal(settings.standings.value, "off");
  assert.equal(settings.measure.value, "growth");
  assert.equal(settings.weeklyTargetMinutes.value, undefined);
  assert.equal(settings.levels.setBy, null);
  assert.equal(settings.levels.lockedBy, null);
});

test("the chain resolves top down: lower scopes override, and it says who set it", () => {
  const settings = resolveSettings([
    scope("org", district, { levels: "shown", standings: "class" }),
    scope("org", school, { standings: "school" }),
    scope("class", period, { levels: "choice", weeklyTargetMinutes: 90 }),
    scope("person", student, { measure: "practice" }),
  ]);
  assert.deepEqual(settings.levels, {
    value: "choice",
    setBy: { kind: "class", id: period },
    lockedBy: null,
  });
  assert.deepEqual(settings.standings.setBy, { kind: "org", id: school });
  assert.equal(settings.standings.value, "school");
  assert.equal(settings.measure.value, "practice");
  assert.deepEqual(settings.measure.setBy, { kind: "person", id: student });
  assert.equal(settings.weeklyTargetMinutes.value, 90);
});

test("a lock holds against every scope below it, and names who locked it", () => {
  const settings = resolveSettings([
    scope("org", district, { levels: "hidden" }, ["levels"]),
    scope("org", school, { levels: "shown" }),
    scope("class", period, { levels: "choice" }, ["levels"]),
    scope("person", student, { levels: "shown", measure: "level" }),
  ]);
  assert.deepEqual(settings.levels, {
    value: "hidden",
    setBy: { kind: "org", id: district },
    lockedBy: { kind: "org", id: district },
  });
  // A lock on one key leaves the others free.
  assert.equal(settings.measure.value, "level");
});

test("a scope can lock the value it inherited, without setting one", () => {
  const settings = resolveSettings([
    scope("org", district, { standings: "class" }),
    scope("org", school, {}, ["standings"]),
    scope("class", period, { standings: "district" }),
  ]);
  assert.equal(settings.standings.value, "class");
  assert.deepEqual(settings.standings.setBy, { kind: "org", id: district });
  assert.deepEqual(settings.standings.lockedBy, { kind: "org", id: school });
});

test("a lock can hold the default, and a stored value the schema refuses is ignored", () => {
  const settings = resolveSettings([
    scope("org", district, {}, ["levels"]),
    scope("org", school, { levels: "shown" }),
  ]);
  assert.equal(settings.levels.value, "hidden");
  assert.equal(settings.levels.setBy, null);
  assert.deepEqual(settings.levels.lockedBy, { kind: "org", id: district });
  const bad = resolveSettings([
    scope("org", school, { measure: "shoe size", weeklyTargetMinutes: -5 }),
  ]);
  assert.equal(bad.measure.value, "growth");
  assert.equal(bad.weeklyTargetMinutes.value, undefined);
});

test("a write to a key locked above is rejected; unlocked keys go through", () => {
  const above = [scope("org", district, { levels: "hidden" }, ["levels"])];
  assert.deepEqual(lockedKeys(above, { levels: "shown", measure: "level" }), [
    "levels",
  ]);
  assert.throws(
    () => assertSettingsWritable(above, { levels: "shown" }),
    (error) =>
      error instanceof SettingLockedError &&
      error.keys.length === 1 &&
      error.keys[0] === "levels",
  );
  assert.doesNotThrow(() =>
    assertSettingsWritable(above, { standings: "class" }),
  );
  assert.doesNotThrow(() => assertSettingsWritable([], { levels: "shown" }));
});

test("the schema holds the four settings, a weekly target, and nothing else", () => {
  assert.equal(
    schoolSettingsSchema.safeParse({
      levels: "hidden",
      standings: "off",
      measure: "growth",
      deviceMode: "shared",
    }).success,
    true,
  );
  assert.equal(
    schoolSettingsSchema.safeParse({
      levels: "hidden",
      standings: "off",
      measure: "growth",
      deviceMode: "shared",
      gradingScale: "curve",
    }).success,
    false,
  );
  assert.equal(
    schoolSettingsSchema.shape.weeklyTargetMinutes.safeParse(0).success,
    false,
  );
});

test("across enrollments a student gets the most restrictive level setting", () => {
  const result = (levels: string, id: string) =>
    resolveSettings([scope("class", id, { levels })]);
  assert.deepEqual(studentLevelVisibility([]), {
    value: "hidden",
    setBy: null,
    lockedBy: null,
  });
  const shown = result("shown", "a");
  const choice = result("choice", "b");
  const hidden = result("hidden", "c");
  assert.equal(studentLevelVisibility([shown]).value, "shown");
  assert.equal(studentLevelVisibility([shown, choice]).value, "choice");
  assert.equal(studentLevelVisibility([choice, shown]).value, "choice");
  const strictest = studentLevelVisibility([shown, hidden, choice]);
  assert.equal(strictest.value, "hidden");
  assert.deepEqual(strictest.setBy, { kind: "class", id: "c" });
});

test("a device is shared unless every class a student is in says personal", () => {
  const personal = resolveSettings([
    scope("class", "a", { deviceMode: "personal" }),
  ]);
  const shared = resolveSettings([scope("class", "b")]);
  assert.equal(shared.deviceMode.value, "shared");
  assert.equal(studentDeviceMode([personal]), "personal");
  assert.equal(studentDeviceMode([personal, shared]), "shared");
  assert.equal(studentDeviceMode([]), "shared");
  const locked = resolveSettings([
    scope("org", district, { deviceMode: "shared" }, ["deviceMode"]),
    scope("class", "a", { deviceMode: "personal" }),
  ]);
  assert.equal(locked.deviceMode.value, "shared");
});
