/**
 * Failing-case tests for every implemented gate.
 *
 * GATES.md: "Every gate ships with a test that **deliberately violates it** and
 * asserts the gate goes red. A gate with no failing-case test is indistinguishable
 * from a gate that silently passes everything, and this program has an in-repo
 * precedent for exactly that failure mode."
 *
 * So each block below builds a curriculum that breaks one rule and asserts the
 * gate fails *and* that the healthy graph passes it.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { rational } from "../math/rational.ts";
import { allNodes } from "../graph/graph.ts";
import { columnOpFamily } from "../generators/columnOp/family.ts";
import { generatorFamilies } from "../generators/registry.ts";
import { MIS_SMALLER_FROM_LARGER } from "../malrules/columnOp.ts";
import { malRules } from "../malrules/registry.ts";
import { rendererRegistry } from "../render/registry.ts";
import { erase } from "../types/generator.ts";
import type { AnyGeneratorFamily } from "../types/generator.ts";
import { capabilityTag, familyId, malRuleId, skillId } from "../types/ids.ts";
import type { LocKey, SkillId } from "../types/ids.ts";
import type { MalRule } from "../types/malrule.ts";
import type { SkillNode } from "../types/skill.ts";
import { defaultContext, buildSamples } from "./context.ts";
import type { LevelSample, ValidationContext } from "./context.ts";
import { cg1, cg2, cg3, cg4, cg5, cg6 } from "./gates/graphGates.ts";
import { cg13, cg22, cg7, cg8 } from "./gates/bindingGates.ts";
import { cg10, cg11, cg12, cg16, cg17, cg9 } from "./gates/generatorGates.ts";
import type { Snapshot } from "./gates/generatorGates.ts";
import { cg19, m05 } from "./gates/lintGates.ts";
import type { GateResult } from "./types.ts";

const SUBTRACT_MULTIDIGIT = skillId("dw.add.regroup.subtract-multidigit");
const SUBTRACT_ACROSS_ZERO = skillId("dw.add.regroup.subtract-across-zero");

function node(id: SkillId): SkillNode {
  const found = allNodes.find((candidate) => candidate.id === id);
  assert.ok(found !== undefined, `fixture needs ${id}`);
  return found;
}

function replace(id: SkillId, overrides: Partial<SkillNode>): SkillNode[] {
  return allNodes.map((candidate) => (candidate.id === id ? { ...candidate, ...overrides } : candidate));
}

function context(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return defaultContext({ seedsPerLevel: 40, ...overrides });
}

function messages(result: GateResult): string {
  return result.findings.map((finding) => `${finding.subject ?? ""} ${finding.message}`).join(" | ");
}

function assertFails(result: GateResult, expected: string): void {
  assert.equal(result.status, "fail", `expected ${result.gate} to fail, got ${result.status}`);
  assert.ok(
    messages(result).includes(expected),
    `expected ${result.gate} to mention ${JSON.stringify(expected)}, got: ${messages(result)}`,
  );
}

/** `curriculum/src` and `engine/src` — what the source-scanning gates read. */
const CURRICULUM_SRC = new URL("..", import.meta.url).pathname;
const SOURCE_ROOTS = [CURRICULUM_SRC, join(CURRICULUM_SRC, "..", "..", "engine", "src")];

/** The healthy graph. Every gate below must pass on it. */
test("gates: the committed curriculum passes every implemented gate", () => {
  const healthy = context();
  const samples = buildSamples(healthy);
  const snapshot: Snapshot = { note: "", entries: {} };
  for (const result of [
    cg1(healthy),
    cg2(healthy),
    cg3(healthy),
    cg4(healthy),
    cg5(healthy),
    cg6(healthy),
    cg7(healthy),
    cg8(healthy),
    cg9(healthy, samples),
    cg10(healthy, samples),
    cg11(healthy, samples),
    cg12(healthy, samples),
    cg13(healthy),
    cg16(healthy, snapshot, true, SOURCE_ROOTS).result,
    cg17(healthy, samples),
    cg22(healthy),
  ]) {
    assert.notEqual(result.status, "fail", `${result.gate} failed on the committed graph: ${messages(result)}`);
  }
});

