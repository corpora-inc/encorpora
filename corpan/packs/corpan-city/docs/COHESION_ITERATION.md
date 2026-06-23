# Corpan City — Cohesion Iteration

**Status:** Design + sequenced plan. NO code in this doc — it is the spec the
implementation fans out from. Milestone 0 (Menu + Exit) is the highest priority
and ships first.

**Author intent in one line:** the owner currently *cannot exit the pack* in the
real embedded Corpán app, and the pieces (NPC chat, challenges, economy,
Room×Scene×Quest spine) work but feel *disconnected*. This iteration (a) fixes
exit with a single in-overlay MENU, and (b) makes the **Quest the connective
tissue** so the player always knows *what their quest is, how the NPC and the
challenge relate to it, and how to reach the next level*.

The guiding constraint for cohesion: **the small model (Qwen3-4B) does NOT carry
the quest.** A deterministic authored scaffold carries it; the model is only a
*voice + translator* that re-speaks authored beats in character + target
language. Cohesion is **data binding, not model reasoning.**

---

## 1. Current Behavior (precise, file/function level — do NOT regress)

This section is the baseline. The owner says current dialogue is "close to
acceptable," so the prompt + runtime must be *extended*, never rewritten.

### 1.1 Orchestration — `src/game.ts`
- `startGame(container, host?)` → onboarding (or saved identity) → `buildWorld(...)`.
- `buildWorld` parses content against contracts (`RoomTopology`, `Scene`,
  `NpcRole[]`, `Quest`) — fails loud. Single hard-coded quest: `content/quests/es-cafe.json` (`es-cafe-travel`).
- DOM tree built once: `rootEl(.wp-root)` → `canvas(.wp-canvas)`,
  `vignette(.wp-vignette)`, **`overlay(.wp-overlay)`**. Everything UI mounts into
  `overlay`: `.wp-title`, `.wp-hint`, `.wp-coinhud`, toasts, joysticks, NPC
  dialogue, challenge overlay.
- World systems: `createWorldEngine`, `applyAtmosphere`, `createVista`,
  `renderScene`, `buildPlazaObstacleField`, `createPlayerController`,
  `createCameraFade`, `createCrowd({count:28, roles, scene})`. Every crowd agent
  gets a generated persona and is talkable.
- **NPC engagement:** `createNpcFocus(...)` locks onto the nearest wandering
  agent; on engage it `crowd.setHeld(engagedId)`, `setWorldActive(false)`, and
  opens `npcRuntime.open({ npcRole, scene, quest, learnerPair, container: overlay, onIntent, onClose })`.
- **`onIntent` (game.ts):** only handles `intent.kind === "callTool"`. Builds a
  `ChallengeContext { language, nativeLanguage, mode:"solo" }` (note: **no
  `entryIds`**), runs `runChallenge(intent.tool, ctx, chHost, { container: overlay, npc, partialSpec })`,
  then `inventory().applyReward(res.rewards)` + a toast. **`reward`,
  `questStep`, and `end` intents are dropped here** (the runtime handles `end`
  UI-side; `questStep`/`reward` only render a note in the dialogue log).
- **Coins/XP HUD:** `.wp-coinhud` top-right, live from `inventory().subscribe`.
- **Scene flip:** `createSceneSwitcher` (T key) re-skins the SAME topology
  Antigua⇄Tokyo. Gameplay untouched — the spine, live.
- **Shell wiring:** `createShell({ accent, isDialogueOpen, closeDialogue, onPause, onResume, onStandaloneExit })`. `onKey` routes ESC through `shell.handleKey(e)` first.
- **Teardown** (`teardown()`): removes listeners, disposes everything, `rootEl.remove()`.

### 1.2 Shell (the FAILING exit) — `src/shell/*`
- `createShell` (shell.ts) composes `createPauseOverlay` (pause.ts) +
  `createMenuButton` (menuButton.ts) + `confirmAndExit` (exit.ts) + `wpConfirm`
  (confirm.ts) + save seam (save.ts).
- **`pause.ts`** mounts its root on **`document.body`** at `z-index: var(--wp-z-pause, 2147483640)`.
- **`menuButton.ts`** mounts its button on **`document.body`** at `z 2147483600`, top-left, and `hide()`s itself while the pause modal is open.
- **`exit.ts`** — the handshake is verified + correct: `requestHostExit()`
  dispatches `window` CustomEvent `corpan:exit`; Corpán `App.tsx` listens →
  `setActiveGame(null)` → unmounts `ContentPackHost` → `game.dispose()`.
  `isEmbeddedInHost()` reads `globalThis.__corpanHostActive`. Standalone falls
  back to `onStandaloneExit` (`teardown()`). **This mechanism is sound — keep it.**

### 1.3 Why exit FAILS in the embedded app (root cause — do not repeat)
`src/styles.css` documents two stacking BANDS. Band A = children of
`.wp-overlay` (`position:absolute; z-index:10` → a **stacking context**).
Band B = shell modals mounted on **`document.body`** at near-int32-max z.

