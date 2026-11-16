import { expect, test } from "vitest";
import {
  multiPartMarks,
  type MultiPartChoiceResponse,
} from "../../../../../math/multi-part-choice";
import type { WorkReplayResponse } from "../../../../../schools/teacher-contracts";
import { replayOutcome, replayVerdict } from "../WorkReplay";

/** A replay as the server sends it, with only what these rules read. */
function replay(
  over: {
    result?: WorkReplayResponse["item"]["result"];
    correct?: boolean;
    paper?: boolean;
    response?: string;
    answer?: string;
  } = {},
) {
  return {
    student: { id: "s", first: "Ana" },
    item: {
      id: "a",
      day: "2026-11-15",
      at: "2026-11-15T22:00:00.000Z",
      skill: "Percent increase and decrease",
      result: over.result ?? "independent",
    },
    skillId: "k",
    source: "served",
    problem: null,
    origin: null,
    outcome: {
      correct: over.correct ?? true,
      assisted: false,
      response: over.response ?? "",
      answer: over.answer ?? "24",
      explanation: [],
      paper: over.paper ?? false,
    },
    help: null,
    seconds: 90,
    tries: [],
    previous: null,
    next: null,
    lesson: { skillId: "k", templateId: null },
  } as unknown as WorkReplayResponse;
}

test("Q-7: a paper mark of right with nothing typed draws the answer it was marked right for", () => {
  const right = replayOutcome(
    replay({ result: "paper", paper: true, correct: true, response: "" }),
  );
  expect(right.response).toBe("24");
  expect(right.correct).toBe(true);
  // What was typed on paper is drawn as typed, right or wrong.
  expect(
    replayOutcome(replay({ paper: true, correct: false, response: "1056" }))
      .response,
  ).toBe("1056");
  // A paper "not yet" with nothing typed stays empty: never a right answer
  // under a Missed verdict.
  expect(
    replayOutcome(replay({ paper: true, correct: false, response: "" }))
      .response,
  ).toBe("");
  // In the app, the answer is what was entered.
  expect(
    replayOutcome(replay({ correct: false, response: "7" })).response,
  ).toBe("7");
});

test("Q-7: every blank of a paper-right choice sentence is marked right, none ✕", () => {
  // "[Summit Bank] costs less, by [24] dollars.", marked right on paper.
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Complete the sentence",
    layout: "inline",
    blanks: [
      {
        id: "bank",
        label: "the bank",
        options: [
          { id: "a", label: "Harbor Bank" },
          { id: "b", label: "Summit Bank" },
        ],
      },
      {
        id: "by",
        label: "how much less",
        options: [
          { id: "a", label: "24" },
          { id: "b", label: "144" },
        ],
      },
    ],
    sentence: [
      { blank: "bank" },
      { text: " costs less, by " },
      { blank: "by" },
      { text: " dollars." },
    ],
  } as MultiPartChoiceResponse;
  const outcome = replayOutcome(
    replay({
      result: "paper",
      paper: true,
      correct: true,
      response: "",
      answer: JSON.stringify({ bank: "b", by: "a" }),
    }),
  );
  const marks = multiPartMarks(response, outcome.answer, outcome.response);
  expect(marks.length).toBeGreaterThan(1);
  expect(marks.every((mark) => mark.correct)).toBe(true);
});

test("Q-7: the bar's verdict is Correct or Missed, paper or not", () => {
  expect(replayVerdict(replay({ result: "paper", paper: true }))).toEqual({
    label: "Correct",
    tone: "success",
  });
  expect(
    replayVerdict(replay({ result: "paper", paper: true, correct: false })),
  ).toEqual({ label: "Missed", tone: "danger" });
  // Typed on paper and graded: the result is the grade's, still a verdict.
  expect(
    replayVerdict(replay({ result: "missed", paper: true, correct: false }))
      .label,
  ).toBe("Missed");
  expect(
    replayVerdict(replay({ result: "missed", correct: false })).label,
  ).toBe("Missed");
  // Their own answer speaks to them.
  expect(replayVerdict(replay(), true).label).toBe("On your own");
});