test("CG-1: an id that shipped and then vanished fails", () => {
  const shipped = { note: "", releases: { "dynawalla-v1.0.0": ["dw.add.regroup.gone-forever"] } };
  assertFails(cg1(context({ shipped })), "no longer exists");
  assert.equal(cg1(context()).status, "pass");
});

test("CG-1: a shipped id demoted to draft fails", () => {
  const shipped = { note: "", releases: { "dynawalla-v1.0.0": [SUBTRACT_MULTIDIGIT] } };
  assert.equal(cg1(context({ shipped })).status, "pass");
  assertFails(
    cg1(context({ shipped, nodes: replace(SUBTRACT_MULTIDIGIT, { status: "draft" }) })),
    "demoted to draft",
  );
});

test("CG-1: a duplicate id, a mismatched domain and an orphan deprecation all fail", () => {
  assertFails(cg1(context({ nodes: [...allNodes, node(SUBTRACT_MULTIDIGIT)] })), "duplicate skill id");
  assertFails(cg1(context({ nodes: replace(SUBTRACT_MULTIDIGIT, { domain: "mul" }) })), "id domain");
  assertFails(cg1(context({ nodes: replace(SUBTRACT_MULTIDIGIT, { status: "deprecated" }) })), "no supersededBy");
});

test("CG-2: a prerequisite cycle fails and the message names the cycle", () => {
  const cyclic = replace(SUBTRACT_MULTIDIGIT, {
    prereqs: [{ kind: "requires", to: SUBTRACT_ACROSS_ZERO }],
  });
  const result = cg2(context({ nodes: cyclic }));
  assert.equal(result.status, "fail");
  assert.ok(messages(result).includes("->"), `expected a printed cycle, got: ${messages(result)}`);
  assert.ok(messages(result).includes(SUBTRACT_MULTIDIGIT));
  assert.ok(messages(result).includes(SUBTRACT_ACROSS_ZERO));
  assert.equal(cg2(context()).status, "pass");
});

test("CG-3: an edge to a node that does not exist fails", () => {
  const dangling = replace(SUBTRACT_ACROSS_ZERO, {
    prereqs: [{ kind: "requires", to: skillId("dw.add.regroup.not-a-node") }],
  });
  assertFails(cg3(context({ nodes: dangling })), "missing node");
  assertFails(
    cg3(context({ nodes: replace(SUBTRACT_ACROSS_ZERO, { prereqs: [{ kind: "requires", to: SUBTRACT_ACROSS_ZERO }] }) })),
    "self edge",
  );
  assert.equal(cg3(context()).status, "pass");
});

test("CG-4: an active node whose prerequisite is not active is unreachable", () => {
  const stranded = replace(SUBTRACT_MULTIDIGIT, { status: "draft" });
  assertFails(cg4(context({ nodes: stranded })), "unreachable");
});

test("CG-5: a prerequisite taught after its dependent fails", () => {
  const inverted = replace(SUBTRACT_MULTIDIGIT, {
    gradeBand: { earliest: 4, nominal: 5, latest: 6 },
  });
  assertFails(cg5(context({ nodes: inverted })), "after grade");
  assertFails(
    cg5(context({ nodes: replace(SUBTRACT_MULTIDIGIT, { gradeBand: { earliest: 4, nominal: 2, latest: 3 } }) })),
    "earliest <= nominal <= latest",
  );
  assert.equal(cg5(context()).status, "pass");
});

test("CG-6: consuming a capability no prerequisite provides fails, and it suggests the edge", () => {
  const orphaned = replace(SUBTRACT_ACROSS_ZERO, { prereqs: [] });
  const result = cg6(context({ nodes: orphaned }));
  assert.equal(result.status, "fail");
  assert.ok(messages(result).includes('add { kind: "requires"'), messages(result));
  assert.ok(messages(result).includes(SUBTRACT_MULTIDIGIT), messages(result));

  const unknown = replace(SUBTRACT_ACROSS_ZERO, {
    generator: { ...node(SUBTRACT_ACROSS_ZERO).generator, consumes: [capabilityTag("cap.arith.nobody-provides")] },
  });
  assertFails(cg6(context({ nodes: unknown })), "no active node provides it");
  assert.equal(cg6(context()).status, "pass");
});

