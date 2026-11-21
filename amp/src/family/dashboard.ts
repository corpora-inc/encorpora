import { skills } from "../curriculum/catalog.js";
import { areaOf, areas, type AreaId } from "../curriculum/areas.js";
import { isEarned } from "../learning/earned.js";
import { gradeNumber } from "../learning/frontier.js";
import { levelRange } from "../learning/level-check.js";
import { templates } from "../math/engine.js";
import type { LevelEstimate } from "../schools/evidence.js";
import { focusKeys, type FocusKey } from "./dashboard-contracts.js";

/*
 * The family dashboard's pure parts (docs/architecture/family-api.md,
 * "Family dashboard"): why AMP picked a child's recent problems, each area's
 * level, and what has been checked in the grades just below it. The reads
 * live in `projection.ts` `familyDashboard()`; nothing here touches the
 * database.
 */

export type SkillRef = { id: string; title: string };
/** A catalog skill as the dashboard reads it: its area, its whole grade
 * (K = 0) and its title. */
export type DashboardSkill = SkillRef & { area: AreaId; grade: number };

/** The skills a learner can be asked: those with at least one problem type,
 * in catalog order. */
export const practiceCatalog: readonly DashboardSkill[] = (() => {
  const asked = new Set(templates.map((template) => template.skillId));
  return skills
    .filter((skill) => asked.has(skill.id))
    .map((skill) => ({
      id: skill.id,
      title: skill.title,
      area: areaOf(skill),
      grade: gradeNumber[skill.gradeBand],
    }));
})();
const titles = new Map(skills.map((skill) => [skill.id, skill.title]));
export const skillRef = (id: string): SkillRef => ({
  id,
  title: titles.get(id) ?? id,
});

/** How many problems back "lately" reaches. */
export const FOCUS_WINDOW = 20;

/** One answered problem's stored selection (`amp_instances.content.selection`). */
export type FocusAnswer = {
  skillId: string | null;
  /** `PracticeReason`, or `focus` for a chosen problem type; null for work
   * with no selection (a workbook's paper marks). */
  reason: string | null;
  /** The plan's purpose (`working`, `foundation`, `probe`). */
  purpose: string | null;
  /** A focus an adult or the child set for practice. */
  focusSkillId: string | null;
};

/** One answer's key. A choice wins (someone picked the skill); then repair
 * (`prerequisite`, `revisit`), then a due review; a foundation check is the
 * level's ground below; everything else at the level is new ground. An
 * answer with no known reason has no key. */
export function focusKey(answer: FocusAnswer): FocusKey | null {
  const { reason, purpose } = answer;
  if (reason === "focus" || answer.focusSkillId) return "chosen";
  if (reason === "prerequisite" || reason === "revisit") return "catching-up";
  if (reason === "review") return "reviewing";
  if (reason !== "frontier" && reason !== "explore") return null;
  return purpose === "foundation" ? "checking-earlier" : "new-ground";
}

export type FocusMix = {
  answered: number;
  mix: { key: FocusKey; count: number; skills: SkillRef[] }[];
};
/** The mix of a child's recent answers, newest first: each key that has any,
 * in `focusKeys` order, with the skills behind it, most often first (then
 * most recent). `answered` counts every answer read, keyed or not. */
export function focusMix(
  answers: readonly FocusAnswer[],
  title: (id: string) => SkillRef = skillRef,
): FocusMix {
  const recent = answers.slice(0, FOCUS_WINDOW);
  const buckets = new Map<FocusKey, Map<string, number>>();
  const counts = new Map<FocusKey, number>();
  for (const answer of recent) {
    const key = focusKey(answer);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!answer.skillId) continue;
    const skills = buckets.get(key) ?? new Map<string, number>();
    buckets.set(key, skills);
    // Insertion order is recency: the first time a skill is met is its latest.
    skills.set(answer.skillId, (skills.get(answer.skillId) ?? 0) + 1);
  }
  return {
    answered: recent.length,
    mix: focusKeys
      .filter((key) => counts.has(key))
      .map((key) => ({
        key,
        count: counts.get(key)!,
        skills: [...(buckets.get(key) ?? new Map()).entries()]
          .map(([id, count], order) => ({ id, count, order }))
          .sort((a, b) => b.count - a.count || a.order - b.order)
          .map(({ id }) => title(id)),
      })),
  };
}

export type DashboardLevel = {
  level: number;
  low: number;
  high: number;
  answered: number;
};
/** A stored estimate as the dashboard carries it, its likely range from
 * `levelRange` (the posterior's own, else level ± z·sd). Null before an
 * answer. */
