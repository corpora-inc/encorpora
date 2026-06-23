# Corpan City — Language-Pair State (the Track architecture)

**Status:** Design + sequenced plan. NO code in this doc — it is the spec the
implementation fans out from. **This is the FOUNDATIONAL/keystone doc.** The
other facets (`ECONOMY_CURRENCY`, `BADGES_PROGRESSION`, `IMMERSION_TOGGLE`,
`ANALYTICS_PULSE`, `CONTENT_SCALE`, `LOCALIZATION_SCALE`) all assume the Track
model defined here. Read this first when synthesizing.

**Author intent in one line:** a player's ENTIRE mode/state is **one ordered
language pair at a time — a Track** `(native, target)`. Per Track: their own
character/avatar, inventory (multi-currency), XP/badges, quests/arc, level/path,
immersion setting. Up to 50×49 = **2,450** possible ordered pairs exist; a real
user has **1–5** active. Switching Tracks must be trivial and lossless, and it
must NEVER touch other players or shared room state.

---

## 0. The one-sentence model

> A **Track** is a self-contained save-game keyed by an ordered language pair.
> The **Room** (Colyseus topology + collision) is shared and Track-agnostic; the
> **Scene** and **Quest** are the per-player skins of that Room; the **Track** is
> simply the *outer envelope* that owns the Scene/Quest/avatar/economy/progress
> for one `(native → target)` pairing. Everything that today is a single global
> singleton (`inventory()`, the quest engine, `wp:identity:v1`) becomes
> **one-per-Track**, namespaced by `TrackId`, lazy-loaded for the active Track only.

This is not a new spine. It is the **existing Room×Scene×Quest spine with the
language pair lifted out of the Quest and promoted to a first-class envelope**, so
that all per-player state hangs off the pair instead of off a hidden global.

---

## 1. Track identity + state model

### 1.1 TrackId

```
TrackId = `${native}:${target}`          // e.g. "en:es", "en:fr", "es:en"
```

- Ordered. `en:es` (English speaker learning Spanish) ≠ `es:en` (Spanish speaker
  learning English) — different course, different content, different Track.
- The components are **BCP-47 corpus codes** (the same `LanguageCode` the contracts
  already use — e.g. `"es"`, `"pa-Arab"`, `"sr-Latn"`). Colon is a safe separator
  (never appears in a corpus code).
- **Single-language stack = `native === target`** → `TrackId` like `"es:es"`.
  This is the immersion/native-practice Track (SINGLE_LANGUAGE_RULE): no native
  gloss, the one language is the content language. The TrackId is still well-formed;
  downstream code keys off `native === target` exactly as `composeSystemPrompt`
  already does. **No special-casing of the id format is needed.**

A tiny branded helper (mirrors `ids.ts`):

```ts
// contracts/src/track.ts (NEW)
export const TrackId = z.string().regex(/^[A-Za-z-]{2,}:[A-Za-z-]{2,}$/).brand("TrackId")
export const trackId = (native: string, target: string): TrackId =>
  TrackId.parse(`${native}:${target}`)
export const parseTrackId = (id: string): { native: string; target: string } => {
  const [native, target] = id.split(":")
  return { native, target }
}
export const isImmersionTrack = (id: string) => {
  const { native, target } = parseTrackId(id)
  return native === target
}
```

### 1.2 The per-Track state object

The full state for ONE Track. Each field maps to an EXISTING storage record,
re-namespaced. Nothing here is new gameplay — it is the consolidation of today's
scattered singletons under one envelope.

```ts
// contracts/src/track.ts (NEW)
export const TrackState = z.object({
  id: TrackId,                       // "en:es"
  native: LanguageCode,              // redundant-but-explicit (cheap, avoids re-parsing)
  target: LanguageCode,

  // ---- identity / avatar (today: wp:identity:v1, ONE global) ----
  identity: GeneratedIdentity,       // safe composed name (per-Track persona)
  avatar: AvatarSpec,                // paper-doll layers (per-Track look)

  // ---- economy (today: wp:economy:v1, ONE global inventory()) ----
  // Persisted COMPACTLY by the inventory store; referenced here by namespace,
  // not inlined. See §2. The multi-currency model (ECONOMY_CURRENCY) lives
  // INSIDE this — many currencies, denominations, market positions, all per-Track.

  // ---- quest / progression (today: wp:quest:v1, ONE global engine) ----
  // Likewise namespaced. The active quest + stepDone + xp + complete are the
  // QuestState contract, one per Track. Badges (BADGES_PROGRESSION) are per-Track.

  // ---- curriculum / path / level ----
  pathId: PathId.optional(),         // which LearningPath this Track is walking
  levelIndex: z.number().int().nonnegative().default(0),
  activeSceneId: SceneId.optional(), // the Scene this Track is currently skinned to
  activeQuestId: QuestId.optional(), // the Quest currently loaded for this Track

  // ---- per-Track presentation ----
  immersion: z.boolean().default(false), // IMMERSION_TOGGLE: NO English when ON.
                                          // Forced true when native===target.

  // ---- lifecycle bookkeeping (for the picker + archival) ----
  createdAt: z.number(),             // epoch ms
  lastPlayedAt: z.number(),          // epoch ms — drives "recently played" + eviction
  schemaV: z.literal(1),
})
export type TrackState = z.infer<typeof TrackState>
```

