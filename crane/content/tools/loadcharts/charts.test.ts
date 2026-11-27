import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CHARTS } from './index.ts';
import type { Chart } from './index.ts';
import { validate } from './schema-check.ts';
import type { Schema } from './schema-check.ts';

const here = new URL('.', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('schema.json', here), 'utf8')) as Schema;
const files = readdirSync(new URL('charts/', here)).filter((f) => f.endsWith('.json'));
const raw = files.map((f) => ({ file: f, json: JSON.parse(readFileSync(new URL(`charts/${f}`, here), 'utf8')) as unknown }));

const DEG = Math.PI / 180;

function ascending(xs: readonly number[]): boolean {
  return xs.every((x, i) => i === 0 || x > xs[i - 1]);
}

test('every chart file is registered, and there are at least four crane classes', () => {
  assert.equal(files.length, CHARTS.length);
  for (const f of files) assert.ok(CHARTS.some((c) => `${c.id}.json` === f), `${f} not in CHARTS`);
  const classes = new Set(CHARTS.map((c) => c.class));
  for (const k of ['hydraulic-truck-crane', 'rough-terrain-crane', 'lattice-crawler-crane', 'articulating-crane']) assert.ok(classes.has(k as Chart['class']), k);
});

test('every chart validates against schema.json', () => {
  for (const { file, json } of raw) assert.deepEqual(validate(schema, json), [], file);
});

test('the schema validator rejects broken charts', () => {
  const bad = structuredClone(raw[0].json) as Record<string, unknown>;
  bad.fictional = false;
  (bad.units as Record<string, unknown>).weight = 'kg';
  bad.extra = 1;
  const errs = validate(schema, bad);
  assert.ok(errs.some((e) => e.includes('fictional')));
  assert.ok(errs.some((e) => e.includes('units.weight')));
  assert.ok(errs.some((e) => e.includes('unexpected property extra')));
});

test('ids are unique and file names match ids', () => {
  assert.equal(new Set(CHARTS.map((c) => c.id)).size, CHARTS.length);
  for (const c of CHARTS) {
    assert.equal(new Set(c.configurations.map((x) => x.id)).size, c.configurations.length, c.id);
    assert.equal(new Set(c.deductions.map((x) => x.id)).size, c.deductions.length, c.id);
  }
});

test('grid shapes match their axes; axes ascend; blank cells are never shaded', () => {
  for (const c of CHARTS) {
    for (const cfg of c.configurations) {
      const where = `${c.id}/${cfg.id}`;
      assert.ok(ascending(cfg.radiiFt), `${where} radii`);
      assert.ok(ascending(cfg.boomLengthsFt), `${where} booms`);
      assert.equal(cfg.capacitiesLb.length, cfg.radiiFt.length, where);
      assert.equal(cfg.structural.length, cfg.radiiFt.length, where);
      cfg.capacitiesLb.forEach((row, i) => {
        assert.equal(row.length, cfg.boomLengthsFt.length, `${where} row ${i}`);
        assert.equal(cfg.structural[i].length, cfg.boomLengthsFt.length, `${where} structural row ${i}`);
        row.forEach((v, j) => {
          if (v === null) assert.equal(cfg.structural[i][j], false, `${where} blank cell shaded`);
        });
      });
      for (const L of cfg.boomLengthsFt) assert.ok(L >= c.boom.minLengthFt && L <= c.boom.maxLengthFt, `${where} boom ${L}`);
      assert.ok(cfg.capacitiesLb.some((r) => r.some((v) => v !== null)), `${where} has no ratings`);
    }
  }
});

test('capacities are round numbers (multiples of 50 lb)', () => {
  for (const c of CHARTS) for (const cfg of c.configurations) for (const row of cfg.capacitiesLb) for (const v of row) if (v !== null) assert.equal(v % 50, 0, `${c.id}/${cfg.id} ${v}`);
  for (const c of CHARTS) for (const t of c.jib?.tables ?? []) for (const v of t.capacitiesLb) if (v !== null) assert.equal(v % 50, 0, `${c.id} jib ${v}`);
  for (const c of CHARTS) for (const d of c.deductions) assert.equal(d.weightLb % 10, 0, `${c.id} ${d.id}`);
});

