/** Export actual public/rendered evidence; Python independently derives the math. */
import { once } from "node:events";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { percentChangeWorksheet } from "../src/content/percent-change-worksheets";
import { lessons } from "../src/content/lessons";
import { publicationHtml } from "../src/content/publications";
import { buildCoverageManifest } from "../src/content/coverage";
import { PrintMathText } from "../src/content/PrintMathText";
import {
  generateProblem,
  templates,
  normalizeAnswer,
  gradeAnswer,
} from "../src/math/engine";
import { skills } from "../src/curriculum/catalog";

const ids = [
  "percent-change-rate",
  "percent-change-final",
  "percent-change-original",
];
async function emit(value: unknown) {
  if (!process.stdout.write(`${JSON.stringify(value)}\n`))
    await once(process.stdout, "drain");
}
async function main() {
  const skill = skills.find((value) => value.id === "percent-change")!;
  const coverage = buildCoverageManifest();
  const override = buildCoverageManifest({ facetMappings: [] });
  const binding = (manifest: ReturnType<typeof buildCoverageManifest>) =>
    manifest.skills.find((value) => value.id === "percent-change");
  const exactProbe = generateProblem(
    "percent-change-rate",
    "independent-input-probe",
  );
  // The answer under test is a handwritten exact value, not a generator key.
  const probe = { ...exactProbe, answer: "100/3" };
  const inputs = ["100/3", "200/6", "33.3333", "0.333333", "100/3%", "1/0"];
  const notation = [
    "A quantity increases by 100/3 percent to 4 units.",
    "A quantity decreases by 200/3 percent to 1 units.",
    "A price of $3 increases by 100/3 percent to $4.",
    "(100/3)% = 1/3.",
    "The share increases from 20% to 25%.",
  ];
  await emit({
    kind: "percent-content-manifest",
    runtimeSeeds: 1024,
    editions: 16,
    templates: templates.filter((value) => ids.includes(value.id)),
    skill,
    coverageValid: coverage.valid,
    defaultCoverage: binding(coverage),
    overrideCoverage: binding(override),
    normalized: ["12.5", "25/2", ".125", "0.125", "12.5%", "1/0"].map(
      (input) => ({ input, actual: normalizeAnswer(input) }),
    ),
    protocol: inputs.map((input) => ({
      input,
      accepted: gradeAnswer(probe, input),
    })),
    notation: notation.map((source) => ({
      source,
      html: renderToStaticMarkup(
        React.createElement(PrintMathText, { text: source }),
      ),
    })),
  });
  for (const templateId of ids) {
    const matching = lessons.filter((lesson) =>
      lesson.templateIds.includes(templateId),
    );
    if (matching.length !== 1)
      throw new Error(`Expected one standalone percent lesson: ${templateId}`);
    const lesson = matching[0]!;
    await emit({
      kind: "percent-lesson",
      templateId,
      lesson,
      html: publicationHtml(lesson, "lesson", "1"),
    });
    for (let index = 0; index < 1024; index++) {
      const seed = `percent-review-${index}`;
      await emit({
        kind: "percent-runtime",
        templateId,
        index,
        problem: generateProblem(templateId, seed),
        replayed: generateProblem(templateId, seed),
      });
    }
    for (let index = 1; index <= 16; index++) {
      const edition = String(index);
      const problems = percentChangeWorksheet(templateId, lesson.id, edition);
      await emit({
        kind: "percent-worksheet",
        templateId,
        edition,
        lessonId: lesson.id,
        problems,
        replayed: problems.map((problem) =>
          generateProblem(templateId, problem.public.seed),
        ),
        workbookHtml: publicationHtml(lesson, "workbook", edition),
        solutionsHtml: publicationHtml(lesson, "solutions", edition),
      });
    }
  }
}
main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
