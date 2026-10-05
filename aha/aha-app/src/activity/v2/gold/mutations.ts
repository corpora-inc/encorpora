/**
 * The mutation corpus (README §12.2): classes of defects, each a generator that turns a gold spec into
 * mutants that are DEFECTIVE BY CONSTRUCTION. A class never emits a mutant that is merely different
 * (swapping a rectangle's width and height, or an equal-groups structure's groups and size, changes
 * nothing a learner sees, because the prose names roles), so every mutant must be rejected. The test
 * requires at least 99% and reports every survivor.
 */
import { getSkill } from '../../../learning/curriculum';
import { BANDS, bandOf, gradeNum, inRange, isAnswerForm } from '../registry';
import { STRUCTURES } from '../structures';
import { REPRESENTATIONS } from '../representations';
import type { WireActivity, WireQuantity } from '../wire';
import type { GoldSpec } from './types';

export interface Mutant { why: string; activity: unknown; band?: 'k2' | 'g35' | 'g68' }
export interface MutationClass {
  id: 'swap_role' | 'wrong_measure' | 'equal_region_tap' | 'off_band_view' | 'numeral_in_prose'
    | 'hidden_dimensions' | 'named_answer' | 'view_word' | 'unbound_view' | 'kind_mismatch';
  /** The codes that state this defect: every mutant must be rejected with one of them. */
  expects: readonly string[];
  mutate(activity: WireActivity, spec: GoldSpec): Mutant[];
}

const clone = (a: WireActivity) => structuredClone(a);
const gradeOf = (a: WireActivity) => gradeNum(getSkill(a.aim.skills[0]!)!.grade);
const roleIds = (s: WireActivity['model']['structures'][number]) => s.roles as Record<string, string | null>;
const fresh = (a: WireActivity, stem: string) => { let i = 1; while (a.model.quantities.some(q => q.id === `${stem}${i}`)) i++; return `${stem}${i}`; };
const textBlocks = (a: WireActivity) => a.prompt.flatMap((b, i) => b.type === 'text' ? [i] : []);
/** A quantity of a kind the role does not accept: a fraction for a count role, a count for a length role. */
const wrongKind = (id: string, roleKinds: readonly string[]): WireQuantity =>
  roleKinds.includes('count') ? { id, kind: 'fraction', noun: null, unit: null, value: '1/2' } : { id, kind: 'count', noun: null, unit: null, value: '3' };

