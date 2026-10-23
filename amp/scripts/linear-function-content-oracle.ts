/** Export authored Algebra 1 function content to the independent Python reviewer; no certification here. */
import { linearFunctionLessons as lessons } from "../src/content/linear-function-lessons";
import { linearFunctionWorksheet } from "../src/content/linear-function-worksheets";
import { distinctWorksheet } from "../src/content/distinct-worksheet";
import { sceneIllustrations } from "../src/content/scene-illustrations";
import { linearFunctionTemplates } from "../src/math/linear-function-practice";

const specialized = new Set(
  linearFunctionTemplates.map((template) => template.id),
);
function printedProblems(
  templateId: string,
  lessonId: string,
  edition: string,
) {
  if (specialized.has(templateId))
    return linearFunctionWorksheet(templateId, lessonId, edition);
  if (templateId === "linear-initial-value-meaning")
    return distinctWorksheet(templateId, lessonId, edition);
  throw new Error(`Unreviewed linear-function lesson template: ${templateId}`);
}

const worksheets = lessons.flatMap((lesson) =>
  lesson.templateIds.flatMap((templateId) =>
    Array.from({ length: 8 }, (_, i) => ({
      templateId,
      lessonId: lesson.id,
      edition: String(i + 1),
      problems: printedProblems(templateId, lesson.id, String(i + 1)),
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
