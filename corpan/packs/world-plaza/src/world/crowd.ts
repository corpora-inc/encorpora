import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import type { RoomTopology, NpcRole, Scene } from "@world-plaza/contracts"
import { type GroundedCutout } from "../render/cutout"
import { createCharacterFigure } from "../character/figure"
import { createAnimator, type Animator } from "../character/animator"
import { generateCharacter, ANTIGUA_1770, type WardrobeTheme } from "../character/characterGen"
import type { CharacterSpec } from "../character/characterSpec"
import { generatePersona, type GeneratedPersona } from "../npc/personaGen"
import type { ObstacleField } from "./collision"
import { walkSurfaceHeight } from "./walkSurface"
import {
  stationPoint,
  isOffLeash,
  pickStationTarget as pickStationTargetPure,
} from "./stationing"

/**
 * A special quest NPC to STATION at a named anchor (the orchestrator passes these
 * straight from `specialNpc.forQuest(quest.id)`). Unlike the wandering crowd, a
 * stationed special HOVERS within a small radius of its anchor so the player can
 * reliably FIND it where the quest map marker points — the boatman is at the
 * docks, the gatekeeper at the city gate, etc. It is still a fully-voiced,
 * focusable persona; `handle.anchorId === anchorId`, so focus/dialogue/map route
 * to it exactly like any other agent (and the orchestrator's special-NPC path
 * keys off that same anchorId).
 */
export interface CrowdSpecial {
  /** the topology anchor this NPC stands at (must match an `Anchor.id`). */
  anchorId: string
  /** display name ("the boatman") — grafted onto the generated persona. */
  name: string
  /** abstract role ("boatman"/"gatekeeper"/"traveler"/"clerk") — flavours the persona. */
  role: string
}

/**
 * crowd — AUTONOMOUS WANDERING NPCs. The living-world headline.
 *
 * People are NOT pinned to anchors, and — crucially — they do NOT gather around
 * the player. Each is a unique generated character that WANDERS the streets
 * AIMLESSLY: picks a walkable target spread across the whole map (lightly biased
 * toward its tend-anchor, never glued, never toward the player or plaza centre),
 * steers there around building blockers and around each other (separation),
 * pauses (idle) briefly, then wanders on.
 *
 * ── Why the crowd no longer rings the player ──
 * The OLD model made every agent that came within ~4.5u of the player STOP and
 * park ("greet"), resuming only when the player left. Stand still and, over
 * time, passers-by accumulated into a static circle around you. The NEW model
 * keeps the general crowd MOVING: when one happens to pass near the player it
 * gives a brief IN-STRIDE acknowledgment (a quick wave/head-turn for ~0.5s)
 * WITHOUT halting its path, then walks on by. Stand still and the town flows
 * around and past you and disperses — never a ring.
 *
 * "Who you can talk to" is owned entirely by `npcFocus` (proximity focus + Talk
 * affordance), which reads each agent's LIVE position. The crowd does not need
 * to halt for that, so it doesn't.
 *
 * ── Quest-seeker ──
 * A small number of flagged agents (the `questSeekerIds`, or — if none match —
 * up to `questSeekers` of the bound-role agents) DO actively seek the player:
 * they steer toward you and stop to engage when close. This is opt-in and gated
 * so the general crowd stays aimless; with no flags set, NOBODY seeks you.
 *
 * Perf: 20–40 agents at 60fps. Shared shadow texture+material (in cutout.ts),
 * throttled+dirty-checked texture repaints (animator), O(N) grid-free
 * separation over a small N, and steering math only — no physics engine.
 */

/* --------------------------------------------------------------- types */

/** Focus-compatible handle so npcFocus/juice can read a DYNAMIC position. */
export interface CrowdFocusHandle {
  /** stable id for dialogue routing (the bound role id, or `crowd:<n>`). */
  anchorId: string
  kind: "npc"
  /** live world position + scale juice (mirrors the old Billboard surface). */
  billboard: {
    root: { position: { x: number; y: number; z: number } }
    setScale: (s: number) => void
  }
  /**
   * The persona this agent speaks as. Since EVERY townsperson is now a real,
   * generated character (PREMIUM_FOUNDATIONS §3 — "no silent extras"), this is
   * ALWAYS set; there are no `null` passers-by anymore. Typed as `NpcRole` for
   * API stability — it is in fact a `GeneratedPersona` (a structural superset),
   * so game.ts can pass it straight to `npcRuntime.open({ npcRole })`.
   */
  role: NpcRole
}

export interface Crowd {
  /** focus-compatible NPCs the dialogue/focus layer can open on. */
  focusables: CrowdFocusHandle[]
  /** advance simulation; pass the live player position. */
  update: (dt: number, player: { x: number; z: number }) => void
  /**
   * Freeze ONE agent in place (by `anchorId`) — the focus/dialogue layer calls
   * this when its Talk button is up or a conversation is open, so the NPC stops
   * and waits instead of wandering off while you try to reach/talk to it. Pass
   * `null` to release (resume wandering). At most one agent is held at a time.
   */
  setHeld: (anchorId: string | null) => void
  /**
   * #58 — re-station the pool of special quest NPCs to a NEW anchor/persona set at
   * runtime (call on every active-quest change). Each entry's NPC is placed
   * PRECISELY at its anchor (under the beacon) and held there; pool slots beyond
   * `newSpecials.length` are parked off-map. The focus/dialogue/map layers route to
   * the new objective NPC automatically (the pool's handles are already in
   * `focusables`; this mutates them in place). Idempotent.
   */
  restationSpecials: (newSpecials: CrowdSpecial[]) => void
  dispose: () => void
}

