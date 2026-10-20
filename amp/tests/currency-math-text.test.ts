import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, templates } from "../src/math/engine";
import { segments } from "../src/web/MathText";

// MathText reads `$…$` as TeX, so two currency amounts in one text
// ("costs $3 and $5") would typeset the prose between them as a formula.
// Generators write money in words or ¢ ("12 dollars"); this guards that no
// learner-facing text pairs a currency `$` into a math span.
function currencySpans(text: string) {
  if (!/\$\d/.test(text)) return [];
  return segments(text)
    .filter((s) => s.math && s.plain !== undefined)
    .map((s) => s.text)
    .filter(
      (tex) =>
        /^\s|\s$/.test(tex) ||
        // Prose has a lowercase word; a named point ($JKL$) is math.
        /(?:^|[^\\a-zA-Z{])[a-z][a-zA-Z]{2,}/.test(
          tex.replace(/\\text\{[^}]*\}/g, ""),
        ),
    );
}

test("the detector catches prose captured between two currency amounts", () => {
  assert.deepEqual(currencySpans("A pen costs $3 and a book costs $5."), [
    "3 and a book costs ",
  ]);
  assert.deepEqual(currencySpans("So $4 + 4 = 8$ vertices."), []);
});

test("no generated prompt, hint, choice or explanation pairs a currency $ into TeX", () => {
  const found: string[] = [];
  for (const template of templates)
    for (const seed of ["currency-0", "currency-1"]) {
      const problem = generateProblem(template.id, seed);
      const response = problem.public.response;
      const texts = [
        problem.public.prompt,
        problem.hint,
        ...problem.explanation,
        ...(response.kind === "choice"
          ? response.options.map((o) => o.label)
          : []),
      ];
      for (const text of texts)
        if (currencySpans(text).length) found.push(`${template.id}: ${text}`);
    }
  assert.deepEqual(found, []);
});
