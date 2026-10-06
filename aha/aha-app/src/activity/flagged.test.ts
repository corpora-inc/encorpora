import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { skills } from '../learning/curriculum';
import { authoringErrors, validateActivitySpec, type ActivitySpec } from './spec';

/**
 * Regression fixtures: the four gpt-4o activities the founder flagged on 2026-10-06 (verbatim, model-authored, no
 * personal data). Each asks the learner to count the square units of a bare rectangle that shows neither unit squares
 * nor side labels. The authoring rule (#929) is a figure-data check: the keyCheck uses both side lengths of a drawn
 * rectangle, and the figure shows neither unitSquares/grid nor labels for both.
 */
const FLAGGED: ActivitySpec[] = [
  {"version": 1, "id": "activity-measure-area", "title": "Counting Square Units", "skillIds": ["3.MD.C.6"], "difficulty": 4, "prompt": [{"type": "text", "text": "How many square units are in the figure below?"}, {"type": "figure", "figureId": "rect-15-units"}], "figures": [{"type": "geometry", "id": "rect-15-units", "alt": "A rectangle with 3 rows and 5 columns of squares, covering the entire shape.", "width": 5, "height": 3, "shapes": [{"kind": "polygon", "points": [{"x": 0, "y": 0}, {"x": 5, "y": 0}, {"x": 5, "y": 3}, {"x": 0, "y": 3}], "color": "plain"}]}], "response": {"type": "numeric", "answer": 15, "unit": "square units", "misconceptionAnswers": [{"answer": 8, "tag": "half_area_counted"}, {"answer": 10, "tag": "wrong_row_col"}]}, "hints": ["Count the number of squares in each row and multiply by rows."], "explanation": "There are 3 rows and 5 columns, so $3\\times5=15$ square units.", "misconceptions": [{"tag": "half_area_counted", "description": "Only counted either rows or columns."}, {"tag": "wrong_row_col", "description": "Confusion between rows and columns count."}], "keyCheck": {"value": "3*5"}},
  {"version": 1, "id": "square-units-area", "skillIds": ["3.MD.C.6"], "difficulty": 3, "prompt": [{"type": "text", "text": "Count the number of square units used to cover the rectangle below."}, {"type": "figure", "figureId": "rect-square-units"}], "figures": [{"type": "geometry", "id": "rect-square-units", "alt": "A rectangle made up of 2 rows and 4 columns of unit squares.", "width": 4, "height": 2, "shapes": [{"kind": "polygon", "points": [{"x": 0, "y": 0}, {"x": 4, "y": 0}, {"x": 4, "y": 2}, {"x": 0, "y": 2}], "color": "plain", "dashed": false}, {"kind": "ticks", "from": {"x": 0, "y": 0}, "to": {"x": 4, "y": 0}, "count": 3}, {"kind": "ticks", "from": {"x": 0, "y": 0}, "to": {"x": 0, "y": 2}, "count": 1}], "notToScale": false}], "response": {"type": "numeric", "answer": 8}, "hints": ["Count the number of squares across and down.", "Multiply the number of squares in a row by the number of rows."], "explanation": "There are 4 squares across and 2 rows down, making $4 \\times 2 = 8$ squares.", "keyCheck": {"value": "2*4"}},
  {"version": 1, "id": "area-with-squares", "skillIds": ["3.MD.C.6"], "difficulty": 3, "prompt": [{"type": "text", "text": "Count the number of square units to find the area."}, {"type": "figure", "figureId": "area_figure"}], "figures": [{"type": "geometry", "id": "area_figure", "alt": "A rectangle with a grid, 4 squares along its width and 3 along its length.", "width": 4, "height": 3, "shapes": [{"kind": "polygon", "points": [{"x": 0, "y": 0}, {"x": 4, "y": 0}, {"x": 4, "y": 3}, {"x": 0, "y": 3}], "dashed": false}]}], "response": {"type": "numeric", "answer": 12, "misconceptionAnswers": [{"answer": 7, "tag": "counted_edges"}, {"answer": 9, "tag": "mistaken_count"}]}, "hints": ["Count the number of squares in one row and multiply by the number of rows."], "explanation": "The area is found by multiplying the rows by the columns: $4 \\times 3 = 12$ square units.", "misconceptions": [{"tag": "counted_edges", "description": "Confused the perimeter with the area by counting sides instead of squares."}, {"tag": "mistaken_count", "description": "Miscalculated the number of squares."}], "keyCheck": {"value": "4*3"}},
  {"version": 1, "id": "area-counting", "title": "Measure Area in Square Units", "skillIds": ["3.MD.C.6"], "difficulty": 3, "prompt": [{"type": "text", "text": "Count the square units inside the rectangle."}, {"type": "figure", "figureId": "figure-area"}], "figures": [{"type": "geometry", "id": "figure-area", "alt": "A rectangle on a grid with 4 rows and 5 columns of squares filled, making a total of 20 squares.", "width": 6, "height": 5, "shapes": [{"kind": "polygon", "points": [{"x": 0, "y": 0}, {"x": 5, "y": 0}, {"x": 5, "y": 4}, {"x": 0, "y": 4}], "color": "plain"}]}], "response": {"type": "numeric", "answer": 20, "label": "square units", "misconceptionAnswers": [{"answer": 9, "tag": "counted_only_one_axis"}, {"answer": 24, "tag": "included_outside_edges"}]}, "hints": ["Count the squares in one row, then multiply by the number of rows."], "explanation": "There are 4 rows and 5 squares per row: $4 \\times 5 = 20$ square units.", "misconceptions": [{"tag": "counted_only_one_axis", "description": "Remember to count squares in one row and multiply by the number of rows."}, {"tag": "included_outside_edges", "description": "Be sure to count only the filled square units and not beyond the rectangular area."}], "keyCheck": {"value": "4*5"}}
] as ActivitySpec[];
const skillIds = new Set(skills.map(s => s.id));

