import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aOrAn,
  boomAngleFor,
  capacityAt,
  configsForPosition,
  deductionLines,
  firstStabilityRadius,
  formatLb,
  getChart,
  jibCapacityAt,
  netCapacity,
  plateWeightLb,
  blockWeightLb,
  radiusFromAngle,
  radiusFromRise,
  rangeAt,
  requiredParts,
  tipHeightFromAngle,
} from './index.ts';

const ht = getChart('ht-50');
const rt = getChart('rt-40');
const lc = getChart('lc-150');

function gross(r: ReturnType<typeof capacityAt>): number {
  assert.ok(r.permitted, JSON.stringify(r));
  return r.grossLb;
}

test('exact row and column read the cell', () => {
  assert.equal(gross(capacityAt(ht, { config: 'outriggers-full-360', boomLength: 38, radius: 10 })), 100000);
  assert.equal(gross(capacityAt(ht, { config: 'outriggers-full-360', boomLength: 62, radius: 15 })), 49000);
});

test('radius between rows uses the next longer radius', () => {
  const r = capacityAt(ht, { config: 'outriggers-full-360', boomLength: 50, radius: 16 });
  assert.ok(r.permitted);
  assert.equal(r.rowRadiusFt, 20);
  assert.equal(r.grossLb, 48000);
});

test('boom between columns: next longer on this chart', () => {
  const r = capacityAt(ht, { config: 'outriggers-full-360', boomLength: 63, radius: 12 });
  assert.ok(r.permitted);
  assert.equal(r.governing.boomLengthFt, 74);
  assert.equal(r.grossLb, 48700);
});

test('boom between columns: lower of the adjacent booms on a lower-of-adjacent chart', () => {
  assert.equal(rt.rules.betweenBoomLengths, 'lower-of-adjacent');
  const r = capacityAt(rt, { config: 'outriggers-full-360', boomLength: 50, radius: 30 });
  assert.ok(r.permitted);
  assert.equal(r.cells.length, 2);
  assert.equal(r.grossLb, Math.min(...r.cells.map((c) => c.valueLb as number)));
});

test('blank cells and off-chart positions are refused', () => {
  const blank = capacityAt(ht, { config: 'outriggers-full-360', boomLength: 110, radius: 10 });
  assert.equal(blank.permitted, false);
  assert.equal(!blank.permitted && blank.reason, 'no-rating');
  const far = capacityAt(ht, { config: 'outriggers-full-360', boomLength: 110, radius: 101 });
  assert.equal(!far.permitted && far.reason, 'radius-beyond-chart');
  const near = capacityAt(ht, { config: 'outriggers-full-360', boomLength: 38, radius: 9 });
  assert.equal(!near.permitted && near.reason, 'radius-inside-chart');
  const boom = capacityAt(ht, { config: 'outriggers-full-360', boomLength: 120, radius: 40 });
  assert.equal(!boom.permitted && boom.reason, 'boom-outside-chart');
  // on rubber over the rear stops at 74 ft of boom
  const rub = capacityAt(ht, { config: 'rubber-rear-stationary', boomLength: 86, radius: 30 });
  assert.equal(rub.permitted, false);
});

test('a between-boom length next to a blank cell is refused, never borrowed from the shorter boom', () => {
  // 38 ft boom rates 10 ft; 50 ft rates 10 ft; 62 ft rates 10 ft; 74 ft does not.
  const r = capacityAt(ht, { config: 'outriggers-full-360', boomLength: 70, radius: 10 });
  assert.equal(r.permitted, false);
});

test('net capacity subtracts every deduction and the rigging', () => {
  const lines = deductionLines(ht, ['block-60t', 'jib-stowed'], [{ item: 'slings', count: 2, eachLb: 40 }]);
  assert.deepEqual(
    lines.map((l) => l.weightLb),
    [1100, 2400, 80],
  );
  assert.deepEqual(netCapacity(49000, lines), { netLb: 45420, totalDeductionsLb: 3580 });
});

test('required parts rounds up', () => {
  assert.equal(requiredParts(97500, 10000), 10);
  assert.equal(requiredParts(90000, 10000), 9);
  assert.equal(requiredParts(90001, 10000), 10);
  assert.equal(requiredParts(500, 10000), 1);
  assert.throws(() => requiredParts(100, 0));
});

test('jib by boom angle uses the next lower angle', () => {
  const exact = jibCapacityAt(ht, { jibLength: 33, offsetDeg: 0, boomAngle: 60 });
  const between = jibCapacityAt(ht, { jibLength: 33, offsetDeg: 0, boomAngle: 64 });
  assert.ok(exact.permitted && between.permitted);
  assert.equal(between.cell.key, 60);
  assert.equal(between.grossLb, exact.grossLb);
  assert.equal(jibCapacityAt(ht, { jibLength: 33, offsetDeg: 0, boomAngle: 80 }).permitted, false);
  assert.equal(jibCapacityAt(ht, { jibLength: 56, offsetDeg: 0, boomAngle: 26 }).permitted, false);
  assert.equal(jibCapacityAt(ht, { jibLength: 40, offsetDeg: 0, boomAngle: 60 }).permitted, false);
});

test('jib by radius uses the next longer radius', () => {
  const r = jibCapacityAt(lc, { jibLength: 30, offsetDeg: 15, mainBoomLength: 130, radius: 52 });
  assert.ok(r.permitted);
  assert.equal(r.cell.key, 60);
});

test('range diagram lookups and geometry helpers agree', () => {
  const cell = rangeAt(ht, 110, 20);
  assert.ok(cell);
  const g = ht.geometry;
  assert.ok(g);
  assert.ok(Math.abs(radiusFromAngle(g, 110, cell.angleDeg) - 20) < 1);
  assert.ok(Math.abs(tipHeightFromAngle(g, 110, cell.angleDeg) - cell.tipHeightFt) < 1.5);
  const a = boomAngleFor(g, 110, 20);
  assert.ok(a !== null && Math.abs(a - cell.angleDeg) <= 0.5);
  assert.equal(radiusFromRise(g, 50, 40), 30 + g.pivotOffsetFt);
  assert.equal(radiusFromRise(g, 50, 60), null);
  assert.equal(rangeAt(getChart('ak-30'), 21, 10), null);
});

test('structural region boundary and work areas', () => {
  assert.equal(firstStabilityRadius(ht, 'outriggers-full-360', 50), 30);
  assert.equal(firstStabilityRadius(getChart('ak-30'), 'stabilizers-full-360', 21), null);
  const side = configsForPosition(rt, 'on-rubber-stationary', 'side').map((c) => c.id);
  const front = configsForPosition(rt, 'on-rubber-stationary', 'front').map((c) => c.id);
  assert.deepEqual(side, ['rubber-360-stationary']);
  assert.deepEqual(front.sort(), ['rubber-360-stationary', 'rubber-front-stationary']);
  assert.deepEqual(configsForPosition(ht, 'on-rubber-stationary', 'side'), []);
});

test('load weights and formatting', () => {
  assert.equal(blockWeightLb(4, 3, 2, 150), 3600);
  assert.equal(plateWeightLb(8, 4, 3, 490), 3920);
  assert.equal(formatLb(1234567), '1,234,567 lb');
  assert.equal(formatLb(-850), '-850 lb');
  assert.deepEqual([8, 11, 18, 80, 86, 50, 110, 180, 800].map(aOrAn), ['an', 'an', 'an', 'an', 'an', 'a', 'a', 'a', 'an']);
});