export function dashboardLevel(
  estimate: LevelEstimate | undefined,
): DashboardLevel | null {
  if (!estimate || !(estimate.answered > 0)) return null;
  const [low, high] = levelRange(estimate);
  return { level: estimate.level, low, high, answered: estimate.answered };
}

/** Each area's level from the engine's strands (`strandAreas` through
 * `areaOf`'s table): the answered-weighted mean of the level and of each end
 * of the likely range over the area's strands with answers, and their
 * answers summed. Modeling and reasoning are not areas and add nothing. An
 * area with no answers has none. */
export function areaLevels(
  strands: Readonly<Record<string, LevelEstimate>>,
  areaOfStrand: (strand: string) => AreaId | undefined,
): Record<AreaId, DashboardLevel | null> {
  const sums = new Map<AreaId, DashboardLevel>();
  for (const [strand, estimate] of Object.entries(strands)) {
    const area = areaOfStrand(strand);
    const level = dashboardLevel(estimate);
    if (!area || !level) continue;
    const sum = sums.get(area) ?? { level: 0, low: 0, high: 0, answered: 0 };
    const n = level.answered;
    sums.set(area, {
      level: sum.level + level.level * n,
      low: sum.low + level.low * n,
      high: sum.high + level.high * n,
      answered: sum.answered + n,
    });
  }
  return Object.fromEntries(
    areas.map(({ id }) => {
      const sum = sums.get(id);
      return [
        id,
        sum
          ? {
              level: sum.level / sum.answered,
              low: sum.low / sum.answered,
              high: sum.high / sum.answered,
              answered: sum.answered,
            }
          : null,
      ];
    }),
  ) as Record<AreaId, DashboardLevel | null>;
}

/** How many whole grades below the level are checked: where practice's
 * support and foundation checks reach (`practice-policy.ts`: prerequisites
 * a grade below the target, the target half a grade below the level). */
export const CHECKED_GRADES = 2;
/** How many not-asked skills a row names. */
export const NEAREST_NOT_ASKED = 10;

/** One skill's stored evidence (`amp_skill_evidence.state`). */
export type CheckedEvidence = {
  attempts: number;
  independentCorrect: number;
  status: string | null;
};
export type Checked = {
  from: number;
  to: number;
  skills: number;
  strong: number;
  earned: number;
  tried: number;
  notAsked: number;
  nearestNotAsked: SkillRef[];
};
/** One skill's bucket, each exclusive: strong (`review-ready`, the
 * `progress.ts` `summarize` rule the evidence stores: 4 of the last 5 right
 * without help, the last one too), else earned (`isEarned`: once right
 * without help), else tried, else not asked. */
export function checkedBucket(
  evidence: CheckedEvidence | undefined,
): "strong" | "earned" | "tried" | "notAsked" {
  if (!evidence || !(evidence.attempts > 0)) return "notAsked";
  if (evidence.status === "review-ready") return "strong";
  if (isEarned(evidence)) return "earned";
  return "tried";
}

/** The skills of one area in the `CHECKED_GRADES` whole grades just below
 * `level` (a grade is below once the level rounds past it, as `shownRange`
 * names grades), bucketed. Not-asked skills are named nearest the level
 * first: the higher grade, then catalog order. Null with no level, or with
 * no grade below it. */
export function checkedBelow(
  area: AreaId,
  level: number | null,
  evidence: ReadonlyMap<string, CheckedEvidence>,
  catalog: readonly DashboardSkill[] = practiceCatalog,
): Checked | null {
  if (level === null || !Number.isFinite(level)) return null;
  const to = Math.min(12, Math.round(level)) - 1;
  if (to < 0) return null;
  const from = Math.max(0, to - CHECKED_GRADES + 1);
  const result: Checked = {
    from,
    to,
    skills: 0,
    strong: 0,
    earned: 0,
    tried: 0,
    notAsked: 0,
    nearestNotAsked: [],
  };
  const notAsked: { skill: DashboardSkill; order: number }[] = [];
  catalog.forEach((skill, order) => {
    if (skill.area !== area || skill.grade < from || skill.grade > to) return;
    result.skills++;
    const bucket = checkedBucket(evidence.get(skill.id));
    result[bucket]++;
    if (bucket === "notAsked") notAsked.push({ skill, order });
  });
  result.nearestNotAsked = notAsked
    .sort((a, b) => b.skill.grade - a.skill.grade || a.order - b.order)
    .slice(0, NEAREST_NOT_ASKED)
    .map(({ skill }) => ({ id: skill.id, title: skill.title }));
  return result;
}
