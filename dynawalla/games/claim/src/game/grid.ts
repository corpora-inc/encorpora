// The arena.
//
// A cell grid with a one-cell CLAIMED border ring around a scoreable interior.
// The ring is the rail you skate on and is deliberately NOT counted, so the
// interior is exactly `INTERIOR_CELLS` cells and every fraction the curriculum
// asks for is a whole number of them.
//
// Everything here is integer. No area is ever a float.

export const VOID = 0
export const CLAIMED = 1
export const TRAIL = 2

/**
 * 7200 = 2^5 · 3^2 · 5^2.
 *
 * Divisible by 2,3,4,5,6,8,9,10,12,15,16,18,20,24,25,30,36,40,45,48,50,60,72,
 * 75,80,90,100,120,144,… — i.e. every denominator a primary-school fraction
 * curriculum can throw at it, and every whole percent. That is the entire
 * reason for the number.
 */
export const INTERIOR_CELLS = 7200

/**
 * The arena reshapes to fill the screen it is on, and **every shape is exactly
 * 7200 cells split into exactly 40 blocks of 180**. A phone in portrait and a
 * desktop in landscape are playing the same fractions on the same units; only
 * the rectangle changes. `bx`/`by` are the block size in cells — the faint
 * poster grid you learn to estimate against, where one block is 1/40th.
 */
export type Arena = { iw: number; ih: number; bx: number; by: number }

export const ARENAS: Arena[] = [
  { iw: 60, ih: 120, bx: 12, by: 15 }, // 0.50 — tall phone
  { iw: 75, ih: 96, bx: 15, by: 12 }, // 0.78 — portrait tablet
  { iw: 80, ih: 90, bx: 10, by: 18 }, // 0.89
  { iw: 90, ih: 80, bx: 18, by: 10 }, // 1.13
  { iw: 96, ih: 75, bx: 12, by: 15 }, // 1.28 — landscape tablet
  { iw: 120, ih: 60, bx: 15, by: 12 }, // 2.00 — wide desktop
]

/** The 7200-cell rectangle that wastes the least of this screen. */
export function pickArena(aspect: number): Arena {
  let best = ARENAS[4] as Arena
  let bestLoss = Infinity
  for (const a of ARENAS) {
    // Loss = the fraction of the stage left empty once the arena is fitted.
    const fit = Math.min(aspect / (a.iw / a.ih), (a.iw / a.ih) / aspect)
    if (1 - fit < bestLoss) {
      bestLoss = 1 - fit
      best = a
    }
  }
  return best
}

export type Grid = {
  /** Full dimensions, including the one-cell rail on every side. */
  w: number
  h: number
  /** Scoreable interior dimensions. */
  iw: number
  ih: number
  /** Block size in cells. `iw/bx * ih/by` is always 40. */
  bx: number
  by: number
  /** `iw * ih` — the denominator of every fraction in the game. Always 7200. */
  total: number
  own: Uint8Array
  /** Interior cells currently CLAIMED. */
  claimed: number
  /** Which claim batch painted each cell (0 = never). Drives the colour strata. */
  batch: Uint16Array
  // Scratch, allocated once. A claim in the hot loop must not allocate.
  scratch: Uint8Array
  visited: Uint8Array
  queue: Int32Array
  dist: Int32Array
}

export function makeGrid(arena: Arena): Grid {
  const iw = arena.iw
  const ih = arena.ih
  const w = iw + 2
  const h = ih + 2
  const n = w * h
  const g: Grid = {
    w,
    h,
    iw,
    ih,
    bx: arena.bx,
    by: arena.by,
    total: iw * ih,
    own: new Uint8Array(n),
    claimed: 0,
    batch: new Uint16Array(n),
    scratch: new Uint8Array(n),
    visited: new Uint8Array(n),
    queue: new Int32Array(n),
    dist: new Int32Array(n),
  }
  resetGrid(g)
  return g
}

