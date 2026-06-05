import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import { createGroundedCutout, type GroundedCutout } from "../render/cutout"
import { CHAR_TEX, characterDraw } from "../character/characterArt"
import { generateCharacter, ANTIGUA_1770, type WardrobeTheme } from "../character/characterGen"
import type { CharacterSpec } from "../character/characterSpec"
import { generatePersona } from "../npc/personaGen"
import type { CrowdFocusHandle } from "../world/crowd"
import type { Scene as ContentScene } from "@world-plaza/contracts"
import type { ObstacleField } from "../world/collision"
import type { CityLayout, CityAnchor } from "./layout"

/**
 * city/population.ts — PROXIMITY-STREAMED AMBIENT LIFE for Corpan City
 * (MASTER_BACKLOG C6).
 *
 * The spawn area read sparse. `world/crowd.ts` gives ~28 fully-voiced talkable
 * townsfolk, but at a FLAT global count across a city far bigger than what's on
 * screen, so near the player it still feels thin and bumping its count taxes
 * every frame everywhere. This lighter layer adds populated-town density right
 * where the player is — and only there.
 *
 * EVERY VISIBLE PERSON IS WALK-UP TALKABLE (owner ruling — "I don't want NPCs I
 * can't interact with"). The ambient strollers are NOT mute background extras:
 * each exposes a `CrowdFocusHandle` (`focusables`) that game.ts merges into the
 * SAME `npcFocus` list as the crowd, so approaching one shows the Talk button and
 * opens a real conversation. The expensive `generatePersona` is LAZY — built +
 * cached the first time a stroller's `role` is read (i.e. on engage), so density
 * stays cheap until you actually talk to someone. Stall-keepers are talkable too.
 *
 *   • a small RECYCLED POOL of ambient strollers. Figures past `sleepRadius` are
 *     PARKED (disabled) and RESPAWNED inside `wakeRadius` around the player, so a
 *     constant lively density follows you and far streets cost nothing.
 *   • STALL-KEEPERS: a pooled figure that wakes at each near VENDOR anchor and
 *     gently works the stall, sleeping when you leave that market.
 *
 * PERF (must not regress the 123 MB / no-hitch streaming baseline):
 *   • pool is bounded (≤ `maxStrollers` + `maxStalls`). Textures are IMMUTABLE
 *     (`animatable:false`, no per-frame animator) and drawn ONCE on wake from a
 *     SHARED small set of pre-baked figure specs — texture memory is
 *     O(figureSpecs), not O(pool). Talkability adds NO per-frame cost: the persona
 *     is generated lazily on first engage and cached, never per frame.
 *   • per frame: O(pool) cheap position lerps + a single sine bob + a one-frame
 *     soft player-yield. No animator repaints, no separation N².
 *   • all motion gates on reduced-motion (figures stand still, just present).
 */

/* ------------------------------------------------------------------- types */

export interface Population {
  /** advance ambient life; pass the live player position. drive from onFrame. */
  update: (dt: number, player: { x: number; z: number }) => void
  /**
   * Focus-compatible handles for EVERY ambient figure (strollers + stall-keepers),
   * so game.ts can merge them into the SAME `npcFocus` list as the crowd — every
   * visible person is walk-up talkable (owner ruling). Each handle's `role` is a
   * LAZY getter: the persona is generated + cached on first read (i.e. on engage),
   * so this costs nothing until the player actually talks to one. Stable for the
   * population's lifetime (the underlying pooled cutout is recycled, but each slot
   * keeps a stable id + persona so a re-woken figure stays the same person).
   */
  focusables: CrowdFocusHandle[]
  /**
   * Freeze ONE ambient figure in place by its handle `anchorId` (the npcId) — the
   * focus/dialogue layer calls this when its Talk button is up or a conversation
   * is open, so a talkable stroller STOPS and waits instead of wandering off mid-
   * chat. Pass `null` to release. Mirrors `crowd.setHeld` so game.ts can route a
   * focus/engage to whichever layer owns the id (an unknown id is a harmless no-op,
   * so game.ts can safely call BOTH `crowd.setHeld` and `population.setHeld`).
   */
  setHeld: (npcId: string | null) => void
  dispose: () => void
}