> The economy/quest/badge BODIES are **not inlined** into `TrackState`. They keep
> their own compact records (already optimized in `inventory.ts` /
> `questState.ts`) and are namespaced by TrackId (§2). `TrackState` is the small
> **manifest/envelope**: identity + avatar + which path/scene/quest/immersion +
> timestamps. This keeps the per-Track manifest a few hundred bytes and lets the
> heavy stores stay independently lazy-loaded.

### 1.3 Per-Track vs truly global

| Concern | Scope | Today | Becomes |
|---|---|---|---|
| Display name / persona | **per-Track** | `wp:identity:v1` (global) | `wp:track:{id}:identity` |
| Avatar / dress | **per-Track** | inside `wp:identity:v1` | part of TrackState manifest |
| Inventory / currencies | **per-Track** | `wp:economy:v1` (global) | `wp:track:{id}:economy` |
| XP / badges | **per-Track** | `wp:quest:v1` xp (global) | `wp:track:{id}:badges` (+ quest xp) |
| Active quest + stepDone | **per-Track** | `wp:quest:v1` (global) | `wp:track:{id}:quest` |
| Path / level index | **per-Track** | (not persisted yet) | TrackState manifest |
| Immersion toggle | **per-Track** | (n/a) | TrackState manifest |
| **Track registry** (which Tracks exist + which is active) | **global** | (n/a) | `wp:tracks:index:v1` |
| **playerId** (anon, stable device identity) | **global** | minted ad-hoc | `wp:player:id` (one per device) |
| Device/TTS/voice prefs, reduced-motion | **global** | host-owned | host `getStackConfig()` / settings |
| Anon analytics id | **global** | (n/a) | one per device (ANALYTICS_PULSE owns) |
| Intro-seen flags (onboarding) | **global** | `wp:quest:intro:v1` | stays global (per device) |

**Rationale for the boundaries:**

- **One device = one human = one `playerId`.** The Track does NOT mint a new
  player identity — multiplayer presence is *one person* who happens to be on the
  `en:es` Track right now. Remote players see *you*, skinned by *their* Scene; your
  Track is invisible to them (§5). So `playerId` is global and stable; the
  *displayName/avatar* are per-Track (you can be "Brave Marigold" in your Spanish
  life and "Calm Heron" in your French life — a feature, not a bug).
- **TTS/voice/reduced-motion are device prefs**, not learning state — global.
- **The Track registry is the only genuinely new global record** — a tiny index of
  TrackIds + their last-played timestamps + which is active.

### 1.4 The global registry record

```ts
// contracts/src/track.ts (NEW) — the ONE new global record
export const TrackRegistry = z.object({
  activeTrackId: TrackId.optional(),       // resume target on next launch
  tracks: z.array(z.object({
    id: TrackId,
    native: LanguageCode,
    target: LanguageCode,
    lastPlayedAt: z.number(),
    createdAt: z.number(),
    // denormalized HEADLINE for the picker so it renders WITHOUT loading each
    // Track's heavy stores (name to greet, a level/badge count, a currency glance):
    headline: z.object({
      displayName: z.string(),
      levelIndex: z.number().int().nonnegative(),
      xp: z.number().nonnegative(),          // coarse, for a progress glance
      immersion: z.boolean(),
    }),
  })),
  schemaV: z.literal(1),
})
export type TrackRegistry = z.infer<typeof TrackRegistry>
```

The registry is **denormalized on purpose**: the start-screen picker renders the
full list of Tracks (name, level, xp glance) by reading ONLY `wp:tracks:index:v1`
— it never loads any Track's economy/quest stores. Those load lazily when a Track
is *activated*. Headlines are refreshed cheaply on Track deactivation (a single
write of small numbers).

