/** Export authored Algebra 1 function content to the independent Python reviewer; no certification here. */
import { linearFunctionLessons as lessons } from "../src/content/linear-function-lessons";
import { linearFunctionWorksheet } from "../src/content/linear-function-worksheets";
import { sceneIllustrations } from "../src/content/scene-illustrations";

const worksheets = lessons.flatMap((lesson) =>
  lesson.templateIds.flatMap((templateId) =>
    Array.from({ length: 8 }, (_, i) => ({
      templateId,
      edition: String(i + 1),
      problems: linearFunctionWorksheet(templateId, lesson.id, String(i + 1)),
    })),
  ),
);
const kinds = [
  "domain-range-axes",
  "relation-repeated-input",
  "average-rate-secant",
  "linear-model-graph",
  "formula-isolate-steps",
  "solution-set-line",
] as const;
const figures = kinds.map((kind) => ({
  kind,
  scene: sceneIllustrations[kind],
}));
console.log(JSON.stringify({ lessons, worksheets, figures }));
