import { test } from "node:test";
import assert from "node:assert/strict";
import { templates, generateProblem } from "../src/math/engine";
import { article, count, nounFor, plural } from "../src/math/agreement";
import { articles, keptAfterOne } from "../src/math/polish";
import {
  agreementIssues,
  NounLexicon,
  problemTexts,
} from "./fixtures/count-agreement";

/** Words that describe a counted noun ("1 square counter", "1 red counter"). */
const describing =
  "red|blue|green|yellow|orange|purple|pink|black|white|gray|brown|round|square|cubic|long|short|tall|small|big|large|shaded|unshaded|extra|complete|full|empty|equal|whole";
/** Words ending in s that follow such a word but are not plural nouns
 * ("1 square is left", "1 whole contains 8 pieces"). */
const notPlural =
  "is|as|has|was|its|this|thus|plus|minus|times|less|contains|makes|holds|uses|gives|stays|remains|equals|means|goes|does|leaves|takes|needs|fits|shows|sits|lies|ends|starts|stands|represents|awards";
/** Generated text must read correctly for every count, including 1. */
const rules: [RegExp, string][] = [
  [
    new RegExp(
      `(?<![\\d./−-])\\b1 (?!(?:${[...keptAfterOne, "and", "more", "of", "or"].join("|")})\\b)[a-z]+(?<!s)s\\b`,
    ),
    "plural noun after 1",
  ],
  [/\b[Tt]here (are|were) 1\b/, "plural verb before 1"],
  [
    /(?<![\d./−+×÷=*-]\s?)\b1 (were|are|have)\b/,
    "plural verb directly after 1",
  ],
  [
    new RegExp(
      `(?<![\\d./−+×÷*-]\\s?)(?<!\\d [a-z]+,? (?:and|or) )\\b1 (?:${describing}) (?!(?:${notPlural})\\b)[a-z]+(?<!s)s\\b`,
    ),
    "plural noun after 1 and a describing word",
  ],
  [/\([a-z]*s\)|[a-z]\(s\)/, "“(s)” plural placeholder"],
  [
    /(?:^|[=:] )(-?[\d/.]+) = \1(?=[.,;]?$|[.,;] |\s[a-z])/,
    "repeated equal value (x = x)",
  ],
  // A TeX group before the parenthesis is function notation: f^{-1}(3).
  [/(?<![A-Za-z\d)}])\(\d[\d/.]*\)/, "positive number in parentheses"],
  [
    /\b1 [a-z]+ (contain|use|have|are|make|remain|hold|become|give)\b/,
    "plural verb after 1",
  ],
];

test("generated problems use correct singular and plural forms", () => {
  const issues = new Map<string, string>();
  for (const template of templates)
    for (let seed = 0; seed < 300; seed++) {
      const p = generateProblem(template.id, `grammar-${seed}`);
      for (const text of [p.public.prompt, ...p.explanation, p.hint])
        for (const [rule, name] of rules)
          if (rule.test(text) && !issues.has(`${template.id}:${name}`))
            issues.set(`${template.id}:${name}`, text);
    }
  assert.deepEqual(
    [...issues].map(([key, text]) => `${key} — ${text}`),
    [],
  );
});

test("a word ending in ss is not a plural noun", () => {
  const plural = rules[0]![0];
  assert.equal(plural.test("1 across and 5 up"), false);
  assert.equal(plural.test("1 miss and 2 makes"), false);
  assert.equal(plural.test("1 liters"), true);
});

test("polish keeps short words that end in s after 1", async () => {
  const { polish } = await import("../src/math/polish");
  assert.equal(
    polish("it uses the slope 1 as the intercept"),
    "it uses the slope 1 as the intercept",
  );
  // A verb after a bare 1 keeps its s; a plural noun loses it.
  assert.equal(polish("Adding 1 moves 1 right."), "Adding 1 moves 1 right.");
  assert.equal(polish("So the key 1 means 101."), "So the key 1 means 101.");
  assert.equal(
    polish("9 − 1 needs no regrouping."),
    "9 − 1 needs no regrouping.",
  );
  assert.equal(
    polish("Adding 0 to 1 adds nothing."),
    "Adding 0 to 1 adds nothing.",
  );
  assert.equal(polish("There are 1 trays."), "There is 1 tray.");
});