---

## 2. Storage architecture

### 2.1 Principle: namespace everything by TrackId; lazy-load the active Track only

Per `corpan-pack-storage` (all packs share one ~5 MB localStorage origin budget)
and the project memory's IndexedDB-for-big-caches rule:

- The **registry** (`wp:tracks:index:v1`) and **global** records (`wp:player:id`,
  intro flags) stay in **localStorage** — tiny, read once at boot.
- **Per-Track heavy state** (economy, quest, badges) moves to **IndexedDB**,
  keyed `wp:track:{TrackId}:{store}`. IndexedDB is quota-safe (tens of MB+), so
  thousands of Tracks never threaten the shared 5 MB localStorage budget.
- Only the **active Track's** stores are resident in memory. Activating a Track
  loads its records; deactivating flushes + drops them.

### 2.2 The store-namespace seam (minimal, surgical)

Today `inventory.ts` and `questState.ts` hard-code `STORE_KEY = "wp:economy:v1"`
/ `"wp:quest:v1"` against `localStorage`. The change is small and isolated:

1. Introduce a tiny `src/storage/trackStore.ts` (NEW) — an async
   key→JSON store over **IndexedDB** with a `localStorage` fallback (so standalone
   dev and SSR-less environments still work; noisy on fallback). Interface:

   ```ts
   interface TrackStore {
     read<T>(key: string): Promise<T | null>
     write(key: string, value: unknown): Promise<void>   // quota-safe, never throws
     remove(key: string): Promise<void>
     keys(prefix: string): Promise<string[]>             // for archival/eviction
   }
   ```

2. `createInventory()` / `createQuestEngine()` gain a `namespace: string` option
   (`wp:track:{id}`) and take an injected `TrackStore` instead of touching
   `localStorage` directly. Their compact serialize/persist logic is UNCHANGED —
   only the *key* and the *backing store* are parameterized. The quota-safe
   discipline already in `inventory.ts` (trim consumables, retry once, log loudly)
   is preserved verbatim.

3. The `inventory()` / quest singletons become **per-Track instances** owned by a
   new `Track` object (§4), not process-wide singletons. The existing
   `inventory()` free function is kept as a thin "active Track's inventory"
   accessor during migration so unrelated call-sites (shop, HUD) don't all churn
   at once — it simply returns `activeTrack().inventory`.

### 2.3 Footprint math (why thousands of Tracks stay cheap)

- **Per-Track manifest** (`TrackState` without inlined bodies): name + avatar
  (≤8 layers) + a handful of ids/numbers ≈ **300–500 bytes**.
- **Per-Track economy** (compact `[id,qty][]` + equipped + multi-currency
  balances): a maxed bag is a few hundred bytes today; with the multi-currency
  model (ECONOMY_CURRENCY) call it **≤1.5 KB**.
- **Per-Track quest** (`{questId, stepDone, xp, complete}`): **<1 KB**.
- **Per-Track badges** (BADGES_PROGRESSION, ~1000 badges/lang as a sparse
  filled-count map — only touched badges stored): realistically **1–4 KB** for an
  engaged Track.
- **Registry headline per Track**: ~120 bytes.

So a **heavily-played Track** is ~5–7 KB; **2,450 such Tracks** ≈ **12–17 MB** —
comfortably inside IndexedDB, never near the localStorage 5 MB cap. The
**registry** for 2,450 Tracks (headlines only) is ~300 KB, which still fits in
localStorage but we keep the *registry in localStorage and the bodies in IDB* so
even a pathological collector never overflows the shared budget. Realistic users
(1–5 Tracks) are **<50 KB total**.

### 2.4 Eviction / archival of stale Tracks

A Track is *never auto-deleted* (losing a save is a betrayal), but its **heavy
stores can be archived** (not its registry headline):

- **Soft cap:** keep the heavy IndexedDB stores resident for the **N most-recently-
  played** Tracks (default N = 8). Beyond that, on deactivation we *do not delete*
  — IndexedDB holds them indefinitely (cheap). This cap only bounds the *in-memory
  working set*, which is already 1 (only the active Track is resident). So in
  practice **no eviction is needed for memory**; the cap exists only as a future
  knob if a user somehow accumulates pathological Track counts.
- **Explicit archival (user-initiated):** the picker offers "Archive this language"
  → moves the Track's heavy stores to a compacted blob under `wp:track:{id}:archived`
  and drops the live keys; the registry headline stays so it can be one-tap
  restored. This is a power-user nicety, not a requirement.
