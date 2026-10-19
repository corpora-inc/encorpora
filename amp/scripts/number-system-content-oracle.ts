/** Export authored number-system content to the independent Python reviewer; no certification here. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { numberSystemLessons as lessons } from "../src/content/number-system-lessons";
import { numberSystemWorksheet } from "../src/content/number-system-worksheets";
import {
  NumberSystemIllustration,
  numberSystemIllustrationKinds,
} from "../src/content/NumberSystemIllustration";
const worksheets = lessons.flatMap((lesson) =>
  lesson.templateIds.flatMap((templateId) =>
    Array.from({ length: 16 }, (_, i) => ({
      templateId,
      lessonId: lesson.id,
      edition: String(i + 1),
      problems: numberSystemWorksheet(templateId, lesson.id, String(i + 1)),
    })),
  ),
);
const figures = numberSystemIllustrationKinds.map((kind) => ({
  kind,
  html: renderToStaticMarkup(
    React.createElement(NumberSystemIllustration, { kind }),
  ),
}));
console.log(JSON.stringify({ lessons, worksheets, figures }));
