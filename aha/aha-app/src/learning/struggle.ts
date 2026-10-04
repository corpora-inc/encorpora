import type { AttemptEvidence, Candidate, LearnerState, Skill } from './types';
import { getSkill, skills } from './curriculum';

/** A learner who keeps missing never sees one skill more than this many times in a row. */
export const STRUGGLE_RUN_LIMIT = 3;

export interface SkillStreak {
  /** Consecutive incorrect answers at the end of this skill's own history. Other skills in between do not reset it. */
  misses: number;
  /** Consecutive independent correct answers at the end of this skill's own history. */
  successes: number;
  /** How many of the most recent attempts overall were this skill without an independent success. */
  presentedWithoutSuccess: number;
}

/** Pure trailing-outcome summary for one skill. Disputed (excluded) evidence is ignored. */
export function recentStreak(attempts: readonly AttemptEvidence[], skillId: string): SkillStreak {
  const valid = attempts.filter(a => !a.excluded);
  const own = valid.filter(a => a.skillId === skillId);
  let misses = 0, successes = 0, presentedWithoutSuccess = 0;
  for (let i = own.length - 1; i >= 0 && !own[i].correct; i--) misses++;
  for (let i = own.length - 1; i >= 0 && own[i].independent; i--) successes++;
  for (let i = valid.length - 1; i >= 0 && valid[i].skillId === skillId && !valid[i].independent; i--) presentedWithoutSuccess++;
  return { misses, successes, presentedWithoutSuccess };
}

const level = (s: Skill) => s.grade === 'K' ? 0 : s.grade;
interface Context { state: LearnerState; valid: AttemptEvidence[]; placing: boolean; streak: (skillId: string) => SkillStreak }
const practicable = (state: LearnerState, s: Skill | undefined): s is Skill =>
  !!s && s.coverage === 'verified-practice' && state.progress[s.id]?.concept !== 'provisional';

/** Verified prerequisites at every depth, nearest first. */
function ancestors(skillId: string): { skill: Skill; depth: number }[] {
  const found: { skill: Skill; depth: number }[] = [], seen = new Set([skillId]);
  let frontier = [skillId];
  for (let depth = 1; frontier.length; depth++) {
    const next: string[] = [];
    for (const id of frontier) for (const p of getSkill(id)?.prerequisites ?? []) {
      if (seen.has(p)) continue;
      seen.add(p); next.push(p);
      const skill = getSkill(p);
      if (skill?.coverage === 'verified-practice') found.push({ skill, depth });
    }
    frontier = next;
  }
  return found;
}

/** Closest grade to the midpoint; ties prefer the higher (gentler) grade, then the nearer prerequisite. */
function nearestTo(options: { skill: Skill; depth: number }[], mid: number): Skill | undefined {
  return options.slice().sort((a, b) => Math.abs(level(a.skill) - mid) - Math.abs(level(b.skill) - mid) ||
    level(b.skill) - level(a.skill) || a.depth - b.depth || a.skill.id.localeCompare(b.skill.id))[0]?.skill;
}

/**
 * One step easier after a confirmed difficulty. Outside placement this is one direct prerequisite.
 * During placement it halves the grade gap between the missed skill and the highest demonstrated
 * prerequisite (or Kindergarten), instead of walking down every prerequisite one miss at a time.
 */
function stepDown({ state, valid, placing, streak }: Context, skillId: string): Skill | undefined {
  const skill = getSkill(skillId);
  if (!skill) return undefined;
  if (placing) {
    const chain = ancestors(skillId), hi = level(skill);
    const shown = chain.filter(c => valid.some(a => a.skillId === c.skill.id && a.independent)).map(c => level(c.skill));
    const lo = shown.length ? Math.max(...shown) : undefined;
    const options = chain.filter(c => practicable(state, c.skill) && level(c.skill) < hi &&
      (lo === undefined ? true : level(c.skill) > lo) && streak(c.skill.id).misses < 2);
    const probe = nearestTo(options, lo === undefined ? hi / 2 : (lo + hi) / 2);
    if (probe) return probe;
  }
  // A prerequisite that is itself confirmed difficult is not an easier step; choose another approach.
  return skill.prerequisites.map(getSkill)
    .find((s): s is Skill => practicable(state, s) && streak(s.id).misses < STRUGGLE_RUN_LIMIT);
}