- **Corruption resilience:** every per-Track read is wrapped (noisy-not-silent);
  a corrupt Track store yields a fresh-but-flagged Track rather than crashing the
  picker. The registry is the source of truth for *existence*; bodies are
  reconstructible-to-empty.

---

## 3. Start-screen target picker

### 3.1 Where it sits in the boot flow

Today `startGame()` does: `loadIdentity()` → if saved `begin()`, else
`runOnboarding()` → save → `begin()`. The Track picker inserts cleanly:

```
startGame()
  ├─ load wp:player:id (mint if absent — ONE per device)
  ├─ load wp:tracks:index:v1 (the registry)
  ├─ FIRST RUN (no tracks):
  │     onboarding (primary-language-first; §3.4) → create the first Track
  │     → activate it → begin()
  └─ RETURNING (≥1 track):
        render the PICKER (§3.2)
          • resume activeTrackId  → activate → begin()
          • pick another existing Track → activate → begin()
          • "Start a new language"    → mini-create flow (§3.3) → begin()
```

### 3.2 The picker UI (premium, in-overlay)

A dignified launch screen — paper-cutout language, on-brand, **mounted inside the
pack root** (the same render-surface discipline as the M0 menu; never
`document.body`). Tablet+desktop+phone first-class.

Layout:

- **Header:** "Where to today?" (localized in the device primary language).
- **Recently played** — the activeTrackId Track as a large primary card:
  > *"Resume — Brave Marigold · English → Spanish · Level 3"* (greets by the
  > per-Track name, shows the flag pair, a slim level/badge glance).
- **Your languages** — the rest of the registry as a grid of compact cards
  (flag pair, per-Track name, level glance, immersion pip if on). Sorted by
  `lastPlayedAt`. Each card renders from the **registry headline only** (no heavy
  load), so the grid paints instantly even with dozens of Tracks.
- **Start a new language** — a quiet "＋" card → the create flow (§3.3).
- **Native-only practice** — surfaced as an explicit choice in the create flow
  ("Just practice my {language}") so the single-language/immersion Track is a
  first-class option, never a hidden mode.

Tapping a card → a soft "stepping into {place}" transition → activate Track →
`begin()`. No app reload.

### 3.3 The create flow (new Track)

When the device stack has multiple languages, "start a new language" lets the
player choose `target` from `hostApi.getStackConfig().languages[1..]` (and
`languages[0]` for native-only). When the stack is **single-language**, the only
Track is `native:native` (immersion) — the create flow short-circuits to it per
SINGLE_LANGUAGE_RULE (no "add a target" gate, ever).

Steps:
1. **Choose target** (or "practice my {native}" for immersion) — from the host
   stack only; we never invent languages the user hasn't added.
2. **Name + dress** — reuse `runOnboarding()`'s name-roller + dress-up *per Track*
   (each Track gets its own persona/avatar). `runOnboarding` is refactored to
   return an `OnboardingResult` the new-Track creator stamps into a `TrackState`.
   For "skip", it uses `defaultIdentity()` exactly as today.
3. **Immersion default** — pre-checked ON for `native===target`; OFF otherwise,
   with a one-line "you can change this anytime" (IMMERSION_TOGGLE owns the copy).
4. Create the Track (write manifest + empty stores + registry headline) →
   set `activeTrackId` → `begin()`.

### 3.4 Integration with primary-language-first onboarding

The app's onboarding is **primary-language-first** (CLAUDE.md: the userClass quiz
+ Plus pitch are localized because the native language is chosen first). World
Plaza honors this: the **device primary language (`languages[0]`) is the `native`
of every Track and the UI language of the picker**. The picker, create flow, and
all per-Track copy localize into `languages[0]` (LOCALIZATION_SCALE owns the
50-language strings). A Track's `target` only ever comes from `languages[1..]`
(or `[0]` for immersion). So: **native is fixed by the device stack; target is the
per-Track choice.** This also means a user with a single-language stack sees a
clean immersion-only experience with no target-picking friction.

---

## 4. In-game Track switcher

### 4.1 Goal

From the in-game **menu** (the M0 `.wp-overlay` menu panel), a player can jump
between Tracks mid-session — save the current Track, swap
character/inventory/XP/quests/scene, **no app reload**. Reuse the live
scene-rebuild seam the pack already proves (Antigua⇄Tokyo).

### 4.2 The `Track` runtime object (the swap unit)

Introduce `src/track/track.ts` (NEW): a `Track` bundles the per-Track runtime
stores so they can be created/torn down as a unit.

