# World Plaza — Implementation Contracts (the FROZEN agreement)

**Status:** Frozen on owner approval. This is THE coordination keystone for the
four-slice parallel build. Every place the slices touch goes through one interface
named here; a consumer codes against the **interface + the documented stub**,
never against another slice's internals. The orchestrator integrates behind these
seams (it owns `game.ts` / `worldLook.ts` / `styles.css`; agents hand it wiring).

**Where the shapes live**
- **Serializable DATA shapes** (Zod + inferred types): `contracts/src/*` —
  `track.ts`, `economy.ts`, `badges.ts`, `room.ts`. `CONTRACTS_VERSION = "0.1.0"`
  (additive bump from `0.0.1`; nothing removed/narrowed; old runtimes ignore the
  new fields). `npx tsc --noEmit` is clean.
- **Runtime INTERFACES** (carry functions, no logic, no DOM): `src/contracts/runtime.ts`.

**The four slices (owner-approved):**
1. **Foundation + Economy + item-art glue** — per-Track state/storage seam, the
   multi-currency wallet/markets runtime, the per-Track inventory/quest/badge
   namespacing. (Owns Track storage, economy runtime; consumes IconRenderer.)
2. **Top-HUD redesign** — two-anchor chrome + visibility state machine, reads
   cheap glances. (Consumes every glance getter; produces none of them.)
3. **Cohesion M2 special NPCs + M3 map** — special quest-NPC resolver + the
   minimap/full map. (Produces SpecialNpcResolver; consumes MapView + typed anchors.)
4. **Content variety (faces / topology / item-art)** — the shared `IconRenderer`,
   richer `FaceSpec`, the typed-anchor topology generator. (Produces IconRenderer +
   typed anchors; consumes the Track seed/namespace.)

---

## 0. The dependency reality — what's parallel vs what serializes

**Default: everything is parallel-via-contract.** Each slice builds against the
interface + stub below and the orchestrator wires the real producer when it lands.
The handful of GENUINE serialization points (B truly cannot finish before A):

| # | Serialized edge | Why an interface isn't enough | Mitigation |
|---|---|---|---|
| S1 | **`TrackStore` (Slice 1) → per-Track inventory/quest/badge stores** | These stores must actually persist under `wp:track:{id}:*` for a multi-Track switch to be lossless; a stub localStorage store works for single-Track dev but the real IndexedDB store must land before Track-switching is verifiable. | All consumers ship against the `TrackStore` interface immediately; only the **multi-Track switch verification** waits for the real store. Single active Track works with the stub. |
| S2 | **`IconRenderer` (Slice 4) → economy currency icons / badge medals / inventory cells** | The icons are the literal "kill the moon / no placeholders" payoff; economy + badges render real glyphs through it. | Consumers code against `IconRenderer` + the **stub renderer** (a labeled colored disc) and swap the real renderer in with zero call-site change. Economy/badge LOGIC is fully parallel; only the final pixel polish waits for Slice 4. |
| S3 | **Orchestrator `game.ts` wiring** (single-owner, serialized per merge window) | Every slice lands wiring in `game.ts`; it's one file. | Each slice hands the orchestrator a wiring patch behind its getters/hooks; the orchestrator serializes merges (additive diffs only). NOT a code dependency between slices. |

**Everything else is fully parallel:** Slice 2 (HUD) reads glances that all
omit-gracefully (build it today against stubs; rows light up as producers land).
Slice 3 (map/special-NPC) consumes typed anchors + `MapView` (orchestrator-fed).
Slice 4's faces/topology don't block anyone. The economy reward/market logic,
badge router/store, and Track manager all build against `TrackStore` in parallel.

**Non-negotiable invariants every slice honors** (repeated from the design docs):
per-Track namespacing in IndexedDB (quota-safe, never the 5 MB localStorage);
rooms-shared / Track-personal; mount in `.wp-overlay` (never `document.body`);
localize every string in ~50 langs via `t(key, lang)`; single-language-stack safe
(`native === target`); no placeholders; on-device privacy; reduced-motion + a11y.

