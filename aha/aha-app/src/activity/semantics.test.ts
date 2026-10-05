import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fixtures } from './fixtures';
import { inconsistentFixtures, liveAppleGroups } from './fixtures/inconsistent';
import { consistencyErrors, consistencyIssues, describeFigure, figureAlt, figureQuantities, FIGURE_MODELS, plural, singular, statesAnswer, structureClaims, tokenize, richToPlain } from './semantics';
import { FigureSchema, validateActivityBatch, validateActivitySpec, type ActivitySpec, type Figure } from './spec';
import { skills } from '../learning/curriculum';

const graph = new Set(skills.map(s => s.id));
const rules = (spec: ActivitySpec) => consistencyIssues(spec).map(i => i.rule);
const clone = <T,>(x: T): T => structuredClone(x);
const activity = (over: Partial<ActivitySpec>): ActivitySpec => ({ version: 1, id: 'a-test', skillIds: ['3.OA.A.1'], difficulty: 3, prompt: [{ type: 'text', text: 'x' }], response: { type: 'numeric', answer: 1 }, keyCheck: { value: '1' }, explanation: 'e', ...over });

describe('reading the text', () => {
  it('tokenizes digits, number words, fractions, TeX and clock times generically', () => {
    const t = tokenize(richToPlain('Three groups of $\\frac{3}{4}$, twenty-four and 1,200 at 3:30; $5 \\times 6$'));
    assert.deepEqual(t.filter(x => x.k !== 'word' && x.k !== 'mark').map(x => x.k === 'frac' ? `${x.n}/${x.d}` : x.v), [3, '3/4', 24, 1200, '3:30', 5, 6]);
    assert.ok(t.some(x => x.k === 'mark' && x.v === '×'));
  });
  it('singular and plural follow spelling rules, not a word list', () => {
    assert.deepEqual(['apples', 'berries', 'boxes', 'glass', 'bus', 'cats'].map(singular), ['apple', 'berry', 'box', 'glass', 'bus', 'cat']);
    assert.equal(plural('ice_cream', 3), 'ice creams');
    assert.equal(plural('cherry', 2), 'cherries');
    assert.equal(plural('box', 1), 'box');
  });
  it('reads equal-groups structure by pattern, for any noun', () => {
    const claims = (s: string) => structureClaims(tokenize(richToPlain(s))).map(c => [c.groups, c.size, c.ordered]);
    assert.deepEqual(claims('There are 3 groups of 4 apples each.'), [[3, 4, true]]);
    assert.deepEqual(claims('Kofi packs 5 crates of 12 mangoes.'), [[5, 12, true]]);
    assert.deepEqual(claims('She has 3 boxes with 4 crayons each.'), [[3, 4, true]]);
    assert.deepEqual(claims('There are 4 apples in each of 3 baskets.'), [[3, 4, true]]);
    assert.deepEqual(claims('There are 3 plates. Each plate has 4 cookies.'), [[3, 4, true]]);
    assert.deepEqual(claims('Find $6 \\times 7$.'), [[6, 7, false]]);
    assert.deepEqual(claims('a 4-by-6 array'), [[4, 6, false]]);
    // No structure: a single group, a fraction, a change, a part of a whole.
    for (const s of ['Each row is one group of shells.', 'Lena ate $\\frac{3}{4}$ of 8 slices.', '3 out of 8 parts are shaded.', 'Add 2 more rows of 4.', 'one row at a time'])
      assert.deepEqual(claims(s), [], s);
  });
});