test("CG-7: an active row with no working generator binding fails", () => {
  const binding = node(SUBTRACT_MULTIDIGIT).generator;
  assertFails(
    cg7(context({ nodes: replace(SUBTRACT_MULTIDIGIT, { generator: { ...binding, family: familyId("gen.arith.nope") } }) })),
    "unknown family",
  );
  assertFails(
    cg7(context({ nodes: replace(SUBTRACT_MULTIDIGIT, { generator: { ...binding, familyRev: 99 } }) })),
    "the family is at rev 1",
  );
  assertFails(
    cg7(context({ nodes: replace(SUBTRACT_MULTIDIGIT, { generator: { ...binding, params: [{ op: "sub" }] } }) })),
    "params invalid",
  );
  assertFails(
    cg7(context({ nodes: replace(SUBTRACT_MULTIDIGIT, { generator: { ...binding, forms: ["dial"] } }) })),
    "is not one of",
  );
  assert.equal(cg7(context()).status, "pass");
});

test("CG-7: a registered family that no active skill binds fails", () => {
  const orphan: AnyGeneratorFamily = { ...erase(columnOpFamily), family: familyId("gen.arith.unbound") };
  assertFails(cg7(context({ families: [...generatorFamilies, orphan] })), "bound by no active skill");
});

test("CG-8: a required representation with no renderer fails", () => {
  const needsBoard = replace(SUBTRACT_ACROSS_ZERO, {
    representations: { required: ["water-clock"], optional: [] },
  });
  assertFails(cg8(context({ nodes: needsBoard })), "has no registered renderer");
});

test("CG-8: strict mode rejects a renderer that is declared but not implemented", () => {
  // The violation is **constructed**, not borrowed from the shipped registry.
  // It used to be borrowed: `integer`, `columnAlgorithm` and the counting board
  // were all declared and unimplemented, so this test read its failing case off
  // the real data — and the day the app grew those renderers, the test would
  // have gone green while asserting nothing at all. A failing-case test that
  // depends on the shipped data being broken stops being a test the moment it
  // is fixed, which is the failure mode GATES.md names in as many words.
  const unbuilt = rendererRegistry.map((entry) =>
    entry.id === "answer:integer"
      ? { id: entry.id, kind: entry.kind, owner: entry.owner, implemented: false }
      : entry,
  );
  assert.equal(
    cg8(context({ renderers: unbuilt })).status,
    "warn",
    "the default mode allows authoring ahead of the work surface",
  );
  assertFails(cg8(context({ renderers: unbuilt, strictRenderers: true })), "declared but not implemented");

  // …and the registry this repository actually ships passes both modes: every
  // schema and representation the active graph reaches is drawn by the app, and
  // `dynawalla-app/src/work/renderers.test.ts` is what keeps that claim true
  // from the other side.
  assert.equal(cg8(context()).status, "pass");
  assert.notEqual(cg8(context({ strictRenderers: true })).status, "fail");
});

test("CG-8: a renderer declaration with no owner, or implemented with no test, fails", () => {
  assertFails(
    cg8(context({ renderers: rendererRegistry.map((entry) => ({ ...entry, owner: "" })) })),
    "has no owner",
  );
  assertFails(
    cg8(context({ renderers: rendererRegistry.map((entry) => ({ ...entry, implemented: true })) })),
    "no testRef",
  );
});

test("CG-9: a level that cannot reach minVariants fails", () => {
  const greedy = replace(SUBTRACT_MULTIDIGIT, {
    generator: { ...node(SUBTRACT_MULTIDIGIT).generator, minVariants: 10000 },
  });
  const broken = context({ nodes: greedy });
  assertFails(cg9(broken, buildSamples(broken)), "below minVariants");
});

test("CG-9: a difficulty table that disagrees with the parameters fails", () => {
  const drifted = replace(SUBTRACT_MULTIDIGIT, {
    difficulty: { b: rational(-50n, 100n), levels: [rational(1n), rational(35n, 100n), rational(90n, 100n), rational(120n, 100n)] },
  });
  const broken = context({ nodes: drifted });
  assertFails(cg9(broken, buildSamples(broken)), "the parameters compute");
});

