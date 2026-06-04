import { Room, type Client } from "@colyseus/core"
import { StateView } from "@colyseus/schema"
import {
  MovementUpdate,
  AvatarSpec,
  type RoomTopology,
} from "@world-plaza/contracts"
import { PlazaState, PlayerState } from "./state.js"
import { AoiGrid, DEFAULT_AOI, type AoiConfig } from "./aoi.js"

/**
 * PlazaRoom — the authoritative presence room for World Plaza (M1: movement).
 *
 * Server owns every player's position. Clients predict their OWN avatar locally
 * and send `MovementUpdate`s (~10Hz). The server validates each (max speed +
 * room bounds), writes it into `@colyseus/schema` state, and the framework
 * auto-syncs binary deltas to all clients at the patch rate. Remote clients
 * interpolate those deltas for smooth motion.
 *
 * This is presence + movement ONLY. The seam for AI-mediated chat is the typed
 * `onMessage` surface: a future `"chat"` handler receives a `MediatedChatInput`,
 * the server moderates/routes it, and each recipient gets a `MediatedChatArtifact`
 * framed by THEIR quest — never raw UGC. Nothing here needs to change for that;
 * it's a new message type alongside `"move"`.
 *
 * ── Area-of-Interest (interest management) ──
 * The world is conceptually a BIG city, so we DON'T fan every player's deltas to
 * every client. The room hashes positions into a uniform CELL grid (`AoiGrid`)
 * and gives each client a Colyseus `StateView` containing only the players in
 * its own cell + a ring of neighbor cells (radius). Far-away players are never
 * encoded into your snapshot; crossing a cell boundary atomically re-derives the
 * affected views, which the client already surfaces as `onAdd`/`onRemove`.
 */

/** Join options the client sends (name + avatar + scene/quest context). */
export interface PlazaJoinOptions {
  playerId?: string
  name?: string
  /** AvatarSpec (validated) — broadcast to others, re-skinned client-side. */
  avatar?: unknown
  sceneId?: string
  questId?: string
}

/** Max plausible ground speed (world u/s). The local player walks at 6.5; we
 *  allow generous headroom for prediction/reconnect snap, then clamp. */
const MAX_SPEED = 14
/** Below this dt we don't speed-check (first move / clock skew). */
const MIN_DT = 0.001

export class PlazaRoom extends Room<PlazaState> {
  /** soft cap before matchmaking spins a sibling room (see index.ts sortBy). */
  maxClients = 30

  private topology!: RoomTopology
  /** last accepted seq per session — drops stale/duplicate updates. */
  private lastSeq = new Map<string, number>()

  /** Spatial interest grid: tracks each player's cell, answers AOI windows. */
  private aoi!: AoiGrid
  /** sessionId → Client, so a mover can update OTHERS' views (mutual visibility). */
  private clientsBySession = new Map<string, Client>()
  /**
   * sessionId → set of OTHER sessionIds currently in its view. Mirrors the
   * StateView memberships so we can diff cheaply on a cell cross (O(window +
   * previously-visible), not O(all players)) and tear down cleanly on leave.
   */
  private visible = new Map<string, Set<string>>()

  onCreate(options: { topology: RoomTopology; roomLabel?: string; aoi?: Partial<AoiConfig> }) {
    this.topology = options.topology
    // AOI cell size / radius are configurable (per-room override → env → default).
    // ENV lets ops tune interest breadth without a deploy: WP_AOI_CELL, WP_AOI_RADIUS.
    const cellSize =
      options.aoi?.cellSize ?? numEnv("WP_AOI_CELL") ?? DEFAULT_AOI.cellSize
    const radius =
      options.aoi?.radius ?? numEnv("WP_AOI_RADIUS") ?? DEFAULT_AOI.radius
    this.aoi = new AoiGrid({ cellSize, radius })

    const state = new PlazaState()
    state.roomId = String(this.topology.id)
    this.setState(state)

    // Movement: validated, authoritative. Clients send ~10Hz.
    this.onMessage("move", (client, raw) => {
      const parsed = MovementUpdate.safeParse(raw)
      if (!parsed.success) {
        console.warn(`[plaza] bad move from ${client.sessionId}:`, parsed.error.issues[0]?.message)
        return
      }
      this.applyMove(client.sessionId, parsed.data)
    })

    console.log(
      `[plaza] room ${this.roomId} created on topology ${this.topology.id} ` +
        `(AOI cell=${cellSize}u radius=${radius})`,
    )
  }