describe('figure quantities', () => {
  it('every figure type has an adapter that derives quantities and a description', () => {
    for (const o of FigureSchema.options) assert.equal(typeof FIGURE_MODELS[o.shape.type.value as Figure['type']], 'function', o.shape.type.value);
    for (const spec of fixtures) for (const f of spec.figures ?? []) {
      const q = figureQuantities(f);
      assert.ok(q.say.full.length > 5 && q.say.brief.length > 5, `${spec.id}/${f.type}`);
      assert.deepEqual(q.conflicts, [], `${spec.id}/${f.type}`);
    }
  });
  it('derives structure, totals, values and counts from data', () => {
    const live = figureQuantities(liveAppleGroups.figures![0]!);
    assert.deepEqual(live.structure, { kind: 'groups', sizes: [4, 4], categories: false });
    assert.ok(live.named.apple!.includes(8) && live.named['']!.includes(8));
    const arr = figureQuantities({ type: 'array_grid', id: 'a', alt: 'x', rows: 3, cols: 5, style: 'dots' });
    assert.deepEqual(arr.structure, { kind: 'grid', rows: 3, cols: 5 });
    assert.deepEqual(arr.named.dot, [15]);
    const money = figureQuantities(fixtures.find(f => f.id === 'fx-2-coins')!.figures![0]!);
    assert.deepEqual(money.named.cent, [68]);
    const pv = figureQuantities(fixtures.find(f => f.id === 'fx-1-tens-ones')!.figures![0]!);
    assert.deepEqual(pv.named.number, [47]);
    const pict = figureQuantities(fixtures.find(f => f.id === 'fx-3-pictograph')!.figures![0]!);
    assert.deepEqual(pict.named.book, [24, 24], 'pictograph key scales the total');
    assert.deepEqual(pict.series.find(s => s.label === 'Ana')!.values.slice(0, 2), [8, 4]);
    const pie = figureQuantities(fixtures.find(f => f.id === 'fx-6-pie-tap')!.figures![0]!);
    assert.deepEqual(pie.series.find(s => s.label === 'Blue')!.values, [10, 25, 25], 'value and percent');
  });
  it('reads the structural picture form (a group with repeat) like the enumerated one', () => {
    const repeated = { type: 'picture', id: 'p', alt: 'x', groups: [{ icon: 'apple', count: 4, repeat: 3 }] } as unknown as Figure;
    assert.deepEqual(figureQuantities(repeated).structure, { kind: 'groups', sizes: [4, 4, 4], categories: false });
    assert.equal(describeFigure(repeated), 'Picture: 3 groups of 4 apples.');
    const ok = activity({ prompt: [{ type: 'text', text: 'There are 3 groups of 4 apples.' }, { type: 'figure', figureId: 'p' }], figures: [repeated], response: { type: 'numeric', answer: 12 }, keyCheck: { value: '3*4' } });
    assert.deepEqual(consistencyIssues(ok), []);
    const bad = clone(ok); (bad.figures![0] as unknown as { groups: { repeat: number }[] }).groups[0]!.repeat = 2;
    assert.ok(rules(bad).length && rules(bad).every(r => r === 'structure'), JSON.stringify(consistencyIssues(bad)));
  });
  it('graph paper: a dimension label must match its drawn length, and area/perimeter come from the drawing', () => {
    const grid = (label: string) => ({ type: 'geometry', id: 'g', alt: 'x', width: 8, height: 6, grid: { unit: 1 },
      shapes: [{ kind: 'polygon', points: [{ x: 1, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 1, y: 4 }] }, { kind: 'dimension', from: { x: 1, y: 1 }, to: { x: 6, y: 1 }, label }] }) as unknown as Figure;
    assert.deepEqual(figureQuantities(grid('5 units')).conflicts, []);
    assert.match(figureQuantities(grid('7 units')).conflicts[0]!, /labelled 7 units but spans 5 grid units/);
    assert.deepEqual(figureQuantities(grid('5 units')).named.area, [15]);
    assert.deepEqual(figureQuantities(grid('5 units')).named.perimeter, [16]);
    const area = (answer: number) => activity({ skillIds: ['3.MD.C.6'], prompt: [{ type: 'figure', figureId: 'g' }, { type: 'text', text: 'What is the area of the shape?' }], figures: [grid('5 units')], response: { type: 'numeric', answer }, keyCheck: { value: `${answer}` } });
    assert.deepEqual(rules(area(15)), []);
    assert.deepEqual(rules(area(16)), ['total']);
  });
});

