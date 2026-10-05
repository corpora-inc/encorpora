/**
 * The Activity Spec v2 wire shape (README §3), generated per grade band from the registry.
 *
 * Every object is strict and every key required (unused nullable fields are null), so the zod
 * schema here, the strict JSON schema sent as `response_format` (schema.ts) and the validator agree.
 * Keys are single lowercase words declared in alphabetical order, which is also the authoring order:
 * generation follows the declared order where the gateway preserves it, and the sorted order where
 * it sorts (zuu#1132, fixed by zuu#1143); the two are the same. `wire.test.ts` pins both.
 *
 * A band's schema carries only the structures, views and response forms some grade of the band may
 * use, so off-band intents are inexpressible at decode time (README §9). String lengths, ids and
 * text rules are checked here too, but the strict JSON schema does not rely on them.
 */
import * as z from 'zod';
import { MAX_EXPR_CHARS, QUANTITY_KINDS, UNIT_IDS, type QuantityKind, type UnitId } from './quantity';
import { BANDS, FORM_GRADES, RESPONSE_FORMS, TAGS, THEMES, overlaps, type Band, type GradeRange, type ResponseForm, type Tag, type Theme } from './registry';
import { STRUCTURES, STRUCTURE_KINDS, type StructureKind } from './structures';

export const ID = /^[a-z][a-z0-9]{0,7}$/;
/** Names reserved by the expression grammar. */
export const RESERVED_IDS: ReadonlySet<string> = new Set(['min', 'max']);
export const SKILL_ID = /^[K1-8]\.[A-Z]{1,3}\.[A-D]\.\d{1,2}$/;
export const ICON = /^[a-z][a-z_]{0,31}$/;
export const LIMITS = {
  quantities: 8, structures: 2, blocks: 8, hints: 3, distractors: 4, candidates: 6, skills: 3, activities: 5,
  text: 400, tex: 200, hint: 200, explanation: 400, why: 160, noun: 24,
} as const;
export const EXACTNESS = ['any', 'simplest', 'exact'] as const;
export const DIRECTIONS = ['ascending', 'descending'] as const;

// ---------- static types (what a band's schema accepts, across all bands) ----------
type Defs = typeof STRUCTURES;
export type WireStructureOf<K extends StructureKind> = { id: string; kind: K; roles: { [R in keyof Defs[K]['roles']]: string | null }; show: keyof Defs[K]['views'] | null };
export type WireStructure = { [K in StructureKind]: WireStructureOf<K> }[StructureKind];
export interface WireNoun { icon: string | null; one: string; other: string }
export interface WireQuantity { id: string; kind: QuantityKind; noun: WireNoun | null; unit: UnitId | null; value: string }
export type WireBlock = { text: string; type: 'text' } | { tex: string; type: 'math' } | { of: string; type: 'view' };
export interface WireDistractor { expr: string; tag: Tag }
export type WireResponse =
  | { ask: string; distractors: WireDistractor[]; form: 'number' }
  | { ask: string; distractors: WireDistractor[]; exactness: typeof EXACTNESS[number]; form: 'fraction' }
  | { ask: string; candidates: string[] | null; distractors: WireDistractor[]; form: 'choose' }
  | { ask: string; candidates: string[]; form: 'select' }
  | { candidates: string[]; direction: typeof DIRECTIONS[number]; form: 'order' }
  | { ask: string; form: 'tap'; on: string | null }
  | { ask: string; form: 'shade' | 'place'; on: string };
export interface WireActivity {
  aim: { skills: string[]; theme: Theme; why: string };
  level: number;
  model: { quantities: WireQuantity[]; structures: WireStructure[] };
  prompt: WireBlock[];
  response: WireResponse;
  support: { explanation: string; hints: string[] };
}
export interface WireBatch { activities: WireActivity[] }

