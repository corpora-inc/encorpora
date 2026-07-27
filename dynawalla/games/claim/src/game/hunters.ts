// What is chasing you.
//
// Three shapes, three behaviours, three threat languages. Colour never carries
// the meaning on its own — a drifter is a spinning spiked star, a crawler is a
// square with a chevron riding the frontier, a charger telegraphs with a beam
// before it moves.

import { CLAIMED, VOID, idx, inBounds, isFrontier, type Grid } from "./grid.ts"
import type { Rng } from "./rng.ts"

export type HunterKind = "drifter" | "crawler" | "charger"

export type Hunter = {
  kind: HunterKind
  x: number
  y: number
  vx: number
  vy: number
  speed: number
  phase: number
  spin: number
  /** Charger only. */
  mode: "roam" | "aim" | "dash" | "rest"
  timer: number
  aimX: number
  aimY: number
  /** Crawler only: the cell it occupies and the direction it walks. */
  cx: number
  cy: number
  fx: number
  fy: number
  stepAcc: number
  stuck: number
  /** Fades in on spawn so nothing ever appears on top of you. */
  born: number
}

export function spawnDrifter(g: Grid, rng: Rng, speed: number, kind: HunterKind = "drifter"): Hunter {
  // Middle third of the arena — never on the rail, never on the player.
  const x = g.w / 2 + (rng.next() - 0.5) * g.w * 0.42
  const y = g.h / 2 + (rng.next() - 0.5) * g.h * 0.42
  const a = rng.next() * Math.PI * 2
  return {
    kind,
    x,
    y,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    speed,
    phase: rng.next() * 6.28,
    spin: (rng.next() - 0.5) * 3.4,
    mode: "roam",
    timer: 1 + rng.next() * 2,
    aimX: 0,
    aimY: 0,
    cx: 0,
    cy: 0,
    fx: 0,
    fy: 0,
    stepAcc: 0,
    stuck: 0,
    born: 0,
  }
}

export function spawnCrawler(g: Grid, rng: Rng, speed: number): Hunter {
  const side = rng.int(4)
  const cx = side === 0 ? 0 : side === 1 ? g.w - 1 : 1 + rng.int(g.w - 2)
  const cy = side === 2 ? 0 : side === 3 ? g.h - 1 : 1 + rng.int(g.h - 2)
  const h = spawnDrifter(g, rng, speed, "crawler")
  h.cx = cx
  h.cy = cy
  h.x = cx + 0.5
  h.y = cy + 0.5
  h.fx = side < 2 ? 0 : 1
  h.fy = side < 2 ? 1 : 0
  return h
}

function solid(g: Grid, x: number, y: number): boolean {
  if (!inBounds(g, x, y)) return true
  return g.own[idx(g, x, y)] === CLAIMED
}

function bounce(g: Grid, h: Hunter, dt: number, rng: Rng): void {
  const nx = h.x + h.vx * dt
  const ny = h.y + h.vy * dt
  if (solid(g, Math.floor(nx), Math.floor(h.y))) {
    h.vx = -h.vx
    h.x += h.vx * dt
    h.spin = (rng.next() - 0.5) * 5
  } else {
    h.x = nx
  }
  if (solid(g, Math.floor(h.x), Math.floor(ny))) {
    h.vy = -h.vy
    h.y += h.vy * dt
    h.spin = (rng.next() - 0.5) * 5
  } else {
    h.y = ny
  }
  // A hunter that ends up buried (its pocket got claimed out from under it)
  // is teleported to open ground rather than left vibrating inside a wall.
  if (solid(g, Math.floor(h.x), Math.floor(h.y))) {
    for (let tries = 0; tries < 64; tries++) {
      const tx = 1 + rng.int(g.w - 2)
      const ty = 1 + rng.int(g.h - 2)
      if (g.own[idx(g, tx, ty)] === VOID) {
        h.x = tx + 0.5
        h.y = ty + 0.5
        return
      }
    }
  }
}

function crawlStep(g: Grid, h: Hunter): void {
  // Walk the frontier: of the four neighbours that are claimed ground with the
  // void alongside, take the one that turns least. Reversing is a last resort.
  const opts: Array<{ x: number; y: number; score: number }> = []
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (const d of dirs) {
    const nx = h.cx + (d[0] as number)
    const ny = h.cy + (d[1] as number)
    if (!inBounds(g, nx, ny)) continue
    if (!isFrontier(g, nx, ny)) continue
    const back = (d[0] as number) === -h.fx && (d[1] as number) === -h.fy
    const straight = (d[0] as number) === h.fx && (d[1] as number) === h.fy
    opts.push({ x: nx, y: ny, score: back ? -2 : straight ? 2 : 1 })
  }
  if (opts.length === 0) {
    h.stuck++
    return
  }
  opts.sort((a, b) => b.score - a.score)
  const pick = opts[0] as { x: number; y: number; score: number }
  h.fx = pick.x - h.cx
  h.fy = pick.y - h.cy
  h.cx = pick.x
  h.cy = pick.y
  h.stuck = 0
}