```ts
interface Track {
  id: TrackId
  state: TrackState                 // the manifest (name, avatar, path, immersion…)
  inventory: InventoryStore         // namespaced economy store (this Track's)
  questEngine: QuestEngine          // namespaced quest engine (this Track's)
  // badges store, etc. (BADGES_PROGRESSION) — same namespacing
  flush(): Promise<void>            // persist manifest + headline to registry
  dispose(): void                   // unsubscribe stores; drop from memory
}

interface TrackManager {
  active(): Track
  list(): TrackRegistry["tracks"]
  switchTo(id: TrackId): Promise<Track>     // save current → load target
  createTrack(native, target, onboarding): Promise<Track>
  archive(id: TrackId): Promise<void>
}
```

`inventory()` (the free function many call-sites use) becomes
`() => trackManager.active().inventory` — so the HUD, shop, and challenge reward
path keep working unchanged through the migration.

### 4.3 The teardown/rebuild seam (what actually swaps)

The orchestrator (`game.ts`) already separates **scene-DEPENDENT visuals** (which
`rebuildSceneVisuals` disposes+rebuilds) from **gameplay systems** (player, crowd,
input, camera — untouched by a scene flip). The Track switch reuses and extends
exactly this seam. What rebuilds on a Track switch vs what stays:

| System | On a Track switch |
|---|---|
| World engine, canvas, camera, input, collision/obstacles, crowd meshes | **STAY** (Room is shared; topology unchanged) |
| Scene visuals (atmosphere, vista, ground/buildings/dressing) | **REBUILD** to the new Track's `activeSceneId` — *reuses `rebuildSceneVisuals`* |
| Player avatar mesh | **RE-SKIN** to the new Track's `avatar` (grounded cutout swap — the avatar is already data; pass the new `AvatarSpec`) |
| `inventory()` binding | **REBIND** to the new Track's store (HUD/shop re-render on the next `subscribe` tick) |
| `questEngine` | **REBUILD** for the new Track's active quest; **tracker re-subscribes** |
| HUD (coins/xp), quest tracker, minimap markers | **RE-RENDER** from the new bindings |
| NPC dialogue runtime, challenge host | **STAY** (host-level), but next `open()` uses the new Track's `learnerPair`/quest |
| Net/presence | **STAY connected** — only the *presence payload* (`sceneId`/`questId`) updates (§5); the player does NOT leave/rejoin the room |

Switch sequence (in `game.ts`, single-owner orchestration):

```
1. setWorldActive(false); npcRuntime.onBackground()      // freeze sim + free LLM
2. await trackManager.active().flush()                    // persist current Track + headline
3. const next = await trackManager.switchTo(id)           // load target's stores
4. rebuild bindings:
     - rebuildSceneVisuals(scene for next.state.activeSceneId)   // EXISTING seam
     - player.setAvatar(next.state.avatar)                       // re-skin local avatar
     - rebind inventory() HUD subscription; re-render HUD
     - dispose old questEngine + tracker; build new questEngine; remount tracker
     - learnerPair = next quest.learnerPair (drives next NPC open + challenge ctx)
5. update presence payload (sceneId/questId) on the live net client (§5)
6. setWorldActive(true)                                   // resume
```

No `dispose()` of the world engine, no app reload, no Colyseus rejoin. The switch
is a **rebind**, exactly like the scene flip is a re-skin. A brief in-overlay
"stepping into your {target} life…" transition card masks the rebuild (≤300 ms).

### 4.4 Switcher UX in the menu

The menu (M0) gains a **"Switch language" row** opening a compact sheet that
reuses the picker's card rendering (§3.2) — recently played + your languages +
"start a new language". Choosing a card runs §4.3. The currently-active Track is
marked. This is the in-session twin of the launch picker; they share the card
component and the registry read.

---

## 5. Rooms vs Tracks (formal separation)

**Invariant (non-negotiable): the Track is PERSONAL; the Room is SHARED and
Track-agnostic. A Track change has ZERO effect on other players or on global room
state.** This is the existing Room×Scene×Quest divergence, with the pair lifted
into the per-player envelope.

### 5.1 What the Room owns (shared, authoritative)

`PlazaRoom` (`server/`) owns ONLY: positions, movement validation, spawns,
reconnection. Its state is `players: Map<sessionId, PlayerState>` where
`PlayerState` carries `{ playerId, name, avatar(JSON), x, z, facing, sceneId,
questId, t }`. **The server already does NOT know or care about language pairs** —
and it must stay that way. Matchmaking (`maxClients`, sortBy) is purely by
population on a shared topology; it **ignores Track entirely**. Two players on
`en:es` and `fr:de` share the same plaza room and collide in the same geometry.

