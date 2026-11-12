import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  figureCapabilities,
  responseCapabilities,
  type GeneratedProblem,
} from "../src/math/contracts";
import {
  generateProblem,
  generateProblemFor,
  templates,
} from "../src/math/engine";
import { recordedVersionOf } from "../src/math/recorded-version";

/* (template, version, seed) is the source of truth for every served or
   printed problem: replays, workbook reprints, problem flags and reports
   regenerate from it. So the version a problem records must be the one it
   was generated at, and regenerating there must give the identical problem.
   Before this held, every template but count-objects recorded 1, and a
   version-2 template redrew about a third of its seeds differently. */

const digest = (problem: GeneratedProblem) =>
  createHash("sha256").update(JSON.stringify(problem)).digest("hex");
const seeds = ["served-version-0", "served-version-1", "served-version-2"];

test("every template records the version it generated at, and reproduces from it", () => {
  const failures: string[] = [];
  for (const template of templates)
    for (const seed of seeds) {
      const served = generateProblem(template.id, seed);
      const recorded = served.public.templateVersion;
      if (recorded !== template.version)
        failures.push(
          `${template.id} ${seed}: records ${recorded}, generated at ${template.version}`,
        );
      else if (
        digest(generateProblem(template.id, seed, recorded)) !== digest(served)
      )
        failures.push(
          `${template.id} ${seed}: version ${recorded} redraws differently`,
        );
    }
  assert.deepEqual(failures, []);
});

test("an older version records itself and reproduces from it", () => {
  const failures: string[] = [];
  for (const template of templates.filter((t) => t.version > 1))
    for (let v = template.reprintsFrom ?? 1; v < template.version; v++) {
      const old = generateProblem(template.id, seeds[0]!, v);
      if (old.public.templateVersion !== v)
        failures.push(
          `${template.id}@${v}: records ${old.public.templateVersion}`,
        );
      else if (
        digest(generateProblem(template.id, seeds[0]!, v)) !== digest(old)
      )
        failures.push(`${template.id}@${v}: redraws differently`);
    }
  assert.deepEqual(failures, []);
});

test("practice serve records the current version", () => {
  const failures: string[] = [];
  for (const template of templates) {
    const seed = seeds[0]!;
    const served = generateProblemFor(
      template.id,
      seed,
      figureCapabilities,
      undefined,
      responseCapabilities,
    );
    if (served.public.templateVersion !== template.version)
      failures.push(
        `${template.id}: records ${served.public.templateVersion}, served at ${template.version}`,
      );
    else if (
      served.public.prompt !==
      generateProblem(template.id, seed, served.public.templateVersion).public
        .prompt
    )
      failures.push(
        `${template.id}: version ${template.version} redraws a different prompt`,
      );
  }
  assert.deepEqual(failures, []);
});

/* Repairing the record on stored copies (scripts/repair-template-versions.ts). */
const template = "add-within-20";
const oldStamp = (problem: GeneratedProblem) => ({
  ...problem,
  public: { ...problem.public, templateVersion: 1 },
  // A stored copy also carries the server's own fields.
  selection: { reason: "review" },
  practiceEpoch: 3,
});

test("a copy recorded at 1 but drawn at the current version is repaired to it", () => {
  const meta = templates.find((t) => t.id === template)!;
  assert.ok(meta.version > 1);
  const seed = Array.from({ length: 50 }, (_, i) => `repair-${i}`).find(
    (s) =>
      generateProblem(template, s, 1).public.prompt !==
      generateProblem(template, s).public.prompt,
  )!;
  const verdict = recordedVersionOf(oldStamp(generateProblem(template, seed)));
  assert.deepEqual(verdict, {
    kind: "repair",
    tier: "whole",
    recorded: 1,
    version: meta.version,
    matches: [meta.version],
  });
  // Older code wrote a different explanation: the public problem still decides.
  const older = oldStamp(generateProblem(template, seed));
  older.explanation = ["An explanation since rewritten."];
  assert.equal(recordedVersionOf(older).kind, "repair");
  assert.equal((recordedVersionOf(older) as { tier: string }).tier, "public");
});

test("a copy that its recorded version regenerates is left alone", () => {
  const meta = templates.find((t) => t.id === template)!;
  const legacy = Array.from({ length: 50 }, (_, i) => `keep-${i}`).find(
    (s) =>
      generateProblem(template, s, 1).public.prompt ===
      generateProblem(template, s).public.prompt,
  )!;
  // A draw every version makes alike reproduces at 1 as well.
  assert.deepEqual(
    recordedVersionOf(oldStamp(generateProblem(template, legacy))),
    { kind: "ok", tier: "whole", recorded: 1 },
  );
  // A copy stamped by the fixed engine.
  assert.deepEqual(recordedVersionOf(generateProblem(template, "fixed-0")), {
    kind: "ok",
    tier: "whole",
    recorded: meta.version,
  });
  assert.deepEqual(
    recordedVersionOf({ public: { templateId: template }, answer: "3" }),
    { kind: "unmatched", reason: "no-origin", recorded: null },
  );
  assert.deepEqual(
    recordedVersionOf({
      public: { templateId: "retired-template", seed: "s", templateVersion: 1 },
    }),
    { kind: "unmatched", reason: "retired-template", recorded: 1 },
  );
});
