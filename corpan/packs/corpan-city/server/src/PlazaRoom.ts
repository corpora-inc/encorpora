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
  ChatControlMessage,
  ChatControlDeliver,
  PeerChallengeResult,
  TradeEnvelope,
  BlockMessage,
  ReportMessage,
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
import type { Outbox } from "./outbox.js"

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
  /**
   * Shared store-and-forward buffer for messages to momentarily-offline
   * penpals. Pass ONE instance to every room of a definition so a returning
   * player is reachable regardless of which room they land in. Omit to disable
   * buffering (messages to offline peers are then simply not delivered).
   */
  outbox?: Outbox
  /**
   * The living-link window: how long an accepted chat pair (and its buffered
   * messages) survive without a fresh socket. Teletron uses 24h for async
   * penpals; the city defaults to a short reconnect grace.
   */
  acceptedPairTtlMs?: number
}

/** Max plausible ground speed (world u/s). The local player walks at 6.5; we
 *  allow generous headroom for prediction/reconnect snap, then clamp. */
const MAX_SPEED = 14
/** Below this dt we don't speed-check (first move / clock skew). */
const MIN_DT = 0.001
/** How long an accepted chat/trade pair may survive a fresh socket rejoin. */
const ACCEPTED_PAIR_TTL_MS = 2 * 60 * 60 * 1000
/** How long an unanswered invite stays live before it resolves as expired. */
const INVITE_TTL_MS = 30 * 1000

type InviteKind = InviteMessage["offer"]["kind"]
type AcceptedPair = { a: string; b: string; kind: InviteKind; expiresAt: number }
type InviteRecord = {
  from: string
  to: string
  kind: InviteKind
  accepted: boolean
  timeout?: ReturnType<typeof setTimeout>
}

export class PlazaRoom extends Room<PlazaState> {
  /** soft cap before matchmaking spins a sibling room (see index.ts sortBy). */
  maxClients = 30
  private roomLabel = "plaza"
  private reconnectionSeconds = 90
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
  private invites = new Map<string, InviteRecord>()
  /** Durable playerId pair auth for accepted chat/trade after reconnect/rejoin. */
  private acceptedPairs = new Map<string, AcceptedPair>()
  /** how long an accepted pair (+ its buffered messages) survives idle. */
  private acceptedPairTtlMs = ACCEPTED_PAIR_TTL_MS
  /** shared store-and-forward buffer for offline penpals (optional). */
  private outbox?: Outbox
  /** coarse anti-grief: sessionId → recent action timestamps (sliding window). */
  private actionLog = new Map<string, number[]>()
  /** live block mirror: blocker playerId → set of blocked playerIds (session-scoped). */
  private blocks = new Map<string, Set<string>>()

