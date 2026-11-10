import { test } from "node:test";
import assert from "node:assert/strict";
import { segments } from "../src/content/math-segments";
import { generateProblem, templates } from "../src/math/engine";
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
  glossaryLexicon,
  siblingNoLinks,
  entryContext,
  linkTerms,
  type LinkContext,
} from "../src/glossary/link";
import { idiomInsteadOfTerm } from "../src/glossary/senses";
import { linkProse } from "../src/glossary/scan";

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

const links = (text: string, id: string, context?: LinkContext) =>
  linkTerms(text, context).some(
    (span) => span.kind === "term" && span.id === id,
  );

test("line up and points at are verbs, not the geometry terms", () => {
  assert.equal(
    links(
      "Line the numbers up by place, so ones add to ones and tens to tens.",
      "line",
    ),
    false,
  );
  assert.equal(
    links(
      "Line the numbers up by place and subtract one place at a time.",
      "line",
    ),
    false,
  );
  assert.equal(links("The long minute hand points at 4.", "point"), false);
  assert.equal(
    links("When the minute hand points to 6, it is half past.", "point"),
    false,
  );
  assert.equal(links("The short hand points at 3.", "point"), false);
  assert.equal(
    links("Marks that line up show pairs in the same ratio.", "line"),
    false,
  );
  assert.equal(links("Do not line the digits up on the left.", "line"), false);
  assert.equal(
    links("Write each number on a card and line them up in order.", "line"),
    false,
  );
  // A named sense cannot turn the verb back into the term.
  assert.equal(
    links("Line the numbers up by place.", "line", {
      senses: { line: "line" },
    }),
    false,
  );
  assert.equal(
    links("The hand points at 4.", "point", { senses: { points: "point" } }),
    false,
  );

  assert.equal(
    links("The point at the top of a cone is the apex.", "point"),
    true,
  );
  assert.equal(links("Plot the two points at the same height.", "point"), true);
  assert.equal(
    links(
      "A circle is all the points at one distance from the center.",
      "point",
    ),
    true,
  );
  assert.equal(
    links("A ray can hold two different points at the same distance.", "point"),
    true,
  );
  assert.equal(
    links(
      "The dependent quantity goes on the vertical axis, the line up the side.",
      "line",
    ),
    true,
  );
  assert.equal(
    links("Slide a horizontal line up and down the graph.", "horizontal-line"),
    true,
  );
  assert.equal(
    links("Draw a straight line through both points.", "line"),
    true,
  );
  assert.equal(
    links("Draw a straight line through both points.", "point"),
    true,
  );

  const mixed = [
    "Line the numbers up by place.",
    "Draw a straight line through both points.",
  ];
  const lexicon = glossaryLexicon(mixed);
  assert.equal(lexicon.line, "line");
  assert.equal(lexicon.points, "point");
  assert.deepEqual(
    linkProse(mixed[0]!, lexicon).flatMap((piece) =>
      piece.id ? [piece.id] : [],
    ),
    [],
  );
  assert.deepEqual(
    linkProse(mixed[1]!, lexicon)
      .flatMap((piece) => (piece.id ? [piece.id] : []))
      .sort(),
    ["line", "point"],
  );
});

/** Term spans the linker opened even though the idiom rule calls them verbs. */
const FORM = (form: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}'-])${form}(?![\\p{L}\\p{N}'-])`, "giu");

/** A linked line/point whose occurrence the idiom rule calls a verb. */
function linkedIdioms(text: string, context: LinkContext): string[] {
  const bad: string[] = [];
  for (const segment of segments(text)) {
    if (segment.math) continue;
    const prose = segment.text;
    const linked = linkTerms(prose, context).filter(
      (span) =>
        span.kind === "term" && (span.id === "line" || span.id === "point"),
    );
    for (const form of ["line", "lines", "point", "points"]) {
      const at = [...prose.matchAll(FORM(form))].map((match) => match.index);
      if (!at.length) continue;
      const nouns = at.filter(
        (index) => !idiomInsteadOfTerm(prose, index, index + form.length, form),
      ).length;
      const opened = linked.filter(
        (span) => span.text.toLowerCase() === form,
      ).length;
      if (opened > nouns)
        bad.push(
          `"${form}" linked ${opened} time(s), ${nouns} noun use(s), in ${prose.slice(0, 90)}`,
        );
    }
  }
  return bad;
}

test("every explanation leaves line-up and points-at unlinked", () => {
  const bad: string[] = [];
  for (const template of templates) {
    const problem = generateProblem(template.id, "idiom-link");
    const context = lessonGlossaryContext(template.id);
    const texts = [
      ...problem.explanation,
      ...Object.values(problem.choiceFeedback ?? {}),
    ];
    for (const text of texts)
      for (const hit of linkedIdioms(text, context))
        bad.push(`${template.id}: ${hit}`);
  }
  assert.deepEqual(bad, []);
});

test("siblingNoLinks finds a muted form of a named entry", () => {
  assert.deepEqual(
    siblingNoLinks({ senses: { side: "side" }, noLink: ["sides", "whole"] }),
    [{ form: "sides", id: "side" }],
  );
  assert.deepEqual(
    siblingNoLinks({ senses: { side: "side" }, noLink: ["side"] }),
    [],
  );
});
