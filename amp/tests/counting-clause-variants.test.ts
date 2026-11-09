import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem, generateProblemFor } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

function assertBrief(text: string, where: string) {
  for (const sentence of sentences(text))
    assert.ok(words(sentence) <= 35, `${where}: ${sentence}`);
}

function collect(
  id: string,
  take: number,
  match: (problem: ReturnType<typeof generateProblem>) => boolean,
) {
  const found = [];
  for (let i = 0; found.length < take && i < 8000; i++) {
    const problem = generateProblem(id, `clause-${i}`);
    if (match(problem)) found.push(problem);
  }
  assert.equal(found.length, take, `${id} produced ${found.length} of ${take}`);
  return found;
}

test("skip-count version 1 stays a multiple of the step with the blank last", () => {
  for (let i = 0; i < 40; i++) {
    const problem = generateProblem("skip-count-missing", `gate-${i}`, 1);
    assert.equal(problem.public.templateVersion, 1);
    assert.equal(problem.variant, undefined);
    assert.match(
      problem.public.prompt,
      /^Count by (5|10|100): (\d+), (\d+), (\d+), □\. What comes next\?$/,
    );
    assert.doesNotMatch(problem.public.prompt, /What number is missing/);
    assert.doesNotMatch(problem.public.prompt, /^What comes next/);
    const parts = problem.public.prompt.match(/\d+/g)!.map(Number);
    const [step, a, b, c] = parts;
    assert.equal(b! - a!, step);
    assert.equal(c! - b!, step);
    assert.equal(a! % step!, 0);
    assert.equal(Number(problem.answer), c! + step!);
  }
});

test("by-10s and by-100s within 1000 meet the clause counts", () => {
  const tens = collect(
    "skip-count-missing",
    300,
    (problem) => problem.variant?.axes?.family === "by-10s-within-1000",
  );
  let crossed = 0;
  for (const problem of tens) {
    generatedProblemSchema.parse(problem);
    assert.equal(problem.public.response.kind, "number");
    assert.equal(problem.public.templateVersion, 2);
    assertBrief(problem.public.prompt, "tens prompt");
    assertBrief(problem.hint, "tens hint");
    for (const line of problem.explanation) assertBrief(line, "tens explanation");
    const filled = filledSkip(problem.public.prompt, Number(problem.answer));
    assert.ok(filled.every((term) => term <= 1000));
    if (
      filled.some(
        (term, index) =>
          index > 0 &&
          Math.floor(term / 100) !== Math.floor(filled[index - 1]! / 100),
      )
    )
      crossed++;
    const answer = Number(problem.answer);
    const before = termBeforeBlank(problem.public.prompt);
    assert.equal(answer, before + 10);
    assert.ok(!new RegExp(`(?<!\\d)${answer}(?!\\d)`).test(problem.hint));
  }
  assert.ok(crossed / tens.length >= 0.3, `crossed ${crossed}`);

  const hundreds = collect(
    "skip-count-missing",
    300,
    (problem) => problem.variant?.axes?.family === "by-100s-within-1000",
  );
  let landed = 0;
  for (const problem of hundreds) {
    const answer = Number(problem.answer);
    const filled = filledSkip(problem.public.prompt, answer);
    assert.ok(filled.every((term) => term <= 1000));
    const tail = filled[0]! % 100;
    assert.ok(filled.every((term) => term % 100 === tail));
    assert.equal(answer, termBeforeBlank(problem.public.prompt) + 100);
    if (answer === 1000) landed++;
    assert.ok(problem.explanation.some((line) => line.includes(String(answer))));
  }
  assert.ok(landed / hundreds.length >= 0.1, `landed ${landed}`);
});

function termBeforeBlank(prompt: string): number {
  const tokens = skipTokens(prompt);
  const at = tokens.indexOf("blank");
  assert.ok(at > 0, prompt);
  return tokens[at - 1] as number;
}

function skipTokens(prompt: string): (number | "blank")[] {
  let rest = prompt;
  if (rest.startsWith("Count by ")) rest = rest.replace(/^Count by \d+: /, "");
  else if (rest.startsWith("What comes next? "))
    rest = rest.slice("What comes next? ".length);
  else rest = rest.slice("What number is missing? ".length);
  rest = rest
    .replace(/ What comes next\?$/, "")
    .replace(/ What number is missing\?$/, "")
    .replace(/\.$/, "");
  return rest.split(", ").map((token) => (token === "□" ? "blank" : Number(token)));
}

function filledSkip(prompt: string, answer: number): number[] {
  return skipTokens(prompt).map((token) => (token === "blank" ? answer : token));
}