export interface PopulationOptions {
  layout: CityLayout
  obstacles: ObstacleField
  theme?: WardrobeTheme
  palette?: Record<string, string>
  /**
   * The active content Scene — used to generate each ambient figure's persona
   * (lazily, on first engage) so strollers are talkable like the crowd. Optional
   * so test callers compile; without it the figures fall back to a neutral persona
   * seed (still talkable, just scene-neutral flavour).
   */
  scene?: ContentScene
  /** honour prefers-reduced-motion (present but still — no stroll/bob). */
  reducedMotion?: boolean
  /**
   * The camera's ground-plane forward heading (unit-ish XZ), read each frame. When
   * provided, freshly-woken strollers spawn in the player's REAR/SIDE arc (outside
   * the forward view cone) so nothing materializes in front of you (§5 pop-in).
   * Absent → spawn anywhere in the ring (the fade-in still hides the appearance).
   */
  getForward?: () => { x: number; z: number }
  /** max concurrent visible strollers near the player. default 8 (kept below the
   *  talkable crowd count so ambient extras complement, not dominate). */
  maxStrollers?: number
  /** how many DISTINCT pre-baked figure textures to cycle (texture budget). default 16
   *  — enough that the near-field crowd reads as a mixed populace, not clones (#60). */
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
  /** fade-in clock: counts up 0→FADE_IN on wake so the figure ramps in (§5). */
  fadeT: number
  /** the focus-compatible handle (live pos + lazy persona) game.ts engages on. */
  handle: CrowdFocusHandle
}

interface StallKeeper {
  cut: GroundedCutout
  /** the vendor anchor this pooled keeper is currently bound to (null = free). */
  anchor: CityAnchor | null
  bobPhase: number
  /** fade-in clock: 0→FADE_IN on bind so a keeper eases in, never pops (§5). */
  fadeT: number
  /** the focus-compatible handle (live pos + lazy persona) game.ts engages on. */
  handle: CrowdFocusHandle
}

const AGENT_R = 0.45
const STROLL_SPEED = 1.7 // u/s — a relaxed amble, slower than the crowd's stroll
const ARRIVE = 1.0
const FADE_IN = 0.5 // seconds a woken stroller ramps from invisible → full (§5)
// Half-angle (radians) of the player's forward view cone that wake-spawns avoid.
// ~70° each side ≈ a 140° front arc kept clear, wider than the follow-cam FOV so a
// figure never appears on-screen. Spawns land in the rear/side 220°.
const VIEW_CONE_HALF = 1.22
// SOFT BODY GAP — a stroller keeps ≥ this from the player so you never phase
// straight THROUGH an ambient figure (kills the "crowd of ghosts" feel). It's a
// gentle YIELD: the stroller steps aside, reading as a present, solid body without
// a hard wall (these movers aren't in the static obstacle field). Mirrors
// crowd.ts BODY_GAP so ambient + talkable extras feel the same to walk among.
const PLAYER_BODY_GAP = 1.0
// #24 — DON'T converge on the player. Strollers wander to targets near their OWN
// position (local meander), and any target/spawn within this radius of the player
// is rejected, so the ambient crowd MILLS dispersed and never paths toward you.
const PLAYER_KEEPOUT = 7
// #60 — a STALL-KEEPER must not stand on top of you either. The owner stands AT a
// market to do the quest, where vendor anchors cluster, so without this every
// keeper bound to a near anchor and mobbed the player. A keeper whose anchor is
// within this radius of the player is NOT bound (we leave that stall un-staffed
// until you step back), and a bound keeper is nudged to sit at least this far out.
// Slightly tighter than the stroller keepout: a keeper legitimately tends a fixed
// post, so it may read a touch closer than a free wanderer — but never in your lap.
const KEEPER_KEEPOUT = 5.5
// How far a stroller meanders per wander leg (local — NOT recentred on the player).
const WANDER_LEG = 9

