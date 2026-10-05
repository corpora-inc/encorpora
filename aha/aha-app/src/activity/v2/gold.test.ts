import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { correctResponseFor, gradeResponse } from '../grade';
import { drawingProblems } from '../draw';
import { gold } from './gold';
import { checkGold, goldResolved } from './gold/resolved';
import { STRUCTURES } from './structures';
import { BAND_IDS, RESPONSE_FORMS, bandOf, gradeNum } from './registry';
import { REPRESENTATIONS } from './representations';
import { getSkill } from '../../learning/curriculum';

describe('gold set', () => {
  it('has at least 40 specs, every structure × view, every response form, every band and every live failure', () => {
    assert.ok(gold.length >= 40, `${gold.length} gold specs`);
    const views = new Set(gold.flatMap(g => g.activity.model.structures.flatMap(s => s.show ? [`${s.kind}.${String(s.show)}`] : [])));
    for (const [kind, def] of Object.entries(STRUCTURES)) for (const view of Object.keys(def.views)) assert.ok(views.has(`${kind}.${view}`), `no gold spec draws ${kind}.${view}`);
    const forms = new Set(gold.map(g => g.activity.response.form));
    for (const f of RESPONSE_FORMS) assert.ok(forms.has(f), `no gold spec answers by ${f}`);
    const bands = new Set(gold.map(g => bandOf(gradeNum(getSkill(g.activity.aim.skills[0]!)!.grade))));
    // Every band some represented skill falls in (6–8 has none in the first slice; representations.ts).
    for (const b of BAND_IDS) if (Object.keys(REPRESENTATIONS).some(id => bandOf(gradeNum(getSkill(id)!.grade)) === b)) assert.ok(bands.has(b), `no gold spec in band ${b}`);
    assert.deepEqual([...new Set(gold.flatMap(g => g.fixes ? [g.fixes] : []))].sort(), ['live-1', 'live-2', 'live-3', 'live-4']);
    // Every act form a view hosts, except a tap inside one view: in this slice every such view has
    // equal regions, so it is always ill-posed (the mutation corpus holds that it is rejected).
    for (const [kind, def] of Object.entries(STRUCTURES)) for (const [view, v] of Object.entries(def.views)) for (const form of v.accepts) {
      if (form === 'tap') continue;
      assert.ok(gold.some(g => g.activity.response.form === form && 'on' in g.activity.response && g.activity.model.structures.some(s => s.id === (g.activity.response as { on: string }).on && s.kind === kind && s.show === view)), `no gold spec ${form}s on ${kind}.${view}`);
    }
  });
  it('has unique, well-formed ids', () => {
    const ids = gold.map(g => g.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^g[1-8K]-[a-z0-9-]+$/, id);
  });
  for (const g of gold) {
    it(`${g.id}: validates, computes the hand key, renders the expected text and alt`, () => {
      const v = checkGold(g);
      assert.ok(v.ok, `${g.id}: ${JSON.stringify(!v.ok && v.problems)}`);
      const c = v.activity;
      assert.equal(c.response.key, g.expect.key, `${g.id}: key`);
      assert.deepEqual(c.rendered.prompt.flatMap(b => b.type === 'text' ? [b.text] : []), g.expect.prompt, `${g.id}: prompt text`);
      const resolved = goldResolved().find(r => r.id === g.id)!;
      if (g.expect.alt !== undefined) assert.equal(resolved.figures?.[0]?.alt, g.expect.alt, `${g.id}: alt`);
      for (const f of resolved.figures ?? []) {
        assert.deepEqual(drawingProblems(f), [], `${g.id}/${f.id}: drawing`);
        assert.ok(f.alt.length > 0 && f.alt.length <= 400, `${g.id}/${f.id}: alt length`);
      }
      const graded = gradeResponse(resolved.response, correctResponseFor(resolved.response), g.id);
      assert.equal(graded.correct, true, `${g.id}: the correct response grades correct`);
    });
  }
});