### 5.2 What each client carries (per-player, Track-derived)

A client's presence payload is **derived from its active Track**:
- `name` ← `activeTrack.state.identity.displayName` (the per-Track persona)
- `avatar` ← `activeTrack.state.avatar`
- `sceneId` ← `activeTrack.state.activeSceneId`
- `questId` ← `activeTrack.state.activeQuestId`

`target`/`native` are **NOT broadcast as gameplay state** — they are private. The
only place the pair appears on the wire is *implicitly* via `sceneId`/`questId`
(which a Track chose), and those are already broadcast for skinning. The remote
client renders the incoming `avatar`/`name` **skinned into ITS OWN Track's Scene**
(divergent worlds, shared collision) — exactly what `netClient`'s
`createRemoteAvatar(..., { theme: opts.theme })` already does: it re-skins the
remote into the local scene's wardrobe theme. So a player on the Tokyo-skinned
French Track sees a player on the Antigua-skinned Spanish Track *as an
Antigua-or-Tokyo figure depending on the viewer's theme* — never the other
player's private pair.

### 5.3 No global-state contamination

- Switching Tracks updates **only the local client's presence payload** (name /
  avatar / sceneId / questId) via a `room.send`/state-update on the *existing*
  connection. The player does **not** leave or rejoin; remotes simply see the
  local avatar's skin/name update (the same channel that already streams avatar).
- The server writes that update into *that one player's* `PlayerState` leaf — it
  cannot touch another player's state, and there is no shared "current pair" field
  anywhere. **There is structurally no global field a Track could corrupt.**
- The future mediated-chat seam (`netClient` docs) frames each artifact by the
  *recipient's* quest — which is the recipient's Track's quest — so even chat is
  rendered per-viewer-Track with no cross-contamination.

### 5.4 Presence-payload update on switch (small server touch, optional)

Today the client sends scene/quest only at `joinOrCreate`. To reflect a mid-
session Track switch to others, add a tiny `room.send("presence", {name, avatar,
sceneId, questId})` handler that updates the sender's own `PlayerState` leaf
fields (validated, same discipline as `"move"`). This is additive, alongside
`"move"`, and is the ONLY server change Tracks require. If the server lacks it
(old build), the switch still works locally and degrades to "remotes see your old
skin until you next move/rejoin" — best-effort, never blocking.

---

## 6. Migration from today's single state

Today there is exactly one global identity (`wp:identity:v1`), one global economy
(`wp:economy:v1`), one global quest (`wp:quest:v1`), and a hard-coded quest
(`es-guadalajara.json`, `learnerPair` baked into the quest JSON). Migration must
fold this into a **default Track** with **zero data loss**, and old saves must
stay valid.

### 6.1 One-time migration (idempotent, on first boot of the Track build)

`src/track/migrate.ts` (NEW), run once before the picker:

```
if (no wp:tracks:index:v1):
  if (wp:identity:v1 exists OR wp:economy:v1 exists OR wp:quest:v1 exists):
    # An existing player — fold their single state into a default Track.
    native  = host primary language (languages[0]) ?? quest.learnerPair.native ?? "en"
    target  = saved quest's learnerPair.target ?? quest.learnerPair.target ?? native
    id      = trackId(native, target)
    # COPY (not move-yet) the legacy records into the Track namespace:
    wp:track:{id}:economy  ← migrate(wp:economy:v1)   # same compact shape
    wp:track:{id}:quest    ← migrate(wp:quest:v1)
    manifest.identity/avatar ← wp:identity:v1
    manifest.activeQuestId ← the hard-coded quest id; activeSceneId ← "antigua"
    write registry { activeTrackId: id, tracks: [headline(id)] }
    # Leave the legacy keys in place (don't delete) for one release as a safety
    # net — a rollback to an older build still finds them. A later release can GC.
  else:
    # Brand-new player — no migration; the picker's first-run path creates the
    # first Track via onboarding.
    write empty registry
```

- **Idempotent:** keyed on "no registry yet" — runs at most once.
- **Lossless:** legacy economy/quest records are COPIED (shape-compatible:
  inventory's `[id,qty][]` and quest's `{questId,stepDone,xp,complete}` are
  re-used verbatim under the new namespace). The old keys remain for one release.
- **Old saves valid:** the inventory/quest stores' existing version guards
  (`STORE_VERSION` checks, "drop unknown ids", "different quest → fresh") are
  inherited unchanged inside the Track namespace.
