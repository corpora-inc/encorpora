// Deterministic practice-problem generators over the fictional load charts.
// A template plus a seeded PRNG gives a problem with an exact answer, worked
// steps, distractors drawn from common mistakes, the skill it practices, and
// the chart cells it uses. No Date, no Math.random: pass the PRNG in.

import {
  CHARTS,
  aOrAn,
  boomPhrase,
  capacityAt,
  configsForPosition,
  deductionLines,
  firstStabilityRadius,
  formatLb,
  formatNumber,
  getChart,
  getConfiguration,
  getDeduction,
  jibCapacityAt,
  netCapacity,
  rangeAt,
  requiredParts,
  riggingLines,
} from './index.ts';
import type { CapacityCell, Chart, Configuration, Deduction, JibCell, RangeCell, Rigging } from './index.ts';

// ---------------------------------------------------------------- PRNG

export type Rng = {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [lo, hi], inclusive. */
  int(lo: number, hi: number): number;
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: readonly T[]): T[];
};

/** Any source of uniform [0, 1) numbers, e.g. the practice engine's Rng. */
export type RandomSource = { next(): number };

/** mulberry32: small, fast, deterministic 32-bit PRNG. */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  return asRng({
    next(): number {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  });
}

/** Wrap a bare random source with the helpers the generators use. */
export function asRng(src: RandomSource): Rng {
  const next = (): number => src.next();
  const int = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    pick<T>(xs: readonly T[]): T {
      if (xs.length === 0) throw new Error('loadcharts: pick from empty list');
      return xs[int(0, xs.length - 1)];
    },
    shuffle<T>(xs: readonly T[]): T[] {
      const a = xs.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(0, i);
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
      }
      return a;
    },
  };
}

// ---------------------------------------------------------------- problem shape

export const SKILLS = {
  'read-gross': 'loadchart.read-gross',
  'radius-between-rows': 'loadchart.radius-between-rows',
  'boom-between-lengths': 'loadchart.boom-between-lengths',
  deductions: 'loadchart.deductions',
  'net-capacity': 'loadchart.net-capacity',
  'can-lift': 'loadchart.can-lift',
  'percent-capacity': 'loadchart.percent-capacity',
  configuration: 'loadchart.configuration',
  jib: 'loadchart.jib',
  'parts-of-line': 'loadchart.parts-of-line',
  'load-weight': 'loadchart.load-weight',
  'range-diagram': 'loadchart.range-diagram',
  'structural-vs-stability': 'loadchart.structural-vs-stability',
  quadrants: 'loadchart.quadrants',
} as const;

export type FamilyId = keyof typeof SKILLS;
export type SkillId = (typeof SKILLS)[FamilyId];
export const FAMILIES = Object.keys(SKILLS) as FamilyId[];

export type Unit = 'lb' | 'ft' | 'deg' | 'percent' | 'parts';

export type CellRef =
  | CapacityCell
  | JibCell
  | RangeCell
  | { kind: 'deduction'; id: string; weightLb: number }
  | { kind: 'line-pull'; parts: number; maxLoadLb: number }
  | { kind: 'geometry'; pivotOffsetFt: number; pivotHeightFt: number }
  | { kind: 'stability-percent'; config: string; percent: number };

/** Structured inputs, enough to recompute the answer from the chart alone. */
export type ProblemInputs =
  | { family: 'read-gross' | 'radius-between-rows' | 'boom-between-lengths'; config: string; boomLength: number; radius: number }
  | { family: 'deductions'; deductionIds: string[]; rigging: Rigging[] }
  | { family: 'net-capacity'; config: string; boomLength: number; radius: number; deductionIds: string[]; rigging: Rigging[] }
  | { family: 'can-lift'; config: string; boomLength: number; radius: number; deductionIds: string[]; rigging: Rigging[]; loadLb: number }
  | { family: 'percent-capacity'; config: string; boomLength: number; radius: number; deductionIds: string[]; rigging: Rigging[]; loadLb: number }
  | { family: 'configuration'; ask: 'loss' | 'capacity'; fromConfig: string; toConfig: string; boomLength: number; radius: number }
  | {
      family: 'jib';
      jibLength: number;
      offsetDeg: number;
      mainBoomLength: number;
      boomAngle?: number;
      radius?: number;
      deductionIds: string[];
      rigging: Rigging[];
    }
  | { family: 'parts-of-line'; loadLb: number; deductionIds: string[]; rigging: Rigging[]; linePullLb: number }
  | {
      family: 'load-weight';
      ask: 'weight' | 'margin';
      shape: 'concrete-block' | 'steel-plate';
      lengthFt: number;
      widthFt: number;
      /** feet for a block, inches for a plate */
      thickness: number;
      densityLbFt3: number;
      config?: string;
      boomLength?: number;
      radius?: number;
      deductionIds?: string[];
      rigging?: Rigging[];
    }
  | {
      family: 'range-diagram';
      ask: 'angle' | 'tip-height' | 'radius-from-rise' | 'radius-at-60' | 'clearance';
      boomLength: number;
      radius?: number;
      riseFt?: number;
      obstacleFt?: number;
    }
  | { family: 'structural-vs-stability'; ask: 'first-stability-radius' | 'stability-percent'; config: string; boomLength?: number }
  | { family: 'quadrants'; ask: 'side-capacity' | 'excess'; frontConfig: string; sideConfig: string; boomLength: number; radius: number; totalLoadLb?: number };

export type Problem = {
  id: string;
  family: FamilyId;
  skillId: SkillId;
  /** 0 (easiest) to 1 (hardest): a prior for the practice engine. */
  difficulty: number;
  chartId: string;
  chartTitle: string;
  /** Exam-style setup table. */
  setup: { label: string; value: string }[];
  stem: string;
  answer: { value: number; unit: Unit; text: string };
  mc: { choices: string[]; answerIndex: number; rationales: string[] };
  numeric: { stem: string; value: number; unit: Unit };
  steps: string[];
  cells: CellRef[];
  inputs: ProblemInputs;
  /** Every number a learner computes on the way; all are integers or one-decimal values. */
  intermediates: number[];
};

// ---------------------------------------------------------------- helpers

type Cand = { value: number; why: string };

function render(unit: Unit, v: number): string {
  switch (unit) {
    case 'lb':
      return formatLb(v);
    case 'ft':
      return `${formatNumber(v)} ft`;
    case 'deg':
      return `${formatNumber(v)}°`;
    case 'percent':
      return `${formatNumber(v)}%`;
    case 'parts':
      return v === 1 ? '1 part' : `${formatNumber(v)} parts`;
  }
}

function buildMc(
  rng: Rng,
  answer: number,
  unit: Unit,
  correctWhy: string,
  cands: Cand[],
  opts: { step: number; min?: number; text?: (v: number) => string; fallbackWhy?: string },
): Problem['mc'] {
  const text = opts.text ?? ((v: number) => render(unit, v));
  const min = opts.min ?? (unit === 'lb' || unit === 'ft' || unit === 'parts' ? 1 : 0);
  const seen = new Set<string>([text(answer)]);
  const picked: Cand[] = [];
  const tryAdd = (c: Cand): void => {
    if (picked.length >= 3) return;
    if (!Number.isFinite(c.value) || c.value < min) return;
    const t = text(c.value);
    if (seen.has(t)) return;
    seen.add(t);
    picked.push(c);
  };
  for (const c of cands) tryAdd(c);
  const why = opts.fallbackWhy ?? 'An arithmetic slip: recheck each step.';
  for (let k = 1; picked.length < 3 && k < 1000; k++) {
    tryAdd({ value: answer + k * opts.step, why });
    tryAdd({ value: answer - k * opts.step, why });
  }
  if (picked.length < 3) throw new Error('loadcharts: could not build three distinct distractors');
  const all = [{ value: answer, why: correctWhy, correct: true }, ...picked.map((p) => ({ ...p, correct: false }))];
  const order = rng.shuffle([0, 1, 2, 3]);
  const choices = order.map((i) => text(all[i].value));
  const rationales = order.map((i) => (all[i].correct ? `Correct. ${all[i].why}` : `Not this one. ${all[i].why}`));
  return { choices, answerIndex: order.indexOf(0), rationales };
}