---

## SEAM 1 — `TrackStore` (per-Track namespaced storage)

**File:** `src/contracts/runtime.ts` · **Data shapes:** `contracts/src/track.ts`
**PRODUCER:** Slice 1. **CONSUMERS:** Slice 1 (inventory + economy stores), the
orchestrator (quest engine), Slice 1 (badge store), the immersion flag.

```ts
interface TrackStore {
  read<T>(key: string): Promise<T | null>      // null if absent/corrupt (logs on corrupt)
  write(key: string, value: unknown): Promise<void>  // quota-safe, never throws, noisy
  remove(key: string): Promise<void>
  keys(prefix: string): Promise<string[]>       // archival/eviction/analytics
}
interface TrackStoreBinding { namespace: string; store: TrackStore }  // {namespace, store} convention
```

- **Namespacing:** `namespace = trackNamespace(trackId)` → `wp:track:{id}` (from
  `contracts/src/track.ts`). A store keys its record `${namespace}:${suffix}`,
  e.g. `wp:track:en:es:economy`, `:quest`, `:badges`. The `{ namespace, store }`
  param is what `createInventory()` / `createQuestEngine()` / the badge store
  take instead of touching `localStorage` directly — serialize logic UNCHANGED.
- **Backing:** IndexedDB (quota-safe), localStorage fallback (standalone/SSR-less,
  noisy on fallback). Registry + globals stay in localStorage (tiny); heavy
  per-Track bodies in IndexedDB. Only the active Track resident.

**Stub** (consumers build against this until Slice 1 lands the real store):
```ts
const memTrackStore: TrackStore = {
  async read(k) { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null },
  async write(k, val) { try { localStorage.setItem(k, JSON.stringify(val)) } catch (e) { console.error("[wp/trackStore stub] write failed", e) } },
  async remove(k) { localStorage.removeItem(k) },
  async keys(prefix) { return Object.keys(localStorage).filter((k) => k.startsWith(prefix)) },
}
```

**Migration note (Slice 1 owns):** today's `wp:economy:v1` / `wp:quest:v1` /
`wp:identity:v1` fold into a default Track (COPY, not move; legacy keys remain one
release). `inventory()` stays a thin "active Track's inventory" accessor so HUD /
shop / challenge-reward call-sites don't churn.

---

## SEAM 2 — `IconRenderer` (the shared procedural icon system)

**File:** `src/contracts/runtime.ts` (`IconSpec`/`IconRenderer`) · backing data in
`contracts/src/economy.ts` (`CurrencyArt`) + `contracts/src/badges.ts` (`Badge.glyph`).
**PRODUCER:** Slice 4 (`src/items/itemArt.ts`). **CONSUMERS:** Slice 1 (currency
icons + inventory cells), Slice 1 (badge medals), Slice 2 (HUD wealth/badge glance).

```ts
type IconFamily =
  | "coin-round" | "coin-square-hole" | "bill-rect" | "ingot-bar" | "note-stack"
  | "shell" | "gem-faceted" | "pouch"                              // currency forms
  | "medal"                                                         // badges (fill ring)
  | "token" | "seal" | "letter" | "scroll" | "garment" | "foodstuff"
  | "vessel" | "tool" | "key" | "charm" | "cloth"                  // items
type IconFinish = "matte" | "glazed" | "metal" | "woven"
type IconRarity = "common" | "rare" | "epic" | "seasonal"

interface IconSpec {
  family: IconFamily; palette: string; finish?: IconFinish; rarity?: IconRarity
  motif?: string; accent?: string
  metal?: "gold" | "silver" | "copper" | "bronze" | "patina"
  seed?: number
  fillArc?: number; tier?: BadgeTier        // badge medals only (progress ring + tier metal)
}
interface IconRenderer {
  renderIcon(spec: IconSpec, target?: { size: number }): HTMLCanvasElement
  iconDataUrl(spec: IconSpec, target?: { size: number }): string
}
```

