/** Export authored counting/probability content to the independent Python reviewer; no certification here. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { combinatoricsLessons as lessons } from "../src/content/combinatorics-lessons";
import { combinatoricsWorksheet } from "../src/content/combinatorics-worksheets";
import {
  CombinatoricsIllustration,
  type CombinatoricsIllustrationKind,
} from "../src/content/CombinatoricsIllustration";
const worksheets = lessons.flatMap((lesson) =>
  Array.from({ length: 16 }, (_, i) => ({
    templateId: lesson.templateIds[0]!,
    edition: String(i + 1),
    problems: combinatoricsWorksheet(
      lesson.templateIds[0]!,
      lesson.id,
      String(i + 1),
    ),
  })),
);
const kinds: CombinatoricsIllustrationKind[] = [
  "counting-tree",
  "permutation-slots",
  "combination-orders",
  "independent-grid",
  "expected-spinner",
];
const figures = kinds.map((kind) => ({
  kind,
  html: renderToStaticMarkup(
    React.createElement(CombinatoricsIllustration, { kind }),
  ),
}));
console.log(JSON.stringify({ lessons, worksheets, figures }));
