/**
 * beatlounge — phrase-SCRATCH master-rack PERSISTENCE.
 *
 * Scratch is a hand-driven performance with no document/undo coupling, so its
 * master FX chain lives in local React state (see PhraseScratchImmersive). But a
 * chain you dialled in should survive leaving the pack and coming back — losing
 * it on every re-entry is the opposite of a performance instrument. This tiny
 * module mirrors the `autoMelody` slice's localStorage approach: load a sanitized
 * `EffectNode[]` on mount, save it whenever the chain changes.
 *
 * Sanitize-on-read is the safety net: a persisted insert whose `kind` is no longer
 * a known effect is dropped, and its params are merged OVER the current defaults so
 * a spec that gained a param between sessions never reads `undefined` on a live node.
 * Pure data in / out — no React, no audio graph.
 */

import type { EffectKind, EffectNode } from "../../model/document"
import { EFFECT_KINDS, defaultEffectParams } from "../../effects/params"

const LS_KEY = "beatlounge:scratchFx"

const KNOWN = new Set<string>(EFFECT_KINDS)

/** Repair one persisted insert: valid kind + params merged over the spec defaults. */
const sanitizeNode = (raw: unknown): EffectNode | null => {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Partial<EffectNode>
  if (typeof r.kind !== "string" || !KNOWN.has(r.kind)) return null
  const kind = r.kind as EffectKind
  const id = typeof r.id === "string" && r.id ? r.id : `scrfx-${kind}`
  const params = {
    ...defaultEffectParams(kind),
    ...(r.params && typeof r.params === "object" ? r.params : {}),
  }
  return { id, kind, enabled: r.enabled === true, params }
}

/** The persisted scratch master chain (sanitized), or [] when absent / unreadable. */
export const loadScratchChain = (): EffectNode[] => {
  try {
    if (typeof localStorage === "undefined") return []
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map(sanitizeNode).filter((n): n is EffectNode => n !== null)
  } catch {
    return []
  }
}

/** Persist the scratch master chain (best-effort; private mode / quota ignored). */
export const saveScratchChain = (chain: readonly EffectNode[]): void => {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(chain))
  } catch {
    /* private mode / quota — ignore */
  }
}

/** Test seam: clear persistence between specs. */
export const __resetScratchFxForTest = (): void => {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}
