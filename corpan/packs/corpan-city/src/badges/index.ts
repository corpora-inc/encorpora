/**
 * Badges slice — public surface (BADGES_PROGRESSION). The orchestrator imports
 * ONLY from here. It exposes:
 *   - `createBadgesRuntime` — the one-call wiring bundle (catalog + store + chip
 *     + Badge Case section factory + the `focusBadge` glance + a `buildDeposit`
 *     helper that turns a challenge/quest result into a `BadgeDeposit`).
 *   - the stubs (`memTrackStore`, `stubIconRenderer`, `stubTranslate`) so the
 *     slice ships before Slice 1 (TrackStore) / Slice 4 (IconRenderer) / loc land.
 *   - the lower-level pieces (catalog/router/store) for tests + advanced wiring.
 *
 * Consumers code against the contract INTERFACES; the real TrackStore /
 * IconRenderer / Translate swap in at the call site with zero code change here.
 */

import type {
  BadgeDeposit,
  ChallengeResultPlus,
  ChallengeToolId,
  ChallengeContext,
} from "@corpan-city/contracts"
import { trackNamespace } from "@corpan-city/contracts"
import type {
  IconRenderer,
  Translate,
  TrackStore,
  TrackStoreBinding,
  FocusBadgeGlance,
} from "../contracts/runtime"
import { buildCatalog, buildEsB0Catalog, type BadgeCatalog, type CoverageMatrix } from "./catalog"
import { createBadgeStore, type BadgeStore } from "./badgeStore"
import { createBadgeCaseSection, type MenuSectionView } from "./badgeCase"
import { createBadgeChip, type BadgeChipHandle } from "./badgeChip"
import { BADGE_EN } from "./badgeStrings"

export * from "./catalog"
export * from "./router"
export {
  createBadgeStore,
  type BadgeStore,
  type BadgeEvent,
  type TierUp,
  type BadgeStoreOptions,
} from "./badgeStore"
export { createBadgeCaseSection, type BadgeCaseOptions, type MenuSectionView } from "./badgeCase"
export { createBadgeChip, type BadgeChipOptions, type BadgeChipHandle } from "./badgeChip"
export {
  createBadgeT,
  badgeName,
  howToFill,
  type BadgeT,
  BADGE_EN,
} from "./badgeStrings"

/* ------------------------------------------------------------------ stubs */

/**
 * The memory/localStorage `TrackStore` stub (from IMPLEMENTATION_CONTRACTS Seam 1)
 * — consumers build against this until Slice 1 lands the real IndexedDB store.
 * Quota-safe, noisy, never throws into the caller.
 */
export const memTrackStore: TrackStore = {
  async read<T>(k: string): Promise<T | null> {
    try {
      const v = typeof localStorage !== "undefined" ? localStorage.getItem(k) : null
      return v ? (JSON.parse(v) as T) : null
    } catch (e) {
      console.error("[wp/trackStore stub] read failed", e)
      return null
    }
  },
  async write(k, val) {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(k, JSON.stringify(val))
    } catch (e) {
      console.error("[wp/trackStore stub] write failed", e)
    }
  },
  async remove(k) {
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(k)
    } catch (e) {
      console.error("[wp/trackStore stub] remove failed", e)
    }
  },
  async keys(prefix) {
    if (typeof localStorage === "undefined") return []
    return Object.keys(localStorage).filter((k) => k.startsWith(prefix))
  },
}

/** A binding for a TrackId over a store (defaults to the mem stub). */
export function bindingFor(trackId: string, store: TrackStore = memTrackStore): TrackStoreBinding {
  return { namespace: trackNamespace(trackId), store }
}

/**
 * The stub `IconRenderer` (IMPLEMENTATION_CONTRACTS Seam 2) — a labeled disc with
 * a fill ring for medals, until Slice 4 lands the painted renderer. The medal
 * arc is drawn so the Badge Case + chip look right even pre-Slice-4.
 */
export const stubIconRenderer: IconRenderer = {
  renderIcon(spec, t) {
    const size = t?.size ?? 32
    const c = document.createElement("canvas")
    c.width = c.height = size
    const x = c.getContext("2d")
    if (!x) return c
    const r = size / 2
    // Base disc.
    x.fillStyle = spec.palette
    x.beginPath()
    x.arc(r, r, r * 0.78, 0, Math.PI * 2)
    x.fill()
    // Inner face (slightly lighter) so the glyph reads.
    x.fillStyle = "rgba(255,255,255,0.22)"
    x.beginPath()
    x.arc(r, r, r * 0.5, 0, Math.PI * 2)
    x.fill()
    // The progress fill ring (medal only).
    if (spec.family === "medal" && spec.fillArc != null) {
      x.lineWidth = Math.max(2, size * 0.08)
      x.strokeStyle = "rgba(255,255,255,0.35)"
      x.beginPath()
      x.arc(r, r, r * 0.88, -Math.PI / 2, Math.PI * 1.5)
      x.stroke()
      x.strokeStyle = spec.accent ?? "#fff8e1"
      x.beginPath()
      x.arc(r, r, r * 0.88, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, spec.fillArc))
      x.stroke()
    }
    return c
  },
  iconDataUrl(spec, t) {
    return this.renderIcon(spec, t).toDataURL()
  },
}

