/** What every crane piece gives the mount. */
import type { CraneTimeline } from "../timeline";

export type PieceInit = {
  /** The SVG group the piece draws into, at the piece's own origin. */
  root: SVGGElement;
  /** Smallest and largest value a key takes in this shot: its start and every `set` of it. */
  range: (key: string, start: number) => [number, number];
  /** Authoring mistakes found while building. */
  issues: string[];
};

export interface Piece {
  /** Natural size in stage pixels; the stage only ever scales a figure down. */
  readonly w: number;
  readonly h: number;
  /** Every part name an action may show, hide or light. */
  readonly parts: readonly string[];
  /** Every value a `set` may ease, with the value it starts at. */
  readonly initial: Readonly<Record<string, number>>;
  /** Parts hidden until a `show`. */
  readonly hidden: readonly string[];
  /** The picture at film time t. */
  draw(tl: CraneTimeline, t: number): void;
}

export type Spec = Record<string, unknown>;

export const num = (spec: Spec, key: string, fallback: number, issues: string[], where: string): number => {
  const v = spec[key];
  if (v === undefined) return fallback;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    issues.push(`${where}.${key} must be a number.`);
    return fallback;
  }
  return v;
};
export const str = (spec: Spec, key: string, fallback: string, issues: string[], where: string): string => {
  const v = spec[key];
  if (v === undefined) return fallback;
  if (typeof v !== "string") {
    issues.push(`${where}.${key} must be text.`);
    return fallback;
  }
  return v;
};
export const strs = (spec: Spec, key: string, issues: string[], where: string): string[] => {
  const v = spec[key];
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) {
    issues.push(`${where}.${key} must be a list of names.`);
    return [];
  }
  return v as string[];
};
export const nums = (spec: Spec, key: string, issues: string[], where: string): number[] | undefined => {
  const v = spec[key];
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.some((x) => typeof x !== "number")) {
    issues.push(`${where}.${key} must be a list of numbers.`);
    return undefined;
  }
  return v as number[];
};
/** A spec may only name the fields its piece knows: a typo is a mistake, not a silent default. */
export function known(spec: Spec, fields: readonly string[], issues: string[], where: string) {
  for (const k of Object.keys(spec)) if (!fields.includes(k)) issues.push(`${where} has no field "${k}". It takes: ${fields.join(", ")}.`);
}
