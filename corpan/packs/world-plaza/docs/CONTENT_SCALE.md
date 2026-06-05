# World Plaza — Content Scale (massive variety, A++ premium, no placeholders)

**Workstream #5 of the Next-Level Scale-Out** (`docs/NEXT_LEVEL_PLAN.md`). This
doc owns the **content-variety facets**: how every visible/playable instance —
faces, character art, item art, maps/scenes/rooms/topologies, quests, NPC
personalities, and the kinds of minigames themselves — scales from today's
small-but-tasteful set toward **thousands of distinct, premium instances**,
without a single demo placeholder.

> **Status:** Design + plan only. No code here. This is the spec the sub-facet
> agents fan out from (§9).

**The mandate, restated:** *prove + engineer massive variety to A++ premium.*
The proof obligation is real: for every facet we state the **variety math**
(how many distinct instances the generator can yield), the **quality gate** (how
we keep it from going samey/ugly/uncanny), how it's **data/CDN-driven** (ships
without an app release), and the **asset pipeline** (procedural in-engine now →
DGX-Spark/Meshy/2D-gen later, behind the existing seams).

---

## 0. Principles that bind every facet

These are non-negotiable and shared by all seven facets below.

1. **Seed-deterministic generators, not hand-authored one-offs.** Every facet
   already (or will) take `(role/kind, seed, theme)` → a stable, unique instance
   via the FNV-1a hash + mulberry32 PRNG pattern in `characterGen.ts` /
   `personaGen.ts`. Same seed = same instance across frames + reloads; different
   seed = visibly distinct. This is how we get "thousands" from a small kit.
2. **Variety is COMBINATORIAL, never a giant asset list.** A base + tintable +
   layered parts (the `WardrobeTheme`/`CharacterSpec` model) yields millions of
   combinations from dozens of pieces. We scale the *kit and the curation*, not
   the count of bespoke meshes/sprites.
3. **Curated bags, not uniform random.** "Samey/ugly" comes from flat uniform
   sampling. The fix (already pioneered in `ROLE_BIAS.demeanor` — wholesome-heavy
   bags where `sly`/`sneer` is one rare entry) is the universal pattern: every
   pick draws from a **weighted, hand-tuned bag** with rarity tiers, harmony
   constraints, and "never together" exclusion rules. Premium = the *distribution*
   is art-directed, even though any single instance is procedural.
4. **Theme is the reskin axis.** A `Theme` (palette + vocabulary) is the single
   knob that re-dresses the SAME generator for a new era/place (Antigua-1770 →
   Tokyo-2050, proven). Adding a world = authoring a Theme bundle, not new logic.
5. **Everything is data/CDN-driven.** Generators are tiny code; their *vocabulary*
   (themes, archetype catalogues, name pools, item catalogs, topology params,
   quest arcs, challenge content) lives in JSON that ships via the catalog/asset
   CDN (the pack already has a two-zip streaming installer, SHA-256 verified).
   New content = a CDN push, **no app release**. Code seams stay frozen.
6. **Pluggable look seams already exist** — `WorldLook` (`src/render/worldLook.ts`),
   the `CharacterLook` chokepoint (`createGroundedCutout` in `src/render/cutout.ts`),
   `ChallengeTool`/`ToolImpl` (`src/challenges/registry.ts`). The procedural look
   ships now; the Spark 3D pipeline (`docs/SPARK_ASSETS.md`) slots in behind the
   SAME seams later. **Content scale must never require touching a render seam.**
7. **Quality gate is a CI harness, not a vibe.** Each facet defines an automated
   QA pass (turntable/contact-sheet render of N seeded instances + an automated
   "distinctness/no-uncanny/no-clash" check). "Premium" is *proven by a contact
   sheet a human signs off*, not self-certified. (§8.)
8. **Per-Track scoping (the keystone, `docs/LANGUAGE_PAIR_STATE.md`).** All
   content variety is generated *inside a Track* `(native, target)`. The Track's
   target language + region biases name pools, archetype flavour, quest arcs,
   and which Theme is era-default. Seeds are namespaced by the Track key so two
   Tracks of the same user see coherent-but-distinct populations.
9. **Localize every authored string in ~50 langs** (`docs/LOCALIZATION_SCALE.md`).
   Generated *structure* is language-agnostic; every authored *string* (item
   names, archetype labels, quest beats, challenge prompts) goes through the
   per-locale override pattern. Content scale and localization scale compose.

---

## 1. Faces & Expressions

### Current state (read the code)
- **`src/character/characterArt.ts`** paints faces procedurally onto a 256×384
  cutout canvas: `drawMouth` + eyes + brows + cheeks + optional beard, driven by
  `FaceSpec { expression, brow (0..0.3), cheeks (bool), beard }`. ~15 expression
  cases handled (`neutral/smile/grin/content/shy/frown/surprised/sleepy` symmetric
  + `smirk/sneer/sly` asymmetric + back-compat aliases).
- **`characterGen.ts`** chooses the resting expression via `expressionFor(rand,
  demeanor)` from a `Demeanor` (`friendly/cheery/gruff/shy/sly/sleepy`). The
  **"all NPCs looked murderous" fix is baked in**: only `sly` can ever unlock the
  asymmetric smirk/sneer, demeanor bags are wholesome-heavy, and `Expression`'s
  docstring documents symmetric-by-default as a hard rule.
- **`animator.ts`** overrides the MOUTH per-frame for talk + blink (the `Pose`),
  so the resting face is a baseline the talk channel rides on.

**Verdict:** the *warmth bar is met* and the murderous-mob regression is guarded.
The *variety* is the gap — face = `expression(~8 wholesome) × brow(continuous) ×
cheeks × beard(4)`. Distinct enough at 28 NPCs, but it will read repetitive at a
plaza of 80+ and across many Tracks because **eyes, nose, face-shape, age, and
emotion-vs-resting-mood are not yet parameters.**

### Generative model to reach premium variety at scale
Expand `FaceSpec` into a richer **parametric face kit** (still painted procedurally
now; atlas-swappable later behind the same `characterArt` draw):