describe('authoring rule: never ask about a rectangle that is not drawn (founder flags, 2026-10-06)', () => {
  it('rejects all four flagged activities for new batches, and still restores them as stored evidence', () => {
    for (const spec of FLAGGED) {
      assert.equal(validateActivitySpec(spec, { skillIds }).ok, true, `${spec.id} restores under the stored-evidence rules`);
      const fresh = validateActivitySpec(spec, { skillIds, authoring: true });
      assert.equal(fresh.ok, false, spec.id);
      if (!fresh.ok) assert.match(fresh.errors.join(' | '), /neither unit squares .* nor labels for both lengths/, spec.id);
    }
  });
  it('accepts the same activities once the figure shows what is counted: unit squares, graph paper, or both lengths labelled', () => {
    for (const spec of FLAGGED) {
      const geo = (s: any) => s.figures.find((f: any) => f.type === 'geometry');
      const squares: any = structuredClone(spec); geo(squares).shapes[0].unitSquares = true;
      assert.deepEqual(authoringErrors(squares), [], `${spec.id} with unitSquares`);
      const grid: any = structuredClone(spec); geo(grid).grid = { unit: 1 };
      assert.deepEqual(authoringErrors(grid), [], `${spec.id} with graph paper`);
      const labelled: any = structuredClone(spec);
      const [a, b, c] = geo(labelled).shapes[0].points;
      geo(labelled).shapes.push({ kind: 'dimension', from: a, to: b, label: `${Math.abs(b.x - a.x)} units` }, { kind: 'dimension', from: b, to: c, label: `${Math.abs(c.y - b.y)} units` });
      assert.deepEqual(authoringErrors(labelled), [], `${spec.id} with both sides labelled`);
      const one: any = structuredClone(spec);
      geo(one).shapes.push({ kind: 'dimension', from: a, to: b, label: `${Math.abs(b.x - a.x)} units` });
      assert.equal(authoringErrors(one).length, 1, `${spec.id} with only one side labelled`);
    }
  });
  it('only checks rectangles whose sides the key uses', () => {
    const other: any = structuredClone(FLAGGED[0]);
    other.keyCheck = { value: '7+8' };
    assert.deepEqual(authoringErrors(other), []);
  });
});