- **One renderer, three targets:** in-world canvas cutout, DOM `<canvas>` cell,
  CSS background data-URL. Currencies/denominations map `CurrencyArt.shape` →
  `IconSpec.family`; badges use `family:"medal"` with `fillArc`+`tier`; items use
  their silhouette family. Reduced-motion respected (no glint animation).
- **Quality bar:** instantly distinguishable at 24px by silhouette + color.

**Stub** (a labeled disc until Slice 4 lands the painted renderer):
```ts
const stubIconRenderer: IconRenderer = {
  renderIcon(spec, t) {
    const s = t?.size ?? 32, c = document.createElement("canvas"); c.width = c.height = s
    const x = c.getContext("2d")!; x.fillStyle = spec.palette; x.beginPath()
    x.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); x.fill(); return c
  },
  iconDataUrl(spec, t) { return this.renderIcon(spec, t).toDataURL() },
}
```

---

## SEAM 3 — Top-HUD glance getters + Immersion + Localization

**File:** `src/contracts/runtime.ts`. **CONSUMER:** Slice 2 (Top-HUD).
**PRODUCERS:** economy (`walletGlance`), badges (`focusBadge`) — both Slice 1;
net (`presenceCount`) — orchestrator/existing; track (`trackPair`) — Slice 1;
immersion resolver — Slice 1 (or a dedicated immersion slice); `t` — Slice 4/loc.

```ts
interface WalletGlance     { topCurrency: CurrencyId; major: string; icon?: IconSpec }
interface FocusBadgeGlance { badgeId: BadgeId; glyph: string; tier: BadgeTier; arc: number; icon?: IconSpec }
interface TrackPairGlance  { native: LanguageCode; target: LanguageCode; immersion: "off"|"reveal"|"on" }

interface HudGlances {                         // EVERY getter OPTIONAL → omit-graceful
  walletGlance?: () => WalletGlance | null     // economy → deep-links to Wallet tab
  focusBadge?:   () => FocusBadgeGlance | null // badges  → deep-links to Badge Case (replaces ✨ integer)
  presenceCount?: () => number                 // net     → "● N" pip; 0/absent when solo
  trackPair?:    () => TrackPairGlance | null  // track   → flag-pair lozenge + immersion pip
}
```

**The rule:** the HUD checks presence and OMITS the row when a getter is absent or
returns null (no economy → no wealth row; no badges → no focus chip; solo → no
pip). The HUD loads no heavy state — the pack (satchel) is the ledger; the HUD
is the glance. Each numeric row is a button deep-linking via the existing
`shell.openSection("wallet" | "badges" | "quest")`.

**Immersion resolver** (IMMERSION_TOGGLE — PRODUCER: Slice 1; CONSUMERS: all UI):
```ts
type Immersion = "off" | "reveal" | "on"
interface ImmersionResolver {
  level(): Immersion                       // forced "on" if target===native
  hideNative(): boolean                    // "reveal" | "on"
  offerReveal(): boolean; proactiveReveal(): boolean
  uiLocale(): LanguageCode                 // hideNative() ? target : native
  challengeNativeLanguage(): LanguageCode | undefined  // undefined hides native → target-only
  languageDiscipline(target: string, native: string): string
  resolveStrings<T>(native: T, target: T, opts?: { keepNative?: boolean }): T
}
```
**Stub** (always-OFF resolver — every surface shows native, behaves as today):
```ts
const offResolver = (native: string): ImmersionResolver => ({
  level: () => "off", hideNative: () => false, offerReveal: () => false, proactiveReveal: () => false,
  uiLocale: () => native, challengeNativeLanguage: () => native,
  languageDiscipline: (t, n) => `Reply in ${t} ONLY (one tiny (${n}) gloss allowed for a new word).`,
  resolveStrings: (n) => n,
})
```

