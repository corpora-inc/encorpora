/** Public cases and actual SVG output for an independent reviewer; no assertions here. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RightTriangleOrientation,
  PythagoreanRearrangement,
} from "../src/content/RightTriangleIllustration.js";
import { generateProblem } from "../src/math/engine.js";
import { lessons } from "../src/content/lessons.js";
import { publicationHtml } from "../src/content/publications.js";
import { buildCoverageManifest } from "../src/content/coverage.js";

const args = process.argv.slice(2);
const count = args.length === 0 ? 0 : Number(args[1]);
if (
  args.length !== 0 &&
  (args.length !== 2 ||
    args[0] !== "--cases" ||
    !Number.isSafeInteger(count) ||
    count < 256)
)
  throw new Error(
    "Usage: export-right-triangle-review.ts [--cases COUNT>=256]",
  );
const templates = ["right-triangle-missing-leg", "pythagorean-converse"];
const selectedLessons = lessons.filter((lesson) =>
  ["pythagorean-theorem", ...templates].includes(lesson.id),
);
const fixtureMapping = {
  templateId: "right-triangle",
  facetId: "pythagorean-theorem.integer-hypotenuse",
  extent: "complete" as const,
  rationale: "Independent mapping input fixture.",
};
const coverageResults = {
  defaults: buildCoverageManifest(),
  explicitEmpty: buildCoverageManifest({ facetMappings: [] }),
  duplicateInput: buildCoverageManifest({
    facetMappings: [fixtureMapping, fixtureMapping],
  }),
  customEmpty: buildCoverageManifest({
    templates: [],
    skills: [],
    standards: [],
    lessons: [],
    books: [],
    bookBindings: [],
  }),
};
process.stdout.write(
  JSON.stringify({
    format: 1,
    coverage: Object.fromEntries(
      Object.entries(coverageResults).map(([key, value]) => [
        key,
        {
          valid: value.valid,
          errors: value.errors,
          skills: value.skills.filter(
            (skill) => skill.id === "pythagorean-theorem",
          ),
        },
      ]),
    ),
    lessons: selectedLessons,
    publications: selectedLessons.flatMap((lesson) =>
      (["workbook", "solutions"] as const).map((kind) => ({
        lessonId: lesson.id,
        kind,
        // Keep actual rendered content, omitting only the large embedded font stylesheet.
        html: publicationHtml(lesson, kind).match(
          /<article>[\s\S]*<\/article>/,
        )![0],
      })),
    ),
    illustrations: {
      orientation: renderToStaticMarkup(
        createElement(RightTriangleOrientation),
      ),
      rearrangement: renderToStaticMarkup(
        createElement(PythagoreanRearrangement),
      ),
    },
    seedCount: count,
    cases: templates.flatMap((id) =>
      Array.from({ length: count }, (_, index) =>
        generateProblem(id, `right-triangle-independent-${index}`),
      ),
    ),
  }) + "\n",
);
