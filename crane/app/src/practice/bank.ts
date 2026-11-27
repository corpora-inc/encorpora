import type { Engine, Question } from "../engine/types.ts";
import { indexBank, type IndexedBank, type Item } from "./engine.ts";

export function toItem(q: Question): Item {
  return {
    id: q.q_id,
    skillId: q.skill_id,
    variantOf: q.variant_of,
    kind: q.kind,
    choiceCount: q.choices.length,
    answer: q.answer,
    difficulty: q.difficulty,
  };
}

const cache = new WeakMap<Engine, IndexedBank>();

/** The practice bank for this pack: skills in topic order, prerequisites from the pack. */
export function bankFor(engine: Engine): IndexedBank {
  const hit = cache.get(engine);
  if (hit) return hit;
  const topicOrder = new Map(engine.topics.map((t, i) => [t.topic_id, i]));
  const skills = engine.skills
    .slice()
    .sort((a, b) => (topicOrder.get(a.topic_id) ?? 99) - (topicOrder.get(b.topic_id) ?? 99))
    .map((s) => ({ id: s.skill_id, topicId: s.topic_id, prereqs: engine.prereqs[s.skill_id] ?? [] }));
  const ix = indexBank({ skills, items: engine.questions.map(toItem) });
  cache.set(engine, ix);
  return ix;
}