describe('consistency rules: true positives', () => {
  it('rejects the live gpt-4o activity (3 groups of 4 in the text and key, 2 groups drawn)', () => {
    const errors = consistencyErrors(liveAppleGroups);
    assert.ok(errors.length >= 1);
    assert.match(errors[0]!, /^consistency: figure apple-groups \(picture\): the text says 3 groups of 4, but the figure shows 2 groups of 4\.$/);
  });
  for (const { spec, rule, why } of inconsistentFixtures) {
    it(`rejects ${spec.id} (${rule}): ${why}`, () => {
      assert.ok(validateActivitySpec(spec, { skillIds: graph }).ok, `${spec.id} must be structurally valid so only the lint can catch it`);
      assert.ok(rules(spec).includes(rule), `${spec.id}: ${JSON.stringify(consistencyIssues(spec))}`);
    });
  }
  it('the batch validator rejects the live activity with a precise reason, keeps its neighbours, and can be told not to lint', () => {
    const good = fixtures.find(f => f.id === 'fx-3-area-tiles')!;
    const r = validateActivityBatch({ rationale: 'r', activities: [liveAppleGroups, good] }, { skillIds: graph });
    assert.deepEqual(r.accepted.map(a => a.id), ['fx-3-area-tiles']);
    assert.equal(r.rejected[0]!.index, 0);
    assert.match(r.rejected[0]!.errors[0]!, /^consistency: .*3 groups of 4.*2 groups of 4/);
    assert.equal(validateActivityBatch({ rationale: 'r', activities: [liveAppleGroups] }, { skillIds: graph, consistency: false }).accepted.length, 1);
  });
  it('restore (validateActivitySpec) does not lint, so stored evidence keeps validating', () => {
    assert.ok(validateActivitySpec(liveAppleGroups, { skillIds: graph }).ok);
  });
});

