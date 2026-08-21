// Geometry for the cut. Everything here is allocation-free on the hot path:
// the clipper writes into caller-supplied flat arrays and returns a length.

/** Signed distance from a point to the directed line through (px,py) with unit normal (nx,ny). */
export function sideOf(x: number, y: number, px: number, py: number, nx: number, ny: number): number {
  return (x - px) * nx + (y - py) * ny
}

/**
 * Does segment (ax,ay)→(bx,by) come within `r` of the point (cx,cy)?
 *
 * This is the broad phase of the cut: a blade segment against a body's bounding
 * circle. Returns the squared distance so the caller can rank hits along the
 * blade without a sqrt.
 */
export function segPointDistSq(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = 0
  if (len2 > 1e-9) {
    t = ((cx - ax) * dx + (cy - ay) * dy) / len2
    t = t < 0 ? 0 : t > 1 ? 1 : t
  }
  const px = ax + dx * t - cx
  const py = ay + dy * t - cy
  return px * px + py * py
}

/**
 * Clip a convex polygon against a half-plane — one half of Sutherland–Hodgman.
 *
 * `src` is a flat [x0,y0,x1,y1,...] array of `n` points. Keeps the side where
 * `sideOf(...) >= 0` when `keepPositive`, else the other. Writes into `dst` and
 * returns the number of points written. `dst` must have room for n+2 points;
 * clipping a convex polygon by a line adds at most one vertex.
 */
export function clipHalfPlane(
  src: Float32Array,
  n: number,
  px: number,
  py: number,
  nx: number,
  ny: number,
  keepPositive: boolean,
  dst: Float32Array,
): number {
  if (n < 3) return 0
  const sign = keepPositive ? 1 : -1
  let out = 0
  let axi = (n - 1) * 2
  let ax = src[axi] as number
  let ay = src[axi + 1] as number
  let ad = sideOf(ax, ay, px, py, nx, ny) * sign

  for (let i = 0; i < n; i++) {
    const bxi = i * 2
    const bx = src[bxi] as number
    const by = src[bxi + 1] as number
    const bd = sideOf(bx, by, px, py, nx, ny) * sign

    if (bd >= 0) {
      if (ad < 0) {
        const t = ad / (ad - bd)
        dst[out * 2] = ax + (bx - ax) * t
        dst[out * 2 + 1] = ay + (by - ay) * t
        out++
      }
      dst[out * 2] = bx
      dst[out * 2 + 1] = by
      out++
    } else if (ad >= 0) {
      const t = ad / (ad - bd)
      dst[out * 2] = ax + (bx - ax) * t
      dst[out * 2 + 1] = ay + (by - ay) * t
      out++
    }
    ax = bx
    ay = by
    ad = bd
    axi = bxi
  }
  return out
}

/** Area-weighted centroid of a flat polygon. Writes into `out` (length 2). */
export function centroid(src: Float32Array, n: number, out: Float32Array): number {
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const x0 = src[i * 2] as number
    const y0 = src[i * 2 + 1] as number
    const x1 = src[j * 2] as number
    const y1 = src[j * 2 + 1] as number
    const cross = x0 * y1 - x1 * y0
    area += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  area *= 0.5
  if (Math.abs(area) < 1e-6) {
    // Degenerate sliver: fall back to the vertex mean so a chunk never lands at
    // NaN and vanishes into the void mid-frame.
    let mx = 0
    let my = 0
    for (let i = 0; i < n; i++) {
      mx += src[i * 2] as number
      my += src[i * 2 + 1] as number
    }
    out[0] = mx / n
    out[1] = my / n
    return 0
  }
  out[0] = cx / (6 * area)
  out[1] = cy / (6 * area)
  return Math.abs(area)
}

/** Write a regular n-gon of radius r, rotated by `phase`, into `dst`. */
export function regularPolygon(
  dst: Float32Array,
  sides: number,
  r: number,
  phase: number,
  wobble: number,
  seedFn: (i: number) => number,
): number {
  for (let i = 0; i < sides; i++) {
    const a = phase + (i / sides) * Math.PI * 2
    const rr = r * (1 + (seedFn(i) - 0.5) * wobble)
    dst[i * 2] = Math.cos(a) * rr
    dst[i * 2 + 1] = Math.sin(a) * rr
  }
  return sides
}
