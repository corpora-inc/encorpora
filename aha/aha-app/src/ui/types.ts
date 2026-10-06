import type { GrowthSummary } from "../application/growth";
import type { ActivitySpec } from "../activity/spec";
import type { GradeOutcome, LearnerResponse } from "../activity/grade";
export type StudioVisual =
  | { type: "fraction"; numerator: number; denominator: number; label?: string }
  | { type: "array"; rows: number; columns: number; label?: string }
  | {
      type: "number-line";
      min: number;
      max: number;
      step?: number;
      marks?: number[];
      label?: string;
    }
  | { type: "place-value"; value: number; label?: string }
  | {
      type: "coordinates";
      points: { x: number; y: number; label?: string }[];
      extent?: number;
      label?: string;
    }
  | { type: "rectangle"; width: number; height: number; label?: string }
  | {
      type: "cuboid";
      width: number;
      height: number;
      depth: number;
      label?: string;
    };
export interface StudioActivity {
  id: string;
  title: string;
  prompt: string;
  skill: string;
  standard?: string;
  answerKind?: "number" | "fraction" | "text" | "choice" | "comparison";
  /** The answer domain can be negative, so offer a sign key (never derived from this answer). */
  signed?: boolean;
  choices?: { id: string; label: string }[];
  visual?: StudioVisual;
}
/** An AI-authored Activity Spec rendered in the same focus stage as local practice. */
export interface StudioSpecActivity {
  /** The app's activity id. Model-written spec ids are not unique across batches. */
  id?: string;
  spec: ActivitySpec;
  /** Supply after grading (gradeActivity); the stage then shows compact feedback and Next. */
  result?: GradeOutcome;
  onSubmit: (response: LearnerResponse) => void;
  initialResponse?: LearnerResponse;
}
export interface StudioProps {
  mode: "preview" | "native";
  /** Where the current practice comes from, shown as the focus bar's status dot. */
  practiceMode?: "ai" | "local";
  /** Takes precedence over `activity` in the focus stage. Hints and explanations still arrive
   * through `onSupport` and `hint`, exactly as for local practice. */
  spec?: StudioSpecActivity;
  learnerName: string;
  activity?: StudioActivity;
  busy?: boolean;
  busyLabel?: string;
  /** First attempt already persisted; show a fresh task instead of rescoring retries. */
  activityAnswered?: boolean;
  onLearningVisibleChange?: (visible: boolean) => void;
  error?: string;
  feedback?: {
    /** nudge: first miss of a forgiving retry; the input stays open and nothing is revealed. */
    kind: "correct" | "retry" | "nudge" | "info";
    title: string;
    message: string;
  };
  hint?: string;
  curiosity?: { question: string; answer?: string };
  session: { completed: number; target: number; minutes?: number; complete?: boolean; summary?: string };
  /** Unused by the studio since Growth reads `growth`; kept optional for older harnesses. */
  progress?: {
    label: string;
    detail: string;
    status: "growing" | "review" | "confident";
  }[];
  /** Growth page and Home summary from durable evidence (application/growth.ts). */
  growth?: GrowthSummary;
  account: {
    connected: boolean;
    signInAvailable?: boolean;
    /** Only true after runtime service and spending authorization checks. */
    aiReady?: boolean;
    label?: string;
    balance?: string;
    /** Read-only: the user's app budget as set in Free2Z, e.g. "100 2Z per month" or "No app budget". */
    budget?: string;
    /** What is left of that budget, when one is set and Free2Z has reported it. */
    budgetLeft?: string;
    /** Approximate 2Z per batch of AI activities (last settled charge, else the last estimate's upper bound). */
    batchCost?: string;
    status?: string;
    /** The last AI attempt was refused for this reason (zero cost): `raise_budget` also shows the Free2Z account link. */
    refusal?: "top_up" | "raise_budget";
    purchaseAvailable?: boolean;
  };
  /** The AI model row in Settings (connected, once the catalogue has been read). Display only. */
  modelMenu?: {
    /** "auto" or a catalogue model id. */
    choice: string;
    auto?: { name: string; batch2z?: string };
    /** `reasoning`: the model thinks longer and costs more; Settings labels it. */
    options: { id: string; name: string; batch2z?: string; reasoning?: boolean }[];
  };
  onChooseModel?: (choice: string) => void;
  /** Per-model stats lines from local data, for Settings and the problem report. */
  loadModelStats?: () => Promise<string[]>;
  /** Name of the model that wrote the AI activity on screen, for the status sheet. */
  authoringModel?: string;
  learners?: { id: string; name: string }[];
  onSubmit: (answer: string) => void;
  onContinue: () => void;
  onSupport: (
    action: "hint" | "explain" | "stuck" | "harder" | "dispute",
  ) => void;
  onCuriosity: (question: string) => void;
  onCloseCuriosity: () => void;
  onManageAccount?: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onRefreshAccount?: () => void;
  onTopUp?: () => void;
  onRecoverUsage?: () => void;
  onCancel?: () => void;
  savedAnswers?: { operationId: string; learnerName: string; canRestore: boolean }[];
  onRestoreAnswer?: (id: string) => void;
  onDiscardAnswer?: (id: string) => void;
  pendingUsage?: {
    operationId: string;
    createdAt: string;
    canRecover: boolean;
  }[];
  onRecoverRequest?: (id: string) => void;
  practiceStatus?: string;
  onSelectLearner?: (id: string) => void;
  onCreateLearner?: (name: string, startGrade: number) => void;
  onExport: () => void;
  onImport: () => void;
  onDeleteLearner: () => void;
}