describe('consistency rules: true negatives', () => {
  it('passes every hand-authored fixture', () => {
    for (const spec of fixtures) assert.deepEqual(consistencyIssues(spec), [], spec.id);
  });
  it('passes the live activity once the figure matches the text', () => {
    const fixed = clone(liveAppleGroups);
    if (fixed.figures![0]!.type === 'picture') fixed.figures![0]!.groups.push({ ...fixed.figures![0]!.groups[0]! });
    assert.deepEqual(consistencyIssues(fixed), []);
  });
  const pic = (groups: number[], extra: Record<string, unknown> = {}): Figure => ({ type: 'picture', id: 'p', alt: 'x', groups: groups.map(count => ({ icon: 'cherry', count })), ...extra } as Figure);
  const cases: [string, ActivitySpec][] = [
    ['extra groups beside the stated ones', activity({ prompt: [{ type: 'text', text: 'Farah fills 3 bags with 10 cherries each, and has 5 more in her hand.' }, { type: 'figure', figureId: 'p' }, { type: 'text', text: 'How many cherries in total?' }], figures: [pic([10, 10, 10, 5])], response: { type: 'numeric', answer: 35 }, keyCheck: { value: '3*10+5' } })],
    ['"M in each of N" orientation', activity({ prompt: [{ type: 'text', text: 'There are 4 cherries in each of 3 bowls.' }, { type: 'figure', figureId: 'p' }, { type: 'text', text: 'How many cherries?' }], figures: [pic([4, 4, 4])], response: { type: 'numeric', answer: 12 }, keyCheck: { value: '3*4' } })],
    ['one picture of the whole collection', activity({ prompt: [{ type: 'text', text: 'Lucia arranges cherries in 4 equal rows. Each row has 6 cherries.' }, { type: 'figure', figureId: 'p' }, { type: 'text', text: 'How many cherries altogether?' }], figures: [pic([24], {})], response: { type: 'numeric', answer: 24 }, keyCheck: { value: '6+6+6+6' } })],
    ['a picture that is part of a story (the text adds numbers)', activity({ prompt: [{ type: 'text', text: 'Some birds sat on a branch. Then 3 more came. Now there are 8.' }, { type: 'figure', figureId: 'p' }, { type: 'text', text: 'How many cherries were there at first?' }], figures: [pic([5, 3])], response: { type: 'numeric', answer: 5 }, keyCheck: { value: '8-3' } })],
    ['a question about something the picture does not show', activity({ prompt: [{ type: 'figure', figureId: 'p' }, { type: 'text', text: 'Each cherry has 2 seeds. How many seeds are there in all?' }], figures: [pic([4, 4])], response: { type: 'numeric', answer: 16 }, keyCheck: { value: '8*2' } })],
    ['an array described in either orientation', activity({ skillIds: ['3.MD.C.7'], prompt: [{ type: 'text', text: 'Find $6 \\times 4$ with the array.' }, { type: 'figure', figureId: 'a' }], figures: [{ type: 'array_grid', id: 'a', alt: 'x', rows: 4, cols: 6, style: 'dots' }], response: { type: 'numeric', answer: 24 }, keyCheck: { value: '6*4' } })],
    ['a change to the array', activity({ skillIds: ['3.MD.C.7'], prompt: [{ type: 'figure', figureId: 'a' }, { type: 'text', text: 'If we add 2 more rows, how many dots will there be?' }], figures: [{ type: 'array_grid', id: 'a', alt: 'x', rows: 3, cols: 5, style: 'dots' }], response: { type: 'numeric', answer: 25 }, keyCheck: { value: '5*5' } })],
    ['the answer is also a keyCheck input ("12 - 6")', activity({ prompt: [{ type: 'text', text: 'Sam has 12 stickers and gives 6 away. How many are left?' }], response: { type: 'numeric', answer: 6 }, keyCheck: { value: '12-6' } })],
    ['a chart scale statement and a fraction of a total', activity({ skillIds: ['3.MD.B.3'], prompt: [{ type: 'text', text: 'Each square represents 2 books. Which nest has 1/4 of all the eggs?' }, { type: 'figure', figureId: 'c' }], figures: [{ type: 'bar_chart', id: 'c', alt: 'x', yLabel: 'Books', bars: [{ label: 'Nest A', value: 12, id: 'a' }, { label: 'Nest B', value: 8, id: 'b' }] }], response: { type: 'tap_region', figureId: 'c', region: 'b' }, keyCheck: undefined })],
    ['a comparison stated about chart labels', activity({ skillIds: ['3.MD.B.3'], prompt: [{ type: 'figure', figureId: 'c' }, { type: 'text', text: 'Tom read 4 more books than Maria. How many did Tom read?' }], figures: [{ type: 'bar_chart', id: 'c', alt: 'x', bars: [{ label: 'Maria', value: 5 }, { label: 'Tom', value: 9 }] }], response: { type: 'numeric', answer: 9 }, keyCheck: { value: '5+4' } })],
    ['clock times as labels', activity({ skillIds: ['3.MD.A.1'], prompt: [{ type: 'text', text: 'Practice starts at 3:00 and ends at 3:20. How many minutes long is it?' }, { type: 'figure', figureId: 'l' }], figures: [{ type: 'number_line', id: 'l', alt: 'x', min: 0, max: 30, step: 5, marks: [{ value: 0, label: '3:00' }, { value: 20, label: '3:20' }] }], response: { type: 'numeric', answer: 20 }, keyCheck: { value: '20' } })],
    ['a labelled group asked by name', activity({ prompt: [{ type: 'text', text: 'There are 6 birds. The rest are in the tree.' }, { type: 'figure', figureId: 'p' }, { type: 'text', text: 'How many birds are in the tree?' }], figures: [{ type: 'picture', id: 'p', alt: 'x', groups: [{ icon: 'bird', count: 2, label: 'on ground' }, { icon: 'bird', count: 4, label: 'in tree' }] }], response: { type: 'numeric', answer: 4 }, keyCheck: { value: '6-2' } })],
    ['a fraction equivalent to the model', activity({ skillIds: ['3.NF.A.3'], prompt: [{ type: 'text', text: 'Which fractions equal $\\frac{1}{2}$?' }, { type: 'figure', figureId: 'f' }], figures: [{ type: 'fraction_model', id: 'f', alt: 'x', model: 'area', parts: 8, rows: 2, shaded: 4 }], response: { type: 'multiple_choice', options: [{ text: '$\\frac{4}{8}$', correct: true }, { text: '$\\frac{1}{4}$', correct: false }] }, keyCheck: undefined })],
    ['what is not shaded', activity({ skillIds: ['3.NF.A.1'], prompt: [{ type: 'figure', figureId: 'f' }, { type: 'text', text: 'What fraction of the bar is white?' }], figures: [{ type: 'fraction_model', id: 'f', alt: 'x', model: 'bar', parts: 8, shaded: 3 }], response: { type: 'fraction', numerator: 5, denominator: 8 }, keyCheck: { value: '5/8' } })],
  ];
  for (const [name, spec] of cases) it(`passes: ${name}`, () => assert.deepEqual(consistencyIssues(spec), [], name));
});

