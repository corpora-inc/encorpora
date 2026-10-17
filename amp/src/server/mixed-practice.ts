import { createHash } from "node:crypto";
import type { TemplateMetadata } from "../math/contracts";
import type { Outcome } from "./repository";
import type { GradeBand } from "../curriculum/types";
import {
  estimateFrontier,
  gradeNumber,
  initialLevel,
  strandEstimate,
  targetGrade,
  type Frontier,
} from "../learning/frontier";
import { projectSkillEvidence, type SkillEvidence } from "./evidence.js";

export type PracticeReason =
  "review" | "revisit" | "prerequisite" | "frontier" | "explore";
export type PracticeChoice = {
  template: TemplateMetadata;
  reason: PracticeReason;
  strand: string;
};
type SkillNode = {
  id: string;
  prerequisites: string[];
  strand: string;
  gradeBand?: GradeBand;
};
const DAY = 86400000;

/** Scheduling heuristic, not a psychometric mastery estimate. Assistance and
 * errors reset spacing; independently successful retrievals widen it. */
export function reviewDueAt(attempts: readonly Outcome[]): number | null {
  if (!attempts.length) return null;
  const last = attempts.at(-1)!;
  if (!last.correct || last.assisted) return Date.parse(last.createdAt);
  let successes = 0;
  let creditedAt = -Infinity;
  for (const attempt of attempts) {
    const at = Date.parse(attempt.createdAt);
    if (!attempt.correct || attempt.assisted) {
      successes = 0;
      creditedAt = -Infinity;
    } else if (at - creditedAt >= DAY / 4) {
      successes++;
      creditedAt = at;
    }
  }
  const intervals = [0, DAY / 4, DAY, 3 * DAY, 7 * DAY, 14 * DAY, 30 * DAY];
  return (
    Date.parse(last.createdAt) +
    intervals[Math.min(successes, intervals.length - 1)]
  );
}

/** Select across strands for each problem, reserving variety within a batch.
 * Each strand aims at its own estimated frontier; due reviews, missed skills
 * and unmet prerequisites take reserved slots. Nothing grants ancestor credit. */
