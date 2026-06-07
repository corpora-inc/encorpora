/**
 * Corpan City — shared RUNTIME interfaces (the scale-out integration spine).
 *
 * These are the injected getters / stores / renderers every slice agrees on.
 * They are NOT serialized data (those live in `contracts/src/*` as Zod schemas);
 * they carry FUNCTIONS, so they are pure TypeScript types with no logic and no
 * DOM. A consumer slice codes against the interface + a documented stub here and
 * NEVER against another slice's internals. See `docs/IMPLEMENTATION_CONTRACTS.md`
 * for the per-seam producer→consumer map and the stub/default for each.
 *
 * Frozen surface — additive only. Every getter is OPTIONAL or omit-graceful so a
 * consumer can ship before its producer lands (a missing glance → an omitted row,
 * never a crash).
 */

import type {
  TrackId,
  TrackState,
  TrackHeadline,
  CurrencyId,
  BadgeId,
  BadgeTier,
  RoomTopology,
  PlayerPosition,
  LanguageCode,
} from "@corpan-city/contracts"
import type { InventoryStore } from "../economy/inventory"
import type { QuestEngine, QuestMarker } from "../quest/questState"

/* ================================================================== *
 * SEAM 1 — TrackStore (per-Track namespaced storage)
 * PRODUCER: Slice 1 (Foundation/storage).  CONSUMERS: every per-Track
 * store — inventory (Slice 1), quest engine (orchestrator), badges
 * (Slice 1), immersion flag. An async key→JSON store over IndexedDB
 * with a localStorage fallback. Quota-safe (never throws), noisy.
 * ================================================================== */

export interface TrackStore {
  /** Read + JSON-parse a value, or null if absent/corrupt (logs on corrupt). */
  read<T>(key: string): Promise<T | null>
  /** Write a value (JSON). Quota-safe — never throws into the caller; logs loudly. */
  write(key: string, value: unknown): Promise<void>
  /** Remove a key. */
  remove(key: string): Promise<void>
  /** List keys under a prefix (for archival/eviction/analytics). */
  keys(prefix: string): Promise<string[]>
}

/**
 * The `{ namespace, store }` convention every per-Track factory takes instead of
 * touching localStorage directly. `namespace = trackNamespace(trackId)` →
 * `wp:track:{id}`; the factory keys its record `${namespace}:${suffix}`
 * (e.g. `wp:track:en:es:economy`). Serialize logic is UNCHANGED — only the key
 * and the backing store are parameterized.
 */
export interface TrackStoreBinding {
  /** `wp:track:{id}` — the per-Track key prefix (`trackNamespace(id)`). */
  namespace: string
  /** the injected async store (IndexedDB-backed). */
  store: TrackStore
}

/* ================================================================== *
 * SEAM 2 — IconRenderer (the shared procedural icon system)
 * PRODUCER: Slice 4 (content/item-art) — `src/items/itemArt.ts`.
 * CONSUMERS: economy currencies (Slice 1), badges (Slice 1), inventory
 * items (Slice 1/3), Top-HUD wealth/badge glance (Slice 2). One
 * renderer, three targets (in-world canvas cutout, DOM <canvas> cell,
 * CSS data-URL). Kills the emoji placeholders.
 * ================================================================== */

/** Which icon family the renderer draws (currencies + badges + items unified). */
export type IconFamily =
  // currency/denomination forms (mirror CurrencyArt.shape)
  | "coin-round"
  | "coin-square-hole"
  | "bill-rect"
  | "ingot-bar"
  | "note-stack"
  | "shell"
  | "gem-faceted"
  | "pouch"
  // badge + item forms
  | "medal" // badges (a fill ring + family emblem)
  | "token"
  | "seal"
  | "letter"
  | "scroll"
  | "garment"
  | "foodstuff"
  | "vessel"
  | "tool"
  | "key"
  | "charm"
  | "cloth"

