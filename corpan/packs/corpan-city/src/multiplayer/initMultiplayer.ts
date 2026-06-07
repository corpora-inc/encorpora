import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import type {
  AvatarSpec,
  RoomTopology,
  LearnerPair,
  LanguageCode,
  PlayerId,
  SafeProfile,
  InvitedMessage,
  InviteResult,
  MediatedChatInput,
  MediatedChatArtifact,
  ChallengeResult,
  InviteOffer,
} from "@corpan-city/contracts"
import { createNetClient, type NetClient, type NetRoom, type NetStatus } from "../net"
import type { WardrobeTheme } from "../character/characterGen"
import type { ModelBroker } from "../npc/modelBroker"
import type { HostApi } from "../npc/hostTypes"
import type { ChallengeRuntimeHost } from "../challenges/registry"
import type { ChallengeContext } from "@corpan-city/contracts"
import { getTool } from "../challenges/registry"
import { bindT } from "../i18n/strings"
import { createProtocol, mintId, type InteractionProtocol } from "./protocol"
import { detectCountry, continentOf } from "./geo"
import { createChatMediator, type ChatMediator } from "./mediatedChat"
import { runPeerChallenge } from "./peerChallenge"
import { ColyseusTradeTransport } from "./tradeTransport"
import type { TradeTransport } from "../economy/trade"
import {
  showProfileCard,
  showInvitePrompt,
  openChatPanel,
  createNearbyPip,
  showToast,
  type ChatPanelHandle,
} from "./interactionUI"

/**
 * initMultiplayer — THE one wiring point game.ts calls (per the brief: game.ts
 * stays a single small call behind this function).
 *
 * It is fully ADDITIVE + FEATURE-DETECTED: with no server URL (or a server that
 * never connects) it does almost nothing and the single-player game is
 * untouched. When a server IS reachable it layers on:
 *   • presence (reusing the existing `createNetClient`),
 *   • a safe, k-anonymity profile card when you approach another real player,
 *   • LLM-mediated cross-language chat (reusing the NPC model broker),
 *   • player-to-player challenge invites (reusing `runChallenge`), and
 *   • a Colyseus trade TRANSPORT the economy layer drives.
 *
 * The caller passes live getters (player position, container, overlay) and the
 * shared broker. We own everything multiplayer; we never touch the world,
 * economy rules, quest, or challenge internals.
 */

export interface MultiplayerOptions {
  /** ws endpoint, e.g. "ws://localhost:2567". Absent/empty → multiplayer off. */
  serverUrl?: string
  /** logical Colyseus room (default "plaza"). */
  room?: string
  /** the local player's durable per-install anonymous id. */
  playerId: string
  /** composed safe display name. */
  name: string
  /** the local player's avatar (broadcast + re-skinned remotely). */
  avatar: AvatarSpec
  /** active room topology (shared collision space). */
  topology: RoomTopology
  /** the local Babylon scene remote avatars render into. */
  scene: BabylonScene
  /** local scene wardrobe theme (re-skin remotes into our world). */
  theme?: WardrobeTheme
  /** the host-painted overlay all interaction UI mounts into (`.wp-overlay`). */
  overlay: HTMLElement
  /** the centered challenge overlay layer (same the game passes to runChallenge). */
  challengeContainer: HTMLElement
  /** live local player position (predicted) — polled for presence + proximity. */
  getLocalPos: () => { x: number; z: number; facing?: number }
  /** the learner's pair (drives stack reveal + chat languages). */
  learnerPair: LearnerPair
  /** the host API (TTS/LLM/STT) — reused for mediated chat + challenges. */
  hostApi: HostApi
  /** the SHARED model broker (single in-process model slot; reused from NPCs). */
  broker: ModelBroker
  /** corpus/TTS/STT host the shared challenge runs against. */
  challengeHost: ChallengeRuntimeHost
  /** sceneId/questId for presence context (optional). */
  sceneId?: string
  questId?: string
  /** OPTIONAL: reward both players after a peer challenge (economy handoff). */
  onPeerReward?: (self: ChallengeResult, peer?: ChallengeResult) => void
}

export interface MultiplayerHandle {
  /** call each frame: drives presence + proximity profile reveal. */
  update: (dt: number) => void
  status: () => NetStatus
  /**
   * The trade TRANSPORT the economy agent's UI consumes. Always present: when
   * online it's the Colyseus-backed transport; the economy layer should fall
   * back to its own `LocalTradeTransport` when this is null (offline).
   */
  tradeTransport: () => TradeTransport | null
  dispose: () => void
}

