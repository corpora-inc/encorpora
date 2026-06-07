# Corpan City — Premium Foundations

The full articulation. Every symptom the owner reports is treated as the visible
tip of a **foundation** that gets a complete, first-principles, premium pass — never
a patch. This document is the brief the agent waves are aimed at.

> **Operating principle.** Owner reacts freely → orchestrator distills each reaction
> into the foundation it implicates → agents redesign that foundation premium,
> end-to-end. The only thing that interrupts a wave is a genuinely broken build.

---

## 0. The end-state (north star)

A living 2.5D paper-cutout town you can lose yourself in. You arrive, get a safe
playful identity and a hand-built avatar, and step into a warm, breathing colonial
city — streets, shops with doors you can enter, characters with real personalities
powered by an on-device LLM, each themed to *your* learning journey. You earn your
way into cosmetics, follow quests that take you "from Marietta to Guadalajara," and —
the magic — you run into a **real human from anywhere on Earth**, and your two devices
quietly turn that encounter into a **translated language lesson neither of you could
have had alone**. Safe for a seven-year-old. Beautiful enough to screenshot. Deep
enough to play for a year.

### What "premium / best-in-the-world" means here (the bar)
- **60 fps on a phone**, always. Frame budget is sacred.
- **Nothing looks like a programmer placeholder.** Every pixel is art-directed.
- **No repetition the eye can catch.** Characters, props, buildings, names — all
  varied by data + seed.
- **No visual glitches**, ever — no z-fighting, no floating, no clipping, no shadow
  that doesn't belong to its owner.
- **Every interaction feels juicy** and is reachable by thumb, on phone/tablet/desktop.
- **It never breaks the host app.** Clean lifecycle, clean storage, clean memory.

---

## 1. Rendering & Visual Foundation
*Surfaced by: wobbling shadows, z-fighting, decorations clipping behind walls,
billboard-vs-wall sweep.*

These are all symptoms of an **ad-hoc 2.5D pipeline**. The premium pass designs the
pipeline once, coherently.

**First principles**
- A **scene-graph contract**: ground (group 0) → world solids/buildings (0) →
  grounded cutouts (0, depth-sorted) → contact shadows (a dedicated technique) →
  fixed décor vs billboarded characters (explicit) → atmosphere (sky/fog) →
  screen-space overlays (vignette, UI) in strict render order. No more incidental
  `renderingGroupId`/`alphaIndex` collisions.
- **Grounded characters**: a character's feet are the anchor; the body is a cutout
  that hops/animates *without* moving its contact point; the shadow is *owned by the
  contact point* and never drifts. Evaluate three shadow techniques and pick the
  best-looking that holds 60fps: (a) soft blob texture that scales/fades with hop
  height, (b) a real shadow-only light + shadow map for hero cutouts, (c) a baked
  gradient decal. Likely (a) done right + (b) for the player/near NPCs.
- **Billboard discipline**: characters yaw-billboard; décor is fixed-oriented; large
  set-pieces are true 3D. Codified, not per-call guesswork.
- **Depth & occlusion**: cutouts depth-write correctly; soft alpha edges resolve
  cleanly against solids; a small camera-facing bias prevents coplanar fights by
  construction, not by nudging.
- **Lighting model**: one art-directed rig (key/fill/rim) tuned per scene/era/hour,
  consistent across buildings, cutouts, ground.

**Spec / workstream:** `src/render/` — a `Stage` module owning engine+camera+render
order+shadow system+lighting, replacing the current scattered engine/atmosphere/
billboard concerns with one coherent foundation. `cutout.ts` (the grounded cutout
primitive: contact point, animation channels, owned shadow, billboard mode).
**Acceptance:** a 30-character street at 60fps phone, zero z-fight at any camera
angle, every shadow welded to its owner through hops and movement.

---

## 2. Character & Identity System
*Surfaced by: "color characters by quest, never repetitive."*

Symptom of **fixed per-role art**. The premium pass builds a real character system.

**First principles**
- A **`CharacterSpec`** (data): body type, skin tone, hair style+color, face,
  clothing layers (top/bottom/outer/hat/accessory), each with palette slots, plus
  props (apron, satchel, tools). Rendered by composing layered paper-doll sprites
  (procedural now, Spark-generated atlases later — same ids).
- **Infinite, never-repetitive variation**: a deterministic generator maps
  `(role, seed)` → a unique `CharacterSpec`. No two bakers identical.
- **Quest/scene/culture theming**: the active Quest + Scene supply a **palette &
  wardrobe theme** (Antigua-1770 colonial vs Tokyo-2050 neon), so characters are
  dressed *for the world and the learner's journey*.