**Localization seam** (LOCALIZATION_SCALE — PRODUCER: Slice 4/loc; CONSUMERS: all):
```ts
type Translate = (key: string, lang: string, params?: Record<string, string|number>) => string
```
Per-key English fallback (never blank); collapses variants (`ko-polite`→`ko` …).
`lang` = the Track's `native` for UI; `target` for segues/NPC speech; the
immersion resolver's `uiLocale()` picks which side. **Stub:** `(key) => key` (or
the existing `challengeStrings` EN table) until the generated `LOCALES` land.

---

## SEAM 4 — `MapView` bundle (COHESION M3)

**File:** `src/contracts/runtime.ts`. **PRODUCER:** orchestrator (assembles from
topology + player + net + quest engine). **CONSUMER:** Slice 3 (minimap + full map).

```ts
interface RemotePresence { playerId: string; name: string; pos: PlayerPosition }
interface MapView {
  topology: RoomTopology
  getPlayerPos(): PlayerPosition
  getRemotePositions(): RemotePresence[]            // [] when solo/offline
  getQuestMarkers(): QuestMarker[]                  // current objective anchor + unmet source hints
}
```
- `getQuestMarkers()` = `questEngine.getQuestMarkers()` (already implemented:
  `{ anchorId, kind: "objective"|"source-hint", itemId? }`). The map resolves
  `anchorId` → coords via `topology.anchors`, preferring `Anchor.kind` (Seam 6).
- MVP map is a **stylized schematic** behind this seam (premium + cheap); a 3D
  upgrade slots in later with no consumer change.

**Stub** (solo, current scene):
```ts
const stubMapView = (topology: RoomTopology, getPos: () => PlayerPosition, qe: QuestEngine): MapView => ({
  topology, getPlayerPos: getPos, getRemotePositions: () => [], getQuestMarkers: () => qe.getQuestMarkers(),
})
```

---

## SEAM 5 — `SpecialNpcResolver` + `content/npc/special.json` (COHESION M2)

**File:** `src/contracts/runtime.ts`. **PRODUCER:** Slice 3. **CONSUMERS:**
orchestrator (marks held specials, passes `questEngine` into their dialogue),
the quest engine (routes delivery only through the marked NPC).

```ts
interface SpecialNpcDef {                  // one entry of content/npc/special.json
  anchorId: string                          // matches Anchor.id (prefer Anchor.kind for placement)
  questId: string
  role: string                              // abstract NPC role id (composes persona/prompt)
  name: string                              // "Serafina","the boatman"
  stepIds?: string[]                        // which steps this NPC handles (else any step at its anchor)
}
type SpecialNpcContent = SpecialNpcDef[]

interface SpecialNpcResolver {
  isSpecial(anchorId: string, questId: string): boolean
  forAnchor(anchorId: string, questId: string): SpecialNpcDef | null
  forQuest(questId: string): SpecialNpcDef[]
}
```
- You can talk to anyone, but only the marked NPC at the step's anchor accepts the
  item / advances the quest (deterministic — the model is the mouth, the engine
  the referee). Specials are visually distinguishable (a `CharacterLook` flag
  behind the existing `WorldLook` seam — orchestrator wiring).

**Stub** (no specials → every NPC generic, delivery falls back to anchor-id match):
```ts
const noSpecials: SpecialNpcResolver = { isSpecial: () => false, forAnchor: () => null, forQuest: () => [] }
```

---

## SEAM 6 — Typed topology anchors (`Anchor.kind`)

**Data shape:** `contracts/src/room.ts` (additive). **PRODUCER:** Slice 4
(topology generator). **CONSUMERS:** Slice 3 (special NPCs + map markers/legend),
quests (bind steps to anchor types), personas (tend the right anchor).

```ts
const AnchorKind = z.enum([
  "vendor","npc_station","docks","city_gate","fountain","merchant",
  "portal","bench","spawn","decor","landmark",
])
// Anchor gains: kind?: AnchorKind   (OPTIONAL — hand-authored topologies stay valid)
```
- Quests/specials/map **prefer `kind` when present, else map the coarse `role`**
  (`vendor`→`vendor`, `npc_station`→`npc_station`, etc.). The route quest's
  `docks` / `city_gate` steps bind to anchors of those kinds. Generated topologies
  emit typed anchors; the connectivity/reachability gate is Slice 4's QA.

