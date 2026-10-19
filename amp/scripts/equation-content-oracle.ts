/** Export authored equation and inequality content to the independent Python reviewer; no certification here. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { equationLessons as lessons } from "../src/content/equation-lessons";
import { equationWorksheet } from "../src/content/equation-worksheets";
import {
  EquationIllustration,
  type EquationIllustrationKind,
} from "../src/content/EquationIllustration";
const worksheets = lessons.flatMap((lesson) =>
  Array.from({ length: 16 }, (_, i) => ({
    templateId: lesson.templateIds[0]!,
    edition: String(i + 1),
    problems: equationWorksheet(
      lesson.templateIds[0]!,
      lesson.id,
      String(i + 1),
    ),
  })),
);
const kinds: EquationIllustrationKind[] = [
  "balance-remove",
  "balance-split",
  "balance-bags",
  "undo-chain",
  "equation-tape",
  "two-step-tape",
  "inequality-many-solutions",
];
const figures = kinds.map((kind) => ({
  kind,
  html: renderToStaticMarkup(
    React.createElement(EquationIllustration, { kind }),
  ),
}));
console.log(JSON.stringify({ lessons, worksheets, figures }));
