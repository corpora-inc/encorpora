import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  lessonGlossaryContext,
  problemLesson,
  screenBand,
} from "../src/content/problem-lessons";
import { glossaryLexicon, type LinkContext } from "../src/glossary/link";
import { linksOnScreen } from "../src/glossary/resolve";
import type { GlossaryLexicon } from "../src/glossary/types";
import { generateProblem, templates } from "../src/math/engine";
import { templateReplacements } from "../src/math/historical-templates";
import { hintSupport, withGlossary } from "../src/server/app";
import type { Outcome } from "../src/server/repository";
import { lessonGlossaryBlocks, ProblemLesson } from "../src/web/ProblemLesson";

/** The client links a text only through its payload's lexicon, so every
 * glossary form in a text the screen renders inside a glossary block must be
 * a key there, linked or deliberately null, meaning exactly what the server's
 * linker reads there (`linkTerms`, with the screen's band rule). A form left
 * out is a glossary word that silently never opens its card. */
function missingForms(
  rendered: readonly string[],
  lexicon: GlossaryLexicon,
  context: LinkContext,
  templateId: string,
): string[] {
  const band = screenBand(templateId);
  const expected = glossaryLexicon(rendered, context);
  return Object.entries(expected)
    .filter(([form, id]) => {
      const want = id && linksOnScreen(id, band) ? id : null;
      return !(form in lexicon) || lexicon[form] !== want;
    })
    .map(([form, id]) => `${form} → ${id} (sent ${lexicon[form]})`);
}

test("a lesson's lexicon names every glossary form in every text it links", () => {
  const gaps: string[] = [];
  let texts = 0;
  for (const template of templates) {
    const lesson = problemLesson(template.id, "glossary-rendered");
    const rendered = Object.values(lessonGlossaryBlocks(lesson)).flat();
    texts += rendered.length;
    const context = lessonGlossaryContext(
      templateReplacements[template.id] ?? template.id,
      template,
    );
    const missing = missingForms(
      rendered,
      lesson.glossaryLexicon,
      context,
      template.id,
    );
    if (missing.length) gaps.push(`${template.id}: ${missing.join(", ")}`);
  }
  assert.ok(texts > templates.length * 5, `${texts} texts checked`);
  assert.deepEqual(gaps, []);
});

test("hints and answer explanations carry a lexicon for every form they show", () => {
  const gaps: string[] = [];
  for (const template of templates)
    for (const seed of ["glossary-a", "glossary-b", "glossary-c"]) {
      const problem = generateProblem(template.id, seed);
      const context = lessonGlossaryContext(template.id);
      const hint = hintSupport(problem);
      // The hint panel links exactly the hint (PracticeWorkspace).
      for (const form of missingForms(
        [hint.hint],
        hint.glossaryLexicon ?? {},
        context,
        template.id,
      ))
        gaps.push(`${template.id} hint: ${form}`);
      // Feedback links the explanation, which leads with the chosen
      // option's feedback on a wrong choice.
      const explanation = [
        ...Object.values(problem.choiceFeedback ?? {}),
        ...problem.explanation,
      ];
      const outcome = withGlossary({
        id: "attempt",
        problemId: problem.public.id,
        requestId: "request",
        skillId: problem.public.skillId,
        templateId: template.id,
        response: "",
        correct: false,
        assisted: false,
        explanation,
        answer: problem.answer,
        createdAt: new Date(0).toISOString(),
      } satisfies Outcome);
      for (const form of missingForms(
        explanation,
        outcome.glossaryLexicon ?? {},
        context,
        template.id,
      ))
        gaps.push(`${template.id} explanation: ${form}`);
    }
  assert.deepEqual(gaps, []);
});

test("a glossary word in a lesson's worked question opens its card", () => {
  const lesson = problemLesson("signed-fraction-sum", "glossary-rendered");
  assert.match(lesson.example.prompt, /\binteger\b/);
  assert.equal(lesson.glossaryLexicon.integer, "integer");
  const { video: _video, ...view } = lesson;
  const { figure: _figure, givens: _givens, ...example } = view.example;
  const html = renderToStaticMarkup(
    createElement(ProblemLesson, { lesson: { ...view, example } }),
  );
  const prompt = /<p class="lesson-example-prompt">(.*?)<\/p>/s.exec(html)?.[1];
  assert.ok(prompt, "the example prompt renders");
  assert.match(prompt, /data-term-id="integer"/);
});
