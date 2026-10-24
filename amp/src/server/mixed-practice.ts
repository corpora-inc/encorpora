import {
  DEFAULT_PRACTICE_POLICY,
  assertPracticePolicy,
  type PracticePolicy,
} from "../learning/practice-policy.js";
import {
  selectNextCandidate,
  type SelectionTrace,
} from "../learning/selection-policy.js";
import type { TemplateMetadata } from "../math/contracts";
import type { Outcome } from "./repository";
import type { GradeBand } from "../curriculum/types";
import {
  estimateFrontier,
  gradeNumber,
  initialLevel,
  strandEstimate,
  type Frontier,
} from "../learning/frontier";
import {
  RETRIEVAL_INTERVALS,
  projectSkillEvidence,
  type SkillEvidence,
} from "./evidence.js";
import { guessChance } from "../math/guess-chance";
import {
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
  /** Internal explanation; absent for scripted placement openers. */
  selection?: SelectionTrace & { mode: "adaptive" | "support" };
};
type SkillNode = {
  id: string;
  prerequisites: string[];
  strand: string;
  gradeBand?: GradeBand;
};

/** Variety over the served sequence (answered problems, then this batch).
 * A template never repeats back to back and appears at most `templateMax`
 * times in any `templateWindow` problems, unless nothing else is eligible.
 * A skill returns only after other work, with gentler penalties as it ages;
 * a strand that filled the last few problems yields to the others. */
export const VARIETY = DEFAULT_PRACTICE_POLICY.variety;
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
    } else if (at - creditedAt >= RETRIEVAL_INTERVALS[1]!) {
      successes++;
      creditedAt = at;
    }
  }
  const intervals = RETRIEVAL_INTERVALS;
  return (
    Date.parse(last.createdAt) +
    intervals[Math.min(successes, intervals.length - 1)]
  );
}

/** Select across strands for each problem, reserving variety within a batch.
 * Each strand aims at its own estimated frontier; due reviews, missed skills
 * and unmet prerequisites take reserved slots. Nothing grants ancestor credit. */
