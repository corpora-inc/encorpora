/**
 * BZ-04 — the girih gate.
 *
 * A pattern that fails this is wallpaper, not girih. For every strap segment
 * that touches a tile edge, assert
 *   (a) the touch point is within 0.001·L of the edge midpoint,
 *   (b) the angle to the edge is 54° ± 0.01°, and
 *   (c) a partner segment exists in the neighbouring tile at the same point.
 *
 * Plus the tiling itself: five equilateral tiles, every edge exactly L, the
 * bow-tie's derived area, and the 72° rhombic lattice that packs them.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { pic, edgeMidpoints, signedArea, type Polygon, type Pt } from "./pic.ts";
import { girihTiling, khatemTiling, hexTiling, twelveTiling, CONTACT } from "./tilings.ts";

const L = 60;
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function edgesOf(polys: Polygon[]): { a: Pt; b: Pt; mid: Pt }[] {
  const out: { a: Pt; b: Pt; mid: Pt }[] = [];
  for (const p of polys) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!;
      const b = p[(i + 1) % p.length]!;
      out.push({ a, b, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
    }
  }
  return out;
}

test("girih: every tile is equilateral at the same edge length", () => {
  const { polys } = girihTiling(L, 400, 400);
  assert.ok(polys.length > 8, "the patch should contain real tiles");
  for (const p of polys) {
    for (let i = 0; i < p.length; i++) {
      const d = dist(p[i]!, p[(i + 1) % p.length]!);
      assert.ok(
        Math.abs(d - L) < 1e-6,
        `edge length ${d.toFixed(6)} is not L=${L} (tile of ${p.length} corners)`,
      );
    }
  }
});

test("girih: the tiling is decagons and bow-ties, and nothing else", () => {
  const { polys } = girihTiling(L, 400, 400);
  const kinds = new Set(polys.map((p) => p.length));
  assert.deepEqual([...kinds].sort((a, b) => a - b), [6, 10]);
});

test("girih: the bow-tie's area is 1.31432·L², as the packing requires", () => {
  const { polys } = girihTiling(L, 300, 300);
  const bow = polys.find((p) => p.length === 6)!;
  const area = Math.abs(signedArea(bow)) / (L * L);
  assert.ok(Math.abs(area - 1.314328) < 1e-5, `bow-tie area was ${area}`);
});

test("girih: the decagon's inradius sets the 72° lattice", () => {
  const { polys } = girihTiling(L, 400, 400);
  const decs = polys.filter((p) => p.length === 10);
  const centres = decs.map((p) => ({
    x: p.reduce((s, q) => s + q.x, 0) / 10,
    y: p.reduce((s, q) => s + q.y, 0) / 10,
  }));
  const r = L / (2 * Math.tan((18 * Math.PI) / 180));
  // Every decagon has a neighbour at exactly 2r, and none closer.
  let found = 0;
  for (const c of centres) {
    let nearest = Infinity;
    for (const d of centres) {
      if (d === c) continue;
      nearest = Math.min(nearest, dist(c, d));
    }
    if (Number.isFinite(nearest)) {
      assert.ok(nearest > 2 * r - 1e-6, `decagons overlap: ${nearest} < ${2 * r}`);
      if (Math.abs(nearest - 2 * r) < 1e-6) found++;
    }
  }
  assert.ok(found > 0, "no edge-sharing decagon pair found");
});

test("BZ-04: straps spring from edge midpoints at exactly 54°", () => {
  const { polys } = girihTiling(L, 320, 320);
  const segs = pic(polys, CONTACT.girih5);
  assert.ok(segs.length > 40, "expected a real strapwork field");
  const mids = edgeMidpoints(polys);
  const edges = edgesOf(polys);

  for (const s of segs) {
    // (a) the springing point is an edge midpoint
    const anchor = s.edgeAnchor!;
    const near = mids.reduce(
      (best, m) => (dist(m, anchor) < dist(best, anchor) ? m : best),
      mids[0]!,
    );
    assert.ok(
      dist(near, anchor) < 0.001 * L,
      `strap springs ${dist(near, anchor).toFixed(4)} from the nearest midpoint`,
    );

    // (b) the angle to that edge is 54° ± 0.01°
    const edge = edges.reduce(
      (best, e) => (dist(e.mid, anchor) < dist(best.mid, anchor) ? e : best),
      edges[0]!,
    );
    const ex = edge.b.x - edge.a.x;
    const ey = edge.b.y - edge.a.y;
    const sx = s.b.x - s.a.x;
    const sy = s.b.y - s.a.y;
    const cos = (ex * sx + ey * sy) / (Math.hypot(ex, ey) * Math.hypot(sx, sy));
    const deg = (Math.acos(Math.max(-1, Math.min(1, Math.abs(cos)))) * 180) / Math.PI;
    assert.ok(
      Math.abs(deg - 54) < 0.01,
      `strap meets its edge at ${deg.toFixed(4)}°, not 54°`,
    );
  }
});

test("BZ-04: a partner strap exists across every interior tile boundary", () => {
  const W = 600;
  const { polys } = girihTiling(L, W, W);
  const segs = pic(polys, CONTACT.girih5);
  // Count how many straps spring from each midpoint. An interior edge is
  // shared by two tiles and therefore carries four straps (two per tile).
  const counts = new Map<string, number>();
  for (const s of segs) {
    const k = `${s.edgeAnchor!.x.toFixed(3)},${s.edgeAnchor!.y.toFixed(3)}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  // Restrict to midpoints well inside the patch, where both tiles exist.
  const interior = [...counts.entries()].filter(([k]) => {
    const [x, y] = k.split(",").map(Number) as [number, number];
    return x > 2.5 * L && x < W - 2.5 * L && y > 2.5 * L && y < W - 2.5 * L;
  });
  assert.ok(interior.length > 6, "not enough interior midpoints to test");
  for (const [k, n] of interior) {
    assert.equal(n, 4, `midpoint ${k} carries ${n} straps, expected 4`);
  }
});

test("the other three folds are edge-to-edge at their own contact angle", () => {
  for (const [name, tiling, angle] of [
    ["khatem8", khatemTiling(L, 300, 300), CONTACT.khatem8],
    ["hex6", hexTiling(L, 300, 300), CONTACT.hex6],
    ["twelve12", twelveTiling(L, 400, 400), CONTACT.twelve12],
  ] as const) {
    for (const p of tiling.polys) {
      for (let i = 0; i < p.length; i++) {
        const d = dist(p[i]!, p[(i + 1) % p.length]!);
        assert.ok(Math.abs(d - L) < 1e-6, `${name}: edge ${d} != ${L}`);
      }
    }
    const segs = pic(tiling.polys, angle);
    assert.ok(segs.length > 20, `${name}: produced no strapwork`);
    const edges = edgesOf(tiling.polys);
    for (const s of segs.slice(0, 200)) {
      const anchor = s.edgeAnchor!;
      const edge = edges.reduce(
        (best, e) => (dist(e.mid, anchor) < dist(best.mid, anchor) ? e : best),
        edges[0]!,
      );
      const ex = edge.b.x - edge.a.x;
      const ey = edge.b.y - edge.a.y;
      const sx = s.b.x - s.a.x;
      const sy = s.b.y - s.a.y;
      const cos = (ex * sx + ey * sy) / (Math.hypot(ex, ey) * Math.hypot(sx, sy));
      const deg = (Math.acos(Math.max(-1, Math.min(1, Math.abs(cos)))) * 180) / Math.PI;
      assert.ok(Math.abs(deg - angle) < 0.01, `${name}: ${deg}° != ${angle}°`);
    }
  }
});

test("the tilings are deterministic on their inputs", () => {
  const a = girihTiling(L, 200, 200).polys;
  const b = girihTiling(L, 200, 200).polys;
  assert.equal(a.length, b.length);
  assert.deepEqual(a[3], b[3]);
});
