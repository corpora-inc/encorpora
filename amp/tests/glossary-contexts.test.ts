import { test } from "node:test";
import assert from "node:assert/strict";
import { templates } from "../src/math/engine";
import {
  historicalTemplates,
  templateReplacements,
} from "../src/math/historical-templates";
import { lessons } from "../src/content/lessons";
import { methods } from "../src/content/problem-methods";
import { lessonGlossaryContext } from "../src/content/problem-lessons";
import { glossary } from "../src/glossary/index";
import {
  contextConflicts,
  entryContext,
  linkTerms,
  type LinkContext,
} from "../src/glossary/link";

/** Every context the app links text with: each reference lesson, method and
 * template, each practice lesson's merged context (its method over its
 * template, as the server builds it for lessons, hints and explanations), and
 * each glossary definition. */
function contexts(): [string, LinkContext][] {
  const out: [string, LinkContext][] = [];
  for (const lesson of lessons)
    out.push([
      `lesson ${lesson.id}`,
      { senses: lesson.senses, noLink: lesson.noLink },
    ]);
  for (const [id, method] of Object.entries(methods))
    out.push([
      `method ${id}`,
      { senses: method.senses, noLink: method.noLink },
    ]);
  for (const template of [...templates, ...historicalTemplates]) {
    out.push([
      `template ${template.id}`,
      { senses: template.glossarySenses, noLink: template.glossaryNoLink },
    ]);
    const lessonId = templateReplacements[template.id] ?? template.id;
    out.push([
      `practice lesson ${template.id}`,
      lessonGlossaryContext(lessonId, template),
    ]);
  }
  for (const entry of glossary)
    out.push([`glossary ${entry.id}`, entryContext(entry)]);
  return out;
}

// A form under both senses and noLink loses its link: noLink wins in the
// linker, so the mathematical word is silently muted. Keep the sense for a
// mathematical use; keep noLink and drop the sense for an ordinary one.
test("no glossary context lists a form under both senses and noLink", () => {
  const all = contexts();
  assert.ok(all.length > 1000, `scanned ${all.length} contexts`);
  const conflicts = all
    .map(([name, context]) => [name, contextConflicts(context)] as const)
    .filter(([, forms]) => forms.length)
    .map(([name, forms]) => `${name}: ${forms.join(", ")}`);
  assert.deepEqual(conflicts, [], conflicts.join("\n"));
});

test("contextConflicts reads forms case- and apostrophe-insensitively", () => {
  assert.deepEqual(
    contextConflicts({
      senses: { side: "side", "one’s": "x" },
      noLink: ["Side", "one's"],
    }),
    ["side", "one’s"],
  );
  assert.deepEqual(
    contextConflicts({ senses: { side: "side" }, noLink: ["sides"] }),
    [],
  );
});

test("the linker warns once when a context names a form both ways", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const context = { senses: { whole: "whole" }, noLink: ["whole"] };
  linkTerms("the whole bar", context);
  linkTerms("the whole bar again", context);
  assert.equal(warn.mock.callCount(), 1);
  assert.match(String(warn.mock.calls[0]!.arguments[0]), /"whole"/);
});
