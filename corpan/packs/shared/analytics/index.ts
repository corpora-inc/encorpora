// Anonymous reader analytics — privacy-first, fire-and-forget, scales by design.
//
// Contract every caller can rely on:
//   - No method throws. Every public entry is wrapped in try/catch and
//     swallows everything. Failure is invisible to the reader.
//   - No persistent identifier. session_id is generated on init() and lives
//     in memory only — gone when the page goes away.
//   - Opt-out is one localStorage flag away. When set, no network ever
//     happens and an in-flight flush aborts before sending.
//   - Offline-first. Events accumulate in memory + a small localStorage
//     spillover queue. Flushes happen on a timer, on pagehide via sendBeacon,
//     and opportunistically when new events accumulate over a threshold.
//   - Tauri WKWebView compatible. Cross-origin POST from a custom URI scheme
//     (`corpan-pack://localhost/...`) sends `Origin: null`; the backend
//     handles that. We don't include credentials, don't ask for cookies.
//
// Ergonomics for new code:
//   - Want a one-off event? `analytics.track("chapter_completed", {chapter: 7})`.
//   - Want lifecycle for books? Use `bookOpened` / `bookClosed` — they manage
//     duration tracking + a heartbeat for you and call track() under the hood.
//   - Want to add a new built-in lifecycle? Define a wrapper that calls track().
//     No envelope-builder edits, no schema gates, no Lambda redeploy.

const OPT_OUT_KEY = "corpan-analytics-disabled"
const SPILLOVER_KEY = "corpan-analytics-queue"
// Persists the last language seen per book, so we can emit `language_switch`
// when the user comes back in a new session and opens the same book in a
// different language (the most common comparison flow). Living next to the
// other analytics localStorage keys keeps cleanup obvious.
const LAST_LANG_BY_BOOK_KEY = "corpan-analytics-last-lang-by-book"
const SCHEMA_VERSION = 1
const FLUSH_INTERVAL_MS = 30_000
const FLUSH_BATCH_SIZE = 50
const MAX_QUEUE = 500
const HEARTBEAT_MS = 30_000

type Platform = "ios" | "android" | "web" | "macos" | "windows" | "linux" | "unknown"

export type EventValue = string | number | boolean
export type EventProps = Record<string, EventValue>

// Built-in event names — wrappers below populate the well-known typed columns
// (book_id, language, duration_ms, etc.) on the Glue table directly. Anything
// else flows through `track()` and lands in `props_json` for ad-hoc analysis.
type BuiltinEventName =
  | "session_start"
  | "book_open"
  | "book_close"
  | "book_heartbeat"
  | "language_switch"

type AnalyticsEvent = {
  schema: number
  ts: string
  session_id: string
  event: string
  reader_id: string
  reader_version: string
  app_version: string
  platform: Platform
  locale: string
  tz_offset_minutes: number
  // Optional well-known columns — populated from props if present.
  book_id?: string
  narration_pack_id?: string
  language?: string
  voice_id?: string
  duration_ms?: number
  // Anything else from `track()` lives here, serialized server-side to props_json.
  props?: EventProps
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
  bookOpenAt: number | null
  bookOpenCtx: BookContext | null
  flushing: boolean
}

const state: State = {
  config: null,
  sessionId: "",
  queue: [],
  flushTimer: null,
  heartbeatTimer: null,
  bookOpenAt: null,
  bookOpenCtx: null,
  flushing: false,
}

// Top-level columns on the Glue table — anything here gets pulled out of props
// and promoted onto the event envelope. Everything else stays in props.
const TYPED_COLUMNS = new Set<string>([
  "book_id",
  "narration_pack_id",
  "language",
  "voice_id",
  "duration_ms",
])

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