test("CG-9: levels that do not get harder fail", () => {
  const flat = replace(SUBTRACT_MULTIDIGIT, {
    generator: {
      ...node(SUBTRACT_MULTIDIGIT).generator,
      params: [
        { op: "sub", digits: 3, operandDigits: 3, regroupings: 2, acrossZero: 0, decimalPlaces: 0, allowZeroResult: false },
        { op: "sub", digits: 2, operandDigits: 2, regroupings: 1, acrossZero: 0, decimalPlaces: 0, allowZeroResult: false },
      ],
    },
    difficulty: { b: rational(-50n, 100n), levels: [rational(90n, 100n), rational(5n, 100n)] },
  });
  const broken = context({ nodes: flat });
  assertFails(cg9(broken, buildSamples(broken)), "is not above");
});

test("CG-10: a level whose variant space is too small fails", () => {
  const narrow = replace(SUBTRACT_MULTIDIGIT, {
    generator: {
      ...node(SUBTRACT_MULTIDIGIT).generator,
      // 2-digit minuend, single-digit subtrahend, one borrow: 45 × 9 = 405 problems
      // in total, so a 40-item practice run would repeat about two of them.
      params: [{ op: "sub", digits: 2, operandDigits: 1, regroupings: 1, acrossZero: 0, decimalPlaces: 0, allowZeroResult: false }],
    },
    difficulty: { b: rational(-50n, 100n), levels: [rational(5n, 100n)] },
  });
  const broken = context({ nodes: narrow, seedsPerLevel: 400 });
  assertFails(cg10(broken, buildSamples(broken)), "below the floor");
  // And the floor is not a restatement of what the author wrote: minVariants is
  // untouched here, and the healthy graph passes with the same 24 on every node.
  const healthy = context({ seedsPerLevel: 400 });
  assert.equal(cg10(healthy, buildSamples(healthy)).status, "pass");
});

test("CG-11: a checker that accepts a distractor fails", () => {
  const healthy = context();
  const samples = buildSamples(healthy);
  const permissive: LevelSample[] = samples.map((sample) => ({
    ...sample,
    family:
      sample.family === undefined
        ? undefined
        : ({ ...sample.family, check: () => ({ correct: true }) } as AnyGeneratorFamily),
  }));
  assertFails(cg11(healthy, permissive), "checker accepts a distractor");

  const rejecting: LevelSample[] = samples.map((sample) => ({
    ...sample,
    family:
      sample.family === undefined
        ? undefined
        : ({ ...sample.family, check: () => ({ correct: false }) } as AnyGeneratorFamily),
  }));
  assertFails(cg11(healthy, rejecting), "rejects its own canonical answer");

  // …and an item whose schema cannot be drawn fails here too, before it reaches
  // a surface that would throw on it. A `choice` set with the same number twice
  // is two right answers on one card; nothing emits one today, which is why the
  // gate has to be standing when something does.
  const undrawable: LevelSample[] = samples.map((sample) => ({
    ...sample,
    exercises: sample.exercises.map((exercise) => ({
      ...exercise,
      schema: {
        kind: "choice" as const,
        k: 2 as const,
        options: [
          { kind: "fraction" as const, num: 1n, den: 2n },
          { kind: "number" as const, value: rational(1n, 2n), decimalPlaces: 1 },
        ],
      },
    })),
  }));
  assertFails(cg11(healthy, undrawable), "the same number")
});

test("CG-12: a mal-rule that reproduces the correct answer fails", () => {
  const impostor: MalRule = {
    id: malRuleId("mis.add.not-really-a-bug"),
    family: columnOpFamily.family,
    locateCapable: false,
    applies: () => true,
    apply: (exercise) => exercise.answer.canonical,
  };
  const broken = context({ malRules: [...malRules, impostor] });
  assertFails(cg12(broken, buildSamples(broken)), "below 95%");
});

test("CG-12: a mal-rule nothing can trigger is reported, not silently green", () => {
  const inert: MalRule = {
    id: malRuleId("mis.add.never-fires"),
    family: columnOpFamily.family,
    locateCapable: false,
    applies: () => false,
    apply: () => null,
  };
  // Against the healthy registry, so the only thing this fixture changes is the
  // rule that cannot fire.
  const ctx = context({ malRules: [...malRules, inert] });
  const result = cg12(ctx, buildSamples(ctx));
  assert.equal(result.status, "warn", messages(result));
  assert.ok(messages(result).includes("no sampled item triggers"));
});

