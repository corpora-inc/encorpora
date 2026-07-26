/**
 * The tilings the pattern engine runs over.
 *
 * Four folds, each a real edge-to-edge tiling of equal-edge-length polygons —
 * which is the precondition Hankin's construction needs in order for straps to
 * meet across every tile boundary.
 *
 *   girih5   decagon (tabl) + bow-tie (sormeh dan), on a 72° rhombic lattice.
 *            Contact 54°. The Isfahan / Topkapı family.
 *   khatem8  truncated square: octagons + squares. Contact 45°. The zellij
 *            eight-point star (khatem) family.
 *   hex6     regular hexagons. Contact 60°.
 *   twelve12 4.6.12: dodecagons + hexagons + squares. Contact 60°.
 *
 * The girih lattice is derived, not copied: with the decagon inradius
 * r = L/(2·tan18°), lattice vectors 2r∠0° and 2r∠72° pack decagons edge-to-edge
 * and leave exactly one gap per cell whose area is 1.3143·L² — the bow-tie's
 * area to five decimal places. The six gap corners are decagon vertices and
 * every gap edge is exactly L. `girih.test.ts` re-proves all of that.
 */

import { regular, type Polygon, type Pt } from "./pic.ts";

export type Fold = "girih5" | "khatem8" | "hex6" | "twelve12" | "lattice";

/** Contact angle in degrees for each PIC-driven fold. */
export const CONTACT: Record<Exclude<Fold, "lattice">, number> = {
  girih5: 54,
  khatem8: 45,
  hex6: 60,
  twelve12: 60,
};

export interface Tiling {
  polys: Polygon[];
  /** Lattice period, for the callers that can tile a canvas pattern. */
  period: { x: number; y: number } | null;
}

const D2R = Math.PI / 180;

function ngonAt(n: number, L: number, c: Pt, phaseDeg: number): Polygon {
  return regular(n, L, c, phaseDeg);
}

// ── girih5: decagon + bow-tie ──────────────────────────────────────────────

const DEC_R = (L: number) => L / (2 * Math.sin(18 * D2R)); // circumradius
const DEC_r = (L: number) => L / (2 * Math.tan(18 * D2R)); // inradius

/** Vertex k of the decagon at centre `c`; k = 0 is at 18°. */
function decVertex(c: Pt, L: number, k: number): Pt {
  const a = (18 + 36 * k) * D2R;
  const R = DEC_R(L);
  return { x: c.x + R * Math.cos(a), y: c.y + R * Math.sin(a) };
}

export function girihTiling(L: number, w: number, h: number): Tiling {
  const twoR = 2 * DEC_r(L);
  const a1 = { x: twoR, y: 0 };
  const a2 = { x: twoR * Math.cos(72 * D2R), y: twoR * Math.sin(72 * D2R) };
  const polys: Polygon[] = [];
  // Cover [0,w]×[0,h] with a generous margin so straps entering the frame are
  // complete: the pattern is clipped, never cropped mid-construction.
  const nm = Math.ceil(w / a1.x) + 3;
  const nn = Math.ceil(h / a2.y) + 3;
  for (let n = -2; n <= nn; n++) {
    for (let mIdx = -Math.ceil((n * a2.x) / a1.x) - 2; mIdx <= nm; mIdx++) {
      const c = { x: mIdx * a1.x + n * a2.x, y: mIdx * a1.y + n * a2.y };
      if (c.x < -3 * L || c.x > w + 3 * L || c.y < -3 * L || c.y > h + 3 * L) continue;
      polys.push(ngonAt(10, L, c, 18));
      // The bow-tie of this cell: six decagon vertices, all edges exactly L.
      const d0 = c;
      const d1 = { x: c.x + a1.x, y: c.y + a1.y };
      const d2 = { x: c.x + a2.x, y: c.y + a2.y };
      const d3 = { x: c.x + a1.x + a2.x, y: c.y + a1.y + a2.y };
      polys.push([
        decVertex(d0, L, 0),
        decVertex(d1, L, 3),
        decVertex(d3, L, 6),
        decVertex(d3, L, 5),
        decVertex(d2, L, 8),
        decVertex(d0, L, 1),
      ]);
    }
  }
  return { polys, period: null };
}

