import { test } from "node:test";
import assert from "node:assert/strict";
import { templates, generateProblem } from "../src/math/engine";

/** Generated text must read correctly for every count, including 1. */
const rules: [RegExp, string][] = [
  [
    /(?<![\d./−-])\b1 (?!is\b|has\b|plus\b|minus\b|times\b|and\b|more\b|less\b|of\b|or\b)[a-z]+s\b/,
    "plural noun after 1",
  ],
  [/\b[Tt]here (are|were) 1\b/, "plural verb before 1"],
  [/\([a-z]*s\)|[a-z]\(s\)/, "“(s)” plural placeholder"],
  [
    /(?:^|[=:] )(-?[\d/.]+) = \1(?=[.,;]?$|[.,;] |\s[a-z])/,
    "repeated equal value (x = x)",
  ],
  [/(?<![A-Za-z\d)])\(\d[\d/.]*\)/, "positive number in parentheses"],
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
