import { Client, getStateCallbacks, type Room } from "colyseus.js"
import type { Scene as BabylonScene } from "@babylonjs/core/scene"
import type { AvatarSpec, RoomTopology, MovementUpdate } from "@corpan-city/contracts"
import { createRemoteAvatar, type RemoteAvatar } from "./remoteAvatar"
import { type WardrobeTheme } from "../character/characterGen"

/**
 * netClient — the client-side presence layer (PREMIUM_FOUNDATIONS §8, M1).
 *
 * Connects to the authoritative Colyseus `plaza` room, broadcasts the LOCAL
 * player's movement ~10Hz, and renders every OTHER player as a grounded
 * paper-doll cutout in our scene — interpolated so motion is smooth. It OWNS the
 * remote avatar meshes (creates on join, disposes on leave/teardown).
 *
 * Best-effort by construction: if the server is down, the connection silently
 * degrades and the world keeps running solo. Presence NEVER crashes the game.
 *
 * AI-mediated chat stays outside this movement hot path. The sender's local
 * model cleans a message before `chat-send`; the server routes a trusted sender
 * and recipient; the recipient's local model cleans again, translates, and
 * surfaces a learning artifact.
 */

export interface NetIdentity {
  playerId: string
  name: string
  avatar: AvatarSpec
  sceneId?: string
  questId?: string
}

export interface NetClientOptions {
  /** websocket endpoint, e.g. "ws://localhost:2567". */
  url: string
  /** logical room name registered on the server (default "plaza"). */
  room?: string
  /** the local player's identity (name + avatar broadcast to others). */
  identity: NetIdentity
  /** the active room topology (shared collision space). */
  topology: RoomTopology
  /** the local Babylon scene remote avatars render into. */
  scene: BabylonScene
  /** wardrobe theme of the local scene (re-skin remote avatars into our world). */
  theme?: WardrobeTheme
  /** live local player position (predicted) — polled to broadcast movement. */
  getLocalPos: () => { x: number; z: number; facing?: number }
  /** movement broadcast rate in Hz (default 10). */
  sendHz?: number
  /** called when a remote avatar is first seen (optional observability hook). */
  onRemoteAdd?: (playerId: string) => void
  /** called when a remote avatar leaves. */
  onRemoteRemove?: (playerId: string) => void
  /** surface connection state changes (for an optional "online" pip). */
  onStatus?: (status: NetStatus) => void
  /**
   * Called once the room is joined (and again after a reconnect). Hands the
   * interaction layer (src/multiplayer) a tiny messaging surface on the SAME
   * room used for movement — so profile/chat/challenge/trade messages ride the
   * one connection (per this file's header). Best-effort: never called when
   * offline; the game runs solo.
   */
  onRoom?: (room: NetRoom) => void
  /** Called when the room is lost (leave/reconnect drop) so the interaction
   *  layer can detach its listeners. */
  onRoomLost?: () => void
}

/**
 * The minimal, typed messaging surface the interaction layer consumes — a thin
 * façade over the Colyseus room so `src/multiplayer` never imports colyseus.js
 * directly. `send` posts a typed message; `onMessage` subscribes (returns an
 * unsubscribe); `localPlayerId`/`localSessionId` identify us on the wire.
 */
export interface NetRoom {
  send: (type: string, payload: unknown) => void
  onMessage: (type: string, cb: (payload: unknown) => void) => () => void
  localSessionId: string
  localPlayerId: string
}

export type NetStatus = "offline" | "connecting" | "online" | "reconnecting"

export interface NetClient {
  /** call each frame: drives movement broadcast + remote interpolation. */
  update: (dt: number) => void
  status: () => NetStatus
  /** number of remote players currently rendered. */
  remoteCount: () => number
  /** TEST/inspection: snapshot of remote avatar positions. */
  remotePositions: () => Array<{ id: string; x: number; z: number }>
  /**
   * Remote players with their DURABLE playerId + interpolated position — the
   * interaction layer uses this to find the nearest real human to reveal/invite.
   */
  remotePlayers: () => Array<{ sessionId: string; playerId: string; x: number; z: number }>
  dispose: () => void
}

/** Minimal mirror of the server PlayerState leaf fields we read off the wire. */
interface WirePlayer {
  playerId: string
  name: string
  avatar: string // JSON AvatarSpec
  x: number
  z: number
  facing: number
  sceneId: string
  questId: string
  t: number
}

