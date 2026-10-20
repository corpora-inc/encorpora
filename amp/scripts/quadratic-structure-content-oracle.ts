/** Export authored quadratic-structure content to the independent Python reviewer; no certification here. */
import { quadraticStructureLessons as lessons } from "../src/content/quadratic-structure-lessons";
import { quadraticStructureWorksheet } from "../src/content/quadratic-structure-worksheets";
import { quadraticStructureIllustrations } from "../src/content/quadratic-structure-illustrations";

const worksheets = lessons.flatMap((lesson) =>
  lesson.templateIds.flatMap((templateId) =>
    Array.from({ length: 8 }, (_, i) => ({
      templateId,
      edition: String(i + 1),
      problems: quadraticStructureWorksheet(
        templateId,
        lesson.id,
        String(i + 1),
      ),
    })),
  ),
);
const figures = Object.entries(quadraticStructureIllustrations).map(
  ([kind, scene]) => ({ kind, scene }),
);
console.log(JSON.stringify({ lessons, worksheets, figures }));
