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
import { guessChance } from "../math/guess-chance";
import {
  PLACEMENT_ATTEMPTS,
  openerCandidates,
  templateRole,
  type OpenerSlots,
} from "../learning/placement";
import type { PracticeSkip } from "../learning/skip";

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

/** Variety over the served sequence (answered problems, then this batch).
 * A template never repeats back to back and appears at most `templateMax`
 * times in any `templateWindow` problems, unless nothing else is eligible.
 * A skill returns only after other work, with gentler penalties as it ages;
 * a strand that filled the last few problems yields to the others. */
export const VARIETY = {
  templateWindow: 10,
  templateMax: 2,
  /** Points against a template served g problems ago: fades to 0 at 13. */
  templateFade: 12,
  templatePenalty: 60,
  /** Points against a skill served g problems ago (index g; g = 1 is the
   * immediately previous problem). */
  skillPenalty: [0, 200, 90, 60, 40, 25, 12],
  strandWindow: 4,
  strandPenalty: 20,
  /** Answers older than this belong to an earlier session: they no longer
   * count against variety, so yesterday's practice can return today. */
  sessionMs: 3 * 3600000,
  /** A skipped template stays out for the rest of the session, unless
   * nothing else is eligible. */
  skipPenalty: 150,
  /** The next problems after a skip prefer work this many grades below the
   * learner's level: inside the session only, never in the persisted
   * estimate. */
  skipEase: 0.75,
  /** Points per grade above that eased aim. */
  skipEaseWeight: 90,
  skipEaseProblems: 2,
  /** The skipped skill returns, in another template, once this many
   * problems have passed. */
  skipReturnAfter: 4,
} as const;
type Served = {
  templateId: string;
  skillId: string;
  strand: string;
  skip?: true;
};
/** How many problems ago each key was last served (1 = the previous one),
 * and how often within the last `window`. */