/**
 * Resolve the multiplayer server URL, or undefined (→ single-player). Precedence:
 *   1. `globalThis.__WP_SERVER_URL` (host/harness RUNTIME injection)
 *   2. `?wpServer=` / `?server=` query param (standalone + QA)
 *   3. `import.meta.env.VITE_WP_SERVER_URL` (BUILD-TIME bake, e.g. the deployed
 *      App Runner `wss://…` URL — see server/DEPLOY.md)
 * Returns undefined when none is set, so production is single-player until a
 * server is provisioned — multiplayer is strictly opt-in + additive.
 */
export function resolveServerUrl(): string | undefined {
  try {
    const injected = (globalThis as { __WP_SERVER_URL?: string }).__WP_SERVER_URL
    if (injected) return injected
    if (typeof location !== "undefined" && location.search) {
      const q = new URLSearchParams(location.search)
      const url = q.get("wpServer") ?? q.get("server")
      if (url) return url
    }
    // Build-time fallback: a deployed server URL baked at `vite build` time via
    // VITE_WP_SERVER_URL (statically inlined). Lets a release ship multiplayer
    // without any runtime injection, while runtime injection (1/2) still wins.
    const baked =
      typeof import.meta !== "undefined" ? import.meta.env?.VITE_WP_SERVER_URL : undefined
    if (baked) return baked
  } catch (e) {
    console.warn("[mp] server URL resolution failed:", e)
  }
  return undefined
}

/** How close (world units) you must be to a real player to reveal their card. */
const REVEAL_RADIUS = 3.2
/** Re-reveal cooldown so the card doesn't re-pop while you loiter (ms). */
const REVEAL_COOLDOWN_MS = 8000