  onJoin(client: Client, options: PlazaJoinOptions = {}) {
    const p = new PlayerState()
    p.playerId = String(options.playerId ?? client.sessionId)
    p.name = sanitizeName(options.name)
    p.avatar = serializeAvatar(options.avatar)
    p.sceneId = String(options.sceneId ?? "")
    p.questId = String(options.questId ?? "")

    // Spawn at an authoritative spawn point (round-robin across the topology's
    // spawns so two players don't stack on the same tile).
    const spawnIdx = this.state.players.size % this.topology.spawns.length
    const spawn = this.topology.spawns[spawnIdx]
    p.x = spawn.x
    p.z = spawn.z
    p.facing = 0
    p.t = Date.now()

    this.state.players.set(client.sessionId, p)
    this.clientsBySession.set(client.sessionId, client)

    // Give this client an AOI view (filters the @view()-tagged players map to
    // this client). Place them in the grid and seed mutual visibility with every
    // player already inside their AOI window.
    client.view = new StateView()
    this.aoi.set(client.sessionId, p.x, p.z)
    this.linkAoi(client.sessionId)

    console.log(`[plaza] +join ${p.name} (${client.sessionId}) → ${this.state.players.size} players`)
  }

  async onLeave(client: Client, consented?: boolean) {
    const player = this.state.players.get(client.sessionId)
    // Graceful reconnection: keep the avatar in-world briefly so a dropped
    // socket (backgrounded app, flaky wifi) doesn't pop the player out.
    if (!consented) {
      try {
        await this.allowReconnection(client, 20)
        console.log(`[plaza] reconnected ${client.sessionId}`)
        return
      } catch {
        /* reconnection window lapsed → fall through to removal */
      }
    }
    // Pull the leaver out of every other client's AOI view so no ghost avatar
    // lingers, then drop our own bookkeeping.
    this.unlinkAoi(client.sessionId)
    this.aoi.remove(client.sessionId)
    this.clientsBySession.delete(client.sessionId)
    this.state.players.delete(client.sessionId)
    this.lastSeq.delete(client.sessionId)
    if (player) console.log(`[plaza] -leave ${player.name} → ${this.state.players.size} players`)
  }

  onDispose() {
    console.log(`[plaza] room ${this.roomId} disposed`)
  }

  /** Authoritative move: drop stale seqs, clamp to bounds, reject teleports. */
  private applyMove(sessionId: string, mv: MovementUpdate) {
    const p = this.state.players.get(sessionId)
    if (!p) return

    // Drop out-of-order / duplicate updates by sequence number.
    const last = this.lastSeq.get(sessionId) ?? -1
    if (mv.seq <= last) return
    this.lastSeq.set(sessionId, mv.seq)

    const b = this.topology.bounds
    let nx = clamp(mv.pos.x, b.minX, b.maxX)
    let nz = clamp(mv.pos.z, b.minZ, b.maxZ)

    // Anti-teleport: cap displacement by max speed over the elapsed server time.
    // We use server wall-clock (not the client's `t`) so a client can't forge dt.
    const now = Date.now()
    const dt = Math.max((now - p.t) / 1000, 0)
    if (dt > MIN_DT) {
      const maxStep = MAX_SPEED * dt
      const dx = nx - p.x
      const dz = nz - p.z
      const d = Math.hypot(dx, dz)
      if (d > maxStep && d > 0) {
        // Clamp the step to the speed envelope rather than rejecting outright —
        // keeps motion smooth under jitter while making cheating ineffective.
        nx = p.x + (dx / d) * maxStep
        nz = p.z + (dz / d) * maxStep
      }
    }

    p.x = nx
    p.z = nz
    p.facing = mv.pos.facing
    p.t = now

    // Update the spatial grid. Only a CELL change can alter AOI membership, so
    // intra-cell movement (the common case) costs a single hash + compare.
    const moved = this.aoi.set(sessionId, nx, nz)
    if (moved.changed) this.relinkAoi(sessionId)
  }

  /* ------------------------------------------------------------- AOI wiring */

