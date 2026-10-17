import { createHash } from "node:crypto";
import type { TemplateMetadata } from "../math/contracts";
import type { Outcome } from "./repository";
import type { SkillProgress } from "./progress";

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
  evidence: readonly SkillProgress[];
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
  const attempts = [...options.attempts].sort(
    (a, b) =>
      Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  const nodes = new Map(skills.map((skill) => [skill.id, skill]));
  const byTemplate = new Map(
    templates.map((template) => [template.id, template]),
  );
  const stats = new Map(evidence.map((entry) => [entry.skillId, entry]));
  const bySkill = new Map<string, Outcome[]>();
  for (const attempt of attempts)
    bySkill.set(attempt.skillId, [
      ...(bySkill.get(attempt.skillId) ?? []),
      attempt,
    ]);
  const strandOf = (skillId: string) => nodes.get(skillId)?.strand ?? skillId;
  const recent = attempts.slice(-12);
  const independent = recent.filter(
    (attempt) =>
      attempt.correct &&
      !attempt.assisted &&
      byTemplate.has(attempt.templateId),
  );
  const recentDifficulty = independent.length
    ? levels[byTemplate.get(independent.at(-1)!.templateId)!.gradeBand]
    : 0;
  const recentErrors = recent
    .slice(-3)
    .filter((attempt) => !attempt.correct || attempt.assisted).length;
  const allCorrect =
    recent.length >= 3 &&
    recent.slice(-3).every((attempt) => attempt.correct && !attempt.assisted);
  const baseline = Math.max(0, recentDifficulty - (recentErrors >= 2 ? 1 : 0));
  const ceiling = Math.min(3, baseline + (allCorrect ? 1 : 0));
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
  for (const attempt of recent) {
    const latestOnSkill = bySkill.get(attempt.skillId)?.at(-1);
    if (latestOnSkill !== attempt || (attempt.correct && !attempt.assisted))
      continue;
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
      const strandSuccesses = independent.filter(
        (attempt) => strandOf(attempt.skillId) === strand,
      );
      const strandLevel = strandSuccesses.length
        ? levels[byTemplate.get(strandSuccesses.at(-1)!.templateId)!.gradeBand]
        : baseline;
      const level = levels[template.gradeBand];
      const prerequisites = nodes.get(template.skillId)?.prerequisites ?? [];
      const ready = prerequisites.every(
        (id) => stats.get(id)?.status === "review-ready",
      );
      const due =
        reviewDueAt(history) ??
        (state?.lastPracticedAt
          ? Date.parse(state.lastPracticedAt) + 3 * DAY
          : null);
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
      if (state?.status === "review-ready" && !overdue) score -= 35;
      score -= Math.abs(level - strandLevel) * 32;
      if (level > Math.max(ceiling, strandLevel))
        score -= 160 * (level - Math.max(ceiling, strandLevel));
      if (allCorrect && level === ceiling && !history.length) score += 26;
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
      return { template, reason, strand, score: score + tie };
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