- **Unifies everything**: the player avatar (onboarding dress-up), NPCs, cosmetic
  unlocks, and the `AvatarSpec` contract are ONE system. Cosmetics you unlock are the
  same layers NPCs wear.
- **Animation**: cutout animation channels — idle breathe, walk bob (grounded),
  turn, talk (mouth/gesture), emote — driven by state, cheap, lovable.

**Spec / workstream:** `src/character/` — `characterSpec.ts` (schema, extends the
`AvatarSpec` contract), `characterGen.ts` (seeded infinite variety + quest/scene
theming), `characterArt.ts` (layered paper-doll renderer, replaces fixed
`cutoutArt` characters), `animator.ts` (channels). Wire NPC roles + player to it.
**Acceptance:** a plaza of 20 NPCs, all visibly distinct, all dressed for the era;
the player's dressed avatar IS their in-world character; swap the Scene's theme →
the whole population re-themes.

---

## 3. World & Level System
*Surfaced by: "much bigger, fantastic, doors and things," invisible buildings.*

**First principles**
- The **grand procedural town** (done: 80×80, streets, plaza, 28 buildings, doors) is
  the floor, not the ceiling. Premium buildings (varied architecture, doors,
  windows, signs) + dense set-dressing (done) + roads + lighting compose a believable
  city.
- **Enterable doors → interiors**: `portal` anchors lead into small interior scenes
  (shop, café, inn) — the "doors and things." A portal/interior system (load a tiny
  interior topology+scene on enter, return on exit).
- **Districts & landmarks**: market, residential, civic, waterfront — each with
  character; landmarks for orientation.
- **Data-driven reskin** is sacred: the same topology renders as Antigua-1770 or
  Tokyo-2050 by swapping the Scene — proven, and the engine for infinite worlds.
- **EVERY townsperson is a real character.** No "silent extras" that only say
  "hola." Each wanderer gets a GENERATED persona (archetype + demeanor + voice +
  backstory hook + which challenges they like), so engaging ANY of them opens a
  real Qwen3 conversation (scripted fallback if no model) that can flavor-talk,
  contrive a challenge, drop a quest clue, or trade. Personas are generated like
  their faces/clothes — not hand-authored one by one.
- **NPC agency (decoupled from anchors)**: people are NOT pinned to stalls/anchors.
  They are **autonomous agents that wander the streets aimlessly**, pathing around
  buildings, with idle/walk/talk states — and they **stop only when you approach**
  (proximity), turning to greet you. Stalls/anchors are where they *tend*, not where
  they're glued. This is the right model; pinned NPCs are wrong.
- **Living world**: day/night/golden-hour, crowd life, ambient audio, weather later.

**Spec / workstream:** integrate map+buildings+dressing+roads (Wave 1); then
`src/world/portals.ts` (enterable interiors), `src/world/life.ts` (ambient
crowd/wander), district metadata in the generator, a day/night cycle in the Stage.
**Acceptance:** walk a town that feels lived-in, enter a shop through its door, exit,
and never see a seam.

---

## 4. Game Lifecycle & Shell
*Surfaced by: "I need to exit the pack / test a fresh load."*

Symptom of a **missing app shell**. The premium pass builds the whole frame.