function recency(
  history: readonly Served[],
  key: (s: Served) => string,
  window: number,
) {
  const gap = new Map<string, number>();
  const count = new Map<string, number>();
  history.forEach((item, i) => {
    const k = key(item);
    gap.set(k, history.length - i);
    if (history.length - i <= window) count.set(k, (count.get(k) ?? 0) + 1);
  });
  return {
    gap: (k: string) => gap.get(k) ?? Infinity,
    count: (k: string) => count.get(k) ?? 0,
  };
}

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
  /** Stable per learner, so siblings start differently but a learner's own
   * scripted openers never change between requests. */
  learnerKey?: string;
  /** This session's skips (learning/skip.ts): neutral passes that change no
   * evidence, but shape what comes next. */
  skips?: readonly PracticeSkip[];
  /** Scripted opener table; defaults to the production `openerSlots`. */
  openers?: OpenerSlots;
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
      guessOf: (id) => {
        const template = templates.find((t) => t.id === id);
        return template ? guessChance(template) : 0;
      },
    });
  // A strand estimated below its easiest material still offers that material
  // once the learner's overall level reaches it; otherwise one bad run would
  // hide a whole strand for good. A strand estimated above its hardest material
  // aims at that material, so it is still probed instead of losing every slot
  // to strands whose material reaches the learner's level.
  const strandFloor = new Map<string, number>();
  const strandCeiling = new Map<string, number>();
  for (const template of templates) {
    const strand = strandOf(template.skillId);
    const grade = gradeOfTemplate.get(template.id)!;
    strandFloor.set(strand, Math.min(strandFloor.get(strand) ?? grade, grade));
    strandCeiling.set(
      strand,
      Math.max(strandCeiling.get(strand) ?? grade, grade),
    );
  }
  const targetOf = (strand: string) => {
    const level = targetGrade(strandEstimate(frontier, strand));
    const floor = strandFloor.get(strand)!;
    const ceiling = strandCeiling.get(strand)!;
    if (level > ceiling) return ceiling;
    return level < floor && frontier.overall.level >= floor ? floor : level;
  };
  // Placement asks whole skill items only; method-step scaffolds return once
  // the learner is placed. The first answers follow the scripted openers.
  const answered = frontier.overall.answered;
  const pool =
    answered < PLACEMENT_ATTEMPTS
      ? templates.filter(
          (template) => templateRole(template.id) === "assessment",
        )
      : templates;
  const attemptedTemplates = new Set(attempts.map((a) => a.templateId));
  const stats = new Map(
    projectSkillEvidence(attempts).map((entry) => [entry.skillId, entry]),
  );
  for (const entry of evidence) stats.set(entry.skillId, entry);
  const chosen: PracticeChoice[] = [];
  const latest = attempts.at(-1);
  const remediation = new Set<string>();
  const implemented = new Set(templates.map((template) => template.skillId));
  // A prerequisite answered independently twice in a row has been shown for
  // now: it leaves remediation (no mastery credit) instead of looping until
  // it is review-ready.
  const demonstrated = (skillId: string) => {
    const recent = stats.get(skillId)?.recentOutcomes.slice(-2) ?? [];
    return recent.length === 2 && recent.every((a) => a.correct && !a.assisted);
  };
  // Cross catalog gaps to the nearest teachable ancestors on each branch.
  // A visited set also bounds malformed/cyclic input without manufacturing credit.
  function collectPrerequisites(skillId: string, visited = new Set<string>()) {
    if (visited.has(skillId)) return;
    visited.add(skillId);
    for (const prerequisite of nodes.get(skillId)?.prerequisites ?? []) {
      if (
        stats.get(prerequisite)?.status === "review-ready" ||
        demonstrated(prerequisite)
      )
        continue;
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
  const inSession = (at: string) => now - Date.parse(at) < VARIETY.sessionMs;
  // Answers and skips in the order they happened.
  const session: (Served & { at: number })[] = [
    ...attempts
      .filter((a) => inSession(a.createdAt))
      .map((a) => ({
        templateId: a.templateId,
        skillId: a.skillId,
        strand: strandOf(a.skillId),
        at: Date.parse(a.createdAt),
      })),
    ...(options.skips ?? [])
      .filter((s) => inSession(s.createdAt))
      .map((s) => ({
        templateId: s.templateId,
        skillId: s.skillId,
        strand: strandOf(s.skillId),
        skip: true as const,
        at: Date.parse(s.createdAt),
      })),
  ].sort((a, b) => a.at - b.at);
  const skippedTemplates = new Set(
    session.filter((s) => s.skip).map((s) => s.templateId),
  );
  for (let slot = 0; slot < options.count; slot++) {
    const opener = openerCandidates({
      expectedGrade: frontier.expected,
      position: answered + slot,
      learnerKey: options.learnerKey ?? seed,
      slots: options.openers,
    })
      .map((id) => pool.find((template) => template.id === id))
      .find(
        (template) =>
          !!template &&
          !attemptedTemplates.has(template.id) &&
          !chosen.some((entry) => entry.template.id === template.id),
      );
    if (opener) {
      chosen.push({
        template: opener,
        reason: "explore",
        strand: strandOf(opener.skillId),
      });
      continue;
    }
    const lastChoice = chosen.at(-1);
    const lastSkill = lastChoice?.template.skillId ?? latest?.skillId;
    const lastStrand =
      lastChoice?.strand ?? (latest ? strandOf(latest.skillId) : null);
    const history: Served[] = [
      ...session,
      ...chosen.map((c) => ({
        templateId: c.template.id,
        skillId: c.template.skillId,
        strand: c.strand,
      })),
    ];
    const byTemplate = recency(
      history,
      (s) => s.templateId,
      VARIETY.templateWindow - 1,
    );
    const bySkill = recency(history, (s) => s.skillId, 0);
    // After a skip, the next problems step slightly easier.
    const lastSkip = history.map((s) => !!s.skip).lastIndexOf(true);
    const ease =
      lastSkip >= 0 && history.length - lastSkip <= VARIETY.skipEaseProblems
        ? VARIETY.skipEase
        : 0;
    // A skipped skill comes back after other work, through another template.
    const requeued = new Set(
      history
        .map((s, i) => ({ ...s, gap: history.length - i, i }))
        .filter(
          (s) =>
            s.skip &&
            s.gap >= VARIETY.skipReturnAfter &&
            !history
              .slice(s.i + 1)
              .some((later) => later.skillId === s.skillId),
        )
        .map((s) => s.skillId),
    );
    const byStrand = recency(history, (s) => s.strand, VARIETY.strandWindow);
    // Support (a prerequisite, a revisit, a due review) alternates with new
    // work: after a support problem the next slot is not reserved for one.
    const previousOutcomes = lastSkill
      ? (stats.get(lastSkill)?.recentOutcomes ?? [])
      : [];
    const lastWasSupport = lastChoice
      ? ["prerequisite", "revisit", "review"].includes(lastChoice.reason)
      : !!lastSkill &&
        (remediation.has(lastSkill) ||
          previousOutcomes
            .slice(0, -1)
            .slice(-1)
            .some((a) => !a.correct || a.assisted));
    const candidates = pool.map((template) => {
      const strand = strandOf(template.skillId);
      const state = stats.get(template.skillId);
      const last = state?.recentOutcomes.at(-1);
      const grade = gradeOfTemplate.get(template.id)!;
      const target = targetOf(strand);
      const due = state?.reviewDueAt ?? null;
      const overdue = due !== null && due <= now;
      const returningError =
        (!!last && (!last.correct || last.assisted)) ||
        requeued.has(template.skillId);
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
        score +=
          10 * Math.max(0, Math.min(2, frontier.expected - estimate.level));
      }
      // Interleave: a miss returns after other work, never as an instant
      // loop, and a template that was just seen waits longest of all.
      const templateGap = byTemplate.gap(template.id);
      if (templateGap <= VARIETY.templateFade)
        score -=
          (VARIETY.templatePenalty * (VARIETY.templateFade + 1 - templateGap)) /
          VARIETY.templateFade;
      score -= VARIETY.skillPenalty[bySkill.gap(template.skillId)] ?? 0;
      if (skippedTemplates.has(template.id)) score -= VARIETY.skipPenalty;
      // Just after a skip, prefer work a little below the learner's level.
      if (ease) score -= VARIETY.skipEaseWeight * Math.max(0, distance + ease);
      if (strand === lastStrand) score -= 45;
      score -= VARIETY.strandPenalty * byStrand.count(strand);
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
        score: score + tie * 8,
        poolEligible: grade <= target + 1 || reason === "prerequisite",
        support: ["prerequisite", "revisit", "review"].includes(reason),
        fresh:
          templateGap > 1 &&
          byTemplate.count(template.id) < VARIETY.templateMax &&
          !skippedTemplates.has(template.id),
        skillGap: bySkill.gap(template.skillId),
      };
    });
    const ceilinged = options.strictCeiling
      ? candidates.filter((entry) => entry.poolEligible)
      : candidates;
    if (!ceilinged.length) break;
    // Variety is a rule, not a weight, whenever another problem can be asked.
    const varied = ceilinged.filter((entry) => entry.fresh);
    const eligible = varied.length ? varied : ceilinged;
    eligible.sort(
      (a, b) => b.score - a.score || a.template.id.localeCompare(b.template.id),
    );
    // Reserve one support/retrieval slot per batch so variety cannot starve a
    // gap or a due review; immediate repetitions wait for intervening work.
    const reserved =
      !lastWasSupport &&
      !chosen.some((entry) =>
        ["prerequisite", "revisit", "review"].includes(entry.reason),
      )
        ? eligible.find(
            (entry) =>
              entry.support &&
              entry.skillGap > 2 &&
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
  const offset = template.difficultyOffset ?? 0;
  if (!Number.isFinite(offset) || Math.abs(offset) > 1)
    throw new Error("Invalid template difficulty offset");
  return (band ? gradeNumber[band] : coarse[template.gradeBand]) + offset;
}
const coarse: Record<TemplateMetadata["gradeBand"], number> = {
  "K–2": 1,
  "3–5": 4,
  "6–8": 7,
  "9–12": 10,
};
