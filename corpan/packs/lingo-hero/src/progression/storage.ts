/**
 * progression/storage.ts — Offline-first persistence for the progression layer.
 *
 * STREAM: gamification. There is NO storage method on HostApi today (see
 * src/sdk/types.ts). Per the foundation contract we persist to localStorage,
 * fully guarded by try/catch so private-mode / sandboxed / no-DOM hosts degrade
 * to in-memory cleanly. Everything offline; no network, no remote assets.
 *
 * State is scoped by the active stack id (from hostApi.getStackConfig()) so a
 * learner's XP/level/high-scores for a Spanish stack don't bleed into a Korean
 * one. Falls back to a shared key when no stack id is present.
 *
 * TODO(host-storage): If/when HostApi grows a durable key/value surface
 * (e.g. getItem/setItem bridged to native secure storage), route loadState /
 * saveState through it and keep localStorage as the web fallback. Single
 * choke-point here keeps that migration to one file.
 */

const SCHEMA_VERSION = 1;
const KEY_PREFIX = "lingo-hero:progression";

/** The durable, persisted slice of progression. */
export interface PersistedProgression {
  version: number;
  /** Lifetime XP (drives level). */
  xp: number;
  /** Best score ever, this stack. */
  highScore: number;
  /** Longest combo streak ever, this stack. */
  bestStreak: number;
  /** Total correct hits ever (lifetime stat). */
  lifetimeHits: number;
  /** Total runs completed. */
  runs: number;
}

export function emptyState(): PersistedProgression {
  return {
    version: SCHEMA_VERSION,
    xp: 0,
    highScore: 0,
    bestStreak: 0,
    lifetimeHits: 0,
    runs: 0,
  };
}

function storageKey(stackId: string | undefined): string {
  return `${KEY_PREFIX}:${stackId && stackId.length ? stackId : "default"}`;
}

/** Best-effort access to a Storage; null when unavailable/blocked. */
function safeLocalStorage(): Storage | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    // Probe write (Safari private mode throws on setItem).
    const probe = `${KEY_PREFIX}:__probe__`;
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export function loadState(stackId: string | undefined): PersistedProgression {
  const ls = safeLocalStorage();
  if (!ls) return emptyState();
  try {
    const raw = ls.getItem(storageKey(stackId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<PersistedProgression>;
    // Forward-compatible, defensive merge — never trust persisted shape.
    return {
      version: SCHEMA_VERSION,
      xp: num(parsed.xp),
      highScore: num(parsed.highScore),
      bestStreak: num(parsed.bestStreak),
      lifetimeHits: num(parsed.lifetimeHits),
      runs: num(parsed.runs),
    };
  } catch {
    return emptyState();
  }
}

export function saveState(
  stackId: string | undefined,
  state: PersistedProgression
): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(storageKey(stackId), JSON.stringify(state));
  } catch {
    /* quota / blocked — in-memory state remains the source of truth */
  }
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;
}
