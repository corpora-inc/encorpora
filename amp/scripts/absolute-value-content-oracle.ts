/** Export authored data to the independent Python reviewer. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { absoluteValueLessons as lessons } from "../src/content/absolute-value-lessons";
import { absoluteValueWorksheet } from "../src/content/absolute-value-worksheets";
import { AbsoluteValueIllustration } from "../src/content/AbsoluteValueIllustration";
import {
  expressionToTex,
  segmentPrintText,
} from "../src/content/math-typesetting";
import { generateProblem } from "../src/math/engine";
const worksheets = lessons.flatMap((l) =>
  Array.from({ length: 16 }, (_, i) => {
    const problems = absoluteValueWorksheet(
      l.templateIds[0]!,
      l.id,
      String(i + 1),
    );
    return {
      templateId: l.templateIds[0],
      edition: i + 1,
      problems,
      replayMatches: problems.every(
        (p) =>
          JSON.stringify(p) ===
          JSON.stringify(generateProblem(p.public.templateId, p.public.seed)),
      ),
    };
  }),
);
const valid = [
  "|x|",
  "|−3|",
  "−2|3x − 1| + 4 = −6",
  "|1/2|",
  "2|x| + |y|",
  "|x|^2",
];
const invalid = ["|x", "x|", "||x||", "|x = 2|", "|x + |y||", "|word|"];
const prose = [
  "The bars |x| mean distance.",
  "Solve |−2x + 3| = 5/2.",
  "Keep (1,234) as a grouped number.",
];
console.log(
  JSON.stringify({
    lessons,
    worksheets,
    figures: [false, true].map((shifted) => ({
      shifted,
      html: renderToStaticMarkup(
        React.createElement(AbsoluteValueIllustration, { shifted }),
      ),
    })),
    notation: {
      valid: valid.map((source) => ({ source, tex: expressionToTex(source) })),
      invalid: invalid.map((source) => ({
        source,
        tex: expressionToTex(source),
      })),
      prose: prose.map((source) => ({
        source,
        segments: segmentPrintText(source),
      })),
    },
  }),
);
