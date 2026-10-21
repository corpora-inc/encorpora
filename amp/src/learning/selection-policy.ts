import { createHash } from "node:crypto";
import {
  CURRICULUM_MIX_VERSION,
  familyEmphasis,
  objectiveForSkill,
  skillEmphasis,
} from "../curriculum/selection.js";

/** All values are editorial policy parameters; scores are utility heuristics,
 * not probabilities of correctness or measured learning gains. */
export const SELECTION_POLICY = {
  version: "pathways-budget-v1",
  utilityWindow: 24,
  temperature: 12,
} as const;
export interface SelectionCandidate {
  template: { id: string; skillId: string };
  score: number;
  /** Representation/family recency affects only the conditional family draw. */
  familyScore?: number;
}
export interface SelectionBudget {
  objectiveId: string;
  importance: number;
  skillWeight: number;
  familyWeight: number;
}
export interface SelectionTrace {
  policyVersion: string;
  curriculumVersion: string;
  objectiveId: string;
  objectiveProbability: number;
  skillProbability: number;
  familyProbability: number;
  /** Conditional on this slot's eligible candidates and support reservation. */
  probability: number;
  utility: number;
  familyUtility: number;
}
export interface WeightedCandidate<T> {
  candidate: T;
  trace: SelectionTrace;
}
/** Unknown IDs are useful in simulations. Production catalog completeness is
 * separately gated by auditSelectionCatalog; no new skill silently ships here. */
export function selectionBudget(
  candidate: SelectionCandidate,
): SelectionBudget {
  const { skillId, id } = candidate.template;
  const objective = objectiveForSkill(skillId);
  return {
    objectiveId: objective?.id ?? skillId,
    importance: objective?.importance ?? 1,
    skillWeight: skillEmphasis[skillId] ?? 1,
    familyWeight: familyEmphasis[id] ?? 1,
  };
}

/** Allocate objective -> skill -> family. MAX utility is a readiness envelope:
 * duplicate equivalent candidates never add mass to their skill or objective.
 * A genuinely better-fitting difficulty can change that envelope intentionally.
 * O(n) allocation; no prerequisite traversal or learner writes in this kernel. */
