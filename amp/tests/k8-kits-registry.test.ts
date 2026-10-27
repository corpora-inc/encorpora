import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem, templates } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import { lessons } from "../src/content/lessons";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { family as multiTermChain } from "../src/families/multi-term-chain";
import { family as operationSentence } from "../src/families/operation-sentence";
import { family as oneStepResult } from "../src/families/one-step-result";

const kits = [multiTermChain, operationSentence, oneStepResult];
const ids = kits.flatMap((k) => k.practice.templates.map((t) => t.id));

test("the three kits register 13 templates, each reachable through the engine", () => {
  assert.equal(ids.length, 13);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    const template = templates.find((t) => t.id === id);
    assert.ok(template, `${id} is registered`);
    for (let i = 0; i < 40; i++) {
      const p = generateProblem(id, `reg:${i}`);
      assert.equal(p.public.templateId, id);
      generatedProblemSchema.parse(p);
    }
  }
});

test("each kit template has a method, principle, one lesson and a partial facet mapping", () => {
  for (const id of ids) {
    assert.ok(methods[id]?.watch, `${id} method`);
    assert.ok(principles[id], `${id} principle`);
    assert.equal(
      lessons.filter((l) => l.templateIds.includes(id)).length,
      1,
      `${id} lesson`,
    );
    assert.ok(
      actualFacetMappings.some(
        (f) => f.templateId === id && f.extent === "partial",
      ),
      `${id} facet`,
    );
  }
});

test("each kit template names the archetypes it practices", () => {
  for (const kit of kits)
    for (const t of kit.practice.templates)
      assert.ok(
        (kit.archetypeLinks as Record<string, string[]>)[t.id]?.length,
        `${t.id} archetype links`,
      );
});
