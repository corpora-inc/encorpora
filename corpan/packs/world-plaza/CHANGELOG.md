# Changelog

All notable changes to the **World Plaza** pack are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Quest titles + descriptions now localize into the learner's language (~46
  locales) and FLIP native↔target with immersion.** They rendered English
  regardless of the native stack. The keying machinery + `en` source already
  existed (`quests.ts` / `questString` / `makeQuestLocalizer`); the gap was that
  only `en` was generated. Generated all 46 ship locales for the 65 quest keys
  (title / narrative / step) via a `--quests` mode added to `tools/gen_i18n.py`
  (same proven pipeline as the chrome catalog). Immersion was already wired
  (game.ts `relocalize` rebuilds the quest localizer with the live `uiLocale` =
  native OFF / target ON), so quest copy now flips with the toggle for free. Added
  a freshness gate (`questLocales.test.ts`) so every shipped locale carries every
  quest key.
- **Special-NPC NAMES localize everywhere (capsule, quest section, tracker, AND
  the map) and flip with immersion.** The shared `anchorName` helper (game.ts)
  passed `undefined` for the translate fn, so the objective NPC's name ("the café
  host") rendered English on every surface even though `specialNpc.displayName`
  already localizes via `t(nameKey, lang)`. Wired a quest-catalog-backed `t` + the
  live `uiLocale` into that ONE shared resolver, and keyed + generated the 5
  `special.*.name` values (content/npc/special.json) into all 46 locales — so the
  map (a pure consumer of `anchorName`) localizes for free, with no divergence.
  the last colonial thread.** Text/identity only: `setting.{place,era,mood}` +
  `narrativeBlurb` in both scene files (`antigua-grand.json` runtime, `antigua-1770.json`
  tests) are modernised, so the persona seed reads "…in Corpan City" instead of
  "…in Antigua". HARD CONSTRAINT honoured: NO palette / visual / world-gen value
  changed (the warm paper-craft look is byte-identical — a test asserts the palette
  hexes + themeId are untouched), and the scene `id`/filename are kept so loaders/
  economy don't ripple. `fallbackLangOf` (which used the "1770"/"antigua" era/place
  text to pick the Spanish scripted-fallback pack) now keys on the stable scene id,
  so the world still teaches Spanish while the dev Tokyo scene stays neutral. The
  `era` text was chosen ("today") so the economy's `defaultCurrencyForScene` resolves
  to the SAME default (gold-real) as before — zero economy behaviour change.
- **NPC personas are now MODERN Corpan City roles, not colonial-1770 trades.** The
  whole wandering-crowd archetype catalogue (`src/npc/personaGen.ts`) was re-themed
  from storybook trades (lamplighter, fishmonger, scribe, friar, sailor, dockhand,
  weaver, herbalist, water-seller, flower-girl, smuggler) to everyday contemporary
  city people — 19 wandering roles: baker, street-food vendor, shopkeeper, dog-walker,
  university student, tour guide, delivery courier, line cook, street busker,
  neighbourhood regular, kid, coffee-cart vendor, office worker, barber, florist,
  hurried commuter, bike courier (cyclist), street cleaner, and a rare wholesome
  "fixer". This makes venue-fit read naturally and kills the storybook mismatch that
  made an NPC outside the clinic feel like nonsense. Role flavour (tone/quirks/
  topics/names/hooks/ES fallback lines) was modernised; the deterministic archetype ×
  demeanor × name × quirk variety, challenge fit, crowd balance, and per-archetype
  domain affinities (`minigameContent.ts`) all carry over. The venue-only archetypes
  (doctor/pharmacist/barista/grocer/conductor/banker) stay weight-0, reachable only
  via the venue map.

### Fixed
- **The objective/station NPC at a venue is now a believable, venue-FIT role — no
  more "dusk-loving lamplighter" standing outside the clinic.** The persona
  generator chose its archetype from the wanderer's seeded face/demeanor and
  ignored the venue anchor, then injected the trade's **English** label straight
  into the system prompt — so a 4B model parroted it ("Soy un lamplighter") even
  with the Spanish-only directive in place. Three fixes (`src/npc/personaGen.ts` +
  `src/npc/promptProgram.ts`): (1) a `VENUE_ARCHETYPE` map forces the role to fit
  the venue — clinic/hospital→doctor, pharmacy→pharmacist, café→barista,
  market→grocer, station/rail/bus/airport→conductor, exchange→money-changer — and
  the venue WINS over the demeanor lean, so a sleepy face at the clinic is still a
  doctor; (2) the persona seed names the role in the **target language**
  (`ROLE_TERMS`) or, for an unauthored language, a language-neutral venue clause
  ("the local who runs the café counter here") — it never injects a bare English
  trade noun; (3) a venue NPC's seed is grounded ("you work right here and never
  deny it; stay grounded, plausible, and brief"), so it can't contradict the venue
  it stands at.
- **Minigames no longer flash a 0% "Not this time" card instead of presenting the
  challenge.** Two compounding bugs: (1) the pair-agnostic quests carry no
  `contentSelector.languageCodes`, so the minigame content filter became
  native-only (`["en"]`); since the bundled corpus reuses `languageCodes` as its
  translation-row whitelist, the TARGET (Spanish) rows were dropped, every entry
  resolved to zero usable pairs, and the challenge had 0 rounds. (2) On a content
  shortfall the grid/text tools called `complete(0)` — a scored 0% fail — instead
  of aborting. Fix: `resolveMinigameContent` now seeds the whitelist from the
  learner PAIR (target + native) so the corpus always returns both rows, and EVERY
  content-backed tool now `cancel()`s (degrades, re-picks) on insufficient content
  rather than flashing a 0% result. A content miss degrades, never fails.
  (`quest/minigameContent.ts`, `challenges/tools/gridTools.ts`,
  `challenges/tools/textTools.ts`)