test('capacity never rises with radius (down a column)', () => {
  for (const c of CHARTS)
    for (const cfg of c.configurations)
      cfg.boomLengthsFt.forEach((L, j) => {
        let prev = Infinity;
        cfg.radiiFt.forEach((R, i) => {
          const v = cfg.capacitiesLb[i][j];
          if (v === null) return;
          assert.ok(v <= prev, `${c.id}/${cfg.id} ${L} ft boom rises at ${R} ft`);
          prev = v;
        });
      });
});

test('capacity never rises with boom length at the same radius', () => {
  for (const c of CHARTS)
    for (const cfg of c.configurations)
      cfg.radiiFt.forEach((R, i) => {
        let prev = Infinity;
        cfg.boomLengthsFt.forEach((L, j) => {
          const v = cfg.capacitiesLb[i][j];
          if (v === null) return;
          assert.ok(v <= prev, `${c.id}/${cfg.id} ${R} ft row rises at ${L} ft boom`);
          prev = v;
        });
      });
});

test('shaded (structural) cells sit at short radius: no shaded cell below a stability cell', () => {
  for (const c of CHARTS)
    for (const cfg of c.configurations)
      cfg.boomLengthsFt.forEach((L, j) => {
        let seenStability = false;
        cfg.radiiFt.forEach((R, i) => {
          if (cfg.capacitiesLb[i][j] === null) return;
          if (!cfg.structural[i][j]) seenStability = true;
          else assert.ok(!seenStability, `${c.id}/${cfg.id} ${L} ft shaded at ${R} ft after a stability cell`);
        });
      });
  // and every chart has both regions somewhere
  for (const c of CHARTS) {
    const cells = c.configurations.flatMap((cfg) => cfg.capacitiesLb.flatMap((r, i) => r.map((v, j) => (v === null ? null : cfg.structural[i][j]))));
    assert.ok(cells.includes(true), `${c.id} has no structural cells`);
    assert.ok(cells.includes(false), `${c.id} has no stability cells`);
  }
});

test('weaker support never rates higher: mid ≤ full, rubber ≤ outriggers, 360° ≤ over-front', () => {
  const rank: Record<string, number> = {
    'outriggers-full': 0,
    'tracks-extended': 0,
    'stabilizers-full': 0,
    'outriggers-mid': 1,
    'tracks-retracted': 1,
    'stabilizers-mid': 1,
    'on-rubber-stationary': 2,
    'on-rubber-creep': 3,
  };
  for (const c of CHARTS)
    for (const a of c.configurations)
      for (const b of c.configurations) {
        // a weaker support is compared only over a work area it shares (outriggers and tracks cover every area)
        const weaker =
          (rank[b.support] > rank[a.support] && (a.workArea === b.workArea || b.workArea === '360' || rank[a.support] <= 1)) ||
          (a.support === b.support && a.workArea !== '360' && b.workArea === '360');
        if (!weaker) continue;
        a.radiiFt.forEach((R, i) =>
          a.boomLengthsFt.forEach((L, j) => {
            const va = a.capacitiesLb[i][j];
            const bi = b.radiiFt.indexOf(R);
            const bj = b.boomLengthsFt.indexOf(L);
            if (va === null || bi < 0 || bj < 0) return;
            const vb = b.capacitiesLb[bi][bj];
            if (vb !== null) assert.ok(vb <= va, `${c.id}: ${b.id} rates ${vb} above ${a.id} ${va} at ${L}/${R}`);
          }),
        );
      }
});

