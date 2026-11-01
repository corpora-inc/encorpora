import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { templates } from "../src/math/engine";
import { lessons } from "../src/content/lessons";
import { lessonGlossaryContext } from "../src/content/problem-lessons";
import { termsIn, type LinkContext } from "../src/glossary/link";
import { learnerTexts } from "./fixtures/math-typography";

const BASELINE = new URL(
  "./fixtures/glossary-unresolved-baseline.json",
  import.meta.url,
);

/** Learner-visible teaching text: lessons, methods, principles, and the
 * hints and explanations of 20 instances of every template. Prompts, choices
 * and titles are not linked. */
const LINKED = new Set([
  "hint",
  "explanation",
  "method goal",
  "method intuition",
  "method step",
  "method watch",
  "principle",
  "summary",
  "objective",
  "paragraph",
  "worked example",
  "worked step",
  "worked answer",
  "pitfall",
  "parent guide",
]);

type Counts = Record<string, Record<string, number>>;
function unresolvedCounts(): Counts {
  const contexts = new Map<string, LinkContext>();
  for (const lesson of lessons)
    contexts.set(`lesson:${lesson.id}`, {
      senses: lesson.senses,
      noLink: lesson.noLink,
    });
  for (const template of templates)
    contexts.set(template.id, lessonGlossaryContext(template.id, template));
  const counts: Counts = {};
  const seen = new Set<string>();
  for (const { owner, where, text } of learnerTexts()) {
    if (!LINKED.has(where)) continue;
    const key = `${owner}\n${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    termsIn(text, contexts.get(owner) ?? {}, ({ form }) => {
      const forOwner = (counts[owner] ??= {});
      forOwner[form] = (forOwner[form] ?? 0) + 1;
    });
  }
  return counts;
}
const sorted = (counts: Counts): Counts =>
  Object.fromEntries(
    Object.keys(counts)
      .sort()
      .map((owner) => [
        owner,
        Object.fromEntries(
          Object.keys(counts[owner]!)
            .sort()
            .map((form) => [form, counts[owner]![form]!]),
        ),
      ]),
  );

test("every learner-visible ambiguous word resolves, or is in the shrinking baseline", () => {
  const current = sorted(unresolvedCounts());
  const baseline: Counts = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, "utf8"))
    : {};
  const grown: string[] = [];
  const stale: string[] = [];
  for (const [owner, forms] of Object.entries(current))
    for (const [form, n] of Object.entries(forms))
      if (n > (baseline[owner]?.[form] ?? 0))
        grown.push(
          `${owner}: "${form}" ×${n} (baseline ${baseline[owner]?.[form] ?? 0}); name its sense in senses/glossarySenses or add it to noLink`,
        );
  for (const [owner, forms] of Object.entries(baseline))
    for (const [form, n] of Object.entries(forms))
      if ((current[owner]?.[form] ?? 0) < n)
        stale.push(
          `${owner}: "${form}" ×${current[owner]?.[form] ?? 0} < ${n}`,
        );
  if (process.env.GLOSSARY_BASELINE === "write") {
    // Only ever shrinks: a new unresolved word must be fixed, not recorded.
    assert.ok(
      grown.length === 0 || !existsSync(BASELINE),
      `Refusing to grow the baseline:\n${grown.join("\n")}`,
    );
    writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
    return;
  }
  assert.deepEqual(grown, [], "New unresolved ambiguous words");
  assert.deepEqual(
    stale,
    [],
    "Resolved words are still in the baseline: run GLOSSARY_BASELINE=write node --import tsx --test tests/glossary-baseline.test.ts to shrink it",
  );
});