export function initMultiplayer(opts: MultiplayerOptions): MultiplayerHandle {
  const t = bindT(opts.learnerPair.native)
  const localPlayerId = opts.playerId as PlayerId

  // Mediated-chat engine reuses the shared broker (honours the model slot).
  const mediator: ChatMediator = createChatMediator(opts.hostApi, opts.broker)

  let proto: InteractionProtocol | null = null
  let tradeTransport: ColyseusTradeTransport | null = null
  let trade: TradeTransport | null = null
  const pip = createNearbyPip(opts.overlay)

  // Active chat session (one at a time): partner + open panel + interactionId.
  let chat: {
    partnerId: PlayerId
    partnerName: string
    panel: ChatPanelHandle
    interactionId: string
  } | null = null
  // Profile cards we've recently shown (playerId → last shown ms), to debounce.
  const recentlyRevealed = new Map<string, number>()
  // Pending profile requests we initiated, with what to do when the card lands.
  const pendingProfile = new Map<string, (card: SafeProfile) => void>()
  // Outstanding invites WE sent: inviteId → resolver continuation.
  const pendingInvites = new Map<
    string,
    { offer: InviteOffer; partnerId: PlayerId; partnerName: string }
  >()
  // Peer-challenge result fan-in, keyed by inviteId.
  const peerResultListeners = new Map<string, (r: ChallengeResult) => void>()

  /* -------------------------------------------------- profile / reveal helpers */

  function publishProfile(): void {
    if (!proto) return
    const country = detectCountry()
    proto.publishProfile({
      stack: { target: opts.learnerPair.target, native: opts.learnerPair.native },
      country,
      continent: continentOf(country),
    })
  }

  function requestAndShow(targetPlayerId: string, name: string): void {
    if (!proto) return
    pendingProfile.set(targetPlayerId, (card) => showCard(card, name))
    proto.requestProfile(targetPlayerId)
    // Safety: if no card comes back, clear the pending entry after a bit.
    setTimeout(() => pendingProfile.delete(targetPlayerId), 4000)
  }

  function showCard(card: SafeProfile, fallbackName: string): void {
    const name = card.name || fallbackName
    showProfileCard(opts.overlay, t, opts.learnerPair.native, card, {
      onSayHi: () => openChat(card.playerId, name),
      onChallenge: () => sendInvite(card.playerId, name, buildChallengeOffer("duel")),
      onTrade: () => sendInvite(card.playerId, name, { kind: "trade" }),
    })
  }

  /* ------------------------------------------------------------ invites/launch */

  function buildChallengeOffer(mode: "coop" | "duel"): InviteOffer | null {
    // Use the SAME mic-free tappable tool the beginner quests use so a peer
    // challenge is always satisfiable on-device (matches the core-loop fix).
    const toolId = "translate-fast" as const
    const tool = getTool(toolId)
    if (!tool) {
      console.error("[mp] translate-fast tool unavailable; cannot invite to challenge")
      return null
    }
    return {
      kind: "challenge",
      tool: toolId,
      mode,
      spec: {
        toolId,
        challengeId: mintId("pc"),
        language: opts.learnerPair.target,
        nativeLanguage: opts.learnerPair.native,
        mode: mode === "coop" ? "coop" : "duel",
      },
    }
  }

  function sendInvite(partnerId: string, partnerName: string, offer: InviteOffer | null): void {
    if (!proto || !offer) return
    const inviteId = proto.invite(partnerId, offer)
    pendingInvites.set(inviteId, { offer, partnerId: partnerId as PlayerId, partnerName })
    showToast(opts.overlay, opts.learnerPair.native, t("mp.invite.sent"))
  }

  function onInviteResult(msg: InviteResult): void {
    const pending = pendingInvites.get(msg.inviteId)
    if (!pending) return
    if (msg.outcome === "accepted") {
      // The invitee accepted → start the shared session from OUR side.
      startSession(msg.inviteId, pending.offer, pending.partnerId, pending.partnerName, true)
    } else {
      const key =
        msg.outcome === "declined"
          ? "mp.invite.declined"
          : msg.outcome === "expired"
            ? "mp.invite.expired"
            : "mp.invite.unavailable"
      showToast(opts.overlay, opts.learnerPair.native, t(key, { name: pending.partnerName }))
    }
    pendingInvites.delete(msg.inviteId)
  }

  function onInvited(msg: InvitedMessage): void {
    showInvitePrompt(opts.overlay, t, opts.learnerPair.native, msg, (accepted) => {
      proto?.respondInvite(msg.inviteId, accepted ? "accept" : "decline")
      if (accepted) {
        startSession(msg.inviteId, msg.offer, msg.from, msg.fromName, false)
      }
    })
  }

  /** Begin the agreed-upon session (chat / challenge / trade) on this device. */
  function startSession(
    inviteId: string,
    offer: InviteOffer,
    partnerId: PlayerId,
    partnerName: string,
    _isInitiator: boolean,
  ): void {
    if (offer.kind === "chat") {
      openChat(partnerId, partnerName)
      return
    }
    if (offer.kind === "challenge") {
      void launchPeerChallenge(inviteId, offer, partnerName)
      return
    }
    // Trade sessions are driven by the economy layer's UI via `tradeTransport()`;
    // accepting just makes the transport ready. The economy UI opens on its own.
  }

  async function launchPeerChallenge(
    inviteId: string,
    offer: Extract<InviteOffer, { kind: "challenge" }>,
    partnerName: string,
  ): Promise<void> {
    const ctx: ChallengeContext & { localPlayerId: PlayerId } = {
      language: offer.spec.language as LanguageCode,
      nativeLanguage: offer.spec.nativeLanguage as LanguageCode | undefined,
      mode: offer.mode === "coop" ? "coop" : "duel",
      entryIds: offer.spec.entryIds,
      localPlayerId,
    }
    const outcome = await runPeerChallenge(
      opts.challengeContainer,
      offer.spec,
      ctx,
      opts.challengeHost,
      offer.mode,
      {
        reportResult: (r) => proto?.reportPeerResult(inviteId, r),
        onPeerResult: (cb) => {
          peerResultListeners.set(inviteId, cb)
          return () => peerResultListeners.delete(inviteId)
        },
      },
      { name: partnerName, avatar: "🧑" },
    ).catch((e) => {
      console.error("[mp] peer challenge failed:", e)
      return null
    })
    if (!outcome) return
    // Localized verdict toast.
    const key =
      outcome.verdict === "solo"
        ? "mp.duel.solo"
        : offer.mode === "coop"
          ? outcome.verdict === "win"
            ? "mp.duel.coopWin"
            : "mp.duel.coopLose"
          : outcome.verdict === "win"
            ? "mp.duel.win"
            : outcome.verdict === "lose"
              ? "mp.duel.lose"
              : "mp.duel.tie"
    showToast(opts.overlay, opts.learnerPair.native, t(key))
    // Hand both results to the economy layer to reward (both earn — no punishment).
    try {
      opts.onPeerReward?.(outcome.self, outcome.peer)
    } catch (e) {
      console.error("[mp] onPeerReward threw:", e)
    }
  }

  /* ------------------------------------------------------------------- chat */

  async function sendChatText(
    partnerId: PlayerId,
    interactionId: string,
    text: string,
  ): Promise<void> {
    const activeChat = chat
    activeChat?.panel.appendSelf(text)
    const stopCleaning = activeChat?.panel.showBridging()
    try {
      const input = await mediator.prepareOutbound({
        from: localPlayerId,
        to: partnerId,
        interactionId,
        text,
        // Chat is language practice: author in the language they are learning.
        // The recipient independently chooses its own target/native rendering.
        sourceLanguage: opts.learnerPair.target as LanguageCode,
        targetLanguage: opts.learnerPair.target as LanguageCode,
        mode: "beginner",
      })
      if (proto && chat === activeChat) proto.sendChat(input)
    } finally {
      stopCleaning?.()
    }
  }

  function openChat(partnerId: PlayerId, partnerName: string): void {
    if (chat) chat.panel.close()
    const interactionId = mintId("chat")
    const panel = openChatPanel(
      opts.overlay,
      t,
      opts.learnerPair.native,
      partnerName,
      (text) => {
        // Raw text stays local. The author's LLM cleans it before transmission.
        void sendChatText(partnerId, interactionId, text)
      },
      () => {
        chat = null
      },
    )
    chat = { partnerId, partnerName, panel, interactionId }
  }

  /** A mediated chat input arrived from a partner → lessonify + render. */
  async function onChat(input: MediatedChatInput): Promise<void> {
    // Open a panel if this is the first message from someone we're not chatting with.
    if (!chat || chat.partnerId !== input.from) {
      openChat(input.from as PlayerId, "·") // name unknown here; the card supplies it normally
    }
    const panel = chat?.panel
    if (!panel) return
    const stopBridging = panel.showBridging()
    let artifact: MediatedChatArtifact
    try {
      artifact = await mediator.lessonify(input, opts.learnerPair)
    } finally {
      stopBridging()
    }
    panel.appendPeer(artifact, (label) => {
      // Suggested replies are still cleaned locally before crossing the wire.
      void sendChatText(input.from, input.interactionId, label)
    })
  }

  /* ----------------------------------------------------------- net + lifecycle */

  // Only construct the net client when a server URL is configured. No URL →
  // multiplayer is entirely off and the single-player game is untouched.
  let net: NetClient | null = null
  if (opts.serverUrl) {
    net = createNetClient({
      url: opts.serverUrl,
      room: opts.room,
      identity: {
        playerId: opts.playerId,
        name: opts.name,
        avatar: opts.avatar,
        sceneId: opts.sceneId,
        questId: opts.questId,
      },
      topology: opts.topology,
      scene: opts.scene,
      theme: opts.theme,
      getLocalPos: opts.getLocalPos,
      onRoom: (room) => bindRoom(room),
      onRoomLost: () => unbindRoom(),
    })
  }

  function bindRoom(room: NetRoom): void {
    proto = createProtocol(room, {
      onProfileCard: (card) => {
        const cb = pendingProfile.get(card.playerId)
        pendingProfile.delete(card.playerId)
        if (cb) cb(card)
      },
      onInvited,
      onInviteResult,
      onChat: (input) => void onChat(input),
      onTrade: (msg) => tradeTransport?.onInbound(msg),
      onPeerResult: (inviteId, result) => peerResultListeners.get(inviteId)?.(result),
    })
    tradeTransport = new ColyseusTradeTransport(proto, (p) =>
      p.fromPlayerId === opts.playerId ? p.toPlayerId : p.fromPlayerId,
    )
    trade = tradeTransport
    publishProfile()
  }

  function unbindRoom(): void {
    proto?.dispose()
    proto = null
    tradeTransport = null
    trade = null
  }

  /* ----------------------------------------------------------------- per-frame */

  let revealAccum = 0
  const update = (dt: number): void => {
    net?.update(dt)
    if (!net) return
    pip.set(net.remoteCount())
    // Proximity profile reveal: throttled to ~3Hz; show the nearest un-revealed
    // real player's card when you get close.
    revealAccum += dt
    if (revealAccum < 0.33 || !proto || chat) return
    revealAccum = 0
    const me = opts.getLocalPos()
    const now = Date.now()
    let nearest: { playerId: string; d: number } | null = null
    for (const rp of net.remotePlayers()) {
      const d = Math.hypot(rp.x - me.x, rp.z - me.z)
      if (d > REVEAL_RADIUS) continue
      const last = recentlyRevealed.get(rp.playerId) ?? 0
      if (now - last < REVEAL_COOLDOWN_MS) continue
      if (!nearest || d < nearest.d) nearest = { playerId: rp.playerId, d }
    }
    if (nearest) {
      recentlyRevealed.set(nearest.playerId, now)
      requestAndShow(nearest.playerId, t("mp.you"))
    }
  }

  return {
    update,
    status: () => net?.status() ?? "offline",
    tradeTransport: () => trade,
    dispose: () => {
      pip.dispose()
      chat?.panel.close()
      chat = null
      unbindRoom()
      mediator.dispose()
      net?.dispose()
      net = null
    },
  }
}
