import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSkill } from '../../learning/curriculum';
import { bandOf, gradeNum } from './registry';
import { validateActivity } from './validate';
import { gold } from './gold';
import { MUTATION_CLASSES } from './gold/mutations';
import { translatedInconsistent } from './gold/inconsistent';

describe('mutation corpus (README §12.2)', () => {
  const rows: { cls: string; total: number; rejected: number; layers: Record<string, number>; survivors: string[] }[] = [];
  for (const cls of MUTATION_CLASSES) {
    const row = { cls: cls.id, total: 0, rejected: 0, layers: {} as Record<string, number>, survivors: [] as string[] };
    for (const g of gold) {
      for (const mutant of cls.mutate(g.activity, g)) {
        const band = mutant.band ?? bandOf(gradeNum(getSkill(g.activity.aim.skills[0]!)!.grade));
        const v = validateActivity(mutant.activity, { band, skillIds: new Set(g.activity.aim.skills) });
        row.total++;
        if (v.ok) row.survivors.push(`${g.id}: ${mutant.why}`);
        else if (!v.problems.some(p => cls.expects.includes(p.code))) row.survivors.push(`${g.id}: ${mutant.why} (rejected, but not for this defect: ${v.problems.map(p => p.code).join(', ')})`);
        else { row.rejected++; const layer = v.problems[0]!.layer; row.layers[layer] = (row.layers[layer] ?? 0) + 1; }
      }
    }
    rows.push(row);
  }
  it('every class applies to the gold set', () => {
    for (const r of rows) assert.ok(r.total > 0, `${r.cls} produced no mutants`);
  });
  it('rejects at least 99% of all mutants for the defect they carry, and reports every survivor', () => {
    const total = rows.reduce((n, r) => n + r.total, 0), rejected = rows.reduce((n, r) => n + r.rejected, 0);
    console.log(`mutation corpus: ${rejected}/${total} rejected (${(100 * rejected / total).toFixed(1)}%)\n${rows.map(r => `  ${r.cls.padEnd(18)} ${r.rejected}/${r.total} ${JSON.stringify(r.layers)}`).join('\n')}`);
    assert.ok(total >= 200, `${total} mutants`);
    assert.ok(rejected / total >= 0.99, `survivors: ${rows.flatMap(r => r.survivors).join('; ')}`);
    assert.deepEqual(rows.flatMap(r => r.survivors), [], 'no defective mutant is accepted');
  });
});

describe('the v1 consistency-lint corpus, translated to v2', () => {
  for (const c of translatedInconsistent) {
    it(`${c.v1} (${c.rule}): ${c.outcome}`, () => {
      if (c.outcome === 'out_of_slice') { assert.ok(c.step && c.step >= 8, 'names the plan step that adds its intent'); return; }
      const a = c.attempt as { aim: { skills: string[] } };
      const v = validateActivity(a, { band: bandOf(gradeNum(getSkill(a.aim.skills[0]!)!.grade)), skillIds: new Set(a.aim.skills) });
      assert.ok(!v.ok, `${c.v1}: the attempt must be rejected`);
      assert.ok(v.problems.some(p => p.code === c.code), `${c.v1}: expected ${c.code}, got ${v.problems.map(p => p.code).join(', ')}`);
      if (c.outcome === 'inexpressible') assert.ok(v.problems.every(p => p.layer === 'L0'), `${c.v1}: inexpressible means the schema itself refuses it`);
    });
  }
});
