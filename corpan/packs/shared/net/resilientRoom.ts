import { Client, type Room } from "colyseus.js"

/**
 * resilientRoom — a reusable, transport-only Colyseus connection that survives
 * drops.
 *
 * Mobile WebViews suspend JS (and reclaim the socket) within seconds of
 * backgrounding, so a chat connection MUST reconnect-and-resync rather than try
 * to stay open. This module owns exactly that lifecycle and nothing else:
 *
 *   - a persistent `reconnectionToken` so a quick drop rejoins the SAME seat,
 *   - exponential backoff between attempts,
 *   - a rejoin window after which we stop trying to reconnect and fresh-join,
 *   - `online` / `focus` / `visibilitychange` wakers so returning to the app
 *     reconnects immediately instead of waiting out the backoff.
 *
 * It is deliberately decoupled from any domain (no schema/avatar/movement code):
 * it hands the freshly (re)joined `Room` to `onRoom` and signals `onRoomLost`
 * when the current room drops, so each consumer binds its own handlers. This is
 * the proven core extracted from corpan-city's netClient; Teletron consumes it
 * directly, and netClient can converge onto it later.
 *
 * Best-effort by construction: if the server is unreachable it degrades to
 * `offline` and keeps retrying; it never throws to the caller.
 */

export type ConnStatus = "offline" | "connecting" | "online" | "reconnecting"

/**
 * The two ways we obtain a room. Pulled behind an interface so tests can drive
 * the lifecycle with a fake room and no real socket.
 */
export interface RoomTransport {
  join: () => Promise<Room>
  reconnect: (token: string) => Promise<Room>
}

export interface ResilientRoomOptions {
  /** websocket endpoint, e.g. "wss://host". Ignored when `transport` is given. */
  url?: string
  /** logical room name registered on the server (default "plaza"). */
  roomName?: string
  /** options sent with joinOrCreate (identity, etc.). */
  joinOptions?: Record<string, unknown>
  /** override the connector (tests). Defaults to a colyseus.js Client. */
  transport?: RoomTransport
  /** Called with each freshly (re)joined room. Bind your handlers here. */
  onRoom: (room: Room) => void
  /** Called when the current room is lost so handlers can detach. */
  onRoomLost?: () => void
  /** Surface connection-state changes (for a status pill). */
  onStatus?: (status: ConnStatus) => void
  /** how long after a drop we keep trying to REJOIN the seat before fresh-join. */
  rejoinWindowMs?: number
  /** backoff schedule between reconnect attempts (ms). */
  reconnectDelaysMs?: readonly number[]
  /** test seams */
  now?: () => number
  scheduleTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void
  /** bind window online/focus/visibility wakers (default true; false in tests). */
  bindWindowWakers?: boolean
}

export interface ResilientRoom {
  /** current connection status. */
  status: () => ConnStatus
  /** the live room, or null while offline/reconnecting. */
  current: () => Room | null
  /** force an immediate reconnect attempt (e.g. on app resume). */
  wake: () => void
  /** leave the room and stop reconnecting. */
  dispose: () => void
}

const DEFAULT_REJOIN_AFTER_MS = 95_000
const DEFAULT_RECONNECT_DELAYS_MS = [250, 750, 1500, 3000, 5000, 8000, 10000]

function defaultTransport(
  url: string,
  roomName: string,
  joinOptions: Record<string, unknown>,
): RoomTransport {
  const client = new Client(url)
  return {
    join: () => client.joinOrCreate(roomName, joinOptions),
    reconnect: (token) => client.reconnect(token),
  }
}