The theory behind Band B (huge z escapes everything) is **wrong under
embedding.** `z-index` only orders siblings *within the same stacking context*.
When Corpán mounts the pack, `ContentPackHost`'s container almost certainly
establishes its own stacking context and/or clips with `overflow`/`transform`/
`contain`. A `document.body`-appended `position:fixed` element is then laid out
**relative to / clipped by that host container**, not the visual viewport — so
the z=2.1-billion pause overlay paints *inside the host's clip region*,
effectively invisible. The HUD, NPC dialogue, and challenge overlays all render
fine **because they live inside `.wp-overlay`**, which is the host's accepted
render surface. Symptom matches exactly: ESC toggles the menu button's
visibility (the pause IS opening — menuButton.hide() runs), but the pause card
never appears. **This is the "verify the REAL app, not standalone" trap: a
body-appended fixed modal works in standalone (body == viewport) and is clipped
when embedded.**

**The fix is structural, not a bigger z-index:** render the menu **inside
`.wp-overlay`** — the surface the host already paints — at the TOP of Band A.

### 1.4 Quest plumbing that EXISTS but is NOT wired
- **`contracts/src/quest.ts`** defines `Quest`, `QuestStep { id, label, anchorId?, toolId?, done? }`, `QuestObjective`, `QuestPromptProgram`, `QuestRewards`, and **`QuestState { questId, playerId, stepDone: Record<string,boolean>, xp, complete }`** — *the runtime type exists but is instantiated NOWHERE.*
- **`contracts/src/curriculum.ts`** — `LearningPath`, `LevelSpec { id, index, sceneId, questIds[], completion }`, `LevelState`. Not used at runtime.
- **`src/economy/questItems.ts`** — RICH and ready: `QUEST_ITEM_RULES` (per-quest `requirements[{stepId,itemId,clue,sourceAnchorId}]`, `relevantTags`, `junkTags`), and helpers `requiredForStep`, `hasNeeded`, `missingFor`, `relevance`, `cluesFor(store,questId,stepId)`, `sourceHints`, `safeToSell`.
- **`promptProgram.ts` `ComposeArgs.clues`** EXISTS and `cluesLeanSection` is written — but **`composeSystemPrompt` is called WITHOUT `clues`** (npcRuntime.ts line ~417 omits it). **This is the single biggest missing link.**
- **`NpcIntent` has `questStep`** (`{ kind:"questStep", stepId }`) and `reward`. The runtime renders them as a note; **nothing advances a QuestState** because there is no QuestState.
- **`QuestStep.toolId` and `ChallengeSpec.entryIds` + `ChallengeContext.entryIds`** all exist. `game.ts` builds a `ChallengeContext` **without `entryIds`** → the challenge picks generic vocab, unrelated to the quest step.
- **`src/net/netClient.ts`** — full Colyseus presence client (movement broadcast + remote avatars). **Not instantiated in `game.ts`.** Server in `server/`.
- **`src/economy/shop.ts`** — full buy/sell/trade overlay (`openShop` / `openMerchant`), quest-relevance badges, `LocalTradeTransport`. **Not opened from `game.ts`.**
- **No "special NPC" concept** — every crowd agent is a generic talkable persona; none are quest-bound.
- **No minimap / map / inventory surface / quest-tracker HUD.**

---

## 2. Menu + Exit (MILESTONE 0 — build FIRST)

### 2.1 Principle
ONE always-reachable MENU surface, rendered **inside `.wp-overlay`** (Band A,
top of the in-world tier), hosting **Resume · Map · Inventory · Quest · Leave
the Plaza**. Exit ≤ 2 taps from anywhere. Never a `document.body`-appended modal.

### 2.2 DOM structure + mount point
A new module `src/shell/menuPanel.ts` builds a single full-screen panel and
**appends it to the same `overlay` element game.ts passes in** (not `document.body`):

```
overlay (.wp-overlay, z:10, the host-painted surface)
└── .wp-menu (position:absolute; inset:0; z-index: var(--wp-z-menu, 70))   ← NEW, top of Band A
    ├── .wp-menu-scrim                 (tap to resume)
    └── .wp-menu-panel  role=dialog aria-modal
        ├── .wp-menu-head   (title "Plaza" · close ✕ → resume)
        ├── .wp-menu-tabs   (Map · Inventory · Quest)        ← section switch
        ├── .wp-menu-body   (the active section renders here)
        └── .wp-menu-foot
            ├── .wp-menu-resume   (primary, accent)
            └── .wp-menu-leave    (quiet, destructive → confirm → exit)
```

Add to `src/styles.css :root`: `--wp-z-menu: 70;` (above challenge/shop `60`,
still inside Band A). **Delete the Band-B `--wp-z-menu-button` / `--wp-z-pause`
reliance for the menu** (confirm stays as documented in 2.6).

`position:absolute; inset:0` (NOT `fixed`) so the panel fills `.wp-overlay`
exactly and inherits the host's accepted render surface — structurally immune to
the clip that killed the body-fixed modal.