/** Surface finish — paper-world materials, not clip-art. */
export type IconFinish = "matte" | "glazed" | "metal" | "woven"

/** Rarity drives a distinct deckle/corner-flourish/sheen frame (legible at a glance). */
export type IconRarity = "common" | "rare" | "epic" | "seasonal"

/**
 * The spec the renderer paints. Covers family / finish / rarity + a palette and
 * an optional motif (emblem id) and seed (deterministic jitter). `fillArc`
 * (0..1) drives the badge medal's progress ring; ignored by non-medal families.
 */
export interface IconSpec {
  family: IconFamily
  /** base hue / palette anchor (hex). */
  palette: string
  finish?: IconFinish
  rarity?: IconRarity
  /** emblem drawn on the face: "castle","quetzal","chrysanthemum","greetings",… */
  motif?: string
  /** secondary accent (band color, trim) hex. */
  accent?: string
  /** metal tone for coins/ingots. */
  metal?: "gold" | "silver" | "copper" | "bronze" | "patina"
  /** deterministic seed for per-instance jitter (same seed → same icon). */
  seed?: number
  /** badge medals only: 0..1 progress fill ring toward the next tier. */
  fillArc?: number
  /** badge medals only: the tier metal. */
  tier?: BadgeTier
}

export interface IconRenderTarget {
  /** target pixel size (square). */
  size: number
}

/**
 * The renderer. `renderIcon` returns a freshly painted canvas for DOM cells /
 * in-world cutouts; `iconDataUrl` returns a cacheable CSS background data-URL.
 * Reduced-motion is respected by the implementation (no glint animation).
 */
export interface IconRenderer {
  renderIcon(spec: IconSpec, target?: IconRenderTarget): HTMLCanvasElement
  iconDataUrl(spec: IconSpec, target?: IconRenderTarget): string
}

/* ================================================================== *
 * SEAM 3 — Top-HUD glance getters (the chrome reads cheap glances)
 * PRODUCERS: economy (walletGlance), badges (focusBadge), net
 * (presenceCount), track (trackPair), immersion (resolver), i18n (t).
 * CONSUMER: Slice 2 (Top-HUD capsule + place tag).
 * ALL OPTIONAL / omit-gracefully — a missing getter → an omitted row.
 * The HUD never loads heavy state; the pack (satchel) is the ledger.
 * ================================================================== */

/** A whisper of wealth (top-held currency + abbreviated major total). Not a wallet. */
export interface WalletGlance {
  topCurrency: CurrencyId
  /** decomposed abbreviated major total, e.g. "R 18.40" / "₩ 50,000" (locale-grouped). */
  major: string
  /** the top denomination icon spec, so the HUD can render the physical glyph. */
  icon?: IconSpec
}

/** The focus badge: the medal nearest its next tier (replaces the static ✨ integer). */
export interface FocusBadgeGlance {
  badgeId: BadgeId
  glyph: string
  tier: BadgeTier
  /** 0..1 arc toward the next tier. */
  arc: number
  /** the medal icon spec (family "medal", fillArc = arc, tier = tier). */
  icon?: IconSpec
}

/** Which Track is in play (for the flag-pair lozenge + immersion pip). */
export interface TrackPairGlance {
  native: LanguageCode
  target: LanguageCode
  immersion: "off" | "reveal" | "on"
}

/**
 * The bundle of glance getters the Top-HUD consumes. Each is OPTIONAL: the HUD
 * checks presence and omits the row when absent (no economy → no wealth row; no
 * badges → no focus chip; solo → no presence pip). Each returns a cheap value,
 * never loading the pack's heavy surfaces.
 */
export interface HudGlances {
  /** top-held currency whisper; deep-links to the pack Wallet tab. (economy) */
  walletGlance?: () => WalletGlance | null
  /** the badge nearest its next tier; deep-links to the Badge Case. (badges) */
  focusBadge?: () => FocusBadgeGlance | null
  /** count of remote players in the room; 0/absent when solo/offline. (net) */
  presenceCount?: () => number
  /** the active Track's pair + immersion pip. (track) */
  trackPair?: () => TrackPairGlance | null
}

