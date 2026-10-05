import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { correctResponseFor, gradeResponse } from '../grade';
import { drawingProblems } from '../draw';
import { gold } from './gold';
import { checkGold, goldResolved } from './gold/resolved';

describe('gold set', () => {
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