export function resetGrid(g: Grid): void {
  g.own.fill(VOID)
  g.batch.fill(0)
  g.claimed = 0
  for (let x = 0; x < g.w; x++) {
    g.own[x] = CLAIMED
    g.own[(g.h - 1) * g.w + x] = CLAIMED
  }
  for (let y = 0; y < g.h; y++) {
    g.own[y * g.w] = CLAIMED
    g.own[y * g.w + g.w - 1] = CLAIMED
  }
}

export function idx(g: Grid, x: number, y: number): number {
  return y * g.w + x
}

export function inBounds(g: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.w && y < g.h
}

/** True for cells that count toward the fraction — i.e. not the rail. */
export function isInterior(g: Grid, x: number, y: number): boolean {
  return x >= 1 && y >= 1 && x <= g.w - 2 && y <= g.h - 2
}

export type ClaimResult = {
  /** Interior cells taken by this cut, in flood order from the cut line. */
  cells: Int32Array
  /** Reveal distance for each entry of `cells`, same index. */
  dists: Int32Array
  /** `cells.length` — the answer to "how much did I just take". */
  count: number
  /** Largest distance in `dists`; the flood animation's duration scales on it. */
  maxDist: number
}

const EMPTY_RESULT: ClaimResult = {
  cells: new Int32Array(0),
  dists: new Int32Array(0),
  count: 0,
  maxDist: 0,
}

/**
 * Flood the void outward from every hunter. Anything the hunters cannot reach
 * is cut off, and cut off is claimed — the Qix rule, unchanged since 1981.
 *
 * Writes reachability into `target`. Cells are marked 1 when a hunter can walk
 * to them through the void.
 */
function floodFromHunters(
  g: Grid,
  own: Uint8Array,
  hunterCells: readonly number[],
  target: Uint8Array,
): void {
  target.fill(0)
  const q = g.queue
  let head = 0
  let tail = 0
  for (const c of hunterCells) {
    if (c < 0 || c >= own.length) continue
    if (own[c] !== VOID || target[c] === 1) continue
    target[c] = 1
    q[tail++] = c
  }
  const w = g.w
  while (head < tail) {
    const c = q[head++] as number
    const n0 = c - w
    const n1 = c + w
    const n2 = c - 1
    const n3 = c + 1
    if (own[n0] === VOID && target[n0] === 0) {
      target[n0] = 1
      q[tail++] = n0
    }
    if (own[n1] === VOID && target[n1] === 0) {
      target[n1] = 1
      q[tail++] = n1
    }
    if (own[n2] === VOID && target[n2] === 0) {
      target[n2] = 1
      q[tail++] = n2
    }
    if (own[n3] === VOID && target[n3] === 0) {
      target[n3] = 1
      q[tail++] = n3
    }
  }
}

/**
 * How much would this cut take, if it closed right now?
 *
 * The trail is sealed by projecting a straight ray from the head in the current
 * heading until it meets claimed ground — "if I keep going, I close here",
 * which is what a player is actually picturing. Returns the interior cell count
 * and leaves the cut-off mask in `g.scratch` (1 = would be taken) for the
 * renderer.
 *
 * Allocation-free, ~7.5k cells, comfortably under a frame at 60Hz.
 */
export function previewClaim(
  g: Grid,
  trail: readonly number[],
  headX: number,
  headY: number,
  dx: number,
  dy: number,
  hunterCells: readonly number[],
): number {
  const own = g.own
  const s = g.scratch
  s.set(own)

  for (const c of trail) s[c] = CLAIMED
  // Project forward to a wall. The rail always terminates this.
  let x = headX
  let y = headY
  if (dx !== 0 || dy !== 0) {
    for (let step = 0; step < g.w + g.h; step++) {
      x += dx
      y += dy
      if (!inBounds(g, x, y)) break
      const c = idx(g, x, y)
      if (own[c] === CLAIMED) break
      s[c] = CLAIMED
    }
  }

  floodFromHunters(g, s, hunterCells, g.visited)

  let count = 0
  for (let iy = 1; iy <= g.h - 2; iy++) {
    const row = iy * g.w
    for (let ix = 1; ix <= g.w - 2; ix++) {
      const c = row + ix
      if (s[c] === VOID && g.visited[c] === 0) {
        count++
        s[c] = 3 // mark for the renderer: "this is what you would take"
      } else if (s[c] === CLAIMED && own[c] !== CLAIMED) {
        count++
        s[c] = 3 // the trail and the projected close line are taken too
      } else {
        s[c] = 0
      }
    }
  }
  return count
}

