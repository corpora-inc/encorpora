// Fictional crane load charts: types, chart registry, and lookups that apply
// the chart rules. Pure functions, no runtime dependencies.
//
// Every chart here is original and fictional. It is for training and exam-style
// practice only and must never be used to plan or make a real lift.

import ht50 from './charts/ht-50.json' with { type: 'json' };
import rt40 from './charts/rt-40.json' with { type: 'json' };
import lc150 from './charts/lc-150.json' with { type: 'json' };
import bt23 from './charts/bt-23.json' with { type: 'json' };
import ak30 from './charts/ak-30.json' with { type: 'json' };

// ---------------------------------------------------------------- types

export type CraneClass =
  | 'hydraulic-truck-crane'
  | 'rough-terrain-crane'
  | 'lattice-crawler-crane'
  | 'boom-truck'
  | 'articulating-crane';

export type Support =
  | 'outriggers-full'
  | 'outriggers-mid'
  | 'on-rubber-stationary'
  | 'on-rubber-creep'
  | 'tracks-extended'
  | 'tracks-retracted'
  | 'stabilizers-full'
  | 'stabilizers-mid';

export type WorkArea = '360' | 'over-front' | 'over-rear';

export type Configuration = {
  id: string;
  label: string;
  support: Support;
  workArea: WorkArea;
  stabilityPercent: 75 | 85;
  counterweightLb: number;
  travel?: { maxSpeedMph: number; boomPosition: string };
  boomLengthsFt: number[];
  radiiFt: number[];
  /** [radius row][boom column]; null = no load may be handled there. */
  capacitiesLb: (number | null)[][];
  /** [radius row][boom column]; true = limited by structural strength (shaded cell). */
  structural: boolean[][];
  noLoadMinAngle?: { boomLengthFt: number; angleDeg: number }[];
  notes?: string[];
};

export type DeductionKind = 'hook-block' | 'headache-ball' | 'jib-stowed' | 'jib-erected' | 'aux-head' | 'attachment';

export type Deduction = {
  id: string;
  kind: DeductionKind;
  item: string;
  weightLb: number;
  maxParts?: number;
};

export type JibTable = {
  mainBoomLengthFt: number;
  jibLengthFt: number;
  offsetDeg: number;
  basis: 'boom-angle' | 'radius';
  /** boom-angle basis: loaded main boom angles, descending. radius basis: radii, ascending. */
  keys: number[];
  capacitiesLb: (number | null)[];
};

export type Geometry = {
  /** Horizontal distance from the axis of rotation to the boom foot pin; negative = behind it. */
  pivotOffsetFt: number;
  /** Height of the boom foot pin above the ground. */
  pivotHeightFt: number;
  minLoadedBoomAngleDeg: number;
  maxLoadedBoomAngleDeg: number;
};

export type RangeDiagram = {
  boomLengthsFt: number[];
  radiiFt: number[];
  angleDeg: (number | null)[][];
  tipHeightFt: (number | null)[][];
};

export type LinePull = {
  rope: string;
  maxPermissibleLinePullLb: number;
  maxParts: number;
  rows: { parts: number; maxLoadLb: number }[];
};

export type Chart = {
  $schema?: string;
  id: string;
  class: CraneClass;
  title: string;
  fictional: true;
  summary: string;
  units: { weight: 'lb'; length: 'ft'; angle: 'deg'; statement: string };
  boom: { type: 'telescopic' | 'lattice' | 'articulating'; minLengthFt: number; maxLengthFt: number; sections: number | null };
  boomConfigurations?: { lengthFt: number; label: string }[];
  counterweight: { weightLb: number; description: string };
  rules: {
    betweenRadii: 'next-longer';
    betweenBoomLengths: 'next-longer' | 'lower-of-adjacent';
    jibBetweenKeys: 'next-lower-angle' | 'next-longer-radius';
  };
  geometry: Geometry | null;
  configurations: Configuration[];
  rangeDiagram: RangeDiagram | null;
  jib: { description: string; lengthsFt: number[]; offsetsDeg: number[]; tables: JibTable[]; notes: string[] } | null;
  deductions: Deduction[];
  linePull: LinePull | null;
  notes: string[];
};

