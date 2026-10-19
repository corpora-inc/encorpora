/** Export authored real-number content to the independent Python reviewer; no certification here. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { realNumberLessons as lessons } from "../src/content/real-number-lessons";
import { realNumberWorksheet } from "../src/content/real-number-worksheets";
import {
  RealNumberIllustration,
  type RealNumberIllustrationKind,
} from "../src/content/RealNumberIllustration";
const worksheets = lessons.flatMap((lesson) =>
  lesson.templateIds.flatMap((templateId) =>
    Array.from({ length: 8 }, (_, i) => ({
      templateId,
      edition: String(i + 1),
      problems: realNumberWorksheet(templateId, lesson.id, String(i + 1)),
    })),
  ),
);
const kinds: RealNumberIllustrationKind[] = [
  "repeating-decimal-shift",
  "root-zoom",
  "root-solutions",
  "decimal-point-shift",
  "scientific-regroup",
];
const figures = kinds.map((kind) => ({
  kind,
  html: renderToStaticMarkup(
    React.createElement(RealNumberIllustration, { kind }),
  ),
}));
console.log(JSON.stringify({ lessons, worksheets, figures }));