export function relocateCrawler(g: Grid, h: Hunter, rng: Rng): void {
  for (let tries = 0; tries < 400; tries++) {
    const x = rng.int(g.w)
    const y = rng.int(g.h)
    if (isFrontier(g, x, y)) {
      h.cx = x
      h.cy = y
      h.x = x + 0.5
      h.y = y + 0.5
      h.stuck = 0
      return
    }
  }
}

export function updateHunter(
  g: Grid,
  h: Hunter,
  dt: number,
  rng: Rng,
  playerX: number,
  playerY: number,
): void {
  h.born = Math.min(1, h.born + dt * 1.6)
  h.phase += dt * 3.4
  if (h.kind === "crawler") {
    h.stepAcc += dt * h.speed * 0.72
    let guard = 0
    while (h.stepAcc >= 1 && guard++ < 8) {
      h.stepAcc -= 1
      crawlStep(g, h)
      if (h.stuck > 2) {
        relocateCrawler(g, h, rng)
        break
      }
    }
    // Interpolate visually toward the cell so it glides rather than snaps.
    h.x += (h.cx + 0.5 - h.x) * Math.min(1, dt * 18)
    h.y += (h.cy + 0.5 - h.y) * Math.min(1, dt * 18)
    return
  }

  if (h.kind === "charger") {
    h.timer -= dt
    if (h.mode === "roam") {
      bounce(g, h, dt * 0.7, rng)
      if (h.timer <= 0) {
        h.mode = "aim"
        h.timer = 0.95
        h.aimX = playerX
        h.aimY = playerY
      }
    } else if (h.mode === "aim") {
      // Track slowly while winding up — dodgeable, but only if you move.
      h.aimX += (playerX - h.aimX) * Math.min(1, dt * 2.4)
      h.aimY += (playerY - h.aimY) * Math.min(1, dt * 2.4)
      if (h.timer <= 0) {
        const a = Math.atan2(h.aimY - h.y, h.aimX - h.x)
        h.vx = Math.cos(a) * h.speed * 3.1
        h.vy = Math.sin(a) * h.speed * 3.1
        h.mode = "dash"
        h.timer = 0.6
      }
    } else if (h.mode === "dash") {
      bounce(g, h, dt, rng)
      if (h.timer <= 0) {
        h.mode = "rest"
        h.timer = 0.75
        const a = Math.atan2(h.vy, h.vx)
        h.vx = Math.cos(a) * h.speed
        h.vy = Math.sin(a) * h.speed
      }
    } else {
      bounce(g, h, dt * 0.35, rng)
      if (h.timer <= 0) {
        h.mode = "roam"
        h.timer = 1.6 + rng.next() * 1.8
      }
    }
    return
  }

  bounce(g, h, dt, rng)
  h.timer -= dt
  if (h.timer <= 0) {
    // The Qix wobble: an erratic course correction, not a straight line.
    h.timer = 0.5 + rng.next() * 1.3
    const a = Math.atan2(h.vy, h.vx) + (rng.next() - 0.5) * 1.7
    h.vx = Math.cos(a) * h.speed
    h.vy = Math.sin(a) * h.speed
  }
}

/** Cells to seed the cut-off flood from. Crawlers ride claimed ground and don't count. */
export function voidSeeds(g: Grid, hunters: readonly Hunter[]): number[] {
  const out: number[] = []
  for (const h of hunters) {
    if (h.kind === "crawler") continue
    const x = Math.floor(h.x)
    const y = Math.floor(h.y)
    if (inBounds(g, x, y) && g.own[idx(g, x, y)] === VOID) {
      out.push(idx(g, x, y))
      continue
    }
    // Defensive: a hunter standing on the trail at the instant it closes would
    // otherwise seed nothing and hand the player the entire arena.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (inBounds(g, nx, ny) && g.own[idx(g, nx, ny)] === VOID) {
          out.push(idx(g, nx, ny))
          dy = 2
          break
        }
      }
    }
  }
  return out
}
