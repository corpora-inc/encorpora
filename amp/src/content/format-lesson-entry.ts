import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";

/** One problem lesson in the shape every response-format family writes it:
 * intuition, a worked example, a method, the reason it works and pitfalls. */
export type FormatLessonEntry = {
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

export function formatLessons(entries: readonly FormatLessonEntry[]) {
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
        title: "What the question asks",
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
  return { lessons, methods, principles };
}
