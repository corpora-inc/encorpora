import type { GradeBand } from "../curriculum/types";
import type { Lesson } from "./lessons";
import type { ProblemLessonView } from "./problem-lessons";

/** The teaching layer a block belongs to, in the order a learner meets them. */
export type LessonStage =
  | "summary"
  | "goal"
  | "intuition"
  | "example"
  | "method"
  | "watch"
  | "formal"
  | "partner";

/** One learner-visible block of lesson text: a summary, a section, the worked
 * steps, a method list. `label` names it for reviewers ("intuition: Why
 * either factor can be zero"); `lines` are its sentences or list items. */
export type LessonTextBlock = {
  stage: LessonStage;
  label: string;
  lines: string[];
};

/** Grade bands from youngest to oldest, in the order a learner reaches them. */
export const gradeBandOrder: readonly GradeBand[] = [
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "algebra-1",
  "geometry",
  "algebra-2",
  "precalculus",
];

const courseNames: Partial<Record<GradeBand, string>> = {
  K: "kindergarten",
  "algebra-1": "Algebra 1",
  geometry: "Geometry",
  "algebra-2": "Algebra 2",
  precalculus: "Precalculus",
};

export function gradeBandName(band: GradeBand) {
  return courseNames[band] ?? `grade ${band}`;
}

/** The band a learner works at just before this one. */
export function bandBelow(band: GradeBand): GradeBand | null {
  const i = gradeBandOrder.indexOf(band);
  return i > 0 ? gradeBandOrder[i - 1]! : null;
}

/** A reference lesson's text in the order `ReferenceLesson` renders it:
 * summary and intuition sections, worked example, method sections, watch
 * for, the partner note, then principle and definitions. Objectives are
 * listed after the summary as the lesson's goals. */
export function referenceLessonBlocks(lesson: Lesson): LessonTextBlock[] {
  const sections = [
    ...lesson.sections.map((s) => ({ ...s, stage: s.stage ?? "method" })),
    ...(lesson.closingSections ?? []).map((s) => ({
      ...s,
      stage: s.stage ?? "formal",
    })),
  ];
  const layer = (stage: "intuition" | "method" | "formal") =>
    sections
      .filter((s) => s.stage === stage)
      .map((s) => ({
        stage,
        label: `${stage}: ${s.title}`,
        lines: s.paragraphs,
      }));
  const example = lesson.workedExample;
  return [
    { stage: "summary", label: "summary", lines: [lesson.summary] },
    { stage: "goal", label: "goals", lines: lesson.objectives },
    ...layer("intuition"),
    {
      stage: "example",
      label: "worked example",
      lines: [
        `Problem: ${example.prompt}`,
        ...(example.choices ?? []).map((c, i) => `Choice ${i + 1}: ${c}`),
        ...example.steps.map((s, i) => `Step ${i + 1}: ${s}`),
        `Answer: ${[example.answer, example.answerUnit].filter(Boolean).join(" ")}`,
      ],
    },
    ...layer("method"),
    { stage: "watch", label: "watch for", lines: lesson.pitfalls },
    {
      stage: "partner",
      label: "for a parent or learning partner",
      lines: [lesson.parentGuide],
    },
    ...layer("formal"),
  ];
}

/** A problem lesson's text in the order `ProblemLesson` renders it: goal and
 * plain opening, generated example, method, watch for, then the principle and
 * terms. */
export function problemLessonBlocks(
  view: ProblemLessonView,
): LessonTextBlock[] {
  const blocks: LessonTextBlock[] = [
    { stage: "goal", label: "goal", lines: [view.goal] },
  ];
  if (view.intuition && view.intuition !== view.goal)
    blocks.push({
      stage: "intuition",
      label: "opening",
      lines: [view.intuition],
    });
  blocks.push(
    {
      stage: "example",
      label: "example",
      lines: [
        `Problem: ${view.example.prompt}`,
        ...(view.example.choices ?? []).map((c, i) => `Choice ${i + 1}: ${c}`),
        ...view.example.steps.map((s, i) => `Step ${i + 1}: ${s}`),
        `Answer: ${view.example.answer}`,
      ],
    },
    { stage: "method", label: "method", lines: view.method },
  );
  if (view.watch)
    blocks.push({ stage: "watch", label: "watch for", lines: [view.watch] });
  const formal = [
    ...(view.principle ? [view.principle] : []),
    ...view.terms.map(({ term, meaning }) => `${term}: ${meaning}`),
  ];
  if (formal.length)
    blocks.push({
      stage: "formal",
      label: "principle and definitions",
      lines: formal,
    });
  return blocks;
}

/** Plain text a reviewer reads, one labelled block per paragraph group. */
export function blocksText(blocks: LessonTextBlock[], prefix = "") {
  return blocks
    .map(
      (b) =>
        `[${prefix}${b.label}]\n${b.lines.map((line) => `${line}`).join("\n")}`,
    )
    .join("\n\n");
}
