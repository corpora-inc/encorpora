/**
 * musicProfile — the persisted home of the player's radio CHOICE.
 *
 * Owner directive (world-plaza-onboarding-music-consent): music must NEVER "come
 * out of nowhere". The player opts in (onboarding, or the Phone's Music app), and
 * that choice — on/off, which station, how loud — STICKS across restarts so the
 * world neither resets to a default blast nor forgets a deliberate "off".
 *
 * Storage tier: one tiny JSON object under a single localStorage key
 * (`wp:music:v1`), negligible footprint (the shared ~5MB budget memory). Mirrors
 * the immersion store's shape (read/write/subscribe).
 *
 * `enabled` defaults to FALSE: until the player has consented, nothing auto-plays.
 * `stationId` is the dial id (see `POC_STATIONS`); a missing/unknown id falls back
 * to the first station at the call site. `volume` is 0..1.
 */

const KEY = "wp:music:v1"

export interface MusicProfile {
  /** Has the player consented to music? FALSE until they opt in — never auto-blast. */
  enabled: boolean
  /** The chosen station id (matches a `POC_STATIONS` id), or null for "the default". */
  stationId: string | null
  /** User volume 0..1. */
  volume: number
}

export const DEFAULT_MUSIC_PROFILE: MusicProfile = {
  enabled: false,
  stationId: null,
  volume: 0.5,
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

/** Coerce stored JSON into a valid profile (defensive — never trust localStorage). */
function coerce(raw: unknown): MusicProfile {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_MUSIC_PROFILE }
  const o = raw as Partial<MusicProfile>
  return {
    enabled: o.enabled === true,
    stationId: typeof o.stationId === "string" ? o.stationId : null,
    volume: typeof o.volume === "number" && Number.isFinite(o.volume) ? clamp01(o.volume) : 0.5,
  }
}

export interface MusicProfileStore {
  /** The current persisted profile (defaults when unset/corrupt). */
  get(): MusicProfile
  /** Merge a patch in, persist, and notify subscribers. */
  set(patch: Partial<MusicProfile>): void
  /** Subscribe to changes. Returns an unsubscribe. */
  subscribe(fn: (p: MusicProfile) => void): () => void
}

export function createMusicProfileStore(): MusicProfileStore {
  const subs = new Set<(p: MusicProfile) => void>()

  const read = (): MusicProfile => {
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? coerce(JSON.parse(raw)) : { ...DEFAULT_MUSIC_PROFILE }
    } catch (err) {
      console.warn("[wp/music] could not read music profile:", err)
      return { ...DEFAULT_MUSIC_PROFILE }
    }
  }

  const write = (p: MusicProfile): void => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p))
    } catch (err) {
      console.warn("[wp/music] could not persist music profile:", err)
    }
  }

  return {
    get: read,
    set(patch) {
      const next = coerce({ ...read(), ...patch })
      write(next)
      for (const fn of subs) {
        try {
          fn(next)
        } catch (err) {
          console.error("[wp/music] subscriber threw:", err)
        }
      }
    },
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }
}

/** A shared store instance for the pack (onboarding + the Music app both use this). */
export const musicProfileStore: MusicProfileStore = createMusicProfileStore()
