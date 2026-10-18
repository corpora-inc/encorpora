/** Public cases and actual SVG output for an independent reviewer; no assertions here. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RightTriangleOrientation,
  PythagoreanRearrangement,
} from "../src/content/RightTriangleIllustration.js";
import { generateProblem } from "../src/math/engine.js";
import { lessons } from "../src/content/lessons.js";

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
process.stdout.write(
  JSON.stringify({
    format: 1,
    lessons: lessons.filter((lesson) =>
      ["pythagorean-theorem", ...templates].includes(lesson.id),
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
