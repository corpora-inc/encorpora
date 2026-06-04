/**
 * Badge STORE — per-Track progress (BADGES_PROGRESSION §5). Mirrors
 * `inventory.ts`: a tiny event bus + a COMPACT persisted record (touched badges
 * only) + a catalog-by-id index + quota-safe debounced writes. It persists via
 * the injected `TrackStoreBinding` ({ namespace, store }) — IndexedDB-backed in
 * production, the localStorage stub in dev — keyed `${namespace}:badges` (i.e.
 * `wp:track:{id}:badges`). Only the active Track's record is resident.
 *
 * The store is the WRITE side of the curve: it takes the router's raw credits,
 * applies the near-tier soft cap + platinum-overflow re-route to siblings, bumps
 * each badge's weighted-xp, recomputes the tier, and emits tier-up events. It is
 * also the READ side the Badge Case + the HUD focus chip consume.
 *
 * Persisted shape = `PersistedBadges` (`{ v:1, p: { badgeId: [tierIndex, wxp] } }`)
 * — absent id ⇒ Locked. A fresh Track is ~0 bytes; a maxed Track ≈ 32 KB.
 */

import type {
  Badge,
  BadgeDeposit,
  BadgeProgress,
  BadgeTier,
  PersistedBadges,
} from "@world-plaza/contracts"
import type { TrackStoreBinding } from "../contracts/runtime"
import type { FocusBadgeGlance } from "../contracts/runtime"
import type { BadgeCatalog } from "./catalog"
import {
  route,
  siblingsOf,
  tierForXp,
  tierIndex,
  arcForXp,
  xpToNextTier,
  softCappedDelta,
  isPlatinum,
  TIER_NAMES,
} from "./router"

/* ----------------------------------------------------------------- events */

export type BadgeEvent =
  | { type: "deposit"; touched: string[]; tierUps: TierUp[] }
  | { type: "tierUp"; badgeId: string; tier: BadgeTier }
  | { type: "grant"; badgeId: string; tier: BadgeTier } // direct story-badge grant
  | { type: "change" }

/** A badge that crossed into a new tier on a deposit (for the dignified toast). */
export interface TierUp {
  badgeId: string
  from: BadgeTier
  to: BadgeTier
}

/* ----------------------------------------------------------- the live state */

/** In-memory: badgeId → cumulative weighted-xp (tier is derived, not stored raw). */
type Live = Map<string, number>

/* ----------------------------------------------------------------- the store */

export interface BadgeStore {
  readonly catalog: BadgeCatalog

  /** Ingest one challenge/quest deposit; fans out, persists, emits tier-ups. */
  applyDeposit(deposit: BadgeDeposit): TierUp[]
  /** Direct-grant a story badge (family J) to at least a tier (§2.6). */
  grantStoryBadge(badgeId: string, tier?: BadgeTier): void

  /** The achieved tier of a badge (Locked if untouched). */
  tierOf(badgeId: string): BadgeTier
  /** The cumulative weighted-xp on a badge (0 if untouched). */
  xpOf(badgeId: string): number
  /** The 0..1 arc toward the badge's next tier. */
  arcOf(badgeId: string): number
  /** Full progress for a badge (for the Badge Case cells). */
  progressOf(badgeId: string): BadgeProgress
  /** XP still needed to reach the next tier (0 at platinum). */
  toNextOf(badgeId: string): number

  /** Every TOUCHED badge's progress (the "In Progress" + "Recent" surfaces). */
  touched(): BadgeProgress[]
  /** Count of badges at Platinum (the "X mastered" summary line). */
  masteredCount(): number

  /** The HUD glance: the medal NEAREST its next tier (replaces the ✨ integer). */
  focusBadge(): FocusBadgeGlance | null

  subscribe(fn: (e: BadgeEvent) => void): () => void
  /** Force-flush any debounced write (Track switch / teardown). */
  flush(): Promise<void>
  /** QA / reset. */
  reset(): Promise<void>
}

export interface BadgeStoreOptions {
  catalog: BadgeCatalog
  /** the per-Track namespaced async store ({ namespace, store }). */
  binding: TrackStoreBinding
}

const SCHEMA_V = 1 as const