  onCreate(options: PlazaRoomOptions) {
    this.topology = options.topology
    this.roomLabel = options.roomLabel ?? "plaza"
    if (options.maxClients) this.maxClients = options.maxClients
    if (typeof options.reconnectionSeconds === "number") {
      this.reconnectionSeconds = Math.max(0, options.reconnectionSeconds)
    }
    this.replaceDuplicatePlayerId = options.replaceDuplicatePlayerId === true
    this.placeReveal = options.placeReveal ?? "k-anon"
    this.outbox = options.outbox
    if (typeof options.acceptedPairTtlMs === "number" && options.acceptedPairTtlMs > 0) {
      this.acceptedPairTtlMs = options.acceptedPairTtlMs
    }
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
    this.notifyAcceptedChatPartners(p.playerId, "partner-returned")
    this.notifyJoinedPlayerAboutAcceptedChats(p.playerId)

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
    if (player?.playerId) this.notifyAcceptedChatPartners(player.playerId, "partner-left")
    if (player?.playerId && this.byPlayerId.get(player.playerId) === sessionId) {
      this.byPlayerId.delete(player.playerId)
    }
    this.dropInvitesFor(sessionId)
    if (player?.playerId) this.blocks.delete(player.playerId)
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
    for (const rec of this.invites.values()) this.clearInviteTimer(rec)
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
      // The client publishes its profile right after binding its message
      // handlers, so this is the race-free moment to flush any messages that
      // were buffered while it was offline.
      this.flushOutbox(p.playerId, client)
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
      if (this.blockedEitherWay(from.playerId, String(parsed.data.to))) {
        this.resultTo(client, parsed.data.inviteId, "unavailable")
        return
      }
      if (
        parsed.data.offer.kind === "chat" &&
        this.acceptedPairForPlayerIds(from.playerId, String(parsed.data.to), "chat")
      ) {
        this.resultTo(client, parsed.data.inviteId, "accepted")
        this.sendChatControlToPlayer(
          String(parsed.data.to),
          from.playerId,
          "partner-returned",
          `pair-${pairKey(from.playerId, String(parsed.data.to), "chat")}`,
        )
        return
      }
      if (this.invites.has(parsed.data.inviteId)) {
        this.resultTo(client, parsed.data.inviteId, "unavailable")
        return
      }
      const rec: InviteRecord = {
        from: client.sessionId,
        to: toSession,
        kind: parsed.data.offer.kind,
        accepted: false,
      }
      rec.timeout = setTimeout(() => this.expireInvite(parsed.data.inviteId), INVITE_TTL_MS)
      this.invites.set(parsed.data.inviteId, rec)
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
      this.clearInviteTimer(rec)
      if (outcome === "accepted") {
        rec.accepted = true
        this.rememberAcceptedPair(rec.from, rec.to, rec.kind)
      }
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
      const toPlayerId = String(parsed.data.to)
      const toSession = this.byPlayerId.get(toPlayerId)
      const toClient = toSession ? this.clientsBySession.get(toSession) : undefined
      const to = toSession ? this.state.players.get(toSession) : undefined
      if (!from) return
      if (this.blockedEitherWay(from.playerId, toPlayerId)) return
      if (!this.acceptedPairForPlayerIds(from.playerId, toPlayerId, "chat")) {
        // The server holds no accepted pair (restart / TTL lapse / fresh-join
        // after the reconnect window). DON'T silently drop — that's the bug that
        // made resumed conversations look online yet deliver nothing. Tell the
        // sender the link is stale so the client can re-establish it (re-invite)
        // and re-send. The message itself is not delivered here.
        console.warn(`[plaza] chat-send with no accepted pair from ${client.sessionId} → link-stale`)
        // from = the partner whose link is stale (so the client re-invites THEM);
        // to = us. fromName resolves to the partner's live name if they're here.
        this.sendChatControlToClient(client, toPlayerId, from.playerId, "link-stale")
        return
      }
      if (!toSession || !toClient || !to) {
        // Recipient is offline: buffer the sanitized envelope for delivery when
        // they return (within the living-link window), and keep the link alive.
        if (this.outbox) {
          const ts = Date.now()
          const buffered = MediatedChatInput.parse({
            ...parsed.data,
            from: from.playerId,
            to: toPlayerId,
          })
          this.outbox.enqueue({
            to: toPlayerId,
            from: from.playerId,
            payload: buffered,
            ts,
            expiresAt: ts + this.acceptedPairTtlMs,
          })
          this.touchAcceptedPair(from.playerId, toPlayerId, "chat")
        }
        this.sendChatControlToClient(client, toPlayerId, from.playerId, "partner-left")
        return
      }
      this.touchAcceptedPair(from.playerId, to.playerId, "chat")
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

    // Chat lifecycle only; never carries user-authored text. Explicit "ended"
    // tears down the accepted chat pair, while server-originated away/returned
    // events keep the UI honest across reconnects.
    this.onMessage(MP_MSG.chatControl, (client, raw) => {
      const parsed = ChatControlMessage.safeParse(raw)
      if (!parsed.success) {
        console.warn(`[plaza] bad chat-control from ${client.sessionId}`)
        return
      }
      if (!this.allow(client.sessionId, "chat-control", 12, 10000)) return
      const from = this.state.players.get(client.sessionId)
      const toPlayerId = String(parsed.data.to)
      const toSession = this.byPlayerId.get(toPlayerId)
      const toClient = toSession ? this.clientsBySession.get(toSession) : undefined
      const to = toSession ? this.state.players.get(toSession) : undefined
      if (!from) return
      if (!this.acceptedPairForPlayerIds(from.playerId, toPlayerId, "chat")) return
      if (parsed.data.action === "ended") {
        this.forgetAcceptedPair(from.playerId, toPlayerId, "chat")
        this.dropAcceptedInviteForPlayers(from.playerId, toPlayerId, "chat")
      }
      if (!toSession || !toClient || !to) return
      const delivered: ChatControlDeliver = {
        ...parsed.data,
        from: from.playerId as ChatControlDeliver["from"],
        fromName: from.name || "Traveler",
        to: to.playerId as ChatControlDeliver["to"],
      }
      toClient.send(MP_MSG.chatControl, ChatControlDeliver.parse(delivered))
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

    // Block / unblock a player. The durable list lives on the device; this is
    // the live, session-scoped mirror that suppresses the blocked player's
    // invites and messages and tears down any link + buffered messages.
    this.onMessage(MP_MSG.block, (client, raw) => {
      const parsed = BlockMessage.safeParse(raw)
      if (!parsed.success) return
      if (!this.allow(client.sessionId, "block", 30, 10000)) return
      const from = this.state.players.get(client.sessionId)
      if (!from) return
      const target = String(parsed.data.target)
      if (parsed.data.action === "unblock") {
        this.blocks.get(from.playerId)?.delete(target)
        return
      }
      const set = this.blocks.get(from.playerId) ?? new Set<string>()
      set.add(target)
      this.blocks.set(from.playerId, set)
      // Sever any live link + drop buffered messages in both directions.
      this.forgetAcceptedPair(from.playerId, target, "chat")
      this.dropAcceptedInviteForPlayers(from.playerId, target, "chat")
      this.outbox?.removeForPair(from.playerId, target)
      console.warn(`[${this.roomLabel}] block ${from.playerId} → ${target}`)
    })

    // Report a player to moderation. Records ONLY minimal structured metadata —
    // never the raw draft. CloudWatch/container logs are the audit trail.
    this.onMessage(MP_MSG.report, (client, raw) => {
      const parsed = ReportMessage.safeParse(raw)
      if (!parsed.success) return
      if (!this.allow(client.sessionId, "report", 10, 60000)) return
      const from = this.state.players.get(client.sessionId)
      if (!from) return
      console.warn(
        `[${this.roomLabel}] REPORT reporter=${from.playerId} reported=${String(parsed.data.target)} ` +
          `reason=${parsed.data.reason ?? "unspecified"} interaction=${parsed.data.interactionId ?? "-"} ` +
          `ts=${Date.now()}`,
      )
    })
  }

  /** True when either player has blocked the other (suppress all interaction). */
  private blockedEitherWay(a: string, b: string): boolean {
    return (this.blocks.get(a)?.has(b) ?? false) || (this.blocks.get(b)?.has(a) ?? false)
  }

  /** Send an invite outcome to a client. */
  private resultTo(client: Client, inviteId: string, outcome: InviteResult["outcome"]): void {
    const msg: InviteResult = { inviteId, outcome }
    client.send(MP_MSG.inviteResult, msg)
  }

  private clearInviteTimer(rec: InviteRecord): void {
    if (!rec.timeout) return
    clearTimeout(rec.timeout)
    rec.timeout = undefined
  }

  private expireInvite(inviteId: string): void {
    const rec = this.invites.get(inviteId)
    if (!rec || rec.accepted) return
    this.clearInviteTimer(rec)
    const inviter = this.clientsBySession.get(rec.from)
    if (inviter) this.resultTo(inviter, inviteId, "expired")
    this.invites.delete(inviteId)
  }

  /** Drop + expire every invite touching a (leaving) session. */
  private dropInvitesFor(sessionId: string): void {
    for (const [id, rec] of [...this.invites]) {
      if (rec.from === sessionId || rec.to === sessionId) {
        this.clearInviteTimer(rec)
        if (rec.accepted && (rec.kind === "chat" || rec.kind === "trade")) {
          this.invites.delete(id)
          continue
        }
        const other = rec.from === sessionId ? rec.to : rec.from
        const otherClient = this.clientsBySession.get(other)
        if (otherClient) this.resultTo(otherClient, id, "expired")
        this.invites.delete(id)
      }
    }
  }

  private hasAcceptedInvite(a: string, b: string, kind: InviteKind): boolean {
    for (const rec of this.invites.values()) {
      if (!rec.accepted || rec.kind !== kind) continue
      if ((rec.from === a && rec.to === b) || (rec.from === b && rec.to === a)) return true
    }
    return this.acceptedPairForSessions(a, b, kind) !== null
  }

  private rememberAcceptedPair(aSession: string, bSession: string, kind: InviteKind): void {
    if (kind !== "chat" && kind !== "trade") return
    const a = this.state.players.get(aSession)?.playerId
    const b = this.state.players.get(bSession)?.playerId
    if (!a || !b) return
    this.pruneAcceptedPairs()
    this.acceptedPairs.set(pairKey(a, b, kind), {
      a,
      b,
      kind,
      expiresAt: Date.now() + this.acceptedPairTtlMs,
    })
  }

  private acceptedPairForSessions(aSession: string, bSession: string, kind: InviteKind): AcceptedPair | null {
    const a = this.state.players.get(aSession)?.playerId
    const b = this.state.players.get(bSession)?.playerId
    if (!a || !b) return null
    return this.acceptedPairForPlayerIds(a, b, kind)
  }

  private acceptedPairForPlayerIds(a: string, b: string, kind: InviteKind): AcceptedPair | null {
    const key = pairKey(a, b, kind)
    const rec = this.acceptedPairs.get(key)
    if (!rec) return null
    if (rec.expiresAt <= Date.now()) {
      this.acceptedPairs.delete(key)
      return null
    }
    return rec
  }

  private touchAcceptedPair(a: string, b: string, kind: InviteKind): void {
    const rec = this.acceptedPairForPlayerIds(a, b, kind)
    if (!rec) return
    rec.expiresAt = Date.now() + this.acceptedPairTtlMs
  }

  private forgetAcceptedPair(a: string, b: string, kind: InviteKind): void {
    this.acceptedPairs.delete(pairKey(a, b, kind))
    // The link is gone — drop any messages still buffered between this pair.
    if (kind === "chat") this.outbox?.removeForPair(a, b)
  }

  private dropAcceptedInviteForPlayers(a: string, b: string, kind: InviteKind): void {
    for (const [id, rec] of [...this.invites]) {
      if (!rec.accepted || rec.kind !== kind) continue
      const from = this.state.players.get(rec.from)?.playerId
      const to = this.state.players.get(rec.to)?.playerId
      if ((from === a && to === b) || (from === b && to === a)) {
        this.clearInviteTimer(rec)
        this.invites.delete(id)
      }
    }
  }

  private notifyAcceptedChatPartners(playerId: string, action: ChatControlDeliver["action"]): void {
    if (!playerId) return
    this.pruneAcceptedPairs()
    for (const rec of this.acceptedPairs.values()) {
      if (rec.kind !== "chat") continue
      if (rec.a !== playerId && rec.b !== playerId) continue
      const otherPlayerId = rec.a === playerId ? rec.b : rec.a
      this.sendChatControlToPlayer(
        otherPlayerId,
        playerId,
        action,
        `pair-${pairKey(playerId, otherPlayerId, "chat")}`,
      )
    }
  }

  private notifyJoinedPlayerAboutAcceptedChats(playerId: string): void {
    if (!playerId) return
    this.pruneAcceptedPairs()
    for (const rec of this.acceptedPairs.values()) {
      if (rec.kind !== "chat") continue
      if (rec.a !== playerId && rec.b !== playerId) continue
      const partnerPlayerId = rec.a === playerId ? rec.b : rec.a
      if (!this.byPlayerId.has(partnerPlayerId)) continue
      this.sendChatControlToPlayer(
        playerId,
        partnerPlayerId,
        "partner-returned",
        `pair-${pairKey(playerId, partnerPlayerId, "chat")}`,
      )
    }
  }

  private sendChatControlToPlayer(
    toPlayerId: string,
    fromPlayerId: string,
    action: ChatControlDeliver["action"],
    interactionId = `pair-${pairKey(fromPlayerId, toPlayerId, "chat")}`,
  ): void {
    const toSession = this.byPlayerId.get(toPlayerId)
    const toClient = toSession ? this.clientsBySession.get(toSession) : undefined
    if (!toClient) return
    this.sendChatControlToClient(toClient, fromPlayerId, toPlayerId, action, interactionId)
  }

  private sendChatControlToClient(
    client: Client,
    fromPlayerId: string,
    toPlayerId: string,
    action: ChatControlDeliver["action"],
    interactionId = `pair-${pairKey(fromPlayerId, toPlayerId, "chat")}`,
  ): void {
    const delivered: ChatControlDeliver = {
      from: fromPlayerId as ChatControlDeliver["from"],
      fromName: this.playerNameById(fromPlayerId),
      to: toPlayerId as ChatControlDeliver["to"],
      interactionId,
      action,
    }
    client.send(MP_MSG.chatControl, ChatControlDeliver.parse(delivered))
  }

  /**
   * Deliver any buffered messages addressed to this player, then forget them.
   * Called when the client signals it is ready (its first profile-publish), so
   * the recipient's chat-deliver handler is guaranteed bound. Idempotent: the
   * buffer is drained, so repeated publishes deliver nothing further.
   */
  private flushOutbox(playerId: string, client: Client): void {
    if (!this.outbox || !playerId) return
    const pending = this.outbox.drain(playerId, Date.now())
    if (!pending.length) return
    for (const env of pending) client.send(MP_MSG.chatDeliver, env.payload)
    console.log(`[${this.roomLabel}] flushed ${pending.length} buffered message(s) to ${playerId}`)
  }

  private playerNameById(playerId: string): string | undefined {
    const sessionId = this.byPlayerId.get(playerId)
    const player = sessionId ? this.state.players.get(sessionId) : undefined
    return player?.name || undefined
  }

  private pruneAcceptedPairs(): void {
    const now = Date.now()
    for (const [key, rec] of this.acceptedPairs) {
      if (rec.expiresAt <= now) this.acceptedPairs.delete(key)
    }
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

function pairKey(a: string, b: string, kind: InviteKind): string {
  const lo = a <= b ? a : b
  const hi = a <= b ? b : a
  return `${kind}:${lo}:${hi}`
}

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
