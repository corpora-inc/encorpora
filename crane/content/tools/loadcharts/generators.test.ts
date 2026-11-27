import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHARTS } from './index.ts';
import type { Chart, Configuration, Rigging } from './index.ts';
import { FAMILIES, SKILLS, createRng, generate, generateProblem, toItems } from './generators.ts';
import type { CellRef, FamilyId, Problem } from './generators.ts';

const PER_FAMILY = 10_000;

// ------------------------------------------------------------ independent reference solver
// Reads the raw chart arrays directly; shares no lookup code with index.ts.

function chartOf(id: string): Chart {
  const c = CHARTS.find((x) => x.id === id);
  assert.ok(c, id);
  return c;
}

function cfgOf(chart: Chart, id: string): Configuration {
  const c = chart.configurations.find((x) => x.id === id);
  assert.ok(c, `${chart.id}/${id}`);
  return c;
}

function refGross(chart: Chart, configId: string, L: number, R: number): number | null {
  const cfg = cfgOf(chart, configId);
  const radii = cfg.radiiFt;
  const booms = cfg.boomLengthsFt;
  if (R < radii[0] || R > radii[radii.length - 1]) return null;
  if (L < booms[0] || L > booms[booms.length - 1]) return null;
  const i = radii.findIndex((r) => r >= R);
  let cols: number[];
  if (booms.includes(L)) cols = [booms.indexOf(L)];
  else {
    const hi = booms.findIndex((b) => b > L);
    cols = chart.rules.betweenBoomLengths === 'next-longer' ? [hi] : [hi - 1, hi];
  }
  const vals = cols.map((j) => cfg.capacitiesLb[i][j]);
  if (vals.some((v) => v === null)) return null;
  return Math.min(...(vals as number[]));
}

function refDeductions(chart: Chart, ids: readonly string[], rigging: readonly Rigging[]): number {
  let t = 0;
  for (const id of ids) {
    const d = chart.deductions.find((x) => x.id === id);
    assert.ok(d, id);
    t += d.weightLb;
  }
  for (const r of rigging) t += r.count * r.eachLb;
  return t;
}

function refJib(chart: Chart, jibLength: number, offsetDeg: number, mainBoom: number, angle?: number, radius?: number): number | null {
  const t = chart.jib?.tables.find((x) => x.jibLengthFt === jibLength && x.offsetDeg === offsetDeg && x.mainBoomLengthFt === mainBoom);
  assert.ok(t);
  let k: number;
  if (t.basis === 'boom-angle') {
    assert.ok(angle !== undefined);
    if (angle > t.keys[0]) return null;
    k = t.keys.findIndex((x) => x <= angle);
  } else {
    assert.ok(radius !== undefined);
    k = t.keys.findIndex((x) => x >= radius);
  }
  if (k < 0) return null;
  return t.capacitiesLb[k];
}

function must(v: number | null, what: string): number {
  assert.ok(v !== null, `${what} is blank`);
  return v;
}