export function createBadgeStore(opts: BadgeStoreOptions): BadgeStore {
  const { catalog, binding } = opts
  const key = `${binding.namespace}:badges`
  const live: Live = new Map()
  const listeners = new Set<(e: BadgeEvent) => void>()
  let loaded = false
  let writeTimer: ReturnType<typeof setTimeout> | null = null
  let pendingWrite = false

  const emit = (e: BadgeEvent) => {
    for (const fn of listeners) {
      try {
        fn(e)
      } catch (err) {
        console.error("[wp/badges] subscriber threw:", err)
      }
    }
    if (e.type !== "change") {
      for (const fn of listeners) {
        try {
          fn({ type: "change" })
        } catch (err) {
          console.error("[wp/badges] subscriber threw:", err)
        }
      }
    }
  }

  /* ------------------------------------------------------------ persistence */

  const serialize = (): PersistedBadges => {
    const p: PersistedBadges["p"] = {}
    for (const [id, wxp] of live) {
      if (wxp <= 0) continue
      const def = catalog.get(id)
      const tier = def ? tierForXp(wxp, def.tierScale) : "bronze"
      p[id] = [tierIndex(tier), Math.round(wxp)]
    }
    return { v: SCHEMA_V, p }
  }

  // Debounced, quota-safe write (coalesce a burst of credits into one write).
  const scheduleWrite = () => {
    pendingWrite = true
    if (writeTimer) return
    writeTimer = setTimeout(() => {
      writeTimer = null
      void doWrite()
    }, 250)
  }

  const doWrite = async (): Promise<void> => {
    if (!pendingWrite) return
    pendingWrite = false
    try {
      await binding.store.write(key, serialize())
    } catch (err) {
      // The TrackStore is quota-safe (never throws), but be noisy if it does.
      console.error("[wp/badges] persist failed — keeping in-memory this session:", err)
    }
  }

  const ensureLoaded = async (): Promise<void> => {
    if (loaded) return
    loaded = true
    try {
      const raw = await binding.store.read<PersistedBadges>(key)
      if (raw && raw.v === SCHEMA_V && raw.p) {
        for (const [id, packed] of Object.entries(raw.p)) {
          // Drop ids no longer in the catalog, but keep their progress dormant
          // ONLY if still present (forward-compat: removed badges are hidden, not
          // wiped — §7.5). Here the in-memory live map mirrors the catalog.
          if (!catalog.get(id)) continue
          const wxp = Array.isArray(packed) ? Number(packed[1]) : 0
          if (wxp > 0) live.set(id, wxp)
        }
      }
    } catch (err) {
      console.error("[wp/badges] could not read badge progress:", err)
    }
    emit({ type: "change" })
  }
  // Kick the load immediately (fire-and-forget; reads are omit-graceful until it lands).
  void ensureLoaded()

  /* -------------------------------------------------------------- the curve */

  /** Add `rawDelta` weighted-xp to a badge with the soft cap; returns its new xp. */
  const creditBadge = (badge: Badge, rawDelta: number): number => {
    const from = live.get(badge.id) ?? 0
    const eff = softCappedDelta(from, rawDelta, badge.tierScale)
    const next = from + eff
    live.set(badge.id, next)
    return next
  }

  /* ---------------------------------------------------------------- reads */

  const tierOf = (id: string): BadgeTier => {
    const def = catalog.get(id)
    if (!def) return "locked"
    return tierForXp(live.get(id) ?? 0, def.tierScale)
  }
  const xpOf = (id: string): number => live.get(id) ?? 0
  const arcOf = (id: string): number => {
    const def = catalog.get(id)
    if (!def) return 0
    return arcForXp(live.get(id) ?? 0, def.tierScale)
  }
  const toNextOf = (id: string): number => {
    const def = catalog.get(id)
    if (!def) return 0
    return xpToNextTier(live.get(id) ?? 0, def.tierScale)
  }
  const progressOf = (id: string): BadgeProgress => ({
    badgeId: id,
    tier: tierOf(id),
    weightedXp: xpOf(id),
  })

  return {
    catalog,

    applyDeposit(deposit) {
      void ensureLoaded()
      const credits = route(deposit, catalog)
      const touched = new Set<string>()
      const tierUps: TierUp[] = []

      for (const credit of credits) {
        let target = catalog.get(credit.badgeId)
        if (!target) continue
        let xpToPlace = credit.xp

        // Platinum overflow re-route (§2.5): if the primary badge is already
        // platinum, redirect this credit to its still-incomplete siblings.
        if (isPlatinum(xpOf(target.id), target.tierScale)) {
          const sib = siblingsOf(target, catalog).find(
            (b) => !isPlatinum(xpOf(b.id), b.tierScale),
          )
          if (!sib) {
            // No incomplete sibling — the credit lands on platinum (no-op past max).
            continue
          }
          target = sib
        }

        const before = tierOf(target.id)
        creditBadge(target, xpToPlace)
        const after = tierOf(target.id)
        touched.add(target.id)
        if (tierIndex(after) > tierIndex(before)) {
          tierUps.push({ badgeId: target.id, from: before, to: after })
        }
      }

      if (touched.size > 0) {
        scheduleWrite()
        emit({ type: "deposit", touched: [...touched], tierUps })
        for (const t of tierUps) emit({ type: "tierUp", badgeId: t.badgeId, tier: t.to })
      }
      return tierUps
    },

    grantStoryBadge(badgeId, tier = "bronze") {
      void ensureLoaded()
      const def = catalog.get(badgeId)
      if (!def) {
        console.warn(`[wp/badges] grantStoryBadge of unknown badge "${badgeId}" — skipped`)
        return
      }
      // Direct-grant (§2.6): ensure the badge sits at AT LEAST the requested tier
      // by snapping its weighted-xp to that tier's threshold (never demotes).
      const idx = Math.max(1, tierIndex(tier))
      const target = thresholdAtTier(def, idx)
      if ((live.get(badgeId) ?? 0) < target) live.set(badgeId, target)
      scheduleWrite()
      emit({ type: "grant", badgeId, tier: tierOf(badgeId) })
    },

    tierOf,
    xpOf,
    arcOf,
    toNextOf,
    progressOf,

    touched() {
      const out: BadgeProgress[] = []
      for (const id of live.keys()) {
        if ((live.get(id) ?? 0) > 0) out.push(progressOf(id))
      }
      return out
    },

    masteredCount() {
      let n = 0
      for (const [id, wxp] of live) {
        const def = catalog.get(id)
        if (def && isPlatinum(wxp, def.tierScale)) n++
      }
      return n
    },

    focusBadge() {
      // The medal NEAREST its next tier among TOUCHED, non-platinum badges:
      // maximize arc (closest to completing), tie-break by higher current tier.
      let best: { id: string; arc: number; tierIdx: number } | null = null
      for (const [id, wxp] of live) {
        if (wxp <= 0) continue
        const def = catalog.get(id)
        if (!def) continue
        if (isPlatinum(wxp, def.tierScale)) continue
        const arc = arcForXp(wxp, def.tierScale)
        const tIdx = tierIndex(tierForXp(wxp, def.tierScale))
        if (!best || arc > best.arc || (arc === best.arc && tIdx > best.tierIdx)) {
          best = { id, arc, tierIdx: tIdx }
        }
      }
      if (!best) return null
      const def = catalog.get(best.id)!
      const tier = tierForXp(live.get(best.id) ?? 0, def.tierScale)
      return {
        badgeId: best.id,
        glyph: def.glyph,
        tier,
        arc: best.arc,
        icon: { family: "medal", palette: "#c9a14a", fillArc: best.arc, tier },
      }
    },

    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },

    async flush() {
      if (writeTimer) {
        clearTimeout(writeTimer)
        writeTimer = null
      }
      await doWrite()
    },

    async reset() {
      live.clear()
      if (writeTimer) {
        clearTimeout(writeTimer)
        writeTimer = null
      }
      pendingWrite = false
      try {
        await binding.store.remove(key)
      } catch (err) {
        console.warn("[wp/badges] could not clear badge store:", err)
      }
      emit({ type: "change" })
    },
  }
}

/* ------------------------------------------------ direct-grant helpers ----- */

import { tierThresholds } from "./router"

/** The cumulative weighted-xp at the START of a given tier index (1=bronze…4=platinum). */
function thresholdAtTier(def: Badge, tierIdx: number): number {
  const th = tierThresholds(def.tierScale)
  // tierIdx 1=bronze → th[0]; 2=silver → th[1]; …; 4=platinum → th[3].
  return th[Math.min(Math.max(tierIdx - 1, 0), th.length - 1)]
}

export { TIER_NAMES }
