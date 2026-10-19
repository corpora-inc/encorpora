/** Export authored pattern/function content to the independent Python reviewer; no certification here. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { patternFunctionLessons as lessons } from "../src/content/pattern-function-lessons";
import { patternFunctionWorksheet } from "../src/content/pattern-function-worksheets";
import {
  PatternFunctionIllustration,
  type PatternFunctionIllustrationKind,
} from "../src/content/PatternFunctionIllustration";
const worksheets = lessons.flatMap((lesson) =>
  Array.from({ length: 16 }, (_, i) => ({
    templateId: lesson.templateIds[0]!,
    edition: String(i + 1),
    problems: patternFunctionWorksheet(
      lesson.templateIds[0]!,
      lesson.id,
      String(i + 1),
    ),
  })),
);
const kinds: PatternFunctionIllustrationKind[] = [
  "pattern-rule-steps",
  "related-patterns-graph",
  "dependent-variable-graph",
  "compare-functions-graph",
  "linear-nonlinear-graph",
];
const figures = kinds.map((kind) => ({
  kind,
  html: renderToStaticMarkup(
    React.createElement(PatternFunctionIllustration, { kind }),
  ),
}));
console.log(JSON.stringify({ lessons, worksheets, figures }));