function readLastLangByBook(): Record<string, string> {
  return (
    safe(() => {
      const raw = localStorage.getItem(LAST_LANG_BY_BOOK_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
      const out: Record<string, string> = {}
      for (const k of Object.keys(parsed)) {
        const v = (parsed as Record<string, unknown>)[k]
        if (typeof v === "string" && v.length > 0) out[k] = v
      }
      return out
    }) ?? {}
  )
}

function writeLastLangByBook(bookId: string, language: string): void {
  safe(() => {
    if (!bookId || !language) return
    const map = readLastLangByBook()
    if (map[bookId] === language) return
    map[bookId] = language
    localStorage.setItem(LAST_LANG_BY_BOOK_KEY, JSON.stringify(map))
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

// Sanitize a free-form props bag from `track()`: drop unsupported types,
// promote well-known columns onto the event, leave the rest in props.
function applyProps(ev: AnalyticsEvent, props: EventProps): void {
  for (const key of Object.keys(props)) {
    const v = props[key]
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") continue
    if (TYPED_COLUMNS.has(key)) {
      // Type-promote into the well-known column. The backend's sanitize() also
      // clamps these to size, so we can be permissive here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(ev as any)[key] = v
    } else {
      if (!ev.props) ev.props = {}
      ev.props[key] = v
    }
  }
}

function enqueue(eventName: string, props: EventProps): void {
  const cfg = state.config
  if (!cfg || !cfg.enabled) return
  if (isOptedOut()) return
  const env = envelope()
  if (!env) return

  const ev: AnalyticsEvent = { ...env, event: eventName }
  applyProps(ev, props)

  state.queue.push(ev)
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

  // Race-guard: the user might have flipped opt-out between the queue snapshot
  // and the network call. Re-check now and bail without sending.
  if (isOptedOut()) {
    state.flushing = false
    return
  }

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

// In a Tauri webview, the host app's version isn't passed into the reader pack
// (the reader is loaded as a downloadable script bundle, not part of the host
// React tree). Instead of plumbing it through the host shell — which would
// require a host rebuild — we self-fetch via the Tauri `app` plugin invoke.
// Web/dev builds (no Tauri internals) silently fall back to the empty string.
async function fetchAppVersionFromTauri(): Promise<string | null> {
  return (
    (await safe(async () => {
      const w = globalThis as {
        __TAURI_INTERNALS__?: {
          invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
        }
      }
      const invoke = w.__TAURI_INTERNALS__?.invoke
      if (!invoke) return null
      const v = await invoke("plugin:app|version")
      return typeof v === "string" ? v : null
    })) ?? null
  )
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

    // Backfill app_version from the Tauri host app if the caller didn't provide
    // one. Fire-and-forget — events emitted before this resolves will go out
    // with an empty app_version, which is fine.
    if (!state.config.appVersion) {
      void fetchAppVersionFromTauri().then((v) => {
        if (state.config && v) state.config.appVersion = v
      })
    }

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

    track("session_start")
  })
}

/**
 * Generic event tracker — the building block. Use this to add new event types
 * without modifying the analytics module.
 *
 *   analytics.track("chapter_completed", { chapter: 7, scroll_pct: 100 })
 *   analytics.track("download_failed", { reason: "network", retries: 3 })
 *
 * Constraints:
 *  - eventName must match `^[a-z][a-z0-9_]{0,63}$` (validated server-side).
 *  - prop values must be string | number | boolean (anything else is silently dropped).
 *  - Well-known prop keys (book_id, narration_pack_id, language, voice_id,
 *    duration_ms) are auto-promoted to typed Glue columns.
 *  - All other props are serialized to a single `props_json` Athena column.
 */
export function track(eventName: BuiltinEventName | string, props: EventProps = {}): void {
  safe(() => enqueue(eventName, props))
}

export type BookContext = {
  bookId: string
  narrationPackId: string
  language: string
  voiceId: string
}

function bookContextProps(ctx: BookContext): EventProps {
  return {
    book_id: ctx.bookId,
    narration_pack_id: ctx.narrationPackId,
    language: ctx.language,
    voice_id: ctx.voiceId,
  }
}

export function bookOpened(ctx: BookContext): void {
  safe(() => {
    // If a previous book is still open (rare, but possible if caller forgets),
    // close it first so durations are never lost.
    if (state.bookOpenAt && state.bookOpenCtx) {
      const dur = Date.now() - state.bookOpenAt
      track("book_close", { ...bookContextProps(state.bookOpenCtx), duration_ms: dur })
    }

    // Detect a language switch on the same book — both within-session (the
    // user just had this book open in another language) and across-session
    // (last time we saw this book, it was in another language). Emit the
    // `language_switch` event BEFORE `book_open` so the order in the table
    // reflects causality. We deliberately don't fire when the book is
    // different — that's a normal book_open, not a language switch.
    const lastLangMap = readLastLangByBook()
    const lastLang = lastLangMap[ctx.bookId]
    if (lastLang && lastLang !== ctx.language) {
      track("language_switch", {
        ...bookContextProps(ctx),
        previous_language: lastLang,
      })
    }
    writeLastLangByBook(ctx.bookId, ctx.language)

    state.bookOpenAt = Date.now()
    state.bookOpenCtx = { ...ctx }
    track("book_open", bookContextProps(ctx))

    if (state.heartbeatTimer) clearInterval(state.heartbeatTimer)
    state.heartbeatTimer = setInterval(() => {
      if (!state.bookOpenCtx) return
      track("book_heartbeat", bookContextProps(state.bookOpenCtx))
    }, HEARTBEAT_MS)
  })
}

export function bookClosed(): void {
  safe(() => {
    if (!state.bookOpenAt || !state.bookOpenCtx) return
    const dur = Date.now() - state.bookOpenAt
    track("book_close", { ...bookContextProps(state.bookOpenCtx), duration_ms: dur })
    state.bookOpenAt = null
    state.bookOpenCtx = null
    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer)
      state.heartbeatTimer = null
    }
  })
}

/** Stop all timers and flush. Call from reader teardown if you want. */
export function shutdown(): void {
  safe(() => {
    if (state.bookOpenAt && state.bookOpenCtx) {
      const dur = Date.now() - state.bookOpenAt
      track("book_close", { ...bookContextProps(state.bookOpenCtx), duration_ms: dur })
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
