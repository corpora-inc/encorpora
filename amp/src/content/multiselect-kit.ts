import type { FacetMapping } from "./coverage";
import type { Lesson } from "./lessons";
import type { ProblemMethod } from "./problem-lessons";
import { chainLesson } from "./chain-lesson-kit";

/**
 * One compact spec per select-every-true-statement template. It writes the
 * problem method (goal, plain meaning, terms, steps, the usual slip), the
 * principle, the reference lesson and the partial facet mapping, so each stays
 * consistent with the others.
 */
export interface SelectContentSpec {
  id: string;
  skillId: string;
  title: string;
  summary: string;
  goal: string;
  intuition: string;
  more: string;
  terms: [string, string][];
  steps: string[];
  watch: string;
  principle: string;
  example: { prompt: string; steps: string[]; answer: string };
  objectives: [string, string];
  pitfalls: [string, string, string];
  parentGuide: string;
  assessed: string;
  notAssessed: string;
  facet?: string;
}

export function buildSelectContent(specs: readonly SelectContentSpec[]) {
  const methods: Record<string, ProblemMethod> = {};
  const principles: Record<string, string> = {};
  const lessons: Lesson[] = [];
  const facetMappings: FacetMapping[] = [];
  for (const s of specs) {
    methods[s.id] = {
      goal: s.goal,
      intuition: s.intuition,
      terms: s.terms,
      method: s.steps,
      watch: s.watch,
    };
    principles[s.id] = s.principle;
    lessons.push(
      chainLesson({
        id: `${s.id}-lesson`,
        title: s.title,
        summary: s.summary,
        templateIds: [s.id],
        objectives: s.objectives,
        openingTitle: "What the question asks",
        opening: [s.intuition, s.more],
        example: s.example,
        methodTitle: "Test every statement, then count",
        method: s.steps,
        formalTitle: "The idea behind the method",
        formal: [s.principle],
        pitfalls: s.pitfalls,
        parentGuide: s.parentGuide,
      }),
    );
    facetMappings.push({
      templateId: s.id,
      facetId: s.facet ?? `${s.skillId}.core`,
      extent: "partial",
      rationale: `${s.assessed} Select-all response: the learner must choose exactly the stated number of true statements. ${s.notAssessed}`,
    });
  }
  return { methods, principles, lessons, facetMappings };
}