// ---------------------------------------------------------------- registry

export const CHARTS: readonly Chart[] = [ht50, rt40, lc150, bt23, ak30] as Chart[];

export function getChart(id: string): Chart {
  const c = CHARTS.find((x) => x.id === id);
  if (!c) throw new Error(`loadcharts: unknown chart ${id}`);
  return c;
}

export function getConfiguration(chart: Chart, configId: string): Configuration {
  const c = chart.configurations.find((x) => x.id === configId);
  if (!c) throw new Error(`loadcharts: ${chart.id} has no configuration ${configId}`);
  return c;
}

export function getDeduction(chart: Chart, id: string): Deduction {
  const d = chart.deductions.find((x) => x.id === id);
  if (!d) throw new Error(`loadcharts: ${chart.id} has no deduction ${id}`);
  return d;
}

// ---------------------------------------------------------------- capacity lookup

export type CapacityQuery = { config: string; boomLength: number; radius: number };

export type CapacityCell = {
  kind: 'capacity';
  config: string;
  boomLengthFt: number;
  radiusFt: number;
  valueLb: number | null;
  structural: boolean;
};

export type CapacityRefusal =
  | 'radius-beyond-chart'
  | 'radius-inside-chart'
  | 'boom-outside-chart'
  | 'no-rating';

export type CapacityResult =
  | {
      permitted: true;
      grossLb: number;
      structural: boolean;
      rowRadiusFt: number;
      /** The cell whose value is used. */
      governing: CapacityCell;
      /** Every cell consulted (one, or two under the lower-of-adjacent rule). */
      cells: CapacityCell[];
      rules: string[];
    }
  | { permitted: false; reason: CapacityRefusal; cells: CapacityCell[]; rules: string[] };

/** Index of the smallest key >= x, or -1. Keys ascending. */
function nextAtOrAbove(keys: readonly number[], x: number): number {
  for (let i = 0; i < keys.length; i++) if (keys[i] >= x) return i;
  return -1;
}

export function cellAt(chart: Chart, configId: string, boomLength: number, radius: number): CapacityCell | null {
  const cfg = getConfiguration(chart, configId);
  const i = cfg.radiiFt.indexOf(radius);
  const j = cfg.boomLengthsFt.indexOf(boomLength);
  if (i < 0 || j < 0) return null;
  return {
    kind: 'capacity',
    config: cfg.id,
    boomLengthFt: boomLength,
    radiusFt: radius,
    valueLb: cfg.capacitiesLb[i][j],
    structural: cfg.structural[i][j],
  };
}

/**
 * Gross capacity at a boom length and radius, applying the chart's rules:
 * a radius between rows uses the next longer listed radius; a boom length
 * between columns uses the next longer boom, or the lower of the two adjacent
 * booms, as the chart says; a blank cell means no load may be handled.
 */