### 2.3 The always-visible affordance (every platform)
A small dignified **menu button rendered INSIDE `.wp-overlay`** (repurpose
`menuButton.ts` to accept a mount parent = `overlay` instead of `document.body`;
keep its look). Top-left, safe-area aware, z just under `.wp-menu`. Because it
lives in Band A it cannot be clipped away like today's body-appended one.

- **Touch/tablet/desktop:** tap/click opens the menu. First-class on all.
- **Desktop:** ESC ALSO opens it (via the existing `shell.handleKey` ESC chain).
- Title/tooltip "Menu (Esc)". Auto-hide while the menu (or any blocking overlay) is open.

### 2.4 Repurpose the shell (replace the body-modal pause)
- **`pause.ts` is retired as a body modal.** Its *role* (halt sim + free LLM on
  open, restore on resume) moves into `menuPanel`'s open/close via the existing
  `onPause`/`onResume` hooks `createShell` already forwards from `game.ts`
  (`setWorldActive(false)` + `npcRuntime.onBackground()` on open; `setWorldActive(true)` on resume). No new game.ts hooks needed for the halt.
- **`createShell` is rewired** to construct `menuPanel` instead of `pauseOverlay`,
  keeping the SAME `Shell` interface (`handleKey`, `pause()`, `resume()`,
  `requestExit()`, `isPaused()`, `save()`, `dispose()`) so **game.ts wiring is
  nearly unchanged** — only the new section data getters are added (2.7).
- ESC chain in `shell.ts` is preserved verbatim (resume menu → swallow confirm →
  defer to blocking overlay → close dialogue → open menu).

### 2.5 Sections inside the menu (M0 = shells; filled by §3-5)
For M0, the four destinations must all be *reachable and non-broken*:
- **Resume** — close menu, restore sim. (M0 complete behavior.)
- **Leave the Plaza** — `confirmAndExit` → `corpan:exit` / standalone teardown. (M0 complete behavior — the actual fix.)
- **Map / Inventory / Quest** — M0 ships them as labeled sections with a graceful
  "coming soon" or a minimal read-only view; §2-5 fill them in. They must never
  dead-end or crash.

### 2.6 Exit wiring (unchanged mechanism, re-pathed)
`menuPanel`'s "Leave the Plaza" calls `confirmAndExit({ strings, onStandaloneExit })`
exactly as today. **Keep `confirm.ts` (`wpConfirm`)** — but the confirm should
ALSO mount inside `.wp-overlay` (same body-clip risk applies to it). Audit
`confirm.ts`: if it appends to `document.body`, change it to accept a mount
parent and pass `overlay`. The confirm's own capture-phase ESC stays.

### 2.7 game.ts wiring for M0 (orchestrator-owned)
- Pass `overlay` as the menu mount parent into `createShell` (new option
  `mountParent: HTMLElement`).
- Provide section data getters (filled progressively): `getQuestView()`,
  `getInventoryView()`, `getMapView()` — for M0 these can return minimal stubs.
- No change to the ESC `onKey` path, `onPause`/`onResume`, or `onStandaloneExit`.

### 2.8 VERIFICATION — CRITICAL, cannot self-certify on standalone
**The prior modal passed standalone and FAILED embedded. The implementer MUST
NOT mark M0 done from standalone alone.** Required verification:
1. Build pack dist, load in the **real Corpán app** (the vite `:1421` `/packs`
   middleware path — rebuild dist + reopen; corpan-app src HMRs but the PACK
   does not).
2. Confirm: menu button visible → tap → full menu panel visible (NOT clipped) →
   "Leave the Plaza" → confirm → pack actually unmounts (back to Corpán home).
3. Verify on **phone + tablet + desktop** (no-ESC touch path included).
4. Inspect embedded DOM: the `.wp-menu` node is a child of `.wp-overlay`, not
   `document.body`. The owner (or an embedded-DOM inspection) confirms before M0 is closed.
- **Anti-regression note for the implementer:** if the menu ever "doesn't show
  in the app but shows in standalone," you have re-introduced a body-append /
  fixed-to-viewport assumption. The cure is always "mount inside `.wp-overlay`,"
  never "raise the z-index."

---

## 3. Cohesion Design

The thesis: **Quest = connective tissue; deterministic scaffold carries it; the
model is a voice.** Below, every "how does X relate" question gets a concrete
in-game answer.

### 3.1 QuestState runtime (the missing engine) — `src/quest/questState.ts` (NEW)
Instantiate the already-defined `QuestState` contract and drive it
deterministically. A tiny store mirroring `inventory()`:

```
interface QuestEngine {
  state(): QuestState                       // { questId, playerId, stepDone, xp, complete }
  quest(): Quest                            // the active authored quest
  currentStep(): QuestStep | null           // first step with done !== true
  isStepSatisfied(stepId): boolean          // deterministic gate (see 3.3)
  advance(stepId): void                     // mark done, persist, emit, reward if final
  subscribe(fn): () => void
}
```
- Persist compactly (`wp:quest:v1` → `{ questId, stepDone, xp, complete }`),
  same quota-safe discipline as inventory. localStorage budget is tens of KB
  (MEMORY: shared 5MB budget) — this is < 1KB.