export const MUTATION_CLASSES: MutationClass[] = [
  {
    id: 'swap_role', expects: ['role_kind', 'magnitude'],
    mutate(a) {
      const out: Mutant[] = [];
      a.model.structures.forEach((s, si) => {
        const def = STRUCTURES[s.kind];
        for (const [role, spec] of Object.entries(def.roles)) {
          if (!roleIds(s)[role]) continue;
          const m = clone(a), id = fresh(m, 'x');
          m.model.quantities.push(wrongKind(id, spec.kinds));
          roleIds(m.model.structures[si]!)[role] = id;
          out.push({ why: `${s.id}.${role} bound to a ${m.model.quantities.at(-1)!.kind}`, activity: m });
        }
        // Parts and selected swapped: the model now selects more parts than it has.
        const r = roleIds(s);
        if (s.kind === 'fraction' && r.selected && r.parts) {
          const sel = a.model.quantities.find(q => q.id === r.selected)!, parts = a.model.quantities.find(q => q.id === r.parts)!;
          if (Number(sel.value) < Number(parts.value)) {
            const m = clone(a);
            roleIds(m.model.structures[si]!).parts = r.selected; roleIds(m.model.structures[si]!).selected = r.parts;
            out.push({ why: `${s.id}: parts and selected swapped`, activity: m });
          }
        }
      });
      return out;
    },
  },
  {
    id: 'wrong_measure', expects: ['ref_member', 'measure_unavailable'],
    mutate(a) {
      if (!('ask' in a.response) || !isAnswerForm(a.response.form)) return [];
      const out: Mutant[] = [];
      for (const s of a.model.structures) {
        const m = clone(a);
        (m.response as { ask: string }).ask = `${s.id}.volume`;
        out.push({ why: `ask ${s.id}.volume, which ${s.kind} does not have`, activity: m });
        if (s.kind === 'fraction' && !roleIds(s).selected) {
          const m2 = clone(a);
          (m2.response as { ask: string }).ask = `${s.id}.fraction`;
          out.push({ why: `ask ${s.id}.fraction with nothing selected`, activity: m2 });
        }
      }
      return out;
    },
  },
  {
    id: 'equal_region_tap', expects: ['tap_ambiguous'],
    mutate(a) {
      const out: Mutant[] = [];
      // Only where the skill is practised by tapping, so the mutant's one defect is the ill-posed tap.
      if (!REPRESENTATIONS[a.aim.skills[0]!]?.forms.includes('tap')) return [];
      // One view only, so the mutant's one defect is the tap itself.
      if (a.prompt.filter(b => b.type === 'view').length !== 1) return [];
      for (const s of a.model.structures) {
        const view = s.show ? STRUCTURES[s.kind].views[s.show as never] as { accepts: readonly string[] } | undefined : undefined;
        if (!view?.accepts.includes('tap') || !a.prompt.some(b => b.type === 'view' && b.of === s.id)) continue;
        // Ask for the value every region has: one group's size, one row's count, one part's fraction.
        const target = s.kind === 'equal_groups' ? `${s.id}.size` : s.kind === 'array' ? `${s.id}.cols` : `${s.id}.unit`;
        const m = clone(a);
        const first = textBlocks(m)[0] ?? 0;
        m.prompt[first] = { text: `Tap the part that is {{${target}${gradeOf(a) <= 2 ? '.word' : ''}}}.`, type: 'text' };
        m.response = { ask: target, form: 'tap', on: s.id };
        m.support.hints = [];
        out.push({ why: `tap one of ${s.id}'s equal regions`, activity: m });
      }
      return out;
    },
  },
  {
    id: 'off_band_view', expects: ['schema', 'off_band', 'off_grade', 'representation'],
    mutate(a) {
      const out: Mutant[] = [];
      const grade = gradeOf(a), band = bandOf(grade);
      a.model.structures.forEach((s, si) => {
        for (const [view, v] of Object.entries(STRUCTURES[s.kind].views)) {
          if (inRange(grade, (v as { grades: readonly [number, number] }).grades)) continue;
          const m = clone(a);
          (m.model.structures[si] as { show: string | null }).show = view;
          if (!m.prompt.some(b => b.type === 'view' && b.of === s.id)) m.prompt.push({ of: s.id, type: 'view' });
          out.push({ why: `${s.id} shown as ${view}, outside grade ${grade}`, activity: m });
        }
      });
      // The same activity sent in another band's request.
      for (const other of (['k2', 'g35', 'g68'] as const).filter(b => b !== band)) out.push({ why: `sent as a ${other} activity (grades ${BANDS[other].join('–')})`, activity: clone(a), band: other });
      return out;
    },
  },
  {
    id: 'numeral_in_prose', expects: ['numeral'],
    mutate(a) {
      for (const i of textBlocks(a)) {
        const b = a.prompt[i] as { text: string };
        const ph = /\{\{[^}]+\}\}/.exec(b.text);
        if (!ph) continue;
        const m = clone(a);
        (m.prompt[i] as { text: string }).text = b.text.replace(ph[0], '7');
        return [{ why: `prompt states the number 7 instead of ${ph[0]}`, activity: m }];
      }
      const m = clone(a);
      (m.prompt[textBlocks(m)[0]!] as { text: string }).text += ' There are 3 more.';
      return [{ why: 'prompt adds a number of its own', activity: m }];
    },
  },
  {
    id: 'hidden_dimensions', expects: ['ask_unanswerable'],
    mutate(a) {
      if (!('ask' in a.response) || !isAnswerForm(a.response.form)) return [];
      const [sid, member] = a.response.ask.split('.');
      const s = a.model.structures.find(x => x.id === sid);
      if (!s || !member || !Object.hasOwn(STRUCTURES[s.kind].measures, member)) return [];
      // Only where the skill may tell this structure in words, so the one defect is the hidden inputs.
      if (!REPRESENTATIONS[a.aim.skills[0]!]?.structures[s.kind]?.includes('none')) return [];
      // The structure's view goes away, and so does every mention of its roles: nothing reveals the inputs.
      const m = clone(a);
      (m.model.structures.find(x => x.id === sid) as { show: string | null }).show = null;
      m.prompt = m.prompt.filter(b => !(b.type === 'view' && b.of === sid)).map(b => {
        if (b.type !== 'text') return b;
        return { ...b, text: b.text.replace(new RegExp(`\\{\\{${sid}\\.(?!${member}\\b)[a-z]+(\\.[a-z]+)?\\}\\}`, 'g'), 'some').replace(/\{\{[a-z0-9]+\.view\}\}/g, 'shape') };
      });
      if (!m.prompt.some(b => b.type === 'text')) m.prompt.push({ text: `What is the ${member}?`, type: 'text' });
      m.support = { explanation: `It is {{${sid}.${member}${gradeOf(a) <= 2 ? '.word' : ''}}}.`, hints: [] };
      return [{ why: `${sid}.${member} asked with ${sid}'s inputs hidden`, activity: m }];
    },
  },
  {
    id: 'named_answer', expects: ['answer_in_text'],
    mutate(a) {
      if (!('ask' in a.response) || !isAnswerForm(a.response.form)) return [];
      const m = clone(a);
      m.prompt.push({ text: `The answer is {{${a.response.ask}}}.`, type: 'text' });
      return [{ why: 'the prompt names the answer', activity: m }];
    },
  },
  {
    id: 'view_word', expects: ['view_word'],
    mutate(a) {
      const out: Mutant[] = [];
      for (const i of textBlocks(a)) {
        const b = a.prompt[i] as { text: string };
        const ph = /\{\{([a-z0-9]+)\.view\}\}/.exec(b.text);
        if (!ph) continue;
        const m = clone(a);
        (m.prompt[i] as { text: string }).text = b.text.replace(ph[0], 'rectangle');
        out.push({ why: `the prose names "rectangle" instead of {{${ph[1]}.view}}`, activity: m });
      }
      if (!out.length) {
        const m = clone(a);
        (m.prompt[textBlocks(m)[0]!] as { text: string }).text += ' Look at the picture.';
        out.push({ why: 'the prose names a figure', activity: m });
      }
      return out;
    },
  },
  {
    id: 'unbound_view', expects: ['view_unshown', 'view_none', 'tap_views'],
    mutate(a) {
      const out: Mutant[] = [];
      for (const s of a.model.structures) {
        const shown = a.prompt.some(b => b.type === 'view' && b.of === s.id);
        const m = clone(a);
        if (shown) m.prompt = m.prompt.filter(b => !(b.type === 'view' && b.of === s.id));
        else m.prompt.push({ of: s.id, type: 'view' });
        out.push({ why: shown ? `${s.id} has a view that is never shown` : `${s.id} has no view but a view block shows it`, activity: m });
      }
      return out;
    },
  },
  {
    id: 'kind_mismatch', expects: ['role_kind'],
    mutate(a) {
      const out: Mutant[] = [];
      const bound = new Set(a.model.structures.flatMap(s => Object.values(roleIds(s)).filter((x): x is string => !!x)));
      a.model.quantities.forEach((q, qi) => {
        if (!bound.has(q.id) || q.value.match(/[a-z]/)) return;
        const m = clone(a);
        const target = m.model.quantities[qi]!;
        if (q.kind === 'length') { target.kind = 'count'; target.unit = null; }
        else { target.kind = 'length'; target.unit = 'cm'; target.noun = null; }
        out.push({ why: `${q.id} declared a ${target.kind} but bound to a role that takes a ${q.kind}`, activity: m });
      });
      return out;
    },
  },
];