export function capacityAt(chart: Chart, q: CapacityQuery): CapacityResult {
  const cfg = getConfiguration(chart, q.config);
  const rules: string[] = [];
  const radii = cfg.radiiFt;
  const booms = cfg.boomLengthsFt;
  if (q.radius > radii[radii.length - 1]) {
    return { permitted: false, reason: 'radius-beyond-chart', cells: [], rules: ['Radius is beyond the longest listed radius.'] };
  }
  if (q.radius < radii[0]) {
    return { permitted: false, reason: 'radius-inside-chart', cells: [], rules: ['Radius is inside the shortest listed radius.'] };
  }
  if (q.boomLength < booms[0] || q.boomLength > booms[booms.length - 1]) {
    return { permitted: false, reason: 'boom-outside-chart', cells: [], rules: ['Boom length is outside the listed boom lengths.'] };
  }
  const i = nextAtOrAbove(radii, q.radius);
  const row = radii[i];
  if (row !== q.radius) rules.push(`${q.radius} ft is between rows: use the next longer radius, ${row} ft.`);
  const jHi = nextAtOrAbove(booms, q.boomLength);
  const cols: number[] = [];
  if (booms[jHi] === q.boomLength) cols.push(jHi);
  else if (chart.rules.betweenBoomLengths === 'next-longer') {
    cols.push(jHi);
    rules.push(`${q.boomLength} ft boom is between columns: use the next longer boom, ${booms[jHi]} ft.`);
  } else {
    cols.push(jHi - 1, jHi);
    rules.push(
      `${q.boomLength} ft boom is between columns: use the lower of the ${booms[jHi - 1]} ft and ${booms[jHi]} ft capacities.`,
    );
  }
  const cells: CapacityCell[] = cols.map((j) => ({
    kind: 'capacity',
    config: cfg.id,
    boomLengthFt: booms[j],
    radiusFt: row,
    valueLb: cfg.capacitiesLb[i][j],
    structural: cfg.structural[i][j],
  }));
  if (cells.some((c) => c.valueLb === null)) {
    return { permitted: false, reason: 'no-rating', cells, rules: [...rules, 'A blank cell: no load may be handled here.'] };
  }
  let governing = cells[cells.length - 1];
  for (const c of cells) if ((c.valueLb as number) < (governing.valueLb as number)) governing = c;
  return {
    permitted: true,
    grossLb: governing.valueLb as number,
    structural: governing.structural,
    rowRadiusFt: row,
    governing,
    cells,
    rules,
  };
}

// ---------------------------------------------------------------- deductions

export type DeductionLine = { item: string; weightLb: number };

/** Rigging item counted as part of the load, e.g. 2 slings at 40 lb each. */
export type Rigging = { item: string; count: number; eachLb: number };

export function riggingLines(rigging: readonly Rigging[]): DeductionLine[] {
  return rigging.map((r) => ({
    item: r.count === 1 ? r.item : `${r.count} × ${r.item} at ${r.eachLb} lb`,
    weightLb: r.count * r.eachLb,
  }));
}

export function deductionLines(chart: Chart, ids: readonly string[], rigging: readonly Rigging[] = []): DeductionLine[] {
  return [...ids.map((id) => getDeduction(chart, id)).map((d) => ({ item: d.item, weightLb: d.weightLb })), ...riggingLines(rigging)];
}

/** Gross capacity minus all deductions. */
export function netCapacity(grossLb: number, deductions: readonly DeductionLine[]): { netLb: number; totalDeductionsLb: number } {
  let total = 0;
  for (const d of deductions) total += d.weightLb;
  return { netLb: grossLb - total, totalDeductionsLb: total };
}

// ---------------------------------------------------------------- parts of line

/** Minimum parts of line so that each part carries no more than the permissible line pull. */
export function requiredParts(lineWeightLb: number, linePullLb: number): number {
  if (!(linePullLb > 0)) throw new Error('loadcharts: line pull must be positive');
  if (lineWeightLb <= 0) return 1;
  return Math.max(1, Math.ceil(lineWeightLb / linePullLb));
}

// ---------------------------------------------------------------- jib

export type JibQuery = {
  jibLength: number;
  offsetDeg: number;
  /** Required for radius-basis jib charts; for boom-angle charts defaults to the table's main boom. */
  mainBoomLength?: number;
  /** Loaded main boom angle (boom-angle basis). */
  boomAngle?: number;
  /** Radius (radius basis). */
  radius?: number;
};

export type JibCell = {
  kind: 'jib';
  mainBoomLengthFt: number;
  jibLengthFt: number;
  offsetDeg: number;
  basis: 'boom-angle' | 'radius';
  key: number;
  valueLb: number | null;
};