- **playerId:** the existing `"player-local"` default (or any minted id) is
  promoted to the global `wp:player:id`; the migrated Track's identity keeps its
  `playerId` branding.

### 6.2 Backwards compatibility for in-flight code

During the transition, the `inventory()` and quest singletons are re-pointed at
*the active Track's* stores (§4.2). Call-sites that import `inventory()` need NO
change. The hard-coded `questJson` import in `game.ts` becomes "the default
Track's quest, loaded by path/level" — but for the MVP the default Track simply
keeps loading `es-guadalajara.json` as its `activeQuestId`, so cohesion work
(COHESION_ITERATION) lands unchanged on top of the Track envelope.

---

## 7. Scaling + analytics hook

### 7.1 Global scale

- **Per device:** 1–5 Tracks typical; storage <50 KB; one resident at a time.
- **Worldwide:** the set of *active Tracks* across all anon users is the
  population of the 2,450 ordered-pair "modes." Most users cluster on a few
  high-traffic pairs (`*:en`, `en:es`, `en:fr`, …); the long tail (e.g. `sw:zh`)
  is sparse but supported because a Track is just data over the shared spine —
  **no per-pair code or content fork.** A new pair "exists" the moment a user with
  that native/target stack creates it; quests/scenes are pair-parameterized
  templates (Quest doc: "stamped out toward all 2,450 ordered pairs").
- **Server scale is independent of Track count** — `PlazaRoom` is Track-agnostic
  (§5), so the room/matchmaking layer never multiplies by pairs. Rooms shard by
  *population on a topology*, not by language.

### 7.2 Analytics hook (expose data; ANALYTICS_PULSE owns the pulse)

The Track model is a rich, privacy-clean signal: **which (native→target) pairs an
anon user actively plays, and how far** (level/xp glance from the registry
headline). This doc only **exposes** the data; the aggregate, opt-outable,
identity-free pulse design is `ANALYTICS_PULSE.md`'s job. The exposed surface:

- `TrackManager.list()` → `[{ id, native, target, lastPlayedAt, headline:{levelIndex, xp} }]`
  — already denormalized in the registry, so analytics reads it for free without
  loading heavy stores.
- A coarse `activeTrackId` (which pair is in play this session).
- **No PII, no displayName in the pulse** (the per-Track name is a local persona;
  it stays on device). The analytics doc must aggregate `(native,target)` counts
  only, never tie them to a user. Flag the principle tension there, not here.

---

## 8. Phased build plan

Disjoint workstreams; `game.ts`/`styles.css` are orchestrator-owned (single owner
per merge window, additive diffs behind the data getters/hooks each phase defines).
Sequenced so the keystone lands first and the other facet docs can build on it.

### Phase 0 — Contracts + storage seam (foundation, blocks nothing else)
- **Owner: contracts.** `contracts/src/track.ts` (NEW): `TrackId`, `TrackState`,
  `TrackRegistry`, helpers. Bump `CONTRACTS_VERSION` (additive). Export from index.
- **Owner: storage.** `src/storage/trackStore.ts` (NEW): IndexedDB key→JSON store
  + localStorage fallback, quota-safe, noisy. Parameterize `createInventory` /
  `createQuestEngine` with `{ namespace, store }` (their serialize logic
  unchanged). Keep `inventory()` free-function as an active-Track accessor.
- **Exit:** unit-level — an inventory/quest store reads+writes under
  `wp:track:en:es:*` in IndexedDB; `tsc` green; no behavior change yet (default
  namespace == active Track).

### Phase 1 — MVP: TrackManager + migration + 2-Track in-game switcher
This is the shippable MVP the prompt calls out.
- **Owner: track.** `src/track/track.ts` (NEW, `Track` + `TrackManager`),
  `src/track/migrate.ts` (NEW, §6). `inventory()`/quest singletons re-point at
  `trackManager.active()`.
- **Orchestrator (`game.ts`):** boot through `migrate()` → load registry →
  activate `activeTrackId` (or create default) → `begin()` with the active Track.
  Implement the §4.3 switch sequence behind a `trackManager.switchTo` call; wire a
  menu "Switch language" row (reuses picker cards) for **2 Tracks** to start
  (e.g. `en:es` + `en:fr`), proving the rebind/scene-reskin/avatar-swap path with
  no reload. Update presence payload locally; best-effort server `"presence"` send.
