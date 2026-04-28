// Anonymous reader analytics — privacy-first, fire-and-forget.
//
// Contract (any caller can rely on these without checking):
//   - No method throws. Every public entry is wrapped in try/catch and
//     swallows everything. Failure is invisible to the reader.
//   - No persistent identifier. session_id is generated on init() and lives
//     in memory only — gone when the page goes away.
//   - Opt-out is one localStorage flag away. When set, no network ever happens.
//   - Offline-first. Events accumulate in memory + a small localStorage
//     spillover queue. Flushes happen on a timer, on pagehide via sendBeacon,
//     and opportunistically when new events arrive over a threshold.
//
// To wire a new reader: call init({ readerId, readerVersion, endpoint }) once
// at mount time, then call bookOpened/bookClosed/etc. at the natural moments.

const OPT_OUT_KEY = "corpan-analytics-disabled"
const SPILLOVER_KEY = "corpan-analytics-queue"
const SCHEMA_VERSION = 1
const FLUSH_INTERVAL_MS = 30_000
const FLUSH_BATCH_SIZE = 50
const MAX_QUEUE = 500
const HEARTBEAT_MS = 30_000

type Platform = "ios" | "android" | "web" | "macos" | "windows" | "linux" | "unknown"
type EventName =
  | "book_open"
  | "book_close"
  | "book_heartbeat"
  | "language_switch"
  | "session_start"

type AnalyticsEvent = {
  schema: number
  ts: string
  session_id: string
  event: EventName
  reader_id: string
  reader_version: string
  app_version: string
  platform: Platform
  locale: string
  tz_offset_minutes: number
  book_id?: string
  narration_pack_id?: string
  language?: string
  voice_id?: string
  duration_ms?: number
}

type Config = {
  readerId: string
  readerVersion: string
  endpoint: string
  appVersion?: string
  enabled: boolean
}

type State = {
  config: Config | null
  sessionId: string
  queue: AnalyticsEvent[]
  flushTimer: ReturnType<typeof setInterval> | null
  heartbeatTimer: ReturnType<typeof setInterval> | null
  heartbeatCtx: { bookId: string; narrationPackId: string; language: string; voiceId: string } | null
  bookOpenAt: number | null
  bookOpenCtx: { bookId: string; narrationPackId: string; language: string; voiceId: string } | null
  flushing: boolean
}

const state: State = {
  config: null,
  sessionId: "",
  queue: [],
  flushTimer: null,
  heartbeatTimer: null,
  heartbeatCtx: null,
  bookOpenAt: null,
  bookOpenCtx: null,
  flushing: false,
}

function safe<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}

function isOptedOut(): boolean {
  return safe(() => localStorage.getItem(OPT_OUT_KEY) === "1") ?? false
}