test("count by twos and odd or even stay numeric", () => {
  for (let i = 0; i < 20; i++) {
    const old = generateProblem("pairing-leftover", `gate-${i}`, 1);
    assert.equal(old.public.templateVersion, 1);
    assert.equal(old.variant, undefined);
    assert.match(
      old.public.prompt,
      /^Put \d+ counters? into pairs\. How many counters will be left/,
    );
    assert.doesNotMatch(old.public.prompt, /by 2s|cups/);
    assert.equal(old.public.response.kind, "number");
  }
  const twos = collect(
    "pairing-leftover",
    200,
    (problem) => problem.variant?.axes?.family === "count-by-twos-total",
  );
  let odd = 0;
  for (const problem of twos) {
    assert.equal(problem.public.response.kind, "number");
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "grouped-counters");
    if (figure?.kind !== "grouped-counters") continue;
    assert.equal(Number(problem.answer), figure.total);
    assert.notEqual(Math.floor(figure.total / 2), figure.total);
    if (figure.total % 2 === 1) odd++;
    assert.ok(problem.explanation.some((line) => line.includes(String(Math.floor(figure.total / 2)))));
  }
  assert.ok(odd / twos.length >= 0.45, `odd ${odd}`);

  const parity = collect(
    "pairing-leftover",
    200,
    (problem) => problem.variant?.axes?.family === "name-odd-or-even",
  );
  const teens = new Set<number>();
  let large = 0;
  let saw14 = false;
  for (const problem of parity) {
    assert.equal(problem.public.response.kind, "number");
    const n = Number(problem.public.prompt.match(/\d+/)![0]);
    assert.equal(Number(problem.answer), n % 2);
    if (n >= 12) large++;
    if ([12, 14, 16, 18, 20].includes(n)) teens.add(n);
    if (n === 14) {
      saw14 = true;
      assert.equal(problem.answer, "0");
      assert.ok(
        problem.explanation.some((line) => line.includes("leftover is zero")),
      );
    }
  }
  assert.ok(large / parity.length >= 0.4, `large ${large}`);
  assert.deepEqual([...teens].sort((a, b) => a - b), [12, 14, 16, 18, 20]);
  assert.ok(saw14);
});

test("empty frames make zero a count, and teens still appear", () => {
  for (let i = 0; i < 20; i++) {
    const old = generateProblem("numeral-for-quantity", `gate-${i}`, 1);
    assert.equal(old.public.templateVersion, 1);
    assert.equal(old.variant, undefined);
    assert.equal(
      old.public.prompt,
      "How many counters are in the frames? Write the number.",
    );
    assert.doesNotMatch(old.public.prompt, /in the frame\?/);
  }
  let zeros = 0;
  let teens = 0;
  let saw20 = false;
  const empty = [];
  for (let i = 0; i < 500; i++) {
    const problem = generateProblem("numeral-for-quantity", `numeral-${i}`);
    assert.equal(problem.public.response.kind, "number");
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "ten-frame");
    if (figure?.kind !== "ten-frame") continue;
    const answer = Number(problem.answer);
    assert.equal(answer, figure.first);
    if (answer === 0) zeros++;
    if (answer >= 11 && answer <= 20) teens++;
    if (answer === 20) saw20 = true;
    if (problem.variant?.axes?.family === "empty-frame-zero") empty.push(problem);
  }
  assert.ok(zeros / 500 >= 0.1, `zeros ${zeros}`);
  assert.ok(teens / 500 >= 0.3, `teens ${teens}`);
  assert.ok(saw20);
  assert.ok(empty.length > 0);
  for (const problem of empty) {
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "ten-frame");
    if (figure?.kind !== "ten-frame") continue;
    assert.equal(figure.first, 0);
    assert.equal(figure.second, 0);
    assert.equal(figure.capacity, 10);
    assert.equal(problem.answer, "0");
    assert.ok(!problem.hint.includes("0"));
  }
});

test("equal counts can be spread farther than they are bunched", () => {
  for (let i = 0; i < 20; i++) {
    const old = generateProblem("compare-groups", `gate-${i}`, 1);
    assert.equal(old.public.templateVersion, 1);
    assert.equal(old.variant, undefined);
    assert.match(old.public.prompt, /^Are there (more|fewer) circles or \1 squares\?$/);
    assert.doesNotMatch(old.public.prompt, /top row/);
  }
  const traps = collect(
    "compare-groups",
    200,
    (problem) => problem.variant?.axes?.family === "spacing-trap-same",
  );
  const left = 26;
  const right = 294;
  const step = 30;
  for (const problem of traps) {
    assert.equal(problem.public.response.kind, "choice");
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "counter-rows");
    if (figure?.kind !== "counter-rows") continue;
    assert.equal(figure.circles, figure.squares);
    assert.ok(figure.circles >= 4 && figure.circles <= 6);
    assert.notEqual(figure.spread, "none");
    const spreadSpan = right - left;
    const bunchedSpan = (figure.circles - 1) * step;
    assert.ok(spreadSpan / bunchedSpan >= 1.5, `${spreadSpan} vs ${bunchedSpan}`);
    assert.equal(problem.answer, "option-c");
  }
  let same = 0;
  let longer = 0;
  let longerCorrect = 0;
  for (let i = 0; i < 400; i++) {
    const problem = generateProblem("compare-groups", `share-${i}`);
    const figure = problem.public.figure;
    if (figure?.kind !== "counter-rows") continue;
    if (figure.circles === figure.squares) same++;
    if (figure.spread === "none") continue;
    longer++;
    const response = problem.public.response;
    if (response.kind !== "choice") continue;
    const label =
      response.options.find((option) => option.id === problem.answer)?.label.toLowerCase() ??
      "";
    const namesLonger =
      (figure.spread === "circles" &&
        (label.includes("circle") || label.includes("top"))) ||
      (figure.spread === "squares" &&
        (label.includes("square") || label.includes("bottom")));
    if (namesLonger) longerCorrect++;
  }
  assert.ok(same / 400 >= 0.25 && same / 400 <= 0.4, `same ${same}`);
  assert.ok(longerCorrect / longer <= 0.6, `longer ${longerCorrect}/${longer}`);
});

