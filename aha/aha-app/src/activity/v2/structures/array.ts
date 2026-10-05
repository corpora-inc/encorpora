/**
 * `array`: `rows` rows of `cols` objects. Arrays for repeated addition and multiplication
 * (2.OA.C.4, 3.OA.A.1, 3.OA.A.3). `cols` counts the objects in each row, so the total is counted in
 * its noun ("12 chairs").
 */
import type { StructureDef } from '../registry';
import { issue } from '../registry';
import { n, product, req, within } from './common';

type R = 'cols' | 'rows';
const MAX_BY_GRADE: Record<number, number> = { 2: 5, 3: 10, 4: 12 };
const iconOf = (noun: { icon: string | null; one: string } | null) => noun?.icon ?? noun?.one.toLowerCase().replace(/[^a-z]+/g, '_');

export const array: StructureDef<'array', R, 'dots' | 'objects'> = {
  kind: 'array',
  grades: [2, 4],
  roles: { cols: { kinds: ['count'] }, rows: { kinds: ['count'] } },
  measures: {
    total: {
      kind: 'count', inputs: ['cols', 'rows'], means: 'rows × cols',
      value: r => product(req(r, 'rows').value, req(r, 'cols').value),
      noun: r => req(r, 'cols').decl.noun,
    },
  },
  primary: 'total',
  invariants(r, grade) {
    const max = MAX_BY_GRADE[grade] ?? 12;
    const out = [...within(r.rows, 'rows', 1, max, `in grade ${grade}`), ...within(r.cols, 'cols', 1, max, `in grade ${grade}`)];
    if (r.rows && r.cols && r.rows.id === r.cols.id) out.push(issue('role_reused', 'rows and cols must be different quantities (cols counts the objects in each row).'));
    if (r.rows && r.cols && n(r.rows) * n(r.cols) < 2) out.push(issue('magnitude', 'An array needs at least 2 objects.'));
    return out;
  },
  views: {
    dots: {
      grades: [2, 4], accepts: ['tap'], draws: 'rows of dots (rows, cols and total countable)',
      noun: () => 'array',
      reveals: () => ({ cols: 'countable', rows: 'countable', total: 'countable' }),
      // Every row holds the same number, so a tap on one row is always ill-posed; uniqueness rejects it.
      regions: r => Array.from({ length: n(r.rows) }, (_, i) => ({ id: `row${i + 1}`, value: req(r, 'cols').value, label: `Row ${i + 1}` })),
      lower: r => ({ type: 'array_grid', rows: n(r.rows), cols: n(r.cols), style: 'dots' }),
    },
    objects: {
      grades: [2, 4], accepts: ['tap'], draws: 'rows of the objects (rows, cols and total countable)',
      noun: () => 'array',
      reveals: () => ({ cols: 'countable', rows: 'countable', total: 'countable' }),
      regions: r => Array.from({ length: n(r.rows) }, (_, i) => ({ id: `row${i + 1}`, value: req(r, 'cols').value, label: `Row ${i + 1}` })),
      lower: r => {
        const icon = iconOf(req(r, 'cols').decl.noun);
        return { type: 'array_grid', rows: n(r.rows), cols: n(r.cols), ...(icon ? { style: 'icons' as const, icon } : { style: 'dots' as const }) };
      },
    },
  },
  use: 'an array of rows and columns: multiplication and repeated addition',
};
