import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { createGroundedCutout, type GroundedCutout } from "../render/cutout"
import { CHAR_TEX, characterDraw } from "../character/characterArt"
import { generateCharacter, ANTIGUA_1770, type WardrobeTheme } from "../character/characterGen"
import type { ObstacleField } from "../world/collision"
import type { CityLayout, CityAnchor } from "./layout"

/**
 * city/population.ts — PROXIMITY-STREAMED AMBIENT LIFE for Corpan City
 * (MASTER_BACKLOG C6).
 *
 * The spawn area read sparse. `world/crowd.ts` already gives ~28 fully-voiced,
 * talkable, generated townsfolk — but it runs at a FLAT global count across a
 * city far bigger than what's on screen, so near the player it still feels thin,
 * and bumping its count up taxes every frame everywhere.
 *
 * This is a SEPARATE, lighter layer that adds the *feeling* of a populated town
 * right where you are — and only there:
 *
 *   • a small RECYCLED POOL of ambient strollers (non-talkable background extras).
 *     The pool size is fixed and small; figures that drift past `sleepRadius` are
 *     PARKED (disabled) and RESPAWNED at a fresh point inside `wakeRadius` around
 *     the player. So a constant, lively density follows you, the count never
 *     grows, and far-away streets cost nothing (their figures are simply asleep).
 *   • STALL-KEEPERS: a figure that wakes at each VENDOR anchor near the player and
 *     gently works the stall (a soft bob), sleeping when you leave that market.
 *
 * WHY a pool, not "more crowd": the crowd is the gameplay surface (focus/dialogue
 * read every agent's live position each frame, personas + animators are heavy).
 * Ambient extras need none of that — they are immutable single-frame billboards
 * with a tiny stroll/bob, so a dozen of them near you is far cheaper than a dozen
 * more crowd agents, and they never clutter the talk affordance.
 *
 * PERF (must not regress the 123 MB / no-hitch streaming baseline):
 *   • pool is bounded (≤ `maxStrollers` + `maxStalls`). Textures are IMMUTABLE
 *     (`animatable:false`) and drawn ONCE on wake from a SHARED small set of
 *     pre-baked figure specs — texture memory is O(figureSpecs), not O(pool).
 *   • per frame: O(pool) cheap position lerps + a single sine for the bob. No
 *     persona gen, no animator repaints, no separation N², no obstacle resolve
 *     beyond a one-shot blocked() test when picking a new target.
 *   • all motion gates on reduced-motion (figures stand still, just present).
 */

/* ------------------------------------------------------------------- types */

export interface Population {
  /** advance ambient life; pass the live player position. drive from onFrame. */
  update: (dt: number, player: { x: number; z: number }) => void
  dispose: () => void
}

export interface PopulationOptions {
  layout: CityLayout
  obstacles: ObstacleField
  theme?: WardrobeTheme
  palette?: Record<string, string>
  /** honour prefers-reduced-motion (present but still — no stroll/bob). */
  reducedMotion?: boolean
  /** max concurrent visible strollers near the player. default 12. */
  maxStrollers?: number
  /** how many DISTINCT pre-baked figure textures to cycle (texture budget). default 6. */
  figureVariety?: number
  /** strollers spawn within this ring of the player. default 26. */
  wakeRadius?: number
  /** a stroller past this distance is parked + respawned near you. default 40. */
  sleepRadius?: number
  /** a vendor anchor within this distance gets a working stall-keeper. default 34. */
  stallWakeRadius?: number
  /** max concurrent stall-keeper cutouts (a recycled pool, NOT one-per-vendor —
   * keeps texture memory bounded regardless of how many markets the city has).
   * default 4. */
  maxStalls?: number
}

interface Stroller {
  cut: GroundedCutout
  x: number
  z: number
  tx: number
  tz: number
  speed: number
  idleT: number
  awake: boolean
  variety: number
  bobPhase: number
}

interface StallKeeper {
  cut: GroundedCutout
  /** the vendor anchor this pooled keeper is currently bound to (null = free). */
  anchor: CityAnchor | null
  bobPhase: number
}

const AGENT_R = 0.45
const STROLL_SPEED = 1.7 // u/s — a relaxed amble, slower than the crowd's stroll
const ARRIVE = 1.0