/* ---- Immersion resolver surface (IMMERSION_TOGGLE) ---------------- */

export type Immersion = "off" | "reveal" | "on"

/**
 * The single pure resolver every native-bearing surface consults. NEVER touches
 * the DOM; returns DECISIONS the surface applies. Adding a surface = "route its
 * strings through `uiLocale()` / `resolveStrings()`, and if it shows corpus
 * glosses use `challengeNativeLanguage()`." Nothing else can leak native text.
 *
 * PRODUCER: Slice 1 (foundation owns the per-Track flag + resolver) OR a
 * dedicated immersion slice. CONSUMERS: every UI surface (Slice 2 HUD,
 * tracker, menu, challenges, prompt, economy/badge UI).
 */
export interface ImmersionResolver {
  level(): Immersion // the Track's setting (forced "on" if target===native)
  hideNative(): boolean // true for "reveal" | "on"
  offerReveal(): boolean // the §6 on-demand reveal hatch exists
  proactiveReveal(): boolean // hint the hatch (only "reveal")
  /** which locale a surface's UI strings render in: hideNative() ? target : native. */
  uiLocale(): LanguageCode
  /** the native code for ChallengeContext (undefined hides native → target-only). */
  challengeNativeLanguage(): LanguageCode | undefined
  /** prompt discipline fragment for composeSystemPrompt. */
  languageDiscipline(target: string, native: string): string
  /** per-surface escape hatch (Leave-confirm keeps native): pick target unless keepNative. */
  resolveStrings<T>(native: T, target: T, opts?: { keepNative?: boolean }): T
}

/* ---- Localization seam (LOCALIZATION_SCALE) ---------------------- */

/**
 * The ONE string seam every surface reads. `t(key, lang, params)` resolves into
 * the requested language with a PER-KEY English fallback (never blank), collapses
 * variants (ko-polite→ko, pt-BR→pt, zh-Hans→zh). `lang` is the Track's `native`
 * for UI/instructions, `target` for segues/NPC speech. The immersion resolver's
 * `uiLocale()` chooses which side to pass.
 *
 * PRODUCER: Slice 4/localization (`src/i18n/strings.ts`). CONSUMERS: every
 * surface with copy (all slices).
 */
export type Translate = (key: string, lang: string, params?: Record<string, string | number>) => string

/* ================================================================== *
 * SEAM 4 — MapView bundle (COHESION M3)
 * PRODUCER: orchestrator wires it; data from topology + player + net +
 * quest engine. CONSUMER: Slice 3 (minimap + full map). Pure consumer
 * of `{ topology, getPlayerPos, getRemotePositions, getQuestMarkers }`.
 * ================================================================== */

/** A remote player's live position + identity for the map dots/avatars. */
export interface RemotePresence {
  playerId: string
  name: string
  pos: PlayerPosition
}

/** An axis-aligned world rectangle (XZ), for map water + building footprints. */
export interface MapRect {
  x0: number
  x1: number
  z0: number
  z1: number
}

/** Static world geometry the map renders so it isn't a bare grid (#35): open
 *  WATER (rivers/coast) + building/blocker footprints. Sourced from the streaming
 *  CityLayout (the same truth collision + placement read), so the map and the
 *  world can never drift. Optional — non-city rooms omit it and the map falls back
 *  to `topology.blockers`. */
export interface MapGeometry {
  /** open-water footprints (non-walkable river/coast) in world XZ. */
  water: MapRect[]
  /** building / blocker footprints in world XZ. */
  blockers: MapRect[]
}