export function planMixedPractice(options: {
  /** Compile with createPracticePolicy; immutable and local to this request. */
  policy?: PracticePolicy;
  templates: readonly TemplateMetadata[];
  skills: readonly SkillNode[];
  attempts: readonly Outcome[];
  evidence: readonly SkillEvidence[];
  /** Placement estimate; absent one, replay recent attempts from the default prior. */
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
  const policy = options.policy ?? DEFAULT_PRACTICE_POLICY;
  assertPracticePolicy(policy);
  const { scoring, support, variety } = policy;
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
    const estimate = strandEstimate(frontier, strand);
    const level =
      estimate.level +
      policy.target.levelOffset +
      policy.target.uncertaintyWeight * estimate.sd;
    if (!policy.target.clampToAvailable) return level;
    const floor = strandFloor.get(strand)!;
    const ceiling = strandCeiling.get(strand)!;
    if (level > ceiling) return ceiling;
    return level < floor &&
      (frontier.adaptive ?? frontier.overall).level >= floor
      ? floor
      : level;
  };
  // Placement asks whole skill items only; method-step scaffolds return once
  // the learner is placed. The first answers follow the scripted openers.
  const answered = frontier.overall.answered;
  const pool =
    answered < policy.placement.assessmentOnlyAttempts
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
  // A configured streak of independent successes demonstrates a prerequisite
  // for this scheduling decision: it leaves remediation (no mastery credit) instead of looping until
  // it is review-ready.
  const demonstrated = (skillId: string) => {
    const recent =
      stats
        .get(skillId)
        ?.recentOutcomes.slice(-support.demonstratedSuccesses) ?? [];
    return (
      recent.length === support.demonstratedSuccesses &&
      recent.every((a) => a.correct && !a.assisted)
    );
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
  // The configured error window and threshold determine prerequisite repair.
  for (const entry of stats.values()) {
    const misses = entry.recentOutcomes
      .slice(-support.errorWindow)
      .filter((attempt) => !attempt.correct || attempt.assisted).length;
    if (misses >= support.errorsToRepair) collectPrerequisites(entry.skillId);
  }
  const inSession = (at: string) => now - Date.parse(at) < variety.sessionMs;
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
  // A neutral pass advances the opening sequence without becoming evidence.
  const openingPosition =
    answered + session.filter((entry) => entry.skip).length;
  for (let slot = 0; slot < options.count; slot++) {
    const history: Served[] = [
      ...session,
      ...chosen.map((c) => ({
        templateId: c.template.id,
        skillId: c.template.skillId,
        strand: c.strand,
      })),
    ];
    const lastSkip = history.map((s) => !!s.skip).lastIndexOf(true);
    const recoveringFromSkip =
      lastSkip >= 0 && history.length - lastSkip <= variety.skipEaseProblems;
    const ease = recoveringFromSkip ? variety.skipEase : 0;
    // Openers must not bypass the configured variety and easing after a pass.
    const opener = (
      recoveringFromSkip
        ? []
        : openerCandidates({
            expectedGrade: frontier.expected,
            position: openingPosition + slot,
            learnerKey: options.learnerKey ?? seed,
            slots: policy.placement.scriptedOpeners ? options.openers : [],
          })
    )
      .map((id) => pool.find((template) => template.id === id))
      .find(
        (template) =>
          !!template &&
          !attemptedTemplates.has(template.id) &&
          (!variety.excludeSkipped || !skippedTemplates.has(template.id)) &&
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
    const byTemplate = recency(
      history,
      (s) => s.templateId,
      variety.templateWindow - 1,
    );
    const bySkill = recency(history, (s) => s.skillId, 0);
    // A skipped skill comes back after other work, through another template.
    const requeued = new Set(
      history
        .map((s, i) => ({ ...s, gap: history.length - i, i }))
        .filter(
          (s) =>
            s.skip &&
            s.gap >= variety.skipReturnAfter &&
            !history
              .slice(s.i + 1)
              .some((later) => later.skillId === s.skillId),
        )
        .map((s) => s.skillId),
    );
    const byStrand = recency(history, (s) => s.strand, variety.strandWindow);
    // With alternation enabled, support (repair/revisit/review) yields the next
    // reservation to new work.
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
      const reachable = distance <= support.prerequisiteReach;
      const reason: PracticeReason =
        remediation.has(template.skillId) && reachable
          ? "prerequisite"
          : returningError && distance <= support.revisitReach
            ? "revisit"
            : overdue && distance <= support.reviewReach
              ? "review"
              : state
                ? "frontier"
                : "explore";
      // Aim at the frontier: work far below it teaches little, and work well
      // beyond it cannot be done yet.
      let score =
        scoring.base -
        Math.abs(distance) * scoring.distancePenalty -
        (distance > scoring.harderBoundary
          ? (distance - scoring.harderBoundary) * scoring.harderPenalty
          : 0) -
        (distance < -scoring.easierBoundary
          ? (-distance - scoring.easierBoundary) * scoring.easierPenalty
          : 0);
      if (reason === "prerequisite")
        score =
          Math.max(score, scoring.prerequisite.floor) +
          scoring.prerequisite.bonus;
      if (reason === "revisit")
        score = Math.max(score, scoring.revisit.floor) + scoring.revisit.bonus;
      if (reason === "review")
        score = Math.max(score, scoring.review.floor) + scoring.review.bonus;
      if (state?.status === "review-ready" && !overdue)
        score -= scoring.notDuePenalty;
      if (!state && Math.abs(distance) <= scoring.nearbyRadius)
        score += scoring.unseenBonus;
      // Seek information where the estimate is least certain, and lean into
      // strands below the level expected for the learner's age.
      const estimate = strandEstimate(frontier, strand);
      if (Math.abs(distance) <= scoring.nearbyRadius) {
        score += scoring.uncertaintyWeight * estimate.sd;
        score +=
          scoring.ageGapWeight *
          Math.max(
            0,
            Math.min(scoring.ageGapCap, frontier.expected - estimate.level),
          );
      }
      // Interleave: a miss returns after other work, never as an instant
      // loop, and a template that was just seen waits longest of all.
      const templateGap = byTemplate.gap(template.id);
      let familyAdjustment = 0;
      if (templateGap <= variety.templateFade)
        familyAdjustment -=
          (variety.templatePenalty * (variety.templateFade + 1 - templateGap)) /
          variety.templateFade;
      score -= variety.skillPenalty[bySkill.gap(template.skillId)] ?? 0;
      if (skippedTemplates.has(template.id))
        familyAdjustment -= variety.skipPenalty;
      // Just after a skip, prefer work a little below the learner's level.
      if (ease) score -= variety.skipEaseWeight * Math.max(0, distance + ease);
      if (strand === lastStrand) score -= scoring.sameStrandPenalty;
      score -= variety.strandPenalty * byStrand.count(strand);
      score -=
        chosen.filter((entry) => entry.template.skillId === template.skillId)
          .length * scoring.batchSkillPenalty;
      score -=
        chosen.filter((entry) => entry.strand === strand).length *
        scoring.batchStrandPenalty;
      return {
        template,
        reason,
        strand,
        score,
        familyScore: score + familyAdjustment,
        poolEligible:
          grade <= target + scoring.poolReach || reason === "prerequisite",
        support: ["prerequisite", "revisit", "review"].includes(reason),
        fresh:
          templateGap > variety.minimumTemplateGap &&
          byTemplate.count(template.id) < variety.templateMax &&
          (!variety.excludeSkipped || !skippedTemplates.has(template.id)),
        skillGap: bySkill.gap(template.skillId),
      };
    });
    const ceilinged = options.strictCeiling
      ? candidates.filter((entry) => entry.poolEligible)
      : candidates;
    if (!ceilinged.length) break;
    // When enabled, freshness is a rule whenever another problem can be asked.
    const varied = variety.enforceFreshness
      ? ceilinged.filter((entry) => entry.fresh)
      : [];
    const eligible = varied.length ? varied : ceilinged;
    // Reserve one support/retrieval slot per batch so variety cannot starve a
    // gap or a due review; immediate repetitions wait for intervening work.
    const reserved =
      support.reserveSlot &&
      (!support.alternate || !lastWasSupport) &&
      !chosen.some((entry) =>
        ["prerequisite", "revisit", "review"].includes(entry.reason),
      )
        ? eligible.filter(
            (entry) =>
              entry.support &&
              entry.skillGap > support.minimumSkillGap &&
              !chosen.some(
                (choice) => choice.template.skillId === entry.template.skillId,
              ),
          )
        : [];
    const reservedSupport = reserved.length > 0;
    const { candidate, trace } = selectNextCandidate(
      reservedSupport ? reserved : eligible,
      `${seed}:${slot}`,
      undefined,
      policy,
    );
    const { template, reason, strand } = candidate;
    chosen.push({
      template,
      reason,
      strand,
      selection: {
        ...trace,
        mode: reservedSupport ? "support" : "adaptive",
      },
    });
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
