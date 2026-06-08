import { Room, type Client } from "@colyseus/core"
import { StateView } from "@colyseus/schema"
import {
  MovementUpdate,
  AvatarSpec,
  PlayerId,
  ProfilePublish,
  ProfileRequest,
  InviteMessage,
  InviteRespond,
  MediatedChatInput,
  PeerChallengeResult,
  TradeEnvelope,
  MP_MSG,
  type RoomTopology,
  type SafeProfile,
  type PlaceReveal,
  type InvitedMessage,
  type InviteResult,
  type TradeUpdateMessage,
} from "@corpan-city/contracts"
import { PlazaState, PlayerState } from "./state.js"
import { AoiGrid, DEFAULT_AOI, type AoiConfig } from "./aoi.js"
import { GeoHistogram } from "./geoHistogram.js"

/**
 * PlazaRoom — the authoritative presence room for Corpan City (M1: movement).
 *
 * Server owns every player's position. Clients predict their OWN avatar locally
 * and send `MovementUpdate`s (~10Hz). The server validates each (max speed +
 * room bounds), writes it into `@colyseus/schema` state, and the framework
 * auto-syncs binary deltas to all clients at the patch rate. Remote clients
 * interpolate those deltas for smooth motion.
 *
 * AI-mediated chat uses the same room: the sender's local model rewrites a
 * message into safe English relay text, this server validates and routes it,
 * and the recipient's local model independently cleans and translates it into
 * a learning artifact.
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

export interface PlazaRoomOptions {
  topology: RoomTopology
  roomLabel?: string
  maxClients?: number
  reconnectionSeconds?: number
  replaceDuplicatePlayerId?: boolean
  placeReveal?: "k-anon" | "country"
  aoi?: Partial<AoiConfig>
}

/** Max plausible ground speed (world u/s). The local player walks at 6.5; we
 *  allow generous headroom for prediction/reconnect snap, then clamp. */
const MAX_SPEED = 14
/** Below this dt we don't speed-check (first move / clock skew). */
const MIN_DT = 0.001

export class PlazaRoom extends Room<PlazaState> {
  /** soft cap before matchmaking spins a sibling room (see index.ts sortBy). */
  maxClients = 30
  private roomLabel = "plaza"
  private reconnectionSeconds = 20
  private replaceDuplicatePlayerId = false
  private placeReveal: PlazaRoomOptions["placeReveal"] = "k-anon"

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

  /* ── Interaction layer (profile reveal / chat / challenge / trade) ── */
  /** server-private geo tally powering the k-anonymity place reveal. */
  private geo = new GeoHistogram()
  /** Additional learning languages, kept private until a profile card is requested. */
  private alsoLearning = new Map<string, SafeProfile["stack"]["alsoLearning"]>()
  /** playerId → sessionId, so an invite/trade addressed by durable PlayerId routes. */
  private byPlayerId = new Map<string, string>()
  /** invites we're tracking: pending for accept/decline, accepted as a session authz record. */
  private invites = new Map<string, { from: string; to: string; kind: InviteMessage["offer"]["kind"]; accepted: boolean }>()
  /** coarse anti-grief: sessionId → recent action timestamps (sliding window). */
  private actionLog = new Map<string, number[]>()

  onCreate(options: PlazaRoomOptions) {
    this.topology = options.topology
    this.roomLabel = options.roomLabel ?? "plaza"
    if (options.maxClients) this.maxClients = options.maxClients
    if (typeof options.reconnectionSeconds === "number") {
      this.reconnectionSeconds = Math.max(0, options.reconnectionSeconds)
    }
    this.replaceDuplicatePlayerId = options.replaceDuplicatePlayerId === true
    this.placeReveal = options.placeReveal ?? "k-anon"
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

    this.registerInteractionHandlers()

    console.log(
      `[${this.roomLabel}] room ${this.roomId} created on topology ${this.topology.id} ` +
        `(AOI cell=${cellSize}u radius=${radius})`,
    )
  }