// ── khatem8: octagons + squares (the truncated square tiling) ──────────────

export function khatemTiling(L: number, w: number, h: number): Tiling {
  const p = L / Math.tan(22.5 * D2R); // 2 × octagon inradius = lattice pitch
  const polys: Polygon[] = [];
  const cols = Math.ceil(w / p) + 2;
  const rows = Math.ceil(h / p) + 2;
  for (let j = -1; j <= rows; j++) {
    for (let i = -1; i <= cols; i++) {
      const c = { x: i * p, y: j * p };
      polys.push(ngonAt(8, L, c, 22.5));
      polys.push(ngonAt(4, L, { x: c.x + p / 2, y: c.y + p / 2 }, 45));
    }
  }
  return { polys, period: { x: p, y: p } };
}

// ── hex6: regular hexagons ─────────────────────────────────────────────────

export function hexTiling(L: number, w: number, h: number): Tiling {
  const polys: Polygon[] = [];
  const dx = 1.5 * L;
  const dy = Math.sqrt(3) * L;
  const cols = Math.ceil(w / dx) + 2;
  const rows = Math.ceil(h / dy) + 2;
  for (let i = -1; i <= cols; i++) {
    for (let j = -1; j <= rows; j++) {
      const c = { x: i * dx, y: j * dy + (i & 1 ? dy / 2 : 0) };
      polys.push(ngonAt(6, L, c, 0));
    }
  }
  return { polys, period: { x: 2 * dx, y: dy } };
}

// ── twelve12: dodecagons + hexagons + squares (4.6.12) ─────────────────────

export function twelveTiling(L: number, w: number, h: number): Tiling {
  const r12 = L / (2 * Math.tan(15 * D2R));
  const s = 2 * r12 + L; // dodecagon centre spacing, triangular lattice
  const a1 = { x: s, y: 0 };
  const a2 = { x: s * Math.cos(60 * D2R), y: s * Math.sin(60 * D2R) };
  const polys: Polygon[] = [];
  const nn = Math.ceil(h / a2.y) + 2;
  const nm = Math.ceil(w / a1.x) + 2;
  for (let n = -1; n <= nn; n++) {
    for (let mIdx = -Math.ceil((n * a2.x) / a1.x) - 1; mIdx <= nm; mIdx++) {
      const c = { x: mIdx * a1.x + n * a2.x, y: mIdx * a1.y + n * a2.y };
      if (c.x < -s || c.x > w + s || c.y < -s || c.y > h + s) continue;
      polys.push(ngonAt(12, L, c, 15));
      // Three squares (of six neighbours, half belong to this cell) …
      for (const dir of [0, 60, 120]) {
        const a = dir * D2R;
        polys.push(
          ngonAt(
            4,
            L,
            { x: c.x + (s / 2) * Math.cos(a), y: c.y + (s / 2) * Math.sin(a) },
            dir + 45,
          ),
        );
      }
      // … and two hexagons, at the centroids of the two lattice triangles.
      const hexR = s / Math.sqrt(3);
      for (const dir of [30, 90]) {
        const a = dir * D2R;
        polys.push(
          ngonAt(6, L, { x: c.x + hexR * Math.cos(a), y: c.y + hexR * Math.sin(a) }, 0),
        );
      }
    }
  }
  return { polys, period: null };
}

export function tilingFor(fold: Fold, L: number, w: number, h: number): Tiling {
  switch (fold) {
    case "girih5":
      return girihTiling(L, w, h);
    case "khatem8":
      return khatemTiling(L, w, h);
    case "hex6":
      return hexTiling(L, w, h);
    case "twelve12":
      return twelveTiling(L, w, h);
    case "lattice":
      return { polys: [], period: null };
  }
}
