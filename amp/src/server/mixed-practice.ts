import { createHash } from "node:crypto";
import type { TemplateMetadata } from "../math/contracts";
import type { Outcome } from "./repository";
import type { GradeBand } from "../curriculum/types";
import {
  estimateFrontier,
  initialLevel,
  strandEstimate,
  targetGrade,
  type Frontier,
} from "../learning/frontier";
import {
  templateCalibration,
  templateGrade,
  itemSuccess,
  itemInformation,
} from "../learning/item-calibration";
export { templateGrade } from "../learning/item-calibration";
import { projectSkillEvidence, type SkillEvidence } from "./evidence.js";

export type PracticeReason =
  "review" | "revisit" | "prerequisite" | "frontier" | "explore" | "probe";
export type PracticeChoice = {
  template: TemplateMetadata;
  reason: PracticeReason;
  strand: string;
  /** Conditional prediction at the posterior mean, not a validated success rate. */
  predictedSuccess: number;
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
  /** Internal scheduling configuration; never accepted from a learner payload. */
  targetBand?: readonly [number, number];
}): PracticeChoice[] {
  const { templates, skills, evidence, seed } = options;
  if (!templates.length) throw new Error("No active templates");
  if (
    !Number.isInteger(options.count) ||
    options.count < 1 ||
    options.count > 5
  )
    throw new Error("Invalid practice batch size");
  const targetBand = options.targetBand ?? [0.7, 0.85];
  const [lower, upper] = targetBand;
  if (
    !Number.isFinite(lower) ||
    !Number.isFinite(upper) ||
    lower <= 0.5 ||
    upper >= 1 ||
    lower >= upper
  )
    throw new Error("Invalid target success band");
  const now = options.now ?? Date.now();
  const attempts = [...options.attempts];
  const nodes = new Map(skills.map((skill) => [skill.id, skill]));
  const strandOf = (skillId: string) => nodes.get(skillId)?.strand ?? skillId;
  const gradeOfTemplate = new Map(
    templates.map((template) => [template.id, templateGrade(template, nodes)]),
  );
  const items = new Map(
    templates.map((template) => [
      template.id,
      templateCalibration(template, nodes),
    ]),
  );
  const frontier =
    options.frontier ??
    estimateFrontier({
      start: initialLevel({}),
      observations: attempts,
      gradeOf: (id) => gradeOfTemplate.get(id),
      itemOf: (id, version) =>
        templates.find((t) => t.id === id)?.version === version
          ? items.get(id)
          : undefined,
      now,
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
  const lastStrandPractice = new Map<string, number>();
  for (const state of stats.values()) {
    const strand = strandOf(state.skillId);
    const at = Date.parse(state.lastPracticedAt!);
    if (Number.isFinite(at))
      lastStrandPractice.set(
        strand,
        Math.max(lastStrandPractice.get(strand) ?? -Infinity, at),
      );
  }
  // At most one reserved information probe per six answered problems. It
  // checks reachable, neglected strands even when their mean misses the band.
  const probeBatch =
    !options.strictCeiling &&
    frontier.overall.answered > 0 &&
    frontier.overall.answered % 6 < options.count;
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
      const estimate = strandEstimate(frontier, strand);
      const item = items.get(template.id)!;
      const predictedSuccess = itemSuccess(estimate.level, item);
      const bandDistance = Math.max(
        lower - predictedSuccess,
        0,
        predictedSuccess - upper,
      );
      // A learning-opportunity proxy: prefer solvable, nontrivial work. This is
      // not a measured expected learning gain. Information helps uncertain strands.
      let score =
        100 -
        240 * bandDistance -
        30 * Math.abs(predictedSuccess - (lower + upper) / 2);
      score -= Math.max(0, distance - 1) * 120;
      score -= Math.max(0, -distance - 1.5) * 40;
      score +=
        60 *
        Math.log1p(
          Math.min(9, estimate.sd ** 2) * itemInformation(estimate, item),
        );
      if (reason === "prerequisite") score += 20;
      if (reason === "revisit") score += 15;
      if (reason === "review") score += 10;
      if (state?.status === "review-ready" && !overdue) score -= 60;
      if (!state && Math.abs(distance) <= 1) score += 12;
      if (Math.abs(distance) <= 1)
        score +=
          10 * Math.max(0, Math.min(2, frontier.expected - estimate.level));
      // Interleave: a miss returns after other work, never as an instant loop.
      if (template.skillId === lastSkill) score -= 200;
      if (strand === lastStrand) score -= 45;
      if (recentSkillIds.includes(template.skillId)) score -= 60;
      score -=
        chosen.filter((entry) => entry.template.skillId === template.skillId)
          .length * 150;
      score -= chosen.filter((entry) => entry.strand === strand).length * 120;
      const tie =
        createHash("sha256")
          .update(`${seed}:${slot}:${template.id}`)
          .digest()
          .readUInt32BE(0) / 0x100000000;
      return {
        template,
        reason,
        strand,
        predictedSuccess,
        score: score + tie * 0.01,
        poolEligible: grade <= target + 1 || reason === "prerequisite",
        inBand: predictedSuccess >= lower && predictedSuccess <= upper,
        dueAt: due,
        reviewRange: distance >= -1.5,
        probeEligible:
          distance <= 1 &&
          predictedSuccess >= 0.35 &&
          itemInformation(estimate, item) >= 0.01 &&
          now - (lastStrandPractice.get(strand) ?? 0) >= DAY,
        probeScore:
          Math.min(9, estimate.sd ** 2) *
          itemInformation(estimate, item) *
          (1 +
            Math.min(7, (now - (lastStrandPractice.get(strand) ?? 0)) / DAY) /
              7),
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
    const supportCandidates = eligible.filter(
      (entry) =>
        entry.support &&
        !recentSkillIds.includes(entry.template.skillId) &&
        entry.template.skillId !== lastSkill &&
        !chosen.some(
          (choice) => choice.template.skillId === entry.template.skillId,
        ),
    );
    const dueReviews = supportCandidates
      .filter((entry) => entry.reason === "review")
      .sort(
        (a, b) =>
          Number(b.reviewRange) - Number(a.reviewRange) ||
          Number(a.strand === lastStrand) - Number(b.strand === lastStrand) ||
          a.dueAt! - b.dueAt! ||
          b.score - a.score,
      );
    const reserved = !chosen.some((entry) =>
      ["prerequisite", "revisit", "review"].includes(entry.reason),
    )
      ? (dueReviews[0] ?? supportCandidates[0])
      : undefined;
    // After the reserved support slot, take an in-band item whenever it also
    // satisfies the immediate-repeat and batch-diversity constraints. Scores
    // (including information) decide among those items; sparse catalogs fall back.
    const bandPreferred = eligible.find(
      (entry) =>
        entry.inBand &&
        entry.template.skillId !== lastSkill &&
        !recentSkillIds.includes(entry.template.skillId) &&
        entry.strand !== lastStrand &&
        !chosen.some(
          (choice) =>
            choice.strand === entry.strand ||
            choice.template.skillId === entry.template.skillId,
        ),
    );
    const probe =
      probeBatch && slot === Math.min(1, options.count - 1)
        ? eligible
            .filter(
              (entry) =>
                entry.probeEligible &&
                entry.template.skillId !== lastSkill &&
                !recentSkillIds.includes(entry.template.skillId) &&
                entry.strand !== lastStrand &&
                !chosen.some((choice) => choice.strand === entry.strand),
            )
            .sort((a, b) => b.probeScore - a.probeScore || b.score - a.score)[0]
        : undefined;
    const pick = reserved ?? probe ?? bandPreferred ?? eligible[0];
    const { template, strand, predictedSuccess } = pick;
    chosen.push({
      template,
      reason: pick === probe ? "probe" : pick.reason,
      strand,
      predictedSuccess,
    });
  }
  return chosen;
}
