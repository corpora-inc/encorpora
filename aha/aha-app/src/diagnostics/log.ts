/** Bounded, scrubbed diagnostics log for problem reports.
 * Holds app-authored events and error messages only — never learner answers,
 * names, account ids, tokens or receipts. Everything is scrubbed on the way in
 * and again on reload, because stored entries are untrusted input. */
export type LogLevel = 'error' | 'warn' | 'info'
export interface LogEntry { t: string; level: LogLevel; source: string; message: string }
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }
type StorageOption = StorageLike | null | (() => StorageLike | null)

export const LOG_CAPACITY = 200
const STORAGE_KEY = 'aha-diagnostics-log'
const MAX_MESSAGE = 400
const MAX_SOURCE = 24
const LEVELS: readonly LogLevel[] = ['error', 'warn', 'info']

const SECRET_WORDS = /\b(token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|key|secret|password|passcode|authorization|receipt|code|state|subject|sub|account[_-]?id|user[_-]?id|email)\b(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&)}\]]+)/gi
/** Remove anything that could identify a person or unlock an account. */
export function scrub(text: string): string {
  return text
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1?[redacted]')
    .replace(/eyJ[\w-]*\.[\w-]+\.[\w-]*/g, '[token]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b(bearer|basic)\s+[^\s,;]+/gi, '$1 [redacted]')
    .replace(SECRET_WORDS, (_match, word: string, separator: string) => `${word}${separator}[redacted]`)
    // Long opaque runs mixing letters and digits: keys, hashes, receipts, ids.
    .replace(/[A-Za-z0-9+_=-]{20,}/g, run => /[0-9]/.test(run) && /[A-Za-z]/.test(run) ? '[redacted]' : run)
}

function clean(text: string, max: number): string {
  const flat = scrub(text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim())
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}
function tag(source: string): string {
  return source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_SOURCE) || 'app'
}
/** Error text without stack traces; carries a stable classification code when present. */
export function describeError(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error || (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string')) {
    const e = error as { name?: unknown; message: string; code?: unknown }
    const name = typeof e.name === 'string' && e.name ? e.name : 'Error'
    const code = typeof e.code === 'string' && /^[\w.-]{1,48}$/.test(e.code) ? ` [${e.code}]` : ''
    return `${name}${code}: ${e.message}`
  }
  return 'Unknown error'
}

export class DiagnosticsLog {
  readonly capacity: number
  persistent = false
  private items: LogEntry[] = []
  private readonly storage: StorageLike | null
  private readonly now: () => Date
  private readonly echo: boolean
  constructor(options: { capacity?: number; storage?: StorageOption; now?: () => Date; echo?: boolean } = {}) {
    this.capacity = Math.max(1, options.capacity ?? LOG_CAPACITY)
    this.now = options.now ?? (() => new Date())
    this.echo = options.echo ?? true
    let storage: StorageLike | null = null
    try { storage = typeof options.storage === 'function' ? options.storage() : options.storage ?? null } catch { storage = null }
    this.storage = storage
    if (!storage) return
    try {
      const raw = storage.getItem(STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      this.items = (Array.isArray(parsed) ? parsed : []).flatMap(valid).slice(-this.capacity)
      this.persistent = true
    } catch { this.items = []; this.persistent = false }
  }
  add(level: LogLevel, source: string, message: string): void {
    const entry: LogEntry = { t: this.now().toISOString(), level, source: tag(source), message: clean(message, MAX_MESSAGE) || '(no message)' }
    this.items.push(entry)
    if (this.items.length > this.capacity) this.items.splice(0, this.items.length - this.capacity)
    if (this.echo && level !== 'info') console.warn(`[aha:${entry.source}] ${entry.message}`)
    this.save()
  }
  error(source: string, error: unknown): void { this.add('error', source, describeError(error)) }
  /** Oldest first; `limit` keeps only the newest entries. */
  entries(limit = this.capacity): LogEntry[] { return this.items.slice(-Math.max(0, limit)).map(e => ({ ...e })) }
  private save(): void {
    if (!this.storage) return
    try { this.storage.setItem(STORAGE_KEY, JSON.stringify(this.items)); this.persistent = true }
    catch { this.persistent = false }
  }
}
function valid(value: unknown): LogEntry[] {
  if (typeof value !== 'object' || value === null) return []
  const v = value as Record<string, unknown>
  if (typeof v.t !== 'string' || !LEVELS.includes(v.level as LogLevel) || typeof v.source !== 'string' || typeof v.message !== 'string') return []
  return [{ t: clean(v.t, 40), level: v.level as LogLevel, source: tag(v.source), message: clean(v.message, MAX_MESSAGE) }]
}

/** Record uncaught errors and unhandled promise rejections without replacing other handlers. */
export function installGlobalHandlers(log: DiagnosticsLog, target: EventTarget): void {
  target.addEventListener('error', event => {
    const e = event as ErrorEvent
    log.error('window', e.error ?? e.message)
  })
  target.addEventListener('unhandledrejection', event => log.error('promise', (event as PromiseRejectionEvent).reason))
}

/** The app-wide log. Browser storage holds only this scrubbed diagnostics buffer, never learning data. */
export const diagnostics = new DiagnosticsLog({
  storage: () => typeof localStorage === 'undefined' ? null : localStorage,
})
export function logError(source: string, error: unknown): void { diagnostics.error(source, error) }
export function logEvent(level: LogLevel, source: string, message: string): void { diagnostics.add(level, source, message) }
