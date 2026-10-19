/** Export authored Algebra 1 two-variable content to the independent Python reviewer; no certification here. */
import { twoVariableLessons as lessons } from "../src/content/two-variable-lessons";
import { twoVariableWorksheet } from "../src/content/two-variable-worksheets";
import { sceneIllustrations } from "../src/content/scene-illustrations";

const worksheets = lessons.flatMap((lesson) =>
  lesson.templateIds.flatMap((templateId) =>
    Array.from({ length: 8 }, (_, i) => ({
      templateId,
      edition: String(i + 1),
      problems: twoVariableWorksheet(templateId, lesson.id, String(i + 1)),
    })),
  ),
);
const kinds = [
  "feasible-bakery",
  "half-plane-test-point",
  "equation-step-reasons",
  "elimination-stacked",
  "elimination-lines",
] as const;
const figures = kinds.map((kind) => ({
  kind,
  scene: sceneIllustrations[kind],
}));
console.log(JSON.stringify({ lessons, worksheets, figures }));
