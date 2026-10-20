/** Export authored function-toolkit content to the independent Python reviewer; no certification here. */
import { functionToolkitLessons as lessons } from "../src/content/function-toolkit-lessons";
import { functionToolkitWorksheet } from "../src/content/function-toolkit-worksheets";
import { functionToolkitIllustrations } from "../src/content/function-toolkit-illustrations";

const worksheets = lessons.flatMap((lesson) =>
  lesson.templateIds.flatMap((templateId) =>
    Array.from({ length: 8 }, (_, i) => ({
      templateId,
      edition: String(i + 1),
      problems: functionToolkitWorksheet(templateId, lesson.id, String(i + 1)),
    })),
  ),
);
const figures = Object.entries(functionToolkitIllustrations).map(
  ([kind, scene]) => ({ kind, scene }),
);
console.log(JSON.stringify({ lessons, worksheets, figures }));
