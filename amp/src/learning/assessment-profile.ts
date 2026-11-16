import { skills } from "../curriculum/catalog";
import { selectionObjectives } from "../curriculum/selection";
import { SAT_PROFILE_VERSION, satPracticeEligible } from "../curriculum/sat";
import type { TemplateMetadata } from "../math/contracts";
import {
  createPracticePolicy,
  DEFAULT_PRACTICE_POLICY,
  practiceParameters,
  type PracticePolicy,
} from "./practice-policy";

/** Domain shares are official approximate SAT operational-question targets.
 * Assignment of AMP objectives and within-domain weights is editorial. */
export const SAT_BLUEPRINT = {
  id: "sat-digital-v4-2026-09",
  reviewedAt: "2026-10-22",
  sourceUrl:
    "https://satsuite.collegeboard.org/media/pdf/assessment-framework-for-digital-sat-suite.pdf",
  sourceLocation:
    "Version 4, September 2026; Table A31 and Appendix B, Tables A35–A38",
  domainPercent: { algebra: 35, advanced: 35, data: 15, geometry: 15 },
} as const;
export type SatDomain = keyof typeof SAT_BLUEPRINT.domainPercent;
export const satObjectiveDomains: Readonly<Record<string, SatDomain>> = {
  expressions: "algebra",
  "linear-equations": "algebra",
  "linear-models": "algebra",
  inequalities: "algebra",
  systems: "algebra",
  "absolute-value-equations": "advanced",
  "powers-radicals": "advanced",
  "polynomials-quadratics": "advanced",
  "rational-algebra": "advanced",
  "nonlinear-systems": "advanced",
  "function-meaning": "advanced",
  "quadratic-functions": "advanced",
  "function-operations": "advanced",
  "exponential-logarithmic": "advanced",
  measurement: "data",
  "ratios-percent": "data",
  "data-displays": "data",
  statistics: "data",
  "bivariate-data": "data",
  "statistical-inference": "data",
  probability: "data",
  "area-volume": "geometry",
  "angles-lines": "geometry",
  "coordinate-geometry": "geometry",
  "transformations-similarity": "geometry",
  "circles-conics": "geometry",
  "right-triangles": "geometry",
  trigonometry: "geometry",
  "geometry-proof": "geometry",
};
const satSkills = new Set(
  skills
    .filter((s) => s.alignments.some((a) => a.standardId.startsWith("SAT.")))
    .map((s) => s.id),
);
/** An opt-in test-goal configuration: pass BOTH the filtered templates and policy
 * into planMixedPractice. General K–12 learning does not use this pool. Readiness,
 * remediation and recency can change realized proportions at a learner's frontier. */
export function satPracticeConfiguration(
  templates: readonly TemplateMetadata[],
  base: PracticePolicy = DEFAULT_PRACTICE_POLICY,
) {
  const pool = templates.filter(satPracticeEligible);
  const available = new Set(pool.map((t) => t.skillId));
  const objectives = selectionObjectives.filter((o) =>
    o.skills.some((s) => available.has(s)),
  );
  for (const objective of objectives)
    if (!satObjectiveDomains[objective.id])
      throw new Error(`Unmapped SAT objective: ${objective.id}`);
  const parameters = practiceParameters(base);
  parameters.version = `${base.version.slice(0, 60)}+${SAT_PROFILE_VERSION}`;
  // General placement sequences are not SAT-domain draws. The adaptive
  // planner still uses the learner's frontier, evidence and recovery settings.
  parameters.placement.scriptedOpeners = false;
  for (const domain of Object.keys(
    SAT_BLUEPRINT.domainPercent,
  ) as SatDomain[]) {
    const group = objectives.filter(
      (o) => satObjectiveDomains[o.id] === domain,
    );
    const total = group.reduce((n, o) => n + o.assessmentEmphasis, 0);
    // An older/offline client may render only part of the SAT pool. Retain
    // that supported pool, never substitute unrelated K–12 material.
    if (!total) continue;
    for (const o of group)
      parameters.weights.objectives[o.id] =
        (SAT_BLUEPRINT.domainPercent[domain] * o.assessmentEmphasis) / total;
  }
  return {
    profile: SAT_BLUEPRINT,
    policy: createPracticePolicy(parameters),
    templates: pool,
    // Presence is not certification of every facet or exam response format.
    skillsWithoutPractice: [...satSkills]
      .filter((s) => !available.has(s))
      .sort(),
  };
}
