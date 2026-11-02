import { templates } from "../math/engine";
import { historicalTemplates } from "../math/historical-templates";
import { skills } from "../curriculum/catalog";
import type { GradeBand } from "../curriculum/types";
import { lessons, type Lesson } from "./lessons";
import { hasProblemLesson, problemLesson } from "./problem-lessons";
import {
  gradeBandOrder,
  problemLessonBlocks,
  referenceLessonBlocks,
  type LessonTextBlock,
} from "./lesson-text";

/** One reviewable lesson: a reference lesson with the problem lessons of its
 * templates, or a problem lesson whose template has no reference lesson. The
 * id is the reference lesson id, or `template:<templateId>`. */
export type LessonUnit = {
  id: string;
  kind: "lesson" | "template";
  title: string;
  /** The earliest band of the unit's templates: where a learner first meets it. */
  band: GradeBand;
  strands: string[];
  templateIds: string[];
  lesson?: Lesson;
};

export type RenderedUnit = {
  unit: LessonUnit;
  /** The reference lesson's blocks, then each template's problem lesson. */
  parts: {
    label: string;
    blocks: LessonTextBlock[];
    /** The practice opening is the reference summary, so it is not repeated. */
    repeatsSummary?: boolean;
  }[];
};

const skillById = new Map(skills.map((s) => [s.id, s]));
const templateById = new Map(
  [...templates, ...historicalTemplates].map((t) => [t.id, t]),
);

function bandAndStrands(templateIds: string[]) {
  const found = templateIds
    .map((id) => skillById.get(templateById.get(id)?.skillId ?? ""))
    .filter((s) => s !== undefined);
  const band =
    found
      .map((s) => s.gradeBand)
      .sort(
        (a, b) => gradeBandOrder.indexOf(a) - gradeBandOrder.indexOf(b),
      )[0] ?? "precalculus";
  return { band, strands: [...new Set(found.map((s) => s.strand))] };
}

/** Every reference lesson, then every current template without one. */
export function lessonUnits(): LessonUnit[] {
  const covered = new Set(lessons.flatMap((l) => l.templateIds));
  return [
    ...lessons.map((lesson) => ({
      id: lesson.id,
      kind: "lesson" as const,
      title: lesson.title,
      templateIds: lesson.templateIds,
      lesson,
      ...bandAndStrands(lesson.templateIds),
    })),
    ...templates
      .filter((t) => !covered.has(t.id))
      .map((t) => ({
        id: `template:${t.id}`,
        kind: "template" as const,
        title: t.title,
        templateIds: [t.id],
        ...bandAndStrands([t.id]),
      })),
  ];
}

/** The unit's learner-visible text in render order. Each problem lesson's
 * example is generated from a fixed seed, so the text is reproducible. */
export function renderUnit(
  unit: LessonUnit,
  seed = "plain-language",
): RenderedUnit {
  const parts: RenderedUnit["parts"] = [];
  if (unit.lesson)
    parts.push({ label: "lesson", blocks: referenceLessonBlocks(unit.lesson) });
  for (const templateId of unit.templateIds) {
    if (!hasProblemLesson(templateId)) continue;
    const view = problemLesson(templateId, seed);
    const blocks = problemLessonBlocks(view);
    // The practice opening falls back to the reference summary: reviewers
    // read it once, in the reference lesson.
    const repeatsSummary =
      !!unit.lesson && view.intuition === unit.lesson.summary;
    parts.push({
      label: `practice ${templateId}`,
      blocks: repeatsSummary
        ? blocks.filter((b) => b.label !== "opening")
        : blocks,
      ...(repeatsSummary ? { repeatsSummary } : {}),
    });
  }
  return { unit, parts };
}
