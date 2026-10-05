/**
 * Representation sets (README §10): for each skill, the intents and views that model it, and the
 * response forms that practise it. Variety lives inside this set, so novelty never competes with
 * pedagogy (the variety-branch lesson: a coordinate plane for K counting). The prompt shows each
 * skill's set, and L1 enforces it.
 *
 * First slice: the skills the four slice intents can model. A strong model drafts the full map from
 * CCSS and the progressions (step 11); the pedagogy lead reviews it. `'none'` means the structure may
 * be told in words with no figure.
 */
import type { ResponseForm } from './registry';
import type { StructureKind } from './structures';

export interface Representation {
  /** Allowed intents, each with the views (or 'none') that may show it. */
  structures: Partial<Record<StructureKind, readonly string[]>>;
  forms: readonly ResponseForm[];
  /** The view that best anchors the concept, for the prompt (e.g. 3.NF.A.2 → line). */
  anchor?: string;
}

export const REPRESENTATIONS: Readonly<Record<string, Representation>> = {
  '1.G.A.3': { structures: { fraction: ['rect', 'circle'] }, forms: ['shade', 'choose', 'tap'], anchor: 'fraction rect' },
  '2.G.A.2': { structures: { rect_area: ['unit_squares'], array: ['dots'] }, forms: ['number', 'choose'], anchor: 'rect_area unit_squares' },
  '2.G.A.3': { structures: { fraction: ['rect', 'circle', 'strip'] }, forms: ['shade', 'choose', 'tap'], anchor: 'fraction circle' },
  '2.OA.C.4': { structures: { array: ['dots', 'objects', 'none'], equal_groups: ['objects', 'jumps', 'none'] }, forms: ['number', 'choose'], anchor: 'array dots' },
  '3.OA.A.1': { structures: { equal_groups: ['objects', 'jumps', 'none'], array: ['dots', 'objects', 'none'] }, forms: ['number', 'choose', 'tap'], anchor: 'equal_groups objects' },
  '3.OA.A.2': { structures: { equal_groups: ['objects', 'jumps', 'none'], array: ['dots', 'none'] }, forms: ['number', 'choose'], anchor: 'equal_groups jumps' },
  '3.OA.A.3': { structures: { equal_groups: ['objects', 'jumps', 'none'], array: ['dots', 'objects', 'none'] }, forms: ['number', 'choose'], anchor: 'equal_groups none' },
  '3.OA.A.4': { structures: { equal_groups: ['jumps', 'none'], array: ['dots', 'none'] }, forms: ['number', 'choose'], anchor: 'array none' },
  '3.OA.D.8': { structures: { equal_groups: ['objects', 'none'], array: ['none'] }, forms: ['number', 'choose'], anchor: 'equal_groups none' },
  '3.MD.C.5': { structures: { rect_area: ['unit_squares'] }, forms: ['number', 'choose'], anchor: 'rect_area unit_squares' },
  '3.MD.C.6': { structures: { rect_area: ['unit_squares'] }, forms: ['number', 'choose'], anchor: 'rect_area unit_squares' },
  '3.MD.C.7': { structures: { rect_area: ['unit_squares', 'labeled', 'none'], array: ['dots'] }, forms: ['number', 'choose'], anchor: 'rect_area labeled' },
  '3.MD.D.8': { structures: { rect_area: ['unit_squares', 'labeled', 'none'] }, forms: ['number', 'choose'], anchor: 'rect_area labeled' },
  '3.NF.A.1': { structures: { fraction: ['rect', 'circle', 'strip', 'set', 'none'] }, forms: ['fraction', 'choose', 'shade', 'tap'], anchor: 'fraction strip' },
  '3.NF.A.2': { structures: { fraction: ['line'] }, forms: ['place', 'fraction', 'choose'], anchor: 'fraction line' },
  '3.NF.A.3': { structures: { fraction: ['rect', 'circle', 'strip', 'line', 'none'] }, forms: ['choose', 'select', 'order', 'fraction', 'number', 'tap'], anchor: 'fraction strip' },
  '3.G.A.2': { structures: { fraction: ['rect', 'strip'] }, forms: ['shade', 'fraction', 'choose'], anchor: 'fraction rect' },
  '4.MD.A.3': { structures: { rect_area: ['labeled', 'none'] }, forms: ['number', 'choose'], anchor: 'rect_area labeled' },
  '4.NF.A.1': { structures: { fraction: ['rect', 'strip', 'none'] }, forms: ['fraction', 'choose', 'select'], anchor: 'fraction strip' },
  '4.NF.A.2': { structures: { fraction: ['rect', 'circle', 'strip', 'none'] }, forms: ['choose', 'order', 'select'], anchor: 'fraction strip' },
  '5.NF.B.4': { structures: { fraction: ['rect'], rect_area: ['labeled'] }, forms: ['shade', 'number', 'fraction', 'choose'], anchor: 'rect_area labeled' },
  '6.G.A.1': { structures: { rect_area: ['labeled', 'none'] }, forms: ['number', 'choose'], anchor: 'rect_area labeled' },
};
export const isRepresented = (skillId: string) => Object.hasOwn(REPRESENTATIONS, skillId);

/** Problems with an activity's choice of intents, views and form for its first skill. */
export function representationIssues(skillId: string, structures: readonly { kind: string; show: string | null }[], form: ResponseForm): { code: string; message: string }[] {
  if (!isRepresented(skillId)) return [{ code: 'skill_unrepresented', message: `${skillId} has no representation set in this slice.` }];
  const rep = REPRESENTATIONS[skillId]!;
  const out: { code: string; message: string }[] = [];
  for (const s of structures) {
    const views = rep.structures[s.kind as StructureKind];
    const view = s.show ?? 'none';
    if (!views) out.push({ code: 'representation', message: `${skillId} is not practised with ${s.kind}; use ${Object.keys(rep.structures).join(' or ')}.` });
    else if (!views.includes(view)) out.push({ code: 'representation', message: `${skillId} shows ${s.kind} as ${views.join(', ')}, not ${view}.` });
  }
  if (!rep.forms.includes(form)) out.push({ code: 'representation', message: `${skillId} is practised by ${rep.forms.join(', ')}, not ${form}.` });
  return out;
}
