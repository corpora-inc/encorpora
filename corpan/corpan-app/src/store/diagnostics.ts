import { create } from "zustand"

/**
 * IAP diagnostics ring buffer.
 *
 * Records the outcome of every StoreKit / Play Billing interaction so that
 * when a fetch or purchase fails on a user's (or reviewer's) device, we can
 * surface the raw details in-app. Console logs don't help us when we're not
 * the one running the device.
 *
 * Capped at 20 entries — newest first. Cleared only explicitly.
 */

export type DiagCategory = "fetch" | "purchase" | "restore" | "status"
export type DiagResult = "ok" | "empty" | "error"

export type DiagEntry = {
  ts: number
  category: DiagCategory
  productIds: string[]
  result: DiagResult
  /** Human-readable detail — either the error message or e.g. "attempt 2/4 returned empty" */
  detail?: string
  platform: string
}

const MAX_ENTRIES = 20

type DiagnosticsState = {
  entries: DiagEntry[]
  record: (entry: Omit<DiagEntry, "ts">) => void
  clear: () => void
}

export const useDiagnosticsStore = create<DiagnosticsState>()((set) => ({
  entries: [],
  record: (partial) => {
    const entry: DiagEntry = { ...partial, ts: Date.now() }
    set((state) => ({
      entries: [entry, ...state.entries].slice(0, MAX_ENTRIES),
    }))
  },
  clear: () => set({ entries: [] }),
}))

/** Does the buffer contain any non-OK entries? */
export function hasDiagnosticFailures(entries: DiagEntry[]): boolean {
  return entries.some((e) => e.result !== "ok")
}

/** Format the buffer as plain text for clipboard copy. */
export function formatDiagnostics(
  entries: DiagEntry[],
  appVersion: string
): string {
  const header = `Corpan diagnostics — ${new Date().toISOString()}\nApp version: ${appVersion}\n`
  const lines = entries.map((e) => {
    const time = new Date(e.ts).toISOString()
    const ids = e.productIds.length > 0 ? ` [${e.productIds.join(", ")}]` : ""
    const detail = e.detail ? ` — ${e.detail}` : ""
    return `${time} ${e.platform} ${e.category}/${e.result}${ids}${detail}`
  })
  return `${header}\n${lines.join("\n")}`
}