export function selectionDistribution<T extends SelectionCandidate>(
  candidates: readonly T[],
  budgetOf: (candidate: T) => SelectionBudget = selectionBudget,
): WeightedCandidate<T>[] {
  if (!candidates.length) return [];
  const seen = new Set<string>();
  let best = -Infinity;
  for (const candidate of candidates) {
    if (
      !Number.isFinite(candidate.score) ||
      !Number.isFinite(candidate.familyScore ?? candidate.score)
    )
      throw new Error("Invalid selection utility");
    if (seen.has(candidate.template.id))
      throw new Error("Duplicate selection template");
    seen.add(candidate.template.id);
    best = Math.max(best, candidate.score);
  }
  type Entry = { candidate: T; budget: SelectionBudget; mass: number };
  type Skill = {
    weight: number;
    score: number;
    mass: number;
    entries: Entry[];
  };
  type Objective = {
    importance: number;
    score: number;
    mass: number;
    skills: Map<string, Skill>;
  };
  const objectives = new Map<string, Objective>();
  for (const candidate of candidates) {
    if (candidate.score < best - SELECTION_POLICY.utilityWindow) continue;
    const budget = budgetOf(candidate);
    if (
      !budget.objectiveId ||
      [budget.importance, budget.skillWeight, budget.familyWeight].some(
        (n) => !Number.isFinite(n) || n <= 0 || n > 100,
      )
    )
      throw new Error("Invalid selection budget");
    let objective = objectives.get(budget.objectiveId);
    if (!objective) {
      objective = {
        importance: budget.importance,
        score: -Infinity,
        mass: 0,
        skills: new Map(),
      };
      objectives.set(budget.objectiveId, objective);
    }
    if (objective.importance !== budget.importance)
      throw new Error("Inconsistent objective importance");
    let skill = objective.skills.get(candidate.template.skillId);
    if (!skill) {
      skill = {
        weight: budget.skillWeight,
        score: -Infinity,
        mass: 0,
        entries: [],
      };
      objective.skills.set(candidate.template.skillId, skill);
    }
    if (skill.weight !== budget.skillWeight)
      throw new Error("Inconsistent skill weight");
    objective.score = Math.max(objective.score, candidate.score);
    skill.score = Math.max(skill.score, candidate.score);
    skill.entries.push({ candidate, budget, mass: 0 });
  }
  const fit = (score: number, ceiling: number) =>
    Math.exp((score - ceiling) / SELECTION_POLICY.temperature);
  let total = 0;
  for (const objective of objectives.values()) {
    objective.mass = objective.importance * fit(objective.score, best);
    total += objective.mass;
  }
  const result: WeightedCandidate<T>[] = [];
  for (const [objectiveId, objective] of objectives) {
    let skillTotal = 0;
    for (const skill of objective.skills.values()) {
      skill.mass = skill.weight * fit(skill.score, objective.score);
      skillTotal += skill.mass;
    }
    for (const skill of objective.skills.values()) {
      let familyTotal = 0;
      const bestFamily = Math.max(
        ...skill.entries.map(
          (e) => e.candidate.familyScore ?? e.candidate.score,
        ),
      );
      for (const entry of skill.entries) {
        entry.mass =
          entry.budget.familyWeight *
          fit(entry.candidate.familyScore ?? entry.candidate.score, bestFamily);
        familyTotal += entry.mass;
      }
      for (const entry of skill.entries) {
        const objectiveProbability = objective.mass / total;
        const skillProbability = skill.mass / skillTotal;
        const familyProbability = entry.mass / familyTotal;
        result.push({
          candidate: entry.candidate,
          trace: {
            policyVersion: SELECTION_POLICY.version,
            curriculumVersion: CURRICULUM_MIX_VERSION,
            objectiveId,
            objectiveProbability,
            skillProbability,
            familyProbability,
            probability:
              objectiveProbability * skillProbability * familyProbability,
            utility: entry.candidate.score,
            familyUtility: entry.candidate.familyScore ?? entry.candidate.score,
          },
        });
      }
    }
  }
  return result;
}

function draw<T>(
  entries: readonly T[],
  weight: (entry: T) => number,
  key: (entry: T) => string,
  seed: string,
): T {
  const sorted = [...entries].sort((a, b) => key(a).localeCompare(key(b)));
  const random =
    createHash("sha256").update(seed).digest().readUInt32BE(0) / 0x100000000;
  let remaining =
    random * sorted.reduce((sum, entry) => sum + weight(entry), 0);
  for (const entry of sorted) {
    remaining -= weight(entry);
    if (remaining < 0) return entry;
  }
  return sorted.at(-1)!;
}
/** Separate seeded draws preserve the objective and skill draw when equivalent
 * generators are added. Sorting makes input order irrelevant. */
export function selectNextCandidate<T extends SelectionCandidate>(
  candidates: readonly T[],
  seed: string,
  budgetOf: (candidate: T) => SelectionBudget = selectionBudget,
): WeightedCandidate<T> {
  const distribution = selectionDistribution(candidates, budgetOf);
  if (!distribution.length) throw new Error("No selection candidates");
  const objectives = new Map<string, WeightedCandidate<T>>();
  for (const entry of distribution)
    objectives.set(entry.trace.objectiveId, entry);
  const objective = draw(
    [...objectives.values()],
    (e) => e.trace.objectiveProbability,
    (e) => e.trace.objectiveId,
    `${seed}:objective`,
  ).trace.objectiveId;
  const members = distribution.filter((e) => e.trace.objectiveId === objective);
  const skills = new Map<string, WeightedCandidate<T>>();
  for (const entry of members)
    skills.set(entry.candidate.template.skillId, entry);
  const skill = draw(
    [...skills.values()],
    (e) => e.trace.skillProbability,
    (e) => e.candidate.template.skillId,
    `${seed}:skill:${objective}`,
  ).candidate.template.skillId;
  return draw(
    members.filter((e) => e.candidate.template.skillId === skill),
    (e) => e.trace.familyProbability,
    (e) => e.candidate.template.id,
    `${seed}:family:${objective}:${skill}`,
  );
}
