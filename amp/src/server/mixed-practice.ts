import { createHash } from "node:crypto";
import type { TemplateMetadata } from "../math/contracts";
import type { Outcome } from "./repository";
import type { PracticeStartingPoint } from "../learning/starting-point";
import {
  projectSkillEvidence,
  type SkillEvidence,
  type PracticeObservation,
} from "./evidence.js";

export type PracticeReason =
  "review" | "revisit" | "prerequisite" | "frontier" | "explore";
export type PracticeChoice = {
  template: TemplateMetadata;
  reason: PracticeReason;
  strand: string;
};
type SkillNode = { id: string; prerequisites: string[]; strand: string };
const DAY = 86400000;
const levels: Record<TemplateMetadata["gradeBand"], number> = {
  "K–2": 0,
  "3–5": 1,
  "6–8": 2,
  "9–12": 3,
};

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
 * An exploratory probe never grants credit to its unobserved prerequisites. */
export function planMixedPractice(options: {
  templates: readonly TemplateMetadata[];
  skills: readonly SkillNode[];
  attempts: readonly Outcome[];
  evidence: readonly SkillEvidence[];
  startingPoint?: PracticeStartingPoint;
  count: number;
  seed: string;
  now?: number;
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
  const byTemplate = new Map(
    templates.map((template) => [template.id, template]),
  );
  // Global recency controls interleaving only. Retained skill observations
  // determine support and each strand's independent challenge range.
  const stats = new Map(
    projectSkillEvidence(attempts).map((entry) => [entry.skillId, entry]),
  );
  for (const entry of evidence) stats.set(entry.skillId, entry);
  const bySkill = new Map<string, PracticeObservation[]>(
    [...stats].map(([id, entry]) => [id, entry.recentOutcomes]),
  );
  const strandOf = (skillId: string) => nodes.get(skillId)?.strand ?? skillId;
  const strandEvidence = new Map<
    string,
    {
      level: number;
      ceiling: number;
      challenge: boolean;
      initialProbePolicy: boolean;
    }
  >();
  for (const strand of new Set(
    templates.map((template) => strandOf(template.skillId)),
  )) {
    const initialProbePolicy =
      options.startingPoint?.policyVersion === 1 &&
      !options.startingPoint.excludedStrands.includes(strand);
    const entries = [...stats.values()].filter(
      (entry) => strandOf(entry.skillId) === strand,
    );
    const observed = entries
      .flatMap((entry) => entry.recentOutcomes)
      .sort((a, b) =>
        Number(BigInt(a.ingestionSequence) - BigInt(b.ingestionSequence)),
      )
      .slice(-3);
    const successes = entries
      .flatMap((entry) =>
        entry.latestIndependent ? [entry.latestIndependent] : [],
      )
      .filter((entry) => byTemplate.has(entry.templateId));
    const latestProbe = [...observed]
      .reverse()
      .find((entry) => byTemplate.has(entry.templateId));
    // A preference starts only untouched strands. Before the first independent
    // success, actual attempted tasks determine a local downward probe sequence.
    // It supplies neither a floor nor prerequisite/mastery credit.
    const provisional =
      initialProbePolicy && !successes.length
        ? latestProbe
          ? Math.max(
              0,
              levels[byTemplate.get(latestProbe.templateId)!.gradeBand] - 1,
            )
          : entries.length === 0 &&
              options.startingPoint?.policyVersion === 1 &&
              options.startingPoint.band
            ? levels[options.startingPoint.band]
            : 0
        : 0;
    const anchor = Math.max(
      0,
      ...successes.map(
        (entry) => levels[byTemplate.get(entry.templateId)!.gradeBand],
      ),
    );
    const errors = observed.filter(
      (entry) => !entry.correct || entry.assisted,
    ).length;
    const level = successes.length
      ? Math.max(0, anchor - (errors >= 2 ? 1 : 0))
      : provisional;
    const challenge =
      observed.length >= 3 &&
      observed.every((entry) => entry.correct && !entry.assisted);
    strandEvidence.set(strand, {
      level,
      initialProbePolicy,
      ceiling: Math.min(3, level + Number(challenge)),
      challenge,
    });
  }
  const chosen: PracticeChoice[] = [];
  const recentSkillIds = attempts
    .filter((attempt) => now - Date.parse(attempt.createdAt) < 30 * 60000)
    .slice(-2)
    .map((attempt) => attempt.skillId);
  const latest = attempts.at(-1);
  const latestStrand = latest ? strandOf(latest.skillId) : null;
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
  for (const entry of stats.values()) {
    const attempt = entry.recentOutcomes.at(-1);
    if (attempt && (!attempt.correct || attempt.assisted))
      collectPrerequisites(attempt.skillId);
  }
  for (let slot = 0; slot < options.count; slot++) {
    const lastChoice = chosen.at(-1);
    const lastSkill = lastChoice?.template.skillId ?? latest?.skillId;
    const lastStrand = lastChoice?.strand ?? latestStrand;
    const candidates = templates.map((template) => {
      const strand = strandOf(template.skillId);
      const history = bySkill.get(template.skillId) ?? [];
      const last = history.at(-1);
      const state = stats.get(template.skillId);
      const strandState = strandEvidence.get(strand)!;
      const strandLevel = strandState.level;
      const level = levels[template.gradeBand];
      const prerequisites = nodes.get(template.skillId)?.prerequisites ?? [];
      const ready = prerequisites.every(
        (id) => stats.get(id)?.status === "review-ready",
      );
      // Only demonstrated prerequisites may cross a strand boundary. A probe
      // never writes readiness to ancestors or unrelated strands.
      const observedPrerequisites = prerequisites.length > 0 && ready;
      const due = state?.reviewDueAt ?? null;
      const overdue = due !== null && due <= now;
      const returningError = !!last && (!last.correct || last.assisted);
      const reason: PracticeReason = remediation.has(template.skillId)
        ? "prerequisite"
        : returningError
          ? "revisit"
          : overdue
            ? "review"
            : ready
              ? "frontier"
              : "explore";
      let score =
        reason === "prerequisite"
          ? 95
          : reason === "revisit"
            ? 90
            : reason === "review"
              ? 80
              : history.length === 0
                ? 65
                : 40;
      if (returningError && !recentSkillIds.includes(template.skillId))
        score += 35;
      if (state?.status === "review-ready" && !overdue) score -= 35;
      score -= Math.abs(level - strandLevel) * 32;
      if (
        level > strandState.ceiling &&
        reason !== "prerequisite" &&
        !observedPrerequisites &&
        (!last || (strandState.initialProbePolicy && returningError))
      )
        score -= 160 * (level - strandState.ceiling);
      if (
        strandState.challenge &&
        level === strandState.ceiling &&
        !history.length
      )
        score += 26;
      // Learning work is interleaved, including remediation: avoid a miss turning
      // into an endless same-template loop. No synthetic success is recorded.
      if (template.skillId === lastSkill) score -= 180;
      if (strand === lastStrand) score -= 55;
      if (recentSkillIds.includes(template.skillId)) score -= 55;
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
        score: score + tie,
        supportEligible:
          !strandState.initialProbePolicy ||
          level <= strandState.ceiling ||
          reason !== "revisit",
      };
    });
    candidates.sort(
      (a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id),
    );
    // Reserve one eligible support/retrieval slot per batch. Variety cannot
    // indefinitely starve a gap or a due review; immediate repetitions are
    // deferred until other work has intervened.
    const supportAlreadyChosen = chosen.some((entry) =>
      ["prerequisite", "revisit", "review"].includes(entry.reason),
    );
    const reserved = !supportAlreadyChosen
      ? candidates.find(
          (entry) =>
            entry.supportEligible &&
            ["prerequisite", "revisit", "review"].includes(entry.reason) &&
            !recentSkillIds.includes(entry.template.skillId) &&
            entry.template.skillId !== lastSkill &&
            !chosen.some(
              (choice) => choice.template.skillId === entry.template.skillId,
            ),
        )
      : undefined;
    const { template, reason, strand } = reserved ?? candidates[0];
    chosen.push({ template, reason, strand });
  }
  return chosen;
}
