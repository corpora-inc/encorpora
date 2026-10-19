/** Export actual registered content; independent Python derives the answers. */
import { once } from "node:events";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generateProblem, templates } from "../src/math/engine";
import { calculatorAllowed } from "../src/math/calculator";
import { skills } from "../src/curriculum/catalog";
import { lessons } from "../src/content/lessons";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import { LessonIllustration } from "../src/content/LessonIllustration";
import { publicationHtml } from "../src/content/publications";
import { rationalWorksheet } from "../src/content/rational-worksheets";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { buildCoverageManifest } from "../src/content/coverage";

const ids = [
  "signed-fraction-sum",
  "signed-fraction-product",
  "complex-fraction",
  "rational-power",
];
const grades: Record<string, number> = {
  "7": 7,
  "8": 8,
  "algebra-1": 9,
  geometry: 10,
  "algebra-2": 11,
};
async function emit(value: unknown) {
  if (!process.stdout.write(`${JSON.stringify(value)}\n`))
    await once(process.stdout, "drain");
}
async function main() {
  const coverage = buildCoverageManifest();
  await emit({
    kind: "rational-manifest",
    seeds: 1024,
    editions: 16,
    templates: templates.filter((t) => ids.includes(t.id)),
    skills: skills.filter((s) =>
      templates.some((t) => ids.includes(t.id) && t.skillId === s.id),
    ),
    calculator: ids.map((id) => {
      const skill = skills.find(
        (s) => s.id === templates.find((t) => t.id === id)?.skillId,
      )!;
      return {
        id,
        allowed: calculatorAllowed(
          { id },
          skill.strand,
          grades[skill.gradeBand]!,
        ),
      };
    }),
    mappings: actualFacetMappings.filter((m) => ids.includes(m.templateId)),
    coverageValid: coverage.valid,
    bindings: coverage.skills.flatMap((s) =>
      s.facets.flatMap((f) =>
        f.templateIds
          .filter((id) => ids.includes(id))
          .map((templateId) => ({
            templateId,
            skillId: s.id,
            facetId: f.id,
            independentlyReviewed: f.independentlyReviewed,
          })),
      ),
    ),
    methods: Object.fromEntries(ids.map((id) => [id, methods[id]])),
    principles: Object.fromEntries(ids.map((id) => [id, principles[id]])),
  });
  for (const templateId of ids) {
    for (let index = 0; index < 1024; index++) {
      const seed = `rational-review-${index}`;
      await emit({
        kind: "rational-runtime",
        templateId,
        index,
        problem: generateProblem(templateId, seed),
        replayed: generateProblem(templateId, seed),
      });
    }
    const matching = lessons.filter((l) => l.templateIds.includes(templateId));
    if (matching.length !== 1)
      throw new Error(`Expected one standalone lesson for ${templateId}`);
    const lesson = matching[0]!;
    const figures = lesson.sections.flatMap((section) =>
      section.illustration
        ? [
            {
              kind: section.illustration,
              svg: renderToStaticMarkup(
                React.createElement(LessonIllustration, {
                  kind: section.illustration,
                }),
              ),
            },
          ]
        : [],
    );
    await emit({
      kind: "rational-lesson",
      templateId,
      lesson,
      figures,
      html: publicationHtml(lesson, "lesson"),
    });
    for (let index = 1; index <= 16; index++) {
      const edition = String(index);
      const problems = rationalWorksheet(templateId, lesson.id, edition);
      await emit({
        kind: "rational-worksheet",
        templateId,
        edition,
        lessonId: lesson.id,
        problems,
        replayed: problems.map((p) =>
          generateProblem(templateId, p.public.seed),
        ),
        workbookHtml: publicationHtml(lesson, "workbook", edition),
        solutionsHtml: publicationHtml(lesson, "solutions", edition),
      });
    }
  }
}
main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