export type JibResult =
  | { permitted: true; grossLb: number; cell: JibCell; rules: string[] }
  | { permitted: false; reason: 'no-table' | 'outside-chart' | 'no-rating'; cell: JibCell | null; rules: string[] };

export function jibTable(chart: Chart, jibLength: number, offsetDeg: number, mainBoomLength?: number): JibTable | null {
  if (!chart.jib) return null;
  return (
    chart.jib.tables.find(
      (t) =>
        t.jibLengthFt === jibLength &&
        t.offsetDeg === offsetDeg &&
        (mainBoomLength === undefined || t.mainBoomLengthFt === mainBoomLength),
    ) ?? null
  );
}

/** Jib rating: boom-angle charts use the next lower listed angle; radius charts the next longer radius. */
export function jibCapacityAt(chart: Chart, q: JibQuery): JibResult {
  const t = jibTable(chart, q.jibLength, q.offsetDeg, q.mainBoomLength);
  if (!t) return { permitted: false, reason: 'no-table', cell: null, rules: ['No rating for this jib, offset, and main boom.'] };
  const rules: string[] = [];
  let k = -1;
  if (t.basis === 'boom-angle') {
    const a = q.boomAngle;
    if (a === undefined) throw new Error('loadcharts: boom-angle jib chart needs boomAngle');
    if (a > t.keys[0]) return { permitted: false, reason: 'outside-chart', cell: null, rules: ['Boom angle above the highest listed angle.'] };
    for (let i = 0; i < t.keys.length; i++) if (t.keys[i] <= a) { k = i; break; }
    if (k < 0) return { permitted: false, reason: 'outside-chart', cell: null, rules: ['Boom angle below the lowest listed angle.'] };
    if (t.keys[k] !== a) rules.push(`${a}° is between rows: use the next lower angle, ${t.keys[k]}°.`);
  } else {
    const r = q.radius;
    if (r === undefined) throw new Error('loadcharts: radius jib chart needs radius');
    if (r < t.keys[0]) return { permitted: false, reason: 'outside-chart', cell: null, rules: ['Radius inside the shortest listed radius.'] };
    k = nextAtOrAbove(t.keys, r);
    if (k < 0) return { permitted: false, reason: 'outside-chart', cell: null, rules: ['Radius beyond the longest listed radius.'] };
    if (t.keys[k] !== r) rules.push(`${r} ft is between rows: use the next longer radius, ${t.keys[k]} ft.`);
  }
  const cell: JibCell = {
    kind: 'jib',
    mainBoomLengthFt: t.mainBoomLengthFt,
    jibLengthFt: t.jibLengthFt,
    offsetDeg: t.offsetDeg,
    basis: t.basis,
    key: t.keys[k],
    valueLb: t.capacitiesLb[k],
  };
  if (cell.valueLb === null) return { permitted: false, reason: 'no-rating', cell, rules: [...rules, 'A blank cell: no load may be handled here.'] };
  return { permitted: true, grossLb: cell.valueLb, cell, rules };
}

// ---------------------------------------------------------------- range diagram and geometry

export type RangeCell = { kind: 'range'; boomLengthFt: number; radiusFt: number; angleDeg: number; tipHeightFt: number };

/** Range-diagram entry for a listed boom length and radius, or null. */
export function rangeAt(chart: Chart, boomLength: number, radius: number): RangeCell | null {
  const rd = chart.rangeDiagram;
  if (!rd) return null;
  const i = rd.radiiFt.indexOf(radius);
  const j = rd.boomLengthsFt.indexOf(boomLength);
  if (i < 0 || j < 0) return null;
  const a = rd.angleDeg[i][j];
  const h = rd.tipHeightFt[i][j];
  if (a === null || h === null) return null;
  return { kind: 'range', boomLengthFt: boomLength, radiusFt: radius, angleDeg: a, tipHeightFt: h };
}

const DEG = Math.PI / 180;

