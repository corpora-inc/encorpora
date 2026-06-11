/**
 * beatlounge — phrase-SCRATCH load token: a tiny monotonic gate that makes async
 * snippet loading robust against the first-phrase race.
 *
 * ROOT CAUSE the gate fixes: when the selection changes (or the very first
 * snippet resolves), several async steps run (cache read → render → decode →
 * rebuild). If a later selection's load, or an unmount, lands while an earlier
 * load is mid-flight, the earlier load could overwrite the engine with a STALE
 * buffer (or set state after teardown). The previous code closed over `selected`
 * and relied on a single `cancelled` boolean, which a freshly-scheduled effect
 * couldn't observe — so the first load sometimes lost a race with its own
 * re-run and no buffer was installed.
 *
 * The gate is a single increasing counter. Each load opens a token; every async
 * checkpoint asks "am I still the current token?" — if a newer load (or an
 * unmount) has bumped it, the stale load discards its result. The CURRENT
 * selection's load always wins because it holds the highest token.
 */

export interface LoadToken {
  /** Open a new load; supersedes all prior tokens. Returns this load's id. */
  open(): number
  /** Is `id` still the current (winning) token? */
  isCurrent(id: number): boolean
  /** Invalidate the current load without opening a new one (e.g. unmount). */
  invalidate(): void
}

export const createLoadToken = (): LoadToken => {
  let current = 0
  return {
    open() {
      current += 1
      return current
    },
    isCurrent: (id: number) => id === current,
    invalidate() {
      current += 1
    },
  }
}