export function createNetClient(opts: NetClientOptions): NetClient {
  const sendHz = opts.sendHz ?? 10
  const sendInterval = 1 / sendHz
  let status: NetStatus = "offline"
  const setStatus = (s: NetStatus) => {
    if (s === status) return
    status = s
    opts.onStatus?.(s)
  }

  // Remote avatars we OWN, keyed by sessionId (the schema map key).
  const remotes = new Map<string, RemoteAvatar>()
  // sessionId → durable playerId, so the interaction layer can address a nearby
  // remote avatar by its PlayerId (profile request / invite / trade).
  const remoteIds = new Map<string, string>()
  let room: Room | null = null
  let disposed = false
  let seq = 0
  let sendAccum = 0
  // monotonic render clock (ms) used for both send timestamps + interpolation.
  let clockMs = 0

  /** Parse a wire avatar JSON safely; fall back to an empty spec. */
  const parseAvatar = (json: string): AvatarSpec => {
    try {
      const v = JSON.parse(json)
      if (v && typeof v === "object" && Array.isArray(v.layers)) return v as AvatarSpec
    } catch {
      /* fall through */
    }
    return { base: "paper-doll-a", layers: [] }
  }

  const addRemote = (sessionId: string, p: WirePlayer) => {
    if (remotes.has(sessionId)) return
    const avatar = parseAvatar(p.avatar)
    const ra = createRemoteAvatar(opts.scene, {
      avatar,
      playerId: p.playerId || sessionId,
      theme: opts.theme,
    })
    ra.stamp(clockMs)
    ra.setTarget(p.x, p.z, p.facing)
    remotes.set(sessionId, ra)
    remoteIds.set(sessionId, p.playerId || sessionId)
    opts.onRemoteAdd?.(p.playerId || sessionId)
  }

  const removeRemote = (sessionId: string) => {
    const ra = remotes.get(sessionId)
    if (!ra) return
    ra.dispose()
    remotes.delete(sessionId)
    remoteIds.delete(sessionId)
    opts.onRemoteRemove?.(sessionId)
  }

  // ---- connect (best-effort; degrade silently on any failure) ----
  const connect = async () => {
    setStatus("connecting")
    try {
      const client = new Client(opts.url)
      const joinOpts = {
        playerId: opts.identity.playerId,
        name: opts.identity.name,
        avatar: opts.identity.avatar,
        sceneId: opts.identity.sceneId ?? "",
        questId: opts.identity.questId ?? "",
      }
      const joined = await client.joinOrCreate(opts.room ?? "plaza", joinOpts)
      if (disposed) {
        // teardown raced the join — leave immediately.
        void joined.leave()
        return
      }
      room = joined
      setStatus("online")

      // Hand the interaction layer a typed messaging façade over THIS room.
      if (opts.onRoom) {
        try {
          opts.onRoom({
            send: (type, payload) => {
              try {
                joined.send(type, payload)
              } catch (e) {
                console.warn(`[net] send("${type}") failed:`, (e as Error)?.message ?? e)
              }
            },
            onMessage: (type, cb) => joined.onMessage(type, cb as (m: unknown) => void),
            localSessionId: joined.sessionId,
            localPlayerId: opts.identity.playerId,
          })
        } catch (e) {
          console.error("[net] onRoom handler threw:", e)
        }
      }

      // Schema callbacks (colyseus.js v0.16 / schema v3): react to the players
      // map. The decoded state is reflection-typed, so we narrow the callback
      // proxy to our own minimal shapes (the wire fields the server defines).
      const $ = getStateCallbacks(joined) as unknown as (
        target: unknown,
      ) => { players: PlayersCallbacks } & PlayerListener
      const players = $(joined.state).players

      players.onAdd((player: WirePlayer, sessionId: string) => {
        // Skip our OWN entry — we render the local player ourselves.
        if (sessionId === joined.sessionId) return
        addRemote(sessionId, player)
        // Listen for authoritative position deltas on this player.
        const $$ = $(player)
        const onMove = () => {
          const ra = remotes.get(sessionId)
          if (!ra) return
          ra.stamp(clockMs)
          ra.setTarget(player.x, player.z, player.facing)
        }
        $$.listen("x", onMove)
        $$.listen("z", onMove)
        $$.listen("facing", onMove)
      })

      players.onRemove((_player: WirePlayer, sessionId: string) => {
        removeRemote(sessionId)
      })

      joined.onError((code: number, message?: string) => {
        console.warn(`[net] room error ${code}:`, message)
      })
      joined.onLeave((code: number) => {
        // Non-consented leave → the framework's reconnection may recover; mark
        // reconnecting. We don't auto-rejoin here (M1) — the world runs solo.
        setStatus(code === 1000 ? "offline" : "reconnecting")
        room = null
        for (const id of [...remotes.keys()]) removeRemote(id)
        try {
          opts.onRoomLost?.()
        } catch (e) {
          console.error("[net] onRoomLost handler threw:", e)
        }
      })
    } catch (err) {
      // No server / refused / timeout → degrade to solo. Visible, not silent.
      console.warn("[net] presence unavailable, running solo:", (err as Error)?.message ?? err)
      setStatus("offline")
      room = null
    }
  }
  void connect()

  const update = (dt: number) => {
    clockMs += dt * 1000

    // 1) Broadcast local movement at sendHz (only while online).
    if (room && status === "online") {
      sendAccum += dt
      if (sendAccum >= sendInterval) {
        sendAccum = 0
        const lp = opts.getLocalPos()
        const mv: MovementUpdate = {
          seq: seq++,
          pos: { x: lp.x, z: lp.z, facing: lp.facing ?? 0 },
          t: clockMs,
        }
        try {
          room.send("move", mv)
        } catch {
          /* transient send failure; next tick retries */
        }
      }
    }

    // 2) Advance every remote avatar's interpolation + animation.
    for (const ra of remotes.values()) ra.update(dt, clockMs)
  }

  return {
    update,
    status: () => status,
    remoteCount: () => remotes.size,
    remotePositions: () =>
      [...remotes.entries()].map(([id, ra]) => ({ id, ...ra.getPos() })),
    remotePlayers: () =>
      [...remotes.entries()].map(([sessionId, ra]) => ({
        sessionId,
        playerId: remoteIds.get(sessionId) ?? sessionId,
        ...ra.getPos(),
      })),
    dispose: () => {
      disposed = true
      for (const id of [...remotes.keys()]) removeRemote(id)
      if (room) {
        try {
          void room.leave(true)
        } catch {
          /* ignore */
        }
        room = null
      }
      setStatus("offline")
    },
  }
}

/* ---- narrow callback-proxy shapes (colyseus.js v3 getStateCallbacks) ---- */

interface PlayersCallbacks {
  onAdd: (cb: (player: WirePlayer, key: string) => void) => () => void
  onRemove: (cb: (player: WirePlayer, key: string) => void) => () => void
}
interface PlayerListener {
  listen: (field: string, cb: (value: unknown) => void) => () => void
}