/** Radius for a boom length and loaded boom angle: L·cos(angle) + pivot offset. */
export function radiusFromAngle(g: Geometry, boomLength: number, angleDeg: number): number {
  return boomLength * Math.cos(angleDeg * DEG) + g.pivotOffsetFt;
}

/** Boom tip height: L·sin(angle) + pivot height. */
export function tipHeightFromAngle(g: Geometry, boomLength: number, angleDeg: number): number {
  return boomLength * Math.sin(angleDeg * DEG) + g.pivotHeightFt;
}

/** Loaded boom angle for a boom length and radius, or null if out of reach. */
export function boomAngleFor(g: Geometry, boomLength: number, radius: number): number | null {
  const c = (radius - g.pivotOffsetFt) / boomLength;
  if (c < 0 || c > 1) return null;
  return Math.acos(c) / DEG;
}

/** Radius when the tip is a known height above the foot pin (right triangle). */
export function radiusFromRise(g: Geometry, boomLength: number, riseFt: number): number | null {
  const h2 = boomLength * boomLength - riseFt * riseFt;
  if (h2 < 0) return null;
  return Math.sqrt(h2) + g.pivotOffsetFt;
}

// ---------------------------------------------------------------- regions and work areas

/** First listed radius (row) in a boom column whose rating is stability-limited, or null. */
export function firstStabilityRadius(chart: Chart, configId: string, boomLength: number): number | null {
  const cfg = getConfiguration(chart, configId);
  const j = cfg.boomLengthsFt.indexOf(boomLength);
  if (j < 0) return null;
  for (let i = 0; i < cfg.radiiFt.length; i++) {
    if (cfg.capacitiesLb[i][j] !== null && !cfg.structural[i][j]) return cfg.radiiFt[i];
  }
  return null;
}

export type BoomPosition = 'front' | 'side' | 'rear';

/** Configurations for a support condition that permit the boom in this position. */
export function configsForPosition(chart: Chart, support: Support, position: BoomPosition): Configuration[] {
  return chart.configurations.filter(
    (c) =>
      c.support === support &&
      (c.workArea === '360' || (c.workArea === 'over-front' && position === 'front') || (c.workArea === 'over-rear' && position === 'rear')),
  );
}

// ---------------------------------------------------------------- load weight

export const DENSITY_LB_PER_FT3 = { steel: 490, concrete: 150 } as const;

/** Weight of a rectangular block; dimensions in feet. */
export function blockWeightLb(lengthFt: number, widthFt: number, heightFt: number, densityLbFt3: number): number {
  return lengthFt * widthFt * heightFt * densityLbFt3;
}

/** Weight of a plate; length and width in feet, thickness in inches. */
export function plateWeightLb(lengthFt: number, widthFt: number, thicknessIn: number, densityLbFt3: number): number {
  return (lengthFt * widthFt * thicknessIn * densityLbFt3) / 12;
}

// ---------------------------------------------------------------- formatting

export function formatNumber(n: number): string {
  const neg = n < 0;
  const [whole, frac] = Math.abs(n).toString().split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + grouped + (frac ? '.' + frac : '');
}

export function formatLb(n: number): string {
  return `${formatNumber(n)} lb`;
}

/** How a boom length is named on this chart (articulating cranes name extension configurations). */
export function boomPhrase(chart: Chart, boomLength: number): string {
  const bc = chart.boomConfigurations?.find((b) => b.lengthFt === boomLength);
  if (bc) return bc.label.charAt(0).toLowerCase() + bc.label.slice(1);
  return `${aOrAn(boomLength)} ${boomLength} ft boom`;
}

/** English article for a spoken number: "an 80 ft", "an 11 ft", "a 50 ft". */
export function aOrAn(n: number): 'a' | 'an' {
  const s = String(Math.trunc(Math.abs(n)));
  return s.startsWith('8') || s === '11' || s === '18' || /^1[18]\d{3}$/.test(s) ? 'an' : 'a';
}
