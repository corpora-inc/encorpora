/**
 * The Activity Spec v2 registry (README §5): one entry per semantic intent, and the vocabulary every
 * layer shares (grades, bands, response forms, themes, misconception tags).
 *
 * A `StructureDef` is the single source of truth for its intent. The wire schema fragment is
 * generated from its roles and views (wire.ts); the validator binds and checks its roles and
 * invariants (model.ts, validate.ts); its measures are what an ask may name; each view declares
 * what it reveals, which response forms it hosts, its tappable regions and how it lowers to the
 * drawing IR (draw.ts); and its catalog line is what the model reads (prompt v2).
 */
import type { Grade } from '../../learning/types';
import type { DrawFigure } from '../draw';
import type { Issue, Noun, QuantityDecl, QuantityKind, Value } from './quantity';

// ---------- grades and bands ----------
export const gradeNum = (g: Grade): number => g === 'K' ? 0 : g;
export type GradeRange = readonly [lo: number, hi: number];
export const inRange = (g: number, [lo, hi]: GradeRange) => g >= lo && g <= hi;
export const overlaps = (a: GradeRange, b: GradeRange) => a[0] <= b[1] && b[0] <= a[1];
export const gradeLabel = (g: number) => g === 0 ? 'K' : String(g);
export const rangeLabel = ([lo, hi]: GradeRange) => lo === hi ? gradeLabel(lo) : `${gradeLabel(lo)}–${gradeLabel(hi)}`;

/** Each request ships the schema of one band (README §9). */
export const BANDS = { k2: [0, 2], g35: [3, 5], g68: [6, 8] } as const satisfies Record<string, GradeRange>;
export type Band = keyof typeof BANDS;
export const BAND_IDS = Object.keys(BANDS) as Band[];
export const bandOf = (grade: number): Band => grade <= 2 ? 'k2' : grade <= 5 ? 'g35' : 'g68';

// ---------- responses ----------
export const RESPONSE_FORMS = ['number', 'fraction', 'choose', 'select', 'order', 'tap', 'shade', 'place'] as const;
export type ResponseForm = typeof RESPONSE_FORMS[number];
/** Answer forms ask for the value of `ask`; act forms give the target and ask the learner to act on a view (README §7). */
export const ANSWER_FORMS: ReadonlySet<ResponseForm> = new Set(['number', 'fraction', 'choose']);
export const isAnswerForm = (f: ResponseForm) => ANSWER_FORMS.has(f);
/** Forms that act on one view, named by `on`. */
export type ViewForm = 'tap' | 'shade' | 'place';
export const FORM_GRADES: Readonly<Record<ResponseForm, GradeRange>> = {
  number: [0, 8], fraction: [3, 8], choose: [0, 8], select: [1, 8], order: [1, 8], tap: [0, 8], shade: [1, 5], place: [2, 8],
};

// ---------- closed vocabularies ----------
/** Story contexts, declared so variety is tracked from fields, never from prose (README §3, §10). */
export const THEMES = [
  'animals', 'art', 'bakery', 'building', 'camping', 'cooking', 'farm', 'games', 'garden', 'library', 'market', 'music',
  'nature', 'ocean', 'orchard', 'park', 'party', 'school', 'science', 'space', 'sport', 'toys', 'travel', 'weather',
] as const;
export type Theme = typeof THEMES[number];
/**
 * Misconception tags, curated per domain so learner-state counts do not fragment (README §8.2). The
 * first slice covers equal groups, arrays, area and perimeter, and fractions.
 */
export const TAGS = [
  // operations
  'added_instead', 'subtracted_instead', 'multiplied_instead', 'divided_instead', 'counted_one_group', 'counted_groups_only',
  'off_by_one', 'skip_count_error', 'counted_all',
  // area and perimeter
  'perimeter_for_area', 'area_for_perimeter', 'added_two_sides', 'used_one_side', 'counted_edges_not_squares',
  // fractions
  'counted_unshaded', 'part_to_part', 'numerator_denominator_swapped', 'denominator_as_count', 'unequal_parts',
  'whole_number_bias', 'larger_denominator_larger_fraction', 'added_denominators', 'complement_for_fraction',
] as const;
export type Tag = typeof TAGS[number];

