import { test } from "node:test";
import assert from "node:assert/strict";
import { spokenMath } from "../src/web/MathText";
import { planMixedPractice, templateGrade } from "../src/server/mixed-practice";
import { estimateFrontier, initialLevel } from "../src/learning/frontier";
import {
  OPENER_COUNT,
  PLACEMENT_ATTEMPTS,
  openerSlots,
  scaffoldTemplateIds,
  templateRole,
} from "../src/learning/placement";
import { projectSkillEvidence } from "../src/server/evidence.js";
import { generateProblem, templates } from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";
import { guessChance, guessChanceOf } from "../src/math/guess-chance";
import type { Outcome } from "../src/server/repository";

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const byId = new Map(templates.map((template) => [template.id, template]));
const gradeOf = (id: string) => templateGrade(byId.get(id)!, nodes);
const strandOf = (id: string) => nodes.get(byId.get(id)!.skillId)!.strand;
const october = Date.parse("2026-10-17T12:00:00Z");

/** A new learner's first `count` problems, one request per answer, as the app
 * asks for them. Answers alternate so both outcomes are exercised. */
function firstProblems(
  birthYear: number,
  learnerKey: string,
  count: number,
  catalog = templates,
) {
  const attempts: Outcome[] = [];
  const start = initialLevel({ birthYear, now: october });
  for (let i = 0; i < count; i++) {
    const at = october + i * 60000;
    const [choice] = planMixedPractice({
      templates: catalog,
      skills,
      attempts,
      evidence: projectSkillEvidence(attempts),
      frontier: estimateFrontier({
        start,
        observations: attempts,
        gradeOf,
        strandOf,
        guessOf: guessChanceOf,
        now: at,
      }),
      count: 1,
      seed: `batch:${i}`,
      now: at,
      learnerKey,
    });
    const template = choice!.template;
    attempts.push({
      id: `${learnerKey}:${i}`,
      problemId: `${learnerKey}:p${i}`,
      requestId: `${learnerKey}:r${i}`,
      skillId: template.skillId,
      templateId: template.id,
      response: "1",
      correct: i % 3 !== 2,
      assisted: false,
      explanation: [],
      answer: "1",
      createdAt: new Date(at).toISOString(),
    });
  }
  return { start, ids: attempts.map((attempt) => attempt.templateId) };
}

test("every role and opener names a real, whole item every client can draw", () => {
  for (const id of scaffoldTemplateIds) assert.ok(byId.has(id), id);
  for (const [band, slots] of openerSlots.entries()) {
    assert.equal(slots.length, OPENER_COUNT, `band ${band}`);
    // One strand per slot; neighbours differ so the opening batch interleaves.
    const strands = slots.map((pool) => {
      const own = new Set(pool.map(strandOf));
      assert.equal(own.size, 1, `band ${band}: ${pool}`);
      return [...own][0];
    });
    strands
      .slice(1)
      .forEach((strand, i) =>
        assert.notEqual(strand, strands[i], `band ${band} slot ${i + 2}`),
      );
    if (band > 0)
      assert.equal(new Set(strands.slice(0, 3)).size, 3, `band ${band}`);
    // This year's or last year's material; high school opens on grade 8
    // and Algebra 1.
    const top = Math.min(band, 9);
    for (const pool of slots)
      for (const id of pool) {
        const template = byId.get(id);
        assert.ok(template, id);
        assert.equal(templateRole(id), "assessment", id);
        // A choice opener needs at least three options: a correct pick on a
        // two-way choice is mostly luck and says little about the learner.
        assert.ok(guessChance(template) <= 1 / 3, id);
        assert.equal(template.requiredFigureCapability, undefined, id);
        const grade = gradeOf(id);
        assert.ok(
          grade <= top && grade >= Math.max(0, top - 1),
          `${id} is grade ${grade}, band ${band}`,
        );
        // Short enough to read at a glance as a first impression.
        for (const seed of ["a", "b", "c"])
          assert.ok(
            // Characters a reader sees: TeX delimiters are not read.
            spokenMath(generateProblem(id, seed).public.prompt).length <= 160,
            `${id}: ${generateProblem(id, seed).public.prompt}`,
          );
      }
  }
});