- **Step advance is DETERMINISTIC**, never model-driven. The model may *emit* a
  `questStep` intent, but the engine only honors it if `isStepSatisfied` agrees
  (the model can't skip a gate it doesn't control).

### 3.2 Quest presence — how a player gets + knows their quest
- **Onboarding hand-off:** the chosen quest is already loaded in game.ts. On
  first spawn, a **dignified one-card "Your journey" intro** (in-overlay, NOT a
  body modal) names the quest (`quest.title`), the narrative
  (`quest.narrative`, e.g. "Marietta, GA → Antigua"), and the first objective:
  "Find Serafina the café owner." Skippable; shown once (`wp:quest:intro:v1`).
- **Persistent quest-tracker HUD** — `src/quest/questTracker.ts` (NEW), mounted
  into `.wp-overlay` (Band A, under the menu), top-left under the menu button:
  - Line 1: quest title.
  - Line 2: **current step label** ("Order a coffee") + a "→ talk to Serafina"
    hint when the step has an `anchorId`/special NPC.
  - Line 3: compact progress (steps done / total) + "next level" affordance when complete.
  - Tapping it opens the menu's **Quest** section (full detail).
  - Subscribes to `QuestEngine` + `inventory()` so it updates live (e.g. when the
    required item is acquired, the hint flips from "find the ferry token" to
    "bring it to the boatman").