function uuid(): string {
  return (
    safe(() => crypto.randomUUID()) ??
    `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  )
}

function detectPlatform(): Platform {
  return (
    safe(() => {
      const ua = (navigator.userAgent || "").toLowerCase()
      const hasTauri =
        typeof (globalThis as { __TAURI__?: unknown }).__TAURI__ !== "undefined" ||
        typeof (globalThis as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== "undefined"
      if (/iphone|ipad|ipod/.test(ua)) return "ios"
      if (/android/.test(ua)) return "android"
      if (/macintosh|mac os x/.test(ua)) return hasTauri ? "macos" : "web"
      if (/windows/.test(ua)) return hasTauri ? "windows" : "web"
      if (/linux/.test(ua)) return hasTauri ? "linux" : "web"
      return "web" as const
    }) ?? "unknown"
  )
}

function readSpillover(): AnalyticsEvent[] {
  return (
    safe(() => {
      const raw = localStorage.getItem(SPILLOVER_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as AnalyticsEvent[]) : []
    }) ?? []
  )
}

function writeSpillover(events: AnalyticsEvent[]): void {
  safe(() => {
    if (events.length === 0) {
      localStorage.removeItem(SPILLOVER_KEY)
    } else {
      localStorage.setItem(SPILLOVER_KEY, JSON.stringify(events.slice(-MAX_QUEUE)))
    }
  })
}

function envelope(): Pick<
  AnalyticsEvent,
  "schema" | "ts" | "session_id" | "reader_id" | "reader_version" | "app_version" | "platform" | "locale" | "tz_offset_minutes"
> | null {
  const cfg = state.config
  if (!cfg) return null
  return {
    schema: SCHEMA_VERSION,
    ts: new Date().toISOString(),
    session_id: state.sessionId,
    reader_id: cfg.readerId,
    reader_version: cfg.readerVersion,
    app_version: cfg.appVersion || "",
    platform: detectPlatform(),
    locale: safe(() => navigator.language) ?? "",
    tz_offset_minutes: safe(() => -new Date().getTimezoneOffset()) ?? 0,
  }
}

function enqueue(event: EventName, body: Partial<AnalyticsEvent>): void {
  const cfg = state.config
  if (!cfg || !cfg.enabled) return
  if (isOptedOut()) return
  const env = envelope()
  if (!env) return
  state.queue.push({ ...env, ...body, event } as AnalyticsEvent)
  if (state.queue.length > MAX_QUEUE) {
    state.queue.splice(0, state.queue.length - MAX_QUEUE)
  }
  if (state.queue.length >= FLUSH_BATCH_SIZE) void flush()
}

function buildPayload(events: AnalyticsEvent[]): string {
  return JSON.stringify({ events })
}

function sendBeacon(payload: string): boolean {
  return (
    safe(() => {
      const cfg = state.config
      if (!cfg) return false
      if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
        return false
      }
      const blob = new Blob([payload], { type: "application/json" })
      return navigator.sendBeacon(cfg.endpoint, blob)
    }) ?? false
  )
}

async function sendFetch(payload: string): Promise<boolean> {
  return (
    (await safe(async () => {
      const cfg = state.config
      if (!cfg) return false
      const res = await fetch(cfg.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
        credentials: "omit",
        mode: "cors",
      })
      return res.ok || res.status === 204
    })) ?? false
  )
}

async function flush(useBeacon = false): Promise<void> {
  if (state.flushing) return
  if (!state.config || !state.config.enabled) return
  if (isOptedOut()) {
    state.queue = []
    writeSpillover([])
    return
  }

  // Pull both in-memory and spilled-over events
  const spilled = readSpillover()
  const all = spilled.concat(state.queue)
  if (all.length === 0) return

  state.flushing = true
  state.queue = []
  writeSpillover([])

  const batch = all.slice(0, FLUSH_BATCH_SIZE)
  const remaining = all.slice(FLUSH_BATCH_SIZE)

  const payload = buildPayload(batch)
  const ok = useBeacon ? sendBeacon(payload) : await sendFetch(payload)

  if (!ok) {
    // Restore everything to spillover so we try again next tick
    writeSpillover(all)
  } else if (remaining.length > 0) {
    writeSpillover(remaining)
  }

  state.flushing = false
}

export type AnalyticsInitOptions = {
  readerId: "stargate" | "earthgate" | string
  readerVersion: string
  endpoint: string
  appVersion?: string
  /** Override default enabled=true. Use to gate behind a build flag. */
  enabled?: boolean
}

export function init(opts: AnalyticsInitOptions): void {
  safe(() => {
    if (state.config) return // idempotent
    state.config = {
      readerId: opts.readerId,
      readerVersion: opts.readerVersion,
      endpoint: opts.endpoint,
      appVersion: opts.appVersion,
      enabled: opts.enabled !== false,
    }
    state.sessionId = uuid()

    if (typeof window !== "undefined") {
      // Ship in-flight events on page hide. sendBeacon survives unload.
      window.addEventListener("pagehide", () => {
        if (state.bookOpenAt && state.bookOpenCtx) {
          // Synthesize a final close event so duration is captured.
          const dur = Date.now() - state.bookOpenAt
          enqueue("book_close", { ...state.bookOpenCtx, duration_ms: dur })
          state.bookOpenAt = null
          state.bookOpenCtx = null
        }
        void flush(true)
      })

      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") void flush(true)
      })
    }

    state.flushTimer = setInterval(() => void flush(false), FLUSH_INTERVAL_MS)

    enqueue("session_start", {})
  })
}

export type BookContext = {
  bookId: string
  narrationPackId: string
  language: string
  voiceId: string
}

export function bookOpened(ctx: BookContext): void {
  safe(() => {
    // If a previous book is still open (rare, but possible if caller forgets),
    // close it first so durations are never lost.
    if (state.bookOpenAt && state.bookOpenCtx) {
      const dur = Date.now() - state.bookOpenAt
      enqueue("book_close", { ...state.bookOpenCtx, duration_ms: dur })
    }
    state.bookOpenAt = Date.now()
    state.bookOpenCtx = { ...ctx }
    state.heartbeatCtx = { ...ctx }
    enqueue("book_open", { ...ctx })

    if (state.heartbeatTimer) clearInterval(state.heartbeatTimer)
    state.heartbeatTimer = setInterval(() => {
      if (!state.heartbeatCtx) return
      enqueue("book_heartbeat", { ...state.heartbeatCtx })
    }, HEARTBEAT_MS)
  })
}

export function bookClosed(): void {
  safe(() => {
    if (!state.bookOpenAt || !state.bookOpenCtx) return
    const dur = Date.now() - state.bookOpenAt
    enqueue("book_close", { ...state.bookOpenCtx, duration_ms: dur })
    state.bookOpenAt = null
    state.bookOpenCtx = null
    state.heartbeatCtx = null
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer)
      state.heartbeatTimer = null
    }
  })
}

export function languageSwitched(ctx: BookContext & { from: string; to: string }): void {
  safe(() => {
    enqueue("language_switch", {
      book_id: ctx.bookId,
      narration_pack_id: ctx.narrationPackId,
      language: ctx.to,
      voice_id: ctx.voiceId,
    })
  })
}

/** Stop all timers and flush. Call from reader teardown if you want. */
export function shutdown(): void {
  safe(() => {
    if (state.bookOpenAt && state.bookOpenCtx) {
      const dur = Date.now() - state.bookOpenAt
      enqueue("book_close", { ...state.bookOpenCtx, duration_ms: dur })
      state.bookOpenAt = null
      state.bookOpenCtx = null
    }
    if (state.flushTimer) {
      clearInterval(state.flushTimer)
      state.flushTimer = null
    }
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer)
      state.heartbeatTimer = null
    }
    void flush(true)
  })
}

/** Read or write the local opt-out flag. UI surface for the Settings toggle. */
export function getOptOut(): boolean {
  return isOptedOut()
}

export function setOptOut(disabled: boolean): void {
  safe(() => {
    if (disabled) {
      localStorage.setItem(OPT_OUT_KEY, "1")
      state.queue = []
      writeSpillover([])
    } else {
      localStorage.removeItem(OPT_OUT_KEY)
    }
  })
}