### Added
- **The wardrobe now previews your real 3D character.** Re-opening your wardrobe
  shows the same lit "bubble person" you walk the world as — a full standing
  figure in a warm portrait alcove that gently turns and that you can spin with a
  drag — instead of the old flat paper doll. Every garment, hat, skin tone, and
  piece of finery you tap updates the figure live. (It falls back to the 2D doll
  if the device can't open a WebGL view, so the wardrobe always works.)
- **Enterable buildings — walk into the Corner Café.** Walk up to the café and a
  door affordance rises; step inside to a warm interior (lit window, chalkboard
  menu, steaming cups, a real barista you chat with in your target language). The
  café-order objective plays out here — tap **Order a coffee**, do a quick
  mic-free drill, and the café quest advances. The interior is a screen-space
  overlay scene, **not** a new 3D room, so entering a building adds zero
  persistent draw calls and never touches the world's 60 FPS.
- **Every named venue is now a real, placed landmark.** The café, outfitter,
  general store, central green, stadium, and exchange are placed at real building
  facades with stable anchors, so quests, the map, and door portals all bind to
  them (previously several of these had no on-map home).
### Changed
- **The Phone is now the SINGLE in-game menu — a little phone simulator.** ONE FAB
  (the real **Corpán app logo**, the "all-hearing ear" brand mark, not a drawn
  glyph) opens a **home screen** of apps: Map, Things (Inventory), Quest, Badges,
  Music. Tap an app → it opens; a back chevron returns home; close (or Escape twice)
  resumes the world. The old Map | Inventory | Quest | Badges tabbed modal AND the
  separate satchel "pack" FAB are **retired** — the phone subsumes both (one FAB
  bottom-left, no more FAB pile-up). Each app re-homes the SAME section renderer the
  old menu used, so all functionality (wallet, items, wardrobe entry, quest
  tracker/switch, the full map, the badge case) is preserved, not rebuilt. "Leave
  the Plaza" is homed on the phone's home screen → the proven exit confirm. RTL +
  immersion-relocalize + the no-layout-shift contract are kept; tablet/desktop dock
  the phone as a corner card (first-class). (`shell/phone/*`, `shell/shell.ts`,
  `shell/menuButton.ts` [retired under the phone], `game.ts`)

### Added
- **Music now respects + persists the player's choice — it never starts from
  nowhere.** Onboarding gained a 4th step, "Want music while you explore?"
  (Yes/No), so the choice is made up front, before the world. The Phone's Music app
  fronts an explicit on/off switch; on/off, the chosen station, and volume persist
  (`audio/musicProfile.ts`, localStorage) and are restored on launch. A fresh
  player (or one who declines / skips onboarding) hears **nothing** until they opt
  in — the ambient radio start in `game.ts` is gated on the consented profile, and
  the Music app then merely *controls* an already-consented feature.
  (`onboarding/onboarding.ts`, `audio/musicProfile.ts`, `shell/phone/musicApp.ts`,
  `game.ts`)

### Fixed
- **The phone sheet no longer peeks from the bottom when closed.** On landscape
  phones and on tablet, the rounded top edge + grab handle of the closed phone
  sheet stuck ~14px into the world view. Its off-screen transform was `105%` (a
  5% margin), which didn't clear the panel's height + shadow at those aspect
  ratios — and a stale inline `105%` was overriding the larger tablet rule too.
  Both now use `translateY(calc(100% + 40px))`, so the sheet is fully off-screen
  when closed at every aspect ratio.
- **Building roofs no longer hide your character.** When the camera looked down
  over a rooftop, the roof stayed solid and the player vanished beneath it. Roofs
  (the flat caps the streamed city uses) are now treated like every other
  occluder and smoothly fade out whenever they sit between the camera and your
  character — no draw-call cost (purely a visibility fix; the world geometry is
  unchanged).
- **NPC dialogue no longer contains emoji.** The on-device model sometimes
  sprinkled emoji into a line ("…frutas frescas! 🍓"), breaking the grounded tone
  and handing a pictograph to TTS. All generated NPC prose is now run through one
  emoji/pictograph stripper before it's shown, spoken, or saved, so the dialogue
  bubble, the spoken text, and the history are all clean. Real scripts (CJK,
  Arabic, Devanagari, accented Latin), currency, digits, and punctuation are
  untouched.
- **Wardrobe: one clear "None" per category + a premium feel.** The Hat and
  Accessory rows showed a duplicate empty option ("None" *and* "No Hat"); each
  category now offers a single "None". The whole sheet was elevated — a gilt-
  seamed title, a lit portrait stage for the 3D figure, and the finery you've
  collected set apart in its own framed treasury — so it reads as an atelier, not
  a form.
- **No more sideways scroll on the onboarding and quest screens.** A long row of
  dress-up chips or a wide minigame grid could scroll the card sideways and hide
  the first options; the onboarding card and the challenge body now clamp
  horizontal overflow (the rows already wrap), so the first chips are always
  reachable at every screen size.
- **Dev-only "(P) perf" hint and perf HUD no longer leak into the app.** The
  perf-toggle hint and its overlay are now gated behind a dev build, so they never
  appear in normal play.
- **NPC dialogue no longer contains emoji.** The on-device model sometimes
  sprinkled emoji into a line ("…frutas frescas! 🍓"), breaking the grounded tone
  and handing a pictograph to TTS. All generated NPC prose is now run through one
  emoji/pictograph stripper at the single text chokepoint, so the dialogue bubble,
  the spoken text, and the saved history are all clean. Real scripts (CJK, Arabic,
  Devanagari, accented Latin), currency, digits, and punctuation are untouched.
- **You no longer walk through the party bunting.** The festival flags strung
  around the market square hung at head height; the line was raised so you pass
  cleanly underneath.

### Changed
- **Quest believability + cohesiveness pass.** Objective NPCs now stand at
  theme-matched venues instead of all crowding the plaza: the café order plays
  out at the **café** (not "a barista at the fountain"), departures at the **rail
  station**, City Hall at the **exchange**; the clinic stays at the hospital,
  ferry/fishmonger at the harbor, groceries/numbers at the market. Quest copy was
  tightened to match each place. The completion fork no longer sends you straight
  back to the venue you just left (rotates the next-quest objective by venue), so
  you don't get the same-looking NPC three quests running.

### Fixed
- **The map now shows the whole city — every venue is findable.** The
  airport, rail/bus stations, taxi rank, café, outfitter, general store, central
  green, stadium, exchange, and hospital are all plotted with distinct, legible
  icons + a legend entry each, on both the corner minimap and the full map
  (previously the transit hubs arrived as generic "portal" anchors and were
  dropped to a faint tick, so the owner "couldn't find where to go"). Venues are
  classified by their contract anchor id, so they read correctly wherever the city
  places them. Added a "go here" wayfinding cue toward the active objective — a
  dashed leader when it's in view, and an edge arrow pointing toward it when it's
  off the (player-following) minimap window.

- **Quests are truly pair-agnostic.** Dropped the baked
  `contentSelector.languageCodes: ["es"]` from every pair-agnostic quest, so a
  non-Spanish learner's challenge content is drawn from THEIR stack's target
  language instead of being constrained to entries that happen to have Spanish.

- **Translate/match minigames no longer go target→target (ES→ES) with immersion
  OFF.** The content filter's `languageCodes` doubles as the bundled corpus's
  TRANSLATION whitelist, so a target-only list (`["es"]`) made the corpus drop the
  native (English) row — collapsing the challenge's native gloss to the Spanish
  target. A learner saw "Tap the one that means «el pan»" with all-Spanish tiles,
  and `pictureMatchWordHint` received the Spanish target in its `{native}` slot.
  `resolveMinigameContent` now threads the learner's native code into
  `languageCodes` whenever it differs from the target, so both translations come
  back and cross-language games stay genuinely two-language. Single-language stacks
  (native === target) are unaffected — the whitelist stays the single code.
  (`quest/minigameContent.ts`, `game.ts`)
- **Choice/match instructions no longer say "word" over a sentence tile.** The
  picture/word-match fallback hardcoded "Tap the **word** that means …" even when
  the answer tiles were full corpus sentences ("Trae el libro aquí."). The English
  source for the tap-the-meaning instructions is now noun-neutral ("Tap the **one**
  that means …"), true for a word, a phrase, or a sentence. (Locale strings are
  regenerated from the new English source by the i18n pass.)
  (`i18n/strings.ts`, `challenges/tools/strings.ts`)
- **The challenge close (×) button is premium and properly inset.** It was a flat
  34px circle straddling the card's rounded corner + the layered gold frame. It is
  now a 44px touch target with a smaller visible disc centered well clear of the
  corner/deckle, accent-aware (tinted to the scene accent), with hover/active/focus
  states. One shared button serves every minigame. (`challenges/challenge.css`,
  `challenges/overlay.ts`, `challenges/registry.ts`, `game.ts`)
- **The Phone's "all-hearing ear" launcher FAB now renders.** The FAB component
  shipped referencing `.wp-phone-fab*` classes that were never written to CSS, so
  it was a zero-layout invisible button — the phone (Inventory + Music) was
  unreachable. Added the FAB styles to `shell/phone/phone.css`, mirroring the pack
  button and stacked one slot above it in the bottom-left corner. (`phone.css`)

### Added
- **Minigames now draw rich, varied, relevant phrases from the full corpus,
  bound to WHO you're talking to and WHAT the quest is about.** A new
  content-resolution layer (`resolveMinigameContent`) blends each NPC's trade →
  real corpus domains (baker→food/everyday, boatman→travel, scribe→business/civic…)
  with the quest's theme + the player's CEFR level, then fills each round from a
  THEMED + LEVEL-SCALED draw that VARIES across plays while keeping the quest
  step's authored vocab as a cohesive core. A café host and a dock keeper now
  drill different, on-topic phrases instead of the same six. Degrades gracefully
  (unfiltered draw) on hosts without filtered queries; single-language-stack safe.
  (`quest/minigameContent.ts`, `challenges/host.ts`, `challenges/tools/_shared.ts`,
  `game.ts`; corpan-app `contentPacks/hostApi.ts` forwards `domains`/`levels`.)
- **Real commerce + dress-up loop (economy).** Earn currency from
  quests/challenges → spend it at shops/NPCs → dress up. All in-game soft
  currency (no real-money IAP, no dark patterns):
  - **NPC offers** — dedicated/special NPCs now make REAL, deterministic,
    inventory-affecting buy/sell/trade offers (a "Make a deal" chip → a juicy
    in-pack confirm sheet; applies atomically to the live wallet/bag, gated so you
    can never overdraw or double-own). Rides the existing `forcedOffer.onConfirm`
    NPC seam. (`economy/npcOffer.ts`.)
  - **Indoor shops** — enterable shop interiors (outfitter / general store /
    market stall) via the vignette pattern: walk to a shopfront, enter a cozy
    interior with a real Qwen3 shopkeeper, browse/buy, exit to town. City portals
    at `plaza` / `market` / `harbor`. (`economy/shopVignette.ts`.)
  - **Wardrobe re-entry** — re-open the avatar customizer in-game (from the
    outfitter AND a "Change your look" control in the Inventory panel) to change
    outfit + equip bought bling; the live player figure re-dresses IN PLACE (no
    world reload) and persists per-profile. (`economy/wardrobe.ts`,
    `movement/controller.ts` `redress`.)
  - **Player-to-player selling** — consumes the multiplayer trade transport via a
    feature-detected provider seam; validates value/ownership (anti-cheat) and
    applies only OUR side. Works solo (local stub) without the net.
    (`economy/p2pTrade.ts`.)
  - One `initEconomy(...)` wiring call in `game.ts`; the inventory store stays a
    clean read API the phone shell embeds. (`economy/initEconomy.ts`.)
- **Quests at scale — a much larger, pair-agnostic, keyed quest catalog.** The
  6-quest demo grows to 16 quests spanning every scene + domain: plaza (greetings,
  café, business), market (numbers, groceries), fountain (directions, meetup),
  harbor (ferry, fishmonger, grand route), station (departures), civic (City Hall,
  clinic), and a bridge crossing. The new quests are **pair-agnostic + keyed**:
  no hardcoded English/ES — copy resolves through `src/i18n/quests.ts` (literal
  fallback, ready for `gen_i18n.py`), and target vocab comes from the corpus by
  **domain + CEFR level** (no pinned `entryIds`), so a quest works for any language
  pair and any single-language (immersion) stack. (`content/quests/*.json`,
  `quest/questCatalog.ts`, `i18n/quests.ts`.)
- **Quest variety engine (replay freshness).** The completion interlude's
  next-quest branch now honours the authored fork first, then backfills from the
  catalog — shuffled by a per-pair seed with recently-played quests pushed to the
  back — so you rarely see the same cards twice in a row. A per-pair, persisted
  recent-history ring + play counter rotates the branch between replays.
  (`quest/questVariety.ts`, `quest/questRuntime.ts`.)
- **Keyed quest localization now flows to the UI.** The Status Capsule, Quest
  section, and completion interlude render quest titles/step labels through the
  keyed catalog in the live UI locale (native, or target under immersion), re-
  pointing in place on an immersion flip. (`quest/questLocalize.ts`,
  `quest/questTracker.ts`, `quest/questSection.ts`.)
- Beginner quests stay **winnable by tapping** (mic-free gates); a speak gate
  appears only as the capstone of an explicitly-advanced quest, never as a quest's
  first step — guarded by a catalog-integrity test so the unwinnable-mic-gate bug
  can't return. (+30 quest tests; `npm run test:run` 431 green.)
- **Three transit HERO landmarks + boarding vignettes (the city scales out).**
  The metropolis gains a **Union Rail Station**, a **Central Bus Terminal**, and a
  **City Airport** — each a real anchored landmark (distinct hero footprint: rail
  head-house + clock block, bus terminal with departure bays, airport terminal +
  control tower) in its own quadrant, with a ceremonial forecourt ARCH you walk
  THROUGH to board. (`city/generateCity.ts`, `world/specialPlaces.ts`.)
- **Transit is now reachable in normal play.** Each station landmark is a literal
  ENTRY POINT: walk up → a localized Enter affordance → the matching **boarding
  vignette** (a paper-person clerk who talks in the TARGET language via the real
  Qwen3 runtime, a departures board, a say-it-back challenge that EARNS the trip,
  a fare paid from your wallet) → you ARRIVE at the chosen landmark (`travelTo`
  re-spawn). One shared boarding vignette, three mode skins (bus / train / flight);
  the taxi rank stays as-is. (`vignettes/boarding.ts`, `vignettes/index.ts`,
  surgical wiring behind `addTransitPortal` in `game.ts`.) Every string is keyed
  with an English fallback (the taxi convention) — ready for the ~50-lang fill.
### Added
- **Real humans, bridged by the machine — the multiplayer interaction layer.**
  When you approach another real player you see a privacy-safe profile card (their
  language stack, and their place only when k-anonymity allows — country if enough
  players share it, else continent, else "somewhere out there"; the finer fact
  never crosses the wire). You can open an **LLM-mediated cross-language chat**
  where the on-device Qwen3 translates + turns each line into a tiny lesson (with
  tappable replies in the partner's language), **challenge** another player to a
  shared minigame (reusing the existing challenge system; both earn — no
  punishment), or **trade** (a Colyseus-backed transport the economy layer drives).
  Entirely additive + feature-detected: with no server the single-player game is
  untouched. One wiring call (`initMultiplayer`) in `game.ts`; new `src/multiplayer/*`
  module; server interaction handlers + a k-anonymity geo histogram in `server/*`;
  new contracts `profile.ts` (`SafeProfile`/`resolvePlaceReveal`/`K_ANON`) + `mp.ts`
  (the typed wire protocol). Chrome localized into all ~46 langs.

### Performance
- **Chunk-level building-detail MERGE + figure culling (city scale headroom).**
  Three cuts that slash the per-frame *active-mesh evaluation* — the cost the docs
  flagged as the biggest frame phase, which scales with TOTAL resident meshes, not
  visible ones:
  - The streamed city built one `createBuildings` call PER BUILDING, each making
    an empty-geometry root **Mesh** — hundreds of pointless active meshes the
    renderer re-evaluated every frame. Root is now a `TransformNode` (invisible to
    the active-mesh pass). (`world/buildings.ts`.)
  - A chunk now runs a **merge pass** after its buildings: every same-material
    roof cap (`wp-r-`), door step (`wp-st-`), and contact shadow (`wp-sh-`) across
    the whole chunk folds into ONE combined mesh each — ~3·N detail draws →
    ~3/chunk. Prefixes the shadow/occlusion systems key off are preserved (the
    combined roof stays a `wp-r-` caster). (`city/chunkMesh.ts`, +`meshes` on the
    buildings handle.)
  - 3D figures no longer force `alwaysSelectAsActiveMesh` on every part/face/shadow
    — they cull normally against a FRESH (never-frozen) bbox, so a figure behind
    the camera drops out of the instanced batch + its unique face/shadow draws,
    with no dissolve regression. (`character/figure3d.ts`.)
  - Measured at the spawn neighbourhood (9 near chunks): meshesActive 457→186
    (−59%), resident meshesTotal 1978→1043 (−47%), in-frustum draws 470→436; the
    draw win compounds as districts multiply. Profile with `qa/measure-perf.mjs`.
- **Bridge merged + roofs simplified (draw-call cuts).** The bridge was ~131
  separate boxes (one static structure = 131 draw calls); now merged by material
  to ~4. Generic-building roofs — barely visible at the play camera — collapse from
  5–8 separate slab/parapet/chimney meshes to a single flat cap (hero landmarks
  keep their silhouettes; `localStorage['wp:fancyRoofs']='1'` restores the detail).
  Measured ~566→465 draws/frame. (`world/bridge.ts`, `world/buildings.ts`.) Camera
  gaze nudged a hair toward the horizon (lookHeight 2.4→2.55).
- **Cheaper post-processing stack (fill-rate win toward 60 fps).** With the zombie
  engines gone, the remaining cost on a strong Mac is GPU fill: the per-pixel post
  passes. Three cuts that barely touch the look: **SSAO2 is now OFF by default**
  (16-sample full-screen ambient occlusion was the single most expensive pass,
  ~5–15 ms, for a subtle crevice darkening this stylized world hardly needs —
  opt in with `?ssao` / `window.__wpSSAO=true`); **4× MSAA dropped to 1** (FXAA
  already does the edge AA — the MSAA resolve was redundant); **bloom kernel
  64→32**. (`render/pipeline.ts`.)
- **Zombie-engine leak fixed — exactly one Babylon engine, ever.** THE cause of
  the progressive FPS collapse (and the dying on-device LLM socket). The host
  injects a FRESH `<script>` on every pack reopen, so the pack module
  re-evaluates in a NEW scope each time — and the single-instance guard was a
  module-scope `let current`, which a re-injected copy can't see. So each reopen
  orphaned the previous instance's engine + render loop + LLM connections; they
  kept rendering invisibly, stacking 2×/3×/4× the GPU work and exhausting LLM
  sockets. The live instance is now tracked on a `globalThis` slot shared across
  every injected copy (+ the standalone dev mount routed through it so vite HMR
  can't stack engines either), and the engine now disposes its `SceneInstrumentation`.
  Verify in console: `window.__wpEngines()` must read `1`. (`main.ts`, `world/engine.ts`.)
- **Neighbourhood streaming — stop building/keeping the whole metropolis.** THE
  big one. The streamer warmed every chunk of the 1520² city in the background and
  never disposed any, so `scene.meshes` climbed to ~18k — and Babylon re-evaluates
  EVERY resident mesh each frame to find the ~700 visible ones, which the phase
  profiler showed was the single biggest frame cost (and it grew the longer you
  played). Now each pass enqueues only chunks within `buildRadius` of the player
  and DISPOSES built chunks past `disposeRadius` (they were already disabled +
  non-colliding, so freeing them is invisible to gameplay); the time-sliced
  builder rebuilds hitch-free on return, with build<dispose hysteresis to avoid
  thrash. Resident meshes now hold ~3k regardless of how far you roam (was
  climbing past 10k). (`city/stream.ts`.)
- **Backbuffer capped to CSS resolution (no 2× retina supersampling).** Fullscreen
  was rendering ~7.5 MP at 2× retina for a draw/CPU-bound scene — pure fill waste.
  `hardwareScalingLevel` now floors at 1.0 (CSS px), ~4× fewer pixels on retina,
  still crisp with AA. (`world/engine.ts`.)
- **Sparser scene + adaptive-res OFF (draw/vertex economy).** Measured at
  `600×484` the frame was still ~62 ms, proving the cost is draw-calls/vertices,
  not pixels — so adaptive resolution (which only blurred the image) is now OFF by
  default (opt in with `window.__wpAdaptiveRes = true`). Cuts that actually help:
  visibility radius 165→125 (fewer building chunks live per frame — the dominant
  draw source; override `window.__wpVisRadius`), NPCs −25% (crowd 28→21,
  strollers 8→6), and deterministic prop thinning (trees −50%, flower pots −30%,
  trestle stalls −50%) — props are thin-instanced so this is a vertex + clutter
  cut (the per-vertex curvature shader pays for every instance). Note for the
  record: the draw-call FLOOR is the building/roof masses; a true 60 fps needs
  those merged/instanced (pending the camera-occlusion decouple).
  (`city/generateCity.ts`, `city/population.ts`, `world/engine.ts`, `game.ts`.)
- **City cast-shadows are now OPT-IN (the big draw-call cut).** Measured with a
  real per-frame draw-call counter (Babylon 9 hid `engine.drawCalls`; the perf
  HUD now wires `SceneInstrumentation`): the scene issues ~1,400 draws/frame and
  the shadow-map pass alone is **~490 of them (1418→928 measured)** — the dominant
  cost on a draw-call-bound WebView. The premium golden-hour BUILDING shadows are
  disabled by default and gated behind `?shadows` / `window.__wpCityShadows=true`
  for machines that can afford them; characters/props keep their cheap contact
  shadows. (Re-enables by default once the static city is merged/instanced — which
  needs the camera boom decoupled from render meshes first.) (`game.ts`.)
- **Adaptive render resolution holds the frame budget.** The dominant GPU cost
  was fill rate — at 2× retina the bloom + shadow + fog + curvature stack shades
  4× the pixels of 1×, dragging a strong retina Mac toward ~12 fps. The engine
  now trades RESOLUTION (not world content) to stay smooth: it tracks a ~10-frame
  EMA of frame time and raises `hardwareScalingLevel` under sustained load (down
  to ¼-pixel floor), relaxing back toward native-sharp when there's headroom.
  Self-tuning — capable machines stay crisp, struggling ones soften just enough.
  No geometry, NPCs, shadows, or effects are removed. Kill switch
  `window.__wpAdaptiveRes = false`; the perf HUD (`p`) shows live `renderScale`
  + pixel dims. (`world/engine.ts`.)
- **Fewer 3D bodies per frame** via the role-based look split below (ambient
  crowd is now cheap paper billboards instead of multi-mesh 3D figures).

### Changed
- **Steeper HD-2D camera pitch → smaller render radius.** The flat, low camera
  looked straight out to the horizon, forcing a big view radius (and putting the
  fog/pop edge in frame). The eye is raised + the gaze dropped off the horizon
  (rig height 5.5→6.8, lookHeight 2.6→1.9, ~18°→~28° pitch), so the far distance
  falls out of frame and the view radius drops 125→105 with no felt loss of
  forward sight — measured ~653→456 draws/frame. Both are live-tunable on-device:
  `window.__wpCam = { height, lookHeight, distance, fov }` and
  `window.__wpVisRadius`. (`world/engine.ts`, `game.ts`.)
- **Every NPC shows a short made-up name, never its seed id.** Ambient NPCs were
  rendering their raw role id (e.g. `Crowd:Baker:Ambient:4173071802…`) in the
  dialogue header + challenge pretext. `npcDisplayName()` now prefers the
  persona's generated name and otherwise hashes the id to a stable short name from
  a neutral pool — so an NPC always has a clean, consistent name. (`npc/npcRuntime.ts`,
  `game.ts`.)
- **Character look is now chosen by ROLE, not at random.** The plaza previously
  ran two unreconciled crowd systems — `world/crowd.ts` (3D) and
  `city/population.ts` (paper) — so 3D and paper people mixed with no intent. Now
  3D (`bubble3d`) is RESERVED for characters that matter: the player, quest /
  special NPCs, and real remote players. All ambient townsfolk + strollers render
  as paper HD-2D people (`cutout`). `createCharacterFigure` takes an explicit
  per-role `look`; the global `?look=` / `__wpCharacterLook` QA override still
  wins. Bonus: far fewer 3D bodies per frame. (`character/figure.ts`,
  `movement/controller.ts`, `world/crowd.ts`, `net/remoteAvatar.ts`.)

### Fixed
- **NPCs/props can no longer embed inside the fountain (or any circular collider).**
  A special stationed at the fountain anchor (its (0,0) centre) could render INSIDE
  the basin because the obstacle field's centre-push had no defined direction at a
  circle's EXACT centre (`(p − centre)` is the zero vector → `0/0` NaN → the push
  silently did nothing). The push now resolves the dead-centre singularity to a
  deterministic default (`pushDir`/`pushOutCircle` in `world/collision.ts`), and the
  crowd settles EVERY spawned/stationed body out of all solid footprints — the
  streamed field AND the static fountain `avoidCircles` (which aren't in the field
  yet at world-build time) — via a unified `settleFree`, re-checked after the
  bridge-foot walk-back and on every hover step. (`world/collision.ts`,
  `world/crowd.ts`; tests in `world/collision.test.ts`, `world/stationing.test.ts`.)
- **The bridge reads as a solid causeway, not an open trestle.** Players approached
  the side, saw open space under the deck, and tried to walk under — but the deck
  lifts you ON top (true under-walking needs Havok, out of scope). Solid stone
  spandrel SIDE WALLS now fill both long sides from the waterline up to the deck
  underside (with a stringcourse ledge under the lip), closing the visual "walk
  under me" invitation so the crossing reads as an arched stone bridge you go OVER.
  Merged into the existing per-material bridge meshes; walk-surface math unchanged.
  (`world/bridge.ts`.)
- **Engaged 3D NPCs now turn to face you.** A special NPC is 3D (no billboard),
  so when held in conversation / on quest-seeker arrival it used to keep its last
  wander heading and stare off awkwardly. It now eases to face the player while
  engaged. (`world/crowd.ts`.)
- **3D characters no longer moonwalk.** The player / special NPCs / real players
  now TURN to face the direction they're moving instead of holding a fixed facing
  — so strafing or back-pedalling reads as the figure pivoting and walking that
  way, not sliding sideways or facing the camera while walking away. The figure
  eases its heading toward its velocity each frame (the model's forward is +Z, so
  heading = `atan2(vx,vz)`), seeded to face the world ahead at rest, holding the
  last facing when idle; the camera still follows the LOOK heading, independent of
  body facing. (Paper crowd billboards face the camera by design and never
  moonwalk.) (`render/cutout.ts` `setHeading`, `character/figure3d.ts`,
  `movement/controller.ts`, `world/crowd.ts`.)

### Added
- **The streamed city casts the sun's shadows.** Buildings no longer "float" on
  contact shadows alone — the streamed chunk buildings (+ the hero clock tower,
  fountain, and bridge) now cast the golden-hour sun's directional shadows, and
  the chunk ground receives them. Casters are opted in/out per chunk as the
  player moves, bounded to a tight player-local shadow radius (smaller than the
  render radius) so the per-frame shadow-map draw count stays phone-friendly:
  only each building's big silhouette (body + roof) casts, not the swarm of
  small details (parapets, steps, awnings, signs, bridge balusters/voussoirs).
  Gated behind a kill switch (`?noshadows` URL param or
  `window.__wpCityShadows = false`), defaulting ON. (`src/city/{mountCity,stream,
  chunkMesh}.ts` + game.ts wiring.)
- **Cinematic rendering (flat prototype → premium golden-hour look).** A new
  rendering pipeline (`src/render/pipeline.ts`) layers real lighting + post over
  the scene: a warm directional KEY sun casting soft, contact-hardening PCF
  shadows; a cool hemispheric FILL so shadows stay luminous; a tiny procedural
  IBL environment cube for believable PBR ambient + reflections; and a
  `DefaultRenderingPipeline` with ACES tone-mapping, gentle exposure/contrast, a
  warm vignette, tasteful bloom, and FXAA/MSAA. Data-driven `TimeOfDay` moods
  (golden / dawn / day / dusk) — default is golden hour. Optional SSAO2 gated
  behind a perf tier. The engine exposes `registerShadowCaster(mesh)` /
  `getShadowGenerator()` / `setTimeOfDay()` so the city + characters opt meshes
  into shadows (the lead wires per-streamed-chunk registration in game.ts).
  Also removed the atmosphere back-rim light, which was silently breaking the
  sun's shadows by forcing a shadow-less material recompile.
- **A soul of sound (WebAudio, no assets).** The silent plaza now has a tasteful,
  subtle ambient bed — a warm low pad that breathes, a faint distant-town murmur,
  and sparse soft birdsong — plus locomotion-driven footstep taps (cadence scales
  with walk speed; silent at rest) and gentle juice SFX (tap/engage/correct/
  reward/error). Default ON but quiet (master volume 0.55), opt-out via mute, both
  persisted to `localStorage` (`wp:audio:*`); honours prefers-reduced-motion
  (calmer bed, no birdsong). Everything is synthesized live — no licensed/heavy
  files. New self-contained module `src/audio/{soundscape,sfx,cadence}.ts`;
  `createSoundscape()` exposes `resume/startAmbient/stopAmbient/onLocomotion/
  playSfx/setMuted/setVolume/dispose`. Also a `speakNpcGreeting(host, targetLang,
  text)` helper so the NPC SPEAKS the target language via host TTS at the moment
  of engage. (Wiring into game.ts/npcRuntime owned by the lead.)

### Changed
- **Characters you like looking at (3D figure craft).** The 3D "bubble person"
  is now genuinely charming, not just 3D. (1) **The floating white collar/seam is
  gone** — the old look welded a billboarded face *card* (a cropped slice of the
  paper-doll texture, cream rim and all) onto a skin sphere, showing a hard white
  band across every neck. The head is now ONE cohesive skin form: a features-only
  face (eyes/brows/nose/mouth/cheeks, transparent everywhere else) sits on a small
  plane tucked against the head front, so the gaps reveal the head's own skin and
  the face reads as part of the head from front, 3/4, grazing, and back angles;
  a hair cap covers the crown + back so no sphere seam shows. (2) **Charming
  proportions** — slightly oversized head, soft rounded torso, short planted legs
  with feet, stubby arms with rounded hands/shoulders (a friendly chibi
  silhouette), and a short neck so the head never floats. (3) **Expressive
  animation** — arms + legs counter-swing on a real gait, a forward lean into the
  walk, an idle weight-shift sway and occasional head look-around, a talk head-bob
  + open mouth, blink, and the wave gesture — all driven from a new richer
  `FigurePose` the animator feeds via an additive `setPose()` hook (the flat
  cutout ignores it, so the fallback is unchanged). (4) **Warmer face paint** —
  bright eyes with iris colour + catchlights, soft friendly brows (no worried
  peak), rosy cheeks, a sweet smile. Still cheap: shared geometry + per-instance
  colour, one small face texture each — verified 60fps at 38 agents.
- **The world is a LIVING, crafted place — not an empty tile plain.** Density,
  variety, and a landmark replace the "vast sea of cobble with a few boxes" read:
  (1) **Building hue variety** — the town was monotone cream (both stucco families
  were near-identical `#e7d4ad`/`#dcc59a`); buildings now draw from a curated
  colonial palette (washed terracotta, ochre, sage, dusty rose, sea-blue, mustard,
  mauve, adobe…) weighted toward warm earths, so a street reads as a real painted
  town. (2) **Density** — block gaps pulled down + dressing pushed up across every
  zone, a tighter building gutter packs fuller terraces, and the plaza claim/empty
  void shrank. (3) **Furnished plaza** — the civic square (a void you stood in) now
  has a tiered terrace ringing the fountain: benches+lamps facing the water, a ring
  of potted trees+planters, an outer café/market arc of tables+stalls, and a market
  knot. (4) **HERO clock tower** — a tall tapered stone tower with a belfry, four
  clock faces, a pyramidal terracotta cap + gilt finial rises above the rooflines
  as the memorable skyline landmark on every plaza/market sightline. (5) **Paving
  variety** — each district gets a base surface that reads as a different place
  (formal flagstone civic core, cobbled downtown, warm-earth residential, worn
  stone market/harbor) instead of one flat dirt plain. All thin-instanced /
  chunk-streamed / shared-material (phone budget unchanged). Files: `world/
  buildings.ts` (stucco family), `city/generateCity.ts` (density + plaza dressing +
  paving), `world/specialPlaces.ts` (+ `game.ts`, the clock tower). Verified in the
  real streaming city via `qa/living-world.mjs` (wide plaza, market walk-through,
  landmark sightline, street, tower, aerial — unfriendly angles).
- **Characters are now REAL 3D "bubble people," not flat paper billboards.** The
  marquee visual upgrade: the player + crowd NPCs + remote players render as
  genuine 3D rounded meshes (head sphere + bubble torso + stubby arms/legs/feet),
  lit by the scene's sun/hemi so they hold their volume from EVERY camera angle —
  including grazing/near-horizon shots where the old flat cutout collapsed to a
  line. Identity is preserved: skin/hair/top/bottom colours from the AvatarSpec
  map onto the mesh; the existing animator still drives idle bob, walk cycle,
  blink, and talk-mouth via a billboarded face card welded to the 3D head (so all
  expression/identity animation is unchanged). The new look is the DEFAULT behind
  the designed `createGroundedCutout` seam; the legacy flat cutout stays selectable
  as a fallback (`window.__wpCharacterLook = "cutout"` or `?look=cutout`). Cheap by
  construction — ONE shared sphere + ONE shared capsule + ONE material for the
  whole population, per-character colour via a per-instance "color" buffer;
  verified 60fps with 38 agents. New `src/character/figure3d.ts` +
  `src/character/figure.ts` (look seam); `src/render/cutout.ts` exports the shared
  contact shadow; controller/crowd/remoteAvatar consume the seam with no call-site
  logic change. Proven in the real game via `qa/figure3d.mjs` (multi-angle
  screenshots, A/B against the flat cutout).
- **Quest-completion interlude is now a SLOW, staged, rewarding cinema — not a
  rushed flash.** The completion beat was firing everything at once and moving on.
  It now plays a hand-paced timeline: (1) an anticipation beat — the world dims
  under a soft scrim and hushes; (2) a slow staged reveal — a "★ Victory" eyebrow
  blooms, then the big title scales up with a glow sweep, then the subtitle
  settles; (3) a bespoke reward tally that COUNTS UP line-by-line (XP, then the
  physical-currency smorgasbord, then item grants), each landing in sequence with
  a pop + sparkle (replaces the all-at-once `showRewardReveal`); (4) a dignified
  pause; (5) the next-quest choice cards animate in. A "Skip" affordance
  fast-forwards repeat players straight to the picker, but the DEFAULT is the full
  cinema. `prefers-reduced-motion` collapses to an instant-but-complete, dignified
  layout (no flashing, no count-up). New strings `interlude.eyebrow` /
  `interlude.skip` localized across all 46 locales (per-key English fallback).
  `src/vignettes/questInterlude.ts`, `src/i18n/{strings,surfaceStrings}.ts`.
  Proven in the real game via `qa/interlude-cinema.mjs` (staged screenshots).

### Fixed
- **A speak challenge never traps the player when the mic dies (#65).** When STT
  reported AVAILABLE but `recordAndScore` threw mid-record, `sttTools.recordUI`
  showed a "Mic error" status but left the erroring mic in place — a dead-end.
  Now a mic/record error falls back to the SAME self-rate buttons the
  STT-unavailable path shows (extracted into a shared `mountSelfRate`), so the
  challenge stays winnable. `src/challenges/tools/sttTools.ts`.
- **A challenge with 0 buildable rounds aborts instead of scoring a fail (#67).**
  Missing/empty content made `choiceTools.runSeries` (and `runSeriesWithReplay`,
  `oddOneOut`, and the STT tools' no-speakable-entry path) `complete(0)` → instant
  "Try again" — a silent dead-end that could trap a quest gate. They now
  `overlay.cancel()` (outcome "aborted"), so missing content is never counted
  against the player and the NPC doesn't congratulate a non-attempt.
  `src/challenges/tools/choiceTools.ts`, `src/challenges/tools/sttTools.ts`.
- **THE CORE LOOP: you can now finish a beginner quest with your thumb, no mic
  required.** Root cause of "I walk to the star, talk to the guy, and there's no
  way to win": every beginner quest's gating challenge was `repeat-after` — a
  SPEAK/STT challenge. In QA it always "passed" because the standalone mock host
  reports `sttAvailable: true` with a generous 0.86 auto-score; on a real device
  with no working target-language STT (e.g. Arabic), the same gate is unwinnable —
  you get a mic you can't satisfy, so the quest never advances. The harnesses that
  claimed it was fixed used a bypass hook (`__wpQuest.winCurrent`) or stopped at the
  "Begin" chip, so none of them ever actually played a challenge to a win on the
  real path. Fix: the gating challenge for the four beginner quests (cafe / market /
  directions / guadalajara-docks) is now `translate-fast` — a tappable, mic-free,
  always-winnable challenge. Speak challenges remain available as optional NPC
  flavor; they return as gates once native on-device STT lands (#64). Proven by a
  new `qa/play-to-win.mjs` (27/27) that drives the REAL UI — Talk → Begin chip →
  challenge → tap the correct tiles → Claim reward → step advances → quest COMPLETES
  — with `sttAvailable` forced true and NO bypass hook.
- **Challenges no longer silently dead-end when the host can't supply a corpus.** A
  challenge with zero rounds instant-"fails" (you can never beat the gate). The
  standalone `?stack=` dev stub provided only `getStackConfig`, so
  `createChallengeHost` threw on `getRandomEntries` → 0 rounds → dead gate (and the
  bug hid because no harness had played a challenge in that mode). `game.ts` now
  requires the host's corpus method (`getRandomEntry`) before trusting it and falls
  back to the built-in EN↔ES mock corpus otherwise (noisily logged), so challenges
  always run — in the standalone dev stub and as a resilience guard on device.

### Added
- **Quests are conversation-driven — you finish steps by TALKING to people, not
  tripping a silent wire (#55).** A traversal step used to auto-complete the instant
  you walked onto the anchor (a sound + advance), which felt hollow ("it moved on
  without me talking to the NPC"). Now the objective NPC is woven into the start
  (they hand you the offer), the step (you talk + do the challenge), and the close.
  Built on a new `forcedOffer.onConfirm` in `npcRuntime` (the Begin chip becomes a
  CONFIRM that fires a callback instead of launching a challenge); talk steps still
  launch their challenge as before. Proven end-to-end in the real game
  (`qa/quest-loop.mjs`).
- **"Cross the bridge" now means ACTUALLY crossing — completion is on the FAR bank,
  not the keeper's near foot (#40/#55).** Completing a crossing the moment you
  reached the keeper fired "too early" (you never crossed). The bridge keeper at
  `bridge_n` (near foot — where the beacon + focus live) is now the MISSION-GIVER:
  Talk → an "On my way" chip sends you off, but does NOT finish the step. The
  crossing completes only when you reach the deck's FAR end — you walk UP the ramp,
  OVER the water, DOWN the far side. Implemented as an optional per-step
  `completionPoint` on `traversalTrigger` (the bridge's far end, read straight off
  `layout.water.deck`, never hardcoded) distinct from the step's anchor; a plain
  reach-the-spot traverse/find still completes AT its anchor. Proven in the real
  game (`qa/quest-loop.mjs`, 13/13: at the near foot the crossing is NOT done →
  walking to the far end completes it) via new `__wpQuest.{completionPoint,crossBridge}`
  hooks driving the REAL proximity trigger.
- **Each language pair has its OWN quest journey (#42).** Switching target (e.g.
  EN→ES) no longer leaves you mid-way through the other pair's quest: the active
  quest (`wp:activeQuest:v1:<native:target>`) AND the quest progress (the
  `wp:quest:v1` store, now keyed `:<native:target>` via `createQuestEngine`'s new
  `trackId`) are both scoped to the Track. The WALLET + INVENTORY are too — the
  process-wide `inventory()` is bound per build to `createInventory({ namespace:
  trackId })`, so coins/items earned in one pair don't bleed into another. A fresh
  pair starts on the dead-simple café quest with an empty wallet; an existing pair
  resumes exactly where it was. No-trackId/namespace callers (tests / single-pair
  back-compat) keep the legacy global keys. Verified in the real game (boot
  `?stack=en,es` with a seeded quest, then `?stack=en,fr` → the French pair is
  fresh, not inherited) + unit-tested for cross-pair quest + wallet isolation.
- **A "Try a different journey" escape hatch — never trapped on a quest (#41).**
  The Quest section now lists every quest (the active one marked "Current") with a
  calm, dignified picker ("Every quest is yours to pick — switch any time, no
  pressure" — NOT a Duolingo dark pattern). Tapping a quest re-points the world to
  it in place (engine + beacon + arrow + markers) via `setActiveQuest`, so a player
  stuck on (or just done with) one quest can always pick another — e.g. drop the
  across-city bridge quest and land on the dead-simple café quest. The default
  first quest remains `es-cafe-travel`. `questSection` gains `questChoices` +
  `onSwitchQuest`; verified end-to-end in the real game (`qa/switch-quest.mjs`:
  stuck on es-guadalajara → open Quest → pick → now on es-cafe).
- **A crafted, living edge to the world.** The river is no longer an empty blue
  band that runs off into fog: low-poly painted fishing BOATS (cabined smacks +
  masted sloops) are moored along both quays, clearing the bridge channel, with a
  gentle moored bob; a layered DISTANT-CITY SILHOUETTE rings the horizon so the
  edge reads "the world continues into a great city" rather than bare sky; and the
  land GATES through the perimeter rampart are dressed as handsome thresholds —
  heraldic banners draped down each gate tower with a flag aloft, and warm glowing
  braziers flanking the road. All additive, thin-instanced, and frozen — a few
  draw calls for the whole edge, with reduced-motion honoured.
- **A real waterfront promenade — premium riverwalk dressing.** The +Z water
  edge is now lined with a hand-crafted stone BALUSTRADE (turned vase balusters
  under a capping rail, with heavier piers at intervals), classic harbour LAMP
  POSTS (a glowing glass lantern crowning each iron column), and mooring BOLLARDS
  along the quay — and the water itself reads as living water: a depth gradient
  (deep teal far → luminous near the bank), gentle ripple striations that drift
  with the tide, and a soft foam lip lapping the shoreline (replacing the old
  flat blue rectangle). It opens cleanly for the bridge deck and honours
  reduced-motion (still water). When the river is a crossing BAND, BOTH quays get
  the symmetric stone balustrade and the water laps both shores. One merged mesh
  per part, thin-instanced and frozen, so the whole waterfront is a handful of
  draw calls.
- **The hero places feel composed, not bare.** The civic PLAZA is now framed by a
  formal ring of stone flower-beds brimming with blooms and ornamental trees
  encircling the fountain, and the MARKET square is strung with festive bunting —
  deliberate, hand-placed detail at the landmarks rather than the generic
  per-block scatter, all thin-instanced and frozen.
- **Localization stays current automatically (`check-translations`).** A
  fail-loud, CI-friendly gate (`npm run check-translations`) scans for (a) any
  catalog key missing in any of the ~46 shipped languages and (b) any user-facing
  string in the chrome surfaces that isn't routed through the `t()` translation
  seam — so a newly-added string surfaces as "needs translation" instead of
  silently shipping English to 50 languages. `check-translations:fix` auto-fills
  missing keys via the generator. The coverage half is mirrored in the test suite
  so `npm test` gates it too. (Internal tooling; see `docs/LOCALIZATION.md` §8.)
- **Total immersion toggle — turn the whole game into your target language.** A
  dignified, opt-in switch (top of the menu's Quest section) flips the entire
  interface from your native language into the language you're learning: every
  menu, hint, quest objective, the status capsule — all in the target — and the
  NPCs stop adding native glosses while challenges become target-only. Turn it ON
  for a language you're strong in, leave it OFF for a hard one — the setting is
  remembered per language pair. A single-language stack is always immersed (the
  toggle hides itself). When the target reads right-to-left (e.g. learning Arabic),
  immersion flips the whole UI to RTL too. Built on one pure resolver
  (`src/immersion/immersion.ts`) every surface consults — `uiLocale()` picks
  native-or-target, so nothing can leak. Toggling applies **in place** — the
  language (and direction) flips without reloading the world or moving your
  character; you stay exactly where you are. The toggle control itself always
  stays in your **native** language, so you can always find your way back to turn
  immersion off. See `docs/IMMERSION_TOGGLE.md`.
- **The whole interface now speaks your language — in ~50 languages, right-to-left
  too (R2-4 / R2-5).** Every UI chrome string (the welcome, the language chooser,
  onboarding, the menu, the status capsule, quest hints/progress, the quest-
  complete interlude, the presence pip) renders in the language you KNOW — your
  Corpán stack's primary language — instead of always-English. The first thing you
  see ("Good morning, …") greets a Spanish speaker in Spanish. When your language
  reads right-to-left (Arabic, Hebrew, Farsi, Urdu) the entire chrome mirrors to
  RTL. Built on the proven repo i18n pattern: one English source-of-truth catalog
  (`src/i18n/strings.ts`) generated into the full Corpán language set
  (`tools/gen_i18n.py`), a `t(key, native)` resolver that collapses regional
  variants and never shows a blank, and `applyDir()` for RTL. See
  `docs/I18N_RTL.md`.
- **Quests are now impossible to miss: a glowing objective NPC beacon.** Every
  active quest step's objective NPC is marked by an unmissable, self-lit beacon —
  a tall light shaft, a bobbing "this one" chevron over the head, and a ground
  halo ring at the feet (`src/wayfinding/objectiveBeacon.ts`) — that hovers over
  the NPC's live position so you can see who to talk to from across the plaza. The
  beacon + the on-road arrow + the map star now all resolve through one shared
  live-objective locator (`src/quest/objectiveLocator.ts`), so they always point
  at the same person. The three beginner quests (café / market / directions) get
  named helper NPCs at their step anchors (`content/npc/special.json`) instead of
  an anonymous "a local". This fixes the long-standing "I stand on the star and
  nothing happens — where's the NPC?" — the objective NPC is now visible, glowing,
  and talkable, with the deterministic Begin → win → advance loop already in place.
- **World detail pass: plaza fountain, ambient life, harbor water & atmosphere
  (C5/C6/C7).** The spawn plaza now has a real **HD-2D stone fountain**
  centerpiece (`src/world/fountain.ts`) at the `fountain` anchor — an octagonal
  plinth, basin with a still water disc, a tiered pedestal/bowls/finial, and a
  faint running water jet, with a gentle water shimmer. Its matching **circle
  collider is restored** in `src/city/collision.ts` (now backed by real geometry,
  streaming in/out with the fountain's chunk). The city now feels populated near
  you: a new **proximity-streamed ambient-life layer** (`src/city/population.ts`)
  adds a small recycled pool of background strollers that **wake near the player
  and sleep when far** (density follows you, count never grows), plus a pooled set
  of **stall-keepers** that wake at the markets nearest you — all lightweight
  half-res billboards that are never talk targets, so the crowd/Talk layer is
  untouched. A premium atmosphere touch adds a breathing **harbor water sheen**
  out at the quay (`src/world/harborWater.ts`, a flat sheet that never occludes
  the horizon) on top of the existing warm key/rim light + haze grading. All
  motion honours `prefers-reduced-motion` (`src/world/reducedMotion.ts`). Bounded
  + additive: no change to the streaming spine; verified no per-frame regression
  (steady-state frame time unchanged) and only +2 MB scene-texture memory
  (123 → 125 MB).
- **Deterministic, hand-held quest loop + juicy completion interlude (A2).**
  The quest loop no longer depends on the model: every objective NPC now offers
  its step's challenge via an always-present **"Begin" affordance** (a new
  `forcedOffer` path in `npcRuntime`, reusing the dedup'd `launchChallenge`
  plumbing) — no more "talked to the guy, nothing happened." The quest engine
  learns when a **challenge was beaten** (`markStepBeaten` + a persisted
  `challengeBeaten` set + a new `"needs-challenge"` step state); challenge-gated
  steps now require the win to advance, while inventory rules stay authoritative
  where present (the es-guadalajara clue→deliver chain is unchanged). Beginner
  quests are **one challenge each**, re-authored simple, with a data-driven quest
  graph (`nextQuestIds` on the schema + a new `questCatalog`). On completing a
  quest's last step, a fullscreen **completion interlude**
  (`src/vignettes/questInterlude.ts`) celebrates the reward (smorgasbord reveal +
  fanfare) then shows a **2–3-way next-quest picker** (each card: title · where to
  go · what to do) and resolves the chosen quest id; a dignified "Stay in the
  plaza" opt-out (no dark pattern). A clear future-asset hook (`animationMount`)
  is left for a dedicated completion video. Reduced-motion-safe, safe-area-aware,
  ≥44px targets, localized, mounted in `.wp-overlay`.
- **FAB / floating-chrome premium polish + map wayfinding (FAB_POLISH P0+P1).**
  The corner **minimap is now governed by `chromeVisibility`** (a new `"map"`
  role): it recedes WITH the rest of the chrome during dialogue/challenge/menu
  instead of staying fully lit — the biggest "chrome feels incoherent" defect is
  gone. It also DIMS (not hidden) on `focused`, alongside a new band-dim so the
  Talk CTA is the clear hero; the pack stays reachable. The minimap now swallows
  pointerdown/up (a tap can't also fling the look camera), its z-index is split
  off the capsule-detail card (no undefined paint order), and its size flows from
  ONE shared `--wp-minimap-h` token (108→132→152→168px phone→desktop). A unified
  design system — shared **material / radii / elevation / blur / type / accent**
  tokens in `:root` — now drives every floating surface (pack button, place tag,
  minimap, menu panel, badge case, focus chip). **Badges is a real 4th menu tab**
  (Map · Inventory · Quest · Badges) with a **sticky filter sub-header**,
  scroll-edge fades, a tab cross-fade, and a **premium empty-state card**; the
  badge grid is re-skinned to the warm-Antigua ink (retiring the blue-grey
  palette) with debossed medal wells. Premium surfaces are **de-emoji'd** (place
  tag pin → inline SVG; the menu satchel/expand glyphs are already SVG). The
  on-road **wayfinding arrow** (`src/wayfinding/roadArrow.ts`) is wired into the
  frame loop (subtle muted ground arrow pointing at the active objective). All
  reduced-motion-gated, safe-area-aware, ≥44px targets, mounted in `.wp-overlay`.
- **Stack/language reactivity + premium entry (front door).** World Plaza now
  derives its `learnerPair` (target/native) from the LIVE Corpán language stack
  (`getStackConfig` / `onStackConfigChange`) instead of the hardcoded
  `quest.learnerPair`. Fixes the bug where switching the stack to "learn EN from
  ES" still played the world EN→ES. A new `src/entry/*` slice adds: a stack
  adapter honoring `SINGLE_LANGUAGE_RULE` (`languages[0]` = native, `[1..]` =
  targets; a 1-language stack = immersion, target === native, no gloss); a
  premium fullscreen **language-chooser** interlude for multi-target stacks (pick
  which language to live in this visit); a warm **welcome** interlude (who you
  are, where you are, the day's goal/practice); and live **reactivity** — exit,
  flip the stack in Corpán, return, and the world rebinds to the new stack.
  Scoped `<style data-wp-entry>` (no shared `styles.css` edits); reuses the
  onboarding/vignette fullscreen-DOM lifecycle. See `src/entry/INTEGRATION.md`
  for the `game.ts` wiring.

### Fixed
- **Objective NPCs RE-STATION on a quest change, so the beacon is never empty (#58).**
  The stationed quest NPCs were placed ONCE at buildWorld for the initial quest;
  switching/advancing the quest re-pointed the beacon to a new anchor but no NPC
  moved there, so the fountain/market/bridge beacon stood over an empty spot and no
  quest could be finished (and #55's "talk to the keeper to cross" had no keeper to
  talk to). `crowd` now keeps a fixed POOL of special agents (all their handles in
  `focusables` from the start, so the focus layer's one-time snapshot already knows
  them) and exposes `restationSpecials(newSpecials)`: it re-binds the pool to a new
  anchor/persona set IN PLACE — each objective NPC walks to (stands precisely at) its
  new anchor under the beacon, repainted to the new persona/name, with the pool's
  handles mutated so dialogue/map/focus re-route automatically; dropped anchors are
  parked off-map (no ghost NPCs). Idempotent; `game.ts` calls it on every active-quest
  change (recomputing the new quest's specials). An unknown anchor is logged + parked,
  never silent. Verified in the real app (`qa/restation.mjs`, `npm run qa:restation`):
  re-stationing to `[market, bridge_n]` renamed moves both NPCs to their anchors with
  the new names and unstaffs plaza/fountain/harbor.
- **The NPC no longer says "Nicely done!" when you DISMISS a minigame (#62, the #9
  gap).** The earlier abort-guard stopped the reward reveal + quest advance on a
  bail, but the NPC's post-challenge reaction in the chat was a SEPARATE path that
  congratulated regardless of outcome. Now the challenge overlay stamps its scrim
  with `data-wp-ch-outcome` (completed | aborted) on close, and the chat's
  lifecycle observer (`npcRuntime.onChallengeEnded`) branches on it: a real finish
  gets the congratulation, a dismiss gets a calm neutral line ("No worries — maybe
  later."), never a celebration. Guarded by `src/npc/challengeOutcome.test.ts`
  (dismiss → no "Nicely done"; complete → congrats; no-stamp → completed back-compat).
- **Every quest objective always has a named, talkable NPC under the beacon — even
  after switching quests (#58).** A quest you switched to (via the interlude /
  switch-quest picker) could point its beacon at an EMPTY market stall: the crowd's
  special NPCs were stationed ONCE for the world's INITIAL active quest, so a later
  quest's objective NPC (e.g. the market vendor) was never spawned, leaving the
  quest uncompletable. Now an objective NPC is stationed at EVERY step anchor across
  the WHOLE quest catalog at build time (`objectiveAnchorIds()` — only ~5 anchors:
  plaza/market/fountain/harbor/bridge_n), so whichever quest becomes active, its
  objective always has a person there; the dialogue header resolves the active
  quest's authored name (e.g. "the market vendor") at engage time. AND the active
  objective NPC now WINS focus over wandering townsfolk near the same spot
  (`npcFocus` gains a `getPriorityAnchor` → the step's anchor), so the Talk button
  + dialogue + Begin always target the quest's NPC, never an ambient passer-by who
  drifted closer (the real gap: at the market a wanderer out-competed the vendor
  for focus). Proven END-TO-END in the real game via the REAL stationing + focus +
  Talk + dialogue + Begin path (NOT the dev teleport/advance hooks) for café,
  market, AND directions + a quest switch (`qa/objective-realflow.mjs`, 15/15 +
  screenshots `/tmp/wp-objnpc-{cafe,market,directions}.png`): walk to the beacon →
  the named objective NPC is focusable → Talk → its dialogue opens → Begin chip.
- **The market crowd is a varied, dispersed populace — not a wall of identical
  people mobbing you (#60).** The owner stood at a market and was "surrounded by
  758,323 herbalists": the ambient figures read as clones and the stall-keepers
  bunched on the player. Two fixes in `src/city/population.ts`: (1) VARIETY —
  `figureVariety` default 6→16, so the near-field crowd shows ~16 distinct
  townsperson LOOKS instead of a handful of repeated sprites (each figure's PERSONA
  — baker/scribe/sailor/merchant/… with its own name — was already varied; this
  makes the variety visible, not just in the engage text). (2) NO CROWDING — the
  player-keepout now covers STALL-KEEPERS too: a keeper never binds to a vendor
  anchor within `KEEPER_KEEPOUT` (5.5u) of the player (the stall you're standing on
  stays un-staffed until you step back), and a bound keeper stands on the side of
  its stall AWAY from you. Strollers already kept their distance (#24); now the
  whole ambient population — strollers AND keepers — disperses. Proven: a market
  warm-up (`qa/pop.mjs`) measures 0 figures inside the keeper keepout (min 9.4u,
  mean ~18u) and 6 distinct archetypes / 7 names across the visible figures, a
  canvas-free regression (`src/city/population.test.ts`: 16 distinct sprite specs,
  many archetypes/names, the keeper-bind predicate rejecting the on-player anchor),
  and a WebKit market screenshot showing a varied figure tending a stall at a
  comfortable distance — nobody in your lap.
- **The camera never sits inside opaque geometry near the MARKET again (#59,
  residual of #25).** The owner kept landing the follow-camera inside a market
  awning/stall — the view filled with opaque brown, the player gone. Root cause:
  the boom-collision + occlusion fade keyed off a hard-coded name WHITELIST
  (`wp-building-*`/`wp-r-*`) that never covered the market stalls, awnings, the
  bridge, or walls, so those surfaces neither pushed the camera out nor faded. Now
  a single deny-list predicate (`src/world/cameraOcclusion.ts`,
  `isCameraOccluder`) treats EVERY solid, visible, real-volume world mesh as an
  occluder — buildings, roofs, stalls/awnings, the bridge, walls, fountain,
  present and future — and only ground/water/character-billboards/sky/HUD-overlays
  are exempt. The boom casts player→desired-eye against all of them and pulls the
  eye out (with a generous `MIN_BOOM` standoff so the player stays FRAMED, not
  jammed onto the lens), and the fade dissolves ANYTHING the camera→player ray
  actually hits (detected by ray, never a tag). Thin-instanced airy props (the
  market stalls — one mesh = a whole chunk, with a giant phantom union AABB) are
  excluded from the BOOM (`isBoomBlocker`, so the camera doesn't collapse onto the
  player the instant it nears a stall row) but still FADE per-object, so a canopy
  between camera and player goes translucent and never hides you. Proven headlessly
  (`src/world/cameraOcclusion.test.ts`, 9 tests: a solid building, a thin-instanced
  stall cluster, and a camera-inside-the-roof case all fade; a clear shot stays
  solid; faded meshes recover) and visually in the FAILING scenario — a WebKit
  screenshot of the camera tucked into the market with the player clearly visible
  and the stalls dissolved to a faint ghost (`qa/cammarket.html`).
- **The objective beacon is a premium warm marker now — and the root-cause render
  bug is fixed (#22).** The beacon over the objective NPC had rendered as a gray
  slab → a transparent white pillar → a black box across rounds; the cause was a
  one-line texture bug — `new DynamicTexture(name, { w, h }, …)` instead of
  `{ width, height }`, so the canvas was undefined-sized and the painted art went
  nowhere (a garbage/opaque texture). With the correct keys the beacon renders as
  designed: a floating warm-accent MAP PIN with a gem eye, a downward chevron
  ("this one"), a soft glow halo, and a pulsing ground ring — clearly "your
  objective is THIS person." Isolated proof harness added (`qa/beacon.html` +
  `qa/beacon-mount.ts`, screenshot `qa/beacon-shot.mjs`).
- **Translation/matching games keep BOTH languages under immersion (#27).** A
  cross-language challenge (translate, tap-the-meaning, match-the-pairs) is
  inherently two-language — it shows one side in the target and the other in the
  native and asks you to connect them. Under immersion (e.g. Arabic-from-English)
  the native side was being dropped, collapsing both halves to the target — a
  tautology with no answer ("where is the Arabic I'm matching TO?"). Now the
  orchestrator keeps `ChallengeContext.nativeLanguage = learnerPair.native` for
  cross-language tools REGARDLESS of the immersion toggle (immersion still
  collapses chrome + the native gloss of monolingual drills). **Made airtight
  (#57):** cross-language is now a DECLARED `isCrossLanguage` property on each
  `ToolImpl` (not a hand-maintained whitelist), so a tool can't silently
  tautologize — this caught `countdown-recall` ("Which line meant 'Close the
  window'?" with the answer ALSO "Close the window"), which had slipped the old
  list; flagged tools = fast-translate, tap-translation, listen-choose-pic,
  memory-pairs, true-false, picture-match, countdown-recall (category-sort is NOT
  cross-language — it sorts target words by TOPIC). `isCrossLanguageTool(id)` reads
  the property; a test iterates EVERY tool asserting the registry matches the flag
  and that each cross-language tool's prompt ≠ answer language under immersion.
  Additionally, a single-language Track
  (native === target) can't host a cross-language game at all — those tools are now
  filtered out of the NPC's offer (`offerableTools({ singleLanguage })` +
  `resolveGameOffer(..., native)`), so a monolingual learner is never offered a
  tautological translate/match game.
- **Raw control JSON never leaks into the NPC dialog bubble (#38).** A small model
  sometimes emits a bare `{ "kind": "reward", "xp": 10 }` WITHOUT the
  `<<tool>…</tool>>` delimiters, and the splitter passed it straight through as
  spoken/displayed text. `splitToolBlock` now also detects a bare control-JSON
  object (a balanced `{…}` whose parsed `kind` is a control discriminant —
  `say`/`callTool`/`reward`/`questStep`/`end`), strips it from the prose, and
  routes it through the normal parse-or-drop intent path — so control JSON is never
  shown or spoken, whether or not the delimiters are present. Streaming holds the
  prose the moment such an object starts forming. A normal `{…}` aside in prose
  that ISN'T a control payload is left untouched (`src/npc/promptProgram.ts`).
- **NPC voices are session-only — no stale voice survives a restart (#21).** The
  sticky per-NPC voice map is now IN-MEMORY for the life of one app run, not
  localStorage-persisted. A voice is still stable WITHIN a session (an NPC keeps
  its voice while you play) but is freshly resolved on each app start, so a
  wrong/old pin can never carry over. Any legacy persisted pins
  (`wp:npc:voice:v1`/`v2`) are cleared on load. Deterministic-by-`npcId|target`
  assignment + the target-language guard are unchanged (`src/npc/npcVoice.ts`).
- **The world has a crafted edge now — a walled city on a river, not a fog
  dead-end (#32).** The map used to run off into nothing (the bridge ran off the
  edge into fog). The +Z waterfront is now a real RIVER BAND: a near quay, the
  open river, then a FAR-BANK district the bridge actually crosses TO (more city —
  "cross the bridge" arrives somewhere, never the map edge). The three land edges
  get a stone perimeter RAMPART with gates where the avenues pass through, and a
  sea wall caps the far bank. You meet a designed wall at the edge, and nothing
  spawns past it — the rampart + river are box obstacles in the same field every
  spawner and the player consult (`CityWater.farBankZ`/`farPromZ`, `CityBoundary`,
  per-chunk `CityWallRect`; `world/cityWall.ts` builds the matching rampart mesh,
  wired city-lifetime in `mountCity`). Proven headlessly
  (`src/city/waterPlacement.test.ts`) and in WebKit (`qa/cityground.mjs`: rampart
  698/698 blocked off-gate, gates 8/8 walkable, bridge reaches the far bank).
- **Nobody and nothing stands on the river anymore — the water is now solid for
  placement (#30), and the waterfront is a real promenade (#31).** NPCs, ambient
  strollers, stall-keepers and props used to spawn and wander in the open water
  (an NPC mid-river, a row of bollards floating on it) because the crowd/
  population already test the collision field before spawning, but **water was
  never in that field**. The river is now first-class layout data
  (`CityLayout.water` + per-chunk water rects) that becomes a box obstacle, so the
  exact predicate every spawner consults reports the river as solid: nobody lands
  on it and the player is walled at the shoreline. The single bridge corridor is
  carved out of the collider so it stays crossable. The waterfront itself reads as
  a walkable **riverwalk** — a stone quay between the buildings and the water, with
  harbor cargo and the docks/bridge anchors placed on land. Proven headlessly
  (`src/city/waterPlacement.test.ts`) and in WebKit (`qa/cityground.mjs`:
  open-water 1404/1404 blocked, bridge 17/17 open, riverwalk 94/94 walkable).
- **The across-city quest is now actually completable — every step has an obvious
  action the game can deliver (#26).** "Cross the river bridge" was a dead-end: a
  traversal step with no completable action, so the player walked to the bridge,
  talked to the keeper, and nothing happened (and the old ferry-token/city-gate-pass
  inventory chain left a fresh player stuck before that). Quest steps now declare a
  `kind` (`talk` | `traverse` | `find`): **talk** steps advance on a won challenge
  (as before); **traverse**/**find** steps complete by WALKING to the step's anchor
  — a per-frame proximity trigger (`src/quest/traversalTrigger.ts`) fires
  `markStepBeaten`+`advance` on arrival, with a "✓ {label}" toast. `es-guadalajara`
  is re-authored to a deterministic, always-completable route: step 1 = a talk
  challenge at the harbor, step 2 = walk across the bridge; its inventory gating is
  retired. The Status Capsule shows a "{label} →" cue for traverse/find steps.
  Proven end-to-end in the REAL game by a webkit walkthrough (`qa/quest-loop.mjs`,
  10/10) that drives the player through both steps to the completion interlude.
- **ALL challenge-framing text is now out of the dialog and lives by the launch
  button.** Every line that introduces or frames a challenge — the pre-challenge
  invite/segue ("let's see how fast you are"), the "play another" re-offer, and
  (already, on the challenge card) the instruction line ("Which is it?") — renders
  as a small quiet caption next to the Begin/Play button, never as an NPC dialog
  bubble, and is never spoken. The pre-challenge segue moved from
  `ui.endNpcTurn(segue)` + `speak(segue)` in the chat log to the Play-row caption
  (`dialogueUI.setPlayOffer(show, label, caption)` + `.wp-npc-play-caption`); the
  objective-NPC "Begin" path and the LLM offer path both flow through that one
  caption. The NPC's own conversational lines still stream into the log and are
  voiced as before. Guarded by a regression test
  (`src/npc/challengeText.test.ts`) asserting the segue is by the button, NOT in
  the log, and never passed to TTS, plus a screenshot check in `qa/npc.mjs`.
- **Bailing out of a challenge no longer says "Nicely done!"** Dismissing a
  challenge (the ✕ button, ESC, or a backdrop tap) is now treated as a NEUTRAL
  skip — no reward reveal, no win juice, and the quest step is NOT marked beaten
  or advanced. Only an actual completion celebrates. `runChallenge` now tags every
  result with `outcome: "completed" | "aborted"` (`src/challenges/registry.ts` +
  the `ChallengeResultPlus` contract), and the game's post-challenge handler early-
  returns on an abort.
- **Challenge instruction text is now a quiet caption, not a spoken NPC bubble.**
  The meta-instruction ("Which is it? Listen carefully.", "Unscramble the word",
  etc.) renders as a small, secondary, uppercase-tracked label at the top of the
  challenge card (`overlay.setInstruction()` + `.wp-ch-instruction`), reserved
  apart from the big bold prompt which now carries only the actual STIMULUS (the
  phrase to read/say, the word to build). Instructions were already never passed
  to TTS — only the target-language stimulus is spoken — so the spoken register
  (NPC dialogue + the challenge audio you must identify) stays intact while the
  instruction reads as the widget's own chrome.
- **NPC TTS no longer speaks the target text in a WRONG-LANGUAGE voice (R2-2,
  on-device).** On a device with no installed target-language voice (e.g. an
  ES-locale device learning EN), `listVoices("en")` returned voices but none were
  English; `npcVoice` USED to "keep the full list" and deterministically pin a
  Spanish voiceId → `speakVoice("en", text, esVoiceId)` → English NPC text spoken
  in a Spanish voice. Now the candidate set is STRICTLY voices whose own
  `.language` matches the target; if none match we pin NOTHING and fall back to
  language-only `speak(target, text)` (the native plugin then picks a
  target-language voice from `language`), so a non-target voice is never pinned. A
  PIN-SITE language guard double-checks before `speakVoice`. The sticky-voice cache
  is now keyed by `npcId|target` (bumped to `wp:npc:voice:v2`, value `{id,language}`)
  so a voice pinned for one target is never reused for another, and a stale
  wrong-language pin is discarded. On-device diagnostics now log `listVoices`
  returns + match counts + the pinned voice's language (noisy, not silent) so the
  host's voice behavior is visible. (Companion host-side `listVoices` "keep the full
  list" fallback flagged to the app team.)
- **NPC language correctness — the prompt AND the voice now match the TARGET
  language (R2-2).** Two mismatches are fixed so an NPC always teaches in the
  language the player is LEARNING, in any language pair. (1) **Voice:** the TTS
  voice language is now `learnerPair.target` (`src/npc/npcRuntime.ts`), not the
  scene-derived `voiceHint` — an ES→EN NPC spoke English text through a *Spanish*
  voice (and fed TTS a non-BCP-47 `:warm` suffix); per-NPC voice variety still
  comes deterministically from `npcVoice.pickVoiceId` over the TARGET language's
  voices. (2) **Prompt language:** the decisive language+behaviour directive of
  the system prompt is now composed IN the target language and its native script
  (new `src/npc/promptLocale.ts`, wired into `composeSystemPrompt`) — an English
  "reply in Arabic" rail made a 4B model emit Latin-letter babble; an
  AR-from-EN NPC now gets an Arabic directive ("تحدَّث بالعربية فقط، بأحرفها
  العربية…") and writes Arabic. The directive is now authored **by hand for the
  ENTIRE Corpán roster** (all 60 codes / 52 scripts — `languageNames.ts`'s 57 plus
  `lt`/`sl`/`ne` from the chrome i18n catalog — every target primes the model in
  its own script, not just en/es/ar), each with an `en` fallback + a
  `registerPromptLocale()` seam (mirrors `challengeSegues`). Script-variant codes
  resolve to their OWN entry (exact-code-first lookup), so `sr-Latn` is Latin (not
  Cyrillic `sr`) and `pa-Arab` is Shahmukhi (not Gurmukhi `pa`). All 60 verified in
  the correct script by the codex LLM judge + a regression test
  (`src/npc/promptLocale.test.ts`); EN-from-AR correctly gets the English directive.

### Changed
- **NPC chat is creative + varied again, not a "Repeat after me" drill (#37).**
  The system prompt was OVERSPECIFYING: `describeObjective` leaked the mechanical
  challenge `toolId` (`lead the learner through 1 "repeat-after" challenge`) into
  the persona template, and the beginner scaffold literally said "lots of
  repetition" — so a 4B model parroted "Repeat after me: X" every turn. Now the
  objective is a soft human goal ("help the traveler pick up a few useful, real
  phrases through natural conversation"), the scaffold gives light direction ("Keep
  it easy: short, very common words…"), and a warm anti-drill nudge steers the
  model to be a real local, say something NEW each turn, weave words in naturally,
  and stay coherent — never literally drill. Scripted no-LLM fallback `teach` lines
  were also de-drilled (no more "Repite conmigo"). `src/npc/promptProgram.ts`,
  `src/npc/personaGen.ts`.
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
- **Slashed ground memory + moved façade painting off-thread (perf Stage 3).**
  Two ground-rooted problems remained after Stage 2: (a) memory was dominated by
  ~129 distinct 512² per-chunk baked ground textures (~180 MB of the 298 MB
  total), and (b) a one-time ~3s startup spike from spawn-area ground textures
  PAINTING on the main thread. (A) **Shared, tileable ground.** The per-chunk
  baked composite texture is gone. There are now exactly SIX shared, tileable
  ground materials for the WHOLE city (cobble / flagstone / dirt / stone / grass /
  water — `grass`+`water` promoted to first-class `SurfaceName`s in
  `render/materials.ts`, so no per-chunk recolor defeats sharing). A chunk's
  ground is cheap GEOMETRY (`src/city/cityGround.ts`): its area is partitioned
  into NON-OVERLAPPING cells (cut at every road/water/bridge rect edge + a uniform
  grid so plaza/park discs read curved), each cell takes the topmost surface at
  its center (last region wins — same painter order as the old bake), and same-
  surface cells merge into one mesh per surface with world-tiled UVs. Roads stay
  BAKED-IN as part of the one flat ground (the §2 z-fight rule) — all cells sit at
  one depth and never overlap, so nothing can z-fight at any angle. (B)
  **OffscreenCanvas worker for façade painting.** The pure façade painter
  (`drawFacade` + helpers) moved to `src/world/facadePaint.ts` and now runs in a
  Web Worker (`src/world/painter.worker.ts`), returning a transferred
  `ImageBitmap` the main thread cheaply uploads — the main thread never paints.
  Feature-detected (`facadePainter.ts`): on a WebView without OffscreenCanvas /
  module workers (older WKWebView < iOS 16.4) it falls back to the original main-
  thread paint, and any worker error trips a permanent fallback. The building
  geometry/material flow is unchanged — `TexPool.getFacade` always returns a real
  texture immediately (primed with stucco), filled in a few frames later.
  Measured (headless cold walk, 20s): ground textures ~180 MB → effectively 0
  (zero distinct per-chunk ground bakes; total scene textures **298 MB → 123 MB**),
  the spawn-area ground-paint startup spike is eliminated, and per-frame jank is
  no worse than Stage 2 (MAX 38ms → ~30ms, frames >33ms 2 → 0, frames >25ms 5 →
  2-3). New QA harness: `qa/jank-stage3.mjs` (frame deltas split first-2s vs
  after-2s + a broad memory sweep).

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