function refAnswer(p: Problem): number {
  const chart = chartOf(p.chartId);
  const x = p.inputs;
  switch (x.family) {
    case 'read-gross':
    case 'radius-between-rows':
    case 'boom-between-lengths':
      return must(refGross(chart, x.config, x.boomLength, x.radius), 'gross');
    case 'deductions':
      return refDeductions(chart, x.deductionIds, x.rigging);
    case 'net-capacity':
      return must(refGross(chart, x.config, x.boomLength, x.radius), 'gross') - refDeductions(chart, x.deductionIds, x.rigging);
    case 'can-lift':
      return must(refGross(chart, x.config, x.boomLength, x.radius), 'gross') - refDeductions(chart, x.deductionIds, x.rigging) - x.loadLb;
    case 'percent-capacity': {
      const g = must(refGross(chart, x.config, x.boomLength, x.radius), 'gross');
      return ((x.loadLb + refDeductions(chart, x.deductionIds, x.rigging)) * 100) / g;
    }
    case 'configuration': {
      const a = must(refGross(chart, x.fromConfig, x.boomLength, x.radius), 'from');
      const b = must(refGross(chart, x.toConfig, x.boomLength, x.radius), 'to');
      return x.ask === 'loss' ? a - b : b;
    }
    case 'jib':
      return must(refJib(chart, x.jibLength, x.offsetDeg, x.mainBoomLength, x.boomAngle, x.radius), 'jib') - refDeductions(chart, x.deductionIds, x.rigging);
    case 'parts-of-line': {
      const total = x.loadLb + refDeductions(chart, x.deductionIds, x.rigging);
      let n = 1;
      while (n * x.linePullLb < total) n++;
      assert.ok(chart.linePull && n <= chart.linePull.maxParts, 'parts beyond the line-pull table');
      for (const id of x.deductionIds) {
        const d = chart.deductions.find((y) => y.id === id);
        if (d?.kind === 'hook-block') assert.ok((d.maxParts ?? 1) >= n, 'block cannot be reeved that many parts');
      }
      return n;
    }
    case 'load-weight': {
      const w = x.shape === 'concrete-block' ? x.lengthFt * x.widthFt * x.thickness * x.densityLbFt3 : (x.lengthFt * x.widthFt * x.thickness * x.densityLbFt3) / 12;
      if (x.ask === 'weight') return w;
      assert.ok(x.config && x.boomLength !== undefined && x.radius !== undefined && x.deductionIds && x.rigging);
      return must(refGross(chart, x.config, x.boomLength, x.radius), 'gross') - refDeductions(chart, x.deductionIds, x.rigging) - w;
    }
    case 'range-diagram': {
      const g = chart.geometry;
      const rd = chart.rangeDiagram;
      assert.ok(g && rd);
      if (x.ask === 'angle' || x.ask === 'tip-height') {
        assert.ok(x.radius !== undefined);
        const i = rd.radiiFt.indexOf(x.radius);
        const j = rd.boomLengthsFt.indexOf(x.boomLength);
        return must((x.ask === 'angle' ? rd.angleDeg : rd.tipHeightFt)[i][j], 'range');
      }
      if (x.ask === 'radius-at-60') return x.boomLength * Math.cos(Math.PI / 3) + g.pivotOffsetFt;
      if (x.ask === 'radius-from-rise') {
        assert.ok(x.riseFt !== undefined);
        return Math.sqrt(x.boomLength ** 2 - x.riseFt ** 2) + g.pivotOffsetFt;
      }
      assert.ok(x.radius !== undefined && x.obstacleFt !== undefined);
      const run = x.radius - g.pivotOffsetFt;
      return Math.sqrt(x.boomLength ** 2 - run ** 2) + g.pivotHeightFt - x.obstacleFt;
    }
    case 'structural-vs-stability': {
      const cfg = cfgOf(chart, x.config);
      if (x.ask === 'stability-percent') return cfg.stabilityPercent;
      assert.ok(x.boomLength !== undefined);
      const j = cfg.boomLengthsFt.indexOf(x.boomLength);
      const i = cfg.radiiFt.findIndex((_, k) => cfg.capacitiesLb[k][j] !== null && !cfg.structural[k][j]);
      assert.ok(i > 0);
      return cfg.radiiFt[i];
    }
    case 'quadrants': {
      const front = cfgOf(chart, x.frontConfig);
      const side = cfgOf(chart, x.sideConfig);
      assert.equal(front.workArea, 'over-front');
      assert.equal(side.workArea, '360');
      assert.equal(front.support, side.support);
      const vf = must(refGross(chart, x.frontConfig, x.boomLength, x.radius), 'front');
      const vs = must(refGross(chart, x.sideConfig, x.boomLength, x.radius), 'side');
      assert.ok(vs < vf);
      if (x.ask === 'side-capacity') return vs;
      assert.ok(x.totalLoadLb !== undefined && x.totalLoadLb <= vf && x.totalLoadLb > vs, 'load must fit over the front only');
      return x.totalLoadLb - vs;
    }
  }
}