test("CG-12: a node that declares a mal-rule nothing resolves, or one from another family, fails", () => {
  const ghost = replace(SUBTRACT_MULTIDIGIT, { misconceptions: [malRuleId("mis.add.not-in-the-registry")] });
  const ghostContext = context({ nodes: ghost });
  assertFails(cg12(ghostContext, buildSamples(ghostContext)), "which no registered mal-rule resolves");

  const foreign: MalRule = {
    id: malRuleId("mis.mul.times-table-slip"),
    family: familyId("gen.arith.times-table"),
    locateCapable: false,
    applies: () => false,
    apply: () => null,
  };
  const borrowed = context({
    nodes: replace(SUBTRACT_MULTIDIGIT, { misconceptions: [foreign.id] }),
    malRules: [...malRules, foreign],
  });
  assertFails(cg12(borrowed, buildSamples(borrowed)), "but binds gen.arith.column-op");
});

test("CG-12: a diagnosis the items emit but the node does not declare fails", () => {
  // `subtract-multidigit` does not ask for a zero in the minuend, but one is drawn
  // often enough that 155 items in 4,000 offer the across-zero distractor. A
  // diagnosis that reaches the scheduler and is not on the node has nowhere to
  // route — this is what stops `misconceptions` becoming decorative metadata.
  const undeclared = replace(SUBTRACT_MULTIDIGIT, { misconceptions: [MIS_SMALLER_FROM_LARGER] });
  const broken = context({ nodes: undeclared, seedsPerLevel: 400 });
  assertFails(
    cg12(broken, buildSamples(broken)),
    "items emit mis.add.borrow-across-zero as a distractor, which the node does not declare",
  );
});

test("CG-13: a conceptual skill answered by picking from a list fails", () => {
  const choiceFamily: AnyGeneratorFamily = {
    ...erase(columnOpFamily),
    family: familyId("gen.arith.pick-one"),
    choiceOnly: true,
  };
  const laundered = replace(SUBTRACT_MULTIDIGIT, {
    classification: "conceptual",
    generator: { ...node(SUBTRACT_MULTIDIGIT).generator, family: choiceFamily.family },
  });
  assertFails(
    cg13(context({ nodes: laundered, families: [...generatorFamilies, choiceFamily] })),
    "choice-only family",
  );
  assert.equal(cg13(context({ nodes: replace(SUBTRACT_MULTIDIGIT, { classification: "conceptual" }) })).status, "pass");
});

test("CG-16: a changed output hash fails, and a missing one fails", () => {
  const healthy = context();
  const key = `gen.arith.column-op@1|${SUBTRACT_MULTIDIGIT}|L0`;
  const truthful = cg16(healthy, { note: "", entries: {} }, true, []).next;
  assert.notEqual(truthful.entries[key], undefined);
  assert.equal(cg16(healthy, truthful, false, []).result.status, "pass");

  assertFails(cg16(healthy, { note: "", entries: {} }, false, []).result, "no committed hash");
  const tampered: Snapshot = { note: "", entries: { ...truthful.entries, [key]: "0000000000000000" } };
  assertFails(cg16(healthy, tampered, false, []).result, "does not match the committed");
});