  onJoin(client: Client, options: PlazaJoinOptions = {}) {
    const requestedPlayerId = PlayerId.safeParse(options.playerId)
    if (this.replaceDuplicatePlayerId && requestedPlayerId.success) {
      const existingSession = this.byPlayerId.get(requestedPlayerId.data)
      if (existingSession && existingSession !== client.sessionId) {
        const existingClient = this.clientsBySession.get(existingSession)
        existingClient?.leave(4000, "replaced by newer session")
        this.removeSession(existingSession)
      }
    }

    const p = new PlayerState()
    p.playerId = this.claimPlayerId(options.playerId, client.sessionId)
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
    if (p.playerId) this.byPlayerId.set(p.playerId, client.sessionId)

    // Give this client an AOI view (filters the @view()-tagged players map to
    // this client). Place them in the grid and seed mutual visibility with every
    // player already inside their AOI window.
    client.view = new StateView()
    this.aoi.set(client.sessionId, p.x, p.z)
    this.linkAoi(client.sessionId)

    console.log(`[${this.roomLabel}] +join ${p.name} (${client.sessionId}) → ${this.state.players.size} players`)
  }

  async onLeave(client: Client, consented?: boolean) {
    // Graceful reconnection: keep the avatar in-world briefly so a dropped
    // socket (backgrounded app, flaky wifi) doesn't pop the player out.
    if (!consented && this.reconnectionSeconds > 0) {
      try {
        await this.allowReconnection(client, this.reconnectionSeconds)
        console.log(`[${this.roomLabel}] reconnected ${client.sessionId}`)
        return
      } catch {
        /* reconnection window lapsed → fall through to removal */
      }
    }
    this.removeSession(client.sessionId)
  }

  private removeSession(sessionId: string): void {
    const player = this.state.players.get(sessionId)
    // Pull the leaver out of every other client's AOI view so no ghost avatar
    // lingers, then drop our own bookkeeping.
    this.unlinkAoi(sessionId)
    this.aoi.remove(sessionId)
    this.clientsBySession.delete(sessionId)
    this.state.players.delete(sessionId)
    this.lastSeq.delete(sessionId)
    // Interaction-layer cleanup: drop from the geo tally, the playerId index,
    // any open invites, and the rate-limit log.
    this.geo.remove(sessionId)
    this.alsoLearning.delete(sessionId)
    if (player?.playerId && this.byPlayerId.get(player.playerId) === sessionId) {
      this.byPlayerId.delete(player.playerId)
    }
    this.dropInvitesFor(sessionId)
    for (const key of [...this.actionLog.keys()]) {
      if (key.startsWith(`${sessionId}:`)) this.actionLog.delete(key)
    }
    if (player) console.log(`[${this.roomLabel}] -leave ${player.name} → ${this.state.players.size} players`)
  }

  /**
   * Reserve one routable player id per live session. Normal clients send a
   * stable per-install anonymous id. A duplicate/malformed id must never
   * overwrite another player's routing entry, so it falls back to this
   * connection's server-minted session id.
   */
  private claimPlayerId(requested: unknown, sessionId: string): string {
    const parsed = PlayerId.safeParse(requested)
    if (parsed.success && !this.byPlayerId.has(parsed.data)) return parsed.data
    if (parsed.success) {
      console.warn(`[plaza] duplicate playerId "${parsed.data}" from ${sessionId}; using session id`)
    }
    return sessionId
  }