function cellResolves(chart: Chart, c: CellRef): boolean {
  switch (c.kind) {
    case 'capacity': {
      const cfg = cfgOf(chart, c.config);
      const i = cfg.radiiFt.indexOf(c.radiusFt);
      const j = cfg.boomLengthsFt.indexOf(c.boomLengthFt);
      return i >= 0 && j >= 0 && cfg.capacitiesLb[i][j] === c.valueLb && cfg.structural[i][j] === c.structural;
    }
    case 'jib': {
      const t = chart.jib?.tables.find((x) => x.jibLengthFt === c.jibLengthFt && x.offsetDeg === c.offsetDeg && x.mainBoomLengthFt === c.mainBoomLengthFt);
      return !!t && t.capacitiesLb[t.keys.indexOf(c.key)] === c.valueLb;
    }
    case 'range': {
      const rd = chart.rangeDiagram;
      if (!rd) return false;
      const i = rd.radiiFt.indexOf(c.radiusFt);
      const j = rd.boomLengthsFt.indexOf(c.boomLengthFt);
      return i >= 0 && j >= 0 && rd.angleDeg[i][j] === c.angleDeg && rd.tipHeightFt[i][j] === c.tipHeightFt;
    }
    case 'deduction':
      return chart.deductions.some((d) => d.id === c.id && d.weightLb === c.weightLb);
    case 'line-pull':
      return !!chart.linePull?.rows.some((r) => r.parts === c.parts && r.maxLoadLb === c.maxLoadLb);
    case 'geometry':
      return !!chart.geometry && chart.geometry.pivotOffsetFt === c.pivotOffsetFt && chart.geometry.pivotHeightFt === c.pivotHeightFt;
    case 'stability-percent':
      return cfgOf(chart, c.config).stabilityPercent === c.percent;
  }
}

function noCalculator(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n * 10 - Math.round(n * 10)) < 1e-9;
}

function checkProblem(p: Problem, family: FamilyId): void {
  const where = `${family} ${p.id}`;
  assert.equal(p.family, family, where);
  assert.equal(p.skillId, SKILLS[family], where);
  assert.match(p.skillId, /^loadchart\.[a-z-]+$/, where);
  assert.ok(p.difficulty >= 0 && p.difficulty <= 1, where);
  const chart = chartOf(p.chartId);
  assert.equal(p.chartTitle, chart.title, where);
  assert.ok(p.stem.length > 10 && p.steps.length >= 1 && p.setup.length >= 1, where);

  // the answer, recomputed independently, is exact
  const ref = refAnswer(p);
  assert.ok(Math.abs(ref - p.answer.value) < 1e-9, `${where}: answer ${p.answer.value}, reference ${ref}`);
  assert.equal(p.numeric.value, p.answer.value, where);
  assert.equal(p.numeric.unit, p.answer.unit, where);

  // no calculator: the answer and every intermediate value are integers or one-decimal values
  assert.ok(noCalculator(p.answer.value), `${where}: answer ${p.answer.value}`);
  for (const v of p.intermediates) assert.ok(noCalculator(v), `${where}: intermediate ${v}`);

  // multiple choice: four distinct choices, exactly one is the answer, a rationale for each
  assert.equal(p.mc.choices.length, 4, where);
  assert.equal(new Set(p.mc.choices).size, 4, `${where}: duplicate choices ${p.mc.choices.join(' | ')}`);
  assert.equal(p.mc.rationales.length, 4, where);
  assert.equal(p.mc.choices[p.mc.answerIndex], p.answer.text, where);
  p.mc.rationales.forEach((r, i) => assert.equal(r.startsWith('Correct.'), i === p.mc.answerIndex, where));

  // every chart cell it cites resolves to the chart data
  if (family !== 'load-weight' || p.inputs.family !== 'load-weight' || p.inputs.ask === 'margin') assert.ok(p.cells.length >= 1, `${where}: no cells`);
  for (const c of p.cells) assert.ok(cellResolves(chart, c), `${where}: cell ${JSON.stringify(c)} does not match ${chart.id}`);

  // a setup that names a jib deduction names the exact chart item, never a generic status
  const inp = p.inputs as { deductionIds?: string[] };
  for (const id of inp.deductionIds ?? []) {
    const d = chart.deductions.find((x) => x.id === id);
    if (d && (d.kind === 'jib-stowed' || d.kind === 'jib-erected'))
      assert.ok(p.setup.some((r) => r.label === 'Jib/extension' && r.value === d.item), `${where}: jib deduction ${id} not named in the setup`);
  }
  if (p.setup.some((r) => / if (installed|fitted|mounted)/.test(r.value))) assert.fail(`${where}: conditional item in setup`);

  // public-content guard on generated text
  const text = `${p.stem} ${p.setup.map((s) => s.value).join(' ')} ${p.steps.join(' ')} ${p.mc.rationales.join(' ')}`.toLowerCase();
  for (const b of ['nccco', 'osha', 'certified by', 'endorsed']) assert.ok(!text.includes(b), `${where}: mentions ${b}`);
}

