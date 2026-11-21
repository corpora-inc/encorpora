import type { FeedbackVoice } from "../feedback-preferences";

/** C major, from C5: the plain sound's notes (E5, G5) sit inside it. */
const C5 = 523.25;
const semitone = (frequency: number, steps: number) =>
  frequency * 2 ** (steps / 12);

/** How far a streak lifts the sound: two semitones a step from the second
 * right answer in a row, up to an octave. */
export const streakLift = (streak: number) =>
  Math.min(Math.max(streak - 1, 0), 6) * 2;

/**
 * Colorful's right-answer sound: a four-note rising chord with a soft
 * octave over each note, lifted by the streak; the milestone (Strong) a
 * longer, quicker cascade. Synthesized, like the plain sound, and played
 * only when the Sound switch is on (feedback-preferences.ts decides).
 * `streak` is the run the answer being sounded brought; null: a right
 * answer that earned no point (with help), which keeps the plain sound.
 */
export function colorfulVoice(streak: () => number | null): FeedbackVoice {
  return (milestone) => {
    if (milestone)
      return {
        notes: [0, 4, 7, 12, 16, 19].map((n) => semitone(C5, n)),
        rich: true,
        step: 0.055,
      };
    const run = streak();
    if (run == null) return null;
    const lift = streakLift(run);
    return {
      notes: [0, 4, 7, 12].map((n) => semitone(C5, n + lift)),
      rich: true,
      step: 0.06,
    };
  };
}