**First principles**
- **Lifecycle**: boot → onboarding (first run) → world → pause → exit, all clean.
  Exit = ESC/back → a dignified "Leave the Plaza?" confirm → returns to the host
  (`corpan:host-dispose` / the host's back affordance), tearing down GL + audio +
  model cleanly.
- **Pause** halts simulation + frees the model; **resume** restores.
- **Save/restore**: identity, avatar, progress, position, quest state — a clean
  persistence layer (see §7), survives fresh loads; a "reset" for QA.
- **Overlays NEVER affect layout, EVER**: a panel must mount out-of-flow
  (`position:fixed`) from its first frame so it can't push the scene; open/close is
  **compositor-only** (transform/opacity), never width/height/flow; inputs focus with
  `preventScroll` so WebKit never scroll-jumps. (Diagnosed defect: the chat panel
  enters document flow, shoves the canvas up, then snaps back when it goes absolute —
  this whole class is banned by construction.) Engaging an NPC is **premium-smooth,
  guaranteed**, and proven by a no-layout-shift test.
- **Menu/HUD system**: a coherent in-world menu (settings, map, quests, inventory,
  exit), not scattered overlays.
- **Host integration**: respond to host lifecycle/visibility/memory events; behave as
  a first-class Corpán pack.

**Spec / workstream:** `src/shell/` — `lifecycle.ts`, `pauseMenu.ts`, `confirm.ts`
(reusing the project's `pmConfirm` pattern — never `window.confirm`), `exit.ts`
(host handshake). **Acceptance:** ESC → confirm → land back in the host; relaunch
restores exactly where you were; pause frees the LLM.

---

## 5. On-Device AI & Conversation
*Foundation behind the NPC magic; model-memory strategy already decided.*

**First principles**
- **Native STT + resident Qwen3, concurrent, no juggling** (decided in
  `MODEL_STRATEGY.md`). Build the small `tauri-plugin-native-stt`; keyboard fallback
  for unsupported locales; Whisper only ever with the LLM unloaded.
- **The voice loop**: speak → native transcript → Qwen3 (in-character, quest-themed)
  → streamed reply + TTS, all while the model stays warm.
- **NPC depth**: persona × scene-skin × quest prompt-program (built); add limited
  memory, relationship state, and reliable JS-side tool-calls into challenges.
- **Robustness**: the model broker handles background/idle/memory-pressure unloads
  gracefully; conversations degrade to scripted fallback, never crash.

**Spec / workstream:** `plugins/tauri-plugin-native-stt` (new), `src/npc/voiceInput`
real backend, broker hardening, NPC memory. **Acceptance:** hold a spoken Spanish
conversation with the baker on-device with no keyboard, no stutter, no OOM.

---

## 6. Core Gameplay Loop — immersive RPG interactions
*The depth that makes it a game, not a tech demo. The NPC interaction must feel like a
traditional RPG encounter, NOT a chatbot on an insurance site.*

**The encounter, reimagined**
- **Immersive, centered, RPG-framed**: engaging an NPC is a deliberate, beautiful
  centered overlay (optionally a camera push toward a near/first-person framing of the
  character), not a corner chat bubble. Gold, XP, items, and clues are visibly at
  stake. It feels like talking to a character in a great RPG.
- **NPCs contrive reasons to play**: the AI NPC, in character, *invents a pretext* for a
  micro-challenge — "my market words got all scrambled, can you put them right?",
  "I've lost my spectacles, will you read this sign for me?" (→ on-device STT),
  "name three things on my cart before the bell rings" — then rewards you. The pretext
  is generated/leaned by the prompt-program; the challenge is a typed `ChallengeSpec`.

**Micro-challenge library (the headline)**
- Go from 2-3 heavyweight packs (Parlometron/pronunciation-coach, Juice Squeeze, and
  references hover-runner/hanzipan) to **~20+ LIGHTWEIGHT, fun, embeddable language
  exercises** — each a quick, juicy, centered mini-overlay returning a `ChallengeResult`.
  Examples: word-scramble/unscramble, read-aloud (STT), listen-and-choose, picture↔word
  match, fast-translate, fill-the-blank, build-the-sentence (Juice-style), tone/accent
  match, number/price drill, odd-one-out, memory-pairs, "say it back" repeat, dialogue
  fill-in, category sort, spot-the-typo, conjugation tap, rhyme/sound match, count-down
  recall, true/false comprehension. All compose the corpus + TTS + STT.
- Each challenge: a clean `ChallengeTool` (contracts already define `ChallengeSpec` /
  `ChallengeResult` / `ChallengeToolId` — extend the id enum), a premium centered
  overlay, normalized `score`, and **rewards: XP + coins + items**.
- **Reusable for real-player duels later**: two humans face each other and play the same
  challenge through menus + AI (no UGC) — the same tools power PvP.

**Items, inventory & economy (develop "Item" as first-class)**
- **Item** becomes a real model: id, name, art (cutout), kind (cosmetic / consumable /
  quest / trade-good), rarity, value. **Inventory** the player carries.
- **Quest-relevance is the spice**: an item is precious for one quest and useless for
  another (a "ferry token" matters on the Guadalajara route, junk elsewhere) — creating
  reasons to **earn, trade, buy, sell**.
- **Commerce with NPCs**: buy/sell/trade at shops and with characters; coins flow.
- **Player-to-player trade (AI-mediated)**: real players trade items through menus +
  AI mediation (never raw UGC) — "hot stuff," and safe by construction.
- **Cosmetics** remain the marquee reward and feed the character system §2.

**Clues & quest progression**
- Quests carry **clues + required items** in static data — and/or the AI NPCs are
  **leaned** (via the prompt-program) to *reveal the piece you need* in character, so
  progress feels discovered, not handed over. Completing challenges yields the clue/item
  that advances the quest → level → curriculum.
- No pay-to-win; rewards are signed offline + reconciled server-side later.

**Spec / workstream:** `src/challenges/` (the ChallengeTool framework + the ~20 tools +
the centered RPG challenge overlay), `content/challenges/`; `src/items/` + `src/economy/`
(Item model, inventory, shop/trade, rewards) + `content/items/`; `src/quest/` engine +
clue/item wiring; NpcRoles + Quests for the grand map's stations; first-person/encounter
camera mode in the Stage §1. **Acceptance:** an NPC contrives a scramble challenge, you
solve it in a gorgeous centered overlay, earn coins + a "ferry token", the token unlocks
the next quest step at the docks, and a hat you bought with coins is on your avatar.

---

## 7. App Health, Storage & Performance
*Surfaced by: `QuotaExceededError` in `phrasePackCatalog`.*

Symptom of **localStorage over-use across the shared origin**. The premium pass fixes
storage architecture app-wide and sets a perf budget for the big world.

**First principles**
- **Storage tiers**: localStorage only for tiny settings/flags; **IndexedDB** for
  catalogs/caches/large pack data; quota-aware writes with eviction; never throw an
  unhandled `QuotaExceededError`. Fix `phrasePackCatalog` + audit all pack storage
  (shared ~5MB budget is the constraint — Corpan City must be a good citizen).
- **Perf budget**: draw-call, mesh, texture, and memory budgets for the grand world;
  thin-instancing (dressing already does), frozen matrices, atlasing; profile on
  device; lean tiers for phones.
- **Resilience**: visible error logging (never silent), graceful degradation, no
  crashes under memory pressure.

**Spec / workstream:** an app-health pass on `corpan-app/src/contentPacks/`
(storage layer → IndexedDB + quota-safe), a World-Plaza storage module, a perf-HUD
budget gate in CI/dev. **Acceptance:** no quota errors anywhere; the grand world holds
60fps + within memory on a mid phone.

---

## 8. Realtime Presence & AI-Mediated Chat
*The north-star magic; architected in the master plan.*

**First principles**
- **Colyseus** authoritative rooms; real players visible and synced; **per-player
  divergent Scenes** over one shared collision space (you see Antigua, they see Tokyo).
- **AI-mediated translated chat**: never raw UGC — each device cleans → translates →
  "lessonifies" into a typed artifact; the server moderates/routes; the recipient sees
  a lesson framed by *their* quest. Safe by construction.
- **Matchmaking/room-directory**: occupancy bands, cohort rotation, smart onboarding
  into the best room.

**Spec / workstream:** `server/` (Colyseus + Fastify, co-located, shared contracts),
`src/net/` client presence, mediated-chat pipeline, moderation. **Acceptance:** two
devices, two scenes, one square; a Spanglish↔French exchange becomes two lessons.

---

## 9. Safety & Compliance
*Architectural, not bolted on.*

Fixed identity, fixed avatars (curated), no raw UGC, LLM-mediated everything,
report/block, age-tier flags, audit log, kill switch. Yields a clean App-Store story.
**Acceptance:** a reviewer-ready safety doc; a 7-year-old's session is safe by design.

---

## Wave sequencing

Each wave = coordinated agents, **disjoint file ownership**, dispatched *between*
rounds (never mid-agent), then one integration + holistic review.

- **Wave 1 — Assemble the real world** *(ready as soon as buildings lands).* Integrate
  grand map + premium buildings + dressing + roads + NpcRoles into one coherent town.
  Screenshot the whole thing. *This is what we review against — the real article.*
- **Wave 2 — Visual & Character foundations** *(the biggest visual leap).*
  §1 Rendering/Stage + §2 Character/Identity, together (they're coupled). Kills the
  shadow/z-fight/repetition class of problems at the root and makes the town gorgeous.
- **Wave 3 — Shell & App Health.** §4 lifecycle/exit/pause/save + §7 storage/perf.
  Makes it a real app you can live in and that keeps the whole Corpán app healthy.
- **Wave 4 — Gameplay depth.** §6 quests/challenges/economy + §5 voice/AI depth.
  Makes it a *game* you learn from.
- **Wave 5 — Presence & mediated chat.** §8 the multiplayer magic + §9 safety.
  The north star.

Worlds, eras, language-pairs, and cosmetics then scale on these foundations forever.

---

## The deal
Owner QAs and reacts freely; orchestrator distills every reaction into the foundation
above and aims the next wave at it; agents build systems, not patches; screenshots of
the real world flow back regularly. We are building the cathedral, district by
district — premium in every detail.
