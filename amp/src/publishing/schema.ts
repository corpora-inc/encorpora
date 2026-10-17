/** Original book authoring contract; all measurements are exact rational pairs. */
export type Rational = [numerator: number, denominator: number];
export type Diagram = {
  id: string;
  caption: string;
  alt: string;
} & (
  | {
      kind: "strips";
      wholeLabel: string;
      rows: { label: string; parts: number; shaded: number; wholes?: number }[];
    }
  | {
      kind: "number-line";
      wholeLabel: string;
      min: Rational;
      max: Rational;
      divisionsPerUnit: number;
      /** Integer labels only; ticks retain the authored subdivisions. */
      integerLabelInterval?: number;
      marks: { at: Rational; label: string }[];
      jumps?: { from: Rational; to: Rational; label: string }[];
    }
  | {
      /** Equal unit cells; splits partition the array, never overlapping shares. */
      kind: "array";
      rows: number;
      columns: number;
      splitAfterColumn?: number;
      splitAfterRow?: number;
      rowLabel: string;
      columnLabel: string;
    }
  | {
      kind: "area";
      wholeLabel: string;
      columns: number;
      rows: number;
      shadedColumns: number;
      shadedRows: number;
    }
  | {
      kind: "groups";
      wholeLabel: string;
      total: Rational;
      groupSize: Rational;
      unitDivisions: number;
    }
  | {
      kind: "double-line";
      topLabel: string;
      bottomLabel: string;
      pairs: { top: Rational; bottom: Rational }[];
    }
);
export type BookBlock =
  | { kind: "text"; text: string }
  | {
      kind: "callout";
      tone: "notice" | "predict" | "misconception" | "connect";
      title: string;
      text: string;
    }
  | { kind: "diagram"; diagram: Diagram }
  | {
      kind: "worked";
      title: string;
      prompt: string;
      steps: string[];
      conclusion: string;
    }
  | {
      kind: "task";
      id: string;
      prompt: string;
      response: {
        kind: "lines" | "grid" | "blank";
        size: "short" | "medium" | "large";
      };
    }
  | {
      kind: "solution";
      taskId: string;
      answer: string;
      reasoning: string;
      check?: string;
    };
export interface BookPage {
  id: string;
  kind:
    "opening" | "lesson" | "workshop" | "reflection" | "solutions" | "guide";
  eyebrow: string;
  title: string;
  subtitle?: string;
  blocks: BookBlock[];
}
export interface MathBook {
  id: string;
  version: string;
  title: string;
  subtitle: string;
  audience: string;
  description: string;
  pages: BookPage[];
}

/** Compatibility name for existing fraction authoring and readers. */
export type FractionBook = MathBook;
