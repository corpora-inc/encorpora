import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import {
  familyFiles,
  familyIndexLines,
  renderFamilyIndex,
} from "../scripts/gen-family-index";
import {
  aggregateFamilies,
  withFamilyEntries,
} from "../src/families/registry/aggregate";
import { familyRegistry } from "../src/families/registry";
import type { ContentFamily } from "../src/families/registry/types";
import { generateProblem, templates } from "../src/math/engine";
import { lessons } from "../src/content/lessons";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { templateArchetypes } from "../src/curriculum/template-archetypes";
import { archetypes } from "../src/curriculum/archetypes";
import { curriculumConnections } from "../src/curriculum/connections";
import { satTasks } from "../src/curriculum/sat-coverage";
import { releasedLedgers } from "../src/curriculum/released-items";
import type { GeneratedProblem } from "../src/math/contracts";

const directory = new URL("../src/families/", import.meta.url);

test("the committed family index lists exactly the descriptor files, in any order", () => {
  const ids = familyFiles(readdirSync(directory));
  assert.deepEqual(
    familyIndexLines(readFileSync(new URL("index.ts", directory), "utf8")),
    familyIndexLines(renderFamilyIndex(ids)),
    "run npm run families:index",
  );
  assert.deepEqual(
    familyRegistry.families.map((f) => f.id),
    ids,
  );
});

test("each descriptor is named for its file", async () => {
  for (const id of familyFiles(readdirSync(directory))) {
    const module = (await import(new URL(`${id}.ts`, directory).href)) as {
      family?: ContentFamily;
    };
    assert.equal(module.family?.id, id, `src/families/${id}.ts`);
  }
});

test("registries append families after their legacy entries, in family-id order", () => {
  const tail = <T>(list: readonly T[], part: readonly T[]) =>
    assert.deepEqual(list.slice(list.length - part.length), [...part]);
  // The engine merges each template's glossary senses into a copy
  // (math/template-glossary.ts), so order is checked by id.
  tail(
    templates.map((t) => t.id),
    familyRegistry.templates.map((t) => t.id),
  );
  tail(lessons, familyRegistry.lessons);
  tail(actualFacetMappings, familyRegistry.facetMappings);
  tail(archetypes, familyRegistry.archetypes);
  tail(releasedLedgers, familyRegistry.releasedLedgers);
  tail(
    curriculumConnections.map((c) => c.from + "|" + c.to),
    familyRegistry.connections.map((c) => c.from + "|" + c.to),
  );
  tail(
    satTasks.map((t) => t.id),
    familyRegistry.satTasks.map((t) => t.id),
  );
  for (const [key, value] of Object.entries(familyRegistry.methods))
    assert.equal(methods[key], value);
  for (const [key, value] of Object.entries(familyRegistry.principles))
    assert.equal(principles[key], value);
  for (const [key, value] of Object.entries(familyRegistry.archetypeLinks))
    assert.equal(templateArchetypes[key], value);
  for (const [task, ids] of Object.entries(familyRegistry.satTaskTemplates)) {
    const row = satTasks.find((t) => t.id === task);
    assert(row, `Unknown SAT task ${task}`);
    tail(row.templateIds, ids);
  }
  const ids = templates.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "Duplicate template id");
  for (const template of familyRegistry.templates) {
    const problem = generateProblem(template.id, "family-index-0");
    assert.equal(problem.public.templateId, template.id);
  }
});

const problem = (templateId: string, seed: string): GeneratedProblem => ({
  public: {
    id: `${templateId}:${seed}`,
    templateId,
    templateVersion: 1,
    seed,
    prompt: "What is 1 + 1?",
    skillId: "skill",
    response: { kind: "number", label: "Answer" },
  },
  answer: "2",
  explanation: [],
  hint: "",
});
const template = (id: string) => ({
  id,
  version: 1 as const,
  title: id,
  skillId: "skill",
  gradeBand: "K–2" as const,
  description: id,
});

test("aggregation orders families by id, dispatches their templates and rejects collisions", () => {
  const zeta: ContentFamily = {
    id: "zeta",
    practice: {
      templates: [template("z-1")],
      generate: problem,
      preserveAlgebra: true,
    },
    methods: { "z-1": { goal: "z", method: ["z"], watch: "z" } },
    satTaskTemplates: { "linear.solve": ["z-1"] },
  };
  const alpha: ContentFamily = {
    id: "alpha",
    practice: {
      templates: [template("a-1"), template("a-2")],
      generate: problem,
      preserveAlgebra: false,
    },
    principles: { "a-1": "A." },
    satTaskTemplates: { "linear.solve": ["a-1"] },
  };
  const ledgerOnly: ContentFamily = { id: "beta-ledger", releasedLedgers: [] };
  const aggregate = aggregateFamilies([zeta, ledgerOnly, alpha]);
  assert.deepEqual(
    aggregate.families.map((f) => f.id),
    ["alpha", "beta-ledger", "zeta"],
  );
  assert.deepEqual(
    aggregate.templates.map((t) => t.id),
    ["a-1", "a-2", "z-1"],
  );
  assert.equal(aggregate.generators.get("a-2")!("a-2", "s").answer, "2");
  assert.deepEqual([...aggregate.preserveAlgebra], ["z-1"]);
  assert.deepEqual(aggregate.satTaskTemplates, {
    "linear.solve": ["a-1", "z-1"],
  });
  assert.throws(
    () => aggregateFamilies([alpha, { ...zeta, id: "alpha" }]),
    /Duplicate family: alpha/,
  );
  assert.throws(
    () =>
      aggregateFamilies([
        alpha,
        { id: "other", practice: { ...alpha.practice! } },
      ]),
    /Template a-1 is defined by more than one family/,
  );
  assert.throws(
    () =>
      aggregateFamilies([alpha, { id: "other", principles: { "a-1": "" } }]),
    /Families alpha and other both define principle a-1/,
  );
  assert.throws(() => aggregateFamilies([{ id: "Bad_id" }]), /kebab-case/);
  assert.throws(
    () => withFamilyEntries("method", { a: 1 }, { a: 2 }),
    /redefines the legacy method a/,
  );
  assert.deepEqual(
    Object.keys(withFamilyEntries("method", { b: 1, a: 1 }, { c: 2 })),
    ["b", "a", "c"],
  );
});

test("the index renderer is deterministic and rejects ambiguous file names", () => {
  assert.equal(
    renderFamilyIndex(familyFiles(["b-two.ts", "index.ts", "a.ts", "x.md"])),
    [
      "// Generated by `npm run families:index`: one line per src/families/<id>.ts,",
      "// sorted by file name. Add a family by adding its descriptor and running the",
      "// script; tests/family-index.test.ts fails when this file is stale.",
      "export {};",
      'export { family as a } from "./a";',
      'export { family as bTwo } from "./b-two";',
      "",
    ].join("\n"),
  );
  assert.throws(() => renderFamilyIndex(["Bad"]), /kebab-case/);
  assert.throws(() => renderFamilyIndex(["a-b1", "a-b-1"]), /share aB1/);
});

test("index line order does not matter and the registry sorts by id", () => {
  const ids = familyFiles(readdirSync(directory));
  const shuffled = renderFamilyIndex([...ids].reverse());
  assert.notEqual(shuffled, renderFamilyIndex(ids));
  assert.deepEqual(
    familyIndexLines(shuffled),
    familyIndexLines(renderFamilyIndex(ids)),
  );
  const reversed = [...familyRegistry.families].reverse();
  assert.deepEqual(
    aggregateFamilies(reversed).families.map((f) => f.id),
    familyRegistry.families.map((f) => f.id),
  );
});