/**
 * Close the cut. Mutates the grid.
 *
 * Returns the newly claimed interior cells ordered by distance from the cut
 * line, which is what makes the fill sweep across the region like ink instead
 * of appearing all at once.
 */
export function commitClaim(
  g: Grid,
  trail: readonly number[],
  hunterCells: readonly number[],
  batchId: number,
): ClaimResult {
  const own = g.own
  if (trail.length === 0) return EMPTY_RESULT

  const seeds: number[] = []
  for (const c of trail) {
    if (own[c] === CLAIMED) continue
    own[c] = CLAIMED
    g.batch[c] = batchId
    if (isInterior(g, c % g.w, (c / g.w) | 0)) g.claimed++
    seeds.push(c)
  }

  floodFromHunters(g, own, hunterCells, g.visited)

  // Everything the hunters could not reach falls to the player.
  const taken: number[] = []
  for (let iy = 1; iy <= g.h - 2; iy++) {
    const row = iy * g.w
    for (let ix = 1; ix <= g.w - 2; ix++) {
      const c = row + ix
      if (own[c] === VOID && g.visited[c] === 0) {
        own[c] = CLAIMED
        g.batch[c] = batchId
        g.claimed++
        taken.push(c)
      }
    }
  }

  // Reveal order: BFS distance from the cut line across everything just taken.
  const dist = g.dist
  const q = g.queue
  let head = 0
  let tail = 0
  // Reuse `visited` as the region mask: 2 = in the region and not yet queued,
  // 3 = already queued. Seeds go straight to 3 — marking them 2 would let one
  // seed re-enqueue its neighbour seed, which duplicates cells in the reveal
  // order and breaks the wave's monotonicity.
  const inRegion = g.visited
  for (const c of taken) inRegion[c] = 2
  for (const c of seeds) {
    inRegion[c] = 3
    dist[c] = 0
    q[tail++] = c
  }
  const w = g.w
  let maxDist = 0
  const order: number[] = []
  const orderDist: number[] = []
  while (head < tail) {
    const c = q[head++] as number
    const d = dist[c] as number
    order.push(c)
    orderDist.push(d)
    if (d > maxDist) maxDist = d
    const ns = [c - w, c + w, c - 1, c + 1]
    for (const n of ns) {
      if (n < 0 || n >= own.length) continue
      if (inRegion[n] !== 2) continue
      inRegion[n] = 3
      dist[n] = d + 1
      q[tail++] = n
    }
  }
  // Anything unreachable from the cut line (shouldn't happen, but a disjoint
  // pocket must still be painted) goes at the end.
  for (const c of taken) {
    if (inRegion[c] === 2) {
      order.push(c)
      orderDist.push(maxDist)
    }
  }

  return {
    cells: Int32Array.from(order),
    dists: Int32Array.from(orderDist),
    count: taken.length + seeds.filter((c) => isInterior(g, c % g.w, (c / g.w) | 0)).length,
    maxDist,
  }
}

/**
 * Give a region back to the void — the natural punishment for overshooting the
 * target. Returns the cells that were burned, so they can be shattered.
 */
export function burnBack(g: Grid, cells: Int32Array): Int32Array {
  const out: number[] = []
  for (const c of cells) {
    if (g.own[c] !== CLAIMED) continue
    if (!isInterior(g, c % g.w, (c / g.w) | 0)) continue
    g.own[c] = VOID
    g.batch[c] = 0
    g.claimed--
    out.push(c)
  }
  return Int32Array.from(out)
}

/** Cells on the claimed side of the frontier — where a crawler can walk. */
export function isFrontier(g: Grid, x: number, y: number): boolean {
  if (g.own[idx(g, x, y)] !== CLAIMED) return false
  const w = g.w
  const c = y * w + x
  return (
    g.own[c - w] === VOID || g.own[c + w] === VOID || g.own[c - 1] === VOID || g.own[c + 1] === VOID
  )
}
