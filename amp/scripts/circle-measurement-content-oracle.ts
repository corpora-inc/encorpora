/** Export values under test; the Python oracle independently recomputes them. */
import { once } from "node:events";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CircleMeasurementIllustration,
  type CircleIllustrationKind,
} from "../src/content/CircleMeasurementIllustration";
import { circleMeasurementWorksheet } from "../src/content/circle-measurement-worksheets";
import { actualFacetMappings } from "../src/content/facet-mappings";
import { buildCoverageManifest } from "../src/content/coverage";
import { lessons } from "../src/content/lessons";
import { publicationHtml } from "../src/content/publications";
import {
  generateProblem,
  templates,
  normalizeAnswer,
} from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";

const ids = [
  "circle-circumference-coefficient",
  "circle-area-coefficient",
  "arc-length-coefficient",
  "sector-area-coefficient",
];
async function emit(value: unknown) {
  if (!process.stdout.write(`${JSON.stringify(value)}\n`))
    await once(process.stdout, "drain");
}
async function main() {
  const manifest = buildCoverageManifest();
  await emit({
    kind: "circle-measurement-manifest",
    seeds: 1024,
    editions: 16,
    illustrations: (
      [
        "circle-circumference",
        "circle-area",
        "circle-arc",
        "circle-sector",
      ] as CircleIllustrationKind[]
    ).map((kind) => ({
      kind,
      html: renderToStaticMarkup(
        React.createElement(CircleMeasurementIllustration, { kind }),
      ),
    })),
    templates: templates.filter((t) => ids.includes(t.id)),
    skills: skills.filter((s) =>
      ["circle-measurement", "arc-sector-measure"].includes(s.id),
    ),
    mappings: actualFacetMappings.filter((m) => ids.includes(m.templateId)),
    coverageValid: manifest.valid,
    bindings: manifest.skills.flatMap((s) =>
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
    equivalentInputs: [
      "0.125",
      "1/8",
      "2/16",
      "12.25",
      "49/4",
      "98/8",
      "−3",
      "-3",
    ].map((input) => ({
      input,
      normalized: normalizeAnswer(input),
    })),
  });
  for (const templateId of ids) {
    for (let i = 0; i < 1024; i++) {
      const seed = `circle-measurement-review-${i}`;
      await emit({
        kind: "circle-measurement-runtime",
        templateId,
        index: i,
        problem: generateProblem(templateId, seed),
        replayed: generateProblem(templateId, seed),
      });
    }
    const matching = lessons.filter((l) => l.templateIds.includes(templateId));
    if (matching.length !== 1)
      throw new Error(
        `Expected one circle-measurement lesson for ${templateId}`,
      );
    const lesson = matching[0]!;
    await emit({
      kind: "circle-measurement-lesson",
      templateId,
      lesson,
      html: publicationHtml(lesson, "lesson"),
    });
    for (let i = 1; i <= 16; i++) {
      const edition = String(i),
        problems = circleMeasurementWorksheet(templateId, lesson.id, edition);
      await emit({
        kind: "circle-measurement-worksheet",
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