- **Quest section (menu)** — full step list with done/active/locked states,
  objective, rewards preview, and "where to go" (the special-NPC name + a "show
  on map" button → §4).

This answers **"Do I have a quest? What is it?"** at a glance (tracker) and in
depth (menu), always.

### 3.3 The clue → item → delivery chain (deterministic state machine)
This is the cohesion backbone and it already has its data in `questItems.ts`.

**Per step, the engine computes one of three states** (pure, from
`inventory()` + `QUEST_ITEM_RULES`):
1. **NEEDS-ITEM** — `missingFor(store, questId, stepId).length > 0`. The step's
   required item isn't held. → the special NPC speaks an **authored CLUE**
   (`cluesFor`) pointing at the source anchor. Tracker shows "find the X."
2. **READY-TO-DELIVER** — `hasNeeded(store, questId, stepId)` is true AND the
   step isn't done. → the special NPC **accepts the item** (consume), grants the
   step reward, marks the step done (`advance`), and speaks the **authored
   next-hint**. Tracker advances.
3. **DONE** — step already done → NPC speaks a brief authored acknowledgment;
   move to the next step.

**Worked example (`es-guadalajara-route`, already in `QUEST_ITEM_RULES`):**
- Step `docks` needs `ferry-token`. Player lacks it → boatman (special NPC at
  `docks`) drops the authored clue: *"No token, no crossing. Ask around the
  market — someone always has a spare."*
- Player gets `ferry-token` (from a market NPC / shop / challenge reward) →
  returns to boatman → **READY-TO-DELIVER**: token consumed, step `docks` done,
  authored next-hint spoken: *"…now, the city gate opens at dawn — you'll need a
  pass."* → step `gate` becomes active.
- The MODEL never invents any of this. It only *re-voices the authored line* in
  character + target language (§7).

**Where items come from:** challenge rewards (`ChallengeReward.items`), the shop
(`grant`), other NPCs (a market vendor hands a clue-located item via the same
"give" flow), or quest-step grants (`QuestRewards.grant`). All flow through
`inventory()` which the engine reads — so the chain "just works" regardless of source.

### 3.4 Challenge ↔ quest ↔ dialogue cohesion wiring (the exact binding)
The owner's question "how does the challenge relate to the quest / to what the
NPC says?" is answered by **binding the challenge's vocab to the current quest
step.**

The chain, end to end:
```
QuestEngine.currentStep()  →  step.toolId (the step's challenge kind)
        │                      + quest.promptProgram.contentSelector
        ▼
resolve entryIds for the step  ──►  src/quest/questContent.ts (NEW)
  (host corpus lookup by levels+domains+languageCodes, OR a step-level
   entryIds override authored on the step)
        │
        ▼
game.ts onIntent builds ChallengeContext { language, nativeLanguage, mode,
        domain: quest.domain, entryIds }      ← TODAY entryIds is MISSING
        │
        ▼
runChallenge(tool, ctx, …)  → drills EXACTLY the quest step's words
        │
        ▼
ChallengeResultPlus  → inventory().applyReward(res.rewards)
        │            → QuestEngine: if step.toolId matched & score≥threshold,
        ▼              and the step is a "challenge" step, mark satisfied
NPC speaks authored "well done + next beat"; tracker advances
```
**Concrete contract additions (small):**
- `QuestStep` gains optional `entryIds?: number[]` and `clueRef?` (already has
  `toolId`, `anchorId`). The step can pin exact corpus rows; else fall back to
  the quest's `contentSelector`.
- `game.ts` passes `domain` + `entryIds` into `ChallengeContext` (both already in
  the type — just unfilled today).

So: **"help me finish this letter" drills the letter's words**, because the
challenge `entryIds` come from the quest step. Cohesion = data binding.

### 3.5 Level completion → reset SAME room (single room for now)
- `QuestEngine` completes when the objective is met (`QuestObjective`). On
  completion: grant `quest.rewards`, mark `complete`, show a **dignified
  "Level complete" card** (in-overlay) with the next level's title.
- **Single room model (now):** "advance to next level" **re-skins the SAME
  topology** to the next `LevelSpec.sceneId` (reuse `createSceneSwitcher`'s
  rebuild path) and loads the next `Quest`. No new room until concurrency forces
  it. A thin `src/curriculum/path.ts` (NEW) reads a `LearningPath` JSON
  (`content/paths/*.json`) to know the level order; for MVP a 2-level path is enough.
- **At scale:** advancing Scene per player is exactly the spine already proven
  (Antigua⇄Tokyo). New *rooms* only appear when Colyseus concurrency needs them.

This answers **"How do I get to the next level?"** — finish the quest's steps
(tracker shows progress); the level-complete card hands you the next scene+quest.

---

## 4. Minimap + Premium Full-Screen Map — `src/map/*` (NEW)

### 4.1 Data sources (all already exist)
- **Topology** (`RoomTopology.bounds`, `anchors`, `blockers`) — static layout.
- **Player position** — `player.getPos()` (game.ts already has it each frame).
- **Real players** — `netClient.remotePositions()` (Colyseus presence; §5.4 wires it).
- **Special NPCs / POIs** — special-NPC anchors (§3.3 `sourceAnchorId` +
  step `anchorId`) and merchant anchors. `sourceHints(store, questId)` already
  returns the anchor ids for missing required items → **map markers for "where
  to find the X."**

### 4.2 Corner minimap — `src/map/minimap.ts`
- A small rounded canvas in a corner of `.wp-overlay` (Band A), opt-in placement
  that avoids HUD collisions (tracker top-left, coins top-right → minimap
  bottom-right, safe-area aware).
- Renders: bounds outline, blockers (faint), player dot (accent, facing arrow),
  remote players (distinct soft dots), special-NPC/quest markers (a gentle pulse
  on the *current* objective's anchor only — directs without nagging).
- A **quick fullscreen toggle** (tap the minimap) AND reachable from the **menu's
  Map section** (§2.5).
- Reads topology once; polls live positions each frame (cheap 2D draw).

### 4.3 Premium full-screen map — `src/map/fullMap.ts`
- Mounts into `.wp-overlay` at `--wp-z-menu`-adjacent (so it can open from the
  menu and over the world). Paper-cutout styling, on-brand.
- Same data, richer: labeled POIs (merchant names, special-NPC names), the quest
  objective highlighted with a soft "go here" marker, remote-player avatars with
  names, a legend. Pan/zoom optional (MVP: fit-to-bounds static).
- Honest about scope: MVP map is a **stylized schematic** (not a rendered
  mini-3D), which is premium *and* cheap. The 3D-look upgrade can come later
  behind the same `getMapView()` seam.

### 4.4 game.ts wiring (orchestrator)
- Construct minimap with `{ topology, getPlayerPos, getRemotePositions, getQuestMarkers }`.
- `getQuestMarkers()` = `sourceHints(...)` + `currentStep().anchorId` resolved to anchor coords.
- Tick minimap in the frame loop (cheap). Menu Map section calls `openFullMap(...)`.

---

## 5. Premium Inventory Management — `src/inventory/*` (NEW UI; store exists)

### 5.1 Quest items vs normal items
`relevance(questId, item)` already classifies **required / useful / junk** per
active quest. The inventory UI surfaces this:
- **Quest items** (required/useful) pinned to the top, badged "NEEDED HERE" /
  "USEFUL", **not sellable here** (gentle, never blocked silently — `safeToSell`
  drives a "safe to sell" badge on junk only).
- **Normal items** (cosmetics / consumables / trade-goods) below, grouped by kind.

### 5.2 UI/UX — `src/inventory/inventoryPanel.ts`
- Rendered as the **menu's Inventory section** (in-overlay; reuses the shop's
  visual language + `ART_GLYPH` map for consistency).
- Grid of item cells (art glyph, qty, relevance badge) → tap → detail with
  description + actions.
- Actions by kind: **Equip/Unequip** (cosmetics → `inventory().equip/unequip`,
  already wired to the avatar), **Use** (consumables → `consume`), **Give**
  (§5.3), **Sell** (opens shop's sell flow — don't duplicate).

### 5.3 Give / receive flow (the quest delivery surface)
- The **special-NPC delivery** (§3.3 READY-TO-DELIVER) is the primary
  give: the NPC dialogue shows a **"Hand over the {item}"** affordance when
  `hasNeeded` is true for the current step. Confirming consumes the item and
  advances the quest. This is the in-game answer to "how do I make progress."
- Generic give (NPC→player) reuses `inventory().grant`; player→NPC reuses
  `inventory().consume`. No new economy primitives.

### 5.4 Seam for player↔player trade (already built — just wire)
- `src/economy/shop.ts` already has a **Trade** tab + `trade.ts`
  (`draftProposal`, `validateProposal`, `applyTradeLocally`, `LocalTradeTransport`).
- `src/net/netClient.ts` documents the **exact mediated-chat seam**: add
  `room.send("trade", proposal)`, a server handler that routes/moderates, and a
  `room.onMessage("trade", …)` listener. The inventory "Give to player" action
  (future) drafts a proposal and ships it over `netClient` instead of the local
  transport. **No design debt — the contracts (`chat.ts` MediatedChat*) and
  transport interface already anticipate this.**

### 5.5 game.ts wiring
- `getInventoryView()` returns the panel factory bound to `inventory()` +
  `QuestEngine.quest().id` (for relevance badges).
- Special-NPC dialogue gets a `questEngine` reference so it can show the
  Hand-over affordance and call `advance`.

---

## 6. Challenge ↔ Quest ↔ Dialogue Wiring (summary of the exact binding)

Restating §3.4 as the implementation contract, because it is the heart of cohesion:

1. **NPC frames it:** the special NPC's system prompt is injected with the
   current step's *authored* pretext/clue (§7), so its invitation to play
   *is* the quest beat ("help me finish this letter to my sister").
2. **Step → challenge content:** `currentStep().toolId` (challenge kind) +
   `entryIds` (step override or `contentSelector` resolution) → `ChallengeContext`.
3. **game.ts** passes `domain` + `entryIds` into the context (today's gap) →
   `runChallenge` drills the quest's exact words.
4. **Result → reward → advance:** `applyReward`; then `QuestEngine.advance(stepId)`
   IF the step is challenge-gated and satisfied (deterministic check, not the model).
5. **Next clue:** engine recomputes step state; the NPC re-voices the authored
   next-hint; the tracker + minimap update.

Every link is a **data binding**, never a model inference. The model cannot
break cohesion because it never decides cohesion.

---

## 7. Prompt Engineering (the special-NPC template)

**Thesis (restated):** Qwen3-4B is weak at subtlety, hinting, and has little
RAG. So **the author writes the subtlety; the model only re-voices it** in
character + target language with a short native gloss. We **wire the existing
`clues` field through `composeSystemPrompt`** (the missing link) and add
deterministic FACTS the model must obey.

### 7.1 The missing wire (do this first in §7's workstream)
`npcRuntime.ts kickoff()` must pass clues into compose:
```
composeSystemPrompt({
  npcRole, scene, quest, learnerPair,
  clues: cluesFor(inventory(), quest.id, questEngine.currentStep()?.id),  // ← ADD
})
```
`cluesLeanSection` already renders them ("QUEST WHISPERS … drop ONE as a HINT,
paraphrased, never verbatim"). That alone makes hints authored, not invented.

### 7.2 Injected FACTS (deterministic, prepended) — special NPCs only
Extend `ComposeArgs` with an optional `questFacts` block the engine computes:
```
questFacts?: {
  npcName: string                 // "Serafina"
  npcRoleLabel: string            // "the café scribe"
  stepLabel: string               // "Finish the letter"
  stepState: "needs-item" | "ready-to-deliver" | "done"
  neededItemLabel?: string        // "the wax seal"  (when needs-item)
  authoredClue?: string           // verbatim authored line to RE-VOICE (needs-item)
  authoredNextHint?: string       // verbatim authored line (ready-to-deliver / done)
  target: string; native: string  // language names
  maxSentences: 2
}
```
A new `questFactsSection(facts)` composes a tight, branchy instruction block. The
model receives a single authored line to *paraphrase in character*, plus the
hard branch + caps. It cannot wander because the beat is pre-decided.

### 7.3 The special-NPC system prompt TEMPLATE (composed)
Skeleton appended to the existing persona/language/scaffold blocks:

```
You are {npcName}, {npcRoleLabel} in {scene.place} ({scene.era}). Stay in
character; you are warm and safe for a child.

QUEST CONTEXT (facts — obey exactly, do not contradict):
- The traveler's current task: "{stepLabel}".
- Situation: {stepState}.
- Speak mostly in {target}; you MAY add a short ({native}) gloss in parentheses
  for one new word. Keep it to AT MOST {maxSentences} short sentences.

WHAT TO SAY THIS TURN:
{branch by stepState}
  • needs-item:  Re-voice THIS hint in your own words, in {target}, as something
                 you happen to know — never hand it over, make them discover it:
                 "{authoredClue}"
  • ready-to-deliver:  They have {neededItemLabel}. Warmly accept it and react,
                 then re-voice this next beat in {target}:
                 "{authoredNextHint}"
  • done:        Briefly, warmly acknowledge progress in {target} and point onward:
                 "{authoredNextHint}"

Never invent new quest facts, items, or place names beyond what is given here.
Never break character to mention being an AI or a prompt.
{existing TOOLS protocol block}
```

### 7.4 Worked examples (composed prompt → expected short output)

**Example A — needs-item (target es / native en):**
Injected: `stepState:"needs-item"`, `neededItemLabel:"a fresh sack of coffee"`,
`authoredClue:"If only I had a fresh sack of coffee from the slopes…"`.
- *Composed instruction:* re-voice that clue, ≤2 sentences, mostly Spanish + a
  short English gloss.
- *Expected output:* `"¡Ay, qué bueno verte! Si tan solo tuviera un saco de café
  fresco de las montañas… (a fresh sack of coffee)."`
- It cannot fail to be a subtle hint — the subtlety is the author's line; the
  model only translated + flavored it.

**Example B — ready-to-deliver (target es / native en):**
Injected: `stepState:"ready-to-deliver"`, `neededItemLabel:"the coffee sack"`,
`authoredNextHint:"Now we can brew — sit, and I'll teach you to order like a local."`.
- *Expected output:* `"¡El saco de café! Justo lo que necesitaba — gracias.
  Ahora siéntate y te enseño a pedir como de aquí. (to order like a local)"`
- Then the deterministic engine consumes the item + advances the step
  (NOT the model). If the model *also* emits `<<tool>{"kind":"questStep",…}</tool>>`,
  the engine ignores it unless `isStepSatisfied` already agrees.

### 7.5 Scripted-fallback (no-LLM) path — PRESERVE
- When the broker reports no model (`kickoff` → `scriptedTurn`), the special NPC
  still works: speak the **authored clue / next-hint verbatim** (it's already
  authored target-language-agnostic English today; for special NPCs, author a
  short target-language scripted line per step in `NpcRole.scriptedFallback` or a
  parallel `questItems` field). The deterministic chain (clue → item → deliver →
  advance) runs identically **without the model** — the model was never load-bearing.
- The deterministic **Play chip** (`resolveGameOffer`) already guarantees a
  playable challenge with no model; bind its `entryIds` to the current step the
  same way (§6).

### 7.6 Honest small-model limits (call out in implementation)
- Keep `maxSentences:2`, low temperature for special-NPC turns, and the
  stop-sequence tool protocol. Do NOT ask the model to plan multi-step logic,
  remember inventory, or decide progression — those are the engine's job.
- Never trust a model-emitted `questStep`/`reward` without the deterministic
  gate. The model is a mouth, not a referee.

---

## 8. Implementation Plan (sequenced, disjoint file ownership)

Ordering: **M0 (menu+exit) first** → **MVP cohesion** (one quest, one
clue→item→deliver chain + tracker + basic map + inventory surfacing) → polish.
File ownership is disjoint so workstreams fan out without collisions;
orchestrator-owned files (`game.ts`, `styles.css`, `worldLook.ts`) are called
out and serialized through a single owner.

### Milestone 0 — Menu + Exit (ships alone, verified embedded)
**Owner A (shell).** Files: `src/shell/menuPanel.ts` (NEW), `src/shell/shell.ts`
(rewire to menuPanel), `src/shell/menuButton.ts` (mount-parent param),
`src/shell/confirm.ts` (mount-parent param), `src/shell/pause.ts` (retire/remove),
new CSS for `.wp-menu*`.
**Orchestrator (game.ts, styles.css):** add `--wp-z-menu:70`; pass `mountParent: overlay`
to `createShell`; provide stub `getQuestView/getInventoryView/getMapView`.
**Contract additions:** none.
**Dependencies:** none. **Exit criteria:** §2.8 verification in the REAL app on
phone+tablet+desktop; `.wp-menu` is a child of `.wp-overlay` (DOM-inspected).

### Milestone 1 — Quest engine + tracker + prompt wiring (MVP cohesion core)
Can fan out in parallel after M0; converge at game.ts.
- **Owner B (quest engine).** `src/quest/questState.ts` (NEW), `src/quest/questContent.ts`
  (NEW, entryIds resolution), `contracts/src/quest.ts` (+`QuestStep.entryIds?`,
  +`ComposeArgs`-side `questFacts`). Exposes `QuestEngine`.
- **Owner C (prompt).** `src/npc/promptProgram.ts` (add `questFactsSection`,
  consume `questFacts`), `src/npc/npcRuntime.ts` (pass `clues` + `questFacts`
  into compose; add Hand-over affordance hook). **Do not regress current
  dialogue** — these are additive blocks gated on `questFacts` presence.
- **Owner D (tracker).** `src/quest/questTracker.ts` (NEW, in-overlay HUD),
  CSS. Subscribes to `QuestEngine` + `inventory()`.
- **Orchestrator (game.ts):** construct `QuestEngine`; pass `entryIds`+`domain`
  into `ChallengeContext` (the §3.4 gap); on challenge result call
  `QuestEngine.advance` when gated; mount tracker; handle `questStep`/`reward`
  intents through the engine (deterministically gated).
**Exit criteria:** with `es-guadalajara-route` (already authored), the
clue→item→deliver→advance loop runs end to end; tracker reflects it; a challenge
drills the step's `entryIds`; works with model AND scripted-fallback.

### Milestone 2 — Special NPCs + placement
- **Owner B/E (quest+world).** Mark specific anchors as **special quest NPCs**
  (a `content/npc/special.json` mapping `anchorId → {questId, role, name}`), so
  `createCrowd`/focus can flag them; the engine routes delivery only through
  them. Files: `content/npc/special.json` (NEW), `src/quest/specialNpc.ts` (NEW
  resolver). **game.ts** marks held specials + passes `questEngine` into their dialogue.
**Exit criteria:** you can talk to anyone, but only the marked NPC at the step's
anchor accepts the item / advances the quest; specials are distinguishable.

### Milestone 3 — Map (minimap + full-screen)
- **Owner F (map).** `src/map/minimap.ts`, `src/map/fullMap.ts` (NEW), CSS.
  Pure consumers of `{topology, getPlayerPos, getRemotePositions, getQuestMarkers}`.
- **Orchestrator (game.ts):** construct + tick minimap; wire menu Map section to `fullMap`.
**Dependencies:** M0 (menu section), M1 (`getQuestMarkers` from engine/`sourceHints`).

### Milestone 4 — Inventory panel + give/deliver UI
- **Owner G (inventory UI).** `src/inventory/inventoryPanel.ts` (NEW), CSS.
  Consumes `inventory()` + active questId for relevance badges. Reuses shop visual language.
- **Orchestrator (game.ts):** wire menu Inventory section; special-NPC Hand-over
  affordance (with Owner C's hook).
**Dependencies:** M0, M1.

### Milestone 5 — Level completion + path
- **Owner B (curriculum).** `src/curriculum/path.ts` (NEW), `content/paths/*.json`
  (NEW, ≥2 levels). Level-complete card (in-overlay).
- **Orchestrator (game.ts):** on quest complete → grant rewards → show card →
  load next `Quest` + re-skin to next `LevelSpec.sceneId` via the existing
  scene-rebuild path.
**Dependencies:** M1.

### Milestone 6 — Multiplayer + trade wiring (after MVP)
- **Owner H (net).** Instantiate `createNetClient` in game.ts (best-effort,
  already degrades to solo). Feed `getRemotePositions` to the map. Wire shop
  Trade tab over `netClient` per the documented seam (server handler +
  `room.onMessage("trade")`). Files: `server/*`, `src/net/*`, `src/economy/trade.ts`.
**Dependencies:** M3 (map shows remotes), M4 (give-to-player entry point).

### Orchestrator-owned coordination (single owner, serialize)
- **`src/game.ts`** is touched by M0–M6 — assign ONE owner per merge window;
  each milestone lands its game.ts wiring behind the data getters/hooks the
  milestone defines, so the diffs are additive and non-overlapping.
- **`src/styles.css`** — only the `:root` z-scale + new `.wp-*` blocks; additive.
- **`src/render/worldLook.ts`** — only if special NPCs need a distinct cutout
  look (a `CharacterLook` flag); keep behind the existing `WorldLook` seam.

### Required contract additions (consolidated, all small/additive)
- `QuestStep.entryIds?: number[]` (challenge content pin).
- `ComposeArgs.questFacts?` (special-NPC deterministic facts).
- (Optional) a `specialNpc` content shape — content JSON, no contract change strictly needed.
- No breaking changes; bump `CONTRACTS_VERSION` per the additive change.

### Cross-cutting requirements (every milestone)
- **Premium, on-brand:** understated/elegant, paper-cutout language, no Duolingo
  dark patterns (the tracker *informs*, never nags; the only "pulse" is the
  current objective marker, opt-out via reduced-motion).
- **Tablet + desktop + phone all first-class** (MEMORY): every new surface mounts
  in `.wp-overlay`, safe-area aware, touch + pointer + ESC paths all wired.
- **Localize every new string** (~50 langs) — all new copy goes through the
  same per-locale `strings` override pattern the shell/runtime already use.
- **Single-language stacks** (MEMORY): `learnerPair.target === native` → immersion
  framing already handled in `composeSystemPrompt`; new copy must not assume two langs.
- **Noisy errors** (MEMORY): every catch logs visibly.
- **Storage:** QuestState + intro flags are < 1KB localStorage; large caches (if
  any) go to IndexedDB. No new 5MB pressure.
- **No `window.confirm/alert/prompt`**; all modals are in-pack, in-`.wp-overlay`.

---

## 9. Open questions for the owner (before fan-out)
1. **Map fidelity for MVP:** stylized schematic (cheap, premium) vs a mini-3D
   render. Recommend schematic first behind the `getMapView()` seam.
2. **Which quest is the MVP vehicle:** `es-guadalajara-route` already has the
   full clue→item→deliver data in `QUEST_ITEM_RULES` (2 steps, 2 keys) — recommend
   it over `es-cafe-travel` (challenge-only, no item chain authored yet).
3. **Special-NPC anchors:** confirm which topology anchors host the boatman/
   gatekeeper (the route quest references `docks` / `city_gate`, which need
   anchors in `plaza-grand.json` or a route-specific topology).
4. **Scripted special-NPC lines:** authoring short target-language fallback lines
   per step (so the no-LLM path stays cohesive) — owner sign-off on tone.
