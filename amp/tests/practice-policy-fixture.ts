import { createHash } from "node:crypto";
import { templates } from "../src/math/engine.js";
import { skills } from "../src/curriculum/catalog.js";
import { projectSkillEvidence } from "../src/server/evidence.js";
import { planMixedPractice } from "../src/server/mixed-practice.js";
import type { Outcome } from "../src/server/repository.js";

/** Fixed histories cover placement, support, prior success and due retrieval.
 * The digest is captured before extracting selection parameters from 356e9d465. */
export function defaultSelectionDigest(planner = planMixedPractice) {
  const now = Date.parse("2026-10-21T12:00:00Z");
  const familyIds = [
    "integer-power",
    "product-of-powers-exponent",
    "one-step-equation",
    "percent-of",
    "multiply-facts",
  ];
  const fixedTemplates = templates.filter((t) =>
    [
      ...familyIds,
      "count-objects",
      "add-within-20",
      "linear-equation",
      "line-slope",
      "ratio-missing",
    ].includes(t.id),
  );
  const results = [];
  for (let scenario = 0; scenario < 4; scenario++) {
    const attempts: Outcome[] =
      scenario === 0
        ? []
        : Array.from({ length: 12 }, (_, i) => {
            const template = templates.find(
              (t) => t.id === familyIds[Math.floor(i / 2) % familyIds.length],
            )!;
            return {
              id: String(i),
              problemId: String(i),
              requestId: String(i),
              templateId: template.id,
              skillId: template.skillId,
              correct: scenario !== 1,
              assisted: scenario === 2 && i % 3 === 0,
              response: "1",
              answer: "1",
              explanation: [],
              createdAt: new Date(
                now - (12 - i) * (scenario === 3 ? 86400000 : 60000),
              ).toISOString(),
            };
          });
    for (let seed = 0; seed < 20; seed++) {
      const choices = planner({
        templates: fixedTemplates,
        skills,
        attempts,
        evidence: projectSkillEvidence(attempts),
        count: 3,
        seed: String(seed),
        now,
      });
      results.push(
        choices.map((c) => ({
          id: c.template.id,
          reason: c.reason,
          strand: c.strand,
          probability: c.selection?.probability,
          utility: c.selection?.utility,
          familyUtility: c.selection?.familyUtility,
        })),
      );
    }
  }
  return createHash("sha256").update(JSON.stringify(results)).digest("hex");
}
