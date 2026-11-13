import assert from "node:assert/strict";
import test from "node:test";
import { article } from "../src/math/agreement";
import { generateProblem, templates } from "../src/math/engine";
import { problemTexts } from "./fixtures/count-agreement";
import { lessons } from "../src/content/lessons";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";

// Reviewed exceptions to a vowel-LETTER check. Each still has to agree with
// the sound helper, so this list cannot conceal a wrong article.
const exceptions: [RegExp, string][] = [
  [/^a (?:ones?\b|once\b)/i, "one starts with a w sound"],
  [
    /^a (?:uni(?:corn|cycle|direction|f|lateral|modal|on|que|sex|son|t|v)|use|usu|ut[ie]|ur[aeio]|eu|ewe|ubiq)/i,
    "unit, useful and European start with a y sound",
  ],
  [/^an (?:hour|honest|honou?r|heir)/i, "silent h"],
  [/^an nth\b/i, "nth starts with the letter name en"],
  [
    /^[Aa]n [FHLMNRSX](?:\b|[A-Z])/,
    "initialisms and letter names start with a vowel sound",
  ],
  [/^an [fhlmnrsx](?:-|$)/i, "a letter name before a compound suffix"],
  [/^[Aa] U(?:\b|[A-Z])/, "the letter U starts with a y sound"],
];

// In figure descriptions and comparisons A is often a label or a variable,
// followed by a verb/preposition ("Offer A adds", "Point A at"). These cannot
// start the noun phrase of an indefinite article. TeX formulas are excluded.
const labelContinuation =
  /^(?:and|or|is|are|as|at|in|of|on|itself|only|also|along|above|equals|over|under|always|alone|after|intersects|increases|ends|appears|adds|earns|into|opens|exactly|each|among)\b/i;

function issues(text: string): string[] {
  // Ignore formulas, but keep a single named letter and its prose suffix.
  const prose = text
    .replace(/\b1\/a\b/g, " ⟨math⟩ ")
    .replace(/\bpoint a intervals\b/g, "point ⟨math⟩ intervals")
    .replace(/\b([Aa]n? )\$([a-zA-Z])\$/g, "$1$2")
    .replace(/\$[^$]*\$/g, " ⟨math⟩ ");
  return [...prose.matchAll(/\b([Aa]n?) ([A-Za-z][A-Za-z'-]*|\d[\d,.-]*)/g)]
    .filter((m) => !labelContinuation.test(m[2]!))
    .filter((m) => {
      if (m[1]!.toLowerCase() !== article(m[2]!)) return true;
      // Require review of sound exceptions, even when the helper accepts them.
      return (
        /\b[Aa] [aeiou]|\b[Aa]n [bcdfgjklmnpqrstvwxz]/i.test(m[0]) &&
        !exceptions.some(([pattern]) => pattern.test(m[0]))
      );
    })
    .map((m) => m[0]);
}

test("every template uses sound-based articles throughout learner text", () => {
  const found = new Map<string, string>();
  // Same fixed 20-seed sampling budget as the typography sweep.
  for (const template of templates)
    for (let seed = 0; seed < 20; seed++)
      for (const { where, text } of problemTexts(
        generateProblem(template.id, `articles-${seed}`),
      ))
        for (const issue of issues(text))
          found.set(`${template.id} (${where}): ${issue}`, text);
  assert.deepEqual([...found], []);
});

test("the guard rejects bad articles and accepts reviewed sound exceptions", () => {
  for (const text of [
    "A equilateral triangle",
    "a hour",
    "an unit",
    "a 8",
    "a 11",
    "a 18",
    "an 1",
    "a x-intercept",
    "a n-gon",
    "a LCD",
    "an GCF",
  ])
    assert.equal(issues(text).length, 1, text);
  for (const text of [
    "An equilateral triangle",
    "an hour",
    "a unit",
    "a one",
    "a ones digit",
    "an nth root",
    "an 8",
    "an 11",
    "an 18",
    "a 1",
    "an x-intercept",
    "an n-gon",
    "an LCD",
    "An LCD",
    "An L-shaped face",
    "A USB connector",
    "a GCF",
    "an $x$-intercept",
    "Point $A$ is on the line",
    "Offer A adds 3",
    "a unique answer",
  ])
    assert.deepEqual(issues(text), [], text);
});

test("lessons and template methods use sound-based articles", () => {
  const found: string[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string")
      for (const issue of issues(value))
        found.push(`${path}: ${issue} — ${value}`);
    else if (Array.isArray(value))
      value.forEach((item, i) => walk(item, `${path}[${i}]`));
    else if (value && typeof value === "object")
      for (const [key, item] of Object.entries(value))
        walk(item, `${path}.${key}`);
  };
  walk(lessons, "lessons");
  walk(methods, "methods");
  walk(principles, "principles");
  assert.deepEqual(found, []);
});