describe('app-authored descriptions', () => {
  it('describes figures from data with their own names', () => {
    assert.equal(describeFigure(liveAppleGroups.figures![0]!), 'Picture: 2 groups of 4 apples.');
    assert.equal(describeFigure(fixtures.find(f => f.id === 'fx-2-fruit-graph')!.figures![0]!), 'Bar chart (Votes): Favorite fruit. Apples 9, Bananas 6, Pears 4, Grapes 7.');
    assert.equal(describeFigure(fixtures.find(f => f.id === 'fx-2-coins')!.figures![0]!), 'Money: 2 quarters, 1 dime, 1 nickel and 3 pennies.');
    assert.equal(describeFigure(fixtures.find(f => f.id === 'fx-1-half-hour')!.figures![0]!), 'Analog clock: the short hour hand is between 3 and 4; the long minute hand points to 6.');
    assert.equal(describeFigure({ type: 'picture', id: 'p', alt: 'x', groups: [{ icon: 'traffic_cone', count: 2 }] } as unknown as Figure), 'Picture: 2 traffic cones.');
  });
  it('never states the answer: a counting picture becomes countable words, a fraction mark is placed by ticks', () => {
    const count = fixtures.find(f => f.id === 'fx-k-count-apples')!;
    assert.equal(figureAlt(count.figures![0]!, count), 'Picture: Group: apple, apple, apple, apple, apple, apple, apple.');
    const line = fixtures.find(f => f.id === 'fx-3-number-line-fraction')!;
    assert.equal(figureAlt(line.figures![0]!, line), 'Number line from 0 to 2, a tick every 1/4; mark P 3 ticks right of 0.');
    for (const spec of [...fixtures, ...inconsistentFixtures.map(x => x.spec)]) for (const f of spec.figures ?? []) assert.ok(!statesAnswer(figureAlt(f, spec), spec), `${spec.id}/${f.id}: ${figureAlt(f, spec)}`);
  });
  it('ignores the model alt entirely (a self-contradicting alt changes nothing)', () => {
    const a = clone(liveAppleGroups), b = clone(liveAppleGroups);
    b.figures![0]!.alt = 'Twelve apples.';
    assert.equal(figureAlt(a.figures![0]!, a), figureAlt(b.figures![0]!, b));
    assert.doesNotMatch(figureAlt(a.figures![0]!, a), /no individual apples/);
  });
});