/** Interleave success before returning: demonstrated work first, else easier work, else a nearby new topic. */
function confidenceItem(ctx: Context, skillId: string): Candidate | undefined {
  const { state, valid, streak } = ctx, skill = getSkill(skillId)!;
  const lastSuccess = new Map<string, number>();
  valid.forEach((a, i) => { if (a.independent) lastSuccess.set(a.skillId, i); });
  const demonstrated = [...lastSuccess.keys()].map(getSkill)
    .filter((s): s is Skill => !!s && s.id !== skillId && s.coverage === 'verified-practice' && streak(s.id).misses === 0)
    .sort((a, b) => Number(state.progress[b.id]?.concept === 'provisional') - Number(state.progress[a.id]?.concept === 'provisional') ||
      Number(level(a) <= level(skill) ? 0 : 1) - Number(level(b) <= level(skill) ? 0 : 1) ||
      lastSuccess.get(b.id)! - lastSuccess.get(a.id)!);
  if (demonstrated[0]) return { skill: demonstrated[0], reason: 'confidence' };
  const down = stepDown(ctx, skillId);
  if (down) return { skill: down, reason: 'support' };
  const recent = new Set(valid.slice(-STRUGGLE_RUN_LIMIT).map(a => a.skillId));
  const lastSeen = new Map<string, number>();
  valid.forEach((a, i) => lastSeen.set(a.skillId, i));
  const nearby = skills.filter(s => s.coverage === 'verified-practice' && s.id !== skillId && !recent.has(s.id))
    .sort((a, b) => Number(level(a) > level(skill)) - Number(level(b) > level(skill)) ||
      Math.abs(level(a) - level(skill)) - Math.abs(level(b) - level(skill)) ||
      streak(a.id).misses - streak(b.id).misses ||
      (lastSeen.get(a.id) ?? -1) - (lastSeen.get(b.id) ?? -1) || a.id.localeCompare(b.id));
  return nearby[0] ? { skill: nearby[0], reason: 'confidence' } : undefined;
}

/** Retry once, then teach with a worked example, then step down only once difficulty is confirmed. */
function nextForMissed(ctx: Context, skillId: string): Candidate | undefined {
  const skill = getSkill(skillId);
  if (skill?.coverage !== 'verified-practice') return undefined;
  const { misses } = ctx.streak(skillId);
  if (misses >= STRUGGLE_RUN_LIMIT) {
    const down = stepDown(ctx, skillId);
    if (down) return { skill: down, reason: 'support' };
  }
  return misses >= 2 ? { skill, reason: 'continue', approach: 'worked-example' } : { skill, reason: 'continue' };
}

/** During placement, after succeeding below a confirmed miss, probe the middle of the remaining grade gap. */
function bracketUp({ state, valid, streak }: Context, succeededId: string): Skill | undefined {
  const below = getSkill(succeededId);
  if (!below) return undefined;
  for (let i = valid.length - 2; i >= 0; i--) {
    const above = getSkill(valid[i].skillId);
    if (!above || valid[i].correct || streak(above.id).misses < 2) continue;
    const chain = ancestors(above.id);
    if (!chain.some(c => c.skill.id === below.id)) continue;
    const options = chain.filter(c => practicable(state, c.skill) && c.skill.id !== below.id &&
      level(c.skill) > level(below) && level(c.skill) < level(above) && streak(c.skill.id).misses === 0);
    return nearestTo(options, (level(below) + level(above)) / 2);
  }
  return undefined;
}

/**
 * Local selection policy after errors (#860). It only chooses what to present next; mastery,
 * fluency and retention evidence are computed by recordAttempt exactly as before.
 */
export function struggleFocus(state: LearnerState, placing: boolean): Candidate | undefined {
  const valid = state.attempts.filter(a => !a.excluded);
  const last = valid.at(-1);
  if (!last) return undefined;
  const memo = new Map<string, SkillStreak>();
  const streak = (id: string) => { let s = memo.get(id); if (!s) memo.set(id, s = recentStreak(valid, id)); return s; };
  const ctx: Context = { state, valid, placing, streak };
  if (!last.correct) {
    if (streak(last.skillId).presentedWithoutSuccess >= STRUGGLE_RUN_LIMIT)
      return confidenceItem(ctx, last.skillId) ?? nextForMissed(ctx, last.skillId);
    return nextForMissed(ctx, last.skillId);
  }
  // A success on something else (confidence item, review, stretch) returns to the unresolved miss.
  const previous = valid.at(-2);
  if (previous && !previous.correct && previous.skillId !== last.skillId) return nextForMissed(ctx, previous.skillId);
  if (placing && last.independent) {
    const probe = bracketUp(ctx, last.skillId);
    if (probe) return { skill: probe, reason: 'placement' };
  }
  return undefined;
}
