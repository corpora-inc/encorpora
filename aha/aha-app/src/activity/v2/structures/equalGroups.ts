/**
 * `equal_groups`: `groups` groups of `size` each. Multiplication as equal groups and division as
 * sharing or grouping (2.OA.C.4, 3.OA.A.1–4). Its total is the product, computed by the app, so the
 * text, the picture, the key and the alt cannot disagree (live failure 1).
 */
import type { StructureDef } from '../registry';
import { issue } from '../registry';
import { n, product, req, within } from './common';

type R = 'groups' | 'size';
const MAX_BY_GRADE: Record<number, number> = { 2: 5, 3: 10, 4: 12 };

export const equalGroups: StructureDef<'equal_groups', R, 'objects' | 'jumps'> = {
  kind: 'equal_groups',
  grades: [2, 4],
  roles: { groups: { kinds: ['count'] }, size: { kinds: ['count'] } },
  measures: {
    total: {
      kind: 'count', inputs: ['groups', 'size'], means: 'groups × size',
      value: r => product(req(r, 'groups').value, req(r, 'size').value),
      noun: r => req(r, 'size').decl.noun,
    },
  },
  primary: 'total',
  invariants(r, grade) {
    const max = MAX_BY_GRADE[grade] ?? 12;
    const out = [...within(r.groups, 'groups', 2, max, `in grade ${grade}`), ...within(r.size, 'size', 1, max, `in grade ${grade}`)];
    if (r.groups && r.size && r.groups.id === r.size.id) out.push(issue('role_reused', 'groups and size must be different quantities.'));
    return out;
  },
  views: {
    objects: {
      grades: [2, 4], accepts: ['tap'], draws: 'a picture: each group drawn with its objects (all countable)',
      noun: () => 'picture', words: ['picture'],
      reveals: () => ({ groups: 'countable', size: 'countable', total: 'countable' }),
      // Every group has the same size, so a tap on one group is always ill-posed; uniqueness rejects it.
      regions: r => Array.from({ length: n(r.groups) }, (_, i) => ({ id: `g${i + 1}`, value: req(r, 'size').value, label: `Group ${i + 1}` })),
      lower(r) {
        const size = req(r, 'size'), groups = req(r, 'groups');
        const noun = size.decl.noun;
        return {
          type: 'picture', layout: n(groups) > 4 ? 'column' : 'row',
          groups: [{
            icon: noun?.icon ?? noun?.one.toLowerCase().replace(/[^a-z]+/g, '_') ?? 'counter', count: n(size), repeat: n(groups),
            arrangement: n(size) > 5 ? 'grid' : 'row', ...(groups.decl.noun ? { label: groups.decl.noun.one } : {}),
          }],
        };
      },
    },
    jumps: {
      grades: [2, 4], accepts: [], draws: 'a number line from 0 with one jump per group (the landing point is printed)',
      noun: () => 'number line', words: ['number line'],
      reveals: (_r, asked) => ({ groups: 'countable', size: asked.has('size') ? 'countable' : 'shown', total: 'shown' }),
      lower(r, { asked }) {
        const g = n(r.groups), s = n(r.size), total = g * s;
        const sizeAsked = asked.has('size');
        // Labels sit on the landing points (every size); when the size is asked, only the two ends are
        // labeled, so the size stays countable on the ticks but is never printed.
        return {
          type: 'number_line', min: 0, max: total, step: 1, labelEvery: sizeAsked ? total : s,
          jumps: Array.from({ length: g }, (_, k) => ({ from: k * s, to: (k + 1) * s, ...(sizeAsked ? {} : { label: `+${s}` }) })),
        };
      },
    },
  },
  use: 'multiplication as equal groups, or division as sharing/grouping (ask a role whose quantity is derived, e.g. size = t/g)',
};

