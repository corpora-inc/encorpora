import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { generateProblem, templates } from "../src/math/engine";
import {
  chooseAxes,
  defineAxis,
  restrictAxis,
  withTemplateVersion,
} from "../src/math/variation/axes";
import { workbookIsCurrent } from "../src/workbook/routes";
import type { WorkbookSpec } from "../src/workbook/compose";

/**
 * Digests of the full problem JSON.
 * `version-gate-legacy.json` is two hundred seeds per bumped template
 * (`gate-legacy:0` …): the original rows are 0646acf0a (before that day's
 * axis additions), and the operation rows are main after #1985, at version 1.
 */
const legacyGolden = JSON.parse(
  readFileSync(
    new URL("./fixtures/version-gate-legacy.json", import.meta.url),
    "utf8",
  ),
) as Record<string, string[]>;

const bumped = [
  "angle-classify",
  "compare-symbol-blanks",
  "comparison-amount",
  "compatible-number-estimate",
  "digit-value-ratio",
  "dot-plot-arithmetic",
  "estimate-reasonableness",
  "expanded-whole-slots",
  "fraction-plot-difference",
  "full-kits",
  "kit-leftovers",
  "mcas-true-quotient-equations",
  "multidigit-digit-value",
  "order-whole-numbers-slots",
  "prime-factorization-exponents",
  "prime-factorization-value",
  "round-large",
  "seats-needed",
  "shape-sides-select",
  "times-as-many-comparison",
] as const;

/** Skill id below `version`, then the skill id at the current version. */
const skillMoves: Readonly<Record<string, readonly [string, string]>> = {
  "digit-value-ratio": ["powers-of-ten", "large-place-value"],
  "mcas-true-quotient-equations": ["whole-division", "multidigit-quotients"],
  "prime-factorization-exponents": ["factors-multiples", "integer-powers"],
  "prime-factorization-value": ["factors-multiples", "integer-powers"],
  "times-as-many-comparison": [
    "multiplicative-stories",
    "multiplicative-comparison",
  ],
};

const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

test("an axis with since is legacy below that version and live at and after it", () => {
  assert.throws(
    () => defineAxis("surface", ["bare", "ask"], { since: 0 }),
    /since/,
  );
  const surface = defineAxis("surface", ["bare", "ask"] as const, {
    legacy: "bare",
    since: 2,
  });
  const place = defineAxis("place", ["as-drawn", "ten"] as const, {
    legacy: "as-drawn",
  });
  assert.equal(restrictAxis(surface, ["bare", "ask"]).since, 2);
  const axes = { surface, place };
  let sawAsk = false;
  let sawTen = false;
  for (let i = 0; i < 80; i++) {
    const seed = `since:${i}`;
    const open = chooseAxes("tpl", seed, axes);
    const below = withTemplateVersion(1, () => chooseAxes("tpl", seed, axes));
    const at = withTemplateVersion(2, () => chooseAxes("tpl", seed, axes));
    const above = withTemplateVersion(3, () => chooseAxes("tpl", seed, axes));
    assert.equal(below.surface, "bare", seed);
    assert.equal(at.surface, open.surface, seed);
    assert.equal(above.surface, open.surface, seed);
    assert.equal(below.place, open.place, seed);
    assert.equal(at.place, open.place, seed);
    if (open.surface === "ask") sawAsk = true;
    if (open.place === "ten") sawTen = true;
  }
  assert.ok(sawAsk);
  assert.ok(sawTen);

  const nested = withTemplateVersion(1, () => {
    const inner = withTemplateVersion(2, () =>
      chooseAxes("tpl", "since:0", axes),
    );
    const outer = chooseAxes("tpl", "since:0", axes);
    return { inner, outer };
  });
  assert.equal(nested.outer.surface, "bare");
  assert.equal(
    nested.inner.surface,
    chooseAxes("tpl", "since:0", axes).surface,
  );
  assert.throws(
    () =>
      withTemplateVersion(1, () => {
        throw new Error("boom");
      }),
    /boom/,
  );
  assert.equal(
    chooseAxes("tpl", "since:0", axes).surface,
    nested.inner.surface,
  );
});

test("generateProblem at the stored version reprints the pre-axis problem", () => {
  assert.deepEqual(Object.keys(legacyGolden).sort(), [...bumped].sort());
  for (const id of bumped) {
    const meta = templates.find((t) => t.id === id);
    assert.ok(meta, id);
    assert.equal(meta.version, 2, id);
    assert.equal(meta.reprintsFrom, 1, id);
    const rows = legacyGolden[id]!;
    assert.equal(rows.length, 200, id);
    for (let i = 0; i < rows.length; i++) {
      const seed = `gate-legacy:${i}`;
      const problem = generateProblem(id, seed, 1);
      assert.equal(digest(problem), rows[i], `${id} ${seed}`);
      assert.equal(
        digest(generateProblem(id, seed, meta.version)),
        digest(generateProblem(id, seed)),
        `${id} ${seed} current`,
      );
    }
  }
  for (const [id, [previous, current]] of Object.entries(skillMoves)) {
    const oldSkill = generateProblem(id, "gate-legacy:0", 1);
    const newSkill = generateProblem(id, "gate-legacy:0");
    assert.equal(oldSkill.public.skillId, previous, id);
    assert.equal(newSkill.public.skillId, current, id);
  }
});

test("a workbook reprints from reprintsFrom and refuses an older version", () => {
  const spec = {
    sections: [
      {
        items: [{ templateId: "round-large", templateVersion: 1 }],
      },
    ],
  } as WorkbookSpec;
  assert.equal(workbookIsCurrent(spec), true);
  spec.sections[0]!.items[0]!.templateVersion = 2;
  assert.equal(workbookIsCurrent(spec), true);
  spec.sections[0]!.items[0]!.templateVersion = 0;
  assert.equal(workbookIsCurrent(spec), false);
  spec.sections[0]!.items[0]!.templateId = "not-a-template";
  spec.sections[0]!.items[0]!.templateVersion = 1;
  assert.equal(workbookIsCurrent(spec), false);
  spec.sections[0]!.items[0] = {
    templateId: "compare-two-digit",
    templateVersion: 1,
  } as WorkbookSpec["sections"][number]["items"][number];
  assert.equal(workbookIsCurrent(spec), true);
  spec.sections[0]!.items[0]!.templateVersion = 0;
  assert.equal(workbookIsCurrent(spec), false);
});