export function createResilientRoom(opts: ResilientRoomOptions): ResilientRoom {
  const transport =
    opts.transport ??
    defaultTransport(opts.url ?? "", opts.roomName ?? "plaza", opts.joinOptions ?? {})
  const now = opts.now ?? (() => Date.now())
  const scheduleTimer = opts.scheduleTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h))
  const bindWakers = opts.bindWindowWakers ?? true
  const REJOIN_AFTER_MS = opts.rejoinWindowMs ?? DEFAULT_REJOIN_AFTER_MS
  const RECONNECT_DELAYS_MS = opts.reconnectDelaysMs ?? DEFAULT_RECONNECT_DELAYS_MS

  let room: Room | null = null
  let disposed = false
  let reconnectToken = ""
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnecting = false
  let reconnectAttempt = 0
  let lostAtMs = 0
  let status: ConnStatus = "offline"

  const setStatus = (s: ConnStatus) => {
    if (s === status) return
    status = s
    try {
      opts.onStatus?.(s)
    } catch (e) {
      console.error("[resilientRoom] onStatus handler threw:", e)
    }
  }

  const clearReconnectTimer = () => {
    if (!reconnectTimer) return
    clearTimer(reconnectTimer)
    reconnectTimer = null
  }

  const scheduleReconnect = (delayMs?: number) => {
    if (disposed || room || reconnecting || reconnectTimer) return
    const delay =
      delayMs ?? RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
    reconnectTimer = scheduleTimer(() => {
      reconnectTimer = null
      void connect()
    }, delay)
  }

  const shouldFreshJoinAfterReconnectError = (error: unknown): boolean => {
    const msg = String((error as Error)?.message ?? error ?? "").toLowerCase()
    return (
      !reconnectToken ||
      now() - lostAtMs > REJOIN_AFTER_MS ||
      /expired|invalid|disposed|not found|seat|reconnection/.test(msg)
    )
  }

  const bindJoinedRoom = (joined: Room) => {
    if (disposed) {
      void joined.leave()
      return
    }
    clearReconnectTimer()
    reconnecting = false
    reconnectAttempt = 0
    reconnectToken = joined.reconnectionToken || reconnectToken
    room = joined
    setStatus("online")

    try {
      opts.onRoom(joined)
    } catch (e) {
      console.error("[resilientRoom] onRoom handler threw:", e)
    }

    joined.onError((code: number, message?: string) => {
      console.warn(`[resilientRoom] room error ${code}:`, message)
    })
    joined.onLeave((code: number) => {
      if (room !== joined) return
      room = null
      if (disposed) return
      lostAtMs = now()
      try {
        opts.onRoomLost?.()
      } catch (e) {
        console.error("[resilientRoom] onRoomLost handler threw:", e)
      }
      if (disposed) return
      // code 1000 = a clean, consented close; anything else is a drop to retry.
      setStatus(code === 1000 ? "offline" : "reconnecting")
      if (code !== 1000) scheduleReconnect(0)
    })
  }

  // ---- connect/reconnect (best-effort; degrade visibly while retrying) ----
  async function connect(): Promise<void> {
    if (disposed || room || reconnecting) return
    reconnecting = true
    setStatus(reconnectToken ? "reconnecting" : "connecting")
    try {
      if (reconnectToken) {
        try {
          bindJoinedRoom(await transport.reconnect(reconnectToken))
          return
        } catch (err) {
          console.warn("[resilientRoom] reconnect failed:", (err as Error)?.message ?? err)
          if (!shouldFreshJoinAfterReconnectError(err)) throw err
          reconnectToken = ""
        }
      }
      bindJoinedRoom(await transport.join())
    } catch (err) {
      console.warn("[resilientRoom] presence unavailable, retrying:", (err as Error)?.message ?? err)
      room = null
      reconnecting = false
      reconnectAttempt += 1
      setStatus(reconnectToken ? "reconnecting" : "offline")
      scheduleReconnect()
    }
  }

  const wake = () => {
    if (disposed || room) return
    scheduleReconnect(0)
  }
  const onVisibility = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") wake()
  }
  if (bindWakers && typeof window !== "undefined") {
    window.addEventListener("online", wake)
    window.addEventListener("focus", wake)
  }
  if (bindWakers && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility)
  }

  void connect()

  return {
    status: () => status,
    current: () => room,
    wake,
    dispose: () => {
      if (disposed) return
      disposed = true
      clearReconnectTimer()
      if (bindWakers && typeof window !== "undefined") {
        window.removeEventListener("online", wake)
        window.removeEventListener("focus", wake)
      }
      if (bindWakers && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility)
      }
      const leaving = room
      room = null
      try {
        void leaving?.leave(true)
      } catch (e) {
        console.warn("[resilientRoom] leave on dispose failed:", e)
      }
      setStatus("offline")
    },
  }
}