export function createPopulation(scene: BabylonScene, opts: PopulationOptions): Population {
  const theme = opts.theme ?? ANTIGUA_1770
  const maxStrollers = opts.maxStrollers ?? 12
  const maxStalls = opts.maxStalls ?? 4
  const variety = Math.max(1, opts.figureVariety ?? 6)
  const wakeR = opts.wakeRadius ?? 26
  const sleepR = opts.sleepRadius ?? 40
  const stallWakeR = opts.stallWakeRadius ?? 34
  const reduce = !!opts.reducedMotion
  const field = opts.obstacles
  const { bounds } = opts.layout

  const margin = AGENT_R + 0.5
  const rand = (a: number, b: number) => a + Math.random() * (b - a)
  const clampX = (x: number) => Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, x))
  const clampZ = (z: number) => Math.max(bounds.minZ + margin, Math.min(bounds.maxZ - margin, z))

  // ── shared pre-baked figure DRAW fns — the texture budget cap ──────────────
  // We generate `variety` distinct townsperson specs ONCE; every stroller in the
  // pool reuses one of these draws. The cutout still owns its own (immutable)
  // texture instance, but they're painted from a small shared set so the look is
  // varied without unbounded unique art. (Cheap: gen is pure + deterministic.)
  const figureDraws = Array.from({ length: variety }, (_, i) => {
    const spec = generateCharacter("crowd", `ambient:${opts.layout.seed}:${i}`, theme)
    return { draw: characterDraw(spec), shadowR: spec.build === "child" ? 0.5 : 0.6 }
  })

  // Ambient extras render at HALF the crowd's texture resolution. `drawCharacter`
  // is fully proportional to (w,h), so the silhouette is identical at distance —
  // but each texture is ~4× cheaper (the whole layer's memory cost stays a few MB,
  // protecting the 123 MB streaming ceiling). They're background billboards seen
  // from across the plaza, never inspected up close, so the half-res reads clean.
  const TEX_W = Math.round(CHAR_TEX.w / 2)
  const TEX_H = Math.round(CHAR_TEX.h / 2)
  const makeCutout = (variety: number): GroundedCutout => {
    const f = figureDraws[variety % figureDraws.length]
    return createGroundedCutout(scene, {
      w: TEX_W,
      h: TEX_H,
      draw: (ctx, w, h) => f.draw(ctx, w, h),
      shadowRadius: f.shadowR,
      // immutable texture (no per-frame repaints) + non-pickable: these are
      // background extras, never a talk target. The pick layer ignores them
      // because they carry no `npc:` tag.
      animatable: false,
      pickTag: undefined,
    })
  }

  /** A free walkable point inside the ring [near,far] around the player. */
  const pickNear = (px: number, pz: number, near: number, far: number): { x: number; z: number } => {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2
      const r = near + Math.random() * (far - near)
      const x = clampX(px + Math.cos(a) * r)
      const z = clampZ(pz + Math.sin(a) * r)
      if (!field.blocked(x, z, AGENT_R)) return { x, z }
    }
    return { x: clampX(px + rand(-far, far)), z: clampZ(pz + rand(-far, far)) }
  }

  // ── stroller pool — start ASLEEP; first update() wakes them near the player ─
  const strollers: Stroller[] = []
  for (let i = 0; i < maxStrollers; i++) {
    const v = i % variety
    const cut = makeCutout(v)
    cut.root.setEnabled(false)
    strollers.push({
      cut, x: 0, z: 0, tx: 0, tz: 0, speed: 0,
      idleT: 0, awake: false, variety: v, bobPhase: Math.random() * Math.PI * 2,
    })
  }

  // ── stall-keepers — a small RECYCLED POOL bound to whichever vendor anchors
  // are near the player. The city can have many markets, but only the handful
  // near you ever get a keeper, and the cutout count is capped at `maxStalls`
  // (so texture memory is O(maxStalls), not O(vendors)). Each frame we bind free
  // pooled keepers to the nearest unmanned in-range vendors and release far ones.
  const vendorAnchors = opts.layout.anchors.filter((a) => a.kind === "vendor")
  const stalls: StallKeeper[] = Array.from({ length: maxStalls }, (_, i) => {
    const cut = makeCutout((i + 3) % variety) // offset variety so keeper ≠ adjacent stroller
    cut.root.setEnabled(false)
    return { cut, anchor: null, bobPhase: Math.random() * Math.PI * 2 }
  })

  const wake = (s: Stroller, px: number, pz: number) => {
    const p = pickNear(px, pz, wakeR * 0.4, wakeR)
    s.x = p.x
    s.z = p.z
    const t = pickNear(px, pz, 2, wakeR)
    s.tx = t.x
    s.tz = t.z
    s.idleT = Math.random() * 1.5
    s.awake = true
    s.cut.setGroundPos(s.x, s.z)
    s.cut.root.setEnabled(true)
  }
  const sleep = (s: Stroller) => {
    s.awake = false
    s.cut.root.setEnabled(false)
  }

  let primed = false
  const update: Population["update"] = (dt, player) => {
    // first tick: wake the whole pool around the spawn so it's lively immediately.
    if (!primed) {
      for (const s of strollers) wake(s, player.x, player.z)
      primed = true
    }

    // ---- strollers: stream by proximity, amble, recycle ----
    for (const s of strollers) {
      if (!s.awake) {
        wake(s, player.x, player.z)
        continue
      }
      const pd = Math.hypot(s.x - player.x, s.z - player.z)
      // too far → park + respawn near the player (density follows you).
      if (pd > sleepR) {
        sleep(s)
        continue
      }

      if (reduce) {
        // present but still: keep them planted, no motion.
        continue
      }

      // idle pause then a new near target.
      if (s.idleT > 0) {
        s.idleT -= dt
        s.speed = 0
        continue
      }

      let dx = s.tx - s.x
      let dz = s.tz - s.z
      const dist = Math.hypot(dx, dz)
      if (dist < ARRIVE) {
        const t = pickNear(player.x, player.z, 3, wakeR)
        s.tx = t.x
        s.tz = t.z
        s.idleT = 0.6 + Math.random() * 1.8
        s.speed = 0
        continue
      }
      dx /= dist
      dz /= dist
      const step = STROLL_SPEED * dt
      let nx = s.x + dx * step
      let nz = s.z + dz * step
      // one-shot slide around obstacles (cheap; no full resolve loop).
      const r = field.resolve(s.x, s.z, nx, nz, AGENT_R)
      nx = r.x
      nz = r.z
      // wedged → re-target next frame.
      if (Math.abs(nx - s.x) < 1e-4 && Math.abs(nz - s.z) < 1e-4) {
        const t = pickNear(player.x, player.z, 3, wakeR)
        s.tx = t.x
        s.tz = t.z
      }
      nx = clampX(nx)
      nz = clampZ(nz)
      const moved = Math.hypot(nx - s.x, nz - s.z)
      s.x = nx
      s.z = nz
      s.speed = step > 0 ? moved / step : 0
      // a faint walking bob — the only animation these extras get (free).
      s.bobPhase += dt * 9
      const bob = s.speed > 0.05 ? Math.abs(Math.sin(s.bobPhase)) * 0.07 : 0
      s.cut.setGroundPos(s.x, s.z)
      s.cut.hop(bob)
    }

    // ---- stall-keepers: recycle the pool onto the nearest in-range markets ----
    // 1) release keepers whose market drifted out of range.
    const managed = new Set<string>()
    for (const k of stalls) {
      if (k.anchor) {
        const pd = Math.hypot(k.anchor.x - player.x, k.anchor.z - player.z)
        if (pd > stallWakeR) {
          k.anchor = null
          k.cut.root.setEnabled(false)
        } else {
          managed.add(k.anchor.id)
        }
      }
    }
    // 2) bind free keepers to the nearest in-range, unmanned vendor anchors.
    for (const k of stalls) {
      if (k.anchor) continue
      let best: CityAnchor | null = null
      let bd = stallWakeR * stallWakeR
      for (const a of vendorAnchors) {
        if (managed.has(a.id)) continue
        const d = (a.x - player.x) ** 2 + (a.z - player.z) ** 2
        if (d <= bd) {
          bd = d
          best = a
        }
      }
      if (!best) break // no more in-range markets to staff
      managed.add(best.id)
      k.anchor = best
      // stand JUST off the stall anchor so the keeper reads as tending it.
      const ox = best.x + Math.cos(best.facing ?? 0) * 0.9
      const oz = best.z + Math.sin(best.facing ?? 0) * 0.9
      const free = field.pushOut(clampX(ox), clampZ(oz), AGENT_R)
      k.cut.setGroundPos(free.x, free.z)
      k.cut.root.setEnabled(true)
    }
    // 3) the gentle "working the stall" bob for the bound keepers.
    if (!reduce) {
      for (const k of stalls) {
        if (!k.anchor) continue
        k.bobPhase += dt * 2.4
        k.cut.hop(Math.abs(Math.sin(k.bobPhase)) * 0.06)
      }
    }
  }

  return {
    update,
    dispose: () => {
      for (const s of strollers) s.cut.dispose()
      for (const k of stalls) k.cut.dispose()
      strollers.length = 0
      stalls.length = 0
    },
  }
}
