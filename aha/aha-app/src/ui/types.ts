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
export interface StudioProps {
  mode: "preview" | "native";
  learnerName: string;
  activity?: StudioActivity;
  busy?: boolean;
  busyLabel?: string;
  /** First attempt already persisted; show a fresh task instead of rescoring retries. */
  activityAnswered?: boolean;
  onLearningVisibleChange?: (visible: boolean) => void;
  error?: string;
  feedback?: {
    kind: "correct" | "retry" | "info";
    title: string;
    message: string;
  };
  hint?: string;
  curiosity?: { question: string; answer?: string };
  session: { completed: number; target: number; minutes?: number; complete?: boolean; summary?: string };
  progress: {
    label: string;
    detail: string;
    status: "growing" | "review" | "confident";
  }[];
  account: {
    connected: boolean;
    signInAvailable?: boolean;
    /** Only true after runtime service and spending authorization checks. */
    aiReady?: boolean;
    label?: string;
    balance?: string;
    status?: string;
    purchaseAvailable?: boolean;
  };
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