export function planMixedPractice(options: {
  templates: readonly TemplateMetadata[];
  skills: readonly SkillNode[];
  attempts: readonly Outcome[];
  evidence: readonly SkillEvidence[];
  /** Placement estimate; without one, the recent attempts start from grade 1. */
  frontier?: Frontier;
  count: number;
  seed: string;
  now?: number;
  /** Finite offline pools shrink instead of filling with above-frontier work. */
  strictCeiling?: boolean;
}): PracticeChoice[] {
  const { templates, skills, evidence, seed } = options;
  if (!templates.length) throw new Error("No active templates");
  if (
    !Number.isInteger(options.count) ||
    options.count < 1 ||
    options.count > 5
  )
    throw new Error("Invalid practice batch size");
  const now = options.now ?? Date.now();
  const attempts = [...options.attempts];
  const nodes = new Map(skills.map((skill) => [skill.id, skill]));
  const strandOf = (skillId: string) => nodes.get(skillId)?.strand ?? skillId;
  const gradeOfTemplate = new Map(
    templates.map((template) => [template.id, templateGrade(template, nodes)]),
  );
  const frontier =
    options.frontier ??
    estimateFrontier({
      start: initialLevel({}),
      observations: attempts,
      gradeOf: (id) => gradeOfTemplate.get(id),
      strandOf: (id) =>
        strandOf(templates.find((t) => t.id === id)?.skillId ?? id),
    });
  // A strand estimated below its easiest material still offers that material
  // once the learner's overall level reaches it; otherwise one bad run would
  // hide a whole strand for good.
  const strandFloor = new Map<string, number>();
  for (const template of templates) {
    const strand = strandOf(template.skillId);
    const grade = gradeOfTemplate.get(template.id)!;
    strandFloor.set(strand, Math.min(strandFloor.get(strand) ?? grade, grade));
  }
  const targetOf = (strand: string) => {
    const level = targetGrade(strandEstimate(frontier, strand));
    const floor = strandFloor.get(strand)!;
    return level < floor && frontier.overall.level >= floor ? floor : level;
  };
  const stats = new Map(
    projectSkillEvidence(attempts).map((entry) => [entry.skillId, entry]),
  );
  for (const entry of evidence) stats.set(entry.skillId, entry);
  const chosen: PracticeChoice[] = [];
  const recentSkillIds = attempts
    .filter((attempt) => now - Date.parse(attempt.createdAt) < 30 * 60000)
    .slice(-2)
    .map((attempt) => attempt.skillId);
  const latest = attempts.at(-1);
  const remediation = new Set<string>();
  const implemented = new Set(templates.map((template) => template.skillId));
  // Cross catalog gaps to the nearest teachable ancestors on each branch.
  // A visited set also bounds malformed/cyclic input without manufacturing credit.
  function collectPrerequisites(skillId: string, visited = new Set<string>()) {
    if (visited.has(skillId)) return;
    visited.add(skillId);
    for (const prerequisite of nodes.get(skillId)?.prerequisites ?? []) {
      if (stats.get(prerequisite)?.status === "review-ready") continue;
      if (implemented.has(prerequisite)) remediation.add(prerequisite);
      else collectPrerequisites(prerequisite, visited);
    }
  }
  // Only repeated trouble sends a learner down the graph; one slip is revisited.
  for (const entry of stats.values()) {
    const misses = entry.recentOutcomes
      .slice(-2)
      .filter((attempt) => !attempt.correct || attempt.assisted).length;
    if (misses >= 2) collectPrerequisites(entry.skillId);
  }
  for (let slot = 0; slot < options.count; slot++) {
    const lastChoice = chosen.at(-1);
    const lastSkill = lastChoice?.template.skillId ?? latest?.skillId;
    const lastStrand =
      lastChoice?.strand ?? (latest ? strandOf(latest.skillId) : null);
    const candidates = templates.map((template) => {
      const strand = strandOf(template.skillId);
      const state = stats.get(template.skillId);
      const last = state?.recentOutcomes.at(-1);
      const grade = gradeOfTemplate.get(template.id)!;
      const target = targetOf(strand);
      const due = state?.reviewDueAt ?? null;
      const overdue = due !== null && due <= now;
      const returningError = !!last && (!last.correct || last.assisted);
      // Support returns only within reach: a miss above the lowered frontier
      // is evidence about the frontier, not a skill to repeat yet.
      const distance = grade - target;
      const reachable = distance <= 1;
      const reason: PracticeReason =
        remediation.has(template.skillId) && reachable
          ? "prerequisite"
          : returningError && distance <= 0.25
            ? "revisit"
            : overdue && distance <= 0.5
              ? "review"
              : state
                ? "frontier"
                : "explore";
      // Aim at the frontier: work far below it teaches little, and work well
      // beyond it cannot be done yet.
      let score =
        100 -
        Math.abs(distance) * 30 -
        (distance > 1 ? (distance - 1) * 120 : 0) -
        (distance < -1.5 ? (-distance - 1.5) * 40 : 0);
      if (reason === "prerequisite") score = Math.max(score, 85) + 20;
      if (reason === "revisit") score = Math.max(score, 70) + 15;
      if (reason === "review") score = Math.max(score, 60) + 10;
      if (state?.status === "review-ready" && !overdue) score -= 60;
      if (!state && Math.abs(distance) <= 1) score += 12;
      // Seek information where the estimate is least certain, and lean into
      // strands below the level expected for the learner's age.
      const estimate = strandEstimate(frontier, strand);
      if (Math.abs(distance) <= 1) {
        score += 14 * estimate.sd;
        score += 10 * Math.max(0, Math.min(2, frontier.expected - estimate.level));
      }
      // Interleave: a miss returns after other work, never as an instant loop.
      if (template.skillId === lastSkill) score -= 200;
      if (strand === lastStrand) score -= 45;
      if (recentSkillIds.includes(template.skillId)) score -= 60;
      score -=
        chosen.filter((entry) => entry.template.skillId === template.skillId)
          .length * 150;
      score -= chosen.filter((entry) => entry.strand === strand).length * 35;
      const tie =
        createHash("sha256")
          .update(`${seed}:${slot}:${template.id}`)
          .digest()
          .readUInt32BE(0) / 0x100000000;
      return {
        template,
        reason,
        strand,
        score: score + tie * 8,
        poolEligible: grade <= target + 1 || reason === "prerequisite",
        support: ["prerequisite", "revisit", "review"].includes(reason),
      };
    });
    const eligible = options.strictCeiling
      ? candidates.filter((entry) => entry.poolEligible)
      : candidates;
    if (!eligible.length) break;
    eligible.sort(
      (a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id),
    );
    // Reserve one support/retrieval slot per batch so variety cannot starve a
    // gap or a due review; immediate repetitions wait for intervening work.
    const reserved = !chosen.some((entry) =>
      ["prerequisite", "revisit", "review"].includes(entry.reason),
    )
      ? eligible.find(
          (entry) =>
            entry.support &&
            !recentSkillIds.includes(entry.template.skillId) &&
            entry.template.skillId !== lastSkill &&
            !chosen.some(
              (choice) => choice.template.skillId === entry.template.skillId,
            ),
        )
      : undefined;
    const { template, reason, strand } = reserved ?? eligible[0];
    chosen.push({ template, reason, strand });
  }
  return chosen;
}

export function templateGrade(
  template: TemplateMetadata,
  nodes: ReadonlyMap<string, { gradeBand?: GradeBand }>,
): number {
  const band = nodes.get(template.skillId)?.gradeBand;
  return band ? gradeNumber[band] : coarse[template.gradeBand];
}
const coarse: Record<TemplateMetadata["gradeBand"], number> = {
  "K–2": 1,
  "3–5": 4,
  "6–8": 7,
  "9–12": 10,
};