function hashId(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

type Draft = Omit<Problem, 'id' | 'skillId' | 'chartTitle' | 'answer' | 'mc'> & {
  answerValue: number;
  unit: Unit;
  correctWhy: string;
  cands: Cand[];
  step: number;
  /** Rationale for filler distractors when the common-mistake list runs short. */
  fallbackWhy?: string;
  mcText?: (v: number) => string;
  answerText?: string;
};

function finish(rng: Rng, d: Draft): Problem {
  const chart = getChart(d.chartId);
  const mc = buildMc(rng, d.answerValue, d.unit, d.correctWhy, d.cands, {
    step: d.step,
    text: d.mcText,
    min: d.mcText ? -Infinity : undefined,
    fallbackWhy: d.fallbackWhy,
  });
  const answerText = d.answerText ?? (d.mcText ? d.mcText(d.answerValue) : render(d.unit, d.answerValue));
  const p: Problem = {
    id: '',
    family: d.family,
    skillId: SKILLS[d.family],
    difficulty: d.difficulty,
    chartId: d.chartId,
    chartTitle: chart.title,
    setup: d.setup,
    stem: d.stem,
    answer: { value: d.answerValue, unit: d.unit, text: answerText },
    mc,
    numeric: d.numeric,
    steps: d.steps,
    cells: d.cells,
    inputs: d.inputs,
    intermediates: d.intermediates,
  };
  p.id = `loadchart:${d.family}:${d.chartId}:${hashId(JSON.stringify([p.stem, p.setup, p.inputs, p.mc.choices]))}`;
  return p;
}

type Cell = { chart: Chart; cfg: Configuration; i: number; j: number; L: number; R: number; v: number };

function definedCells(chart: Chart, cfg: Configuration): Cell[] {
  const out: Cell[] = [];
  cfg.radiiFt.forEach((R, i) =>
    cfg.boomLengthsFt.forEach((L, j) => {
      const v = cfg.capacitiesLb[i][j];
      if (v !== null) out.push({ chart, cfg, i, j, L, R, v });
    }),
  );
  return out;
}

const ALL_CELLS: Cell[] = CHARTS.flatMap((c) => c.configurations.flatMap((cfg) => definedCells(c, cfg)));

function val(cfg: Configuration, i: number, j: number): number | null {
  if (i < 0 || j < 0 || i >= cfg.radiiFt.length || j >= cfg.boomLengthsFt.length) return null;
  return cfg.capacitiesLb[i][j];
}

function capCell(c: Cell): CapacityCell {
  return { kind: 'capacity', config: c.cfg.id, boomLengthFt: c.L, radiusFt: c.R, valueLb: c.v, structural: c.cfg.structural[c.i][c.j] };
}

function nn(xs: (number | null)[], why: string[]): Cand[] {
  const out: Cand[] = [];
  xs.forEach((x, k) => {
    if (x !== null) out.push({ value: x, why: why[k] });
  });
  return out;
}

function sum(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

function blockFor(chart: Chart, rng: Rng, minParts = 1): Deduction {
  const blocks = chart.deductions.filter((d) => (d.kind === 'hook-block' || d.kind === 'headache-ball') && (d.maxParts ?? 1) >= minParts);
  return rng.pick(blocks);
}

const SLING_LB = [20, 25, 30, 40, 50, 60, 75];
const SHACKLE_LB = [5, 10, 15, 20, 25];
const SPREADER_LB = [150, 200, 250, 300, 400, 450];

function randomRigging(rng: Rng, heavy: boolean): Rigging[] {
  const out: Rigging[] = [];
  const n = rng.pick([1, 2, 2, 4]);
  out.push({ item: n === 1 ? 'sling' : 'slings', count: n, eachLb: rng.pick(SLING_LB) });
  if (rng.next() < 0.6) out.push({ item: 'shackles', count: rng.pick([2, 4]), eachLb: rng.pick(SHACKLE_LB) });
  if (heavy && rng.next() < 0.5) out.push({ item: 'spreader bar', count: 1, eachLb: rng.pick(SPREADER_LB) });
  return out;
}

function riggingText(rigging: readonly Rigging[]): string {
  return rigging.map((r) => (r.count === 1 ? `${r.item}, ${formatLb(r.eachLb)}` : `${r.count} ${r.item}, ${formatLb(r.eachLb)} each`)).join('; ');
}

function baseSetup(chart: Chart, cfg: Configuration | null, L?: number, R?: number): { label: string; value: string }[] {
  const s: { label: string; value: string }[] = [{ label: 'Chart', value: chart.title }];
  if (cfg) s.push({ label: 'Configuration', value: cfg.label });
  if (L !== undefined) s.push({ label: chart.boom.type === 'articulating' ? 'Boom' : 'Main boom', value: chart.boom.type === 'articulating' ? boomPhrase(chart, L) : `${L} ft` });
  if (R !== undefined) s.push({ label: 'Radius', value: `${R} ft` });
  return s;
}

function jibStatusRow(chart: Chart, ids: readonly string[]): { label: string; value: string } | null {
  if (!chart.jib) return null;
  // name the exact chart item, so a chart with several jib deductions is never ambiguous
  const jib = ids.map((id) => getDeduction(chart, id)).find((d) => d.kind === 'jib-stowed' || d.kind === 'jib-erected');
  return { label: 'Jib/extension', value: jib ? jib.item : 'Removed' };
}

/** Deductions on a main-boom lift: one block or ball, plus jib status and attachments sometimes. */
function mainLiftDeductions(chart: Chart, rng: Rng): string[] {
  const ids = [blockFor(chart, rng).id];
  const jibs = chart.deductions.filter((d) => d.kind === 'jib-stowed' || d.kind === 'jib-erected');
  if (jibs.length && rng.next() < 0.6) ids.push(rng.pick(jibs).id);
  const extras = chart.deductions.filter((d) => d.kind === 'aux-head' || d.kind === 'attachment');
  if (extras.length && rng.next() < 0.35) ids.push(rng.pick(extras).id);
  return ids;
}

function deductionSetup(chart: Chart, ids: readonly string[], rigging: readonly Rigging[], showWeights: boolean): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const js = jibStatusRow(chart, ids);
  if (js) out.push(js);
  for (const id of ids) {
    const d = getDeduction(chart, id);
    if (d.kind === 'jib-stowed' || d.kind === 'jib-erected') continue;
    const label = d.kind === 'hook-block' ? 'Hook block' : d.kind === 'headache-ball' ? 'Headache ball' : 'Also on the boom';
    const item = d.item.replace(/, if (installed|fitted|mounted on the boom)$/, '');
    out.push({ label, value: showWeights ? `${item} (${formatLb(d.weightLb)})` : item });
  }
  if (rigging.length) out.push({ label: 'Rigging', value: riggingText(rigging) });
  return out;
}

function deductionSteps(chart: Chart, ids: readonly string[], rigging: readonly Rigging[]): { steps: string[]; total: number; parts: number[] } {
  const lines = deductionLines(chart, ids, rigging);
  const steps = lines.map((l) => `Deduct ${l.item}: ${formatLb(l.weightLb)}.`);
  const total = sum(lines.map((l) => l.weightLb));
  steps.push(`Total deductions: ${lines.map((l) => formatNumber(l.weightLb)).join(' + ')} = ${formatLb(total)}.`);
  return { steps, total, parts: lines.map((l) => l.weightLb) };
}

function deductionRefs(chart: Chart, ids: readonly string[]): CellRef[] {
  return ids.map((id) => ({ kind: 'deduction' as const, id, weightLb: getDeduction(chart, id).weightLb }));
}

function readSteps(chart: Chart, cfg: Configuration, L: number, R: number, rowR: number, colL: number, v: number): string[] {
  const s = [`Chart: ${cfg.label}.`];
  s.push(rowR === R ? `Find the ${R} ft radius row.` : `${R} ft is not listed: use the next longer radius, ${rowR} ft.`);
  if (chart.boom.type === 'articulating') s.push(`Move across to the column for ${boomPhrase(chart, colL)}.`);
  else s.push(colL === L ? `Move across to the ${L} ft boom column.` : `Move across to the ${colL} ft boom column.`);
  s.push(`Gross capacity: ${formatLb(v)}.`);
  return s;
}

function cellsWhere(pred: (c: Cell) => boolean): Cell[] {
  return ALL_CELLS.filter(pred);
}

// ---------------------------------------------------------------- families

function genReadGross(rng: Rng): Problem {
  const c = rng.pick(ALL_CELLS);
  const { chart, cfg, i, j, L, R, v } = c;
  const cands = nn(
    [val(cfg, i - 1, j), val(cfg, i, j - 1), val(cfg, i + 1, j), val(cfg, i, j + 1)],
    [
      'This is the next shorter radius row.',
      'This is the next shorter boom column.',
      'This is the next longer radius row.',
      'This is the next longer boom column.',
    ],
  );
  return finish(rng, {
    family: 'read-gross',
    fallbackWhy: 'Not the value in this cell: recheck the row and the column.',
    difficulty: 0.15,
    chartId: chart.id,
    setup: baseSetup(chart, cfg, L, R),
    stem: `What is the gross capacity with ${boomPhrase(chart, L)} at ${aOrAn(R)} ${R} ft radius?`,
    answerValue: v,
    unit: 'lb',
    correctWhy: `The ${R} ft row meets the ${L} ft column at ${formatLb(v)}.`,
    cands,
    step: 500,
    numeric: { stem: 'Enter the gross capacity in pounds.', value: v, unit: 'lb' },
    steps: readSteps(chart, cfg, L, R, R, L, v),
    cells: [capCell(c)],
    inputs: { family: 'read-gross', config: cfg.id, boomLength: L, radius: R },
    intermediates: [v],
  });
}

function between(rng: Rng, lo: number, hi: number): number {
  return rng.int(lo + 1, hi - 1);
}

function genRadiusBetween(rng: Rng): Problem {
  const pool = cellsWhere((c) => c.i > 0 && c.cfg.radiiFt[c.i] - c.cfg.radiiFt[c.i - 1] >= 2 && val(c.cfg, c.i - 1, c.j) !== null);
  const c = rng.pick(pool);
  const { chart, cfg, i, j, L, v } = c;
  const lo = cfg.radiiFt[i - 1];
  const r = between(rng, lo, c.R);
  const shorter = val(cfg, i - 1, j) as number;
  const interp = Math.round((shorter + ((v - shorter) * (r - lo)) / (c.R - lo)) / 10) * 10;
  const cands: Cand[] = [
    { value: shorter, why: `This is the ${lo} ft row. A radius between rows uses the next longer radius, never the shorter one.` },
    { value: interp, why: 'This interpolates between rows. Load charts are not interpolated: use the next longer radius.' },
    ...nn([val(cfg, i + 1, j), val(cfg, i, j + 1)], ['This skips a row: the next longer listed radius is the one just past the actual radius.', 'This is the wrong boom column.']),
  ];
  return finish(rng, {
    family: 'radius-between-rows',
    fallbackWhy: 'Not the value in this cell: recheck the row and the column.',
    difficulty: 0.3,
    chartId: chart.id,
    setup: baseSetup(chart, cfg, L, r),
    stem: `The load is at ${aOrAn(r)} ${r} ft radius, which is not listed. What gross capacity applies with ${boomPhrase(chart, L)}?`,
    answerValue: v,
    unit: 'lb',
    correctWhy: `${r} ft falls between ${lo} ft and ${c.R} ft, so use the ${c.R} ft row: ${formatLb(v)}.`,
    cands,
    step: 500,
    numeric: { stem: 'Enter the gross capacity in pounds.', value: v, unit: 'lb' },
    steps: readSteps(chart, cfg, L, r, c.R, L, v),
    cells: [capCell(c)],
    inputs: { family: 'radius-between-rows', config: cfg.id, boomLength: L, radius: r },
    intermediates: [v],
  });
}

function genBoomBetween(rng: Rng): Problem {
  const pool = cellsWhere(
    (c) => c.chart.boom.type === 'telescopic' && c.j > 0 && c.cfg.boomLengthsFt[c.j] - c.cfg.boomLengthsFt[c.j - 1] >= 2 && val(c.cfg, c.i, c.j - 1) !== null,
  );
  const c = rng.pick(pool);
  const { chart, cfg, i, j } = c;
  const loL = cfg.boomLengthsFt[j - 1];
  const L = between(rng, loL, c.L);
  // sometimes the radius is between rows as well
  let r = c.R;
  let rowR = c.R;
  if (i > 0 && c.R - cfg.radiiFt[i - 1] >= 2 && val(cfg, i - 1, j) !== null && val(cfg, i - 1, j - 1) !== null && rng.next() < 0.4) {
    r = between(rng, cfg.radiiFt[i - 1], c.R);
  }
  const res = capacityAt(chart, { config: cfg.id, boomLength: L, radius: r });
  if (!res.permitted) throw new Error('loadcharts: boom-between pool produced a blank cell');
  rowR = res.rowRadiusFt;
  const v = res.grossLb;
  const shorterBoom = val(cfg, i, j - 1) as number;
  const rule = chart.rules.betweenBoomLengths;
  const ruleText =
    rule === 'next-longer'
      ? `this chart says to use the next longer boom, ${c.L} ft`
      : `this chart says to use the lower of the ${loL} ft and ${c.L} ft capacities`;
  const steps = [`${L} ft is between the ${loL} ft and ${c.L} ft columns: ${ruleText}.`];
  if (r !== rowR) steps.push(`${r} ft is between rows: use the next longer radius, ${rowR} ft.`);
  if (rule === 'lower-of-adjacent') steps.push(`At ${rowR} ft: ${formatLb(shorterBoom)} (${loL} ft) and ${formatLb(v)} (${c.L} ft). The lower is ${formatLb(v)}.`);
  else steps.push(`At ${rowR} ft in the ${c.L} ft column: ${formatLb(v)}.`);
  const cells: CellRef[] = res.cells;
  const cands: Cand[] = [
    { value: shorterBoom, why: `This is the ${loL} ft column. Between boom lengths, never use the shorter boom's higher rating.` },
    { value: Math.round((shorterBoom + v) / 2 / 10) * 10, why: 'This averages two columns. Load charts are not interpolated.' },
    ...nn([val(cfg, i - 1, j), val(cfg, i, j + 1)], ['This is the shorter radius row.', 'This is a column too far.']),
  ];
  return finish(rng, {
    family: 'boom-between-lengths',
    fallbackWhy: 'Not the value in this cell: recheck the row and the column.',
    difficulty: r === c.R ? 0.4 : 0.55,
    chartId: chart.id,
    setup: baseSetup(chart, cfg, L, r),
    stem: `The boom is extended to ${L} ft, which is not a listed length. What gross capacity applies at ${aOrAn(r)} ${r} ft radius?`,
    answerValue: v,
    unit: 'lb',
    correctWhy: `Between listed booms ${ruleText}, giving ${formatLb(v)}.`,
    cands,
    step: 500,
    numeric: { stem: 'Enter the gross capacity in pounds.', value: v, unit: 'lb' },
    steps,
    cells,
    inputs: { family: 'boom-between-lengths', config: cfg.id, boomLength: L, radius: r },
    intermediates: [shorterBoom, v],
  });
}

function genDeductions(rng: Rng): Problem {
  const chart = rng.pick(CHARTS);
  const ids = mainLiftDeductions(chart, rng);
  const rigging = randomRigging(rng, chart.boom.type !== 'articulating');
  const d = deductionSteps(chart, ids, rigging);
  const jibId = ids.find((id) => ['jib-stowed', 'jib-erected'].includes(getDeduction(chart, id).kind));
  const blockLb = getDeduction(chart, ids[0]).weightLb;
  const riggingLb = sum(riggingLines(rigging).map((l) => l.weightLb));
  const multi = rigging.find((r) => r.count > 1);
  const cands: Cand[] = [];
  if (jibId) cands.push({ value: d.total - getDeduction(chart, jibId).weightLb, why: 'This leaves out the jib or extension. This chart deducts a stowed or erected jib.' });
  cands.push({ value: d.total - riggingLb, why: 'This leaves out the rigging. Slings, shackles, and spreaders are part of the load.' });
  if (multi) cands.push({ value: d.total - multi.eachLb * (multi.count - 1), why: `This counts one ${multi.item.replace(/s$/, '')} instead of ${multi.count}.` });
  cands.push({ value: d.total - blockLb, why: 'This leaves out the hook block or ball.' });
  return finish(rng, {
    family: 'deductions',
    difficulty: 0.3,
    chartId: chart.id,
    setup: [{ label: 'Chart', value: chart.title }, ...deductionSetup(chart, ids, rigging, false)],
    stem: 'Using the chart deductions, what is the total weight that must be deducted from the gross capacity?',
    answerValue: d.total,
    unit: 'lb',
    correctWhy: `Everything on the hook or carried on the boom is deducted: ${formatLb(d.total)}.`,
    cands,
    step: 50,
    numeric: { stem: 'Enter the total deductions in pounds.', value: d.total, unit: 'lb' },
    steps: d.steps,
    cells: deductionRefs(chart, ids),
    inputs: { family: 'deductions', deductionIds: ids, rigging },
    intermediates: [...d.parts, d.total],
  });
}

function genNetCapacity(rng: Rng): Problem {
  const pool = cellsWhere((c) => c.v >= 3000);
  let c: Cell;
  let ids: string[];
  let rigging: Rigging[];
  let d: ReturnType<typeof deductionSteps>;
  do {
    c = rng.pick(pool);
    ids = mainLiftDeductions(c.chart, rng);
    rigging = randomRigging(rng, c.v > 10000);
    d = deductionSteps(c.chart, ids, rigging);
  } while (c.v - d.total < Math.max(1000, c.v / 4));
  const { chart, cfg, i, j, L, v } = c;
  let r = c.R;
  if (i > 0 && c.R - cfg.radiiFt[i - 1] >= 2 && rng.next() < 0.35) r = between(rng, cfg.radiiFt[i - 1], c.R);
  const net = v - d.total;
  const jibId = ids.find((id) => ['jib-stowed', 'jib-erected'].includes(getDeduction(chart, id).kind));
  const cands: Cand[] = [];
  if (jibId) cands.push({ value: net + getDeduction(chart, jibId).weightLb, why: 'This forgets the jib or extension deduction.' });
  cands.push({ value: v, why: 'This is the gross capacity. Gross minus deductions is the net capacity.' });
  const sh = val(cfg, i - 1, j);
  if (r !== c.R && sh !== null) cands.push({ value: sh - d.total, why: 'This uses the shorter radius row. Use the next longer radius.' });
  cands.push({ value: net + sum(riggingLines(rigging).map((l) => l.weightLb)), why: 'This forgets the rigging. Slings and shackles are part of the load.' });
  cands.push({ value: v + d.total, why: 'This adds the deductions instead of subtracting them.' });
  return finish(rng, {
    family: 'net-capacity',
    difficulty: r === c.R ? 0.45 : 0.6,
    chartId: chart.id,
    setup: [...baseSetup(chart, cfg, L, r), ...deductionSetup(chart, ids, rigging, false)],
    stem: 'What is the net capacity: the heaviest load that may be hung below the rigging?',
    answerValue: net,
    unit: 'lb',
    correctWhy: `Gross ${formatLb(v)} minus ${formatLb(d.total)} of deductions.`,
    cands,
    step: 100,
    numeric: { stem: 'Enter the net capacity in pounds.', value: net, unit: 'lb' },
    steps: [...readSteps(chart, cfg, L, r, c.R, L, v), ...d.steps, `Net capacity: ${formatNumber(v)} − ${formatNumber(d.total)} = ${formatLb(net)}.`],
    cells: [capCell(c), ...deductionRefs(chart, ids)],
    inputs: { family: 'net-capacity', config: cfg.id, boomLength: L, radius: r, deductionIds: ids, rigging },
    intermediates: [v, ...d.parts, d.total, net],
  });
}

function marginText(m: number): string {
  if (m === 0) return 'Yes, exactly at the net capacity';
  return m > 0 ? `Yes, with ${formatLb(m)} to spare` : `No, ${formatLb(-m)} over the net capacity`;
}

function genCanLift(rng: Rng): Problem {
  const pool = cellsWhere((c) => c.v >= 4000);
  let c: Cell;
  let ids: string[];
  let rigging: Rigging[];
  let d: ReturnType<typeof deductionSteps>;
  do {
    c = rng.pick(pool);
    ids = mainLiftDeductions(c.chart, rng);
    rigging = randomRigging(rng, c.v > 10000);
    d = deductionSteps(c.chart, ids, rigging);
  } while (c.v - d.total < Math.max(2000, c.v / 4));
  const { chart, cfg, i, j, L, R, v } = c;
  const net = v - d.total;
  let delta = 0;
  while (delta === 0) delta = rng.int(-30, 20) * 50;
  const load = net - delta;
  const margin = net - load;
  const cands: Cand[] = [
    { value: -margin, why: 'The size is right but the decision is reversed: compare the load with the net capacity.' },
    { value: v - load, why: 'This compares the load with the gross capacity. Deduct the block, jib, and rigging first.' },
  ];
  const nextRow = val(cfg, i + 1, j);
  if (nextRow !== null) cands.push({ value: nextRow - d.total - load, why: 'This reads the wrong radius row.' });
  const shortRow = val(cfg, i - 1, j);
  if (shortRow !== null) cands.push({ value: shortRow - d.total - load, why: 'This reads the shorter radius row.' });
  return finish(rng, {
    family: 'can-lift',
    difficulty: 0.55,
    chartId: chart.id,
    setup: [...baseSetup(chart, cfg, L, R), ...deductionSetup(chart, ids, rigging, false), { label: 'Load', value: formatLb(load) }],
    stem: `Can the crane lift this ${formatLb(load)} load, and by how much?`,
    answerValue: margin,
    unit: 'lb',
    correctWhy: `Net capacity ${formatLb(net)} minus the ${formatLb(load)} load.`,
    cands,
    step: 100,
    mcText: marginText,
    numeric: { stem: 'Enter the margin in pounds: net capacity minus load (negative if the load is too heavy).', value: margin, unit: 'lb' },
    steps: [
      ...readSteps(chart, cfg, L, R, R, L, v),
      ...d.steps,
      `Net capacity: ${formatNumber(v)} − ${formatNumber(d.total)} = ${formatLb(net)}.`,
      margin >= 0
        ? `${formatNumber(net)} − ${formatNumber(load)} = ${formatLb(margin)}. The lift is within the chart.`
        : `${formatNumber(load)} is more than ${formatNumber(net)} by ${formatLb(-margin)}. Do not make this lift.`,
    ],
    cells: [capCell(c), ...deductionRefs(chart, ids)],
    inputs: { family: 'can-lift', config: cfg.id, boomLength: L, radius: R, deductionIds: ids, rigging, loadLb: load },
    intermediates: [v, ...d.parts, d.total, net, margin],
  });
}

const PERCENTS: { p: number; div: number }[] = [
  { p: 25, div: 400 },
  { p: 50, div: 200 },
  { p: 75, div: 400 },
  { p: 40, div: 500 },
  { p: 60, div: 500 },
  { p: 80, div: 500 },
  { p: 90, div: 1000 },
  { p: 70, div: 1000 },
];

function genPercent(rng: Rng): Problem {
  const pool = cellsWhere((c) => c.v >= 2000 && c.v % 200 === 0);
  for (let attempt = 0; ; attempt++) {
    const c = rng.pick(pool);
    const opts = PERCENTS.filter((o) => c.v % o.div === 0);
    if (!opts.length) continue;
    const { p } = rng.pick(opts);
    const total = (c.v * p) / 100;
    const { chart, cfg, i, j, L, R, v } = c;
    const block = blockFor(chart, rng);
    const rigging = randomRigging(rng, false);
    const riggingLb = sum(riggingLines(rigging).map((l) => l.weightLb));
    const load = total - block.weightLb - riggingLb;
    if (load < 200 && attempt < 50) continue;
    if (load <= 0) continue;
    const loadPct = Math.round((load / v) * 100);
    const cands: Cand[] = [
      { value: loadPct, why: 'This uses the load alone. The block and rigging count toward the total load.' },
      { value: 100 - p, why: 'This is the percent of capacity left over, not the percent used.' },
    ];
    const other = val(cfg, i + 1, j) ?? val(cfg, i, j + 1);
    if (other !== null) cands.push({ value: Math.round((total / other) * 100), why: 'This divides by the wrong chart cell.' });
    cands.push({ value: Math.round((v / total) * 10) * 10, why: 'This divides the capacity by the load, upside down.' });
    return finish(rng, {
      family: 'percent-capacity',
      difficulty: 0.5,
      chartId: chart.id,
      setup: [
        ...baseSetup(chart, cfg, L, R),
        ...(chart.jib ? [{ label: 'Jib/extension', value: 'Removed' }] : []),
        { label: block.kind === 'hook-block' ? 'Hook block' : 'Headache ball', value: `${block.item} (${formatLb(block.weightLb)})` },
        { label: 'Rigging', value: riggingText(rigging) },
        { label: 'Load', value: formatLb(load) },
      ],
      stem: 'What percent of the gross capacity does this lift use?',
      answerValue: p,
      unit: 'percent',
      correctWhy: `Total load ${formatLb(total)} divided by gross ${formatLb(v)}.`,
      cands,
      step: 5,
      numeric: { stem: 'Enter the percent of gross capacity used.', value: p, unit: 'percent' },
      steps: [
        ...readSteps(chart, cfg, L, R, R, L, v),
        `Total load: ${formatNumber(load)} + ${formatNumber(block.weightLb)} + ${formatNumber(riggingLb)} = ${formatLb(total)}.`,
        `${formatNumber(total)} ÷ ${formatNumber(v)} × 100 = ${p}%.`,
      ],
      cells: [capCell(c), ...deductionRefs(chart, [block.id])],
      inputs: { family: 'percent-capacity', config: cfg.id, boomLength: L, radius: R, deductionIds: [block.id], rigging, loadLb: load },
      intermediates: [v, block.weightLb, riggingLb, total, p],
    });
  }
}

type Pair = { chart: Chart; a: Configuration; b: Configuration; L: number; R: number; va: number; vb: number };

function configPairs(pred: (chart: Chart, a: Configuration, b: Configuration) => boolean): Pair[] {
  const out: Pair[] = [];
  for (const chart of CHARTS) {
    for (const a of chart.configurations) {
      for (const b of chart.configurations) {
        if (a === b || !pred(chart, a, b)) continue;
        a.radiiFt.forEach((R, i) =>
          a.boomLengthsFt.forEach((L, j) => {
            const va = a.capacitiesLb[i][j];
            const bi = b.radiiFt.indexOf(R);
            const bj = b.boomLengthsFt.indexOf(L);
            if (va === null || bi < 0 || bj < 0) return;
            const vb = b.capacitiesLb[bi][bj];
            if (vb === null || vb >= va) return;
            out.push({ chart, a, b, L, R, va, vb });
          }),
        );
      }
    }
  }
  return out;
}

const RANK: Record<string, number> = {
  'outriggers-full': 0,
  'tracks-extended': 0,
  'stabilizers-full': 0,
  'outriggers-mid': 1,
  'tracks-retracted': 1,
  'stabilizers-mid': 1,
  'on-rubber-stationary': 2,
  'on-rubber-creep': 3,
};

const CONFIG_PAIRS = configPairs(
  (_, a, b) => RANK[a.support] < RANK[b.support] && (a.workArea === b.workArea || b.workArea === '360' || RANK[a.support] <= 1),
);

function zone(cfg: Configuration): string {
  return cfg.workArea === 'over-front' ? ', boom over the front' : cfg.workArea === 'over-rear' ? ', boom over the rear' : '';
}

function lc(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function genConfiguration(rng: Rng): Problem {
  const pr = rng.pick(CONFIG_PAIRS);
  const { chart, a, b, L, R, va, vb } = pr;
  const ask: 'loss' | 'capacity' = rng.next() < 0.5 ? 'loss' : 'capacity';
  const ca = cellAtRef(chart, a, L, R);
  const cb = cellAtRef(chart, b, L, R);
  const loss = va - vb;
  const others = chart.configurations.filter((x) => x !== a && x !== b).map((x) => cellAtRef(chart, x, L, R)).filter((x) => x.valueLb !== null);
  const answer = ask === 'loss' ? loss : vb;
  const cands: Cand[] =
    ask === 'loss'
      ? [
          { value: vb, why: 'This is the new capacity, not the capacity lost.' },
          { value: va, why: 'This is the original capacity, not the capacity lost.' },
          ...others.map((o) => ({ value: va - (o.valueLb as number), why: 'This reads the wrong configuration chart.' })),
          { value: Math.round(loss / 2 / 50) * 50, why: 'An arithmetic slip.' },
        ]
      : [
          { value: va, why: 'This is the original configuration. Once the setup changes, the chart for the new setup governs.' },
          ...others.map((o) => ({ value: o.valueLb as number, why: 'This reads the wrong configuration chart.' })),
        ];
  return finish(rng, {
    family: 'configuration',
    difficulty: ask === 'loss' ? 0.45 : 0.35,
    chartId: chart.id,
    setup: [...baseSetup(chart, null, L, R), { label: 'Planned setup', value: a.label }, { label: 'Actual setup', value: b.label }],
    stem:
      ask === 'loss'
        ? `Planned: ${lc(a.label)}. Actual: ${lc(b.label)}. Same boom and radius${zone(b)}. How much gross capacity is lost?`
        : `Planned: ${lc(a.label)}. Actual: ${lc(b.label)}. Same boom and radius${zone(b)}. What gross capacity applies now?`,
    answerValue: answer,
    unit: 'lb',
    correctWhy:
      ask === 'loss'
        ? `${formatLb(va)} on the planned setup minus ${formatLb(vb)} on the actual setup.`
        : `The actual setup's chart governs: ${formatLb(vb)}.`,
    cands,
    step: 500,
    numeric: { stem: ask === 'loss' ? 'Enter the capacity lost in pounds.' : 'Enter the gross capacity in pounds.', value: answer, unit: 'lb' },
    steps: [
      `Planned setup, ${R} ft radius, ${boomPhrase(chart, L)}: ${formatLb(va)}.`,
      `Actual setup, same boom and radius: ${formatLb(vb)}.`,
      ask === 'loss' ? `Capacity lost: ${formatNumber(va)} − ${formatNumber(vb)} = ${formatLb(loss)}.` : `Use the actual setup's chart: ${formatLb(vb)}.`,
    ],
    cells: [ca, cb],
    inputs: { family: 'configuration', ask, fromConfig: a.id, toConfig: b.id, boomLength: L, radius: R },
    intermediates: [va, vb, loss],
  });
}

function cellAtRef(chart: Chart, cfg: Configuration, L: number, R: number): CapacityCell {
  const i = cfg.radiiFt.indexOf(R);
  const j = cfg.boomLengthsFt.indexOf(L);
  const ok = i >= 0 && j >= 0;
  return {
    kind: 'capacity',
    config: cfg.id,
    boomLengthFt: L,
    radiusFt: R,
    valueLb: ok ? cfg.capacitiesLb[i][j] : null,
    structural: ok ? cfg.structural[i][j] : false,
  };
}

/** Jib ratings apply on the strongest support only (outriggers or tracks fully extended). */
function jibSetupLabel(chart: Chart): string {
  const cfg = chart.configurations.find((c) => c.support === 'outriggers-full' || c.support === 'tracks-extended');
  if (!cfg) throw new Error(`loadcharts: ${chart.id} jib has no full-support configuration`);
  return cfg.label;
}

type JibPick = { chart: Chart; t: NonNullable<Chart['jib']>['tables'][number]; k: number };

const JIB_POOL: JibPick[] = CHARTS.flatMap((chart) =>
  (chart.jib?.tables ?? []).flatMap((t) =>
    t.keys.flatMap((_, k) => {
      const v = t.capacitiesLb[k];
      if (v === null || v < 1500 || k === 0) return [];
      if (Math.abs(t.keys[k] - t.keys[k - 1]) < 2) return [];
      return [{ chart, t, k }];
    }),
  ),
);

function genJib(rng: Rng): Problem {
  const { chart, t, k } = rng.pick(JIB_POOL);
  const v = t.capacitiesLb[k] as number;
  const byAngle = t.basis === 'boom-angle';
  // boom-angle keys descend: an angle between keys[k] and keys[k-1] uses keys[k] (next lower).
  // radius keys ascend: a radius between keys[k-1] and keys[k] uses keys[k] (next longer).
  const exact = rng.next() < 0.35;
  const lo = Math.min(t.keys[k], t.keys[k - 1]);
  const hi = Math.max(t.keys[k], t.keys[k - 1]);
  const key = exact ? t.keys[k] : between(rng, lo, hi);
  const ball = chart.deductions.find((d) => d.kind === 'headache-ball');
  if (!ball) throw new Error(`loadcharts: ${chart.id} jib needs a headache ball`);
  const ids = [ball.id];
  const mainBlocks = chart.deductions.filter((d) => d.kind === 'hook-block');
  if (rng.next() < 0.5) ids.push(rng.pick(mainBlocks).id);
  const rigging = randomRigging(rng, false).slice(0, 1);
  const d = deductionSteps(chart, ids, rigging);
  const net = v - d.total;
  const res = jibCapacityAt(chart, {
    jibLength: t.jibLengthFt,
    offsetDeg: t.offsetDeg,
    mainBoomLength: t.mainBoomLengthFt,
    boomAngle: byAngle ? key : undefined,
    radius: byAngle ? undefined : key,
  });
  if (!res.permitted || res.grossLb !== v) throw new Error('loadcharts: jib pool lookup mismatch');
  const wrongRow = t.capacitiesLb[k - 1];
  const otherOffset = chart.jib?.tables.find(
    (x) => x.jibLengthFt === t.jibLengthFt && x.mainBoomLengthFt === t.mainBoomLengthFt && x.offsetDeg !== t.offsetDeg && x.keys[k] === t.keys[k],
  );
  const oo = otherOffset?.capacitiesLb[k] ?? null;
  const cands: Cand[] = [];
  if (wrongRow !== null && !exact)
    cands.push({
      value: wrongRow - d.total,
      why: byAngle ? 'This uses the next higher boom angle. Between angles, use the next lower angle.' : 'This uses the shorter radius row. Use the next longer radius.',
    });
  cands.push({ value: v, why: 'This is the gross jib rating. Deduct the ball, any main block left reeved, and the rigging.' });
  if (ids.length > 1) cands.push({ value: net + getDeduction(chart, ids[1]).weightLb, why: 'This forgets the main hook block that stays reeved on the main boom.' });
  if (oo !== null) cands.push({ value: oo - d.total, why: 'This reads the wrong offset column.' });
  const keyText = byAngle ? `${key}° loaded main boom angle` : `${key} ft radius`;
  return finish(rng, {
    family: 'jib',
    difficulty: exact ? 0.55 : 0.7,
    chartId: chart.id,
    setup: [
      { label: 'Chart', value: chart.title },
      { label: 'Configuration', value: jibSetupLabel(chart) },
      { label: 'Main boom', value: `${t.mainBoomLengthFt} ft` },
      { label: 'Jib/extension', value: `${t.jibLengthFt} ft at ${t.offsetDeg}° offset, lifting from it` },
      { label: byAngle ? 'Main boom angle' : 'Radius', value: byAngle ? `${key}°` : `${key} ft` },
      { label: 'Ball on the jib line', value: ball.item },
      ...(ids.length > 1 ? [{ label: 'Main hook block', value: `${getDeduction(chart, ids[1]).item}, left reeved on the main boom` }] : []),
      { label: 'Rigging', value: riggingText(rigging) },
    ],
    stem: `Lifting from the ${t.jibLengthFt} ft jib at ${t.offsetDeg}° offset, ${keyText}: what is the net capacity?`,
    answerValue: net,
    unit: 'lb',
    correctWhy: `Jib rating ${formatLb(v)} minus ${formatLb(d.total)} of deductions.`,
    cands,
    step: 100,
    numeric: { stem: 'Enter the net jib capacity in pounds.', value: net, unit: 'lb' },
    steps: [
      `Use the ${t.jibLengthFt} ft jib, ${t.offsetDeg}° offset column${chart.jib && chart.jib.tables.some((x) => x.mainBoomLengthFt !== t.mainBoomLengthFt) ? ` for the ${t.mainBoomLengthFt} ft main boom` : ''}.`,
      ...res.rules,
      `Jib rating at ${byAngle ? `${t.keys[k]}°` : `${t.keys[k]} ft`}: ${formatLb(v)}.`,
      ...d.steps,
      `Net jib capacity: ${formatNumber(v)} − ${formatNumber(d.total)} = ${formatLb(net)}.`,
    ],
    cells: [res.cell, ...deductionRefs(chart, ids)],
    inputs: {
      family: 'jib',
      jibLength: t.jibLengthFt,
      offsetDeg: t.offsetDeg,
      mainBoomLength: t.mainBoomLengthFt,
      boomAngle: byAngle ? key : undefined,
      radius: byAngle ? undefined : key,
      deductionIds: ids,
      rigging,
    },
    intermediates: [v, ...d.parts, d.total, net],
  });
}

function genPartsOfLine(rng: Rng): Problem {
  const chart = rng.pick(CHARTS.filter((c) => c.linePull !== null));
  const lp = chart.linePull as NonNullable<Chart['linePull']>;
  const P = lp.maxPermissibleLinePullLb;
  const block = rng.pick(chart.deductions.filter((d) => d.kind === 'hook-block' && (d.maxParts ?? 1) >= 2));
  const maxN = Math.min(lp.maxParts, block.maxParts ?? 1);
  const n = rng.int(2, maxN);
  const rigging = randomRigging(rng, n > 3);
  const riggingLb = sum(riggingLines(rigging).map((l) => l.weightLb));
  const stepLb = P >= 10000 ? 500 : 100;
  let total = (n - 1) * P + rng.int(1, P / stepLb) * stepLb;
  if (total - block.weightLb - riggingLb <= 0) total = n * P;
  const load = total - block.weightLb - riggingLb;
  const parts = requiredParts(total, P);
  const cands: Cand[] = [
    { value: Math.floor(total / P), why: 'This rounds down. A fraction of a part means one more part is needed.' },
    { value: requiredParts(load, P), why: 'This uses the load alone. The block and rigging also hang on the line.' },
    { value: parts + 1, why: 'One part more than needed: the minimum is the smallest whole number that carries the total load.' },
    { value: parts - 1, why: 'One part too few: each part would carry more than the permissible line pull.' },
  ];
  const row = lp.rows.find((r) => r.parts === parts) as { parts: number; maxLoadLb: number };
  return finish(rng, {
    family: 'parts-of-line',
    difficulty: 0.45,
    chartId: chart.id,
    setup: [
      { label: 'Chart', value: chart.title },
      { label: 'Permissible line pull', value: `${formatLb(P)} per part` },
      { label: 'Hook block', value: `${block.item} (${formatLb(block.weightLb)})` },
      { label: 'Rigging', value: riggingText(rigging) },
      { label: 'Load', value: formatLb(load) },
    ],
    stem: 'What is the minimum number of parts of line needed for this lift?',
    answerValue: parts,
    unit: 'parts',
    correctWhy: `${formatLb(total)} ÷ ${formatLb(P)} per part, rounded up.`,
    cands,
    step: 1,
    numeric: { stem: 'Enter the minimum parts of line.', value: parts, unit: 'parts' },
    steps: [
      `Total on the line: ${formatNumber(load)} + ${formatNumber(block.weightLb)} + ${formatNumber(riggingLb)} = ${formatLb(total)}.`,
      `${formatNumber(total)} ÷ ${formatNumber(P)} = ${total % P === 0 ? formatNumber(total / P) : `${formatNumber(Math.floor(total / P))} and a remainder`}.`,
      `Round up: ${parts} parts. Check the line-pull table: ${parts} parts carry ${formatLb(row.maxLoadLb)}.`,
    ],
    cells: [...deductionRefs(chart, [block.id]), { kind: 'line-pull', parts, maxLoadLb: row.maxLoadLb }],
    inputs: { family: 'parts-of-line', loadLb: load, deductionIds: [block.id], rigging, linePullLb: P },
    intermediates: [load, block.weightLb, riggingLb, total, parts],
  });
}

function genLoadWeight(rng: Rng): Problem {
  const shape: 'concrete-block' | 'steel-plate' = rng.next() < 0.5 ? 'concrete-block' : 'steel-plate';
  let l: number;
  let w: number;
  let t: number;
  let weight: number;
  let vol: number;
  let density: number;
  if (shape === 'concrete-block') {
    density = 150;
    l = rng.int(2, 10);
    w = rng.int(2, 6);
    t = rng.int(1, 4);
    vol = l * w * t;
    weight = vol * density;
  } else {
    density = 490;
    for (;;) {
      l = rng.int(4, 20);
      w = rng.int(2, 8);
      t = rng.pick([1, 2, 3, 4, 6]);
      if ((l * w * t) % 12 === 0) break;
    }
    vol = (l * w * t) / 12;
    weight = vol * density;
  }
  const ask: 'weight' | 'margin' = rng.next() < 0.5 ? 'weight' : 'margin';
  const dimText =
    shape === 'concrete-block'
      ? `a concrete block ${l} ft × ${w} ft × ${t} ft (concrete weighs ${density} lb per cubic foot)`
      : `a steel plate ${l} ft × ${w} ft × ${t} in thick (steel weighs ${density} lb per cubic foot)`;
  const volStep =
    shape === 'concrete-block'
      ? `Volume: ${l} × ${w} × ${t} = ${vol} cubic feet.`
      : `Thickness ${t} in = ${t}/12 ft. Volume: ${l} × ${w} × ${t} ÷ 12 = ${formatNumber(vol)} cubic feet.`;
  const weightStep = `Weight: ${formatNumber(vol)} × ${density} = ${formatLb(weight)}.`;
  const wrongCands: Cand[] =
    shape === 'concrete-block'
      ? [
          { value: vol * 490, why: 'This uses the density of steel. The load is concrete.' },
          { value: l * w * density, why: 'This leaves out one dimension.' },
          { value: vol * 100, why: 'This uses the wrong density: concrete is given as 150 lb per cubic foot.' },
        ]
      : [
          { value: l * w * t * density, why: 'This treats inches as feet. Divide the thickness in inches by 12.' },
          { value: vol * 150, why: 'This uses the density of concrete. The load is steel.' },
          { value: l * w * density, why: 'This leaves out the thickness.' },
        ];
  if (ask === 'weight') {
    return finish(rng, {
      family: 'load-weight',
      difficulty: shape === 'concrete-block' ? 0.3 : 0.4,
      chartId: rng.pick(CHARTS).id,
      setup: [{ label: 'Load', value: dimText.charAt(0).toUpperCase() + dimText.slice(1) }],
      stem: `What does ${dimText.replace(/ \(.*\)$/, '')} weigh?`,
      answerValue: weight,
      unit: 'lb',
      correctWhy: `${formatNumber(vol)} cubic feet × ${density} lb per cubic foot.`,
      cands: wrongCands,
      step: density,
      numeric: { stem: 'Enter the load weight in pounds.', value: weight, unit: 'lb' },
      steps: [volStep, weightStep],
      cells: [],
      inputs: { family: 'load-weight', ask, shape, lengthFt: l, widthFt: w, thickness: t, densityLbFt3: density },
      intermediates: [vol, weight],
    });
  }
  // margin against a chart cell whose net capacity covers the load
  const ids0: string[] = [];
  const fit = cellsWhere((x) => x.v >= weight + 1500 && x.v <= weight * 3 + 3000);
  const c = rng.pick(fit.length ? fit : cellsWhere((x) => x.v >= weight + 1500));
  const { chart, cfg, L, R, v } = c;
  ids0.push(blockFor(chart, rng).id);
  const rigging = randomRigging(rng, false);
  const d = deductionSteps(chart, ids0, rigging);
  const net = v - d.total;
  const margin = net - weight;
  return finish(rng, {
    family: 'load-weight',
    difficulty: 0.65,
    chartId: chart.id,
    setup: [
      ...baseSetup(chart, cfg, L, R),
      ...deductionSetup(chart, ids0, rigging, true),
      { label: 'Load', value: dimText.charAt(0).toUpperCase() + dimText.slice(1) },
    ],
    stem: 'Work out the load weight, then the margin: net capacity minus load weight. What is the margin?',
    answerValue: margin,
    unit: 'lb',
    correctWhy: `Net capacity ${formatLb(net)} minus the ${formatLb(weight)} load.`,
    cands: [
      ...wrongCands.map((x) => ({ value: net - x.value, why: x.why })),
      { value: v - weight, why: 'This compares the load with the gross capacity. Deduct the block and rigging first.' },
    ],
    step: 100,
    mcText: marginText,
    numeric: { stem: 'Enter the margin in pounds (negative if the load is too heavy).', value: margin, unit: 'lb' },
    steps: [
      volStep,
      weightStep,
      ...readSteps(chart, cfg, L, R, R, L, v),
      ...d.steps,
      `Net capacity: ${formatNumber(v)} − ${formatNumber(d.total)} = ${formatLb(net)}.`,
      margin >= 0
        ? `Margin: ${formatNumber(net)} − ${formatNumber(weight)} = ${formatLb(margin)}.`
        : `${formatNumber(weight)} is more than ${formatNumber(net)} by ${formatLb(-margin)}. Do not make this lift.`,
    ],
    cells: [capCell(c), ...deductionRefs(chart, ids0)],
    inputs: {
      family: 'load-weight',
      ask,
      shape,
      lengthFt: l,
      widthFt: w,
      thickness: t,
      densityLbFt3: density,
      config: cfg.id,
      boomLength: L,
      radius: R,
      deductionIds: ids0,
      rigging,
    },
    intermediates: [vol, weight, v, ...d.parts, d.total, net, margin],
  });
}

type RangePick = { chart: Chart; L: number; R: number; i: number; j: number };
const RANGE_POOL: RangePick[] = CHARTS.flatMap((chart) => {
  const rd = chart.rangeDiagram;
  if (!rd) return [];
  return rd.radiiFt.flatMap((R, i) => rd.boomLengthsFt.flatMap((L, j) => (rd.angleDeg[i][j] === null ? [] : [{ chart, L, R, i, j }])));
});

function offsetText(off: number): string {
  if (off === 0) return 'on the centerline of rotation';
  return off > 0 ? `${off} ft ahead of the centerline of rotation` : `${-off} ft behind the centerline of rotation`;
}

function genRange(rng: Rng): Problem {
  const ask = rng.pick(['angle', 'tip-height', 'radius-from-rise', 'radius-at-60', 'clearance'] as const);
  if (ask === 'angle' || ask === 'tip-height') {
    const { chart, L, R, i, j } = rng.pick(RANGE_POOL);
    const rd = chart.rangeDiagram as NonNullable<Chart['rangeDiagram']>;
    const cell = rangeAt(chart, L, R) as RangeCell;
    const g = chart.geometry as NonNullable<Chart['geometry']>;
    const near = (di: number, dj: number): number | null => {
      const row = rd.radiiFt[i + di] !== undefined ? (ask === 'angle' ? rd.angleDeg : rd.tipHeightFt)[i + di] : undefined;
      return row ? (row[j + dj] ?? null) : null;
    };
    const answer = ask === 'angle' ? cell.angleDeg : cell.tipHeightFt;
    const cands: Cand[] =
      ask === 'angle'
        ? [
            { value: 90 - cell.angleDeg, why: 'This is the angle from vertical. Boom angle is measured up from horizontal.' },
            ...nn([near(-1, 0), near(1, 0), near(0, 1)], ['This is the next shorter radius.', 'This is the next longer radius.', 'This is the next longer boom.']),
          ]
        : [
            { value: cell.tipHeightFt - g.pivotHeightFt, why: 'This leaves out the height of the boom foot pin above the ground.' },
            ...nn([near(-1, 0), near(1, 0), near(0, 1)], ['This is the next shorter radius.', 'This is the next longer radius.', 'This is the next longer boom.']),
          ];
    return finish(rng, {
      family: 'range-diagram',
      difficulty: 0.35,
      fallbackWhy: 'Not where this boom arc meets this radius: recheck the diagram.',
      chartId: chart.id,
      setup: [{ label: 'Chart', value: chart.title }, { label: 'Main boom', value: `${L} ft` }, { label: 'Radius', value: `${R} ft` }],
      stem: ask === 'angle' ? `From the range diagram, what is the loaded boom angle with ${aOrAn(L)} ${L} ft boom at ${aOrAn(R)} ${R} ft radius?` : `From the range diagram, how high is the boom tip with ${aOrAn(L)} ${L} ft boom at ${aOrAn(R)} ${R} ft radius?`,
      answerValue: answer,
      unit: ask === 'angle' ? 'deg' : 'ft',
      correctWhy: `The ${L} ft boom arc crosses the ${R} ft radius line at ${ask === 'angle' ? `${cell.angleDeg}°` : `${cell.tipHeightFt} ft tip height`}.`,
      cands,
      step: ask === 'angle' ? 2 : 3,
      numeric: { stem: ask === 'angle' ? 'Enter the boom angle in degrees.' : 'Enter the tip height in feet.', value: answer, unit: ask === 'angle' ? 'deg' : 'ft' },
      steps: [
        `On the range diagram, follow the ${L} ft boom arc to the ${R} ft radius line.`,
        ask === 'angle' ? `Read the boom angle: ${cell.angleDeg}°.` : `Read the tip height (ground to boom tip): ${cell.tipHeightFt} ft.`,
      ],
      cells: [cell],
      inputs: { family: 'range-diagram', ask, boomLength: L, radius: R },
      intermediates: [answer],
    });
  }
  // geometry on a right triangle
  const geoCharts = CHARTS.filter((c) => c.geometry !== null);
  const chart = rng.pick(geoCharts);
  const g = chart.geometry as NonNullable<Chart['geometry']>;
  const lengths: number[] = [];
  for (let L = chart.boom.minLengthFt; L <= chart.boom.maxLengthFt; L++) {
    if (chart.boom.type === 'lattice' && !chart.configurations[0].boomLengthsFt.includes(L)) continue;
    if (L % 10 === 0) lengths.push(L);
  }
  const L = rng.pick(lengths);
  const k = L / 5;
  const setup = [
    { label: 'Chart', value: chart.title },
    { label: 'Main boom', value: `${L} ft` },
    { label: 'Boom foot pin', value: `${offsetText(g.pivotOffsetFt)}, ${g.pivotHeightFt} ft above the ground` },
  ];
  const geoRef: CellRef = { kind: 'geometry', pivotOffsetFt: g.pivotOffsetFt, pivotHeightFt: g.pivotHeightFt };
  if (ask === 'radius-at-60') {
    const half = L / 2;
    const radius = half + g.pivotOffsetFt;
    return finish(rng, {
      family: 'range-diagram',
      difficulty: 0.5,
      chartId: chart.id,
      setup: [...setup, { label: 'Loaded boom angle', value: '60°' }],
      stem: `At a 60° loaded boom angle the boom reaches out half its length (cos 60° = 0.5). What is the operating radius?`,
      answerValue: radius,
      unit: 'ft',
      correctWhy: `${L} × 0.5 = ${formatNumber(half)} ft from the foot pin, then adjust for where the foot pin sits.`,
      cands: [
        { value: half, why: 'This measures from the foot pin. Radius is measured from the centerline of rotation.' },
        { value: half - g.pivotOffsetFt, why: 'This applies the foot-pin offset the wrong way.' },
        { value: L, why: 'This is the boom length, not the radius.' },
      ],
      step: 2,
      numeric: { stem: 'Enter the radius in feet.', value: radius, unit: 'ft' },
      steps: [
        `Horizontal reach from the foot pin: ${L} × cos 60° = ${L} × 0.5 = ${formatNumber(half)} ft.`,
        g.pivotOffsetFt === 0
          ? `The foot pin is on the centerline, so the radius is ${formatNumber(radius)} ft.`
          : `The foot pin is ${offsetText(g.pivotOffsetFt)}: ${formatNumber(half)} ${g.pivotOffsetFt > 0 ? '+' : '−'} ${Math.abs(g.pivotOffsetFt)} = ${formatNumber(radius)} ft.`,
      ],
      cells: [geoRef],
      inputs: { family: 'range-diagram', ask, boomLength: L },
      intermediates: [half, radius],
    });
  }
  // 3-4-5 right triangle: rise and run are 3k and 4k in some order
  const riseIsFour = rng.next() < 0.5;
  const rise = (riseIsFour ? 4 : 3) * k;
  const run = (riseIsFour ? 3 : 4) * k;
  const radius = run + g.pivotOffsetFt;
  const tip = rise + g.pivotHeightFt;
  if (ask === 'radius-from-rise') {
    return finish(rng, {
      family: 'range-diagram',
      difficulty: 0.6,
      chartId: chart.id,
      setup: [...setup, { label: 'Boom tip', value: `${rise} ft above the foot pin` }],
      stem: 'The boom, its rise, and its horizontal reach form a right triangle. What is the operating radius?',
      answerValue: radius,
      unit: 'ft',
      correctWhy: `A 3-4-5 triangle: reach ${run} ft from the foot pin, then adjust for where the foot pin sits.`,
      cands: [
        { value: run, why: 'This measures from the foot pin. Radius is measured from the centerline of rotation.' },
        { value: run - g.pivotOffsetFt, why: 'This applies the foot-pin offset the wrong way.' },
        { value: L - rise + g.pivotOffsetFt, why: 'This subtracts lengths instead of using the right triangle.' },
        { value: rise + g.pivotOffsetFt, why: 'This swaps the rise and the reach.' },
      ],
      step: 2,
      numeric: { stem: 'Enter the radius in feet.', value: radius, unit: 'ft' },
      steps: [
        `Right triangle: boom ${L} ft is the long side, rise ${rise} ft is one side.`,
        `${L} = 5 × ${k} and ${rise} = ${riseIsFour ? 4 : 3} × ${k}: a 3-4-5 right triangle. Reach from the foot pin = ${riseIsFour ? 3 : 4} × ${k} = ${run} ft.`,
        g.pivotOffsetFt === 0
          ? `Radius: ${radius} ft.`
          : `Radius: ${run} ${g.pivotOffsetFt > 0 ? '+' : '−'} ${Math.abs(g.pivotOffsetFt)} = ${radius} ft.`,
      ],
      cells: [geoRef],
      inputs: { family: 'range-diagram', ask, boomLength: L, riseFt: rise },
      intermediates: [k, run, radius],
    });
  }
  // clearance: radius known, find tip height, compare with an obstacle
  const obstacle = tip - rng.int(1, Math.max(1, Math.min(15, Math.floor(rise / 2))));
  const clearance = tip - obstacle;
  return finish(rng, {
    family: 'range-diagram',
    difficulty: 0.7,
    chartId: chart.id,
    setup: [...setup, { label: 'Radius', value: `${radius} ft` }, { label: 'Obstacle', value: `Roof edge ${obstacle} ft high, under the boom` }],
    stem: 'How far above the roof edge is the boom tip?',
    answerValue: clearance,
    unit: 'ft',
    correctWhy: `Tip height ${tip} ft minus the ${obstacle} ft roof edge.`,
    cands: [
      { value: clearance - g.pivotHeightFt, why: 'This leaves out the height of the foot pin above the ground.' },
      { value: Math.abs(run + g.pivotHeightFt - obstacle), why: 'This swaps the rise and the reach.' },
      { value: clearance + g.pivotHeightFt, why: 'This counts the foot-pin height twice.' },
    ],
    step: 2,
    numeric: { stem: 'Enter the clearance in feet.', value: clearance, unit: 'ft' },
    steps: [
      g.pivotOffsetFt === 0
        ? `Reach from the foot pin: ${run} ft.`
        : `Reach from the foot pin: ${radius} ${g.pivotOffsetFt > 0 ? '−' : '+'} ${Math.abs(g.pivotOffsetFt)} = ${run} ft.`,
      `${L} = 5 × ${k} and ${run} = ${riseIsFour ? 3 : 4} × ${k}: a 3-4-5 right triangle. Rise = ${riseIsFour ? 4 : 3} × ${k} = ${rise} ft.`,
      `Tip height: ${rise} + ${g.pivotHeightFt} = ${tip} ft.`,
      `Clearance: ${tip} − ${obstacle} = ${clearance} ft.`,
    ],
    cells: [geoRef],
    inputs: { family: 'range-diagram', ask, boomLength: L, radius, obstacleFt: obstacle },
    intermediates: [run, k, rise, tip, clearance],
  });
}

type ColPick = { chart: Chart; cfg: Configuration; L: number; first: number };
const STRUCT_POOL: ColPick[] = CHARTS.flatMap((chart) =>
  chart.configurations.flatMap((cfg) =>
    cfg.boomLengthsFt.flatMap((L, j) => {
      const first = firstStabilityRadius(chart, cfg.id, L);
      if (first === null) return [];
      const i = cfg.radiiFt.indexOf(first);
      const anyStructAbove = cfg.radiiFt.slice(0, i).some((_, k) => cfg.capacitiesLb[k][j] !== null && cfg.structural[k][j]);
      return anyStructAbove ? [{ chart, cfg, L, first }] : [];
    }),
  ),
);

function genStructural(rng: Rng): Problem {
  if (rng.next() < 0.7) {
    const { chart, cfg, L, first } = rng.pick(STRUCT_POOL);
    const j = cfg.boomLengthsFt.indexOf(L);
    const i = cfg.radiiFt.indexOf(first);
    let lastStruct = first;
    for (let k = i - 1; k >= 0; k--)
      if (cfg.capacitiesLb[k][j] !== null) {
        lastStruct = cfg.radiiFt[k];
        break;
      }
    const cells: CellRef[] = [cellAtRef(chart, cfg, L, lastStruct), cellAtRef(chart, cfg, L, first)];
    const nextR = cfg.radiiFt[i + 1];
    return finish(rng, {
      family: 'structural-vs-stability',
      difficulty: 0.5,
      fallbackWhy: 'Not the first unshaded cell in this column.',
      chartId: chart.id,
      setup: baseSetup(chart, cfg, L),
      stem: `Shaded cells are limited by structural strength. In the column for ${boomPhrase(chart, L)}, what is the shortest listed radius where the rating is limited by stability (tipping) instead?`,
      answerValue: first,
      unit: 'ft',
      correctWhy: `${first} ft is the first unshaded cell in that column: from there down, tipping governs.`,
      cands: [
        { value: lastStruct, why: 'This is the last shaded cell, which is still limited by structural strength.' },
        ...(nextR !== undefined ? [{ value: nextR, why: 'This is one row past the first stability-limited cell.' }] : []),
        { value: cfg.radiiFt[0], why: 'Short radii are where structural strength governs, not stability.' },
      ],
      step: 5,
      numeric: { stem: 'Enter the radius in feet.', value: first, unit: 'ft' },
      steps: [
        `Go down the column for ${boomPhrase(chart, L)}.`,
        `Shaded through ${lastStruct} ft: structural strength limits those ratings. A crane can fail there without tipping.`,
        `The first unshaded cell is at ${first} ft: stability limits the rating from there on (no more than ${cfg.stabilityPercent}% of tipping).`,
      ],
      cells,
      inputs: { family: 'structural-vs-stability', ask: 'first-stability-radius', config: cfg.id, boomLength: L },
      intermediates: [first],
    });
  }
  const chart = rng.pick(CHARTS);
  const cfg = rng.pick(chart.configurations);
  const p = cfg.stabilityPercent;
  return finish(rng, {
    family: 'structural-vs-stability',
    difficulty: 0.25,
    fallbackWhy: 'Not a rating margin on these charts.',
    chartId: chart.id,
    setup: baseSetup(chart, cfg),
    stem: `${cfg.label}: stability-limited ratings on this chart are no more than what percent of the load that would tip the crane?`,
    answerValue: p,
    unit: 'percent',
    correctWhy: p === 85 ? 'On outriggers or stabilizers, ratings stay within 85% of tipping.' : 'On rubber or crawlers, ratings stay within 75% of tipping.',
    cands: [
      { value: p === 85 ? 75 : 85, why: p === 85 ? '75% applies on rubber and on crawlers.' : '85% applies on outriggers and stabilizers.' },
      { value: 100, why: 'Ratings never go to the tipping point. They keep a margin below it.' },
      { value: 66, why: 'Not a rating margin on these charts.' },
    ],
    step: 5,
    numeric: { stem: 'Enter the percent.', value: p, unit: 'percent' },
    steps: [`Read the chart notes for ${lc(cfg.label)}.`, `Stability-limited ratings do not exceed ${p}% of tipping.`],
    cells: [{ kind: 'stability-percent', config: cfg.id, percent: p }],
    inputs: { family: 'structural-vs-stability', ask: 'stability-percent', config: cfg.id },
    intermediates: [p],
  });
}

const QUAD_PAIRS: Pair[] = configPairs((chart, a, b) => a.support === b.support && a.workArea === 'over-front' && b.workArea === '360').filter(
  (p) => p.va - p.vb >= 200 && configsForPosition(p.chart, p.a.support, 'side').includes(p.b),
);

function genQuadrants(rng: Rng): Problem {
  const pr = rng.pick(QUAD_PAIRS);
  const { chart, a, b, L, R, va, vb } = pr;
  const ask: 'side-capacity' | 'excess' = rng.next() < 0.5 ? 'side-capacity' : 'excess';
  const ca = cellAtRef(chart, a, L, R);
  const cb = cellAtRef(chart, b, L, R);
  const outr = chart.configurations.find((x) => x.support === 'outriggers-full');
  const vo = outr ? cellAtRef(chart, outr, L, R).valueLb : null;
  const baseSetupRows = [
    ...baseSetup(chart, null, L, R),
    { label: 'Setup', value: 'On rubber, stationary' },
    { label: 'Lift', value: 'Picked over the front, then swung over the side' },
  ];
  if (ask === 'side-capacity') {
    return finish(rng, {
      family: 'quadrants',
      difficulty: 0.5,
      chartId: chart.id,
      setup: baseSetupRows,
      stem: 'The load is picked over the front on rubber, then swung over the side. What gross capacity governs once the boom is over the side?',
      answerValue: vb,
      unit: 'lb',
      correctWhy: `Over the side, only the 360° on-rubber chart applies: ${formatLb(vb)}.`,
      cands: [
        { value: va, why: 'This is the over-front rating. It applies only while the boom is in the over-front zone.' },
        ...(vo !== null ? [{ value: vo, why: 'This is the outrigger chart. The crane is on rubber.' }] : []),
        { value: va - vb, why: 'This is the difference between the two charts, not a capacity.' },
      ],
      step: 500,
      numeric: { stem: 'Enter the gross capacity in pounds.', value: vb, unit: 'lb' },
      steps: [
        `Over the front, on rubber: ${formatLb(va)}.`,
        `Over the side is outside the over-front zone, so use the 360° on-rubber chart: ${formatLb(vb)}.`,
        'The lower rating governs the whole lift, because the load passes through the side.',
      ],
      cells: [ca, cb],
      inputs: { family: 'quadrants', ask, frontConfig: a.id, sideConfig: b.id, boomLength: L, radius: R },
      intermediates: [va, vb],
    });
  }
  const span = Math.floor((va - vb) / 100);
  const total = vb + Math.max(1, rng.int(1, Math.max(1, span))) * 100;
  const excess = total - vb;
  return finish(rng, {
    family: 'quadrants',
    difficulty: 0.65,
    chartId: chart.id,
    setup: [...baseSetupRows, { label: 'Total load', value: `${formatLb(total)} (load and all load-handling devices)` }],
    stem: 'The total load is within the over-front rating. By how many pounds does it exceed the rating once it is swung over the side?',
    answerValue: excess,
    unit: 'lb',
    correctWhy: `${formatLb(total)} minus the 360° on-rubber rating of ${formatLb(vb)}.`,
    cands: [
      { value: va - total, why: 'This is the margin over the front. The side rating is lower.' },
      { value: va - vb, why: 'This is the difference between the two charts.' },
      ...(vo !== null && vo > total ? [{ value: vo - total, why: 'This uses the outrigger chart. The crane is on rubber.' }] : []),
    ],
    step: 100,
    numeric: { stem: 'Enter the overload in pounds.', value: excess, unit: 'lb' },
    steps: [
      `Over the front: ${formatLb(va)}. ${formatLb(total)} is within it.`,
      `Over the side, the 360° on-rubber chart applies: ${formatLb(vb)}.`,
      `Overload: ${formatNumber(total)} − ${formatNumber(vb)} = ${formatLb(excess)}. Do not swing this load to the side; set outriggers or reduce the load.`,
    ],
    cells: [ca, cb],
    inputs: { family: 'quadrants', ask, frontConfig: a.id, sideConfig: b.id, boomLength: L, radius: R, totalLoadLb: total },
    intermediates: [va, vb, total, excess],
  });
}

// ---------------------------------------------------------------- entry points

const GENERATORS: Record<FamilyId, (rng: Rng) => Problem> = {
  'read-gross': genReadGross,
  'radius-between-rows': genRadiusBetween,
  'boom-between-lengths': genBoomBetween,
  deductions: genDeductions,
  'net-capacity': genNetCapacity,
  'can-lift': genCanLift,
  'percent-capacity': genPercent,
  configuration: genConfiguration,
  jib: genJib,
  'parts-of-line': genPartsOfLine,
  'load-weight': genLoadWeight,
  'range-diagram': genRange,
  'structural-vs-stability': genStructural,
  quadrants: genQuadrants,
};

/** Generate one problem of a family, drawing all randomness from rng. */
export function generate(family: FamilyId, rng: RandomSource): Problem {
  const g = GENERATORS[family];
  if (!g) throw new Error(`loadcharts: unknown family ${family}`);
  return g(asRng(rng));
}

/** Practice-engine item shape (mirrors the pack's question table). */
export type PracticeItem = {
  id: string;
  skillId: SkillId;
  /** Both forms of one problem test the same fact. */
  variantOf: string;
  kind: 'mc' | 'numeric';
  choiceCount?: number;
  /** mc: the correct choice index as text; numeric: the exact value as text. */
  answer: string;
  difficulty: number;
};

/** The multiple-choice and numeric forms of a problem, as practice items. */
export function toItems(p: Problem): [PracticeItem, PracticeItem] {
  return [
    { id: `${p.id}:mc`, skillId: p.skillId, variantOf: p.id, kind: 'mc', choiceCount: p.mc.choices.length, answer: String(p.mc.answerIndex), difficulty: p.difficulty },
    { id: `${p.id}:numeric`, skillId: p.skillId, variantOf: p.id, kind: 'numeric', answer: String(p.numeric.value), difficulty: p.difficulty },
  ];
}

/** Convenience: the same family and seed always give the same problem. */
export function generateProblem(family: FamilyId, seed: number): Problem {
  return generate(family, createRng(seed));
}

/** Chart configuration lookup re-exported for renderers. */
export { getConfiguration };