test('range diagram agrees with geometry: radius ≈ L·cos(a) + offset, height ≈ L·sin(a) + pivot height', () => {
  for (const c of CHARTS) {
    if (c.boom.type === 'articulating') {
      assert.equal(c.rangeDiagram, null);
      continue;
    }
    const g = c.geometry;
    const rd = c.rangeDiagram;
    assert.ok(g && rd, c.id);
    let checked = 0;
    rd.radiiFt.forEach((R, i) =>
      rd.boomLengthsFt.forEach((L, j) => {
        const a = rd.angleDeg[i][j];
        const h = rd.tipHeightFt[i][j];
        assert.equal(a === null, h === null, `${c.id} ${L}/${R} angle and height both or neither`);
        if (a === null || h === null) return;
        assert.ok(a >= g.minLoadedBoomAngleDeg && a <= g.maxLoadedBoomAngleDeg, `${c.id} ${L}/${R} angle ${a} out of limits`);
        // angles are rounded to whole degrees, heights to whole feet
        const tolR = L * Math.sin(a * DEG) * 0.5 * DEG + 0.01;
        const tolH = L * Math.cos(a * DEG) * 0.5 * DEG + 0.5 + 0.01;
        assert.ok(Math.abs(L * Math.cos(a * DEG) + g.pivotOffsetFt - R) <= tolR, `${c.id} ${L}/${R}: radius from angle ${a}`);
        assert.ok(Math.abs(L * Math.sin(a * DEG) + g.pivotHeightFt - h) <= tolH, `${c.id} ${L}/${R}: height ${h} from angle ${a}`);
        checked++;
      }),
    );
    assert.ok(checked > 20, `${c.id} range diagram too sparse`);
  }
});

test('every rated cell is reachable on the range diagram and respects no-load minimum angles', () => {
  for (const c of CHARTS) {
    const rd = c.rangeDiagram;
    if (!rd) continue;
    for (const cfg of c.configurations) {
      for (const L of cfg.boomLengthsFt) assert.ok(rd.boomLengthsFt.includes(L), `${c.id}/${cfg.id} boom ${L} missing from range diagram`);
      for (const R of cfg.radiiFt) assert.ok(rd.radiiFt.includes(R), `${c.id}/${cfg.id} radius ${R} missing from range diagram`);
      cfg.radiiFt.forEach((R, i) =>
        cfg.boomLengthsFt.forEach((L, j) => {
          if (cfg.capacitiesLb[i][j] === null) return;
          const a = rd.angleDeg[rd.radiiFt.indexOf(R)][rd.boomLengthsFt.indexOf(L)];
          assert.ok(a !== null, `${c.id}/${cfg.id} rates ${L}/${R} but the boom cannot reach it`);
          let min = 0;
          for (const e of cfg.noLoadMinAngle ?? []) if (L >= e.boomLengthFt) min = e.angleDeg;
          assert.ok(a >= min - 0.5, `${c.id}/${cfg.id} rates ${L}/${R} at ${a}° below its ${min}° minimum`);
        }),
      );
    }
  }
});

test('jib tables: shapes, key order, and monotone ratings', () => {
  for (const c of CHARTS) {
    if (!c.jib) continue;
    for (const t of c.jib.tables) {
      const where = `${c.id} jib ${t.mainBoomLengthFt}/${t.jibLengthFt}/${t.offsetDeg}`;
      assert.equal(t.keys.length, t.capacitiesLb.length, where);
      assert.ok(c.jib.lengthsFt.includes(t.jibLengthFt) && c.jib.offsetsDeg.includes(t.offsetDeg), where);
      assert.equal(t.basis === 'boom-angle', c.rules.jibBetweenKeys === 'next-lower-angle', where);
      if (t.basis === 'boom-angle') {
        assert.ok(ascending([...t.keys].reverse()), `${where} angles descend`);
        assert.equal(t.mainBoomLengthFt, c.boom.maxLengthFt, `${where} rated on the fully extended boom`);
      } else assert.ok(ascending(t.keys), `${where} radii ascend`);
      // down the table (lower angle or longer radius) ratings never rise
      let prev = Infinity;
      t.capacitiesLb.forEach((v) => {
        if (v === null) return;
        assert.ok(v <= prev, `${where} rises`);
        prev = v;
      });
      // larger offset or longer jib never rates higher at the same key
      for (const u of c.jib.tables) {
        if (u.mainBoomLengthFt !== t.mainBoomLengthFt || u === t) continue;
        const weaker = (u.jibLengthFt === t.jibLengthFt && u.offsetDeg > t.offsetDeg) || (u.offsetDeg === t.offsetDeg && u.jibLengthFt > t.jibLengthFt);
        if (!weaker) continue;
        t.keys.forEach((k, i) => {
          const ui = u.keys.indexOf(k);
          const a = t.capacitiesLb[i];
          const b = ui < 0 ? null : u.capacitiesLb[ui];
          if (a !== null && b !== null) assert.ok(b <= a, `${where}: ${u.jibLengthFt}/${u.offsetDeg} higher at ${k}`);
        });
      }
    }
  }
});