export interface MapView {
  /** the shared static layout (bounds, anchors, blockers). */
  topology: RoomTopology
  /** the local player's live ground position (polled each frame). */
  getPlayerPos(): PlayerPosition
  /** remote players (Colyseus presence); [] when solo/offline. */
  getRemotePositions(): RemotePresence[]
  /** quest markers: current objective anchor + unmet source hints (anchor coords). */
  getQuestMarkers(): QuestMarker[]
  /** OPTIONAL static world geometry (water + building footprints) for the map
   *  base layer (#35). Absent → the map uses `topology.blockers` only. */
  getMapGeometry?(): MapGeometry
}

/* ================================================================== *
 * SEAM 5 — SpecialNpcResolver + content/npc/special.json (COHESION M2)
 * PRODUCER: Slice 3 (special quest NPCs).  CONSUMERS: orchestrator
 * (marks held specials, passes questEngine into their dialogue), the
 * quest engine (routes delivery only through the marked NPC).
 * ================================================================== */

/**
 * One entry of `content/npc/special.json` — maps a topology anchor to the quest
 * NPC that tends it. The engine routes the clue→item→deliver→advance loop only
 * through the marked NPC at the step's anchor; anyone else is a generic persona.
 */
export interface SpecialNpcDef {
  /** the topology anchor this special NPC stands at (matches Anchor.id). */
  anchorId: string
  /** the quest this NPC is bound to. */
  questId: string
  /** the abstract NPC role id (composes the persona/prompt). */
  role: string
  /** the NPC's display name ("Serafina","the boatman"). */
  name: string
  /** optional: which quest step(s) this NPC handles (else: any step at its anchor). */
  stepIds?: string[]
}

/** The parsed `content/npc/special.json`: a list of special-NPC definitions. */
export type SpecialNpcContent = SpecialNpcDef[]

export interface SpecialNpcResolver {
  /** Is the agent at this anchor a special quest NPC for the active quest? */
  isSpecial(anchorId: string, questId: string): boolean
  /** The special NPC tending an anchor for a quest, or null. */
  forAnchor(anchorId: string, questId: string): SpecialNpcDef | null
  /** All specials for a quest (for map labelling + placement). */
  forQuest(questId: string): SpecialNpcDef[]
}

/* ================================================================== *
 * Re-exported runtime store shapes (so consumers import one module).
 * These already exist in the runtime; the contract just names them as
 * the agreed injection types. `inventory()` becomes the active Track's
 * inventory; the quest engine is per-Track. Both gain a TrackStoreBinding.
 * ================================================================== */

export type { InventoryStore } from "../economy/inventory"
export type { QuestEngine, QuestMarker } from "../quest/questState"
export type {
  TrackId,
  TrackState,
  TrackHeadline,
  CurrencyId,
  Wallet,
  Denomination,
  BadgeId,
  BadgeTier,
  BadgeDeposit,
} from "@corpan-city/contracts"

/**
 * The per-Track runtime bundle (the swap unit — LANGUAGE_PAIR_STATE §4.2). A
 * `Track` bundles the per-Track stores so they create/tear down as a unit.
 * PRODUCER: Slice 1 (foundation). CONSUMERS: orchestrator (game.ts switch
 * sequence), HUD (re-reads on switch), every per-Track surface.
 */
export interface Track {
  id: TrackId
  state: TrackState // the manifest (name, avatar, path, immersion…)
  inventory: InventoryStore // this Track's namespaced economy store
  questEngine: QuestEngine // this Track's namespaced quest engine
  // badges store etc. (BADGES_PROGRESSION) — same namespacing, added by Slice 1.
  flush(): Promise<void> // persist manifest + headline to the registry
  dispose(): void // unsubscribe stores; drop from memory
}

export interface TrackManager {
  active(): Track
  list(): TrackHeadline[]
  switchTo(id: TrackId): Promise<Track> // save current → load target
  createTrack(native: string, target: string, onboarding: unknown): Promise<Track>
  archive(id: TrackId): Promise<void>
}