export function createPopulation(scene: BabylonScene, opts: PopulationOptions): Population {
  const theme = opts.theme ?? ANTIGUA_1770
  // Default ambient density tuned DOWN from 12 → 8 so the near-field isn't
  // dominated by non-talkable extras (the "I keep trying to talk to NPCs that
  // can't respond" complaint). They COMPLEMENT the ~28 talkable crowd agents
  // (crowd.ts), not outnumber them. Callers can still override.
  const maxStrollers = opts.maxStrollers ?? 6 // NPCs −25% (perf + declutter): was 8
  const maxStalls = opts.maxStalls ?? 4
  // #60 — the crowd read as "a wall of identical people." With only 6 distinct
  // pre-baked sprites, the ~12 near-field figures were visibly cloned (and a
  // market's stall-keepers, drawn from the same tiny set, doubled down on it).
  // Bumping to 16 distinct townsperson looks — strollers index `i%variety`,
  // keepers `(i+3)%variety` — gives a believably MIXED populace. Each look is a
  // half-res billboard (a few KB), so 16 stays well inside the texture budget. The
  // PERSONA archetype (baker/scribe/herbalist/…) is already varied per figure; this
  // makes the variety VISIBLE, not just in the engage text.
  const variety = Math.max(1, opts.figureVariety ?? 16)
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

  // Persona scene: the active content Scene flavours each figure's lazily-built
  // persona; a neutral fallback keeps figures talkable even when none is passed.
  const personaScene: ContentScene = opts.scene ?? NEUTRAL_PERSONA_SCENE

  // ── shared pre-baked figure DRAW fns — the texture budget cap ──────────────
  // We generate `variety` distinct townsperson SPECS ONCE; every figure reuses
  // one. The cutout owns its own (immutable) texture, but they're painted from
  // this small shared set so the look is varied without unbounded unique art. We
  // KEEP the `spec` per variety so a figure's lazy persona is generated from the
  // SAME face/demeanor the player sees (face ↔ persona coherence). (Pure + cheap.)
  const figureDraws = Array.from({ length: variety }, (_, i) => {
    const spec = generateCharacter("crowd", `ambient:${opts.layout.seed}:${i}`, theme)
    return { draw: characterDraw(spec), shadowR: spec.build === "child" ? 0.5 : 0.6, spec }
  })

  // Build the focus-compatible handle for one pooled figure. `role` is a LAZY,
  // cached getter: the (expensive) persona is generated only the first time it's
  // read — i.e. when game.ts engages this figure — so an un-talked-to figure costs
  // nothing beyond its billboard. `npcId` is stable for the slot's lifetime so a
  // recycled figure stays the SAME person + routes dialogue consistently.
  const makeHandle = (cut: GroundedCutout, npcId: string, spec: CharacterSpec): CrowdFocusHandle => {
    let persona: ReturnType<typeof generatePersona> | null = null
    return {
      anchorId: npcId,
      kind: "npc",
      billboard: {
        // live position the focus layer reads each frame (the SAME Vector3 the
        // billboard renders at — setGroundPos mutates it in place, no offset/lag).
        root: { position: cut.root.position },
        setScale: (s) => cut.setScale(s),
      },
      get role() {
        if (!persona) {
          persona = generatePersona(npcId, { scene: personaScene, spec })
        }
        return persona
      },
    }
  }

  // Ambient extras render at HALF the crowd's texture resolution. `drawCharacter`
  // is fully proportional to (w,h), so the silhouette is identical at distance —
  // but each texture is ~4× cheaper (the whole layer's memory cost stays a few MB,
  // protecting the 123 MB streaming ceiling). They're background billboards seen
  // from across the plaza, never inspected up close, so the half-res reads clean.
  const TEX_W = Math.round(CHAR_TEX.w / 2)
  const TEX_H = Math.round(CHAR_TEX.h / 2)
  // Make a pooled figure's cutout. It is a REAL talk target now (owner ruling:
  // every visible person is interactive), so it carries an `npc:` pick tag and a
  // pickable plane just like a crowd agent — `npcId` routes both the focus handle
  // and any tap-pick to the same figure. The texture stays immutable (no animator)
  // and the persona is lazy, so talkability adds no per-frame / no upfront cost.
  const makeCutout = (variety: number, npcId: string): GroundedCutout => {
    const f = figureDraws[variety % figureDraws.length]
    return createGroundedCutout(scene, {
      w: TEX_W,
      h: TEX_H,
      draw: (ctx, w, h) => f.draw(ctx, w, h),
      shadowRadius: f.shadowR,
      // immutable texture (no per-frame repaints): no animator, just a billboard.
      animatable: false,
      pickTag: `npc:${npcId}`,
    })
  }

  /** A free walkable point inside the ring [near,far] around the player. When
   *  `avoidFwd` is set, the sampled bearing is kept OUT of the player's forward
   *  view cone (so wake-spawns land behind/beside you, not on-screen — §5). */
  const pickNear = (
    px: number,
    pz: number,
    near: number,
    far: number,
    avoidFwd?: { x: number; z: number },
  ): { x: number; z: number } => {
    // the camera-forward bearing to avoid (only when we have a non-degenerate dir).
    const fwdLen = avoidFwd ? Math.hypot(avoidFwd.x, avoidFwd.z) : 0
    const fwdAng = fwdLen > 1e-3 ? Math.atan2(avoidFwd!.z, avoidFwd!.x) : null
    for (let i = 0; i < 16; i++) {
      let a = Math.random() * Math.PI * 2
      if (fwdAng !== null) {
        // if the bearing falls inside the forward cone, reflect it to the rear arc.
        let d = a - fwdAng
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        if (Math.abs(d) < VIEW_CONE_HALF) {
          // push to the nearest cone edge, then out into the rear hemisphere.
          const sign = d >= 0 ? 1 : -1
          a = fwdAng + sign * (VIEW_CONE_HALF + Math.random() * (Math.PI - VIEW_CONE_HALF))
        }
      }
      const r = near + Math.random() * (far - near)
      const x = clampX(px + Math.cos(a) * r)
      const z = clampZ(pz + Math.sin(a) * r)
      if (!field.blocked(x, z, AGENT_R)) return { x, z }
    }
    return { x: clampX(px + rand(-far, far)), z: clampZ(pz + rand(-far, far)) }
  }

  /**
   * #24 — a LOCAL meander target from the stroller's OWN position (sx,sz), kept
   * clear of the player's keepout so the ambient crowd disperses and never paths
   * toward you. Unlike `pickNear`(player-centred), this picks a nearby point around
   * the FIGURE, so strollers drift around their own neighbourhood, not your feet.
   */
  const pickWander = (sx: number, sz: number, player: { x: number; z: number }): { x: number; z: number } => {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2
      const r = WANDER_LEG * (0.35 + Math.random() * 0.65)
      const x = clampX(sx + Math.cos(a) * r)
      const z = clampZ(sz + Math.sin(a) * r)
      if (field.blocked(x, z, AGENT_R)) continue
      // reject targets that would walk the stroller INTO the player's space.
      if (Math.hypot(x - player.x, z - player.z) < PLAYER_KEEPOUT) continue
      return { x, z }
    }
    // fallback: a small step directly AWAY from the player (never toward).
    const ax = sx - player.x
    const az = sz - player.z
    const al = Math.hypot(ax, az) || 1
    return { x: clampX(sx + (ax / al) * 4), z: clampZ(sz + (az / al) * 4) }
  }

  // ── stroller pool — start ASLEEP; first update() wakes them near the player ─
  // Each slot has a STABLE npc id (so a recycled figure stays the same person +
  // routes dialogue consistently) and a focus handle game.ts merges into npcFocus.
  const strollers: Stroller[] = []
  for (let i = 0; i < maxStrollers; i++) {
    const v = i % variety
    const npcId = `ambient:${opts.layout.seed}:stroller:${i}`
    const cut = makeCutout(v, npcId)
    cut.root.setEnabled(false)
    cut.setGroundPos(1e6, 1e6) // park focus far off until first wake (see FAR_AWAY)
    strollers.push({
      cut, x: 0, z: 0, tx: 0, tz: 0, speed: 0,
      idleT: 0, awake: false, variety: v, bobPhase: Math.random() * Math.PI * 2,
      fadeT: FADE_IN,
      handle: makeHandle(cut, npcId, figureDraws[v % figureDraws.length].spec),
    })
  }

  // ── stall-keepers — a small RECYCLED POOL bound to whichever vendor anchors
  // are near the player. The city can have many markets, but only the handful
  // near you ever get a keeper, and the cutout count is capped at `maxStalls`
  // (so texture memory is O(maxStalls), not O(vendors)). Each frame we bind free
  // pooled keepers to the nearest unmanned in-range vendors and release far ones.
  const vendorAnchors = opts.layout.anchors.filter((a) => a.kind === "vendor")
  const stalls: StallKeeper[] = Array.from({ length: maxStalls }, (_, i) => {
    const v = (i + 3) % variety // offset variety so keeper ≠ adjacent stroller
    const npcId = `ambient:${opts.layout.seed}:keeper:${i}`
    const cut = makeCutout(v, npcId)
    cut.root.setEnabled(false)
    cut.setGroundPos(1e6, 1e6) // park focus far off until bound (see FAR_AWAY)
    return {
      cut, anchor: null, bobPhase: Math.random() * Math.PI * 2, fadeT: FADE_IN,
      handle: makeHandle(cut, npcId, figureDraws[v % figureDraws.length].spec),
    }
  })

  // Park a disabled figure's focus position FAR off-map so it is never the
  // nearest-in-range target while asleep/unbound (npcFocus reads the live handle
  // position every frame; a disabled cutout still carries its last position, and
  // an unbound keeper would otherwise sit focusable at its init point near spawn).
  // 1e6 ≫ the 4u focus range, so the handle is effectively absent until enabled.
  const FAR_AWAY = 1e6
  const parkFocusAway = (cut: GroundedCutout) => cut.setGroundPos(FAR_AWAY, FAR_AWAY)

  const wake = (s: Stroller, px: number, pz: number) => {
    // spawn OUTSIDE the forward view cone (rear/side arc) so it never pops in
    // front of the player (§5); fade it in regardless as a belt-and-braces. The
    // wake RING (≥ wakeR*0.4) already keeps spawns off your feet — density follows
    // you without crowding you.
    const fwd = opts.getForward?.()
    const p = pickNear(px, pz, Math.max(wakeR * 0.4, PLAYER_KEEPOUT), wakeR, fwd)
    s.x = p.x
    s.z = p.z
    // #24: first wander target is a LOCAL meander from the spawn point, kept clear
    // of the player — strollers disperse around the neighbourhood, not toward you.
    const t = pickWander(s.x, s.z, { x: px, z: pz })
    s.tx = t.x
    s.tz = t.z
    s.idleT = Math.random() * 1.5
    s.awake = true
    s.fadeT = 0
    s.cut.pickMesh.visibility = 0 // start invisible; ramp up over FADE_IN
    s.cut.setGroundPos(s.x, s.z)
    s.cut.root.setEnabled(true)
  }
  const sleep = (s: Stroller) => {
    s.awake = false
    s.cut.root.setEnabled(false)
    parkFocusAway(s.cut) // not a focus target while asleep
  }

  // The held figure (engaged/focused) freezes in place so it waits for you instead
  // of wandering off mid-conversation. At most one at a time (mirrors crowd).
  let heldId: string | null = null

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
      // HELD (talking to you): freeze — no recycle, no amble, no yield. It stays
      // put + visible where you engaged it until the conversation releases it.
      if (heldId !== null && s.handle.anchorId === heldId) {
        s.cut.pickMesh.visibility = 1 // ensure fully shown while held
        continue
      }
      const pd = Math.hypot(s.x - player.x, s.z - player.z)
      // too far → park + respawn near the player (density follows you).
      if (pd > sleepR) {
        sleep(s)
        continue
      }

      // fade-in ramp: a freshly-woken stroller climbs from invisible → full over
      // FADE_IN seconds, so even a spawn that lands at the edge of view eases in
      // rather than popping (§5).
      if (s.fadeT < FADE_IN) {
        s.fadeT = Math.min(FADE_IN, s.fadeT + dt)
        s.cut.pickMesh.visibility = s.fadeT / FADE_IN
      }

      // SOFT PLAYER YIELD — push the stroller out of the player's body gap every
      // frame so you can never phase straight THROUGH an ambient figure ("crowd of
      // ghosts" fix). Applies whether the stroller is moving, idling, or in
      // reduced-motion (it's a position correction, not an animation), so even a
      // planted figure steps aside when you walk into it. The push is clamped to a
      // gentle per-frame slide so a body reads as solid, not magnetically repelled.
      if (pd > 1e-3 && pd < PLAYER_BODY_GAP) {
        const yield_ = (PLAYER_BODY_GAP - pd) / PLAYER_BODY_GAP
        const yx = ((s.x - player.x) / pd) * yield_ * STROLL_SPEED * dt * 2
        const yz = ((s.z - player.z) / pd) * yield_ * STROLL_SPEED * dt * 2
        s.x = clampX(s.x + yx)
        s.z = clampZ(s.z + yz)
        s.cut.setGroundPos(s.x, s.z)
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
        const t = pickWander(s.x, s.z, player) // local meander, away from the player
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
      // wedged → re-target next frame (local meander, away from the player).
      if (Math.abs(nx - s.x) < 1e-4 && Math.abs(nz - s.z) < 1e-4) {
        const t = pickWander(s.x, s.z, player)
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
        const held = heldId !== null && k.handle.anchorId === heldId
        const pd = Math.hypot(k.anchor.x - player.x, k.anchor.z - player.z)
        // never release a keeper you're talking to (it would vanish mid-chat).
        if (pd > stallWakeR && !held) {
          k.anchor = null
          k.cut.root.setEnabled(false)
          parkFocusAway(k.cut) // not a focus target while unbound
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
        // #60 — never staff a stall the player is standing right on; that keeper
        // would mob you. Leave it empty until you step back out of its keepout.
        if (d < KEEPER_KEEPOUT * KEEPER_KEEPOUT) continue
        if (d <= bd) {
          bd = d
          best = a
        }
      }
      if (!best) break // no more in-range markets to staff
      managed.add(best.id)
      k.anchor = best
      // stand JUST off the stall anchor so the keeper reads as tending it — but
      // bias the 0.9u step toward the side AWAY from the player when the anchor's
      // own facing would tuck the keeper toward you (#60: never close the gap to
      // the player by standing on the near side of the stall).
      let offAng = best.facing ?? 0
      const toPlayer = Math.atan2(player.z - best.z, player.x - best.x)
      let rel = offAng - toPlayer
      while (rel > Math.PI) rel -= Math.PI * 2
      while (rel < -Math.PI) rel += Math.PI * 2
      if (Math.abs(rel) < Math.PI / 2) offAng = toPlayer + Math.PI // flip to far side
      const ox = best.x + Math.cos(offAng) * 0.9
      const oz = best.z + Math.sin(offAng) * 0.9
      const free = field.pushOut(clampX(ox), clampZ(oz), AGENT_R)
      k.cut.setGroundPos(free.x, free.z)
      k.fadeT = 0
      k.cut.pickMesh.visibility = 0 // ease in (§5)
      k.cut.root.setEnabled(true)
    }
    // 3) fade-in ramp + the gentle "working the stall" bob for the bound keepers.
    for (const k of stalls) {
      if (!k.anchor) continue
      if (k.fadeT < FADE_IN) {
        k.fadeT = Math.min(FADE_IN, k.fadeT + dt)
        k.cut.pickMesh.visibility = k.fadeT / FADE_IN
      }
      if (!reduce) {
        k.bobPhase += dt * 2.4
        k.cut.hop(Math.abs(Math.sin(k.bobPhase)) * 0.06)
      }
    }
  }

  // EVERY ambient figure's handle — strollers + stall-keepers — for game.ts to
  // merge into the shared npcFocus list (every visible person is talkable). A
  // disabled figure is parked FAR_AWAY so it's never the nearest-in-range target
  // until it's enabled, so a stable array is safe to hand over once.
  const focusables: CrowdFocusHandle[] = [
    ...strollers.map((s) => s.handle),
    ...stalls.map((k) => k.handle),
  ]

  return {
    update,
    focusables,
    setHeld: (npcId) => {
      heldId = npcId
    },
    dispose: () => {
      for (const s of strollers) s.cut.dispose()
      for (const k of stalls) k.cut.dispose()
      strollers.length = 0
      stalls.length = 0
      focusables.length = 0
    },
  }
}

/* A neutral content Scene for persona generation when the caller passes none —
 * keeps ambient figures talkable (scene-neutral flavour) instead of mute. Mirrors
 * crowd.ts NEUTRAL_DATA_SCENE so both layers fall back identically. */
const NEUTRAL_PERSONA_SCENE: ContentScene = {
  id: "neutral",
  topologyId: "neutral" as ContentScene["topologyId"],
  setting: { place: "the plaza", era: "a market town", mood: "lively" },
  themeId: "paper",
  narrativeBlurb: "",
  anchorSkins: {},
  npcSkins: {},
}
