/**
 * Identifier types.
 *
 * Skill ids are `dw.<domain>.<cluster>.<slug>` and **immutable forever** — they are
 * mastery keys on learner devices. A rename means minting a new id and setting
 * `status: "deprecated"` + `supersededBy` on the old one (CURRICULUM.md, gate CG-1).
 *
 * Every id is a branded string so an untagged string cannot be passed where an id is
 * expected. Branding is type-level only; nothing survives type stripping.
 */

declare const skillIdBrand: unique symbol;
declare const locKeyBrand: unique symbol;
declare const familyIdBrand: unique symbol;
declare const malRuleIdBrand: unique symbol;
declare const capabilityBrand: unique symbol;

export type SkillId = string & { readonly [skillIdBrand]: true };
export type LocKey = string & { readonly [locKeyBrand]: true };
export type FamilyId = string & { readonly [familyIdBrand]: true };
export type MalRuleId = string & { readonly [malRuleIdBrand]: true };
export type CapabilityTag = string & { readonly [capabilityBrand]: true };

/** Not branded: a form id is family-scoped and never leaves its family's namespace. */
export type FormId = string;
/** Not branded for the same reason; the representation registry owns the values. */
export type RepId = string;
/** `${family}@${familyRev}:${skillId}:L${level}:${seed}` */
export type ExerciseId = string;

export const SKILL_ID_PATTERN = /^dw\.[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/;
export const LOC_KEY_PATTERN = /^dw\.[a-z0-9]+(\.[a-z0-9-]+)+$/;
export const FAMILY_ID_PATTERN = /^gen\.[a-z0-9-]+(\.[a-z0-9-]+)*$/;
export const MAL_RULE_ID_PATTERN = /^mis\.[a-z0-9-]+\.[a-z0-9-]+$/;
export const CAPABILITY_PATTERN = /^cap\.[a-z0-9-]+(\.[a-z0-9-]+)*$/;

export function isSkillId(value: string): value is SkillId {
  return SKILL_ID_PATTERN.test(value);
}

export function skillId(value: string): SkillId {
  if (!isSkillId(value)) throw new SyntaxError(`bad skill id: ${JSON.stringify(value)}`);
  return value;
}

export function locKey(value: string): LocKey {
  if (!LOC_KEY_PATTERN.test(value)) throw new SyntaxError(`bad locale key: ${JSON.stringify(value)}`);
  return value as LocKey;
}

export function familyId(value: string): FamilyId {
  if (!FAMILY_ID_PATTERN.test(value)) throw new SyntaxError(`bad family id: ${JSON.stringify(value)}`);
  return value as FamilyId;
}

export function malRuleId(value: string): MalRuleId {
  if (!MAL_RULE_ID_PATTERN.test(value)) throw new SyntaxError(`bad mal-rule id: ${JSON.stringify(value)}`);
  return value as MalRuleId;
}

export function capabilityTag(value: string): CapabilityTag {
  if (!CAPABILITY_PATTERN.test(value)) throw new SyntaxError(`bad capability tag: ${JSON.stringify(value)}`);
  return value as CapabilityTag;
}

export function exerciseIdOf(
  family: FamilyId,
  familyRev: number,
  skill: SkillId,
  level: number,
  seed: number,
): ExerciseId {
  return `${family}@${String(familyRev)}:${skill}:L${String(level)}:${String(seed)}`;
}

/** The domain segment of a skill id (`ns`, `add`, `mul`, `div`, `frac`, `alg`). */
export function domainOf(id: SkillId): string {
  const parts = id.split(".");
  const domain = parts[1];
  if (domain === undefined) throw new SyntaxError(`bad skill id: ${id}`);
  return domain;
}

/** The cluster segment of a skill id. */
export function clusterOf(id: SkillId): string {
  const parts = id.split(".");
  const cluster = parts[2];
  if (cluster === undefined) throw new SyntaxError(`bad skill id: ${id}`);
  return cluster;
}
