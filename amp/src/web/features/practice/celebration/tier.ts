/**
 * What a right answer earns on screen in Colorful: pure, so the rules can be
 * read and tested in one place. Two rules carried from our earlier feel work:
 * the verdict shows in one frame and nothing waits on a celebration (its
 * tail may play over the next problem); and a miss earns nothing, ever. A
 * broken streak is silent. Calm plays nothing.
 */
import { earnsPoint } from "../../../../learning/points";

export type Answer = {
  id: string;
  correct: boolean;
  assisted: boolean;
  skipped?: boolean;
};

/** The chip's own moments, smallest to biggest: a streak of 3, 5 and 10
 * right in a row, and every tenth point. One plays at a time, the biggest. */
export const chipMoments = [
  "streak-3",
  "streak-5",
  "streak-10",
  "points-10",
] as const;
export type ChipMoment = (typeof chipMoments)[number];

export type Moment =
  /** A right answer without help: the burst from the mark, "+1" to the chip. */
  | "right"
  /** The skill turned Strong with this answer: confetti over everything. */
  | "strong"
  /** The skill's first right answer without help: a stamp. */
  | "earned"
  | ChipMoment;

/** Right in a row: one more for a right answer without help; anything else
 * (a miss, a helped answer, a skip) starts again from zero, silently. */
export const nextStreak = (streak: number, answer: Answer) =>
  earnsPoint(answer) ? streak + 1 : 0;

/** The streak moment a run reaches: 3, 5, then 10 and every 10 after. */
export function streakMoment(streak: number): ChipMoment | null {
  if (streak > 0 && streak % 10 === 0) return "streak-10";
  if (streak === 5) return "streak-5";
  if (streak === 3) return "streak-3";
  return null;
}

/**
 * The moments one answer earns as it is graded. `streak` is the run with
 * this answer counted; `pointsBefore` the total before it (null: unknown,
 * so no tenth-point moment). `mastered` is the existing "Skill mastered"
 * moment, when the host knows it with the answer.
 */
export function momentsFor(input: {
  answer: Answer;
  look: "calm" | "bold";
  streak: number;
  pointsBefore: number | null;
  mastered?: boolean;
}): Moment[] {
  const { answer } = input;
  if (input.look !== "bold" || !earnsPoint(answer)) return [];
  const moments: Moment[] = ["right"];
  const tenth =
    input.pointsBefore != null &&
    Math.floor((input.pointsBefore + 1) / 10) >
      Math.floor(input.pointsBefore / 10);
  const chip = tenth ? "points-10" : streakMoment(input.streak);
  if (chip) moments.push(chip);
  if (input.mastered) moments.push("strong");
  return moments;
}

export type SkillStatus = "new" | "practicing" | "review-ready";
export type SkillEvidence = {
  status: SkillStatus;
  attempts: number;
  independentCorrect: number;
  recent?: readonly { correct: boolean; assisted: boolean }[];
};
const independent = (entry?: { correct: boolean; assisted: boolean }) =>
  !!entry && entry.correct && !entry.assisted;

/**
 * Whether this answer turned its skill Strong. `before` is the status seen
 * for the skill before this answer in this session, when known; otherwise
 * the record decides it where it can: Strong at its fifth answer, or after
 * an answer that wasn't right without help (which leaves a skill Building).
 * Where the record can't tell, no: the big moment never repeats for a skill
 * that was already Strong.
 */
export function becameStrong(
  evidence: SkillEvidence,
  before?: SkillStatus,
): boolean {
  if (evidence.status !== "review-ready") return false;
  if (before) return before !== "review-ready";
  if (evidence.attempts === 5) return true;
  const recent = evidence.recent ?? [];
  return recent.length >= 2 && !independent(recent[recent.length - 2]);
}

/**
 * The moments the skill's record adds once it arrives after a right answer
 * without help: Strong (confetti), or Earned (its first such answer, a
 * stamp). Nothing for any other answer, and nothing in Calm.
 */
export function evidenceMoments(input: {
  answer: Answer;
  look: "calm" | "bold";
  evidence: SkillEvidence;
  before?: SkillStatus;
}): Moment[] {
  if (input.look !== "bold" || !earnsPoint(input.answer)) return [];
  if (becameStrong(input.evidence, input.before)) return ["strong"];
  if (input.evidence.independentCorrect === 1) return ["earned"];
  return [];
}