- **New seed-driven axes** (each a curated bag, not uniform): `eyeShape`
  (round/almond/narrow/wide ~6), `eyeSpacing` + `eyeSize` (continuous, clamped),
  `noseStyle` (button/straight/broad/aquiline ~5), `faceShape`
  (round/oval/square/heart ~5), `browShape` (straight/arched/soft ~4) layered on
  the existing `brow` weight, `ageBand` (child/young/adult/elder — drives wrinkles,
  brow set, hairline, jaw softness), `freckles`/`beautyMark`/`dimples` (rare
  garnish toggles), `lipFullness`. Brow + lid + mouth curvature stay **symmetric
  by construction** for all wholesome demeanors (the §0.3 exclusion rule).
- **Variety math:** eyeShape(6) × eyeSize(~4 buckets) × eyeSpacing(~4) ×
  noseStyle(5) × faceShape(5) × browShape(4) × ageBand(4) × beard(4) × cheeks(2)
  × freckles(2) × expression(~8) ≈ **~1.2M distinct faces per Theme**, before
  hair/skin. With skin(6+) × hair(7 styles × many colors), the face-and-head space
  is comfortably in the **tens of millions** — no twins at any plaza size.
- **Emotion/mood-linked expressions (tie to the new mood beats).** Today the face
  carries one *resting* expression from demeanor. Add a **transient emotion
  channel** the runtime can push: the NPC's `MoodBeat` (the cohesion/persona mood
  system) maps to a momentary `Expression` overlay — *delighted* when you ace a
  challenge, *surprised* when you hand over the right item, *thoughtful* when
  dropping a clue, *sleepy* late in the day. The animator blends the resting face
  → emotion → back over ~400ms. This is the warmth multiplier: faces *react*.
  - Seam: `Pose` gains an optional `emotion?: Expression` + `emotionAmt: 0..1`;
    `npcRuntime` emits a mood beat → `crowd`/`controller` set it on the animator.
    No new render path; `drawMouth`/eyes already branch on expression.

### Quality bar + avoiding samey/ugly
- **Symmetry invariant for wholesome demeanors** (existing rule, now enforced
  across every new axis: no one-sided eye/brow/lip for non-`sly`).
- **Anti-uncanny clamps:** eyeSpacing/eyeSize/faceShape ranges are clamped to a
  hand-tuned "cute paper-person" envelope; the QA contact sheet (§8) renders 64
  seeded faces in a grid and a reviewer signs off "all warm, none uncanny, all
  distinct." A perceptual-hash distinctness check flags any near-duplicate pair.
- **Age coherence:** ageBand gates hair greying, beard density, brow set together
  (no child with a full grey beard) via cross-axis constraints.

### Data/CDN-driven
- Face-axis **bags + weights live in the Theme bundle** (`faceKit` block), so an
  era can shift the population's age skew, common eye shapes, freckle rates, etc.
  Adding/retuning faces = a CDN Theme push.

### Asset pipeline
- **Now:** fully procedural in `characterArt` (zero asset deps — the current path).
- **Later (Spark/2D-gen):** the same `FaceSpec` axes become an **atlas of
  pre-rendered face layers** (a 2D-gen pipeline producing eye/nose/mouth/brow
  sprite sheets per Theme, KTX2-packed), OR drive the morph targets of a 3D
  bubble-head. The `FaceSpec` schema is the stable contract either way — the draw
  function is swapped behind `characterArt`, callers unchanged.

---

## 2. Character Art / Wardrobe

### Current state
- **`characterSpec.ts`** is the one resolved paper-doll model: skin, build (5),
  hair (8 styles × color), face, `Clothing` (top/bottom/outer/hat/accessory layers,
  each `{item, color, accent, pattern}`), apron, prop (11 kinds). `AvatarSpec`
  (network/storage) maps INTO it — **the player's dressed avatar IS their in-world
  body**, and an unlocked cosmetic is the same slot an NPC wears.
- **`characterGen.ts`** + **`WardrobeTheme`** (`ANTIGUA_1770`) drive era-appropriate
  dress: per-`RoleBias` garment/prop/hat probabilities layered over the theme's
  garment vocabulary + fabric palette. `makeLayer` adds patterns (stripe/check/trim)
  at 22%. **`characterArt.ts`** paints all layers as torn-paper pieces.
- **Variety today:** skin(6) × build(5) × hair(7×~7) × top(4)×fabric(10) ×
  bottom(4) × outer(5) × hat(6) × accessory(6) × apron × prop(11) × pattern —
  already "millions" per the docstring, and visibly twin-free at 40.

**Verdict:** the *system* is excellent and the seam to 3D is clean. The gap is
**garment vocabulary breadth** (4 tops / 4 bottoms is thin for "thousands of
distinct, *tasteful* looks") and **per-Theme wardrobe depth** — variety is high
but the *silhouette* repertoire is small, so at scale outfits feel like recolors.

### Generative model to reach premium variety at scale
- **Deepen the garment kit per layer** to ~12–16 silhouette families each
  (tops: tunic/blouse/shirt/huipil/vest-shirt/smock/jerkin/bodice/poncho/…;
  bottoms, outers, hats, accessories likewise), each a `characterArt` draw recipe.
  Silhouette is the variety the eye reads; color/pattern is the multiplier.
- **Outfit COHERENCE engine (the premium leap).** Today layers are sampled
  independently → occasional clashing combos. Add an **outfit composer** that picks
  a **palette scheme** (monochrome / analogous / complementary-accent — from color
  theory) and a **formality/role register**, then samples garments + fabrics that
  *harmonize* within it. This is what turns "random but varied" into "every NPC
  looks intentionally dressed." (Mirror of the §1 face-coherence and §0.3 curated-bag
  principle.)
- **Pattern + trim system:** extend beyond stripe/check/trim to embroidery hems,
  bandings, two-tone yokes — all procedural canvas ops, rarity-weighted so they're
  garnish, not noise.
- **Variety math:** with ~14 tops × ~10 bottoms × ~8 outers × ~10 hats × ~10
  accessories × ~10 fabrics × ~6 schemes × pattern/trim variants × the §1 head
  space, a single Theme yields **billions** of coherent outfits — the constraint
  is curation, never count.

