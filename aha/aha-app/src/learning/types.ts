/** Versioned, JSON-safe learning contract. Rational values are exact strings, not floats. */
export type Grade = 'K' | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type RationalString = string;
export type Operator = 'add' | 'subtract' | 'multiply' | 'divide';
export type CanonicalTask =
  | { kind: 'arithmetic'; operation: Operator; left: RationalString; right: RationalString }
  | { kind: 'compare'; left: RationalString; right: RationalString }
  | { kind: 'missing'; operation: Operator; left: RationalString; result: RationalString }
  | { kind: 'fraction'; numerator: number; denominator: number }
  | { kind: 'placeValue'; value: number; place: number }
  | { kind: 'round'; value: RationalString; place: RationalString }
  | { kind: 'sequence'; start: RationalString; step: RationalString; count: number }
  | { kind: 'measure'; shape: 'rectangle'; measure: 'area' | 'perimeter'; width: RationalString; height: RationalString }
  | { kind: 'measure'; shape: 'triangle'; measure: 'area'; width: RationalString; height: RationalString }
  | { kind: 'measure'; shape: 'cuboid'; measure: 'volume' | 'surfaceArea'; width: RationalString; height: RationalString; depth: RationalString }
  | { kind: 'linear'; a: RationalString; b: RationalString; c: RationalString }
  | { kind: 'power'; base: RationalString; exponent: number }
  | { kind: 'factors'; operation: 'gcd' | 'lcm'; left: number; right: number }
  | { kind: 'statistics'; operation: 'mean' | 'median' | 'range'; values: RationalString[] }
  | { kind: 'probability'; favorable: number; total: number }
  | { kind: 'percent'; percent: RationalString; whole: RationalString }
  | { kind: 'rate'; quantity: RationalString; units: RationalString }
  | { kind: 'slope'; x1: RationalString; y1: RationalString; x2: RationalString; y2: RationalString }
  | { kind: 'pythagorean'; a: number; b: number }
  | { kind: 'evaluate'; coefficients: RationalString[]; x: RationalString };
export type TaskKind = CanonicalTask['kind'];
export type VisualSpec =
  | { kind: 'numberLine'; min: number; max: number; step: number; marks: number[] }
  | { kind: 'fraction'; numerator: number; denominator: number }
  | { kind: 'array'; rows: number; columns: number }
  | { kind: 'placeValue'; value: number }
  | { kind: 'coordinate'; points: { x: number; y: number; label?: string }[] }
  | { kind: 'rectangle'; width: number; height: number }
  | { kind: 'cuboid'; width: number; height: number; depth: number };
export interface Activity {
  version: 1;
  id: string;
  skillId: string;
  source: 'local' | 'ai';
  mode: 'concept' | 'fluency' | 'review';
  task: CanonicalTask;
  /** Regenerated from task by validateActivity; never trust an AI-written question. */
  prompt: string;
  choices?: string[];
  hint?: string;
  explanation?: string;
  visual?: VisualSpec;
  /** Stable task fingerprint used to avoid counting repeats as varied evidence. */
  variant: string;
}
export interface Skill {
  id: string;
  grade: Grade;
  domain: string;
  title: string;
  standards: string[];
  sourceUrl: string;
  /** App-authored dependencies, not official CCSS prerequisite declarations. */
  prerequisites: string[];
  prerequisiteBasis: 'aha-inferred';
  taskKinds: TaskKind[];
  coverage: 'verified-practice' | 'guided-only';
  fluencyTargetMs?: number;
}
export interface AttemptEvidence {
  id: string;
  activityId: string;
  skillId: string;
  at: string;
  correct: boolean;
  answer: string;
  expected: string;
  task: CanonicalTask;
  variant: string;
  mode: Activity['mode'];
  choices?: string[];
  hintsUsed: number;
  /** Only foreground, visible, active time. null means no reliable timing. */
  activeMs: number | null;
  interrupted: boolean;
  independent: boolean;
  /** The first, incorrect answer when the learner used the one forgiving retry. Its presence makes the attempt assisted. */
  firstAnswer?: string;
  /** Disputed evidence remains auditable but never contributes to progress. */
  excluded?: { reason: string; at: string };
}
export interface SkillProgress {
  skillId: string;
  concept: 'unseen' | 'developing' | 'provisional';
  fluency: 'not-applicable' | 'developing' | 'fluent';
  retention: 'unconfirmed' | 'retained';
  independentSuccesses: number;
  distinctVariants: string[];
  reviewStage: number;
  nextReviewAt: string | null;
  lastAttemptAt: string;
}
export interface LearnerState {
  version: 1;
  learnerId: string;
  startGrade: Grade;
  progress: Record<string, SkillProgress>;
  /** Durable evidence is append-only; UI storage must save returned state atomically. */
  attempts: AttemptEvidence[];
}
export interface AttemptInput {
  id: string;
  answer: string;
  at?: string;
  hintsUsed?: number;
  activeMs?: number | null;
  interrupted?: boolean;
  /** Set when this is the single retry after an incorrect first answer on the same activity. */
  firstAnswer?: string;
}
export interface GradeResult { correct: boolean; expected: string; normalizedAnswer?: string; error?: string }
export type ValidationResult = { ok: true; activity: Activity } | { ok: false; errors: string[] };
export interface Candidate {
  skill: Skill;
  /** confidence: a brief success-building item from demonstrated (or easier) work after repeated misses. */
  reason: 'due-review' | 'support' | 'continue' | 'frontier' | 'placement' | 'confidence';
  /** worked-example: after two misses, teach a similar solved task before the learner tries again. */
  approach?: 'worked-example';
}
