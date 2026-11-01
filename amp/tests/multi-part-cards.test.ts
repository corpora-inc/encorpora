import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generatedProblemSchema,
  publicProblemSchema,
} from "../src/math/contracts";
import { generateProblem, gradeAnswer, templates } from "../src/math/engine";
import {
  cardRows,
  chooseOption,
  clearChoice,
  MULTI_PART_CARDS,
  multiPartAnswerText,
  multiPartChoiceResponseSchema,
  multiPartGuessChance,
  responseForClient,
  type MultiPartChoiceResponse,
} from "../src/math/multi-part-choice";
import { cardValue } from "../src/math/multi-part-support";
import { problemGuessChance } from "../src/math/guess-chance";

const options = (...labels: string[]) =>
  labels.map((label, i) => ({ id: "abcdef"[i]!, label }));
const numbers = options("3", "10", "13", "30");
const ops = options("$+$", "$-$");
const cards: MultiPartChoiceResponse = {
  kind: "multi-part-choice",
  label: "Put a card in each box",
  layout: "cards",
  blanks: [
    { id: "total", label: "The number of counters", options: numbers },
    { id: "op", label: "The operation", options: ops },
    { id: "by", label: "The number of rows", options: numbers },
  ],
  sentence: [
    { blank: "total" },
    { text: " " },
    { blank: "op" },
    { text: " " },
    { blank: "by" },
    { text: "\n$=3$" },
  ],
};

test("a card tray has one row per distinct set of options, in blank order", () => {
  assert.equal(multiPartChoiceResponseSchema.safeParse(cards).success, true);
  assert.deepEqual(
    cardRows(cards).map((row) => row.blanks.map((b) => b.id)),
    [["total", "by"], ["op"]],
  );
  // A label in two rows would show two cards that look the same.
  const clash = structuredClone(cards);
  clash.blanks[1]!.options = options("$+$", "10");
  assert.equal(multiPartChoiceResponseSchema.safeParse(clash).success, false);
  // Reuse is a property of cards only.
  assert.equal(
    multiPartChoiceResponseSchema.safeParse({
      ...cards,
      layout: "inline",
      reuse: true,
    }).success,
    false,
  );
  assert.equal(
    multiPartChoiceResponseSchema.safeParse({ ...cards, reuse: true }).success,
    true,
  );
});

test("a card used once leaves fewer cards for the later boxes of its row", () => {
  // 4 × 3 number placements, 2 operations.
  assert.equal(multiPartGuessChance(cards), 1 / (4 * 3 * 2));
  assert.equal(
    multiPartGuessChance({ ...cards, reuse: true }),
    1 / (4 * 4 * 2),
  );
});

test("taking a card back empties only its box", () => {
  let raw = chooseOption(cards, "", "total", "d");
  raw = chooseOption(cards, raw, "by", "b");
  raw = clearChoice(cards, raw, "total");
  assert.equal(raw, JSON.stringify({ by: "b" }));
  assert.equal(clearChoice(cards, raw, "by"), "");
});

test("a line break in a cards sentence reads as a clause break", () => {
  const raw = JSON.stringify({ total: "d", op: "b", by: "b" });
  assert.equal(multiPartAnswerText(cards, raw), "30 $-$ 10; $=3$");
  const headed = structuredClone(cards);
  headed.sentence = [{ text: "Rows:\n" }, ...cards.sentence!.slice(0, -1)];
  assert.equal(multiPartAnswerText(headed, raw), "Rows: 30 $-$ 10");
});

test("a client without the cards capability gets the same blanks inline", () => {
  const problem = { id: "p", response: { ...cards, reuse: true as const } };
  assert.equal(responseForClient(problem, [MULTI_PART_CARDS]), problem);
  const old = responseForClient(problem, ["multi-part-choice-v1"]);
  const response = old.response as MultiPartChoiceResponse;
  assert.equal(response.layout, "inline");
  assert.equal("reuse" in response, false);
  assert.deepEqual(response.blanks, cards.blanks);
  assert.equal(
    response.sentence!.some((p) => "text" in p && p.text.includes("\n")),
    false,
  );
  assert.equal(multiPartChoiceResponseSchema.safeParse(response).success, true);
  // Other responses pass through untouched.
  const choice = { response: { kind: "choice", options: [] } };
  assert.equal(responseForClient(choice, []), choice);
});

const cardTemplates = templates.filter((t) => {
  const r = generateProblem(t.id, "cards-probe:0").public.response;
  return r.kind === "multi-part-choice" && r.layout === "cards";
});

test("equations are built from cards in every equation-building family", () => {
  assert.deepEqual(cardTemplates.map((t) => t.id).sort(), [
    "array-division-slots",
    "booth-equation-slots",
    "budget-inequality-slots",
    "compare-symbol-blanks",
    "conversion-proportion-blanks",
    "cylinder-volume-slots",
    "delivery-operations-slots",
    "dilation-rule-slots",
    "inequality-number-blanks",
    "square-root-solutions-slots",
    "story-operations-slots",
    "table-equation-slots",
    "unit-fraction-division-slots",
    "unit-price-sentence-slots",
  ]);
});

test("card families: valid trays, a different card per box unless reused, the key graded correct, and an inline form for older clients", () => {
  for (const t of cardTemplates)
    for (let i = 0; i < 120; i++) {
      const problem = generatedProblemSchema.parse(
        generateProblem(t.id, `cards:${i}`),
      );
      const response = problem.public.response as MultiPartChoiceResponse;
      const where = `${t.id} seed ${i}`;
      assert.equal(response.layout, "cards", where);
      const key = JSON.parse(problem.answer) as Record<string, string>;
      for (const row of cardRows(response)) {
        // Number cards differ in value; a tray never shows 0.5 and 1/2.
        const values = row.options
          .map((o) => cardValue(o.label))
          .filter((v) => v !== null);
        assert.equal(new Set(values).size, values.length, where);
        if (!response.reuse) {
          const used = row.blanks.map((b) => key[b.id]);
          assert.equal(new Set(used).size, used.length, where);
        }
        // Least to greatest, except where order is the question.
        if (
          t.id !== "inline-linear-features" &&
          t.id !== "inequality-number-blanks"
        )
          assert.deepEqual(
            values,
            [...values].sort((a, b) => a - b),
            where,
          );
      }
      assert.equal(gradeAnswer(problem, problem.answer), true, where);
      assert.equal(
        problemGuessChance(problem),
        multiPartGuessChance(response),
        where,
      );
      const inline = responseForClient(problem.public, []);
      assert.equal(publicProblemSchema.safeParse(inline).success, true, where);
      assert.equal(
        gradeAnswer({ ...problem, public: inline }, problem.answer),
        true,
        where,
      );
    }
});

test("the array division draws the array the prompt describes", () => {
  for (let i = 0; i < 60; i++) {
    const problem = generateProblem("array-division-slots", `array:${i}`);
    const [, rows, columns] = problem.public.prompt.match(
      /(\d+) rows with (\d+) counters in each row/,
    )!;
    const figure = problem.public.figure as {
      kind: string;
      scene: { elements: { type: string; rows: number; columns: number }[] };
    };
    assert.equal(figure.kind, "scene");
    const array = figure.scene.elements.find((e) => e.type === "array")!;
    assert.equal(array.rows, Number(rows));
    assert.equal(array.columns, Number(columns));
  }
});
