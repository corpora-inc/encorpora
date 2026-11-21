import { describe, expect, it } from "vitest";
import {
  becameStrong,
  evidenceMoments,
  momentsFor,
  nextStreak,
  streakMoment,
} from "../tier";
import { colorfulVoice, streakLift } from "../sound";
import { burstCount, pieceCount } from "../stage";
import { boostFor, namesFigureColors } from "../Celebration";

const right = { id: "a1", correct: true, assisted: false };
const helped = { id: "a2", correct: true, assisted: true };
const miss = { id: "a3", correct: false, assisted: false };
const skip = { id: "a4", correct: true, assisted: false, skipped: true };
const base = { streak: 1, pointsBefore: 4 };

describe("what an answer earns on screen", () => {
  it("a right answer without help in Colorful: the burst and its point", () => {
    expect(momentsFor({ ...base, answer: right, look: "bold" })).toEqual([
      "right",
    ]);
  });
  it("nothing in Calm, whatever the answer", () => {
    for (const answer of [right, helped, miss, skip])
      expect(
        momentsFor({ answer, look: "calm", streak: 10, pointsBefore: 9 }),
      ).toEqual([]);
  });
  it("nothing new for a miss, a helped answer or a skip", () => {
    for (const answer of [helped, miss, skip])
      expect(
        momentsFor({
          answer,
          look: "bold",
          streak: 0,
          pointsBefore: 9,
          mastered: true,
        }),
      ).toEqual([]);
  });
  it("streaks of 3, 5 and every 10 have their moment; others none", () => {
    const at = (streak: number) =>
      momentsFor({ answer: right, look: "bold", streak, pointsBefore: 0 })[1];
    expect([1, 2, 3, 4, 5, 6, 9, 10, 15, 20].map(at)).toEqual([
      undefined,
      undefined,
      "streak-3",
      undefined,
      "streak-5",
      undefined,
      undefined,
      "streak-10",
      undefined,
      "streak-10",
    ]);
    expect([0, 3, 5, 10, 30].map(streakMoment)).toEqual([
      null,
      "streak-3",
      "streak-5",
      "streak-10",
      "streak-10",
    ]);
  });
  it("every tenth point is a moment, the biggest the chip has", () => {
    expect(
      momentsFor({ answer: right, look: "bold", streak: 3, pointsBefore: 9 }),
    ).toEqual(["right", "points-10"]);
    expect(
      momentsFor({ answer: right, look: "bold", streak: 3, pointsBefore: 10 }),
    ).toEqual(["right", "streak-3"]);
    // An unknown total has no tenth.
    expect(
      momentsFor({
        answer: right,
        look: "bold",
        streak: 1,
        pointsBefore: null,
      }),
    ).toEqual(["right"]);
  });
  it("the host's mastered moment is the big one", () => {
    expect(
      momentsFor({ ...base, answer: right, look: "bold", mastered: true }),
    ).toEqual(["right", "strong"]);
  });
  it("a run grows on right answers without help and starts again silently", () => {
    expect(nextStreak(4, right)).toBe(5);
    expect([helped, miss, skip].map((answer) => nextStreak(4, answer))).toEqual(
      [0, 0, 0],
    );
  });
});

const evidence = (
  status: "practicing" | "review-ready",
  attempts: number,
  recent: [boolean, boolean][],
  independentCorrect = 3,
) => ({
  status,
  attempts,
  independentCorrect,
  recent: recent.map(([correct, assisted]) => ({ correct, assisted })),
});
const R: [boolean, boolean] = [true, false];
const W: [boolean, boolean] = [false, false];

describe("Strong and Earned, from the skill's record", () => {
  it("Strong when this answer made it so", () => {
    // Seen Building just before.
    expect(
      becameStrong(evidence("review-ready", 9, [R, R, R, R, R]), "practicing"),
    ).toBe(true);
    // Already Strong: never again.
    expect(
      becameStrong(
        evidence("review-ready", 9, [R, R, R, R, R]),
        "review-ready",
      ),
    ).toBe(false);
    // Not seen this sitting: the fifth answer, or one after a miss.
    expect(becameStrong(evidence("review-ready", 5, [R, R, W, R, R]))).toBe(
      true,
    );
    expect(becameStrong(evidence("review-ready", 8, [R, R, R, W, R]))).toBe(
      true,
    );
    // The record can't tell: no.
    expect(becameStrong(evidence("review-ready", 8, [W, R, R, R, R]))).toBe(
      false,
    );
    expect(becameStrong(evidence("practicing", 5, [R, R, R, W, R]))).toBe(
      false,
    );
  });
  it("Earned on a skill's first right answer without help", () => {
    expect(
      evidenceMoments({
        answer: right,
        look: "bold",
        evidence: evidence("practicing", 1, [R], 1),
      }),
    ).toEqual(["earned"]);
    expect(
      evidenceMoments({
        answer: right,
        look: "bold",
        evidence: evidence("practicing", 3, [W, R, R], 2),
      }),
    ).toEqual([]);
  });
  it("Strong wins over Earned, and neither plays in Calm or on a miss", () => {
    const strong = evidence("review-ready", 5, [R, R, R, R, R], 5);
    expect(
      evidenceMoments({ answer: right, look: "bold", evidence: strong }),
    ).toEqual(["strong"]);
    expect(
      evidenceMoments({ answer: right, look: "calm", evidence: strong }),
    ).toEqual([]);
    expect(
      evidenceMoments({
        answer: helped,
        look: "bold",
        evidence: evidence("practicing", 1, [[true, true]], 0),
      }),
    ).toEqual([]);
  });
});

describe("sound and weight", () => {
  it("a streak lifts the sound two semitones a step, up to an octave", () => {
    expect([1, 2, 3, 7, 20].map(streakLift)).toEqual([0, 2, 4, 12, 12]);
    const voice = colorfulVoice(() => 3);
    const plain = colorfulVoice(() => null);
    expect(voice(false)?.notes[0]).toBeCloseTo(523.25 * 2 ** (4 / 12));
    // A right answer with help keeps the plain sound.
    expect(plain(false)).toBeNull();
    expect(plain(true)?.notes.length).toBe(6);
  });
  it("a machine with two cores or fewer gets half the pieces", () => {
    expect([pieceCount(44, 2), pieceCount(44, 1), pieceCount(44, 8)]).toEqual([
      22, 22, 44,
    ]);
    expect(pieceCount(14)).toBe(14);
    // The right answer's burst, by the machine.
    expect([burstCount(2), burstCount(4), burstCount(8), burstCount()]).toEqual(
      [16, 28, 40, 40],
    );
  });
  it("a run lifts the page's color from 3 in a row; a break lets it go", () => {
    expect([0, 2, 3, 6, 10, 20].map(boostFor)).toEqual([
      0, 0, 0.125, 0.5, 1, 1,
    ]);
  });
  it("finds a figure color named in a problem's words, not elsewhere", () => {
    expect(
      namesFigureColors({ prompt: "The gold arrow goes from w to v." }),
    ).toBe(true);
    expect(
      namesFigureColors({
        prompt: "Which equations match?",
        response: { options: [{ label: "teal pieces" }] },
      }),
    ).toBe(true);
    expect(namesFigureColors({ prompt: "A bag holds 3 red counters." })).toBe(
      false,
    );
    expect(namesFigureColors({ prompt: "Which shape is a rhombus?" })).toBe(
      false,
    );
  });
});