// ---------- zod, per band ----------
const id = () => z.string().regex(ID, 'Use a short id: a lowercase letter, then up to 7 lowercase letters or digits.');
const text = (max: number) => z.string().min(1).max(max);
const expr = () => z.string().min(1).max(MAX_EXPR_CHARS);
const lit = <T extends string>(v: T) => z.literal(v);
/** One object per form; fields only where they mean something (README §3). */
const RESPONSE_VARIANTS: Record<ResponseForm, () => z.ZodObject> = {
  number: () => z.strictObject({ ask: expr(), distractors: distractors(), form: lit('number') }),
  fraction: () => z.strictObject({ ask: expr(), distractors: distractors(), exactness: z.enum(EXACTNESS), form: lit('fraction') }),
  choose: () => z.strictObject({ ask: expr(), candidates: candidates().nullable(), distractors: distractors(), form: lit('choose') }),
  select: () => z.strictObject({ ask: expr(), candidates: candidates(), form: lit('select') }),
  order: () => z.strictObject({ candidates: candidates(), direction: z.enum(DIRECTIONS), form: lit('order') }),
  tap: () => z.strictObject({ ask: expr(), form: lit('tap'), on: id().nullable() }),
  shade: () => z.strictObject({ ask: expr(), form: lit('shade'), on: id() }),
  place: () => z.strictObject({ ask: expr(), form: lit('place'), on: id() }),
};
const distractors = () => z.array(z.strictObject({ expr: expr(), tag: z.enum(TAGS) })).max(LIMITS.distractors);
const candidates = () => z.array(expr()).min(2).max(LIMITS.candidates);

function structureSchema(kind: StructureKind, range: GradeRange): z.ZodObject | null {
  const def = STRUCTURES[kind];
  if (!overlaps(def.grades, range)) return null;
  const views = Object.entries(def.views).filter(([, v]) => overlaps(v.grades, range)).map(([name]) => name);
  const roles = Object.fromEntries(Object.entries(def.roles).sort(([a], [b]) => a < b ? -1 : 1)
    .map(([name, spec]) => [name, spec.nullable ? id().nullable() : id()]));
  return z.strictObject({
    id: id(), kind: z.literal(kind), roles: z.strictObject(roles),
    show: views.length ? z.enum(views as [string, ...string[]]).nullable() : z.null(),
  });
}
const union = (key: string, options: z.ZodObject[]) =>
  options.length === 1 ? options[0]! : z.discriminatedUnion(key, options as [z.ZodObject, z.ZodObject, ...z.ZodObject[]]);

export interface WireSchemas { activity: z.ZodType; batch: z.ZodType; structureKinds: StructureKind[]; forms: ResponseForm[] }
/** The wire schema for a grade range: a band, or every grade (`all`). */
export function wireSchemas(range: GradeRange): WireSchemas {
  const structures = STRUCTURE_KINDS.flatMap(k => { const s = structureSchema(k, range); return s ? [s] : []; });
  const structureKinds = STRUCTURE_KINDS.filter(k => overlaps(STRUCTURES[k].grades, range));
  const forms = RESPONSE_FORMS.filter(f => overlaps(FORM_GRADES[f], range));
  const activity = z.strictObject({
    aim: z.strictObject({ skills: z.array(z.string().regex(SKILL_ID)).min(1).max(LIMITS.skills), theme: z.enum(THEMES), why: text(LIMITS.why) }),
    level: z.number().int().min(1).max(10),
    model: z.strictObject({
      quantities: z.array(z.strictObject({
        id: id(), kind: z.enum(QUANTITY_KINDS),
        noun: z.strictObject({ icon: z.string().regex(ICON).nullable(), one: text(LIMITS.noun), other: text(LIMITS.noun) }).nullable(),
        unit: z.enum(UNIT_IDS).nullable(), value: expr(),
      })).min(1).max(LIMITS.quantities),
      structures: z.array(union('kind', structures)).min(1).max(LIMITS.structures),
    }),
    prompt: z.array(union('type', [
      z.strictObject({ text: text(LIMITS.text), type: lit('text') }),
      z.strictObject({ tex: text(LIMITS.tex), type: lit('math') }),
      z.strictObject({ of: id(), type: lit('view') }),
    ])).min(1).max(LIMITS.blocks),
    response: union('form', forms.map(f => RESPONSE_VARIANTS[f]())),
    support: z.strictObject({ explanation: text(LIMITS.explanation), hints: z.array(text(LIMITS.hint)).max(LIMITS.hints) }),
  });
  return { activity, batch: z.strictObject({ activities: z.array(activity).min(1).max(LIMITS.activities) }), structureKinds, forms };
}

const cache = new Map<string, WireSchemas>();
/** Cached per band, so a band's schema is built once (and compiled once by the gateway). */
export function bandWire(band: Band | 'all'): WireSchemas {
  let w = cache.get(band);
  if (!w) { w = wireSchemas(band === 'all' ? [0, 8] : BANDS[band]); cache.set(band, w); }
  return w;
}
