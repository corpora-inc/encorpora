/** Export authored coordinate-geometry content to the independent Python reviewer; no certification here. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { transformationLessons as lessons } from "../src/content/transformation-lessons";
import { transformationWorksheet } from "../src/content/transformation-worksheets";
import {
  TransformationIllustration,
  type TransformationIllustrationKind,
} from "../src/content/TransformationIllustration";
const worksheets = lessons.flatMap((lesson) =>
  lesson.templateIds.flatMap((templateId) =>
    Array.from({ length: 6 }, (_, i) => ({
      templateId,
      edition: String(i + 1),
      problems: transformationWorksheet(templateId, lesson.id, String(i + 1)),
    })),
  ),
);
const kinds: TransformationIllustrationKind[] = [
  "coordinate-side-lengths",
  "distance-triangle",
  "rigid-motions-panels",
  "dilation-rays",
  "similar-triangles-marked",
  "scale-drawing-plan",
];
const figures = kinds.map((kind) => ({
  kind,
  html: renderToStaticMarkup(
    React.createElement(TransformationIllustration, { kind }),
  ),
}));
console.log(JSON.stringify({ lessons, worksheets, figures }));