### Path to optional 3D "bubble people"
- The seam is committed (`docs/DECISIONS.md`, `RENDER_LOOK.md`): character render
  is the **single chokepoint `createGroundedCutout`** (`src/render/cutout.ts`),
  consumed by `crowd.ts` + `controller.ts`. A future `Character3D` implements the
  same interface (`setGroundPos`/`hop`/`faceCamera`/`animate`) → drop-in. Promote
  to a pluggable `CharacterLook` (mirroring `WorldLook`) so paper↔3D is one line.
- `CharacterSpec` is **already portable** to 3D (skin/hair/clothing *layers*
  describe a bubble-person as well as a paper doll). The Spark pipeline
  (`SPARK_ASSETS.md` §2) produces a **base bubble-body + swappable layered parts
  keyed to the SAME `CharacterSpec` slot ids** + tintable materials → infinite 3D
  variety from a small rigged kit, exactly mirroring the procedural kit.
- **Content-scale obligation:** keep `CharacterSpec` slot ids stable and named so
  the Spark kit's part ids map 1:1. Growing the *procedural* garment kit should
  publish the new slot ids into the `assets-manifest.json` contract so the 3D kit
  can be grown to match — the two kits stay in lockstep by id.

### Quality bar + data/CDN-driven + pipeline
- **Quality:** the outfit-coherence engine is the anti-clash gate; QA renders a
  contact sheet of 64 NPCs per Theme + an automated palette-clash check (ΔE between
  adjacent layers within tolerance for the chosen scheme).
- **CDN:** garment vocabulary + fabric palettes + scheme bags live in the Theme
  bundle; new wardrobe ships via CDN. Cosmetic *items* (the unlockable subset) are
  authored in `content/items/catalog.json` (§3) and reference the same garment ids.
- **Pipeline:** procedural canvas now → Spark GLB part kit later, same ids.

---

## 3. Inventory Item Art

### Current state
- **`itemTypes.ts`** = a first-class `Item` model (`id/name/art/kind/slot?/rarity/
  value/description/tags/tints`). **`content/items/catalog.json`** = 39 items
  (8 quest / 10 trade-good / 7 consumable / 13 cosmetic — Antigua-1770).
- **Art today is thin:** `Item.art` is a `cutout`/`placeholder:*` id resolved by a
  glyph/emoji map (`ART_GLYPH`) in the DOM surfaces, or `cutoutArt` for 3D. Most
  inventory cells render an **emoji/placeholder** — exactly the "placeholdery"
  thing the mandate forbids at premium scale.

**Verdict:** the model is right; the **art is the placeholder**. We need many
distinct, premium item *icons*, coordinated with the economy doc's currencies +
goods and the badges doc's badge art.

### Generative model to reach premium variety at scale
- **A procedural item-icon renderer** (`src/items/itemArt.ts`, NEW), the item-world
  twin of `characterArt`: paints each item as a small torn-paper/diorama icon from
  an `ItemArtSpec` (silhouette family + palette + material finish + rarity frame).
  Same paper aesthetic → items belong to the world, not clip-art.
  - **Silhouette families** (~40–60): coin/bill stack (currencies, ties to
    `ECONOMY_CURRENCY.md`), token/seal, letter/scroll, hat/garment (mirrors §2
    cosmetics), foodstuff (bread/fruit/sack), vessel (pot/skin/bottle), tool
    (needle/quill/lantern), gem/bead, badge/medal (ties to `BADGES_PROGRESSION.md`),
    key, charm, cloth.
  - **Rarity frame:** common/rare/epic/seasonal get a distinct deckle + corner
    flourish + subtle sheen (the reward-reveal already reads `*-token` as rare) —
    so rarity is *legible at a glance*, premium, not a colored border hack.
  - **Variety math:** ~50 families × palette(per Theme) × finish(matte/glazed/
    metal/woven) × rarity-frame(4) × seed jitter → **thousands** of distinct,
    tasteful icons, all on-brand.
- **Currency denominations** (coordinate with `ECONOMY_CURRENCY.md`): the bland
  gray coin is killed; baseline = **stacks of bills + coins** with per-currency
  art (gold/silver/peso/yen/mark/…) driven by a `currency` family in the item-art
  kit. Denominations = scale/stack-height variants of one family.
- **Badge art** (coordinate with `BADGES_PROGRESSION.md`): badges are a `medal`
  family with per-category emblem + a fill ring (XP fills the badge). One renderer
  serves items *and* badges so they're visually consistent.

### Quality bar + data/CDN-driven + pipeline
- **Quality:** every catalog item must resolve to a real `ItemArtSpec` (a dev lint
  fails on any `placeholder:*` art at ship); QA renders the **whole catalog as a
  contact sheet** (currencies + goods + cosmetics + badges) for human sign-off —
  "no two confusable, none placeholdery, rarity legible."
- **CDN:** the catalog is JSON on the CDN; the art kit's family/palette tables live
  in the Theme bundle. New items + their art ship without an app release (art is
  derived from the spec at load). The catalog must scale from 39 → **hundreds** of
  era-appropriate items as worlds are added.
- **Pipeline:** procedural canvas now → optional 2D-gen icon atlas later
  (a Spark/2D-gen batch producing premium painted icons keyed to the same `art`
  ids), swapped behind `itemArt`'s resolve — callers unchanged.

---

## 4. Maps / Scenes / Rooms / Topologies

### Current state
- **Topology** (`RoomTopology`: `bounds/spawns/blockers/anchors`) is the shared
  collision/socket layer. Two authored topologies: `plaza-grand.json` (73 anchors,
  29 blockers, the enlarged ~±120 map) + `plaza-sq-a.json`.
- **`composition.ts`** is a strong **pure zoning/spacing planner**: 12 species,
  5 zones (PLAZA/MARKET/AVENUES/GARDEN/RESIDENTIAL), seeded, with spacing
  discipline + density falloff — but it **dresses an existing topology; it does
  not generate the topology itself** (street grid, building footprints, anchors).
