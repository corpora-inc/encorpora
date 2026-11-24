import assert from "node:assert/strict";
import test from "node:test";
import { checkLook, checkLooks, lookThemes } from "../scripts/lib/fixture-look";

test("a layout or input check runs in Colorful once, then in Calm light and dark", () => {
  assert.deepEqual(
    lookThemes(undefined, {}).map(({ look, theme, name }) => [
      look,
      theme,
      name,
    ]),
    [
      ["bold", "light", "colorful"],
      ["calm", "light", "light"],
      ["calm", "dark", "dark"],
    ],
  );
  // Colorful is one scheme: a quick run's single theme still gets its pass,
  // and the learner is left in Calm either way.
  assert.deepEqual(
    lookThemes(["light"], {}).map((pass) => pass.name),
    ["colorful", "light"],
  );
});

test("AMP_UI_LOOKS narrows a run to one look, and nothing else", () => {
  assert.deepEqual(checkLooks({}), ["calm", "bold"]);
  assert.deepEqual(checkLooks({ AMP_UI_LOOKS: "" }), ["calm", "bold"]);
  assert.deepEqual(checkLooks({ AMP_UI_LOOKS: "bold" }), ["bold"]);
  assert.deepEqual(checkLooks({ AMP_UI_LOOKS: "calm, bold" }), [
    "calm",
    "bold",
  ]);
  assert.deepEqual(
    lookThemes(undefined, { AMP_UI_LOOKS: "bold" }).map((pass) => pass.name),
    ["colorful"],
  );
  assert.deepEqual(
    lookThemes(undefined, { AMP_UI_LOOKS: "calm" }).map((pass) => pass.name),
    ["light", "dark"],
  );
  for (const value of ["colorful", "calm,calm", "calm;bold", "none"])
    assert.throws(() => checkLooks({ AMP_UI_LOOKS: value }), value);
});

test("a single-pass check says its one look; AMP_UI_LOOK may name the other", () => {
  assert.equal(checkLook("bold", {}), "bold");
  assert.equal(checkLook("calm", {}), "calm");
  assert.equal(checkLook("bold", { AMP_UI_LOOK: "calm" }), "calm");
  assert.equal(checkLook("calm", { AMP_UI_LOOK: "" }), "calm");
  assert.throws(() => checkLook("bold", { AMP_UI_LOOK: "colorful" }));
});
