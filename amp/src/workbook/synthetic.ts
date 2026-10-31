import { skills } from "../curriculum/catalog";
import {
  estimateFrontier,
  initialLevel,
  type Frontier,
} from "../learning/frontier";
import { templates } from "../math/engine";
import { guessChanceOf } from "../math/guess-chance";
import { projectSkillEvidence, type SkillEvidence } from "../server/evidence";
import { planMixedPractice, templateGrade } from "../server/mixed-practice";
import type { Outcome } from "../server/repository";

/** Synthetic learners for workbook samples and tests: each practices in the
 * real mixed-practice planner for several days and answers correctly with a
 * probability that falls as problems rise above their true level. Their
 * history is not evidence about real learners. */
export interface SyntheticLearner {
  id: string;
  birthYear: number;
  ability: number;
  days: number;
  perDay: number;
}
export const sampleLearners: readonly SyntheticLearner[] = [
  { id: "new-kindergartner", birthYear: 2021, ability: 0, days: 0, perDay: 0 },
  {
    id: "early-first-grade",
    birthYear: 2019,
    ability: 1.2,
    days: 6,
    perDay: 12,
  },
  { id: "third-grade", birthYear: 2017, ability: 3.4, days: 14, perDay: 18 },
  {
    id: "ahead-sixth-grade",
    birthYear: 2015,
    ability: 7,
    days: 14,
    perDay: 18,
  },
  { id: "eighth-grade", birthYear: 2012, ability: 8, days: 14, perDay: 18 },
  { id: "algebra-two", birthYear: 2010, ability: 11, days: 14, perDay: 18 },
  { id: "precalculus", birthYear: 2009, ability: 12.4, days: 14, perDay: 18 },
];

const nodes = new Map(skills.map((s) => [s.id, s]));
const byId = new Map(templates.map((t) => [t.id, t]));
const gradeOf = (id: string) => {
  const t = byId.get(id);
  return t ? templateGrade(t, nodes) : undefined;
};
const strandOf = (id: string) =>
  nodes.get(byId.get(id)?.skillId ?? "")?.strand ?? id;

export function simulateLearner(
  learner: SyntheticLearner,
  now: number,
): { frontier: Frontier; evidence: SkillEvidence[]; attempts: Outcome[] } {
  let state = 7 + learner.birthYear;
  const random = () => (state = (state * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 4; i++) random();
  const start = initialLevel({ birthYear: learner.birthYear, now });
  const attempts: Outcome[] = [];
  const frontierAt = (at: number) =>
    estimateFrontier({
      start,
      observations: attempts,
      gradeOf,
      strandOf,
      guessOf: guessChanceOf,
      now: at,
    });
  for (let day = learner.days; day >= 1; day--) {
    let at = now - day * 86_400_000 + 16 * 3_600_000;
    for (let served = 0; served < learner.perDay;) {
      const frontier = frontierAt(at);
      for (const choice of planMixedPractice({
        templates,
        skills,
        attempts,
        evidence: projectSkillEvidence(attempts),
        frontier,
        count: 3,
        seed: `${learner.id}:${day}:${served}`,
        now: at,
      })) {
        const grade = gradeOf(choice.template.id)!;
        const p = 1 / (1 + Math.exp(-3 * (learner.ability + 0.3 - grade)));
        const n = attempts.length;
        attempts.push({
          id: String(n).padStart(6, "0"),
          problemId: `problem-${n}`,
          requestId: `request-${n}`,
          templateId: choice.template.id,
          skillId: choice.template.skillId,
          correct: random() < p,
          assisted: false,
          response: "",
          answer: "",
          explanation: [],
          createdAt: new Date(at).toISOString(),
        });
        at += 45_000;
        served++;
      }
    }
  }
  return {
    frontier: frontierAt(now),
    evidence: projectSkillEvidence(attempts),
    attempts,
  };
}
