import type { Engine, Section } from "./types.ts";

/**
 * The rule sections a topic's verified questions cite, most cited first. It
 * gives every topic something to read straight from the rules, including a
 * topic whose lessons are not generated yet.
 */
export function topicSections(e: Pick<Engine, "skills" | "questions" | "sections">, topicId: string, max = 6): Section[] {
  const skillIds = new Set(e.skills.filter((s) => s.topic_id === topicId).map((s) => s.skill_id));
  const count = new Map<string, number>();
  for (const q of e.questions) if (skillIds.has(q.skill_id)) for (const id of q.section_ids) count.set(id, (count.get(id) ?? 0) + 1);
  return [...count.entries()]
    .map(([id, n]) => ({ s: e.sections.get(id), n }))
    .filter((x): x is { s: Section; n: number } => x.s !== undefined)
    .sort((a, b) => b.n - a.n || a.s.ord - b.s.ord)
    .slice(0, max)
    .map((x) => x.s);
}
