/**
 * What `ActivityView` renders: a resolved activity, whose figures are drawings (draw.ts) and whose
 * response is a spec of the grading IR (grade.ts). A v1 `ActivitySpec` is already one; an Activity
 * Spec v2 activity becomes one through `v2/resolve.ts`, after which nothing downstream can tell them
 * apart.
 */
import type { Block } from './spec';
import type { DrawFigure } from './draw';
import type { AnyLearnerResponse, GradeSpec, LearnerResponse } from './grade';

export interface ResolvedSpec {
  id: string;
  title?: string;
  skillIds: string[];
  difficulty: number;
  prompt: Block[];
  figures?: DrawFigure[];
  response: GradeSpec;
  hints?: string[];
  explanation: string;
}

const V1_RESPONSE_TYPES: ReadonlySet<string> = new Set(['numeric', 'fraction', 'expression', 'multiple_choice', 'multi_select', 'ordering', 'plot_point', 'tap_region']);
/**
 * A response of a v1 type: the only kind a v1 activity can produce, and the only kind its evidence
 * records. Dependency-free, so the startup bundle can use it.
 */
export const isV1Response = (r: AnyLearnerResponse): r is LearnerResponse => V1_RESPONSE_TYPES.has(r.type);