- **Scenes** (`content/scenes/*`: `antigua-grand`, `tokyo-2050`, `antigua-1770`)
  are **data skins** over a topology: `palette/sky/landmark/buildingStyle/
  anchorSkins/npcSkins/narrativeBlurb`. The **Antigua↔Tokyo divergence over one
  topology is proven** (the spine).
- **Buildings** (`buildings.ts`): 6 `BuildingKind`s × `buildingStyle` (antigua-stucco
  / tokyo-neon), procedural 3D with embedded roofs (z-fight killed by construction).
- **Rooms** (the multiplayer/Colyseus unit): Room = shared collision (a topology);
  per-player Scene + Quest skin it.

**Verdict:** the *reskin* axis (Scene over topology) and the *dressing* (composition)
are premium and proven. The two gaps for "bigger & more varied": (1) **topologies
are hand-authored** — only 2 exist, so every player walks the same street grid;
(2) **building/architecture variety** is 6 kinds × 2 styles.

### Generative model to reach premium variety at scale
- **Parameterized TOPOLOGY GENERATOR** (`src/world/topologyGen.ts`, NEW) — the
  headline. A seeded generator that emits a valid `RoomTopology` (bounds, a street
  grid baked for the road system, building-footprint blockers, typed anchors,
  spawns) from a **`LayoutSpec`**: `{ archetype, size, density, seed, zoneMix }`.
  - **Layout archetypes** (~8–12): grand-plaza (current), grid-town, market-souk,
    harbor/waterfront (gives the `docks` anchor the route quest wants), avenue-cross,
    village-green, canal-town, hill-terrace, walled-old-town (gives `city_gate`),
    boulevard. Each archetype is a footprint+road generator; `composition.ts`
    *already* consumes any topology, so dressing comes free.
  - **Anchors are TYPED + generated** (today they're untyped — `kind:'?'`). The
    generator emits anchors with kinds (`vendor/npc_station/docks/city_gate/portal/
    fountain/merchant/...`) so quests + special-NPCs + personas bind to them by
    type, and the §6 personas tend the right anchor.
  - **Variety math:** archetype(10) × size(continuous) × seed → **unbounded**
    distinct walkable maps, every one collision-valid and dressable. Rooms scale
    by minting topologies per `(archetype, seed)`.
- **Bigger maps:** size is a `LayoutSpec` param; the road-baking + composition
  density-falloff + vista/fog already handle large bounds (the ±120 grand map
  proved it). Perf stays via thin-instancing + the lean tier.
- **More Scenes/eras/places (generalize Antigua↔Tokyo).** A **Scene authoring kit**:
  a Scene = a Theme bundle (palette/sky/landmark/buildingStyle/wardrobe/faceKit/
  prop-palette) + an `anchorSkins`/`npcSkins` mapping. Target: a **library of
  eras/places** (Antigua-1770, Tokyo-2050, plus e.g. Lisbon-1900, Marrakesh-souk,
  Nordic-port, Andean-market, Parisian-boulevard, …), each ~one JSON Theme bundle.
  A Scene + a generated topology = a place no one has walked before. **Per-Track
  bias:** the target language/region picks the era-default Theme (es → a colonial
  or modern Latin-American place; ja → Tokyo; fr → Parisian), so the world reflects
  *your* journey (PREMIUM_FOUNDATIONS §0 north star).
- **Building architecture variety:** grow `BuildingKind` (add tower/warehouse/
  bathhouse/teahouse/townhouse/gatehouse...) and parameterize facades (storeys,
  window grids, balconies, signage, awnings) per `buildingStyle`, all procedural.

### Quality bar + data/CDN-driven + pipeline
- **Quality:** the topology generator must guarantee, by construction, the invariants
  the world already enforces — **zero road z-flicker** (roads baked into the single
  ground mesh per `DECISIONS.md`), no overlapping blockers, reachable spawns +
  anchors (a connectivity check), and humane spacing (composition handles dressing).
  A QA harness renders a top-down + 3 in-world angles of N seeded topologies for
  sign-off, and runs a pathfinding reachability assertion.
- **CDN:** topology *generation params* (LayoutSpecs) + Scene/Theme bundles are
  JSON on the CDN. New eras/places + new map archetypes ship without an app release.
  Authored hero topologies (hand-tuned showcase maps) can still be shipped as data
  alongside generated ones.
- **Pipeline:** procedural now → the Spark building/prop GLB kits
  (`SPARK_ASSETS.md`) slot in behind `WorldLook`/`buildings` per `buildingStyle` —
  the topology/anchors are the stable contract both looks consume.

---

## 5. Quests

### Current state
- **`Quest`** contract (`contracts/src/quest.ts`): `{title, narrative, learnerPair,
  domain, objective, steps[], promptProgram}`; `QuestStep {id,label,anchorId?,
  toolId?,entryIds?,done?}`; `QuestState` runtime type. Two authored quests
  (`es-cafe`, `es-guadalajara` — the latter a real 2-step clue→item→deliver chain
  with `docks`/`city_gate` anchors).
- **`questItems.ts`** = rich per-quest `QUEST_ITEM_RULES` (requirements + clues +
  source anchors + relevance tags). The **clue→item→deliver→advance loop is fully
  designed** in `COHESION_ITERATION.md` (the QuestEngine, deterministic gating,
  the model only re-voices authored beats).
- **`LearningPath`/`LevelSpec`** (`curriculum.ts`) exist for ordering levels.

**Verdict:** the quest *engine + cohesion model* are designed and the data shapes
are ready. The gap is **content volume** — 2 quests for 2,450 possible Tracks. We
need **many authored+generated quests/arcs per language pair**, coordinated with
the per-pair Track and the cohesion engine.

### Generative model to reach premium variety at scale
- **Quest = TEMPLATE × content-slots.** Author a small set of **quest archetype
  templates** (~10–15): *the-delivery* (Guadalajara route), *the-lost-item*,
  *the-letter*, *the-market-errand*, *the-festival-prep*, *the-introduction-chain*,
  *the-recipe*, *the-lost-and-found*, *the-guided-tour*, *the-haggle*. Each template
  is a step-graph with typed slots: `{anchorType, toolId-pool, item-role, clue-shape,
  beat-shape}`. A **quest generator** fills slots from the active Track's content:
  target-language domain (`travel/market/greetings/...`), corpus `entryIds` for the
  step's drill, item from the catalog tagged for the role, the source anchor by type
  from the (generated) topology, and authored-clue *shapes* localized per language.
- **Authored beats stay authored (cohesion rule).** Per `COHESION_ITERATION.md`,
  the small model never carries the quest — it re-voices **authored** clue/next-hint
  lines. So a generated quest emits **authored-quality beat lines** by filling
  localized beat *templates* ("If only I had {item} from {place}…"), not by asking
  the LLM to invent plot. This keeps generated quests cohesive + safe.
- **Per-pair Track arcs.** A Track has its own **arc** = an ordered `LearningPath`
  of generated+authored quests that climb a difficulty curve (CEFR-tied via the
  corpus levels) and migrate the player narratively ("Marietta → Guadalajara →
  …"). Each Track gets a *coherent, distinct* arc because the generator is seeded
  by the Track key and biased by the target language/region.
- **Variety math:** template(12) × topology-archetype(10) × item-role × entryId
  selection × Theme/place → effectively **unbounded** distinct quests; a curated
  set of hand-authored *hero* quests per popular Track anchors the quality.

### Quality bar + data/CDN-driven + pipeline
- **Quality:** a generated quest must pass a **validity gate** (every step's anchor
  type exists in the target topology; every required item exists + is tagged; every
  step's `entryIds`/selector resolves to real corpus rows; every beat line has a
  localized authored template; the step graph is completable). The cohesion harness
  runs the clue→item→deliver→advance loop end-to-end (model + scripted-fallback).
  Hero quests are hand-reviewed; generated quests are spot-checked via contact sheet.
- **CDN:** quest templates, beat-line template libraries, and authored hero quests
  are JSON on the CDN; arcs/`LearningPath`s are generated client-side per Track from
  seeds + CDN templates. New quests/arcs/templates ship without an app release.
- **Pipeline:** authored + procedural now; an *offline* authoring assist (a larger
  model on the Spark drafting beat-line templates per language, human-curated) can
  scale the template libraries — but the **runtime** model stays a voice, never an
  author.

---

## 6. NPC Personalities

### Current state
- **`personaGen.ts`** is excellent and already deep: **16 era-appropriate
  archetypes** (baker/fishmonger/weaver/herbalist/friar/sailor/dockhand/merchant/
  musician/elder/child/water-seller/scribe/lamplighter/flower-girl/smuggler), each
  carrying tone seeds, quirk seeds, a **challenge whitelist + in-character pretexts**,
  topics, name pools, backstory hooks, voice hint, anchor-tendency, rarity weight.
- `generatePersona(charSpec, scene, quest, seed)` joins `CharacterSpec.demeanor` ×
  archetype × scene/quest → a valid `NpcRole` the existing `npcRuntime`/
  `promptProgram` drive. **Every wanderer is a real, talkable character.** Wholesome-
  heavy; smuggler rare + never mean.

**Verdict:** the *system* is premium and the variety is already strong (archetype ×
demeanor × name × quirk-shuffle × hook). The scale gaps: (1) **16 archetypes is
Antigua-specific** — each new era/place needs its archetype catalogue; (2) **mood
is static** — a persona's tone is fixed for its lifetime; the "endlessly distinct"
feel and the §1 emotion-linked faces want a **dynamic mood**; (3) keeping all this
**within the small model's limits** (Qwen3-4B is weak at subtlety — per MODEL_STRATEGY
+ cohesion).

### Generative model to feel endlessly distinct without breaking the small model
- **Per-Theme archetype catalogues** (CDN data). Factor the 16 archetypes into a
  **Theme `archetypes` bundle** so each era/place ships its own trades (Tokyo:
  ramen-cook/idol/salaryman/shrine-keeper/…; Marrakesh: spice-merchant/tanner/
  storyteller/…). Same `Archetype` shape, new flavour words → personas reskin with
  the world. Target ~16–24 archetypes per Theme.
- **Dynamic MOOD beats (the distinctness + warmth multiplier).** Add a lightweight
  **mood layer** on top of the static persona: a `Mood` (`cheerful/tired/busy/
  wistful/excited/distracted`) seeded by time-of-day + recent interaction + a slow
  per-NPC drift. Mood does three cheap, deterministic things — **no extra model
  load**: (a) selects which authored tone/quirk fragments + greeting the NPC leads
  with, (b) drives the §1 transient face `emotion`, (c) tweaks one line of the
  system prompt ("you are a little weary this afternoon"). The *model* still only
  re-voices authored beats; mood just picks *which* authored colour. Result: the
  same baker feels different morning vs dusk, busy vs idle — "endlessly distinct"
  from a finite kit.
- **Combinatorial identity:** archetype(20/Theme) × demeanor(6) × mood(6) × name ×
  quirk-subset(pickN) × hook × voice → millions of persona instances per Theme,
  each stable by seed.
- **Honest small-model discipline (MODEL_STRATEGY + cohesion §7.6).** Everything
  load-bearing stays deterministic/authored: the challenge whitelist, the pretexts,
  the clues, the mood→colour mapping. The model gets a **tight, branchy, ≤2-sentence
  authored beat to paraphrase in character + target language** — it never plans,
  remembers inventory, or decides progression. Scaling personality = scaling
  *authored vocabulary bags*, not model reasoning.

### Quality bar + data/CDN-driven + pipeline
- **Quality:** wholesome-heavy bags preserved (smuggler/sly rare, never mean, safe
  for a seven-year-old); a QA pass samples N personas per Theme and reviews the
  generated `basePersona` + a scripted-fallback dialogue line for tone + safety +
  distinctness. Mood transitions are smooth + dignified (no manic flip-flops).
- **CDN:** archetype catalogues, name pools, quirk/tone/hook libraries, mood→colour
  tables live in Theme bundles on the CDN. New personalities/eras ship without an
  app release. Localized per `LOCALIZATION_SCALE.md`.
- **Pipeline:** procedural now; offline LLM-assisted authoring (Spark) can draft
  archetype/quirk/hook vocabulary per era, human-curated, to grow the bags fast.

---

## 7. New Game / Experience Types

### Current state
- **20 challenge tools** (`src/challenges/tools/*`), all clean `ToolImpl`s behind
  `runChallenge`: word-scramble, build-sentence, fill-the-blank, dialogue-fill,
  spot-typo, conjugation-tap, rhyme-match (text); fast-translate, tap-translation,
  listen-choose-pic, true-false, odd-one-out, number-drill (choice); picture-match,
  memory-pairs, category-sort, countdown-recall, word-search (grid); read-aloud,
  say-it-back (STT). Each: a centered RPG overlay, normalized score, XP+coins+items.

**Verdict:** the 20 are a strong, premium **micro-quiz** library — but they're all
the *same archetype* (a centered overlay drill). The mandate asks for **genuinely
new KINDS of experiences** that exploit the world (markets, music, navigation,
role-play). The `ChallengeTool`/`ToolImpl` seam can host them, but some new kinds
want **world-level** interaction (the overlay is too small a canvas), so we also
need a sibling seam for **world experiences**.

### New experience archetypes (proposed, premium, world-fitting)
Two tiers — **(A)** new `ChallengeTool`s (fit the existing overlay seam) and
**(B)** new `WorldExperience`s (a NEW lightweight seam for diegetic, in-world play
that uses the map/crowd/economy, not a centered card).

**(A) New ChallengeTools** (drop into `tools/*`, registered like the 20):
1. **price-haggle** — back-and-forth number/offer negotiation with a vendor
   (numbers + politeness phrases); ties to the market economy.
2. **describe-it** — the NPC shows an item/scene; you choose/say 3 describing words
   (adjectives/colors) before a timer.
3. **directions-listen** — hear a route ("turn left at the fountain"), tap the
   path on a mini-grid (spatial + imperatives) — a bridge toward (B) navigation.
4. **sing-along / call-and-response** — the musician sings a line (TTS), you fill /
   repeat the next (rhythm + memory); ties to §6 musician archetype.
5. **menu-order** — read a café/market menu, assemble an order (sentence-building
   in a *situated* frame).
6. **count-the-coins** — make exact change from a currency stack
   (ties to `ECONOMY_CURRENCY.md` denominations + number listening).
7. **emote-match** — match a target-language emotion/mood word to a face
   (reuses §1 expression rendering — content from our own faces).
8. **story-sequence** — order 3–4 picture cards into a little narrative, label each
   (comprehension + sequencing).

**(B) New WorldExperiences** (a NEW `WorldExperience`/`ExperienceTool` seam —
diegetic, world-level, NOT a centered overlay):
1. **Market run** — a timed *shopping list* errand: walk the market, find the
   stalls, buy the listed goods (each purchase a tiny word-confirm), return.
   Uses the topology, vendor anchors, currency, the map/minimap. *Markets.*
2. **Town navigation / scavenger** — "find the chapel / the blue-door house": a
   wayfinding quest that drills place words + directions using the real map +
   minimap markers. *Navigation.*
3. **Festival / performance** — a scheduled plaza event (music + crowd gather):
   a rhythm/call-and-response performance with the musician + crowd participation,
   target-language lyrics. *Music + crowd.*
4. **Role-play scene** — a short, menu-driven *situated dialogue* with a special
   NPC (order a coffee / ask directions / introduce yourself): branching authored
   lines (safe, no UGC), the model re-voicing — a richer encounter than a drill.
   *Role-play.*
5. **Photo / sketch hunt** — find and "capture" N themed things in the world
   (architecture, props), labeling each — turns the §4 prop/building variety into
   gameplay (vocabulary of the *place*).

These reuse content we already generate (faces, items, props, topology, personas) —
so new *experiences* multiply the value of every other facet's variety.

### How they plug into the seams
- **(A)** is the existing contract: extend `ChallengeToolId`, add a `ToolImpl` to
  the right `tools/*` file, register it, author localized pretexts. Reward path,
  overlay, scoring — all unchanged. **Zero new seam.**
- **(B)** needs a sibling: a `WorldExperience` interface (mirror of `ToolImpl` but
  it gets the **world context** — topology, player/crowd handles, inventory, map,
  the overlay layer for HUD — and resolves a `ChallengeResultPlus`-shaped reward so
  the economy/quest handoff is identical). It mounts diegetically (HUD + world
  interaction), not a centered card. A `WorldExperienceId` enum + a small registry
  (`src/experiences/*`, NEW) parallels the challenge registry. **Quests can target
  a WorldExperience by id exactly like a `toolId`**, so cohesion (§5) drives them.
- Both tiers are **data/CDN-driven** at the content layer (entryIds, pretexts,
  list contents, role-play scripts are JSON); the *code* seam (the new tool /
  experience impl) ships in a pack build, but its *content* scales via CDN.

### Quality bar
- Each new tool/experience: 60fps, no layout shift (the overlay discipline / a
  world-HUD that never reflows the canvas), localized prompts, normalized score,
  XP+coins+items reward, graceful no-STT/no-model fallback, safe-for-a-7-year-old.
  The challenge QA harness (`qa/challenges.mjs`) extends to cover each new tool;
  WorldExperiences get a world-mode QA (mount, complete, reward, no-reflow).

---

## 8. Quality gates (how we keep it premium, not noisy)

Every facet ships with an **automated contact-sheet QA** + a **human sign-off**,
because "premium" is proven by looking at a grid of N seeded instances, not by an
agent self-certifying (the recurring "verify the REAL app, not standalone" lesson).

| Facet | Automated gate | Human sign-off |
|---|---|---|
| Faces | 64-face grid render + perceptual-hash distinctness + symmetry/uncanny clamp check | "all warm, none uncanny, all distinct" |
| Wardrobe | 64-NPC grid + palette-clash ΔE check (coherence engine) | "all look intentionally dressed, no clash" |
| Item art | full-catalog contact sheet + no-`placeholder:*` lint + rarity-legibility | "no two confusable, none placeholdery" |
| Topologies | top-down + 3 angles of N seeds + zero-z-flicker + reachability assert | "varied, legible, navigable" |
| Quests | validity gate (anchors/items/entryIds/beats resolve) + cohesion loop e2e | hero quests reviewed |
| Personas | N-per-Theme persona + fallback-line tone/safety review + smooth mood | "distinct, wholesome, safe" |
| Experiences | per-tool challenge QA + world-mode no-reflow QA | played to completion |

**Cross-cutting gates (all facets):** 60fps phone budget; localized in ~50 langs;
single-language-stack safe; noisy errors; quota-safe storage (big caches →
IndexedDB, generated content is derived-not-stored); no Duolingo dark patterns.

**Anti-"noisy variety" rule:** more variety must never read as *random*. Every
generator draws from **curated, weighted, constrained bags** (§0.3), and the
contact-sheet sign-off is the gate that catches drift into ugliness. We scale the
*curation*, not just the count.

---

## 9. Recommended sub-facet agents (the fan-out)

Each agent is a **focused deep-dive** with **disjoint file ownership**, so the
orchestrator can dispatch them in parallel after this plan. Ordered by priority
(highest impact / unblocks-most first). Each agent's sole output is its own design
+ implementation within its owned files; none touches a render/game seam owned by
the orchestrator.

**Priority 1 — unblock the biggest "placeholdery" wins:**
- **A. Face-kit agent** — expand `FaceSpec` axes + `characterArt` face draw +
  emotion channel; owns `characterSpec.ts` (FaceSpec), the face section of
  `characterArt.ts`, the `faceKit` Theme block, the face QA harness. *(§1)*
- **B. Item-art agent** — build `src/items/itemArt.ts` (procedural icon renderer),
  the rarity-frame system, the currency/badge families (coordinate with
  ECONOMY_CURRENCY + BADGES_PROGRESSION), the catalog QA + no-placeholder lint.
  Owns item-art + the art side of `content/items/catalog.json`. *(§3)*
- **C. Topology-generator agent** — build `src/world/topologyGen.ts` + `LayoutSpec`
  + typed anchors + the layout-archetype library + topology QA (z-flicker +
  reachability). Owns the new generator; consumes `composition.ts` unchanged. *(§4)*

**Priority 2 — depth + breadth on the proven systems:**
- **D. Wardrobe-depth agent** — deepen garment kit per layer + the outfit-coherence
  engine + pattern/trim system + the wardrobe QA. Owns the garment draw recipes in
  `characterArt.ts` + the `WardrobeTheme` vocabulary. *(§2)*
- **E. Scene/Theme-library agent** — generalize Antigua↔Tokyo into a Theme-bundle
  authoring kit + a library of new eras/places (≥4 new Themes) + per-Track Theme
  bias. Owns `content/scenes/*` + Theme bundles + the Scene QA. *(§4)*
- **F. Quest-generator agent** — quest archetype templates + the quest generator +
  localized beat-line template libraries + per-Track arc generation + validity gate.
  Owns the quest templates + generator; integrates the existing QuestEngine. *(§5)*

**Priority 3 — personality + new play:**
- **G. Persona-mood agent** — per-Theme archetype catalogues + the dynamic Mood
  layer (mood→face-emotion + prompt colour) + persona QA. Owns `personaGen.ts`
  archetype data + the mood layer. *(§6)*
- **H. New-ChallengeTools agent** — the 8 tier-(A) tools (§7.A); owns new entries
  in `tools/*` + registry + pretexts. *(§7)*
- **I. WorldExperience-seam agent** — the new `WorldExperience` seam + registry +
  the 5 tier-(B) experiences (§7.B), quest-targetable by id. Owns `src/experiences/*`.
  *(§7)*

**Priority 4 — pipeline scale-out (parallelizable, longer horizon):**
- **J. Spark-asset-kit agent** — execute `SPARK_ASSETS.md`: the 3D bubble-person
  part kit + building/prop GLB kits + the deterministic batch worker + the
  `assets-manifest.json`, all keyed to the SAME `CharacterSpec`/`BuildingKind`/
  prop ids the procedural kits use, so they swap in behind `CharacterLook`/
  `WorldLook` with no caller change. *(§1,§2,§3,§4 pipelines)*

**Shared discipline for every agent:** seed-deterministic generators; curated
weighted bags (§0.3); a contact-sheet QA + human sign-off (§8); localize every
authored string; data/CDN-driven vocabulary; never touch a render/game seam;
report a contact sheet, the variety math, and the QA result.

---

## 10. Exec summary

| Facet | Current state | Scale strategy |
|---|---|---|
| **Faces** | Procedural, ~8 wholesome expressions × brow/cheeks/beard; murderous-mob fix baked in; warmth bar met, variety thin | Richer parametric kit (eye/nose/face-shape/age + freckles…) → ~tens of millions/Theme; **transient emotion channel tied to mood beats**; symmetry/uncanny clamps |
| **Wardrobe** | Strong layered paper-doll (`CharacterSpec`), millions of combos, clean 3D seam; garment *silhouette* repertoire thin | Deepen garment kit per layer + an **outfit-coherence engine** (palette schemes) → billions of *intentional* outfits; 3D bubble-people behind `CharacterLook`/Spark, same slot ids |
| **Item art** | First-class `Item` model + 39-item catalog, but **art is emoji/placeholder** | Procedural `itemArt` icon renderer (~50 families × finish × rarity frame) → thousands of premium icons; currencies/badges share it; no-placeholder lint |
| **Maps/Scenes** | Reskin spine proven (Antigua↔Tokyo over 1 topology); strong zoning planner; only **2 hand-authored topologies** | **Parameterized topology generator** (~10 archetypes, typed anchors) → unbounded maps; **Theme-bundle library** of new eras/places; per-Track era bias |
| **Quests** | Engine + cohesion model designed; only **2 quests** for 2,450 Tracks | **Quest archetype templates × content-slots** → unbounded; authored beats stay authored (cohesion); per-Track arcs on a CEFR curve |
| **Personas** | Excellent: 16 archetypes × demeanor × name × quirk/hook; every wanderer talkable | **Per-Theme archetype catalogues** + a **dynamic Mood layer** (mood→face-emotion + prompt colour) → millions/Theme, endlessly distinct, small-model-safe |
| **Experiences** | 20 premium but same-archetype centered drills | **8 new ChallengeTools** (haggle/sing/directions/…) + a **new WorldExperience seam** (market run, navigation, festival, role-play, hunt) — diegetic play that multiplies every other facet's variety |

**New-experience archetypes:** tier-A tools (price-haggle, describe-it,
directions-listen, sing-along, menu-order, count-the-coins, emote-match,
story-sequence) on the existing seam; tier-B WorldExperiences (market run, town
navigation/scavenger, festival/performance, role-play scene, photo/sketch hunt) on
a new diegetic `WorldExperience` seam, quest-targetable by id.

**Sub-facet agent fan-out (priority order):** A Face-kit · B Item-art ·
C Topology-generator → D Wardrobe-depth · E Scene/Theme-library · F Quest-generator
→ G Persona-mood · H New-ChallengeTools · I WorldExperience-seam → J Spark-asset-kit.
Disjoint file ownership; none touches a render/game seam.

**The quality bar (non-negotiable):** every facet is seed-deterministic from
**curated, weighted, constrained bags** (variety is art-directed, not random);
proven premium by an **automated contact-sheet QA + a human sign-off** (never
self-certified); 60fps on a phone; localized in ~50 langs; single-language-stack
safe; quota-safe (generated content is derived, not stored); **no placeholders, no
Duolingo dark patterns** — scaled in every direction toward thousands of tasteful,
distinct instances.

---

## 11. Minigame Content Resolution — drawing the FULL corpus, bound to NPC × quest × level

**The problem this closes (the corpus was wasted).** The challenge launch used to
pass ONLY the quest step's pinned `entryIds` (a tiny fixed set) or, lacking those,
a fully RANDOM draw. So a café host and a dock keeper drilled the same six generic
phrases and the ~10k-phrase-per-language corpus's richness never showed. The
binding felt disconnected + repetitive.

**The fix — a clean content-resolution layer** (`src/quest/minigameContent.ts`,
`resolveMinigameContent(npc, quest, step)`) that blends THREE relevance axes into
one filter the minigames draw their variety from:

1. **Relevant to the NPC** — each persona `archetype` (from `personaGen.ts`) maps
   to a set of **real corpus domain codes** via `ARCHETYPE_DOMAIN_AFFINITY`. The
   13 real codes (mirroring `dja/cor/fixtures/domains.json`) are `everyday, travel,
   business, health, education, social, housing, environment, emergency, civic,
   numbers, technology, culture`. Examples:
   - `baker → everyday, numbers, social` (food + prices)
   - `fishmonger / water-seller → everyday, numbers, …`
   - `sailor / dockhand / smuggler → travel …`
   - `merchant → business, numbers, travel`
   - `scribe → business, civic, education` (paperwork)
   - `friar / elder → social, culture …`; `herbalist → health, environment …`
   - `musician → culture, social …`; `child → everyday, education …`
2. **Relevant to the quest** — the quest's `promptProgram.contentSelector`
   (`domains`/`levels`/`languageCodes`) + the step's authored `entryIds`. The quest
   theme leads the domain blend; the NPC's trade is unioned on for relevant variety.
   *(Quest files may carry friendly labels like `food`/`market`/`shopping` that are
   NOT corpus domains — those are intersected away, and the NPC's archetype domains
   supply the matching real-corpus theme.)*
3. **Scaled to the player** — the quest's CEFR `levels` (the author scales these
   per quest; a beginner quest pins `A1/A2`). That is the player-level signal the
   data already carries; it's threaded straight through as the difficulty filter.

