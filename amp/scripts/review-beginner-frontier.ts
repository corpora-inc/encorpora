/** Reproducible scheduling observations; this is not an educational efficacy study. */
import assert from "node:assert/strict";
import { templates } from "../src/math/engine.js";
import { skills } from "../src/curriculum/catalog.js";
import { planMixedPractice } from "../src/server/mixed-practice.js";
import { projectSkillEvidence } from "../src/server/evidence.js";
import type { Outcome } from "../src/server/repository.js";
const now = Date.parse("2026-10-17T12:00:00Z");
const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const distributions: Record<string, Record<string, number>> = {};
for (const count of [1, 3, 5])
  for (const legacy of [false, true]) {
    const key = `${legacy ? "numeric-legacy" : "current"}-${count}`,
      distribution: Record<string, number> = {};
    for (let seed = 0; seed < 200; seed++) {
      const candidates = legacy
        ? templates.filter(
            (t) => !t.requiredFigureCapability && !t.requiredResponseCapability,
          )
        : templates;
      const choices = planMixedPractice({
        templates: candidates,
        skills,
        attempts: [],
        evidence: [],
        count,
        seed: `audit-${seed}`,
        now,
      });
      let probes = 0;
      for (const { template } of choices) {
        distribution[template.id] = (distribution[template.id] ?? 0) + 1;
        const parents = nodes.get(template.skillId)!.prerequisites;
        if (parents.length) {
          probes++;
          assert.ok(
            parents.every((id) => nodes.get(id)!.prerequisites.length === 0),
          );
        }
      }
      assert.ok(probes <= (count === 1 ? 0 : 1));
    }
    distributions[key] = distribution;
  }
const trajectories = [];
for (const profile of [
  "independent",
  "counting-needs-support",
  "assistance",
] as const)
  for (const count of [1, 3])
    for (let seed = 0; seed < 20; seed++) {
      const attempts: Outcome[] = [],
        sequences = [];
      for (let batch = 0; batch < 20; batch++) {
        const at = now + batch * 180000;
        const evidence = projectSkillEvidence(attempts);
        const choices = planMixedPractice({
          templates,
          skills,
          attempts,
          evidence,
          count,
          seed: `${seed}-${batch}`,
          now: at,
        });
        assert.ok(choices.length);
        const latest = new Map(
          evidence.map((e) => [e.skillId, e.recentOutcomes.at(-1)!]),
        );
        const supported = (id: string) =>
          !!latest.get(id)?.correct && !latest.get(id)?.assisted;
        let probes = 0;
        for (const choice of choices) {
          const { template } = choice;
          if (
            !supported(template.skillId) &&
            !nodes.get(template.skillId)!.prerequisites.every(supported)
          )
            probes++;
          const index = attempts.length;
          const correct =
            profile !== "counting-needs-support" ||
            template.skillId !== "count-to-20";
          const assisted = profile === "assistance" && index % 4 === 0;
          attempts.push({
            id: String(index),
            problemId: `problem-${index}`,
            requestId: `request-${index}`,
            templateId: template.id,
            skillId: template.skillId,
            correct,
            assisted,
            response: "fixture",
            answer: "fixture",
            explanation: [],
            createdAt: new Date(at + index).toISOString(),
          });
        }
        assert.ok(probes <= 1);
        sequences.push(
          choices.map((c) => ({
            template: c.template.id,
            reason: c.reason,
            strand: c.strand,
          })),
        );
      }
      const evidence = projectSkillEvidence(attempts);
      assert.ok(
        evidence.every((e) => e.creditedRetrievals <= 1),
        "No same-session spaced mastery credit",
      );
      if (profile === "independent" && count === 1)
        assert.ok(new Set(attempts.map((a) => a.skillId)).size >= 5);
      trajectories.push({
        profile,
        count,
        seed,
        sequences,
        skillsObserved: evidence.length,
      });
    }
console.log(
  JSON.stringify(
    {
      policy:
        "Editorial scheduling heuristic; observed outcomes only, no inferred ancestor mastery",
      coldStartSeeds: 200,
      distributions,
      trajectories,
    },
    null,
    2,
  ),
);
