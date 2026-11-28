/**
 * Practice state, derived: harvest/practice's bank from the pack's items, and
 * the learner's state rebuilt from the recorded attempts. No zustand, so the
 * node tests run it.
 */
import { answer, createRng, indexBank, newPractice, nextPick, skillReport, type IndexedBank, type Item, type PracticeState, type SkillReport } from "../../../../harvest/practice/src/index.ts";
import type { PracticeAttempt, PracticeItems } from "../engine/types.ts";

export function toBank(items: PracticeItems) {
  const skills = items.skills.map((s) => ({ id: s.skill_id, topicId: s.topic_id, prereqs: s.prereqs }));
  const questions: Item[] = items.questions.map((q) => ({ id: q.q_id, skillId: q.skill_id, variantOf: q.variant_of, kind: q.kind === "mc" ? "mc" : "free_text", choiceCount: q.choices.length, answer: q.answer, difficulty: q.difficulty }));
  return indexBank({ skills, items: questions });
}

/** The state the recorded attempts lead to, in order. */
export function rebuild(ix: IndexedBank, attempts: readonly PracticeAttempt[]): PracticeState {
  let state = newPractice();
  for (const a of attempts) {
    const item = ix.itemById.get(a.q_id);
    if (item) state = answer(ix, state, { item, reason: "frontier" }, a.correct, Date.parse(a.at));
  }
  return state;
}

export const pickNext = (ix: IndexedBank, state: PracticeState, now: number) => nextPick(ix, state, { now, rng: createRng(`${state.step}:${now}`) });

export const reportOf = (p: { ix: IndexedBank; state: PracticeState }, now: number): SkillReport[] => skillReport(p.ix, p.state, now);