// ------------------------------------------------------------ tests

test('at least the thirteen required families, each with its own loadchart skill id', () => {
  for (const f of [
    'read-gross',
    'radius-between-rows',
    'boom-between-lengths',
    'net-capacity',
    'deductions',
    'can-lift',
    'percent-capacity',
    'configuration',
    'jib',
    'parts-of-line',
    'load-weight',
    'range-diagram',
    'structural-vs-stability',
    'quadrants',
  ] as FamilyId[])
    assert.ok(FAMILIES.includes(f), f);
  assert.equal(new Set(Object.values(SKILLS)).size, FAMILIES.length);
});

test('the PRNG is deterministic and roughly uniform', () => {
  const a = createRng(42);
  const b = createRng(42);
  const xs = Array.from({ length: 1000 }, () => a.next());
  assert.deepEqual(
    xs,
    Array.from({ length: 1000 }, () => b.next()),
  );
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  assert.ok(Math.abs(mean - 0.5) < 0.05);
  const r = createRng(1);
  for (let k = 0; k < 1000; k++) {
    const n = r.int(3, 7);
    assert.ok(Number.isInteger(n) && n >= 3 && n <= 7);
  }
});

test('same seed gives the same problem; different seeds vary', () => {
  for (const f of FAMILIES) {
    for (const seed of [0, 1, 12345, 4294967295]) assert.deepEqual(generateProblem(f, seed), generateProblem(f, seed), `${f} seed ${seed}`);
    const ids = new Set(Array.from({ length: 50 }, (_, s) => generateProblem(f, s).id));
    assert.ok(ids.size >= 10, `${f}: only ${ids.size} distinct problems in 50 seeds`);
  }
});

test('a bare { next() } source works and matches the built-in PRNG', () => {
  const full = createRng(99);
  const st = createRng(99);
  const bare = { next: () => st.next() };
  for (const f of FAMILIES) assert.deepEqual(generate(f, bare), generate(f, full), f);
});

test('toItems gives an mc item and a numeric item for the practice engine', () => {
  const p = generateProblem('net-capacity', 5);
  const [mc, num] = toItems(p);
  assert.equal(mc.kind, 'mc');
  assert.equal(mc.choiceCount, 4);
  assert.equal(mc.answer, String(p.mc.answerIndex));
  assert.equal(num.kind, 'numeric');
  assert.equal(Number(num.answer), p.answer.value);
  assert.equal(mc.variantOf, p.id);
  assert.equal(num.variantOf, p.id);
  assert.notEqual(mc.id, num.id);
});

for (const family of FAMILIES) {
  test(`${family}: ${PER_FAMILY} problems generate, recompute exactly, and pass every check`, () => {
    const rng = createRng(0x5eed ^ family.length);
    const charts = new Set<string>();
    for (let k = 0; k < PER_FAMILY; k++) {
      const p = generate(family, rng);
      checkProblem(p, family);
      charts.add(p.chartId);
    }
    if (!['quadrants', 'jib', 'parts-of-line', 'range-diagram'].includes(family)) assert.ok(charts.size >= 3, `${family} draws on only ${[...charts].join(', ')}`);
  });
}