export interface CrowdOptions {
  count?: number
  theme?: WardrobeTheme
  /**
   * Hand-authored roles to bind to specific agents FIRST (e.g. the café owner /
   * tailor / traveler from `content/npc/roles.json`). Every OTHER agent — and
   * the bound ones too, enriched — gets a generated persona, so the whole crowd
   * is talkable. May be empty: a fully-generated crowd is valid.
   */
  roles?: NpcRole[]
  /**
   * The active Scene — REQUIRED to generate personas (era/place/mood/language +
   * per-anchor voice hints flavour each character). Optional only so older test
   * callers compile; when absent, personas use a neutral built-in scene.
   */
  scene?: Scene
  /**
   * Proximity (world units) at which a passing NPC gives a brief IN-STRIDE
   * acknowledgment (a quick wave). It does NOT stop — it keeps walking past.
   */
  greetRange?: number
  /**
   * Quest-seeker selection. Agents whose bound-role `id` or `anchorId` is in
   * this set will ACTIVELY seek + approach the player and stop to engage. If
   * empty/unset, no agent is given that flag here — use `questSeekers` to pick a
   * count of bound-role agents instead. The general crowd is NEVER a seeker.
   */
  questSeekerIds?: string[]
  /**
   * Fallback count of quest-seekers when `questSeekerIds` matched nothing:
   * promote up to this many of the FIRST bound-role agents to seekers. Default
   * 0 — opt-in only, so by default nobody approaches you.
   */
  questSeekers?: number
  seed?: string
  /**
   * The unified obstacle field (buildings + fountain + solid props). When given,
   * agents NEVER target a point inside an obstacle, SLIDE around obstacles as
   * they walk (props included, not just buildings), and are pushed out if they
   * ever end up overlapping one. Optional so older/test callers still compile;
   * without it the crowd falls back to building-box-only avoidance.
   */
  obstacles?: ObstacleField
  /**
   * Quest's special NPCs to STATION at their anchors (the orchestrator passes
   * `specialNpc.forQuest(quest.id)` here). Each is bound as an EXTRA agent (in
   * addition to `count` wanderers) whose `handle.anchorId` is the special anchor
   * and who hovers within a small radius of that anchor instead of wandering the
   * whole map — so the player finds it where the map marker points. Optional +
   * additive: with none passed, the crowd is exactly as before. An entry whose
   * `anchorId` isn't in the topology is logged + skipped (never silent).
   */
  specials?: CrowdSpecial[]
  /**
   * Walk-SURFACE height sampler (#40): (x,z) → world Y of the ground there (0 on
   * flat ground, the deck height on a bridge). When given, every agent — wanderers
   * AND stationed specials like the bridge-keeper — is lifted to it, so an NPC
   * standing at a bridge anchor stands ON the deck, not under it. Optional; absent
   * → flat (Y=0), unchanged.
   */
  getGroundHeight?: (x: number, z: number) => number
  /**
   * The active objective NPC's spot (the current quest anchor). Wanderers keep a
   * clear ring around it — they never TARGET inside it and are steered out if they
   * drift in — so the quest's special NPC is never buried in a scrum of ambient
   * townsfolk (you can always see + reach the one you're meant to talk to). The
   * stationed special itself is exempt (it lives there). Null → no keep-clear.
   */
  getQuestKeepClear?: () => { x: number; z: number } | null
  /**
   * STATIC decorative footprints (the plaza fountain) that agents must never stand
   * in or path through — passed explicitly because specials are stationed at world
   * BUILD time, BEFORE the streamed collision field has populated, so a chunk-scoped
   * collider (the fountain's) isn't in `obstacles` yet when stationing runs. Folded
   * into the crowd's `isBlocked`, so stationing + wandering both respect them
   * regardless of streaming timing. World-space {x,z,r}.
   */
  avoidCircles?: { x: number; z: number; r: number }[]
}

/* --------------------------------------------------------------- agent */

interface Agent {
  spec: CharacterSpec
  cutout: GroundedCutout
  anim: Animator
  handle: CrowdFocusHandle
  x: number
  z: number
  // wander
  tx: number
  tz: number
  idleT: number // >0 = pausing
  state: "walk" | "idle"
  speed: number
  // figure facing (radians), eased toward the walk direction so wanderers turn to
  // face where they're going instead of moonwalking sideways.
  headingYaw: number
  // acknowledgment: brief in-stride wave with a cooldown so we don't spam it.
  ackCooldown: number // >0 = recently acknowledged the player; don't re-wave
  ackActive: number // >0 = mid head-turn toward player (visual only, no halt)
  // quest-seeker: when true this agent steers toward + stops for the player.
  seeker: boolean
  // tend anchor this agent lightly gravitates toward (stable per agent).
  tx0: number
  tz0: number
  // ── stationed special: when set, this agent HOVERS near `station` (its quest
  // anchor) instead of wandering the whole map. `null` for the general crowd.
  station: { x: number; z: number } | null
}

/**
 * A neutral data Scene used ONLY when a caller (e.g. an old test) constructs the
 * crowd without passing the real Scene. Personas still generate; they just use a
 * generic place/era and language-neutral fallback lines. Production always passes
 * the real Scene from game.ts, so this is a safety net, not the common path.
 */
const NEUTRAL_DATA_SCENE: Scene = {
  id: "neutral",
  topologyId: "neutral" as Scene["topologyId"],
  setting: { place: "the plaza", era: "a market town", mood: "lively" },
  themeId: "paper",
  narrativeBlurb: "",
  anchorSkins: {},
  npcSkins: {},
}