/**
 * The offline `Translate` stub: resolves badge keys against the bundled EN table,
 * else returns the key (the seam's documented `(key)=>key` default). Params are
 * applied by `createBadgeT`'s fallback path, so this just needs to surface English.
 */
export const stubTranslate: Translate = (key) => BADGE_EN[key] ?? key

/* -------------------------------------------------- buildDeposit (wiring) -- */

/** Map a toolId → its skill (for completeness; the router re-derives too). */

/**
 * Build a `BadgeDeposit` from a finished challenge — the EXACT shape the
 * orchestrator constructs at the `runChallenge(...).then((res)=>…)` seam in
 * game.ts. Pulls the facets the router needs (domain/level/entryIds from the
 * ChallengeContext, toolId + score from the result, the active trackKey).
 */
export function buildChallengeDeposit(args: {
  result: Pick<ChallengeResultPlus, "toolId" | "score" | "rewards">
  context: Pick<ChallengeContext, "domain" | "level" | "entryIds">
  trackKey: string
}): BadgeDeposit {
  return {
    amount: args.result.rewards.xp,
    trackKey: args.trackKey,
    source: "challenge",
    domain: args.context.domain,
    toolId: args.result.toolId as ChallengeToolId,
    level: args.context.level,
    entryIds: args.context.entryIds,
    score: args.result.score,
  }
}

/* -------------------------------------------------- the runtime bundle ----- */

export interface BadgesRuntimeOptions {
  /** the active Track id ("en:es") → namespaces the store + derives the catalog target. */
  trackKey: string
  /** the Track's native code (UI locale for badge copy). */
  lang: string
  /** display label for the summary line ("Spanish"). */
  trackLabel: string
  /** open the Badge Case (orchestrator: `shell.openSection("badges")`). */
  openCase: () => void
  /** override the catalog coverage (default: the B0 ES set). */
  coverage?: CoverageMatrix
  /** real producers swap in here; default to the stubs. */
  store?: TrackStore
  renderer?: IconRenderer
  t?: Translate
  accent?: string
}

/** Everything the orchestrator needs to wire badges into game.ts in one call. */
export interface BadgesRuntime {
  catalog: BadgeCatalog
  store: BadgeStore
  /** the Badge Case section factory → `createShell({ sections: { badges } })`. */
  section: MenuSectionView
  /** the HUD focus chip (replaces the ✨ integer) → place in `.wp-overlay`. */
  chip: BadgeChipHandle
  /** the `focusBadge()` HUD glance (Seam 3) → `HudGlances.focusBadge`. */
  focusBadge(): FocusBadgeGlance | null
  /** route a finished challenge into the badge ledger (game.ts seam #1). */
  depositChallenge(args: {
    result: Pick<ChallengeResultPlus, "toolId" | "score" | "rewards">
    context: Pick<ChallengeContext, "domain" | "level" | "entryIds">
  }): void
  /** persist + tear down (Track switch / teardown). */
  dispose(): Promise<void>
}

/**
 * Build the full badges runtime. ONE call gives the orchestrator the store, the
 * Badge Case section factory, the HUD chip, the `focusBadge` glance, and the
 * challenge→deposit router. Swaps the real TrackStore/IconRenderer/Translate in
 * with zero call-site change (they default to the documented stubs).
 */
export function createBadgesRuntime(opts: BadgesRuntimeOptions): BadgesRuntime {
  const store = opts.store ?? memTrackStore
  const renderer = opts.renderer ?? stubIconRenderer
  const t = opts.t ?? stubTranslate
  const coverage = opts.coverage
  const catalog: BadgeCatalog = coverage ? buildCatalog(coverage) : buildEsB0Catalog()

  const badgeStore = createBadgeStore({
    catalog,
    binding: bindingFor(opts.trackKey, store),
  })

  const section = createBadgeCaseSection({
    store: badgeStore,
    renderer,
    t,
    lang: opts.lang,
    trackLabel: opts.trackLabel,
    accent: opts.accent,
  })

  const chip = createBadgeChip({
    store: badgeStore,
    renderer,
    t,
    lang: opts.lang,
    onOpen: opts.openCase,
    accent: opts.accent,
  })

  return {
    catalog,
    store: badgeStore,
    section,
    chip,
    focusBadge: () => badgeStore.focusBadge(),
    depositChallenge(args) {
      const deposit = buildChallengeDeposit({ ...args, trackKey: opts.trackKey })
      badgeStore.applyDeposit(deposit)
    },
    async dispose() {
      chip.dispose()
      await badgeStore.flush()
    },
  }
}
