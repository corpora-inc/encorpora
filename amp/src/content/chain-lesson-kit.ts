import type { Lesson } from "./lessons";

/** The compact shape every chain family uses to write its reference lesson:
 * a plain opening, one worked chain with every step, the reusable method, the
 * precise rule, and the slips that break a chain. */
export interface ChainLessonSpec {
  id: string;
  title: string;
  summary: string;
  templateIds: string[];
  objectives: string[];
  openingTitle: string;
  opening: string[];
  example: { prompt: string; steps: string[]; answer: string };
  methodTitle: string;
  method: string[];
  formalTitle: string;
  formal: string[];
  pitfalls: string[];
  parentGuide: string;
}

export function chainLesson(spec: ChainLessonSpec): Lesson {
  return {
    id: spec.id,
    title: spec.title,
    summary: spec.summary,
    templateIds: spec.templateIds,
    objectives: spec.objectives,
    sections: [
      {
        stage: "intuition",
        title: spec.openingTitle,
        paragraphs: spec.opening,
      },
    ],
    workedExample: spec.example,
    closingSections: [
      {
        stage: "method",
        title: spec.methodTitle,
        paragraphs: spec.method,
      },
      { stage: "formal", title: spec.formalTitle, paragraphs: spec.formal },
    ],
    pitfalls: spec.pitfalls,
    parentGuide: spec.parentGuide,
  };
}