test("a describing word between 1 and its noun does not hide the plural", () => {
  const plural = rules[3]![0];
  // Founder report from a printed workbook (join-within-10).
  assert.equal(
    plural.test("There are 3 round counters and 1 square counters."),
    true,
  );
  assert.equal(plural.test("1 red counters and 3 blue counters"), true);
  assert.equal(plural.test("The area is 1 square centimeters."), true);
  assert.equal(plural.test("1 square counter and 3 round counters"), false);
  assert.equal(plural.test("2 pairs form, and 1 square is left over."), false);
  assert.equal(plural.test("1 whole contains 8 pieces"), false);
  assert.equal(plural.test("2 + 1 equal parts"), false);
  // The noun is shared by a list: "6 orange, 3 purple and 1 green sections".
  assert.equal(plural.test("6 orange, 3 purple and 1 green sections"), false);
test("a ten-frame story reads correctly when either part is 1", () => {
  const texts = Array.from({ length: 200 }, (_, seed) =>
    generateProblem("join-within-10", `one-counter-${seed}`),
  );
  const ones = texts.filter((p) =>
    /\b1 (round|square) counter\b/.test(p.public.prompt),
  );
  assert.ok(ones.length > 0, "some instances have a part of 1");
  for (const p of texts) {
    assert.doesNotMatch(p.public.prompt, /\b1 (round|square) counters\b/);
    assert.doesNotMatch(p.public.prompt, /\bThere are 1 /);
    assert.doesNotMatch(p.hint, /\b1 (round|square) counters\b/);
  }
});

/** Counts agree with their nouns everywhere a learner reads generated text:
 * prompts, answer labels and choices, hints, explanations, choice feedback,
 * and figure labels and descriptions, over many instances of every
 * template. Countable nouns are learned from the same text. */
const AGREEMENT_SEEDS = 40;
test("every count agrees with its noun, verb and article", () => {
  const corpus: { id: string; where: string; text: string }[] = [];
  for (const template of templates)
    for (let seed = 0; seed < AGREEMENT_SEEDS; seed++)
      for (const t of problemTexts(
        generateProblem(template.id, `agreement-${seed}`),
      ))
        corpus.push({ id: template.id, ...t });
  const lexicon = new NounLexicon();
  for (const { text } of corpus) lexicon.learn(text);
  assert.ok(lexicon.plurals.has("counters") && lexicon.plurals.has("marbles"));
  const issues = new Map<string, string>();
  for (const { id, where, text } of corpus)
    for (const issue of agreementIssues(text, lexicon)) {
      const key = `${id} (${where}): ${issue.rule}: “${issue.match}”`;
      if (!issues.has(key)) issues.set(key, text);
    }
  assert.deepEqual(
    [...issues].map(([key, text]) => `${key} — ${text}`),
    [],
  );
});

test("the agreement check finds each kind of error and passes correct text", () => {
  const lexicon = new NounLexicon();
  for (const text of [
    "There are 3 counters.",
    "She has 4 apples, 5 hours and 6 marbles.",
    "Each counter is red; 1 apple is left; one hour passes; a marble rolls.",
  ])
    lexicon.learn(text);
  const rules = (text: string) =>
    agreementIssues(text, lexicon).map((i) => i.rule);
  for (const [text, rule] of [
    [
      "There are 3 round counters and 1 square counters.",
      "plural noun after 1",
    ],
    ["Take 1 apples.", "plural noun after 1"],
    ["She waited one hours.", "plural noun after 1"],
    ["Pick 2 red apple.", "singular noun after a count other than 1"],
    ["1 of the marbles are blue.", "plural verb after “one of”"],
    ["There is 3 counters here.", "singular verb before a plural count"],
    ["Buy a 8-pound bag.", "“a” before a vowel sound"],
    ["It is an 5 cm side.", "“an” before a consonant sound"],
    ["Repeat it 1 times.", "plural noun after 1"],
  ] as const)
    assert.ok(rules(text).includes(rule), `${text} → ${rule}`);
  for (const text of [
    "There is 1 round counter and 3 square counters.",
    "1 of the marbles is blue.",
    "An 8-pound bag holds 2 red apples.",
    "Multiply 1 times 5.",
    "The input 1 appears twice.",
    "At least one works; each one keeps its value.",
    "A 4 by 4 rectangle and 12 apple trees.",
    "The values 6 and 4 differ.",
    "seven hundred one thousandths",
  ])
    assert.deepEqual(rules(text), [], text);
});

test("count, plural, nounFor and article build agreeing phrases", () => {
  assert.equal(count(1, "square counter"), "1 square counter");
  assert.equal(count(3, "square counter"), "3 square counters");
  assert.equal(count(0, "box"), "0 boxes");
  assert.equal(count(2, "story"), "2 stories");
  assert.equal(count(2, "foot"), "2 feet");
  assert.equal(count(2, "day"), "2 days");
  assert.equal(plural("blue marble"), "blue marbles");
  assert.equal(nounFor("$1$", "mile"), "mile");
  assert.equal(nounFor("\\frac{3}{2}", "mile"), "miles");
  for (const [n, a] of [
    [8, "an"],
    [11, "an"],
    [18, "an"],
    [80, "an"],
    [800, "an"],
    ["8,000", "an"],
    [11000, "an"],
    [1, "a"],
    [7, "a"],
    [12, "a"],
    [180, "a"],
    [1100, "a"],
  ] as const)
    assert.equal(article(n), a, String(n));
  assert.equal(
    articles("A 8-foot ladder and an 5 cm side"),
    "An 8-foot ladder and a 5 cm side",
  );
  assert.equal(articles("Solve $a 8$."), "Solve $a 8$.");
});