test("count-objects families keep a typed count and a legacy reprint", () => {
  for (let i = 0; i < 20; i++) {
    const old = generateProblem("count-objects", `gate-${i}`, 1);
    assert.equal(old.public.templateVersion, 1);
    assert.equal(old.variant, undefined);
    assert.equal(old.public.prompt, "How many dots are shown?");
    assert.equal(old.public.figure?.kind, "collection");
    assert.doesNotMatch(old.public.prompt, /One more|Ana counted|leaves/);
  }
  const bare = generateProblemFor("count-objects", "no-scenes", []);
  assert.equal(bare.public.figure?.kind, "collection");

  const arrives = collect(
    "count-objects",
    200,
    (problem) => problem.variant?.axes?.family === "one-more-arrives",
  );
  const leaves = collect(
    "count-objects",
    80,
    (problem) => problem.variant?.axes?.family === "one-leaves",
  );
  let decade = 0;
  for (const problem of arrives) {
    assert.equal(problem.public.response.kind, "number");
    const n = Number(problem.public.prompt.match(/\d+/)![0]);
    assert.equal(Number(problem.answer), n + 1);
    assert.ok(Number(problem.answer) <= 20);
    if (n === 9 || n === 19) decade++;
    assert.equal(problem.public.figure?.kind, "scene");
  }
  assert.ok(decade / arrives.length >= 0.15, `decade ${decade}`);
  for (const problem of leaves) {
    const n = Number(problem.public.prompt.match(/\d+/)![0]);
    assert.equal(Number(problem.answer), n - 1);
    assert.ok(Number(problem.answer) >= 1);
  }

  const spotted = collect(
    "count-objects",
    400,
    (problem) => problem.variant?.axes?.family === "spot-the-miscount",
  );
  let right = 0;
  for (const problem of spotted) {
    const labels = /Her labels are ([0-9, ]+)\./
      .exec(problem.public.prompt)![1]!
      .split(",")
      .map((part) => Number(part.trim()));
    const n = Number(problem.answer);
    assert.equal(labels.length, n);
    const correct = labels.every((value, index) => value === index + 1);
    if (correct) right++;
    else {
      const bad = labels.findIndex((value, index) => value !== index + 1);
      assert.ok(bad > 0 && bad < n - 1, labels.join(","));
    }
  }
  assert.ok(right / spotted.length >= 0.2 && right / spotted.length <= 0.3, `right ${right}`);

  const layouts = ["line", "array", "circle", "scatter"] as const;
  const drawn = collect(
    "count-objects",
    400,
    (problem) => layouts.includes(problem.variant?.axes?.family as (typeof layouts)[number]),
  );
  const nouns = new Set<string>();
  const counts: Record<string, number> = { line: 0, array: 0, circle: 0, scatter: 0 };
  const reached20 = { line: false, array: false, circle: false };
  for (const problem of drawn) {
    const layout = problem.variant!.axes!.family!;
    counts[layout]!++;
    const noun = /How many (\w+) are shown\?/.exec(problem.public.prompt)![1]!;
    nouns.add(noun);
    assert.notEqual(noun, "dots");
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "scene");
    if (figure?.kind !== "scene") continue;
    const elements = figure.scene.elements;
    const array = elements.find((element) => element.type === "array");
    const ten = elements.find((element) => element.type === "tenFrame");
    if (layout === "line" || layout === "array") {
      assert.ok(array && array.type === "array");
      if (array?.type !== "array") continue;
      assert.equal(array.rows * array.columns, Number(problem.answer));
      if (layout === "line") assert.equal(array.rows, 1);
      if (layout === "array") {
        assert.ok(array.rows >= 1 && array.rows <= 4);
        assert.ok(array.columns >= 2 && array.columns <= 5);
        assert.equal(array.rows * array.columns, Number(problem.answer));
      }
      if (Number(problem.answer) === 20) reached20[layout] = true;
    } else {
      assert.ok(ten && ten.type === "tenFrame");
      if (ten?.type !== "tenFrame") continue;
      const total = ten.groups.reduce((sum, group) => sum + group.count, 0);
      assert.equal(total, Number(problem.answer));
      if (layout === "scatter") assert.ok(total <= 10);
      if (layout === "circle" && total === 20) reached20.circle = true;
    }
  }
  for (const layout of layouts)
    assert.ok(counts[layout]! / drawn.length >= 0.2, `${layout} ${counts[layout]}`);
  assert.ok(reached20.line && reached20.array && reached20.circle);
  assert.ok(nouns.size >= 6, [...nouns].join(","));
});