  onDispose() {
    console.log(`[${this.roomLabel}] room ${this.roomId} disposed`)
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

  /* ----------------------------------------------------- interaction layer */

  /**
   * Register the typed player-to-player interaction handlers. ALL of these are
   * additive to presence/movement and validated with the contract schemas — the
   * server never trusts a client payload. Routing is server-mediated (no P2P):
   * a sender posts; the server authorizes + delivers a typed message to the
   * recipient. The only expressive channels are menu choices + AI-mediated
   * artifacts; there is no raw-text relay anywhere.
   */
  private registerInteractionHandlers(): void {
    // Publish my safe stack into synced state + my RAW country into the private
    // geo tally (NEVER synced — see geoHistogram). Re-publishing is idempotent.
    this.onMessage(MP_MSG.profilePublish, (client, raw) => {
      const parsed = ProfilePublish.safeParse(raw)
      if (!parsed.success) {
        console.warn(`[plaza] bad profile-publish from ${client.sessionId}`)
        return
      }
      const p = this.state.players.get(client.sessionId)
      if (!p) return
      p.target = parsed.data.revealStack === false ? "und" : String(parsed.data.stack.target)
      p.native = parsed.data.revealStack === false ? "und" : String(parsed.data.stack.native)
      this.alsoLearning.set(
        client.sessionId,
        parsed.data.revealStack === false ? undefined : parsed.data.stack.alsoLearning,
      )
      // Country/continent feed the histogram only — they are kept off the wire.
      this.geo.set(client.sessionId, parsed.data.country, parsed.data.continent)
    })

    // A viewer asks for another player's card. Plaza uses the k-anonymous
    // resolver; room surfaces like Teletron can opt into country reveal because
    // the user explicitly toggled sharing and the waiting room is country-level.
    this.onMessage(MP_MSG.profileRequest, (client, raw) => {
      const parsed = ProfileRequest.safeParse(raw)
      if (!parsed.success) return
      if (!this.allow(client.sessionId, "profile", 20, 5000)) return
      const targetSession = this.byPlayerId.get(String(parsed.data.target))
      if (!targetSession) return
      const tp = this.state.players.get(targetSession)
      if (!tp) return
      const card: SafeProfile = {
        playerId: tp.playerId as SafeProfile["playerId"],
        name: tp.name || "Traveler",
        stack: {
          target: (tp.target || "en") as SafeProfile["stack"]["target"],
          native: (tp.native || tp.target || "en") as SafeProfile["stack"]["native"],
          alsoLearning: this.alsoLearning.get(targetSession),
        },
        place: this.revealPlace(targetSession),
      }
      client.send(MP_MSG.profileCard, card)
    })

    // Invite another player to chat / challenge / trade. The server stamps the
    // trusted sender id + name; the invitee gets a typed prompt to accept/decline.
    this.onMessage(MP_MSG.invite, (client, raw) => {
      const parsed = InviteMessage.safeParse(raw)
      if (!parsed.success) {
        console.warn(`[plaza] bad invite from ${client.sessionId}`)
        return
      }
      if (!this.allow(client.sessionId, "invite", 6, 10000)) {
        this.resultTo(client, parsed.data.inviteId, "unavailable")
        return
      }
      const from = this.state.players.get(client.sessionId)
      const toSession = this.byPlayerId.get(String(parsed.data.to))
      const toClient = toSession ? this.clientsBySession.get(toSession) : undefined
      if (!from || !toSession || !toClient) {
        this.resultTo(client, parsed.data.inviteId, "unavailable")
        return
      }
      if (this.invites.has(parsed.data.inviteId)) {
        this.resultTo(client, parsed.data.inviteId, "unavailable")
        return
      }
      this.invites.set(parsed.data.inviteId, {
        from: client.sessionId,
        to: toSession,
        kind: parsed.data.offer.kind,
        accepted: false,
      })
      const invited: InvitedMessage = {
        inviteId: parsed.data.inviteId,
        from: from.playerId as InvitedMessage["from"],
        fromName: from.name || "Traveler",
        offer: parsed.data.offer,
      }
      toClient.send(MP_MSG.invited, invited)
    })

    // The invitee accepts or declines; we relay the outcome to the inviter and
    // (on accept) the shared session id is the inviteId both clients already hold.
    this.onMessage(MP_MSG.inviteRespond, (client, raw) => {
      const parsed = InviteRespond.safeParse(raw)
      if (!parsed.success) return
      const rec = this.invites.get(parsed.data.inviteId)
      if (!rec || rec.to !== client.sessionId) return // only the invitee may respond
      const inviter = this.clientsBySession.get(rec.from)
      const outcome = parsed.data.action === "accept" ? "accepted" : "declined"
      if (outcome === "accepted") rec.accepted = true
      if (inviter) this.resultTo(inviter, parsed.data.inviteId, outcome)
      if (outcome === "declined") this.invites.delete(parsed.data.inviteId)
    })

    // The sender's local model has already rewritten the message into safe
    // English relay text. Route it to the recipient, whose local model
    // independently cleans it again and translates it into their learning language.
    this.onMessage(MP_MSG.chatSend, (client, raw) => {
      const parsed = MediatedChatInput.safeParse(raw)
      if (!parsed.success) {
        console.warn(`[plaza] bad chat-send from ${client.sessionId}`)
        return
      }
      if (!this.allow(client.sessionId, "chat", 20, 10000)) return
      const from = this.state.players.get(client.sessionId)
      const toSession = this.byPlayerId.get(String(parsed.data.to))
      const toClient = toSession ? this.clientsBySession.get(toSession) : undefined
      const to = toSession ? this.state.players.get(toSession) : undefined
      if (!from || !toSession || !toClient || !to) return
      if (!this.hasAcceptedInvite(client.sessionId, toSession, "chat")) {
        console.warn(`[plaza] rejected chat without accepted invite from ${client.sessionId}`)
        return
      }
      // Never trust caller-supplied routing identity. Stamp both parties from
      // the live room and frame the learning target from the recipient profile.
      const delivered = MediatedChatInput.parse({
        ...parsed.data,
        from: from.playerId,
        to: to.playerId,
        targetLanguage: to.target || parsed.data.targetLanguage,
      })
      toClient.send(MP_MSG.chatDeliver, delivered)
    })

    // Peer-challenge result: route my result to the OTHER party of the invite.
    // (Routed by the server's own invite record so neither client can forge the
    // recipient.) Accepted invites persist in the registry for the session.
    this.onMessage(MP_MSG.peerResult, (client, raw) => {
      const parsed = PeerChallengeResult.safeParse(raw)
      if (!parsed.success) return
      if (!this.allow(client.sessionId, "peer", 8, 10000)) return
      const rec = this.invites.get(parsed.data.inviteId)
      if (!rec || !rec.accepted || rec.kind !== "challenge") return
      if (rec.from !== client.sessionId && rec.to !== client.sessionId) return // not a party
      const otherSession = rec.from === client.sessionId ? rec.to : rec.from
      const otherClient = this.clientsBySession.get(otherSession)
      if (otherClient) otherClient.send(MP_MSG.peerResultDeliver, parsed.data)
    })

    // Trade transport: route a typed envelope to the partner. The economy layer
    // owns item rules + the rich proposal body (opaque to us); we sequence +
    // rate-limit + stamp the trusted sender. Atomic application is the economy
    // agent's concern (mirrored on both clients on mutual accept).
    this.onMessage(MP_MSG.trade, (client, raw) => {
      const parsed = TradeEnvelope.safeParse(raw)
      if (!parsed.success) {
        console.warn(`[plaza] bad trade from ${client.sessionId}`)
        return
      }
      if (!this.allow(client.sessionId, "trade", 30, 10000)) return
      const from = this.state.players.get(client.sessionId)
      const toSession = this.byPlayerId.get(String(parsed.data.to))
      const toClient = toSession ? this.clientsBySession.get(toSession) : undefined
      if (!from || !toSession || !toClient) return
      if (!this.hasAcceptedInvite(client.sessionId, toSession, "trade")) {
        console.warn(`[plaza] rejected trade without accepted invite from ${client.sessionId}`)
        return
      }
      const update: TradeUpdateMessage = {
        ...parsed.data,
        from: from.playerId as TradeUpdateMessage["from"],
      }
      toClient.send(MP_MSG.tradeUpdate, update)
    })
  }

  /** Send an invite outcome to a client. */
  private resultTo(client: Client, inviteId: string, outcome: InviteResult["outcome"]): void {
    const msg: InviteResult = { inviteId, outcome }
    client.send(MP_MSG.inviteResult, msg)
  }

  /** Drop + expire every invite touching a (leaving) session. */
  private dropInvitesFor(sessionId: string): void {
    for (const [id, rec] of [...this.invites]) {
      if (rec.from === sessionId || rec.to === sessionId) {
        const other = rec.from === sessionId ? rec.to : rec.from
        const otherClient = this.clientsBySession.get(other)
        if (otherClient) this.resultTo(otherClient, id, "expired")
        this.invites.delete(id)
      }
    }
  }

  private hasAcceptedInvite(a: string, b: string, kind: InviteMessage["offer"]["kind"]): boolean {
    for (const rec of this.invites.values()) {
      if (!rec.accepted || rec.kind !== kind) continue
      if ((rec.from === a && rec.to === b) || (rec.from === b && rec.to === a)) return true
    }
    return false
  }

  private revealPlace(sessionId: string): PlaceReveal {
    if (this.placeReveal !== "country") return this.geo.reveal(sessionId)
    const raw = this.geo.raw(sessionId)
    if (!raw?.continent) return { granularity: "hidden" }
    if (raw.country) {
      return { granularity: "country", country: raw.country, continent: raw.continent }
    }
    return { granularity: "continent", continent: raw.continent }
  }

  /**
   * Coarse anti-grief rate limiter: allow at most `max` actions of `kind` per
   * `windowMs` sliding window per session. Returns false (drop) when exceeded.
   * Per-kind so chat spam can't starve trades, etc.
   */
  private allow(sessionId: string, kind: string, max: number, windowMs: number): boolean {
    const now = Date.now()
    const key = `${sessionId}:${kind}`
    const log = this.actionLog.get(key) ?? []
    const recent = log.filter((t) => now - t < windowMs)
    if (recent.length >= max) {
      this.actionLog.set(key, recent)
      console.warn(`[plaza] rate-limited ${kind} from ${sessionId}`)
      return false
    }
    recent.push(now)
    this.actionLog.set(key, recent)
    return true
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