// ---------- structure definitions ----------
export type Reveal = 'shown' | 'countable' | 'hidden';
export interface RoleSpec { kinds: readonly QuantityKind[]; nullable?: boolean }
/** A role bound to its quantity: the declaration, its id and its value. */
export interface BoundRole { id: string; decl: QuantityDecl; value: Value }
/** A structure's roles bound to values; a nullable role left empty is null. */
export type Roles<R extends string> = Readonly<Record<R, BoundRole | null>>;
/**
 * What the ask names, from one structure's point of view: the names of its roles and measures that
 * are the ask (every role bound to the asked quantity: a square binds w and h to one side), or none.
 */
export type Asked = ReadonlySet<string>;
export const NOTHING_ASKED: Asked = new Set();

export interface MeasureDef<R extends string> {
  kind: QuantityKind;
  /** Roles the measure is computed from; it exists only when all of them are bound. */
  inputs: readonly R[];
  /** Nullable roles the value also reads when they are bound (a fraction's complement reads its wholes). */
  reads?: readonly R[];
  value(roles: Roles<R>): Value | Issue;
  /** What the measure counts, for its placeholders ("12 apples"). */
  noun(roles: Roles<R>): Noun | null;
  /** One line for the catalog. */
  means: string;
}
export interface Region { id: string; value: Value; label: string }
export interface LowerCtx { grade: number; asked: Asked }
/** A drawing without the id and alt the resolver adds. */
export type Drawing = DrawFigure extends infer F ? F extends DrawFigure ? Omit<F, 'id' | 'alt'> : never : never;

export interface ViewDef<R extends string> {
  grades: GradeRange;
  /** What {{s.view}} says. */
  noun(roles: Roles<R>): string;
  /** The figure words prose may use for this view when the prompt shows it (singular; plurals follow). Any other figure word is rejected. */
  words: readonly string[];
  /** Act forms this view hosts with `on`. */
  accepts: readonly ViewForm[];
  /** What the learner can learn from the view, per role and measure (README §7). */
  reveals(roles: Roles<R>, asked: Asked): Readonly<Record<string, Reveal>>;
  /** Tappable regions and the value each stands for (README §8.3). */
  regions?(roles: Roles<R>): Region[];
  /** For a view that hosts `shade`: how many equal parts it draws and how many make the target. */
  shade?(roles: Roles<R>, target: Value): { parts: number; target: number } | Issue;
  /** For a view that hosts `place`: its ticks (0…ticks) and the tick the target lands on. */
  place?(roles: Roles<R>, target: Value): { ticks: number; target: number } | Issue;
  /** View-specific limits on the bound roles (unit squares need whole sides, a set has one whole). */
  fits?(roles: Roles<R>, grade: number): Issue[];
  lower(roles: Roles<R>, ctx: LowerCtx): Drawing;
  /**
   * The alt text and speech for the drawing (README §8.4). A value that is `asked` is never stated as
   * a number: it is given as countable words, so a learner using a screen reader can still count it.
   */
  describe(roles: Roles<R>, asked: Asked): string;
  /** One line for the catalog. */
  draws: string;
}
export interface StructureDef<K extends string = string, R extends string = string, V extends string = string> {
  kind: K;
  grades: GradeRange;
  /** Roles in authoring order (alphabetical, so the wire key order is the authoring order). */
  roles: Readonly<Record<R, RoleSpec>>;
  measures: Readonly<Record<string, MeasureDef<R>>>;
  /** The measure a whole view is valued by when `tap` chooses among views. */
  primary: string;
  /** Domain rules: magnitudes per grade, divisibility, unit agreement, drawing caps that hold for every view. */
  invariants(roles: Roles<R>, grade: number): Issue[];
  views: Readonly<Record<V, ViewDef<R>>>;
  /** When to use this intent, for the catalog. */
  use: string;
}

export const issue = (code: string, message: string): Issue => ({ code, message });
export const isIssue = (v: Value | Issue): v is Issue => 'code' in v;
