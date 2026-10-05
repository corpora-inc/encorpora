/**
 * Gold specs validated and resolved exactly as a model's would be, for the gallery, the focus-stage
 * checks and the eval. A gold spec that fails validation is a bug in the spec or the validator; it
 * throws here so it can never pass silently (gold.test.ts reports it precisely).
 */
import { bandOf, gradeNum } from '../registry';
import { getSkill } from '../../../learning/curriculum';
import { resolveActivity } from '../resolve';
import { validateActivity, type CheckedActivity } from '../validate';
import type { ResolvedSpec } from '../../resolved';
import { gold } from './index';
import type { GoldSpec } from './types';

/** Validate a gold spec in the band of its grade, with exactly its own skills offered. */
export function checkGold(g: GoldSpec) {
  const grade = gradeNum(getSkill(g.activity.aim.skills[0]!)!.grade);
  return validateActivity(g.activity, { band: bandOf(grade), skillIds: new Set(g.activity.aim.skills) });
}
export function checkedGold(g: GoldSpec): CheckedActivity {
  const v = checkGold(g);
  if (!v.ok) throw new Error(`gold ${g.id} is invalid: ${v.problems.map(p => `${p.code} at ${p.path}`).join('; ')}`);
  return v.activity;
}
let cache: ResolvedSpec[] | undefined;
/** Every gold spec as a resolved spec, its id the gold id. */
export function goldResolved(): ResolvedSpec[] {
  return cache ??= gold.map(g => resolveActivity(checkedGold(g), g.id));
}
