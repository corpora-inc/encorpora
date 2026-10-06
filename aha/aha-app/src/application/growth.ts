import { getSkill } from "../learning/curriculum";
import { evidenceSkillIds, type LearnerState } from "../learning/types";

/** How one practised skill is doing, in the learner's words on the Growth page. */
export type GrowthStatus = "growing" | "review" | "confident";
export interface GrowthSkill { id: string; title: string; status: GrowthStatus }
export interface GrowthArea { id: string; label: string; skills: GrowthSkill[] }
export interface GrowthDay { /** Local calendar date, YYYY-MM-DD. */ date: string; practiced: boolean; today: boolean }
export interface GrowthDiscovery { skillId: string; title: string; area: string; at: string }
export interface GrowthSummary {
  /** Skill areas with at least one practised skill, in a fixed curriculum order. */
  areas: GrowthArea[];
  /** The last seven local days, oldest first, ending today. */
  week: GrowthDay[];
  /** Consecutive local days with practice, ending today (or yesterday, while today is still open). */
  streak: number;
  /** The most recent skills answered correctly, newest first, one entry per skill. */
  recent: GrowthDiscovery[];
}

/** CCSS domains grouped into the few areas a learner recognises. Order is the display order. */
const AREAS: [id: string, label: string, domains: string[]][] = [
  ["number", "Number sense", ["CC", "NBT", "NS"]],
  ["operations", "Operations", ["OA"]],
  ["fractions", "Fractions and ratios", ["NF", "RP"]],
  ["measurement", "Measurement", ["MD"]],
  ["geometry", "Shapes and space", ["G"]],
  ["algebra", "Algebra", ["EE", "F"]],
  ["data", "Data and chance", ["SP"]],
];
const areaOf = (domain: string) => AREAS.find(([, , d]) => d.includes(domain));
const dayKey = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;

/**
 * The Growth page and Home summary, derived from durable evidence and skill progress only. Local
 * practice and AI-authored activities count alike (every skill an attempt is evidence for); set-aside
 * (excluded) attempts never count. Days are the device's local calendar days.
 */
export function growthSummary(learner: Pick<LearnerState, "attempts" | "progress"> | undefined, now = new Date()): GrowthSummary {
  const attempts = (learner?.attempts ?? []).filter(a => !a.excluded);
  const skillIds = new Set<string>(Object.keys(learner?.progress ?? {}));
  for (const a of attempts) for (const id of evidenceSkillIds(a)) skillIds.add(id);
  const status = (id: string): GrowthStatus => {
    const p = learner?.progress[id];
    if (p?.nextReviewAt && Date.parse(p.nextReviewAt) <= now.getTime()) return "review";
    return p?.retention === "retained" ? "confident" : "growing";
  };
  const areas = AREAS.map(([id, label]) => ({ id, label, skills: [] as GrowthSkill[] }));
  for (const id of [...skillIds].sort()) {
    const skill = getSkill(id), area = skill && areaOf(skill.domain);
    if (skill && area) areas.find(a => a.id === area[0])!.skills.push({ id, title: skill.title, status: status(id) });
  }
  const practiced = new Set(attempts.map(a => dayKey(new Date(a.at))));
  const week: GrowthDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    week.push({ date: dayKey(d), practiced: practiced.has(dayKey(d)), today: i === 0 });
  }
  let streak = 0;
  for (let i = practiced.has(dayKey(now)) ? 0 : 1; ; i++) {
    if (!practiced.has(dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)))) break;
    streak++;
  }
  const recent: GrowthDiscovery[] = [];
  const seen = new Set<string>();
  for (const a of [...attempts].filter(a => a.correct).sort((x, y) => Date.parse(y.at) - Date.parse(x.at))) {
    const id = evidenceSkillIds(a).find(s => getSkill(s));
    const skill = id ? getSkill(id) : undefined;
    if (!id || !skill || seen.has(id)) continue;
    seen.add(id);
    recent.push({ skillId: id, title: skill.title, area: areaOf(skill.domain)?.[1] ?? "", at: a.at });
    if (recent.length === 4) break;
  }
  return { areas: areas.filter(a => a.skills.length), week, streak, recent };
}
