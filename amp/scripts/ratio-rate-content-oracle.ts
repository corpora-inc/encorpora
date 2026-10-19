/** Export authored ratio and rate content to the independent Python reviewer; no certification here. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ratioRateLessons as lessons } from "../src/content/ratio-rate-lessons";
import { ratioRateWorksheet } from "../src/content/ratio-rate-worksheets";
import {
  RatioRateIllustration,
  type RatioRateIllustrationKind,
} from "../src/content/RatioRateIllustration";
import { RatioRateFigure } from "../src/web/RatioRateFigure";
import { generateProblem } from "../src/math/engine";
import type { RatioRateFigure as FigureData } from "../src/math/ratio-rate-models";

const worksheets = lessons.flatMap((lesson) =>
  Array.from({ length: 16 }, (_, i) => ({
    templateId: lesson.templateIds[0]!,
    edition: String(i + 1),
    problems: ratioRateWorksheet(
      lesson.templateIds[0]!,
      lesson.id,
      String(i + 1),
    ),
  })),
);
const kinds: RatioRateIllustrationKind[] = [
  "rate-double-line",
  "unit-price-tapes",
  "ratio-table-scaling",
  "rate-through-one",
  "fraction-rate-copies",
  "story-tapes",
];
const figures = kinds.map((kind) => ({
  kind,
  html: renderToStaticMarkup(
    React.createElement(RatioRateIllustration, { kind }),
  ),
}));
// Rendered practice figures, so the reviewer can re-measure tick alignment.
const rendered = [
  "ratio-table-missing",
  "double-number-line-missing",
  "fraction-unit-rate",
].flatMap((templateId) =>
  Array.from({ length: 24 }, (_, i) => {
    const figure = generateProblem(templateId, `render-${i}`).public
      .figure as FigureData;
    return {
      templateId,
      figure,
      html: renderToStaticMarkup(
        React.createElement(RatioRateFigure, { figure }),
      ),
    };
  }),
);
console.log(JSON.stringify({ lessons, worksheets, figures, rendered }));
