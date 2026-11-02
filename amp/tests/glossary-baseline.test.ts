import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { templates } from "../src/math/engine";
import { lessons } from "../src/content/lessons";
import { lessonGlossaryContext } from "../src/content/problem-lessons";
import {
  siblingNoLinks,
  termsIn,
  type LinkContext,
} from "../src/glossary/link";
import { learnerTexts } from "./fixtures/math-typography";

/** Learner-visible teaching text: lessons, methods, principles, and the
 * hints and explanations of 20 instances of every template. Practice
 * prompts, choices and titles are not linked; a lesson's worked example is,
 * and `glossary-rendered.test.ts` checks its lexicon. */
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

// Report only. An ambiguous word with no named sense simply does not link,
// which is safe; the report shows where a sense or noLink would help.
test("unresolved ambiguous words report (artifacts/glossary/unresolved-report.json)", () => {
  const counts = sorted(unresolvedCounts());
  const forms = new Map<string, number>();
  for (const byForm of Object.values(counts))
    for (const [form, n] of Object.entries(byForm))
      forms.set(form, (forms.get(form) ?? 0) + n);
  const total = [...forms.values()].reduce((a, b) => a + b, 0);
  const topForms = [...forms.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20);
  const dir = new URL("../artifacts/glossary/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    new URL("unresolved-report.json", dir),
    JSON.stringify(
      { total, owners: Object.keys(counts).length, topForms, counts },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `${total} unresolved ambiguous words across ${Object.keys(counts).length} lessons and templates. Most often: ${topForms.map(([f, n]) => `${f} (${n})`).join(", ")}`,
  );
  assert.ok(total >= 0);
});

// Report only. A noLink form whose entry another form names in senses is
// muted; that is right only where the form is ordinary English there ("one
// third" is a fraction, "the third side" an ordinal). Review the list when
// adding senses or noLink.
test("sibling noLink report (artifacts/glossary/sibling-nolink-report.json)", () => {
  const rows: { context: string; form: string; id: string }[] = [];
  for (const lesson of lessons)
    for (const r of siblingNoLinks({
      senses: lesson.senses,
      noLink: lesson.noLink,
    }))
      rows.push({ context: `lesson:${lesson.id}`, ...r });
  for (const template of templates)
    for (const r of siblingNoLinks(
      lessonGlossaryContext(template.id, template),
    ))
      rows.push({ context: template.id, ...r });
  const dir = new URL("../artifacts/glossary/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    new URL("sibling-nolink-report.json", dir),
    JSON.stringify({ total: rows.length, rows }, null, 2) + "\n",
  );
  console.log(
    `${rows.length} noLink forms whose entry is named through another form`,
  );
  assert.ok(rows.length >= 0);
});