---

## Data shapes (`contracts/src/*`) — what each slice reads/writes

### `track.ts` (Slice 1 owns the runtime; this file is the data spine)
- `TrackId = ${native}:${target}` (branded), `trackId()`, `parseTrackId()`,
  `isImmersionTrack()`, `trackNamespace(id) = wp:track:{id}`.
- `TrackState` — the SMALL manifest (id, native/target, identity, avatar,
  pathId/levelIndex/activeSceneId/activeQuestId, `immersion: off|reveal|on`,
  timestamps, `schemaV: 1`). Economy/quest/badge bodies are NOT inlined — they
  live in their own compact records under `trackNamespace(id)`.
- `TrackHeadline` + `TrackRegistry` (`wp:tracks:index:v1`, localStorage,
  denormalized so the picker paints without loading heavy stores; also the
  privacy-clean analytics surface — `(native,target)` only, never displayName).

### `economy.ts` (Slice 1 owns the runtime — ECONOMY_CURRENCY)
- `CurrencyId` (branded), `Wallet = Record<currencyId, minorUnits>` (integers,
  nonnegative), `CurrencyArt`, `Denomination`, `Currency`, `RewardTable`,
  `RewardGrant` (the multi-currency reward — `currency?: Wallet` + legacy `coins?`).
- `EconomyTransaction.delta.currency?: Wallet` (additive; legacy `coins` stays).
- **Migration-compatible with today's `coins`:** `coin-base` legacy currency for
  migration only (never the moon glyph again); `RewardGrant.coins`/legacy
  `EconomyState.coins` map on read to the Track's default currency. Currency
  DEFINITIONS/goods/markets are GLOBAL CDN catalog data; only balances/positions/
  history are per-Track (`wp:track:{id}:economy`).

### `badges.ts` (Slice 1 owns the runtime — BADGES_PROGRESSION)
- `BadgeId` (stable, facet-derived, e.g. `F:travel:vocab:A2`), `BadgeFamily`
  (A–K), `BadgeTier` (`locked|bronze|silver|gold|platinum`), `Badge` (catalog
  def, never persisted), `BadgeDeposit` (the XP→badge routing input from a
  challenge/quest result — the prompt's "BadgeDeposit"; doc working name
  `XpDeposit`), `BadgeProgress`, `PersistedBadges` (compact, touched-only,
  `wp:track:{id}:badges` in IndexedDB).

### `room.ts` — `AnchorKind` + `Anchor.kind?` (Seam 6 above).

---

## Recommended agent → file-ownership map (for orchestrator fan-out)

Disjoint file ownership so the four slices never collide. `game.ts` /
`worldLook.ts` / `styles.css` / `contracts/*` are **orchestrator-owned** (agents
hand wiring patches; the orchestrator serializes merges). Each agent reports a
wiring patch behind its getters/hooks.

### Slice 1 — Foundation + Economy + item-art glue  *(produces the most seams)*
- **Owns:** `src/storage/trackStore.ts` (NEW — `TrackStore` impl), `src/track/*`
  (NEW — `Track`/`TrackManager`/`migrate`/`picker`), parameterizes
  `src/economy/inventory.ts` (+ `Wallet`, `{namespace,store}`),
  `src/economy/currencies.ts` (NEW), `src/economy/priceSim.ts` (NEW, shared with
  server), `src/economy/exchange.ts` (NEW), `src/economy/market/*` (NEW),
  `src/badges/{router,badgeStore,catalog}.ts` (NEW), `src/immersion/immersion.ts`
  (NEW — `ImmersionResolver`).
- **Produces:** `TrackStore`, `TrackManager`/`Track`, `walletGlance`, `focusBadge`,
  `trackPair`, `ImmersionResolver`, the per-Track inventory/quest/badge namespacing.