const AGENT_RADIUS = 0.5
const MAX_SPEED = 2.6 // world u/s — a stroll
const ARRIVE = 1.2 // distance to target counts as arrived
const SEPARATION = 1.9 // keep this far from other agents (spread, no clumping)
const BODY_GAP = 1.1 // a non-seeker keeps ≥ this from the player (no clipping you)
const ACK_RANGE_DEFAULT = 4.5 // passers within this distance give a wave
const ACK_COOLDOWN = 6 // seconds before the same agent waves again
const ACK_DURATION = 0.5 // seconds of the in-stride head-turn
const SEEKER_STOP = 2.6 // a quest-seeker halts this close to the player
// When picking a wander target, keep it this far from the player so the crowd
// never AIMS at you (a passer-by can still drift near, but no one targets you).
// #24: widened 5 → 8 (matches the ambient population keepout) so the talkable
// crowd also disperses instead of milling on top of you.
const PLAYER_AVOID = 8.0
// Wanderers keep this clear of the active objective NPC so the quest-giver is
// never buried in a scrum of ambient townsfolk — you can always see + reach the
// one you're meant to talk to. The stationed special itself is exempt.
const OBJECTIVE_AVOID = 6.0

/**
 * Hand-authored persona colour for the special quest roles. The crowd's
 * `personaGen` archetype catalogue (baker/scribe/sailor/…) has no "boatman" or
 * "gatekeeper" entry, so for a special we OVERRIDE basePersona with a fitting
 * tone/quirks keyed off its `role`, while still grafting on the GENERATED
 * enrichment (archetype tools/voice/topics) so the special can spring a fitting
 * micro-challenge just like a wanderer. `tends` biases the generated archetype
 * toward a sensible trade (a boatman near a vendor-ish dock trade, a gatekeeper
 * near a civic station) so the enrichment reads coherently.
 */
const SPECIAL_PERSONA: Record<
  string,
  { tone: string; quirks: string[]; tends: "vendor" | "npc_station" }
> = {
  boatman: {
    tone: "weathered, plain-spoken, secretly kind once you've earned the crossing",
    quirks: [
      "won't cast off without the proper ferry token",
      "name the far shore and squint at the tide",
    ],
    tends: "vendor",
  },
  gatekeeper: {
    tone: "dutiful, a touch stern, warms to a polite traveler with the right pass",
    quirks: [
      "ask to see your city-gate pass before the gate opens",
      "stand square in the gateway and watch the road",
    ],
    tends: "npc_station",
  },
  traveler: {
    tone: "adventurous, friendly, full of road stories and small gifts",
    quirks: [
      "press a ferry token into a fellow traveler's hand",
      "mention faraway towns and ask where you're headed",
    ],
    tends: "vendor",
  },
  clerk: {
    tone: "precise, bookish, quietly helpful with the right paperwork",
    quirks: [
      "stamp and hand over the city-gate pass",
      "keep the ledger straight and the queue moving",
    ],
    tends: "npc_station",
  },
}

/** Fallback colour for an unrecognised special role (still warm + valid). */
const SPECIAL_PERSONA_DEFAULT = {
  tone: "calm, helpful, glad of a traveler's company",
  quirks: ["greet every traveler by their journey", "offer a small bit of local help"],
  tends: "npc_station" as const,
}

/** AABB blocker test with agent radius (mirrors the player controller). */
function blockedAt(x: number, z: number, blockers: RoomTopology["blockers"]): boolean {
  for (const b of blockers) {
    const hx = b.w / 2 + AGENT_RADIUS
    const hz = b.d / 2 + AGENT_RADIUS
    if (x > b.x - hx && x < b.x + hx && z > b.z - hz && z < b.z + hz) return true
  }
  return false
}