- **Exit (verify in the REAL embedded app, not just standalone):** create two
  Tracks; play a level on `en:es`; switch to `en:fr` from the menu → separate
  avatar/inventory/xp/quest, scene re-skins, no app reload; switch back → `en:es`
  state intact. Migration: an existing single-state save loads as the default
  Track with its coins/xp/quest progress preserved.

### Phase 2 — Full start-screen picker + create flow
- **Owner: picker.** `src/track/picker.ts` (NEW, §3.2 launch picker + §3.3 create
  flow), CSS, localized strings (LOCALIZATION_SCALE pattern). Reuses
  `runOnboarding` for per-Track name/dress (refactor it to return a result the
  picker stamps into a TrackState).
- **Orchestrator (`game.ts`):** boot now renders the picker for returning users
  (resume / pick / new / native-only); first-run creates the first Track via the
  create flow. Honor primary-language-first + SINGLE_LANGUAGE_RULE (§3.4).
- **Exit:** launch shows recently-played + your-languages grid from the registry
  headline alone (no heavy loads); "start a new language" creates an
  independent Track; single-language stack → clean immersion-only path.

### Phase 3 — Archival, scale hardening, analytics surface
- **Owner: track.** Explicit "Archive this language" (§2.4), resident-set cap
  knob, corruption-resilient picker. `TrackManager.list()` exposed for
  ANALYTICS_PULSE (no pulse here — just the read surface, §7.2).
- **Server (optional, additive):** the `"presence"` message handler (§5.4) so
  mid-session switches reflect to remotes. Track-agnostic matchmaking is already
  true — assert it with a test that two different-pair clients share a room.
- **Exit:** a synthetic 100-Track registry renders the picker instantly; archive/
  restore round-trips losslessly; two different-pair clients verified in one room.

### Orchestrator-owned coordination (single owner, serialize)
- **`src/game.ts`** — touched by every phase; each phase lands its wiring behind
  the `TrackManager` getters/hooks it defines, so diffs are additive.
- **`src/styles.css`** — only the picker/switcher `.wp-*` blocks; additive.
- **`runOnboarding`** — refactored once (Phase 2) to be per-Track-callable;
  guarded so Phase 1's migration/default path doesn't depend on the refactor.

### Required contract additions (consolidated, additive)
- `contracts/src/track.ts`: `TrackId`, `TrackState`, `TrackRegistry` (+ helpers).
- No breaking changes; bump `CONTRACTS_VERSION` per the additive change.
- Optional server `"presence"` message type (server-only, no contract break).

### Cross-cutting requirements (every phase)
- **Premium/understated/elegant**, no Duolingo dark patterns; the picker informs,
  never nags. Tablet+desktop+phone all first-class; every surface mounts in the
  pack root (never `document.body`), safe-area aware, touch+pointer+ESC wired.
- **Localize every new string** (~50 langs) via the existing per-locale override
  pattern; the picker/switcher/create copy all go through it.
- **SINGLE_LANGUAGE_RULE:** `native===target` is a first-class immersion Track; no
  "add a target" gate anywhere; single-language stacks get a clean immersion path.
- **Storage:** registry + globals in localStorage (tiny); per-Track bodies in
  IndexedDB (quota-safe); only the active Track resident. Noisy-not-silent on
  every read/write. No new 5 MB pressure.
- **No `window.confirm/alert/prompt`** — all picker/switch/archive modals are
  in-pack, in the pack root.

---

## 9. Open questions for the owner (before fan-out)

1. **Native is device-fixed vs per-Track:** this doc fixes `native = languages[0]`
   (the device primary) for every Track, so a user only ever picks `target`. This
   matches primary-language-first onboarding. Confirm we never need a Track whose
   `native` differs from the device primary (a polyglot teaching their *third*
   language *through their second*). If yes, the picker create-flow gains a native
   picker too; the model already supports it (TrackId is a free ordered pair) — it's
   purely a UX/onboarding question.
2. **Per-Track persona vs one identity:** this doc makes name+avatar **per-Track**
   (be "Brave Marigold" in Spanish, "Calm Heron" in French). Confirm that's the
   desired feel vs one consistent avatar across all Tracks (trivial alternative:
   store identity globally, only economy/quest per-Track).
3. **Archival UX surface:** confirm "Archive this language" belongs in the picker
   (Phase 3) vs never exposing it (IndexedDB holds everything cheaply, so archival
   is optional polish).
4. **Presence on switch:** ship the additive server `"presence"` handler (§5.4) in
   Phase 3, or accept "remotes see your old skin until your next move" as good
   enough for MVP (it already self-heals on the next movement broadcast)?