test('line-pull tables: parts × permissible line pull, within the block and the top rating', () => {
  for (const c of CHARTS) {
    const lp = c.linePull;
    if (!lp) {
      assert.equal(c.class, 'articulating-crane');
      continue;
    }
    assert.equal(lp.rows.length, lp.maxParts, c.id);
    lp.rows.forEach((r, i) => {
      assert.equal(r.parts, i + 1, c.id);
      assert.equal(r.maxLoadLb, r.parts * lp.maxPermissibleLinePullLb, c.id);
    });
    const top = Math.max(...c.configurations.flatMap((cfg) => cfg.capacitiesLb.flat().filter((v): v is number => v !== null)));
    assert.ok(lp.maxParts * lp.maxPermissibleLinePullLb >= top, `${c.id}: full reeving cannot carry the top rating`);
    const blocks = c.deductions.filter((d) => d.kind === 'hook-block');
    assert.ok(blocks.length >= 2, c.id);
    assert.ok(blocks.some((b) => (b.maxParts ?? 1) >= lp.maxParts), `${c.id}: no block reeves full parts`);
  }
});

test('chart notes carry the rules in plain words', () => {
  for (const c of CHARTS) {
    const notes = [...c.notes, ...c.configurations.flatMap((x) => x.notes ?? []), ...(c.jib?.notes ?? [])].join(' ');
    assert.match(notes, /fictional/i, c.id);
    assert.match(notes, /never be used to plan or make a lift/, c.id);
    assert.match(notes, /next longer listed radius/, c.id);
    assert.match(notes, /part of the load/, c.id);
    assert.match(notes, /structural/i, c.id);
    assert.match(notes, /no load may be handled/, c.id);
    for (const p of new Set(c.configurations.map((x) => x.stabilityPercent))) assert.match(notes, new RegExp(`${p} percent of tipping`), c.id);
    if (c.rules.betweenBoomLengths === 'lower-of-adjacent') assert.match(notes, /lower of the capacities/, c.id);
    if (c.boom.type === 'telescopic') assert.match(notes, /next longer listed boom|lower of the capacities/, c.id);
    assert.match(c.title, /\(fictional\)$/);
  }
});

test('public-content guard: no real manufacturer, certifier, or regulator names in chart data', () => {
  const banned = [
    'grove', 'manitowoc', 'liebherr', 'tadano', 'terex', 'link-belt', 'linkbelt', 'link belt', 'manitex', 'national crane',
    'kobelco', 'sany', 'xcmg', 'zoomlion', 'palfinger', 'hiab', 'fassi', 'elliott', 'altec', 'broderson', 'demag', 'kato',
    'nccco', 'osha', 'cco ', 'ansi', 'asme',
  ];
  for (const { file, json } of raw) {
    const text = JSON.stringify(json).toLowerCase();
    for (const b of banned) assert.ok(!text.includes(b), `${file} mentions ${b}`);
  }
});