export function createCrowd(
  bScene: BabylonScene,
  topology: RoomTopology,
  opts: CrowdOptions = {},
): Crowd {
  const theme = opts.theme ?? ANTIGUA_1770
  const count = opts.count ?? 28
  const ackRange = opts.greetRange ?? ACK_RANGE_DEFAULT
  const roles = opts.roles ?? []
  const baseSeed = opts.seed ?? "antigua"
  const seekerIds = new Set(opts.questSeekerIds ?? [])
  const seekerFallback = Math.max(0, opts.questSeekers ?? 0)
  const { bounds, blockers } = topology
  const field = opts.obstacles ?? null
  // walk-surface height (#40): explicit sampler wins; else the scene's walk-surface
  // registry (a bridge self-registers there → the keeper stands ON the deck with
  // zero game.ts wiring). 0 on flat ground.
  const groundH = (x: number, z: number): number =>
    opts.getGroundHeight ? opts.getGroundHeight(x, z) : walkSurfaceHeight(bScene, x, z)

  // Static decorative footprints (the fountain) the streamed field may not yet
  // carry when stationing runs at build time. Padded by AGENT_RADIUS.
  const avoidCircles = opts.avoidCircles ?? []
  const inAvoidCircle = (x: number, z: number): boolean => {
    for (const c of avoidCircles) {
      const dx = x - c.x
      const dz = z - c.z
      const rr = c.r + AGENT_RADIUS
      if (dx * dx + dz * dz < rr * rr) return true
    }
    return false
  }
  /** Is (x,z) blocked for an agent — by a static decorative footprint, ANY streamed
   * obstacle (field), or, lacking the field, by a building box only (legacy)? */
  const isBlocked = (x: number, z: number): boolean =>
    inAvoidCircle(x, z) || (field ? field.blocked(x, z, AGENT_RADIUS) : blockedAt(x, z, blockers))

  // The active objective NPC's spot — refreshed each frame from the orchestrator.
  // Wanderers keep OBJECTIVE_AVOID clear of it (target-avoid + steer-out below).
  let questKeepClear: { x: number; z: number } | null = null
  // The data Scene used for persona generation. Optional in the API (so test
  // callers compile) but personas NEED one — synthesize a neutral fallback.
  const dataScene: Scene = opts.scene ?? NEUTRAL_DATA_SCENE

  // "Tend" points: vendor/station anchors people gravitate toward (not glued).
  // We keep the anchor's ROLE alongside so a generated persona's archetype can
  // match where it tends (a vendor anchor → a market trade; an npc_station → a
  // civic/learned trade).
  const tendPoints = topology.anchors
    .filter((a) => a.role === "vendor" || a.role === "npc_station")
    .map((a) => ({ x: a.x, z: a.z, kind: a.role as "vendor" | "npc_station" }))

  const margin = AGENT_RADIUS + 0.5
  const randIn = (min: number, max: number) => min + Math.random() * (max - min)
  const cx = (bounds.minX + bounds.maxX) / 2
  const cz = (bounds.minZ + bounds.maxZ) / 2

  /**
   * A free walkable wander target. AIMLESS: most of the time it's a point spread
   * uniformly across the whole walkable map; only LIGHTLY (≈35%) biased toward
   * this agent's tend-anchor with a wide radius. Never the plaza centre, and —
   * given the player position — kept clear of the player so nobody PATHS at you.
   */
  const pickTarget = (
    tend: { x: number; z: number } | null,
    player?: { x: number; z: number },
  ): { x: number; z: number } => {
    for (let tries = 0; tries < 24; tries++) {
      let x: number, z: number
      if (tend && Math.random() < 0.35) {
        // wide loiter ring around the tend anchor — gravitates, never glued
        x = tend.x + randIn(-5.5, 5.5)
        z = tend.z + randIn(-5.5, 5.5)
      } else {
        // truly spread across the whole walkable extent
        x = randIn(bounds.minX + margin, bounds.maxX - margin)
        z = randIn(bounds.minZ + margin, bounds.maxZ - margin)
      }
      x = Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, x))
      z = Math.max(bounds.minZ + margin, Math.min(bounds.maxZ - margin, z))
      if (isBlocked(x, z)) continue
      // don't aim at the player (passers-by may drift near, but no one targets you)
      if (player) {
        const pd = Math.hypot(x - player.x, z - player.z)
        if (pd < PLAYER_AVOID) continue
      }
      // and never wander into the active objective NPC's keep-clear ring.
      if (questKeepClear) {
        const od = Math.hypot(x - questKeepClear.x, z - questKeepClear.z)
        if (od < OBJECTIVE_AVOID) continue
      }
      return { x, z }
    }
    // fallback: a random corner-ward point so we never return the centre
    const fx = Math.random() < 0.5 ? bounds.minX + margin : bounds.maxX - margin
    const fz = Math.random() < 0.5 ? bounds.minZ + margin : bounds.maxZ - margin
    return { x: fx, z: fz }
  }

  /**
   * A free hover target for a STATIONED special: a point within STATION_RADIUS of
   * its station (so it never strays from its anchor), avoiding obstacles + the
   * exact player position. This is the stationing analogue of `pickTarget` — small
   * gentle steps inside the ring instead of an aimless map-wide wander. Falls back
   * to the station point itself if every sample is blocked.
   */
  const clampToBounds = (x: number, z: number) => ({
    x: Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, x)),
    z: Math.max(bounds.minZ + margin, Math.min(bounds.maxZ - margin, z)),
  })
  const pickStationTarget = (
    station: { x: number; z: number },
    player?: { x: number; z: number },
  ): { x: number; z: number } =>
    pickStationTargetPure(station, {
      isBlocked,
      clamp: clampToBounds,
      player,
      bodyGap: BODY_GAP,
    })

  /** The next move target for an agent: station-local for a special, else aimless. */
  const nextTargetFor = (
    a: Agent,
    tend: { x: number; z: number } | null,
    player?: { x: number; z: number },
  ): { x: number; z: number } =>
    a.station ? pickStationTarget(a.station, player) : pickTarget(tend, player)

  // Assign a tend KIND per agent (which anchor-kind it gravitates to), seeded so
  // it is stable. Used both to bias where it wanders and which persona archetype
  // it gets. If the topology has no tend points, default to a vendor-ish mix.
  const tendKindFor = (i: number): "vendor" | "npc_station" => {
    if (tendPoints.length) return tendPoints[i % tendPoints.length].kind
    return i % 2 === 0 ? "vendor" : "npc_station"
  }
  const tendPointFor = (i: number): { x: number; z: number } | null =>
    tendPoints.length ? { x: tendPoints[i % tendPoints.length].x, z: tendPoints[i % tendPoints.length].z } : null

  // EVERY agent gets a persona — none are silent. The first `roles.length` agents
  // adopt a hand-authored role (its bespoke tone/scriptedFallback PRESERVED) and
  // are ENRICHED with a generated archetype/voice/challenge-whitelist so even
  // they can spring a fitting challenge. All other agents are fully generated.
  const agents: Agent[] = []
  let fallbackSeekersLeft = seekerFallback
  for (let i = 0; i < count; i++) {
    const boundRole = i < roles.length ? roles[i] : null
    const roleKey = boundRole ? boundRole.anchorId : "crowd"
    const seed = boundRole ? `${baseSeed}:${boundRole.id}` : `${baseSeed}:crowd:${i}`
    const spec = generateCharacter(roleKey, seed, theme)

    // Generate the persona from the agent's face (demeanor) + tend + scene. For a
    // bound role we keep its authored persona but graft on the generated
    // enrichment (archetype/tools/voice/topics) — best of both.
    const generated: GeneratedPersona = generatePersona(seed, {
      scene: dataScene,
      spec,
      tends: tendKindFor(i),
      anchorId: boundRole?.anchorId,
    })
    const role: NpcRole = boundRole
      ? {
          ...generated, // archetype/voiceHint/challengeTools/topics/pretexts/hook
          id: boundRole.id,
          anchorId: boundRole.anchorId,
          basePersona: boundRole.basePersona, // authored tone/quirks win
          scriptedFallback: boundRole.scriptedFallback.length
            ? boundRole.scriptedFallback
            : generated.scriptedFallback,
        }
      : generated

    // Quest-seeker flag: explicit id/anchor match wins; else promote up to N of
    // the first bound-role agents. The general (unbound) crowd is never a seeker.
    let seeker = false
    if (boundRole && (seekerIds.has(boundRole.id) || seekerIds.has(boundRole.anchorId))) {
      seeker = true
    } else if (boundRole && seekerIds.size === 0 && fallbackSeekersLeft > 0) {
      seeker = true
      fallbackSeekersLeft--
    }

    const cutout = createCharacterFigure(bScene, spec, {
      shadowRadius: spec.build === "stocky" ? 0.66 : spec.build === "child" ? 0.5 : 0.6,
      pickTag: `npc:${seed}`,
      look: "cutout", // ambient townsfolk are paper HD-2D people (3D is reserved
      // for the player / quest specials / real players). Far cheaper, too.
    })
    const anim = createAnimator(cutout, spec)

    const tend = tendPointFor(i)
    // spawn at a free point, then a first target — both away from the centre.
    const start = pickTarget(tend)
    // settle out of any obstacle the sampled point still grazes (belt + braces).
    if (field) {
      const free = field.pushOut(start.x, start.z, AGENT_RADIUS)
      start.x = free.x
      start.z = free.z
    }
    cutout.setGroundPos(start.x, start.z, groundH(start.x, start.z))

    const handle: CrowdFocusHandle = {
      // Route dialogue to the persona's id (bound anchor id, or the generated
      // crowd id). The persona is ALWAYS present now — never null.
      anchorId: role.anchorId,
      kind: "npc",
      role,
      billboard: {
        // `position` is the live Babylon Vector3 on the ground-fixed root, so
        // focus reads the agent's CURRENT wander position every frame.
        root: { position: cutout.root.position },
        setScale: (s) => cutout.setScale(s),
      },
    }

    const tgt = pickTarget(tend)
    agents.push({
      spec, cutout, anim, handle,
      x: start.x, z: start.z,
      tx: tgt.x, tz: tgt.z,
      tx0: tend ? tend.x : cx, tz0: tend ? tend.z : cz,
      idleT: Math.random() * 2,
      state: "walk",
      speed: 0,
      headingYaw: 0,
      ackCooldown: 0,
      ackActive: 0,
      seeker,
      station: null,
    })
  }

  // ── Stationed special quest NPCs ──────────────────────────────────────────
  // Bind one EXTRA agent per special, anchored to its quest anchor. These are
  // ADDITIVE (beyond `count` wanderers) and HOVER near their anchor rather than
  // wander the map, so the player finds the boatman at the docks, the gatekeeper
  // at the city gate, etc. A special whose anchor isn't in the topology is
  // logged + skipped (noisy, never silent).
  //
  // #58 — specials are RE-STATIONABLE at runtime. Objective NPCs used to be
  // stationed ONCE at buildWorld for the initial quest; on a quest SWITCH/progression
  // the beacon re-pointed to a NEW anchor but no NPC moved there, so every beacon
  // stood over an empty spot and no quest could be finished. We now keep a fixed
  // POOL of special agents whose handles are ALL in `focusables` from the start (so
  // the focus layer's snapshot already knows them), and `restationSpecials()`
  // re-binds the pool to a new anchor/persona set in place — the objective NPC
  // walks to (stands at) the new active anchor, exactly under the beacon.
  const anchorById = new Map(topology.anchors.map((a) => [a.id, a]))

  // A parked, unbound pool slot sits FAR off-map + disabled so it is never the
  // nearest focus target and never the priority-anchor match (its anchorId is a
  // dead sentinel no quest anchor equals).
  const FAR_AWAY = 1e6
  const DEAD_ANCHOR = "__wp_unbound_special__"

  /** A safe, never-focusable placeholder role for a PARKED pool slot, so any
   *  consumer that reads `handle.role.*` (e.g. the dev __wpCrowd probe) never hits
   *  an undefined role. A parked slot is off-map + dead-anchored, so it is never the
   *  nearest/priority focus target — this is purely a non-null guard. */
  const parkedRole = (): NpcRole & { name?: string } => ({
    id: DEAD_ANCHOR,
    anchorId: DEAD_ANCHOR,
    name: "",
    basePersona: { tone: "", quirks: [] },
    scriptedFallback: [],
  })

  /** Resolve a special's STATION point: the anchor nudged off along its facing,
   *  pushed clear of obstacles, clamped into bounds. null if the anchor is unknown
   *  (logged by the caller). */
  const stationFor = (sp: CrowdSpecial): { anchor: RoomTopology["anchors"][number]; x: number; z: number } | null => {
    const anchor = anchorById.get(sp.anchorId)
    if (!anchor) return null
    const sp0 = stationPoint(anchor, isBlocked)
    let stx = sp0.x
    let stz = sp0.z
    if (field) {
      const free = field.pushOut(stx, stz, AGENT_RADIUS)
      stx = free.x
      stz = free.z
    }
    let c = clampToBounds(stx, stz)
    // INVARIANT: a stationed special stands on flat GROUND, never on a raised
    // walk-surface (the bridge deck). An anchor that sits on a ramp/deck (bridge_n)
    // would otherwise float the NPC up the bridge — beacon offscreen, body clipping
    // the parapets. Walk back toward the city interior along the ground until we're
    // off the raised surface, so the keeper waits at the bridge FOOT on solid earth.
    if (groundH(c.x, c.z) > 0.3) {
      let gx = c.x
      let gz = c.z
      const dx = cx - gx
      const dz = cz - gz
      const len = Math.hypot(dx, dz) || 1
      const ux = dx / len
      const uz = dz / len
      for (let s = 0; s < 60 && groundH(gx, gz) > 0.3; s++) {
        gx += ux
        gz += uz
      }
      c = clampToBounds(gx, gz)
    }
    return { anchor, x: c.x, z: c.z }
  }

  /** Build the persona ROLE for a special (generated enrichment + authored override). */
  const specialRole = (sp: CrowdSpecial): { role: NpcRole & { name?: string }; spec: CharacterSpec; seed: string } => {
    const colour = SPECIAL_PERSONA[sp.role] ?? SPECIAL_PERSONA_DEFAULT
    // Stable seed: quest anchor + role, so the same special always rebuilds the
    // same face/voice across frames + reloads + re-stations.
    const seed = `${baseSeed}:special:${sp.anchorId}:${sp.role}`
    const spec = generateCharacter(sp.anchorId, seed, theme)
    const generated: GeneratedPersona = generatePersona(seed, {
      scene: dataScene,
      spec,
      tends: colour.tends,
      anchorId: sp.anchorId,
    })
    const role: NpcRole & { name?: string } = {
      ...generated, // challengeTools/voiceHint/topics/pretexts/hook stay generated
      id: sp.anchorId,
      anchorId: sp.anchorId,
      name: sp.name,
      basePersona: { tone: colour.tone, quirks: colour.quirks.slice() },
    }
    return { role, spec, seed }
  }

  /** A special pool slot — the Agent plus the live `name` it currently shows (so
   *  unbinding/rebinding can mutate everything the focus + dialogue layers read). */
  interface SpecialSlot {
    agent: Agent
    bound: boolean
  }

  /** Create a fresh cutout+animator for a special slot from a spec, positioned at
   *  the station. Caller owns disposing any previous cutout. */
  const makeSpecialVisual = (spec: CharacterSpec, seed: string, x: number, z: number) => {
    const cutout = createCharacterFigure(bScene, spec, {
      shadowRadius: spec.build === "stocky" ? 0.66 : spec.build === "child" ? 0.5 : 0.6,
      pickTag: `npc:${seed}`,
      look: "bubble3d", // quest / special NPCs matter — render them in 3D.
    })
    const anim = createAnimator(cutout, spec)
    cutout.setGroundPos(x, z, groundH(x, z))
    return { cutout, anim }
  }

  /** Re-bind (or, with sp=null, PARK) a pool slot in place: swap its cutout/anim to
   *  the new persona, move it to the new station, and MUTATE its handle (anchorId +
   *  role + billboard root) so the focus layer — which holds the handle by reference
   *  — routes the beacon, map, and dialogue to the new objective NPC with no array
   *  surgery. */
  const bindSlot = (slot: SpecialSlot, sp: CrowdSpecial | null) => {
    const a = slot.agent
    // drop the old visual (also releases its animator's node refs).
    a.cutout.dispose()
    if (!sp) {
      // PARK: a fresh tiny invisible cutout far away, dead anchor, disabled.
      const v = makeSpecialVisual(a.spec, `${baseSeed}:special:parked:${a.handle.anchorId}`, FAR_AWAY, FAR_AWAY)
      a.cutout = v.cutout
      a.anim = v.anim
      a.cutout.root.setEnabled(false)
      a.x = FAR_AWAY; a.z = FAR_AWAY
      a.tx = FAR_AWAY; a.tz = FAR_AWAY
      a.tx0 = FAR_AWAY; a.tz0 = FAR_AWAY
      a.station = { x: FAR_AWAY, z: FAR_AWAY }
      a.handle.anchorId = DEAD_ANCHOR
      a.handle.role = parkedRole()
      a.handle.billboard.root = { position: a.cutout.root.position }
      a.handle.billboard.setScale = (s) => a.cutout.setScale(s)
      slot.bound = false
      return
    }
    const st = stationFor(sp)
    if (!st) {
      console.warn(
        `[wp/crowd] special "${sp.name}" has no anchor "${sp.anchorId}" in topology — parking the slot.`,
      )
      bindSlot(slot, null)
      return
    }
    const { role, spec, seed } = specialRole(sp)
    const v = makeSpecialVisual(spec, seed, st.x, st.z)
    a.spec = spec
    a.cutout = v.cutout
    a.anim = v.anim
    a.cutout.root.setEnabled(true)
    a.x = st.x; a.z = st.z
    a.tx = st.x; a.tz = st.z
    a.tx0 = st.x; a.tz0 = st.z
    a.station = { x: st.x, z: st.z }
    a.state = "idle"
    a.idleT = Math.random() * 1.5
    a.speed = 0
    // MUTATE the handle so the focus layer's existing snapshot re-routes live.
    a.handle.anchorId = sp.anchorId
    a.handle.role = role
    a.handle.billboard.root = { position: a.cutout.root.position }
    a.handle.billboard.setScale = (s) => a.cutout.setScale(s)
    slot.bound = true
  }

  // Build the pool. Size it to comfortably cover any single quest's specials; the
  // initial set binds the first slots, the rest park (ready for a re-station to a
  // quest with more anchors). All pool handles are emitted in `focusables`.
  const initialSpecials = opts.specials ?? []
  const SPECIAL_POOL = Math.max(4, initialSpecials.length)
  const specialSlots: SpecialSlot[] = []
  for (let s = 0; s < SPECIAL_POOL; s++) {
    // a placeholder agent; bindSlot() (below) fills in the real visual + handle.
    const spec0 = generateCharacter("npc_station", `${baseSeed}:special:pool:${s}`, theme)
    const v0 = makeSpecialVisual(spec0, `${baseSeed}:special:pool:${s}`, FAR_AWAY, FAR_AWAY)
    v0.cutout.root.setEnabled(false)
    const handle: CrowdFocusHandle = {
      anchorId: DEAD_ANCHOR,
      kind: "npc",
      role: parkedRole(), // replaced on bind; a parked slot is never focusable (dead anchor + far away)
      billboard: {
        root: { position: v0.cutout.root.position },
        setScale: (sc) => v0.cutout.setScale(sc),
      },
    }
    const agent: Agent = {
      spec: spec0, cutout: v0.cutout, anim: v0.anim, handle,
      x: FAR_AWAY, z: FAR_AWAY, tx: FAR_AWAY, tz: FAR_AWAY, tx0: FAR_AWAY, tz0: FAR_AWAY,
      idleT: 0, state: "idle", speed: 0, headingYaw: 0, ackCooldown: 0, ackActive: 0,
      seeker: false, // a stationed special stays put; it never chases the player.
      station: { x: FAR_AWAY, z: FAR_AWAY },
    }
    agents.push(agent)
    const slot: SpecialSlot = { agent, bound: false }
    specialSlots.push(slot)
    if (s < initialSpecials.length) bindSlot(slot, initialSpecials[s])
  }

  /** #58 — re-station the special pool to a NEW anchor/persona set at runtime.
   *  Binds the first `newSpecials.length` slots to the new objectives (each placed
   *  PRECISELY at its anchor, held in place by the stationing leash) and parks the
   *  rest. Idempotent + safe to call on every active-quest change. */
  const restationSpecials = (newSpecials: CrowdSpecial[]) => {
    for (let s = 0; s < specialSlots.length; s++) {
      bindSlot(specialSlots[s], s < newSpecials.length ? newSpecials[s] : null)
    }
    if (newSpecials.length > specialSlots.length) {
      console.warn(
        `[wp/crowd] restationSpecials got ${newSpecials.length} specials but the pool is ${specialSlots.length} — extra anchors get no NPC. Raise SPECIAL_POOL.`,
      )
    }
  }

  // ---- simulation ----
  // The single agent currently HELD in place by the focus/dialogue layer (its
  // Talk button is up, or you're mid-conversation). null = nobody held.
  let heldId: string | null = null
  const update: Crowd["update"] = (dt, player) => {
    questKeepClear = opts.getQuestKeepClear?.() ?? null
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i]
      const tend = { x: a.tx0, z: a.tz0 }

      // ── OBJECTIVE KEEP-CLEAR: a wandering (non-stationed) townsperson that drifts
      // into the active objective NPC's ring is steered radially OUT, so the
      // quest-giver is never mobbed. Stationed specials (incl. the objective NPC
      // itself) are exempt — they belong at their anchor.
      if (questKeepClear && !a.station && a.handle.anchorId !== heldId) {
        const ox = a.x - questKeepClear.x
        const oz = a.z - questKeepClear.z
        const od = Math.hypot(ox, oz)
        if (od < OBJECTIVE_AVOID) {
          const ux = od > 1e-3 ? ox / od : 1
          const uz = od > 1e-3 ? oz / od : 0
          a.tx = questKeepClear.x + ux * (OBJECTIVE_AVOID + 1.5)
          a.tz = questKeepClear.z + uz * (OBJECTIVE_AVOID + 1.5)
          a.state = "walk"
        }
      }

      const pdx = player.x - a.x
      const pdz = player.z - a.z
      const pdist = Math.hypot(pdx, pdz)

      // ---- timers ----
      if (a.ackCooldown > 0) a.ackCooldown -= dt
      if (a.ackActive > 0) a.ackActive -= dt

      // ── HELD: focus locked on this NPC (Talk button up) or you're talking →
      // STOP and wait. It stays put until released (you walk away / close the
      // chat), so you can actually reach it to tap Talk and it won't wander off
      // mid-conversation. The paper-doll already billboards to face the camera.
      if (a.handle.anchorId === heldId) {
        a.speed = 0
        a.anim.setState("idle")
        a.anim.setSpeed(0)
        a.anim.update(dt)
        continue
      }

      // ── QUEST-SEEKER: actively walk toward the player and stop to engage ──
      if (a.seeker) {
        if (pdist <= SEEKER_STOP) {
          // arrived at the player → face them, idle, wave once on arrival
          if (a.ackCooldown <= 0) {
            a.anim.wave()
            a.ackCooldown = ACK_COOLDOWN
          }
          a.speed = 0
          a.anim.setState("idle")
          a.anim.setSpeed(0)
          a.anim.update(dt)
          continue
        }
        // steer straight at the player (with separation so seekers don't stack)
        a.tx = player.x
        a.tz = player.z
        a.state = "walk"
      } else {
        // ── GENERAL CROWD: brief in-stride acknowledgment, NEVER a halt ──
        if (pdist < ackRange && a.ackCooldown <= 0) {
          a.anim.wave() // quick wave; keeps walking
          a.ackActive = ACK_DURATION
          a.ackCooldown = ACK_COOLDOWN
        }
      }

      // idle pause (general crowd only — seekers handled above)
      if (a.state === "idle") {
        a.idleT -= dt
        a.speed = 0
        a.anim.setSpeed(0)
        a.anim.update(dt)
        if (a.idleT <= 0) {
          const t = nextTargetFor(a, tend, player)
          a.tx = t.x
          a.tz = t.z
          a.state = "walk"
        }
        continue
      }

      // ── STATIONED leash: if a special has drifted past its station radius
      // (e.g. nudged out by separation), aim back inside the ring this frame so it
      // can never wander off its anchor. Additive, special-only.
      if (a.station && isOffLeash({ x: a.x, z: a.z }, a.station)) {
        const t = pickStationTarget(a.station, player)
        a.tx = t.x
        a.tz = t.z
      }

      // ---- steering: seek target ----
      let dx = a.tx - a.x
      let dz = a.tz - a.z
      const dist = Math.hypot(dx, dz)
      if (dist < ARRIVE) {
        if (a.seeker) {
          // seeker reached a stale target but player moved — re-aim next frame
          a.tx = player.x
          a.tz = player.z
        } else {
          // arrived → idle a beat, then a new aimless target
          a.state = "idle"
          a.idleT = 0.8 + Math.random() * 2.4
          a.anim.setState("idle")
        }
        continue
      }
      dx /= dist
      dz /= dist

      // ---- separation: push away from nearby agents (no paper-people stacking) ----
      let sx = 0
      let sz = 0
      for (let j = 0; j < agents.length; j++) {
        if (j === i) continue
        const b = agents[j]
        const ox = a.x - b.x
        const oz = a.z - b.z
        const od = Math.hypot(ox, oz)
        if (od > 0 && od < SEPARATION) {
          const push = (SEPARATION - od) / SEPARATION
          sx += (ox / od) * push
          sz += (oz / od) * push
        }
      }
      // also keep a body's-width off the PLAYER (a non-seeker shouldn't walk INTO
      // you; seekers are handled above and stop at SEEKER_STOP). Light push only.
      if (!a.seeker && pdist > 0 && pdist < BODY_GAP) {
        const push = (BODY_GAP - pdist) / BODY_GAP
        sx += (-pdx / pdist) * push
        sz += (-pdz / pdist) * push
      }

      // desired velocity = seek + weighted separation
      let vx = dx + sx * 1.1
      let vz = dz + sz * 1.1
      const vl = Math.hypot(vx, vz) || 1
      vx /= vl
      vz /= vl

      // A stationed special ambles at HALF speed — gentle idle steps near its
      // anchor, not a brisk stroll across a tiny box (reads alive, not frantic).
      const step = (a.station ? MAX_SPEED * 0.5 : MAX_SPEED) * dt
      let nx = a.x + vx * step
      let nz = a.z + vz * step

      // ---- obstacle avoidance: slide around buildings + fountain + props ----
      if (field) {
        const r = field.resolve(a.x, a.z, nx, nz, AGENT_RADIUS)
        nx = r.x
        nz = r.z
      } else {
        // legacy: axis-separated slide against building boxes only.
        if (blockedAt(nx, a.z, blockers)) nx = a.x
        if (blockedAt(a.x, nz, blockers)) nz = a.z
      }
      // if fully wedged (corner / pinned against a prop), pick a fresh target so
      // nobody gets stuck grinding into an obstacle.
      if (Math.abs(nx - a.x) < 1e-4 && Math.abs(nz - a.z) < 1e-4) {
        const t = nextTargetFor(a, tend, player)
        a.tx = t.x
        a.tz = t.z
      }

      // clamp to bounds
      nx = Math.max(bounds.minX + margin, Math.min(bounds.maxX - margin, nx))
      nz = Math.max(bounds.minZ + margin, Math.min(bounds.maxZ - margin, nz))

      const moved = Math.hypot(nx - a.x, nz - a.z)
      a.x = nx
      a.z = nz
      a.speed = Math.min(1, moved / step)

      a.cutout.setGroundPos(a.x, a.z, groundH(a.x, a.z))
      // Face the walk direction (figure forward is +Z → atan2(vx,vz)), eased,
      // so wanderers turn instead of moonwalking. Hold facing when barely moving.
      if (a.speed > 0.05) {
        const targetHeading = Math.atan2(vx, vz)
        let hd = targetHeading - a.headingYaw
        while (hd > Math.PI) hd -= Math.PI * 2
        while (hd < -Math.PI) hd += Math.PI * 2
        a.headingYaw += hd * Math.min(1, dt * 10)
      }
      a.cutout.setHeading?.(a.headingYaw)
      a.anim.setState("walk")
      a.anim.setSpeed(a.speed)
      a.anim.update(dt)
    }
  }

  return {
    focusables: agents.map((a) => a.handle),
    update,
    setHeld: (anchorId) => {
      heldId = anchorId
    },
    restationSpecials,
    dispose: () => {
      for (const a of agents) a.cutout.dispose()
      agents.length = 0
    },
  }
}