test("CG-16: ordering a list by locale collation fails, and the committed sources do not", () => {
  // The hole the in-process comparison and the two-runner hash both leave open:
  // ICU collation is stable within a process and across two runners with the same
  // ICU data, and disagrees with code-unit order on a device.
  const healthy = context();
  const dir = mkdtempSync(join(tmpdir(), "dw-cg16-"));
  try {
    // Assembled, so this test file does not trip the lint it is testing.
    writeFileSync(join(dir, "bad.ts"), `export const s = ids.sort((a, b) => a.locale${"Compare"}(b));\n`, "utf8");
    assertFails(cg16(healthy, { note: "", entries: {} }, true, [dir]).result, "locale-dependent collation");

    writeFileSync(join(dir, "bad.ts"), "export const s = [...ids].sort();\n", "utf8");
    assert.equal(cg16(healthy, { note: "", entries: {} }, true, [dir]).result.status, "pass");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  assert.equal(cg16(healthy, { note: "", entries: {} }, true, SOURCE_ROOTS).result.status, "pass");
});

test("CG-16: a familyRev bump asks for a new snapshot rather than silently reusing the old one", () => {
  const healthy = context();
  const truthful = cg16(healthy, { note: "", entries: {} }, true, []).next;
  const bumped: AnyGeneratorFamily = { ...erase(columnOpFamily), familyRev: 2 };
  const revved = context({ families: [bumped] });
  assertFails(cg16(revved, truthful, false, []).result, "no committed hash");
});

test("CG-17: generation slower than the budget fails", () => {
  const healthy = context();
  const samples = buildSamples(healthy);
  const slow: LevelSample[] = samples.map((sample) => ({
    ...sample,
    timingsNs: sample.timingsNs.map(() => 6_000_000n),
  }));
  assertFails(cg17(healthy, slow), "p95");
  assert.equal(cg17(healthy, samples).status, "pass");
});

test("CG-19: a bare string prompt in source fails", () => {
  const dir = mkdtempSync(join(tmpdir(), "dw-cg19-"));
  try {
    // Assembled rather than written literally, so this test file does not trip the
    // lint it is testing.
    writeFileSync(join(dir, "bad.ts"), `export const e = { ${"prompt"}: ${'"7 minus 4"'} };\n`, "utf8");
    assertFails(cg19([], [dir]), "bare string prompt");
    writeFileSync(join(dir, "bad.ts"), "export const e = { prompt: { key: KEY, slots: {} } };\n", "utf8");
    assert.equal(cg19([], [dir]).status, "pass");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CG-19: an emitted locale key that is not a locale key fails", () => {
  const healthy = context();
  const samples = buildSamples(healthy);
  const first = samples[0];
  assert.ok(first !== undefined && first.exercises[0] !== undefined);
  const broken: LevelSample = {
    ...first,
    // Cast: `locKey()` would refuse to build this, which is the point — the gate
    // is the backstop for a key that reached an item some other way.
    exercises: [{ ...first.exercises[0], prompt: { ...first.exercises[0].prompt, key: "dw.x" as LocKey } }],
  };
  // `dw.x` has too few segments to be a template key.
  assertFails(cg19([broken], []), "does not match the key pattern");
  assert.equal(cg19(samples, []).status, "pass");
});

test("M-05: a float in curriculum or engine source fails the lint", () => {
  const dir = mkdtempSync(join(tmpdir(), "dw-m05-"));
  try {
    const tenth = `0${"."}1`;
    const fifth = `0${"."}2`;
    writeFileSync(join(dir, "bad.ts"), `export const wrong = ${tenth} + ${fifth};\n`, "utf8");
    assertFails(m05([dir]), "fractional numeric literal");

    writeFileSync(join(dir, "bad.ts"), `export const r = Math${"."}random();\n`, "utf8");
    assertFails(m05([dir]), "Math member");

    writeFileSync(join(dir, "bad.ts"), `export const p = parse${"Float"}("1");\n`, "utf8");
    assertFails(m05([dir]), "parseFloat");

    writeFileSync(join(dir, "bad.ts"), `export const s = (1).to${"Fixed"}(2);\n`, "utf8");
    assertFails(m05([dir]), "toFixed");

    // The same text inside a comment or a string is not a violation, or the lint
    // would fire on its own documentation.
    writeFileSync(join(dir, "bad.ts"), `// coefficient ${tenth}\nexport const ok = "${tenth}";\n`, "utf8");
    assert.equal(m05([dir]).status, "pass");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("M-05: the committed curriculum and engine sources are float-free", () => {
  const here = new URL("..", import.meta.url).pathname;
  const result = m05([here, join(here, "..", "..", "engine", "src")]);
  assert.equal(result.status, "pass", messages(result));
});

test("CG-22: a LOCATE claim with no contrast representation fails", () => {
  const unbacked: MalRule = {
    id: malRuleId("mis.add.claims-locate"),
    family: columnOpFamily.family,
    locateCapable: true,
    applies: () => false,
    apply: () => null,
  };
  assertFails(cg22(context({ malRules: [unbacked] })), "no contrast representation");

  const undrawable: MalRule = { ...unbacked, contrastRep: "astrolabe" };
  assertFails(cg22(context({ malRules: [undrawable] })), "no registered renderer");
  assert.equal(cg22(context()).status, "pass");
});