**Variety without losing cohesion.** The step's authored `entryIds` stay pinned as
a small **CORE** (the game still drills the exact quest vocab), and the rest of each
round is filled from the THEMED + LEVEL-SCALED draw — which returns DIFFERENT
matching rows across repeat plays. On-topic AND bottomless, never the same six.

**Data flow end-to-end.**
```
game.ts onIntent(callTool)
  → resolveMinigameContent(role, quest, currentStep)        # NPC archetype ∪ quest theme + levels
  → ChallengeContext { entryIds: core, domains, levels, languageCodes }
  → tool.buildSpec → baseSpec stashes the filter in ChallengeSpec.params.contentFilter
  → tool.run → randomEntries(host, spec, n)                 # the one shared draw seam
  → host.getRandomEntries({ count, domains, levels, languageCodes })
  → (real)  CorpanChallengeHostApi → corpan-app hostApi.getRandomEntries(options form)
            → invoke("get_random_entries_with_translations", { levels, domains, languageCodes })
            → SQLite INNER JOIN cor_entry_domains, with a relaxation ladder
              (drop levels → drop domains → all) so a strict filter never starves
     (mock) in-memory domain/level filter with the SAME relaxation
```

**Fallback / degradation (core loop never dead-ends).**
- A host with NO batch sampler → repeated single `getRandomEntry()` draws (filter
  ignored, content still flows).
- A host that predates the options form → ignores the extra keys, samples by count.
- A strict filter that would starve → the command's relaxation ladder (and the
  mock's mirror of it) relaxes to a broader/unfiltered pool rather than returning
  empty.
- A hand-authored special role with no `archetype`, or an unknown archetype →
  `npcDomains` returns `[]`, and the quest's own domains carry the theme.

**Single-language-stack safe.** `languageCodes` is the TARGET code(s) the quest
pins — never a SECOND/native gate. A one-language immersion stack resolves content
exactly the same way (cross-language tools are separately excluded upstream).

**Tests:** `src/quest/minigameContent.test.ts` (archetype→domain map covers every
archetype + only-real-codes; the NPC×quest×level blend, de-dup, fallbacks) and
`src/challenges/contentFilter.test.ts` (the filter round-trips through the spec; the
real adapter forwards it / degrades; the mock filters + relaxes + varies).
