# Changelog

All notable changes to the **World Plaza** pack are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Smooth city streaming — shared city-lifetime caches + time-sliced builds.**
  Walking forward used to hitch (~130ms on device) every time a chunk crossed the
  horizon because each streamed chunk REPEATED heavy work: it repainted every
  façade DynamicTexture + rebuilt building materials, built a fresh prop master
  mesh per species, and painted a per-chunk ground texture. A new shared
  `CityCache` (`src/city/cityCache.ts`, created once in `mountCity`, freed once on
  city dispose) hoists all of it to CITY scope: (1) a shared `BuildingPool`
  (`createBuildingPool` in `world/buildings.ts`) paints each façade variant ONCE
  for the whole city; (2) one prop MASTER mesh per (species, palette) is built
  once and chunks `clone()` it (geometry + materials shared/refcounted — cheap)
  then thin-instance the clone; (3) chunk grounds are baked once per distinct
  translation-invariant layout (`chunkGroundRequest` → cached bake) and chunks
  stamp a cheap `CreateGround` mesh. A chunk's dispose now frees ONLY its own
  meshes/thin-instance buffers/ground mesh — never the shared cache (so one chunk
  can't free a texture another chunk is using). The streaming manager
  (`src/city/stream.ts`) now builds chunks in PHASES (ground → buildings → props)
  under a per-FRAME ~5ms time budget instead of "N chunks per pass", so no single
  chunk can stall a frame. Texture painting stays behind clear function
  boundaries (façade pool / `bakeGround`) so a later stage can move it to an
  OffscreenCanvas worker. Measured (headless): steady-state per-chunk build TOTAL
  dropped from ~24ms median (worst 33ms) to ~13ms median (worst 24ms), with the
  prop phase falling from ~8ms to ~2ms; only the very first (cold) chunk pays the
  one-time shared paint, and disposal across a 124u traverse runs error-free.
- **Eliminated the in-play streaming hitch (perf Stage 2).** The remaining jank
  was a single ~45ms step: the builder time-sliced per PHASE but built ALL of a
  chunk's buildings in one `step()`, so walking into a fresh chunk spiked a frame
  (measured MAX 87ms, with 45–55ms spikes landing mid-walk as new chunks built).
  Three changes (own `src/city/*` only): (1) the `ChunkBuilder`
  (`src/city/chunkMesh.ts`) now steps at PER-BUILDING granularity — each `step()`
  builds at most ONE building (`createBuildings` called with a single-element
  blocker array, seeded by index so the look is identical) and props build in
  small species batches, so no step exceeds ~5ms; (2) the streaming manager
  (`src/city/stream.ts`) does a BACKGROUND FULL-CITY WARM — all 64 chunks are
  enqueued and re-sorted nearest-to-camera each pass, so the whole city builds
  under the per-frame budget within ~15-20s while the player's vicinity always
  builds first; (3) BUILD-ONCE — a built chunk is kept for the session and NEVER
  disposed during play; far chunks are DISABLED (`ChunkMesh.setVisible(false)` →
  skipped in render + frustum culling) and re-enabled when near, so returning
  never rebuilds. Collision + `onActiveChange` consume the NEAR set (chunks within
  the visibility radius), not all 64 built chunks. Measured (headless cold walk,
  one direction into new territory, 20s): MAX frame 87ms → 30ms, frames >33ms
  3 → 0, and ZERO frames >25ms after a ~2s startup warm (the only remaining
  spikes are one-time spawn-area ground bakes at mount, not in-play). Resident
  texture/geometry footprint is BOUNDED (identical right after the walk and after
  a further full-warm idle — no balloon). New QA harness: `qa/jank-cold.mjs`
  records rAF frame deltas and reports max/p99/count>25ms + `__wpSceneStats()`.

### Added
- **Vignettes — enterable sub-experiences (the v2 scene seam).** A new
  first-class framework (`src/vignettes/`) for focused, fullscreen scenes the
  player ENTERS from the city and EXITS back to the world. `createVignetteHost`
  owns the lifecycle (pause world + free LLM, recede chrome, mount a fullscreen
  node INSIDE `.wp-overlay`, compositor-only IN/OUT transitions, restore on exit)
  so each `Vignette` is a pure scene that reuses the shipped systems (Qwen3 NPCs,
  challenges, the wallet, TTS, the icon renderer) via injected service adapters —
  never importing the orchestrator. Reference vignette: the **taxi back-seat** —
  a 2D paper-person driver (HD-2D) seen from behind, parallax city window, a real
  Qwen3 driver conversation, a "where to?" challenge beat, a fare paid from the
  wallet (waived if you can't afford it), and a TRANSIT result (`travelTo`) that
  re-spawns the player at the chosen landmark. Same seam = the whole roster
  (café, bank, bus, subway, …) and v2 arbitrary scenes. See `docs/VIGNETTES.md`.
- **Area-of-Interest (interest management) on the presence server.** The plaza
  spine is a BIG city, so the server no longer fans every player's movement to
  every client. Positions are hashed into a uniform CELL grid (`server/src/aoi.ts`,
  default `cellSize=60`u, neighbor `radius=1` → a 3×3-cell window; both tunable
  per-room or via `WP_AOI_CELL` / `WP_AOI_RADIUS`). Each client gets a Colyseus
  `StateView` over the `@view()`-tagged players map containing ONLY players in its
  own cell + the neighbor ring; a far-away player is never encoded into your
  snapshot. Crossing a cell boundary re-derives the affected views symmetrically,
  so avatars enter/leave cleanly (no ghosts, no stuck avatars). Fully server-side:
  no client change — the existing `onAdd`/`onRemove` surface drives spawn/despawn,
  and a viewless legacy client still receives the whole map. Proved headless by
  `qa/mp-aoi.mjs` (near-sees-near, far-is-hidden, clean re-entry).

### Changed
- **ONE fictional world: "Corpan City" (v1 immersion fix).** Quests no longer
  claim real geography or a historical era. The old quest narrative ("Marietta,
  GA → Guadalajara"; "cross at the docks / pass the city gate") contradicted the
  skinned colonial world (no docks in a landlocked town) — three stacked lies.
  v1 ships ONE canonical present-day, multicultural metropolis,
  **`content/scenes/corpan-city.json`** (`topologyId: corpan-city`), now the
  default Scene. Quests live IN it: `es-guadalajara-route` is retitled "Across
  Corpan City" (harbor ferry → river bridge), `es-cafe-travel` is "Coffee on the
  Plaza". Step ids / toolIds / entryIds / promptProgram / rewards are unchanged —
  only the place-narrative + anchors moved to generic in-city landmarks
  (`plaza`, `market`, `harbor`, `station`, `hospital`, `bridge_n`). `special.json`
  and the `questItems` clues/source anchors were re-pointed to match; antigua/
  tokyo scenes are kept as v2 reference data. A landmark is just a place, never a
  vocab gate — quests can send the player anywhere for any content. A "Level" is
  Scene + Quest; with one Scene the progression is quest → quest with fanfare.
- **NPC challenge intro DECOUPLED from the LLM (NPC interaction overhaul,
  CHANGE 1).** The challenge "cohesion" invite is GONE from the Qwen3-4B system
  prompt (`composeSystemPrompt` no longer takes `queuedChallenge`; the
  `challengeSegueSection` instruction + `segueInviteExample` are removed). Telling
  the 4B model to end every turn with a play-invite burned its limited brain and
  forced a redundant "¿me ayudas…?" on every turn (NPC_PROMPT_STUDY pathology #1),
  sometimes drifting to English. The model now does ONLY the free, natural
  conversation (greeting, quest clues, chat). When a challenge is offered, the
  RUNTIME (`npcRuntime`) speaks a **deterministic, hardcoded, target-language
  segue** from `challengeSegues.ts` (picked by tool + NPC + visit + offer seed, so
  it varies; never the model, never English), then the Play chip appears. The
  R1 segue-recompose churn is removed (moot now). The `es` bank grew to **~10
  distinct, in-character, teacher-framed variants per challenge tool** with a
  `registerSegueLocale()` seam + a documented ≈20×10×50 ≈ 10k-string 50-language
  fill plan (a separate localization task).
- **Sticky per-NPC TTS voice (`src/npc/npcVoice.ts`, CHANGE 2).** Each NPC is
  assigned ONE deterministic voice (hash of NPC id → an index over the target
  language's voices, with a best-effort male/female split where the platform
  exposes gender). The choice is **persisted** (`wp:npc:voice:v1`, tiny) so a
  returning NPC keeps its voice, and **never rotates mid-conversation** (resolved
  once at open). Single-voice languages (common on iOS) degrade to that one voice
  — never a crash. Wired into the runtime's speak path. NOTE — host gap: the host
  does not yet expose voice listing or a per-utterance voice id to packs;
  `hostTypes.ts` specs the optional `listVoices`/`speakVoice` members and the
  resolver degrades to language-only speak (logged once) until the host adds them.
- **Clue-giver item grant is now DETERMINISTIC + idempotent, with a juicy reveal
  (CHANGE 3).** Talking to a special `duty:"clue"` NPC (the fountain traveler →
  ferry-token, the market clerk → city-gate-pass) makes the RUNTIME grant the
  `gives` item via `inventory()` — the model never grants items (it would
  hallucinate the handoff). The grant checks ownership first (no double-grant on
  repeat visits) and fires a celebratory "Received the {item}!" in-overlay reveal.
  `npcRuntime.open` gained additive optional `specialDuty`/`givesItemId`/
  `itemReceivedLabel` args (backward-compatible); game.ts wiring is specced.
- **Top HUD consolidated to ONE premium theme (TOP_HUD §0–§4).** The five
  overlapping top elements are gone: the centered `.wp-title` pill and the
  standalone top-right coin/XP HUD (`.wp-coinhud`) are RETIRED, and the floating
  `econHud` wallet chip ("R 18.40") is suppressed. The top is now just two
  warm-Antigua anchors — the LEFT **Status Capsule** (quest objective + "what
  next" hint, expandable into a detail card with full step progress, location/era
  lore, a wealth glance, and a focus-badge glance, each deep-linking into the
  pack) and a quiet demoted RIGHT **Place Tag** (`Antigua · 1770` + an online-
  presence pip; icon-only on phone-portrait). The center is freed. A single
  **chrome visibility state machine** (`src/shell/chromeVisibility.ts`) now owns
  all chrome opacity/interaction: the top band + the bottom-right pack button DIM
  while an NPC is focused and fully RECEDE during dialogue/challenge/menu — fixing
  the long-standing pack-button-over-NPC-window overlap (the button is no longer
  painted at all in those states, not merely z-ordered under the dialogue). The
  five existing `game.ts` edges (focus / dialogue open+close / challenge / menu)
  route into one `chrome.set(state)`. Verified in WebKit at phone-portrait,
  tablet, and desktop: one coherent theme, no overlaps, no center title, chrome
  recedes during dialogue.
- **`econHud` gained a `suppressReadout` option** (`src/economy/economyHud.ts`):
  renders NO standalone wallet chip (the Status Capsule is the single wallet
  display via `glance()`); `revealReward`/`glance`/`openMarket` are unchanged.

- **Map premium pass (`src/map/*`) — distinct marker system, roomy responsive
  full map, decluttered labels.** Addresses the owner's critique ("7 types in
  basically 2 colours", "the full map should GROW on bigger screens", "the pills
  don't seem to make sense and they're crowded").
  - **One marker, one colour + SHAPE + glyph per type** (`MARKER_STYLES` in
    `mapCore.ts`, the single source of truth read by the schematic, legend, and
    labels). Each thing the map plots is now instantly distinguishable by FORM,
    not hue alone (colour-blind safe): YOU = accent heading wedge · Travellers =
    indigo circle · Objective = vivid amber STAR (pulse) · Source-hint = leaf-
    green droplet · Market = pumpkin square ($) · Money-changer = gold diamond
    (¤) · Townsfolk = plum triangle · Docks = teal pin (⚓) · City gate = slate
    pin (⌂) · Fountain = cyan circle (≈) · Landmark = magenta diamond (✦). New
    `drawMarker`/`shapePath` primitives in `schematic.ts` paint each shape with a
    white halo + soft drop shadow (premium lift) and a tiny glyph on the full map.
  - **Roomy, responsive full map** (`mapStyles.ts`): the panel now GROWS with the
    viewport — `min(94vw, 560px)` on phone, `min(90vw, 980px)` on tablet,
    `min(86vw, 1320px)` × up to 1000px tall on desktop — with title/padding
    scaling up too. The corner minimap stays compact in its corner, legible at
    132px.
  - **Decluttered, collision-aware labels** (`fullMap.ts`): labels are now placed
    in priority order (You → objective → source-hint → named specials/POIs →
    a capped few travellers) and any lower-priority pill that would overlap an
    already-placed one is DROPPED, so pills never crowd or stack. The legend
    swatches are tiny canvases painted with the EXACT marker shape+colour
    (`drawMarker`), so the key can never drift from the dots.

### Added
- **Real Inventory menu section (`src/inventory/inventoryPanel.ts`, NEW).**
  Replaces the "coming soon" placeholder with the multi-currency wallet shown
  PROPERLY — every held currency as its premium procedural `IconRenderer` glyph
  (the crown coin / bill / ingot, never the moon) + its localized NAME ("Reales",
  "Mexican Peso") + the grouped major total ("R 18.40") — plus the player's owned
  items and a badges summary that deep-links into the Badge Case. Reuses the
  shop/market money grammar (`currencyIconSpec`/`format`). Live (subscribes to the
  inventory store); roomy on tablet/desktop. Wired as `sections.inventory`.
- **Real Quest menu section (`src/quest/questSection.ts`, NEW).** Replaces the
  "coming soon" placeholder with the full quest detail: title + narrative, the
  live objective + "what next" hint, a progress bar (step N of M) + the done /
  active / upcoming step list. The capsule is the glance; this is the ledger.
  Wired as `sections.quest`.
- **Roomy menus on big screens.** The unified menu panel grows large and roomy on
  tablet (`min(680px, …)`, larger type, taller body) and desktop (`min(820px, …)`)
  instead of the snug phone sheet, per the owner's "grow big + roomy" note.
- **Special-NPC placement (Slice 3b) — the designated quest NPCs are now
  physically PRESENT at their anchors.** `createCrowd` gained an additive
  `specials?: Array<{ anchorId, name, role }>` option; `game.ts` passes
  `specialNpc.forQuest(quest.id)` into it so the boatman stands at `docks`, the
  gatekeeper at `city_gate`, the wandering traveler at `fountain`, and the gate
  clerk at `plaza_market`. Each special is bound as an EXTRA agent (beyond the 28
  wanderers) whose `handle.anchorId` is its anchor and who is a fully-voiced,
  focusable persona (hand-authored tone/quirks per role, grafted onto the
  generated challenge/voice enrichment). A new **stationed** behaviour (a narrow,
  flag-gated addition to the wander state machine) makes a stationed special
  HOVER within a small radius of its anchor — gentle half-speed idle steps, a
  leash that pulls it back if separation nudges it out — so the player reliably
  finds it where the map marker points, while still feeling alive. Every existing
  crowd behaviour (held-freeze, collision/separation, the BODY_GAP push, relaxed
  wander) is preserved untouched for non-special agents. The stationing geometry
  is factored into a pure, unit-tested `src/world/stationing.ts`
  (`stationPoint`/`pickStationTarget`/`isOffLeash`); verified in WebKit that all
  four specials stay within their station radius over time while the general
  crowd keeps wandering without stacking.
- **Special quest NPCs (Slice 3a / COHESION M2 §3.3) — the clue→item→deliver→
  advance chain now flows through *designated* anchors.** New
  `content/npc/special.json` maps each crowd anchor to the quest NPC that tends
  it (`anchorId → { questId, role, name, duty, gives?, stepIds? }`), authored end
  to end for `es-guadalajara-route`: a CLUE-giver at `fountain` hands the ferry
  token, the boatman at `docks` accepts it (step `docks`), a CLUE-giver at
  `plaza_market` hands the gate pass, and the gatekeeper at `city_gate` accepts
  it (step `gate`). New `src/quest/specialNpc.ts` `SpecialNpcResolver` (Seam 5)
  answers `forAnchor`/`isSpecial`/`forQuest` plus `deliverFor`/`cluesFor`/
  `acceptsDelivery` and a `Translate`-localized `displayName`/`anchorName`.
  Delivery routes ONLY through the marked deliver-NPC at the step's anchor via
  the deterministic `questEngine.advance` — you can talk to anyone, but only the
  boatman/gatekeeper advance the route, and only when the required item is held
  (the engine is the referee, the model the mouth). Empty/garbage content
  degrades to the documented `noSpecials` stub. Unit-tested incl. a full
  clue→item→deliver→advance→complete walk.
- **Topology generator (Slice 4c, CONTENT_SCALE §4) — a parameterized,
  seed-deterministic map generator (`src/world/topologyGen.ts`, NEW).**
  `generateTopology({ archetype, seed, size?, density? })` emits a valid
  `RoomTopology` (square bounds, spawns, building blockers, TYPED anchors) from a
  small `LayoutSpec` across **10 curated layout archetypes** — grand-plaza,
  market-square, harbor (a real `docks` quay), walled-town (a `city_gate` in a
  wall gap), avenue-grid, garden-court, boulevard, village-green, canal-town
  (twin canals + docks), hill-terrace. Every archetype is a curated program over
  the SAME street grid the road bake derives from `bounds`, so generated maps
  bake into the single ground mesh with **0.0000% z-fight** (verified) and are
  consumed by `composition.ts` UNCHANGED. Anchors carry a typed `kind`
  (`vendor`/`npc_station`/`docks`/`city_gate`/`fountain`/`merchant`/`landmark`/…)
  so quests, special NPCs, and the map bind by type. A door-reachability guard
  guarantees every emitted portal/station lands on connected open floor.
  `checkWalkability()` (flood-fill reachability + bounds/overlap integrity) is the
  walkability gate. Also extended the authored **`plaza-grand.json`** with `docks`
  + `city_gate` (+ mooring-post decor) anchors so the `es-guadalajara-route`
  quest's two steps bind to real places — existing IDs/footprints untouched.
  Verified: 56 unit tests (`src/world/topologyGen.test.ts`), a schema+walkability
  archetype sweep (`qa/topologies.mjs`), live WebKit renders through the real
  world look (`qa/topo-render.mjs`), and a generated-topology z-fight proof
  (`qa/topo-flicker.mjs`, 0.0000%).
- **Map slice (COHESION M3) — premium corner minimap + full-screen map
  (`src/map/*`, NEW).** A stylized warm-Antigua paper schematic of the topology
  (walkable bounds + faint blocker footprints + curated POIs) with the live
  actors on top: the player as a heading wedge, remote travellers as soft dots,
  and quest markers — a gentle pulse on the CURRENT objective (a diamond pin) plus
  hollow "where to find it" rings for unmet source hints (opt-out under
  reduced-motion). The corner `minimap.ts` is a tap-to-expand rounded card
  (bottom-right, safe-area aware, ≥44px); `fullMap.ts` opens either as an
  in-`.wp-overlay` modal (minimap tap) or via a `createMapSection()`
  `MenuSectionView` for the menu's Map tab, with labelled POIs, a legend, and
  remote-player name tags. Both are PURE consumers of the frozen `MapView` bundle
  (`{ topology, getPlayerPos, getRemotePositions, getQuestMarkers }`), kind-aware
  (prefer `Anchor.kind`, fall back to `role`), and fit-to-CONTENT (so a topology
  with huge nominal bounds but central content still reads legibly). Scoped-inline
  CSS under `.wp-map*` / `.wp-minimap*` (no `styles.css` churn); mounts inside
  `.wp-overlay`, never `document.body`. Localized via the `Translate` seam with a
  bundled English fallback. Verified in WebKit on desktop/tablet/phone.
- **Face kit (Slice 4b) — a much richer parametric face + a transient,
  mood-linked emotion channel (`src/character/{characterSpec,characterArt,
  characterGen,animator}.ts`).** `FaceSpec` gains seed-driven axes —
  `eyeShape`(6) · `eyeSize`/`eyeSpacing` (clamped) · `noseStyle`(5) ·
  `faceShape`(5) · `browShape`(4) · `ageBand`(4) · `lipFullness` · `eyeColor` +
  `freckles`/`beautyMark`/`dimples` garnish — drawn procedurally (eyes with
  catchlights + soft lash lines, shaped head silhouette, age crinkles, a genuine
  "Duchenne" cheek-raise warmth lever). All axes are **curated, weighted,
  age-coherent bags** (no child with a grey beard; elders may grey), pushing the
  face space to **tens of millions of distinct, warm faces per Theme** (measured:
  736 distinct face fingerprints in an 800-sample run). The murderous-mob
  guardrail is preserved + extended: every eye/brow/lip is **symmetric by
  construction**, only the rare `sly` demeanor unlocks the asymmetric smirk
  (5.6% of a plaza). A new **transient emotion channel** (`Pose.emotion` +
  `emotionAmt`, blended over the resting face) ties each of the 8 `MOOD_BEATS`
  to a wholesome face emotion via `moodToEmotion` (delighted→grin, drowsy→sleepy,
  gossipy→a gentle smirk, rushed→surprised, …; never a sneer) — the animator
  eases it ~400ms (reduced-motion-safe snap) on the existing dirty-checked
  repaint path, so an NPC's face matches its mood **without changing identity**
  and a resting crowd still costs zero canvas work (34 animated faces @ 58fps).
  The `CharacterSpec`/`createGroundedCutout` seam is untouched. QA: a 64-face
  contact sheet + a same-face-every-mood row + per-axis sweeps
  (`qa/faces.{mjs,html}`, screenshots `/tmp/wp-faces-*.png`).
- **Badges slice B0+B1 — XP stops being a number; it FILLS per-language badges
  (`src/badges/*` + `content/badges/*`, NEW).** Every XP earned now flows through
  a pure `BadgeRouter` that fans one challenge/quest result out to up to ~8
  badges (domain / skill / CEFR / subtopic cluster / tool-virtuoso), each
  credited a FRACTIONAL weight — **normalized so the fan-out sums to ≤ 1, no XP
  inflation** (the scalar `inventory().xp()` is untouched; badges are a parallel
  ledger). Score-weighted credit (`0.4 + 0.6·score`, anti-mash), the geometric
  tier ladder (Locked→Bronze→Silver→Gold→Platinum, `120/400/1000/2400`, broad
  badges ×2.5), a near-tier soft cap (last 15% at 0.6×) and **platinum overflow
  that re-routes to incomplete CEFR siblings** so completionists are pulled to
  new mastery, never idle grind. A generative taxonomy (`catalog.ts`: 13 domains
  × 6 CEFR × 6 skills × clusters × tools, clamped to corpus coverage, stable
  facet-derived ids like `F:travel:vocab:A2`) ships a trimmed ~40-badge ES set
  for B0 and the full ~1000 generator for B1 — ONE code path, B0 just narrows
  domains/levels/families. Per-Track progress persists via the frozen
  `TrackStore` `{namespace, store}` seam (IndexedDB in prod, the mem stub in dev,
  keyed `wp:track:{id}:badges`), compact + touched-only (a fresh Track ≈ 0 bytes).
  A premium in-`.wp-overlay` **Badge Case** (paper-cutout display case, radial-arc
  medals drawn through the `IconRenderer` seam, In-Progress/Recent/All filters,
  a "how to fill this" detail panel, dignified tier-ups — no Duolingo dark
  patterns) handed to the shell as a section factory, plus a HUD **focus-badge
  chip** that REPLACES the static `✨` integer with the medal nearest its next
  tier. Localized badge names composed from ~140 part strings via the `Translate`
  seam (`content/badges/strings/en.json` is the per-key fallback). 28 unit tests
  (router fan-out + no-inflation, tier curve, catalog counts + generator math,
  stable-id regen, store soft-cap/overflow/persistence); WebKit-verified Badge
  Case + chip + tier-up + detail (`qa/badges-verify.*`).
- **Economy slice E0+E1 — the multi-currency wallet that kills the gray
  moon-coin (`src/economy/*`, NEW + wallet-ified `inventory.ts`).** The scalar
  `coins` is gone: the player holds a `Wallet = Record<CurrencyId, minorUnits>`
  of integers (no float drift). A CDN-driven currency catalog
  (`content/economy/currencies.json`, ~12 era/place-flavoured currencies —
  Spanish real, silver tael, yen, peso, dollar, Weimar mark, denarius, cowrie
  shell, guilder, rupee, won, euro) with per-currency `Denomination`s +
  procedural `CurrencyArt` rendered through the frozen `IconRenderer` seam (stub
  disc until Slice 4; never an emoji). `decompose()` greedy make-change →
  reward reveal renders **stacks of physical bills/coins/ingots** (the
  smorgasbord, `src/economy/rewardReveal.ts`), not "+N🪙". Data-driven weighted
  `RewardTable` roller (`rewards.ts`, score-scaled, scene-appropriate,
  deterministic). E1 NPC money-changer exchange via a hidden Common-Unit pivot +
  honest spread (`exchange.ts`) and a constant-spread AMM goods market with a
  seeded mean-reverting price sim shared with the server (`priceSim.ts`,
  `market/*`) + positions/P-L, all in a premium in-`.wp-overlay` ticker/market/
  exchange surface. `walletGlance()` HUD glance produced for Slice 2;
  `coins()`/`addCoins`/`spendCoins`/`applyReward` kept as default-currency shims
  and legacy `wp:economy:v1` migrates 1:1 into the default currency (no value
  lost) so the current HUD, shop, trade, and challenge rewards keep working
  unchanged. Per-Track namespacing via the `TrackStore` `{namespace,store}`
  binding. 35 unit tests (wallet math, make-change, exchange pivot, market
  bounds/mean-reversion, legacy migration, reward roll).
- **Shared procedural `IconRenderer` (`src/items/itemArt.ts`, NEW) — kills the
  emoji/placeholder art.** Implements the frozen `IconRenderer` seam
  (`src/contracts/runtime.ts`): one paper-cutout canvas painter for ALL small
  icons — economy currencies (beveled metal coin discs with emblems + milled
  edges, banded fanned note-stacks, angled ingots, faceted gems, scalloped
  shells, drawstring pouches), badge medals (tier-keyed bronze→silver→gold→
  platinum metal frames, family emblem, fill-arc progress ring, embossed `locked`
  well), and the ~20 inventory families (token, seal, letter, scroll, garment,
  foodstuff, vessel, tool, key, charm, cloth) × finish (matte/glazed/metal/woven)
  × rarity frame (common/rare/epic/seasonal). Seed-deterministic, DPR-aware
  (crisp at any pixel ratio), spec-key-cached (canvas + data-URL, FIFO-evicted),
  reduced-motion-friendly (no glint animation). Curated emblem + palette + metal
  bags (art-directed, not noise); instantly distinct by silhouette + colour at
  24px HUD size up to 48px. `iconRenderer` singleton + `createIconRenderer()`
  factory. 3D-asset upgrade stays behind the `WorldLook`/`createGroundedCutout`
  seam (noted, not built). QA contact-sheet harness under `qa/iconsheet/`.
- **Scale-out contract set (`contracts` v0.1.0, additive/backward-compatible).**
  The frozen interface spine the four parallel build slices code against (see
  `docs/IMPLEMENTATION_CONTRACTS.md`): `contracts/src/track.ts`
  (`TrackId`/`TrackState`/`TrackRegistry` + per-Track namespacing),
  multi-currency economy in `contracts/src/economy.ts`
  (`Wallet`/`Currency`/`Denomination`/`CurrencyArt`/`RewardTable`/`RewardGrant`),
  `contracts/src/badges.ts` (`BadgeId`/`Badge`/`BadgeDeposit`/`BadgeProgress`),
  typed `Anchor.kind` (`AnchorKind`) on `contracts/src/room.ts`, and the shared
  runtime interfaces in `src/contracts/runtime.ts` (`TrackStore`, `IconRenderer`,
  the Top-HUD glance getters, `ImmersionResolver`, `MapView`, `SpecialNpcResolver`).
  No existing field removed or narrowed; old runtimes ignore the new fields.

### Fixed
- **NPC dialogue prompt-craft pass (post-eval, the three owner-caught defects).**
  The eval study (`eval/npc-prompts/`) judged mechanical repetition only (its
  judge was programmatic — no LLM-judge key), so it never caught these
  semantic-quality bugs. Now fixed in `src/npc/{promptProgram,npcRuntime,
  challengeSegues}.ts`:
  - **De-gloss.** The model's parenthetical `(native)` gloss was unreliable — it
    emitted the wrong word AND the wrong language (e.g. "(ferry)" after "muelle").
    REMOVED the gloss permission from both rails (`composeSystemPrompt` language
    discipline + `questFactsSection`). NPCs now reply in the **target language
    ONLY**, no parentheticals/translations; native help comes from the UI /
    suggested replies, never the model.
  - **Opener fixation (R2 anti-repetition turn context).** A special NPC repeated
    its opening line verbatim every turn. Before each post-greeting model turn the
    runtime now prepends a short TARGET-LANGUAGE reminder built from the NPC's own
    last 1–2 lines ("(Ya dijiste: … No te repitas — di algo NUEVO y avanza.)"),
    injected transiently into the wire turn only (never accumulated in history).
    Localized via the new `RuntimeStrings.antiRepeat` override. The special-NPC
    `needs-item` FACTS branch also now says to drop the hint ONCE and teach
    something new if it was already given, instead of re-asking the same framing
    question.
  - **Challenge-invite reframe (no more universal "¿me ayudas…?").** Every NPC
    used to beg "help ME" to spring a game — monotonous and backwards (the NPC is
    the guide/teacher). The invite now VARIES by persona + tool, framed as the NPC
    GUIDING/TEACHING/QUIZZING the learner ("te enseño una palabra", "a ver si
    adivinas", "dímelo de vuelta", "practiquemos", "test your ear"…) — a varied
    bag keyed to the challenge type in `challengeSegues.ts`, surfaced to the model
    via a new `segueInviteExample()` (deterministically varied by NPC id). "Help
    me" survives as one flavour, never universal.
  - Re-validated by re-running the study harness (programmatic judge; no
    OPENAI/ANTHROPIC key was present — labeled honestly). Temp stays 0.6; R1
    (segue-once) untouched; scripted fallback intact.
- **NPC challenge-offers no longer speak an ENGLISH bubble in the target-language
  TTS voice.** The old offer flow (`presentOffer` → `resolveGameOffer().pretext`)
  dropped a hardcoded English pretext ("a page of the day's reading smudged…") as
  a spoken NPC bubble, read aloud by e.g. the Spanish voice. Killed it: there is
  no separate English bubble. On the MODEL path the model now weaves a ONE-CLAUSE,
  in-character, target-language invitation into its own short turn (we inject the
  queued challenge TYPE + a 2–3-word in-language tag and instruct it to end with
  the invite — a one-clause invite the 4B model does reliably). On the NO-LLM path
  the NPC speaks a SHORT TARGET-LANGUAGE segue from a small authored set
  (`src/npc/challengeSegues.ts`, keyed by tool id). The Play-chip label is now
  target-language too ("Jugar"/"Leer"/"Escuchar"…), not English "🎮 Play".
- **The owner could not EXIT the pack in the real embedded Corpán app (Cohesion
  M0 — the structural fix).** Root cause: `pause.ts` and `menuButton.ts` mounted
  their UI on `document.body` at z≈2.1 billion. `z-index` only orders siblings
  WITHIN a stacking context, so when Corpán embeds the pack, its
  `ContentPackHost` container (its own stacking context + overflow/transform/
  contain) clips body-fixed children — the pause modal painted INSIDE the host's
  clip region → invisible, and ESC just toggled a useless top-left button. It
  "worked" in standalone (body == viewport), which is exactly what hid the bug
  twice. The cure is **structural, not a bigger z-index**: ALL shell chrome now
  mounts INSIDE the game's `.wp-overlay` — the host's accepted render surface
  (the same surface the HUD/dialogue/challenge overlays already use, which always
  rendered fine). Retired the body-modal `pause.ts` entirely; introduced a single
  unified in-overlay **menu panel** (`src/shell/menuPanel.ts`) at a new in-band
  `--wp-z-menu: 70`. The menu button (`menuButton.ts`) and the exit confirm
  (`confirm.ts`/`exit.ts`) now also mount in `.wp-overlay` (`position:absolute`,
  not `fixed`) via a new mount-parent param. Collapsed the old two-band z-scale
  (near-int32-max "Band B") into one in-overlay band documented in `styles.css`
  (`--wp-z-menu-button 65 · --wp-z-menu 70 · --wp-z-confirm 80`). The exit
  handshake (`corpan:exit` when embedded; `onStandaloneExit` teardown standalone)
  and the save seam are unchanged. (`src/shell/{menuPanel,menuButton,confirm,
  exit,shell,index}.ts`, `src/styles.css`, `src/game.ts` createShell wiring)
- **Interactive controls inside `.wp-overlay` were eaten by the dual-joystick.**
  The overlay's input layer calls `host.setPointerCapture` on EVERY bubbling
  `pointerdown`, which stole the menu button's pointer and suppressed its `click`
  (the button was dead on touch). The menu button, menu panel, and confirm now
  `stopPropagation` on `pointerdown`/`pointerup`, so a press on shell chrome can
  never spawn a phantom stick or leak a tap to the world. Without this the menu
  was unreachable by tap on phone/tablet. (`src/shell/{menuButton,menuPanel,
  confirm}.ts`)

### Added
- **NPC personality + pleasant surprise, on every NPC, within ~200 prompt
  tokens.** Specificity over length for the weak on-device Qwen3-4B:
  - a **persona SEED** (`personaSeed`) — one sharp clause (name + role + ONE vivid
    quirk) filling the quest template's `{persona}` slot (replaces the old verbose
    paragraph; ~21 tokens);
  - a rotating **MOOD/BEAT** (`selectMood(npcId, visit)`) chosen DETERMINISTICALLY
    from the NPC id + a per-NPC visit counter (persisted in localStorage,
    incremented per `open()`), from a small set (delighted/drowsy/gossipy/rushed/
    nostalgic/proud/mischievous/unhurried) — the SAME NPC feels different across
    visits with ZERO model improvisation;
  - **hard anti-ramble rails** (target-only · ≤2 short sentences · stay in
    character · never explain the game · never break character · no lists). The
    composed persona+mood+rails+segue additions total ~110 tokens; a typical full
    prompt (incl. the trimmed TOOLS protocol) estimates ~330 tokens, of which the
    persona/mood/rails/lesson budget portion is ~240. Tightened the verbose TOOLS
    protocol + scaffold rules to claw back tokens.
  - `src/npc/challengeSegues.ts` (NEW): per-tool, per-language short
    target-language segue phrases + chip labels + in-language tags (es authored
    for Antigua; en fallback; legacy tool ids aliased).
- **Unified in-overlay MENU (Cohesion M0).** One always-reachable, dignified
  warm-Antigua menu panel hosting **Resume**, a **Map · Inventory · Quest** tab
  row (M0 = "Coming soon" placeholders that later milestones fill), and **Leave
  the Plaza** → the "Leave the Plaza? Your progress is saved." confirm → exit.
  An always-visible menu button (top-left, safe-area aware, away from the
  top-right coin HUD; ESC also opens the menu on desktop) opens it and auto-hides
  while it's open. Premium polish: compositor-only open/close (opacity + scale,
  `position:absolute` from frame 0 → no layout jank), dimmed backdrop, focus
  trap, ESC-to-close, backdrop-tap-to-close, ≥50px touch targets, reduced-motion
  path. Verified in WebKit (`qa/menu-exit.mjs`, 18/18): the `.wp-menu`, menu
  button, and confirm are DOM descendants of `.wp-overlay` (never direct children
  of `document.body`), the panel paints un-clipped at its own center, ESC
  opens/closes, and Leave → confirm fires `corpan:exit` (embedded mock host) AND
  the standalone teardown path (`.wp-root` removed, no `corpan:exit`).
  Screenshots `/tmp/wp-menu-{desktop,portrait}.png` at 1280×800 + 390×844.
  **NOTE: standalone CANNOT certify the embedded render** (it's what hid this bug
  twice) — the owner must confirm in the real app on phone+tablet+desktop; this
  change makes the structure correct (in-overlay) and proves the DOM placement +
  exit handshake. (`src/shell/menuPanel.ts`, `qa/menu-exit.mjs`)
- **MVP cohesion core (Cohesion M1) — the QUEST is now the connective tissue.**
  The game can finally answer "Do I have a quest? What is it? How does the
  challenge relate to it? How do I reach the next level?". THESIS (non-negotiable,
  because Qwen3-4B is weak at subtlety): the model does NOT carry the quest — a
  **deterministic authored scaffold** does; the model is only a voice + translator
  that re-speaks an authored beat. Three interlocking parts:
  - **Deterministic quest engine** (`src/quest/questState.ts`). A `QuestEngine`
    that instantiates the previously-unused `QuestState` contract and drives it
    purely from `inventory()` + the authored `QUEST_ITEM_RULES`. Per the active
    step it computes one of `needs-item` / `ready-to-deliver` / `done`; `advance()`
    is DETERMINISTICALLY GATED (`isStepSatisfied`) — a model-emitted `questStep`/
    `reward` is ignored unless the gate already agrees (the model is a mouth, not a
    referee). On the final step it grants `quest.rewards` exactly once. Persists a
    compact `wp:quest:v1` (< 1KB, quota-safe). Exposes `currentStep`, `stepState`,
    `getQuestMarkers` (current objective anchor + missing-item source hints, for
    the future map), and `subscribe` (re-emits on inventory change so the tracker
    flips live). `src/quest/questContent.ts` resolves a step's `entryIds`/domain
    for the challenge binding (§3.4) and gates challenge-step advancement on
    matching tool + score threshold.
  - **Prompt wiring — the missing link** (`src/npc/promptProgram.ts`,
    `src/npc/npcRuntime.ts`). `composeSystemPrompt` now consumes `clues` (authored
    `cluesFor(...)` — previously written but never passed) AND a new deterministic
    `questFacts` block for SPECIAL quest-bound NPCs: a tight, branchy
    `questFactsSection` hands the model ONE verbatim authored line to RE-VOICE for
    the current `stepState` (needs-item clue / ready-to-deliver next-hint), with
    `maxSentences:2` and a "never invent quest facts" guard. The runtime injects
    these only for the special NPC, exposes a "Hand over the {item}" affordance
    HOOK that routes delivery through `QuestEngine.advance` (deterministically
    gated; full UI lands in M4), and preserves the scripted no-LLM path by speaking
    the authored clue/next-hint verbatim. **ADDITIVE + regression-guarded**: a
    normal crowd NPC (no `questFacts`, no `clues`) composes a byte-identical prompt
    to before.
  - **Quest-tracker HUD** (`src/quest/questTracker.ts` + `styles.css`). A premium,
    in-overlay card (mounted INSIDE `.wp-overlay`, never `document.body` — the M0
    lesson) showing the quest title, the current objective, a live "find the X" /
    "bring X to {who}" / "→ talk to {who}" hint that flips with the step state, and
    `STEP n of N` progress. It INFORMS, never nags (no countdowns; the only motion
    is a gentle objective-pulse, opt-out under reduced-motion). All copy is
    localization-ready.
  Vehicle: the `es-guadalajara-route` quest (`content/quests/es-guadalajara.json`,
  NEW — the clue→item→deliver data already lived in `QUEST_ITEM_RULES`). Verified
  end-to-end: 17 new unit tests (`src/quest/{questState,questPrompt}.test.ts`) +
  a WebKit/Playwright run proving the engine transitions needs-item→ready→advance
  →complete, the special-NPC composed prompt contains the authored clue verbatim,
  a normal NPC's prompt is unchanged, and the tracker renders as a child of
  `.wp-overlay` and updates live (screenshots `/tmp/wp-quest-*.png`). NOTE for the
  orchestrator: this quest's `docks`/`city_gate` source anchors are not yet in
  `plaza-grand.json` (special-NPC placement is M2). (`src/quest/*`,
  `src/npc/{promptProgram,npcRuntime}.ts`, `src/styles.css`,
  `content/quests/es-guadalajara.json`)

### Changed
- **Exit / ESC / Pause flow reworked to be premium and bulletproof.** ESC now
  closes the topmost layer in a sensible order — pause menu → exit confirm
  (which owns its own ESC) → a blocking pack overlay (challenge / shop, deferred
  to so pause never stacks over them) → NPC dialogue → otherwise open the pause
  menu — so a couple of ESC presses always lands you on Pause, where **Leave the
  Plaza** → a dignified "Leave the Plaza? Your progress is saved." confirm →
  exit. ESC also dismisses the confirm and the pause menu (no dead-ends). The
  pause menu gained a focus trap and a reassuring "Your progress is saved"
  subtitle. (`src/shell/shell.ts`, `src/shell/pause.ts`, `src/shell/exit.ts`)

### Added
- **Unified collision / obstacle field — props and the fountain are now solid.**
  Previously only building footprints blocked movement, so the player and the
  wandering crowd walked straight THROUGH the dressing props and INTO the central
  fountain, and paper-people stacked on each other. A new pure, deterministic,
  Babylon-free obstacle field (`src/world/collision.ts`) unions building BOXES, a
  big fountain CIRCLE, and a per-prop footprint CIRCLE for every SOLID prop
  (benches, stalls, carts, troughs, barrels, crates, sacks, planters, trees,
  palms, lamps, signposts — sizes read from the real meshes; pure décor like the
  lamp glow / shadow decals is excluded). It exposes `blocked` / `resolve`
  (axis-separated wall-slide for boxes + radial slide for circles) / `pushOut`
  over a spatial hash (O(1)-ish per query). The player controller and the crowd
  both consume it: the player SLIDES along all obstacles instead of clipping
  through them; NPCs never target a point inside an obstacle, slide around props
  as they wander, get pushed out if they spawn overlapping, and keep a body's
  width off the player (no clipping you) — the existing "held" freeze and relaxed
  wander feel are preserved. Verified in WebKit (player charged into the fountain
  stops at the rim; 0/28 agents embedded; closest agent pair 1.80u with no
  stacking; crowd median 20.5u motion over 8s — no gridlock; 60fps) and by 8 new
  headless unit tests (`src/world/collision.test.ts`). Built from the SAME
  deterministic composition (seed + caps) the dressing uses, so the colliders
  line up exactly with the placed props; `dressWorld` also exposes its
  `footprints`. Optional, separable physics-flair prototype (`src/world/
  kinetics.ts`) lets a few barrels/crates be nudged-and-roll — opt-in, imported
  by nothing in the core, so it can never destabilize the deterministic
  collision. (`src/world/collision.ts`, `src/movement/controller.ts`,
  `src/world/crowd.ts`, `src/world/dressing.ts`)
- **Camera occlusion fade (3rd-person cutaway).** You can no longer lose sight
  of your character when the follow camera grazes or drives INTO a building
  (e.g. inside a roof). Each frame a single ray from the camera to the
  character's head finds building bodies that block the shot — plus the building
  the camera is sitting inside — and smoothly fades their `visibility` down to a
  transparent cutaway (~0.16), then smoothly restores them once they no longer
  block the view. Cheap (one ray vs ~20 building AABBs, zero per-frame
  allocations, 60fps verified) and self-contained: it reads the scene/camera at
  runtime and only touches per-mesh `visibility` (never the shared frozen
  materials, so neighbours that share a stucco material don't flicker). Roofs
  ride along via the body box; thin-instanced small props are intentionally not
  faded. (`src/world/cameraFade.ts`)
- **On-screen menu / pause button (top-left), first-class for touch + tablet.**
  Phones and tablets have no ESC key, so the shell always mounts a dignified
  paper-cutout pause button that opens the same pause → exit flow; it auto-hides
  while a modal is open and is suppressible via `showMenuButton: false`.
  (`src/shell/menuButton.ts`)

### Fixed
- **Pause / exit modals could render *behind everything* when embedded in the
  Corpán host.** The in-world chrome (NPC dialogue, challenge encounter, shop)
  lives inside `.wp-overlay`, a `z-index:10` `position:absolute` element that
  forms a stacking context — a high z-index there can never escape that band.
  The shell modals are mounted on `document.body` but were only at z 55/60, so
  host chrome (or any future high layer) could paint over a modal the player
  must see. Established a documented two-band z-index scale in `styles.css`
  (`:root` custom properties) and lifted the pause menu, menu button, and exit
  confirm into a dedicated **top modal tier** (near the int32 ceiling, with
  literal fallbacks) so they always paint above the entire in-world band *and*
  any host frame. Verified with `elementFromPoint` in WebKit at desktop and
  portrait sizes — the modal is the element painted at screen center every time.
  (`src/styles.css`, `src/shell/pause.ts`, `src/shell/confirm.ts`,
  `src/shell/menuButton.ts`)
- **Picture Match was unplayable — the picture stayed fixed while the correct
  answer rotated, so they no longer matched.** Root cause: the tool drew a glyph
  via `glyphFor(target)` which fell back to a default 🔖 for anything not in the
  emoji table. The corpus is mostly phrases/sentences ("how much does it cost",
  "good morning") with no emoji, so most rounds showed the SAME fallback glyph
  while the word/answer changed → permanent desync, and "picturable" only ever
  made sense for single concrete nouns anyway. Fixed by **selecting only
  picturable single-noun entries**: an entry qualifies only if its target word
  (article-stripped, no spaces) resolves to a real glyph in an expanded emoji map
  (~60 common concrete nouns, both target+native surface forms). The chosen glyph
  is carried WITH the pair so the picture and correct answer are bound together
  and always change in lockstep; the pool is de-duped by glyph so two tiles never
  show the same picture's word, and distractors are other picturable nouns. If
  the corpus can't supply ≥4 picturable nouns, the round **gracefully falls back
  to a plain word-match** ("Tap the word that means …", no emoji) instead of a
  broken picture. A guard logs a visible `console.error` if the displayed glyph
  ever fails to match the round's answer (it never fired in QA). Proven across 4
  consecutive rounds in WebKit — 🎫→el billete, 💧→el agua, 🪙→el dinero,
  🥚→el huevo — glyph and answer both vary and always correspond
  (`/tmp/wp-pic-*.png`). (`src/challenges/tools/gridTools.ts`)
- **In-card copy said "word" where the content is a full phrase/sentence.**
  Audited every in-card string and routed through `strings.ts`: Countdown
  Recall's "Which **word** meant …" → "Which **line** meant …"; Category Sort's
  "Sort each **word** into its basket" → "Sort each **phrase** …"; "Memorise
  these **words**" → "Memorise these"; Tap-the-Translation's "Tap the **word**
  that means this" → "Tap the **one** that means this"; Listen & Choose's "Which
  **word** did you hear?" → "Which **one** did you hear?". "Word" is reserved for
  games that genuinely use single words — Unscramble, Word Search, Fill the Blank
  (single-token blank), Conjugation, Rhyme, and the now-filtered Picture Match.
  (`src/challenges/tools/strings.ts`)
- **The reward-reveal card now fits on ANY screen size — the crown/trophy is
  never clipped and the "Claim reward" button is always reachable.** Previously
  the reward sat in a `position:absolute` panel inside a card whose height was
  set by the *tool* UI underneath it, so when the reward content was taller than
  that card it overflowed BOTH ends (`overflow:hidden`) — the crown sliced off at
  the top on roomy desktop windows, and on narrow portrait (~300×520) the Claim
  button was cut off and unreachable. Now, when the reward shows, the card hides
  its chrome and the reward becomes an in-flow flex child, so the **card grows to
  the reward content** (centered by the scrim, capped by the viewport safe area
  via `max-height:100%`) — the crown always has room and is never clipped. On
  constrained viewports the reward panel scrolls internally (the card itself
  never scrolls → no double scrollbar) with the content centered via a
  `margin:auto` inner column, so the crown AND the Claim button always stay
  on-screen. Proven by `qa/reward-responsive.mjs` (40/40) across narrow-portrait
  300×520 / 360×640, short-landscape 900×360, small 320×320, and wide-desktop
  1200×800 — crown fully visible, Claim reachable, no clipping, no double
  scrollbar in every case (`/tmp/wp-mini-reward-*.png`). Confetti now rides the
  card (not the scrolling panel) so it can't expand the scroll area.
  (`src/challenges/overlay.ts`, `src/challenges/challenge.css`)
- **Memory Pairs no longer snaps mismatched cards face-down on a fast 700 ms
  timer — the PLAYER controls the tempo.** On a mismatch both cards now stay
  revealed (board locked) with a quiet "Not a match — tap anywhere to flip back"
  affordance, tinted warm + gently nudged so they read as *waiting for you*, not
  wrong-and-gone. The next tap anywhere on the grid flips them back with a soft
  settle animation and unlocks. A generous 6 s safety net only fires if the
  player walks away. (`src/challenges/tools/gridTools.ts`, `challenge.css`)
- **Finish the Dialogue was completely broken against the offline corpus —
  it flashed a 0 % reward instantly.** The mock host's `getRandomEntries` could
  starve at ~3 distinct entries (the LCG's low bits cycle poorly mod the corpus
  size), so any tool needing 4+ distinct pairs dead-ended. Replaced the
  modulo-collision loop with a seeded Fisher–Yates that GUARANTEES
  `min(n, corpus)` distinct entries (wrapping with fresh ids past the corpus).
  (`src/challenges/host.ts`)
- **Picture Match no longer rendered the emoji twice** (a stray duplicate
  prompt glyph). It now shows a clear "Tap the word for this picture"
  instruction over a single hero glyph. (`src/challenges/tools/gridTools.ts`)

### Changed
- **A WRONG multiple-choice answer now lingers on the revealed correct tile so
  it actually registers** (the teaching moment) instead of flashing by. Across
  every choice/text/grid round (fast-translate, listen-&-choose, true/false,
  odd-one-out, rhyme-match, spot-the-typo, conjugation-tap, picture-match,
  which-word-meant), a correct pick still advances snappily (~0.6 s) but a wrong
  pick — which reveals the green correct tile next to your red one — now holds
  ~1.1 s before the next round. Consistent with the player-paced Memory-Pairs
  flip-back philosophy: nothing yanks itself away before you can read it. The
  reward reveal already waits for an explicit "Claim reward" tap (no
  auto-dismiss). (`src/challenges/tools/{choiceTools,textTools,gridTools}.ts`)
- **Micro-challenge polish pass — clearer, calmer, juicier, player-paced.**
  - Centralized every in-card instruction string into
    `src/challenges/tools/strings.ts` (one localization seam; no more English
    hardcoded across five tool files) and routed all tools through it.
  - **Countdown Recall** now lets the player study at their own pace: a centered
    "I'm ready →" button advances on demand (generous timer is only a fallback),
    words speak STAGGERED instead of all-at-once (intelligible TTS), and the
    study rows fade in in sequence.
  - **Finish the Dialogue** reads as a real conversation: NPC lines are flat
    left-aligned speech bubbles with a dashed "missing line" gap and a "Choose
    the reply" cue, visually distinct from the tappable answer tiles (which the
    correct pick now snaps into with a pop).
  - Memory cards lift + soft-shadow on flip-up and pop on a locked match for a
    more satisfying tactile feel. (`src/challenges/tools/*.ts`,
    `src/challenges/challenge.css`)
- **The town is ~9× bigger and RELAXED — the same props, spread into legible
  zones instead of a confetti pile.** The `plaza-grand` topology grew from
  ±40 (80×80 = 6,400 u²) to ±120 (240×240 = **57,600 u² ≈ 9×** the ground area),
  with the SAME ~28 buildings + a similar prop budget breathing across long
  sightlines toward a fogged horizon. Achieved by widening the street grid
  (`MIN_BLOCK` 9→16, pitch 14→21, up to 8 ring streets/side, plaza radius
  10→14) so the town reaches the new bounds rather than balling up in the
  centre. Buildings fill inward-first → a denser core, sparse edges (natural
  density falloff). (`scripts/genMap.mjs`, `content/topologies/plaza-grand.json`,
  `content/buildings/plaza-grand.json`)
- **Set dressing is now INTENTIONAL composition, not haphazard scatter.** New
  `src/world/composition.ts` — a pure, seeded, testable planner — lays the props
  into readable ZONES with real spacing discipline: a central **plaza** (benches
  ringing + facing the fountain, lamps at the cardinals), ONE tight **market**
  quarter (the densest vendor cluster gets the stalls + crates/barrels/sacks), 
  tree-lined **avenues** (lamps at a regular road rhythm + trees as paired allées
  along the axis lines), a leafy **garden** green (a grove around two benches),
  and thinning **residential** edges (density falloff toward the rim). An
  occupancy grid enforces a global min-gap (no two props < 1.0 u apart, **0**
  overlaps, nothing inside a collision blocker). `src/world/dressing.ts` is now a
  thin instantiation layer over the plan. (`src/world/composition.ts`,
  `src/world/dressing.ts`)
- **`src/world/roads.ts` rescaled to the enlarged map.** The single baked ground
  mesh + cobble street recipe were kept in lockstep with the new grid recipe
  (`MIN_BLOCK`/pitch/plaza/ring-count) so the streets, the generated topology and
  the avenue dressing all line up. Still ONE baked mesh — `qa/road-flicker.mjs`
  scores **0.0000%** z-fight on the bigger map (street-grazing, plaza-grazing,
  top-down). (`src/world/roads.ts`)
- **`scripts/genMap.mjs` no longer clobbers the Scene author's fields.** The
  scene write now MERGE-PRESERVES `sky` / `landmark` / `buildingStyle` / palette
  and only refreshes the anchor-ID-keyed `anchorSkins` / `npcSkins` that track the
  topology, so regenerating the map can't wipe scene-divergence work.
- **The third-person camera is now a LOW, over-the-shoulder "cruise" rig that
  looks OUT toward the horizon.** The follow camera dropped from eye height 8 to
  ~3 with a flatter pitch (a lifted look-target) and a closer trail (distance 11
  → 6.6) so the player is large + readable while the eye gazes at the distance,
  not the ground. A longer lens (`fov` 0.7 → 0.62) and framerate-compensated
  position/aim smoothing make the follow buttery at any fps. All values are named
  tunables on a `CameraRig` (`fov`/`distance`/`height`/`lookHeight`/`followLerp`/
  `aimLerp`), overridable via `EngineOptions.rig`. (`src/world/engine.ts`)
- **You can now see FAR.** The camera far clip jumped from `maxZ` 80 (the blocker
  that capped the view at the next building) to 600, revealing a deep,
  atmospheric horizon. (`src/world/engine.ts`, `EngineOptions.maxZ`)
- **The sky + distance fog are now a tuned zenith→horizon atmosphere, read from
  `scene.sky`.** `applyAtmosphere` paints a tall vertical gradient (deep zenith
  easing to a pale haze band at the horizon) and exp2 distance fog whose colour
  matches that haze, so far geometry melts gracefully into the sky on the bigger
  map. Reads `scene.sky` (`zenith`/`horizon`/`fog`/`fogColor`/`timeOfDay`) with
  warm-Antigua-day defaults, and flips to a clean neon-night sky (cool city glow,
  no daytime clouds) when `timeOfDay: "night"`. (`src/world/atmosphere.ts`)

### Added
- **A signature LANDMARK on the far horizon — `src/world/vista.ts`.** Reads
  `scene.landmark` (`kind`/`tintHex`/`label`/`azimuth`/`scale`) and renders a
  cheap painted billboard silhouette parked far beyond the play bounds on the
  horizon line: never pickable/colliding, baked atmospheric haze so it reads as
  distant air (fog can't erase it), depth-write off in render group 1 so the town
  occludes it but the sky never does, and slow, stable parallax as you walk
  toward it. Ships five kinds via a trivially-extensible painter registry:
  `mount-fuji` (snow-capped cone), `cathedral` (Antigua twin-tower), `eiffel`
  (lattice silhouette), `skyline` (neon high-rises), `volcano`. (`src/world/vista.ts`)
- **`qa/camera-vista.{mjs,html}` + `qa/camera-vista-mount.ts`** — WebKit/Playwright
  proof of the cruise camera + vista against the REAL follow camera (not a
  friendly test cam): asserts the low eye height, screenshots Mount Fuji /
  cathedral / Eiffel / neon-night skyline on the horizon, and measures
  pixel-centroid parallax across a lateral slide (far + on-screen + slow). fps
  ≥ 58. Boots its own vite on a unique port and tears down. Screenshots at
  `/tmp/wp-cam-*.png`.
- **`qa/composition.{mjs,html}` + `qa/composition-mount.ts`** — WebKit/Playwright
  proof of the relaxed, zoned town: a planner audit (no overlaps, min-gap ≥ 1.0,
  density falloff, all zones present) plus top-down / avenue / plaza screenshots
  and an fps sample (≥ 58). Boots its own vite on a unique port and tears down.
- **Scene divergence proven: ONE shared topology renders as warm Antigua 1770
  OR neon Tokyo 2050 — switchable live, identical collisions.** This is the
  Room×Scene spine made visible: a Room is the authoritative shared collision
  topology; a Scene is a per-player, data-driven SKIN of it. Both
  `content/scenes/antigua-grand.json` and the new `content/scenes/tokyo-2050.json`
  carry `topologyId: "plaza-grand"` — same footprints, same blockers — and
  diverge ONLY in data. Antigua gained a warm-day `sky` (soft fog, `timeOfDay:
  "day"`), a `cathedral` `landmark`, and `buildingStyle: "antigua-stucco"`.
  Tokyo adds a night `palette` (deep indigo/teal ground, neon accents), a night
  `sky` (`timeOfDay: "night"`, denser fog, neon-glow horizon), a `mount-fuji`
  `landmark`, Tokyo-flavored sprite skins (`ja-JP` voice hints) + narrative, and
  `buildingStyle: "tokyo-neon"`. (`content/scenes/{antigua-grand,tokyo-2050}.json`)
- **`createBuildings` switches its skin on `scene.buildingStyle`.** `antigua-stucco`
  (default, unchanged) = warm stucco/terracotta/sloped roofs. `tokyo-neon` =
  taller cooler glass/concrete blocks, flat tech roofs, dark concrete parapets,
  emissive cyan/magenta neon trim bands + a vertical sign blade, and lit-cyan
  windows — the SAME footprints, a divergent night-city skin. Absent style ⇒
  unchanged Antigua look. (`src/world/buildings.ts`)
- **`src/scene/sceneSwitch.ts`** — a registry `{ antigua, tokyo }` of the two
  parsed+validated Scenes and `createSceneSwitcher({ rebuild })` that flips the
  ACTIVE scene live (re-skinning palette/buildings/sky/landmark without moving
  collisions), with a `bindKey("p")` debug control.
- **`qa/divergence.mjs`** (+ `qa/divergence{.html,-mount.ts}`) — WebKit/Playwright
  proof that the SAME hero camera renders Antigua-day and Tokyo-night over one
  topology; asserts night is darker+cooler and day warmer, and captures
  top-down footprints proving collisions are unmoved.
- **NPCs now reliably OFFER a game — no longer hostage to the on-device model
  emitting a tool-call.** Every NPC presents a deterministic, in-character game
  offer on the first turn: a persona pretext line ("a verse fell apart and the
  rhyming words got scattered") plus a prominent filled "🎮 Play" chip. Tapping
  it fires the existing `onIntent({kind:"callTool", …})` path directly (an empty
  spec the tool fills from the language context), launching the centered
  challenge → reward. The tool is chosen deterministically from the NPC's
  `challengeTools ∩ quest.toolWhitelist` (stable per NPC, rotating on "play
  another"). The LLM `<<tool>>` path still works and is routed through the SAME
  dedup'd launcher so a model tool-call and a chip tap can never double-launch.
  After a challenge resolves, the NPC reacts in-character (a short congrats + a
  fresh "play another" offer), detected via a `MutationObserver` on the challenge
  overlay so the conversation flows around the game without touching `game.ts`.
  All new copy is localization-ready (overridable `RuntimeStrings` /
  `DialogueUIStrings`); the paper-cutout chat style and compositor-only overlay
  behavior are unchanged. (`src/npc/{npcRuntime,dialogueUI,promptProgram}.ts`,
  `src/npc/dialogue.css`)

### Changed
- **Set dressing is now REAL 3D, not paper cutouts.** Every décor prop (street
  lamp, leafy tree, potted palm, planter, barrel, crate, sack, signpost, cart,
  market-stall canopy, bench, water trough, and the tiered fountain) is a cheap,
  charming, stylized low-poly 3D mesh with actual volume — built procedurally in
  the new `src/world/props3d.ts` from boxes/cylinders/cones/spheres in the warm
  "Antigua 1770" key, merged per species. Orbiting the camera 360° can no longer
  reveal a paper-thin edge (the old flat yaw-billboarded cutouts "busted the
  illusion" the moment you turned the view); props now read as the same toy-
  diorama world as the buildings. Each species is a single merged mesh drawn via
  thin instances (one draw-call batch + a tiny shared material set for the whole
  town's worth), all static matrices frozen — so the per-frame billboard yaw pass
  is gone entirely. Lamps keep a small warm point-glow (additive, gentle flicker)
  and the fountain's top tier keeps its shimmer. Whole dressing layer ≈ 58
  draw calls; ~207 draws/frame for the full plaza (28 buildings + 28 characters +
  crowd + dozens of props), locked at 60fps across a 360° orbit. Characters
  remain the separate billboard system, untouched.

### Fixed
- **Road flicker eliminated by construction (single-mesh ground bake).** The
  street/plaza flicker was depth-buffer z-fighting between four near-coplanar
  ground planes (dirt base, cobble street strips, door aprons, flagstone plaza)
  all sitting at y≈0. Prior fixes stacked tiny Y offsets + escalating polygon
  `zOffset`, which only hid the fight at the angles that were tested — a 0.03-unit
  Y gap projects to sub-pixel depth at grazing angles, so the depth buffer still
  tossed a coin. Replaced with the correct permanent fix: the entire road network
  is now painted INTO a single composited ground texture (`bakeGround` in
  `materials.ts`) — dirt everywhere, cobble where streets/aprons go, flagstone in
  the plaza disc — on exactly ONE `CreateGround` mesh. One floor polygon at one
  depth means nothing can z-fight, at any angle. Texture-side shimmer is handled
  by mipmaps + `anisotropicFilteringLevel = 16` + trilinear sampling on the baked
  ground. Only the plaza stone ring remains a separate mesh (a real torus that
  stands proud of the ground — never coplanar). Proven by `qa/road-flicker.mjs`:
  0 hard depth-flip pixels at grazing-street, grazing-plaza, and top-down.

### Added
- **Realtime multiplayer presence — two windows, one plaza, seeing each other
  walk in real time (§8, M1).** An authoritative Colyseus server co-located in
  the pack (`server/`): `PlazaRoom` with `@colyseus/schema` state (a players map
  mirroring the contract `PresencePlayer`), `onJoin`/`onLeave` (with
  `allowReconnection`), and a validated `onMessage("move", MovementUpdate)`
  (max-speed + bounds anti-teleport). Matchmaking fills one `plaza` room to ~30
  then spins a sibling. New client presence layer `src/net/`:
  `createNetClient(...)` connects best-effort (no server → world runs solo, never
  crashes), broadcasts the local player's movement ~10Hz, and renders every other
  player as a grounded paper-doll cutout — reusing the same character/cutout/
  animator as locals so a remote human is indistinguishable from an NPC —
  **interpolated** (~120 ms buffer) for smooth motion. Run two clients with
  `npm run server` + `qa/mp.html`; `npm run qa:mp` self-verifies on two webkit
  windows (asserts each sees the other walk, 60 fps with a remote avatar,
  screenshots → `/tmp/wp-mp-*.png`). Movement-only this milestone; the seam for
  AI-mediated translated chat is documented in `docs/MULTIPLAYER.md`. game.ts
  wiring is opt-in via `VITE_WP_MULTIPLAYER_URL`.
- **Micro-challenge library — 20 lightweight, juicy language exercises (§6).**
  An NPC can now contrive a quick game with a pretext ("my market words got
  scrambled — help me sort one out?") and reward you with XP, coins and items.
  New `src/challenges/`: a centered RPG-style **encounter overlay** (`overlay.ts`
  + `challenge.css`, `.wp-ch-` prefix) with NPC pretext ribbon, timer/score/streak
  HUD, combo feedback, and a confetti reward reveal — mounted out-of-flow
  (`position:fixed`) with compositor-only open/close (proven zero-layout-shift in
  `qa/challenges.mjs`). A composable `ChallengeRuntimeHost` (`host.ts`) wraps the
  Corpán host's corpus/TTS/STT, with a `mockChallengeHost()` so the whole library
  runs standalone in the browser. The 20 tools: word-scramble, build-sentence,
  fast-translate, tap-translation, listen-&-choose, true/false, odd-one-out,
  number/price drill, fill-the-blank, dialogue-fill, spot-the-typo,
  conjugation-tap, rhyme-match, picture-match, memory-pairs, category-sort,
  countdown-recall, word-search, read-aloud (STT) and say-it-back (STT).
  `runChallenge(toolId, ctx, host, opts) → ChallengeResultPlus` (the contract
  result + `rewards:{xp,coins,items}`) is the single call `game.ts` wires to an
  NPC `callTool` intent; rewards scale by difficulty × score (item ids are opaque,
  owned by the economy agent). Contracts: extended `ChallengeToolId` (+20 ids) and
  added `ChallengeReward` / `ChallengeResultPlus`; legacy ids alias onto the new
  tools so existing NPC prompt-programs keep working. See `docs/CHALLENGES.md`.
- **Pluggable Look layer (§1 Premium Foundations).** The world's render style is
  now a swappable strategy behind a tiny `WorldLook` interface
  (`src/render/worldLook.ts`): `build(scene, topology, scene, onFrame) → {dispose}`.
  The current 2.5D town ships as `createStylizedLook()` — *one* implementation —
  and a future `create3DLook()` (full glTF/PBR, bubble-people scenes) slots into
  the same interface via `selectLook()` with zero caller changes. `renderScene`
  stayed API-stable, so `game.ts` is untouched. See `docs/RENDER_LOOK.md`.
- **Procedural PBR surface library (§1).** `src/render/materials.ts`
  (`MaterialLibrary`) bakes normal-mapped cobblestone, flagstone, terracotta tile,
  stucco and ashlar-stone `PBRMaterial`s — no asset dependencies, ~6 shared
  materials for the whole town, MIP-mapped, world-space tiled, mobile-tiered. The
  town reads richer and dimensional while staying in the warm Antigua-1770 mood;
  roads/roofs now look like real cobblestone + tile.

### Fixed
- **The crowd no longer gathers into a ring around a standing player.** Stand
  still and the town now flows around and past you, dispersing — never a static
  circle. ROOT CAUSE: every agent that wandered within ~4.5u of the player used
  to STOP and park ("greet"), resuming only when the player left, so passers-by
  accumulated over time into a ring. The general crowd now keeps MOVING: a passer
  gives a brief IN-STRIDE acknowledgment (a quick ~0.5s wave) without halting its
  path, throttled by a per-agent cooldown, then walks on. "Who you can talk to"
  is unchanged — `npcFocus` owns it independently by reading each agent's live
  position, so no halt is needed. Wander targets are now spread across the whole
  walkable map (only ~35% lightly biased toward the agent's tend-anchor, never
  the plaza centre) and are kept clear of the player, so nobody PATHS at you;
  separation widened (1.4→1.9u) so they don't clump. New opt-in quest-seeker:
  `CrowdOptions.questSeekerIds` / `questSeekers` flag up to a few bound-role
  agents that DO actively seek + approach the player and stop to engage; with no
  flag set, nobody seeks you. The `Crowd`/`CrowdFocusHandle` API is unchanged.
  Verified in WebKit (seed `wp:identity:v1`): holding the player still for ~9s at
  the spawn AND at the busy plaza centre, within-4u agent count stays at 0–2 and
  does not accumulate. (`src/world/crowd.ts`.)
- **Décor cutouts no longer go paper-thin when you orbit the camera.** Set
  dressing previously baked a fixed yaw into every thin-instanced prop (the
  mesh-level `BILLBOARDMODE_Y` is inert on a thin-instanced + world-frozen mesh —
  it would orbit the whole batch around the world origin, so props were
  effectively fixed and went edge-on when you rotated). Replaced with a HYBRID
  per-prop rule in `dressWorld`: a prop more than ~1.5u from any building
  footprint (free-standing lamps, trees, palms, planters, signposts, open market
  goods) is registered as a **camera-facing billboard slot** and yaws toward the
  camera every frame via a cheap per-instance matrix rewrite, so it never goes
  thin; a prop within ~1.5u of a wall stays **FIXED facing outward** so its flat
  width can't sweep through the building. The decision uses the topology's
  building blockers (the central fountain footprint is excluded so plaza props
  ring it freely). Draw-call budget is unchanged (fixed + billboard instances
  share one buffer per species; only billboard-bearing species use a dynamic
  buffer, updated only when the camera actually moves, with zero per-frame
  allocations). Bunting spans stay intentionally fixed/flat. New
  `wallOrientation()` helper in `billboard.ts`.
- **Z-fighting flicker on roads and flat roofs, killed at the root (§1).** Road
  strips were coplanar with the ground and flat roof slabs coplanar with
  parapets/body tops → depth-buffer fights. Fixed by construction: the ground is a
  strict depth tier (distinct world-Y + growing polygon `zOffset` per layer; the
  plaza ring is now a true torus), and roofs are embedded below the body top with
  a tiered (no longer coplanar) flat-roof terrace, built as separate meshes with
  their own UVs/depth. Proven flicker-free at grazing/oblique/walking angles
  (`qa/flicker.mjs`: ~0.001% hard-flip pixels). Sustained 58–60fps on the full
  grand town (`qa/perf.mjs`).

### Changed
- **Faces are warm and wholesome again (§2 Premium Foundations).** Every NPC used
  to render a one-sided / asymmetric mouth+brow, which read as a smirk/sneer — the
  whole plaza looked like a horde of contemptuous villains. Redesigned the face
  renderer (`src/character/characterArt.ts`) around a SYMMETRIC default set:
  neutral, smile, grin, content, shy, frown, surprised, sleepy — all mirror
  left↔right. Asymmetric mouths/brows (`smirk`, `sneer`) are now the ONLY
  one-sided expressions and are reserved for explicitly sly/villain characters.
- **Expression as personality.** `CharacterSpec` gains a `demeanor` trait
  (friendly/cheery/gruff/shy/sly/sleepy) and a richer `Expression` union
  (`characterSpec.ts`); `characterGen.ts` sets demeanor by role + seed with a
  wholesome-heavy distribution (a baker beams, a dockhand frowns, a merchant grins,
  the one smuggler smirks). Smirk/sneer dropped from ~all faces to ≈6% of a mixed
  crowd. Deterministic + varied.
- **Talking mouths.** `animator.ts` `talk` state now runs a believable procedural
  speech cadence (flap × syllable-gate, low-passed, desynced per character). Added
  `setMouthAmplitude(0..1)` (real-audio seam — mic AnalyserNode RMS or future
  WebAudio TTS drives the mouth when available; native TTS has no analyser so the
  default is procedural) and `talk(active)` sugar. Mouth repaint stays inside the
  throttled+dirty-checked redraw; crowd holds 60fps (people QA: 58fps @ 34 agents).
  Self-verified by `qa/faces.mjs` (gallery + talking-head, smirk ratio 3.3%/6.2%).

### Added
- Items, inventory & economy foundation (§6 Premium Foundations). **Item** is now
  a first-class, Zod-validated model (`src/items/itemTypes.ts`): id, name, art
  (cutout id), kind (cosmetic/consumable/quest/trade-good), slot, rarity, value,
  description, tags — cosmetics project onto avatar layers. A starter catalog of
  38 Antigua-1770 colonial items (`content/items/catalog.json`). An
  inventory + wallet store (`src/economy/inventory.ts`): `applyReward({xp,coins,
  items})`, grant/consume/equip, events, persisted COMPACTLY to localStorage
  (`wp:economy:v1`, ids+counts only) with a quota-safe write path that never
  throws QuotaExceededError. Quest-relevance (`src/economy/questItems.ts`) makes
  an item precious on one quest and junk on another, with NPC clue helpers
  (`relevance`, `hasNeeded`, `cluesFor`, `safeToSell`). A premium commerce
  overlay (`src/economy/shop.ts` + `shop.css`): buy/sell/trade/equip with NPC
  merchants, out-of-flow + compositor-only (no layout shift). AI-mediated
  player-to-player trade (`src/economy/trade.ts`): menu-only proposals (never raw
  UGC), local transport stub + documented Colyseus server seam. Docs in
  `docs/ITEMS_ECONOMY.md`; self-verified by `qa/shop.mjs` (12/12, no quota
  errors, no layout shift).
- Game shell (`src/shell/*`, §4 Premium Foundations): `createShell()` — the
  lifecycle frame the orchestrator wires into game.ts. ESC routing (dialogue
  open → close; paused → resume; else → pause), `pause.ts` (dignified pause
  overlay that halts the sim + frees the LLM via the broker hook, restores on
  resume), `exit.ts` (return-to-host via the `corpan:exit` window event, gated by
  an in-pack confirm), `confirm.ts` (`wpConfirm` paper-cutout modal — never
  `window.confirm`), and `save.ts` (versioned identity/position/progress
  persistence seam for fresh-load restore). All overlays are out-of-flow +
  compositor-only, so none can shift the scene.

### Fixed
- NPC dialogue panel can no longer jerk the 3D scene on open/close. The panel +
  scrim are now `position: fixed` (anchored to the viewport, never in any
  ancestor's document flow) from their first painted frame — the off-screen
  transform is stamped inline at creation, so even a frame before the stylesheet
  parses is out of flow. Open/close animate `transform`/`opacity` only (never
  width/height/top/flow). The composer no longer autofocuses on touch (which
  raised the keyboard and scroll-jumped WebKit) and focuses with
  `{ preventScroll: true }` on desktop. Proven by `qa/shell-no-shift.mjs`: the
  canvas bounding box is byte-identical across open and close.

### Added
- World set dressing (`src/world/dressing.ts`): `dressWorld(babylon, topology,
  opts)` scatters a lived-in colonial town's worth of paper-cutout props —
  street lamps with warm dusk glows, trees, potted palms, planters/flower boxes,
  market crates/barrels/sacks, signposts, carts, hanging bunting across the
  streets, water troughs and a grand multi-tier fountain centrepiece. Placement
  is read from the topology (rings decor/bench anchors, flanks portal doors,
  clusters around vendors, lines the streets between buildings) and never
  overlaps blockers or spawns. Every repeated prop is a single thin-instanced,
  material-shared, world-frozen mesh (~15 draw calls for the whole town);
  seeded deterministic variation; `lean` phone caps; cheap onFrame lamp
  flicker / banner sway / fountain shimmer.
- Premium onboarding (`src/onboarding/`): skippable welcome → safe-name roller
  (fixed curated lists, `content/identity/names.json`) → paper-doll avatar
  dress-up (free starter kit, `content/cosmetics/starter.json`) → Enter the
  Plaza. Returns a validated `GeneratedIdentity` + `AvatarSpec`, persisted to
  localStorage.
- World atmosphere (`src/world/atmosphere.ts`): painted sky dome, warm morning
  light rig + rim light, distance fog, drifting dust motes, vignette — phone-tier
  budgeted, no post pipeline.
- Premium procedural cutout art (`src/world/cutoutArt.ts`): layered torn-paper
  characters/props with expressive faces and era dressing (stand-in until the
  Spark 2D sprite pipeline; ids + layering are the durable contract).
- Hardened dual-joystick controls: per-pointer state (true multi-touch move+look),
  one stick per half, pointer-capture, dead-zone + analog magnitude.
- On-device model strategy (`docs/MODEL_STRATEGY.md`) + world art direction
  (`docs/WORLD_DIRECTION.md`).
- NPC AI dialogue system (`src/npc/`): on-device Qwen3-4B drives streaming,
  in-character, language-teaching NPC conversations. Includes a model-lifecycle
  broker (lazy LLM load, idle/background/pressure unload, one-large-model-at-a-
  time guard per `docs/MODEL_STRATEGY.md`), prompt-program compiler with a
  JS-side `<<tool>{…}</tool>>` tool-call protocol parsed into typed `NpcIntent`s,
  a premium paper-cutout chat panel (streaming bubbles, suggested-reply chips,
  TTS replay, keyboard composer with a stubbed `VoiceInput` mic seam), a
  scripted-fallback path for LLM-unavailable devices, and a mock host for
  standalone/browser dev. Sample content: `content/npc/roles.json` +
  `content/quests/es-cafe.json` (ES-from-EN café/travel).
- Initial pack scaffold (package.json, tsconfig, manifest, vite build).
- `@world-plaza/contracts` v0 — the typed interface spine (Zod schemas +
  inferred types) for Room / Scene / Quest / Curriculum, identity/avatar,
  presence/movement, interaction, challenge tools, NPC, AI-mediated chat,
  economy, pack/assets, and offline sync. This is the shared contract imported
  by the client, the Colyseus realtime server, and the Fastify durable API.
