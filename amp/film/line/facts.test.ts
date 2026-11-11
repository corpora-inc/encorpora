import { expect, it } from "vitest";
import { skills } from "../../src/curriculum/catalog";
import { templates } from "../../src/math/engine";
import { buildSkillFacts } from "./facts";

it("includes every template of the skill and preserves exact standard text", () => {
  const skill = skills.find(s => s.id === "slope")!;
  const standard = { code: "fixture", aliases: skill.alignments.map(a => a.standardId),
    text: "Synthetic exact text.\nSecond line.", parts: [{ label: "a", text: "Exact part." }], source: "fixture" };
  const pack = buildSkillFacts(skill.id, [standard]);
  expect(pack.skill).toEqual(skill);
  expect(pack.standards).toEqual([standard]);
  expect(pack.problem_types.map(p => p.type)).toEqual(templates.filter(t => t.skillId === skill.id).map(t => t.id));
  expect(pack.problem_types.every(p => p.problems.length === 10 && p.kit_figure.named_parts)).toBe(true);
  expect(() => buildSkillFacts("missing-skill", [])).toThrow("Unknown skill");
}, 120_000); // generates ten problems for each of the skill's ten types; slow on a shared runner