  /**
   * Make `a` and `b` mutually visible: add b's PlayerState to a's view and vice
   * versa, recording it in the `visible` mirror. Idempotent — re-pairing two
   * already-linked players is a no-op (so a cell cross can blindly re-pair the
   * window without churning the encoder).
   */
  private pair(a: string, b: string) {
    const viewA = this.clientsBySession.get(a)?.view
    const viewB = this.clientsBySession.get(b)?.view
    const pA = this.state.players.get(a)
    const pB = this.state.players.get(b)
    if (!pA || !pB) return
    if (viewA && !this.visible.get(a)?.has(b)) {
      viewA.add(pB)
      this.visible.get(a)?.add(b)
    }
    if (viewB && !this.visible.get(b)?.has(a)) {
      viewB.add(pA)
      this.visible.get(b)?.add(a)
    }
  }

  /** Inverse of `pair`: drop the mutual visibility + mirror entries. */
  private unpair(a: string, b: string) {
    const viewA = this.clientsBySession.get(a)?.view
    const viewB = this.clientsBySession.get(b)?.view
    const pA = this.state.players.get(a)
    const pB = this.state.players.get(b)
    if (viewA && pB && this.visible.get(a)?.has(b)) {
      viewA.remove(pB)
      this.visible.get(a)?.delete(b)
    }
    if (viewB && pA && this.visible.get(b)?.has(a)) {
      viewB.remove(pA)
      this.visible.get(b)?.delete(a)
    }
  }

  /**
   * Seed visibility for a freshly-placed player: see yourself, and pair with
   * every player already inside your AOI window. Range is symmetric (Chebyshev
   * ≤ radius), so every pairing is two-sided — no one-way ghosts.
   */
  private linkAoi(sessionId: string) {
    const view = this.clientsBySession.get(sessionId)?.view
    const self = this.state.players.get(sessionId)
    if (!view || !self) return
    this.visible.set(sessionId, new Set())
    // Always keep yourself in-view (the client filters its own avatar out but
    // reads its own state for the session match) — defensive, not AOI-gated.
    view.add(self)

    for (const otherId of this.aoi.queryAround(sessionId)) {
      if (otherId === sessionId) continue
      this.pair(sessionId, otherId)
    }
  }

  /** Tear a leaving player out of every view it currently shares. */
  private unlinkAoi(sessionId: string) {
    for (const otherId of [...(this.visible.get(sessionId) ?? [])]) {
      this.unpair(sessionId, otherId)
    }
    this.visible.delete(sessionId)
  }

  /**
   * Re-derive AOI membership after a player crosses a cell boundary. Diff the
   * NEW window against the players currently mirrored as visible: drop those
   * who left range, pair those who entered. Symmetric pair/unpair keep both
   * sides clean (avatar enters one client's snapshot ⇔ it enters the other's),
   * so there are no stuck avatars and no ghosts. Cost is O(window + previously
   * visible), independent of total player count.
   */
  private relinkAoi(sessionId: string) {
    const cur = this.visible.get(sessionId)
    if (!cur) return

    const nowVisible = this.aoi.queryAround(sessionId)
    nowVisible.delete(sessionId)

    // Departed: in the mirror but no longer in the window.
    for (const otherId of [...cur]) {
      if (!nowVisible.has(otherId)) this.unpair(sessionId, otherId)
    }
    // Arrived: in the window but not yet mirrored (pair() is idempotent).
    for (const otherId of nowVisible) {
      this.pair(sessionId, otherId)
    }
  }
}

/* --------------------------------------------------------------- helpers */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Parse a positive numeric env var, or undefined if unset/invalid. */
function numEnv(key: string): number | undefined {
  const raw = process.env[key]
  if (raw == null || raw === "") return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

/** Names are composed safe identities; trim + bound length defensively. */
function sanitizeName(name: unknown): string {
  const s = typeof name === "string" ? name.trim() : ""
  return (s || "Traveler").slice(0, 40)
}

/**
 * Validate + serialize the AvatarSpec to a compact JSON leaf. If the client
 * sends garbage (or nothing), fall back to an empty spec — the renderer
 * tolerates `{}` and draws a default paper-doll, so presence never breaks.
 */
function serializeAvatar(avatar: unknown): string {
  const parsed = AvatarSpec.safeParse(avatar)
  if (parsed.success) return JSON.stringify(parsed.data)
  return JSON.stringify({ base: "paper-doll-a", layers: [] })
}