test("every birth year from 2010 to 2022 opens on its curated, confidence-building sequence", () => {
  for (let birthYear = 2010; birthYear <= 2022; birthYear++)
    for (const sibling of ["first", "second", "third"]) {
      const learnerKey = `${birthYear}:${sibling}`;
      const { start, ids } = firstProblems(birthYear, learnerKey, 8);
      const slots = openerSlots[Math.min(start, openerSlots.length - 1)]!;
      ids
        .slice(0, OPENER_COUNT)
        .forEach((id, position) =>
          assert.ok(
            slots[position]!.includes(id),
            `${birthYear} problem ${position + 1}: ${id}`,
          ),
        );
      // The sequence is fixed for a learner, across every request.
      assert.deepEqual(firstProblems(birthYear, learnerKey, 8).ids, ids);
    }
});

test("choice openers bring measurement into K–2 placement; typed-only clients still get typed openers", () => {
  for (const birthYear of [2019, 2020, 2021]) {
    const { start, ids } = firstProblems(
      birthYear,
      `${birthYear}`,
      OPENER_COUNT,
    );
    assert.ok(start <= 2, String(start));
    assert.ok(
      ids.some((id) => strandOf(id) === "measurement"),
      `${ids}`,
    );
  }
  // A client without single-choice support never receives a choice item; a
  // slot it cannot draw falls through to adaptive selection.
  const typed = templates.filter((template) => guessChance(template) === 0);
  for (let birthYear = 2010; birthYear <= 2022; birthYear++) {
    const { start, ids } = firstProblems(birthYear, "typed", 8, typed);
    assert.ok(
      ids.every((id) => guessChance(byId.get(id)!) === 0),
      `${ids}`,
    );
    const slots = openerSlots[Math.min(start, openerSlots.length - 1)]!;
    ids.slice(0, OPENER_COUNT).forEach((id, position) => {
      if (slots[position]!.some((own) => guessChance(byId.get(own)!) === 0))
        assert.ok(slots[position]!.includes(id), `${birthYear}: ${id}`);
    });
  }
});

test("siblings of the same age do not all start identically", () => {
  for (const birthYear of [2014, 2016, 2018]) {
    const starts = new Set(
      Array.from({ length: 12 }, (_, i) =>
        firstProblems(birthYear, `sibling-${i}`, OPENER_COUNT).ids.join(),
      ),
    );
    assert.ok(starts.size >= 2, `${birthYear}: ${[...starts]}`);
  }
});

test("placement never shows a method-step scaffold", () => {
  for (let birthYear = 2010; birthYear <= 2022; birthYear++) {
    const { ids } = firstProblems(
      birthYear,
      `${birthYear}`,
      PLACEMENT_ATTEMPTS,
    );
    for (const id of ids)
      assert.equal(templateRole(id), "assessment", `${birthYear}: ${id}`);
  }
});

test("scaffolds return to practice once the learner is placed", () => {
  const scaffold = byId.get("tens-contribution")!;
  const attempts: Outcome[] = Array.from(
    { length: PLACEMENT_ATTEMPTS },
    (_, i) => ({
      id: `a${i}`,
      problemId: `p${i}`,
      requestId: `r${i}`,
      skillId: "add-within-20",
      templateId: "add-within-20",
      response: "1",
      correct: true,
      assisted: false,
      explanation: [],
      answer: "1",
      createdAt: new Date(october - 86400000 + i * 60000).toISOString(),
    }),
  );
  const plan = (history: Outcome[]) =>
    planMixedPractice({
      templates: [scaffold],
      skills,
      attempts: history,
      evidence: projectSkillEvidence(history),
      frontier: estimateFrontier({
        start: 4,
        observations: history,
        gradeOf,
        strandOf,
        guessOf: guessChanceOf,
        now: october,
      }),
      count: 1,
      seed: "s",
      now: october,
    });
  assert.equal(plan(attempts.slice(0, 5)).length, 0);
  assert.equal(plan(attempts)[0]?.template.id, "tens-contribution");
});