- **Consumes:** `IconRenderer` (stub until Slice 4), `Translate` (stub until loc).
- **Serializes on:** S1 (its own — it's the producer), S3 (game.ts wiring).

### Slice 2 — Top-HUD redesign  *(pure consumer; fully parallel)*
- **Owns:** `src/quest/questTracker.ts` (evolve → `.wp-status` capsule + glance
  rows + expand), `src/shell/placeTag.ts` (NEW — `.wp-placetag`),
  `src/shell/chromeVisibility.ts` (NEW — the visibility state machine helper).
  CSS blocks for `.wp-status*` / `.wp-placetag` (handed to styles.css owner).
- **Produces:** nothing (consumes glances). The `ChromeState` machine + the
  `setChromeState` edges are wiring it hands the orchestrator.
- **Consumes:** `HudGlances` (all 4 getters, omit-graceful), `ImmersionResolver`
  (`uiLocale`), `Translate`, `shell.openSection`. Builds today against ALL stubs.
- **Serializes on:** S3 only (game.ts wires `setChromeState` into the 5 existing
  edges). No code dependency on slices 1/3/4.

### Slice 3 — Cohesion M2 special NPCs + M3 map  *(consumer + one producer)*
- **Owns:** `src/quest/specialNpc.ts` (NEW — `SpecialNpcResolver`),
  `content/npc/special.json` (NEW), `src/map/minimap.ts` + `src/map/fullMap.ts`
  (NEW). CSS for `.wp-minimap` / `.wp-map`.
- **Produces:** `SpecialNpcResolver` (+ the `special.json` shape).
- **Consumes:** `MapView` (orchestrator-fed; stub = solo schematic), typed
  `Anchor.kind` (Seam 6 — falls back to `role` if a topology lacks `kind`),
  `questEngine.getQuestMarkers()` (exists).
- **Serializes on:** S3 (game.ts constructs/ticks minimap, marks held specials).
  Map works today against the solo stub; specials work against the existing
  `es-guadalajara-route` anchors.

### Slice 4 — Content variety (faces / topology / item-art)  *(produces IconRenderer + anchors)*
- **Owns:** `src/items/itemArt.ts` (NEW — `IconRenderer`), the face section of
  `src/character/characterArt.ts` + `FaceSpec` axes in `src/character/characterSpec.ts`,
  `src/world/topologyGen.ts` (NEW — typed-anchor `RoomTopology` generator) +
  `LayoutSpec`, the art side of `content/items/catalog.json`, the `faceKit`/
  topology QA harnesses.
- **Produces:** `IconRenderer` (Seam 2 — unblocks economy/badge/inventory pixels),
  typed `Anchor.kind` topologies (Seam 6).
- **Consumes:** the Track seed/namespace (per-Track-scoped generation), `Translate`
  (authored strings). Faces/topology block no one.
- **Serializes on:** S2 (economy/badges await the real `IconRenderer` only for
  final polish — their LOGIC ships against the stub).

### Orchestrator (single owner, serialized merges)
- **Owns:** `src/game.ts`, `src/render/worldLook.ts`, `src/styles.css`,
  `contracts/*`. Assembles `MapView`, feeds `HudGlances` from the slices' getters,
  routes the 5 chrome-visibility edges into `setChromeState`, runs the Track
  switch sequence (`flush → switchTo → rebuildSceneVisuals → re-skin avatar →
  rebind inventory/quest/badges → re-render HUD`), and verifies in the REAL
  embedded app on phone+tablet+desktop.

---

## Freeze checklist (what "approved" locks)
- The six seam interfaces in `src/contracts/runtime.ts` (signatures + the
  optional/omit-graceful discipline).
- The data shapes in `contracts/src/{track,economy,badges,room}.ts` at
  `CONTRACTS_VERSION = "0.1.0"` (additive; the migration compatibility of `coins`
  → default currency; touched-only badge persistence; `Anchor.kind` optional).
- The producer→consumer assignment + the three genuine serialization points (S1
  TrackStore, S2 IconRenderer, S3 game.ts) — everything else parallel-via-stub.

Changes after freeze are **additive optional fields only** (prefer a new optional
getter over editing a signature) to avoid cross-slice churn.
