import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** One structured-work template's teaching: the method a problem lesson
 * shows, the principle it rests on and the printable reference lesson. */
export type WorkEntry = {
  id: string;
  title: string;
  summary: string;
  objectives: [string, string];
  intuition: string;
  terms: [string, string][];
  method: string[];
  watch: string;
  principle: string;
  example: Lesson["workedExample"];
  methodTitle: string;
  methodText: string[];
  formal: string;
  pitfalls: string[];
  parentGuide: string;
};

export function workContent(entries: readonly WorkEntry[]) {
  const methods: Record<string, ProblemMethod> = Object.fromEntries(
    entries.map((e) => [
      e.id,
      {
        goal: e.summary,
        intuition: e.intuition,
        terms: e.terms,
        method: e.method,
        watch: e.watch,
      },
    ]),
  );
  const principles: Record<string, string> = Object.fromEntries(
    entries.map((e) => [e.id, e.principle]),
  );
  const lessons: Lesson[] = entries.map((e) => ({
    id: e.id,
    title: e.title,
    summary: e.summary,
    templateIds: [e.id],
    objectives: [...e.objectives],
    sections: [
      {
        stage: "intuition",
        title: "What the work shows",
        paragraphs: [e.intuition],
      },
    ],
    workedExample: e.example,
    closingSections: [
      { stage: "method", title: e.methodTitle, paragraphs: e.methodText },
      {
        stage: "formal",
        title: "Why the method works",
        paragraphs: [e.formal],
      },
    ],
    pitfalls: e.pitfalls,
    parentGuide: e.parentGuide,
  }));
  return { methods, principles, lessons };
}
