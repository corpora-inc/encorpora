# Game-Dev Playbook — hard-won lessons from World Plaza

> Read this FIRST if you are an agent building a new game pack (or extending this
> one). World Plaza is the furthest Corpán game development has gotten — a premium,
> offline-first/online-optional 3D language-learning RPG (HD-2D, on-device Qwen3
> NPCs, Whisper STT, system TTS, Colyseus presence), shipped as a Corpán pack.
> Everything below was paid for in real debugging. Don't re-pay it.
>
> Structure: **§1 How to shard work across agents** (the methodology), then the
> technical lessons grouped by facet: **§2 Rendering/Babylon**, **§3 Input & the
> DOM-over-canvas trap**, **§4 Z-stacks & layering**, **§5 Floating UI (FABs) &
> dialogs**, **§6 On-device LLM NPCs**, **§7 Storage**, **§8 Process & verification**.
> Each lesson is a *symptom → cause → fix → rule*, so it's greppable.

---

## §1. How to shard one game across many independent agents (the method)

This is the part the owner cares most about: **how do parallel agents build one
cohesive game without stepping on each other?**

### 1.1 Contracts-first, not code-first
The spine is a typed contract package the *client, server, and every agent* import:
`@world-plaza/contracts` (Zod schemas) + `src/contracts/runtime.ts` (runtime
interfaces for the in-pack seams). **Freeze the interfaces before anyone writes
implementation.** Agents then code against schemas + stubs, never against each
other's in-progress code.

- Zod gives you BOTH compile-time types (`z.infer`) AND runtime validation at every
  boundary (client↔server, pack↔host). A breaking schema change fails fast.
- Version the contract (`CONTRACTS_VERSION`) and treat it as an **additive freeze**:
  once published, you only ADD optional fields; you never repurpose or remove. New
  runtimes read new fields; old runtimes ignore them. (Same discipline the Corpán
  catalog uses for its three-shape entries.)

### 1.2 Define SEAMS, give each a stub
A "seam" is one interface an agent owns end-to-end behind a stub the orchestrator can
run immediately. World Plaza's seams (copy the pattern, not the names):
`TrackStore`, `IconRenderer` (`renderIcon(spec)` → zero-emoji procedural art),
`MapView` (topology + live positions + quest markers), `SpecialNpcResolver`, the
HUD "glance" providers, the chrome-visibility roles, the `ChallengeTool` interface.
Each seam ships with a **trivial stub** (`(k)=>k` localizer, solo-schematic MapView,
empty wallet) so the game runs from day one and agents diff against a moving target
that always compiles.

### 1.3 Disjoint file ownership + a named orchestrator for the shared files
The reason parallel agents collide is shared files. So:
- **Each agent owns a disjoint directory** (`src/economy/`, `src/badges/`, `src/map/`,
  `src/npc/`, `src/shell/`, …) and is told explicitly which files it MUST NOT touch.
- **A single orchestrator serializes the genuinely shared files** — here
  `src/game.ts` (the wiring), `src/styles.css` (the one host-loaded stylesheet), and
  the contract. Agents return their public surface; the orchestrator threads them
  together. Don't let five agents all edit `game.ts`.
- Scoped CSS: every slice that isn't the orchestrator injects its OWN
  `<style data-wp-*>` with namespaced classes (`.wp-minimap*`, `.wp-status*`) so two
  agents' styles can't collide. Only the orchestrator edits the shared `styles.css`.

### 1.4 The orthogonal-axes trick (what made the game flavorable AND shardable)
World Plaza's whole design is three ORTHOGONAL axes so different agents own different
axes without coupling:
- **Room** = the shared, authoritative collision/position/socket space (Colyseus).
- **Scene** = a per-player *data skin* of a Room (place/era/art) — pure data + assets.
- **Quest** = a per-player goal that reprograms the NPC prompt program — pure data.

Two players stand in the same Room geometry but see different Scenes and chase
different Quests. Because each axis is data, the "content" agents (scenes, quests,
prompts) never touch the "engine" agents (collision, render, net). **Find the
orthogonal axes of YOUR game first; they are the shard boundaries.**

### 1.5 Waves + integration checkpoints
Don't fan out everything at once. Run **waves**: (0) freeze contracts → (1) engine +
scene + one quest "premium empty scene" → (2) economy/badges/map/npc/shell → … Each
wave ends at an **integration checkpoint** with a concrete acceptance ("two players,
divergent scenes, one collision space"). The orchestrator integrates and verifies
before the next wave.

### 1.6 Use a strong model as JUDGE, not a metric
For "is this prompt/dialogue/UX good?" do NOT write programmatic similarity metrics
(the owner's words: "a shit idea"). Use **Codex CLI** (`codex exec`, a big GPT-5.x
paid by subscription) or a subagent as a real LLM judge. It caught semantic bugs a
metric never would (a wrong gloss, meta-framing that broke character, cross-turn
repetition). Reusable wrapper: `eval/judge/judge.sh`. (See the `codex-cli-llm-judge`
memory.)

---

## §2. Rendering / Babylon.js (clean-room HD-2D)

### 2.1 Road/decal z-fighting → BAKE it into the ground mesh ("the flickering street")
**Symptom:** roads/paths flicker and shimmer, worst at grazing camera angles, "fixed"
several times but always came back. **Cause:** the road was a separate mesh overlaid
on the ground with a tiny Y offset; coplanar surfaces z-fight and *no* offset wins at
all angles (the offset that looks fine head-on fails at a graze). **Fix:** there is
only ONE ground mesh; paint the roads INTO its texture / vertex data so they are the
same surface — never an overlay. **Rule: coplanar overlays always z-fight; merge them
into one mesh instead of offsetting.** (Verify with a grazing-angle QA pass, not a
top-down one — agents self-report "fixed" against friendly angles.)

### 2.2 Distant background paints over the town → renderingGroupId
**Symptom:** the horizon vista / backdrop occludes foreground buildings. **Cause:**
Babylon **clears the depth buffer between rendering groups**, so anything in group 1
paints over everything in group 0 regardless of real depth. **Fix:** the distant
backdrop must be in **renderingGroupId 0** (same group as the town) and use a real
far position / `infiniteDistance` sky dome. **Rule: don't use rendering groups to
fake depth ordering — they discard depth between groups.**

### 2.3 Shimmer on textures → anisotropy + mips
Distant textured surfaces shimmer/crawl without `anisotropicFilteringLevel = 16` and
mipmaps. Cheap, big quality win.

### 2.4 HD-2D character discipline (billboards that don't look cheap)
Characters are 2D billboard "paper people" ON PURPOSE (Octopath look): they always
face the camera but must **never be paper-thin** (a billboard seen edge-on vanishes —
keep them camera-facing). Put the swap behind a `CharacterLook`/`WorldLook` seam
(`createGroundedCutout` / `create3DLook`) so you can drop in 3D characters later
without touching gameplay. Roof undersides/gables must be **double-sided** prisms or
you see through them. When the camera clips inside a roof, **fade occluders** rather
than letting the camera punch through.

### 2.5 StrictMode double-mount spawns two engines
**Symptom:** doubled LLM calls, ghost input, two of everything. **Cause:** React 18
StrictMode mounts twice in dev; each mount booted a Babylon engine. **Fix:** make
`mount()` idempotent (guard against a second boot). **The tell: two "Babylon boot"
lines in the console.** Always check the console for double-boot when behavior is
mysteriously doubled.

---

## §3. Input & the DOM-over-canvas trap (event handlers)

This bit the project hardest and latest, so read it twice.

### 3.1 A pointer-capturing input layer STEALS taps from chrome buttons
**Symptom:** the minimap, the menu/pack button, and in-panel deep-link buttons "do
nothing" when tapped; "tapping just works the joystick." **Cause:** the dual-joystick
listens for `pointerdown` on the full-screen overlay (`.wp-overlay`) and calls
`host.setPointerCapture(pointerId)` so a drag keeps tracking off-element. Chrome
buttons are CHILDREN of that overlay. A press on a button bubbles to the overlay,
which captures the pointer — so the button never receives `pointerup`, so its `click`
never fires. Buttons that only `stopPropagation` on **click** are too late: the
capture already happened at pointerdown. **Fix (keystone):** in the input layer's
`onDown`, bail if the press targets interactive chrome —
`if (e.target.closest('button, a, input, textarea, select, [role="button"], [data-wp-nojoystick]')) return;`
ONE guard fixes every current and future chrome element at once, instead of hoping
each remembers to stopPropagation. **Rule: when a pointer-capturing input layer and
tappable UI share a parent, gate the input layer by target type — don't rely on
per-element propagation stopping.**

### 3.2 `pointer-events:none` makes a "dim" control silently dead
**Symptom:** the pack button looked faded and taps fell through to the world.
**Cause:** a chrome-visibility state machine dimmed the button to
`opacity:.4; pointer-events:none` whenever an NPC was "focused" — and in a crowded
plaza you're *almost always* focused, so it was permanently dead. **Fix:** keep
controls fully interactive unless a blocking surface truly owns the screen; reserve
`pointer-events:none` for genuinely hidden chrome. **Rule: "dim" should still be
clickable; only "hidden" is non-interactive — and double-check which states actually
occur at runtime (focused-near-an-NPC was the common case, not the rare one).**

### 3.3 Dual-joystick shape that worked
Dynamic-origin sticks (spawn at the touch point), one stick per screen-half keyed to
the `pointerId` that spawned it, all per-gesture state held PER stick so a second
finger can't corrupt the first's tap/drag bookkeeping. Tap-vs-drag by a slop
threshold. Merge keyboard (WASD/arrows + Q/E) so it's testable on desktop. The
joystick visuals are `pointer-events:none` so they never eat input themselves.

---

## §4. Z-stacks & layering

### 4.1 ONE documented z-scale, in `:root`, as the single source of truth
All z-indexes are CSS custom properties in one `:root` block with comments
(`--wp-z-menu: 70`, `--wp-z-dialogue: 40`, …). Never sprinkle magic z numbers.
**Watch for collisions:** two surfaces sharing a value (minimap `13` == status-detail
`13`) gives undefined paint order the day they overlap — give related elements a
**contiguous band** instead.

### 4.2 Mount overlays INSIDE the host's render surface, NEVER `document.body`
**Symptom:** a `position:fixed` modal at z≈2 billion is invisible when the pack runs
embedded (works fine standalone). **Cause:** the Corpán host's `ContentPackHost`
container forms its own stacking context and clips with overflow/transform/contain;
a body-appended child is laid out/clipped relative to that container and disappears.
**Fix:** mount every overlay (menu, dialogue, challenge, toasts) inside the pack's
own `.wp-overlay` element — the surface the host actually paints — at a sane z within
the in-overlay band. **Rule: in an embedded pack, `document.body` is not yours; the
host's accepted render node is. Never `position:fixed` on body.**

### 4.3 One visibility owner that RECEDES chrome, instead of out-z-ing it
When a blocking surface (dialogue/challenge/menu) opens, don't raise it above
still-painted chrome — **recede the chrome**. A single `chromeVisibility` state
machine ("world/focused/dialogue/challenge/menu/onboarding") sets a `data-wp-chrome`
attribute on every registered surface; each surface's scoped CSS keys off it
(`dim`/`hidden`). One owner = the whole HUD breathes together. **Register EVERY
floating element** with it — the one we forgot (the minimap) stayed lit during
dialogue and was the biggest "the UI feels incoherent" complaint.

---

## §5. Floating UI (FABs) & dialogs

### 5.1 Plan the corner grid UP FRONT; make overlap structurally impossible
**Symptom:** two controls (minimap + pack button) stacked in the same bottom-right
corner; repeated "they still overlap." **Cause:** elements were placed independently,
each "bottom-right", with no shared spatial plan. **Fix:** assign every FAB a home on
a corner/edge grid (top-left status, top-right place tag, bottom-left pack, bottom-
right minimap), reserve the center for toasts, and reserve the joystick halves.
Drive insets/sizes from **shared tokens** so the non-overlap is *math, not eyeballing*
(if you must stack two in one corner, offset the second by the first's size token + a
gap token — never a hardcoded guess that drifts at another breakpoint). **Rule:
two FABs never share a corner; spacing comes from tokens, proven at every breakpoint.**

### 5.2 Fixed-size dialog — never let it resize/recenter between tabs
**Symptom:** switching tabs (or a filter Recent→All) ballooned the panel and shoved
the footer buttons off-screen; "the dialog jumps around everywhere." **Cause:** the
panel was content-sized (`max-height`) and centered, so taller content grew it from
the center and clipped past the viewport. **Fix:** give the panel a **fixed** `height`
(`height: min(620px, 100% - 40px)`), make the body the SOLE scroll region
(`flex:1 1 auto; min-height:0; overflow-y:auto`), keep the footer outside the scroll
region. Now it's sized once, never moves, and long lists scroll inside a stable frame.
**Gotcha that wasted a round:** a fixed `height: min(620px, calc(100% - 40px))` did
NOT take, because the panel was centered with `display:grid; place-items:center` — a
**percentage height does not resolve through a grid's auto-sized centered row**, so it
silently fell back to *content* height and the panel still resized between tabs. (Width
looked fine only because `min(420px, …)` was picking the fixed `420px` branch, never the
percentage.) **Fix: center with flex** (`display:flex; align-items:center;
justify-content:center`) — a flex container with a definite height (here `inset:0`)
resolves the item's percentage height correctly. **Rule: percentage heights need a
containing block with a *resolved* definite height; `place-items:center` grid rows are
auto, so use flex for "centered + percentage-sized."**

### 5.3 `overflow-y:auto` silently turns on horizontal scroll
**Symptom:** a card scrolled sideways and clipped text on the left. **Cause:** CSS
spec — if one axis is non-`visible` and the other is `visible`, the `visible` axis
computes to `auto`. So `overflow-y:auto` made `overflow-x` *auto*, and any child 1px
too wide spawned a horizontal scrollbar. **Fix:** set both explicitly:
`overflow: hidden auto`. **And** a `width:100%` row with padding overflows its parent
unless `box-sizing:border-box`. **Rule: when you set one overflow axis, set the other;
and `width:100% + padding` needs `border-box`.**

### 5.4 No native dialogs
`window.confirm/alert/prompt` are silent no-ops in the Tauri WKWebView (and ugly
anywhere). Build an in-pack modal (promise-based `confirm()` pattern). See the
`feedback_no_window_dialogs` memory.

### 5.5 Touch targets & handles
≥44px hit targets everywhere; safe-area-aware (`env(safe-area-inset-*)`); a drawer
handle needs a ~44px hit band around the visible pill, not the bare pill. Honor
`prefers-reduced-motion` (every animation degrades to opacity/none). Zero emoji in
premium surfaces — use a procedural icon renderer or inline SVG (emoji flags don't
even render on Windows).

---

## §6. On-device LLM NPCs (Qwen3-4B via corpan-llm)

### 6.1 Keep the model HOT
Unloading the model on an idle timer caused `MODEL_NOT_LOADED` mid-conversation and
double-fire. Keep it resident while the game is foregrounded; only unload on
`onBackground()`.

### 6.2 Don't make a small model do bookkeeping — hardcode the deterministic parts
**Symptom:** repetitive, nonsensical NPC challenge intros even after prompt tuning.
**Insight (owner's):** asking the 4B to also produce a cohesive segue into each
challenge "takes too much of the model's brain." **Fix:** decouple the segue from the
model entirely — a deterministic, hardcoded **target-language phrase bank**
(`challengeSegues.ts`: ~20 challenge types × ~10 variants × ~50 languages →
`resolveSegue(tool,target,turn)`). The model does *conversation*; the scaffolding is
data. **Rule: a 4B is a conversationalist, not a state machine — move structure,
cohesion, and repetition-avoidance OUT of its prompt into deterministic code.**

### 6.3 De-gloss, anti-repeat, sticky voice
- **De-gloss:** instruct "reply in {target} ONLY — never a parenthetical or {native}
  gloss." Wrong English glosses ("ferry" for a dock word) are worse than no gloss.
- **Anti-repetition** belongs in transient wire-only context, not the persisted system
  prompt.
- **Sticky per-NPC TTS voice:** pick a voice deterministically (hash the NPC id) and
  PERSIST it, so a character doesn't change voice between turns. (Per-utterance voice
  selection needs a host/TTS-plugin capability — flag it, don't fake it.)

### 6.4 No native tool-calling → parse a sentinel block JS-side
`corpan-llm` is text-only streaming. NPCs emit `<<tool>{json}</tool>>`; parse it in JS
using the plugin's stop sequences into a typed `NpcIntent`. No plugin change needed.
Always ship a **scripted fallback** so NPCs work when the model pack is absent.

### 6.5 Deterministic, idempotent item grants — never the model "claiming" it
If an NPC hands over a quest item, the GAME grants it (idempotent) and fires the juicy
"received" reveal. If you let the model say "here's the token," it hallucinates grants
it didn't make. **Rule: state changes are code's job; the model only narrates.**

---

## §6.6 Placement physics: non-walkable zones must be IN the collision field

Spawners (the crowd, ambient population, prop scatter) reject any sample where
`field.blocked(x,z,r)` is true — that's the only gate. So "keep people/props off
the water / the rooftops / the rail" is NOT a spawner change; it's **getting that
zone INTO the obstacle field**. When the owner reports NPCs standing in the river
or bollards floating on it, the bug is almost always that the zone was never
modelled as an obstacle, not that the spawners are broken.

In World Plaza the river was painted as blue ground but had no collider. Fix
(`places`, #30): water became first-class layout data (`CityLayout.water` +
per-chunk `CityChunk.water` rects), and `city/collision.ts :: chunkObstacles`
emits a BOX obstacle per water rect — splitting it L/R around the bridge gap so
the one crossing stays walkable. A box obstacle's `resolve` slides bodies along
its OUTSIDE face, so the same collider that rejects spawns also walls the player
at the shoreline. Prove it headlessly: union every chunk's obstacles into a field
and assert a probe grid over the zone reads `blocked` (and the intended gap does
not). See `src/city/waterPlacement.test.ts`. Pair it with generation-time
defense-in-depth (drop any prop that lands past the boundary) so you never even
seed a floating object.

The SAME box-obstacle trick crafts the WORLD EDGE (#32): a procedural world that
runs off into fog reads as unfinished. Don't make the edge infinite — bound it
with a designed wall (a perimeter rampart with gates) and turn the natural
boundary (a river/sea) into a BAND, not an edge: near bank → water → FAR bank
(more city) so a bridge ARRIVES somewhere instead of running off the map. Model
each as data (`CityWater.farBankZ`, `CityBoundary` + per-chunk `CityWallRect` with
a `gateGap`), emit box obstacles split around the gates, and build the wall MESH
from the SAME segments (`world/cityWall.ts`, a city-lifetime additive layer in
`mountCity`) so collider ↔ wall are one truth. Keep every boundary knob relative
to `bounds`/`half` so a later world-size bump keeps a coherent edge for free.

## §6.7 Third-person camera occlusion: deny-list + ray, never a tag whitelist (#59)

The follow camera must NEVER end up inside opaque geometry that hides the player,
and ANYTHING between camera and player must fade. We shipped this twice wrong
before getting it right — both failures were a hard-coded NAME WHITELIST
(`wp-building-*`/`wp-r-*`) for "what occludes," which silently missed the market
stalls/awnings, the bridge, and walls, so the camera buried in a market roof and
the player vanished. **Rule: occluders are a DENY-list, not an allow-list** —
`src/world/cameraOcclusion.ts :: isCameraOccluder` treats every solid, visible,
real-volume mesh as an occluder and exempts only ground/water/character-billboards/
sky/HUD-overlays (by prefix) + sub-0.25u-tall ground stamps. New world geometry is
covered automatically. The boom (eye pull-in, `engine.ts`) AND the fade
(`cameraFade.ts`) both use it; the fade detects occlusion by RAY (camera→player
hit before the head) or camera-inside-AABB — never by a tag.

TWO traps that cost time here:
- **Thin-instanced props carry ONE union AABB over every instance.** A market
  stall is `wp-city-prop-stall-…` thin-instanced — its bounding box spans the
  whole chunk, mostly air. A boom ray-test against that union sees a giant phantom
  slab and COLLAPSES the camera onto the player the instant you near a stall row
  (player drops off the bottom of frame). Fix: exclude thin-instanced meshes from
  the BOOM (`isBoomBlocker`), but still FADE them per-object (the fade is per-mesh,
  so the whole canopy species dissolves cleanly). The fade — not the boom — is the
  guarantee for airy thin-instanced geometry.
- **`MIN_BOOM` is a FRAMING floor, not just an anti-clip floor.** Too small (0.2)
  and a boom forced short against a wall jams the eye onto the player at a near-flat
  pitch → the player falls off-screen. A generous floor (2.4) keeps the player
  framed; the fade covers the bit of wall you're now tucked against.

Verify HEADLESSLY + deterministically: `src/world/cameraOcclusion.test.ts` poses a
camera (NullEngine) inside/behind a solid building AND a thin-instanced stall
cluster and asserts visibility drops — far more reliable than fighting the real
follow-rig in a screenshot harness. (The rig is hard to pose; a unit test on the
occlusion logic + ONE confirming screenshot in the FAILING scenario beats a dozen
rig-wrangling captures.)

## §6.8 Ambient crowd: keep-out covers EVERY figure; variety is the SPRITE count (#60)

"Surrounded by 758,323 herbalists" decomposed into two separate bugs, and the
literal complaint ("all herbalists") was a red herring — the persona generator was
already varied (dump it before assuming; ours gave baker/scribe/sailor/… , 1 of 22
a herbalist). The real two:
- **Visible clones = the pre-baked SPRITE set, not the persona.** Ambient figures
  reuse one of `figureVariety` pre-baked billboards; persona TEXT varies per slot
  regardless, but the LOOK is variety-bound. 6 sprites over ~12 near-field figures
  reads as a wall of clones. Bump `figureVariety` (→16; each is a few-KB half-res
  billboard). When the owner says "everyone looks the same," check the sprite-pool
  size, not the persona generator.
- **A player keep-out applied to STROLLERS must also apply to STATIONED figures.**
  Strollers had a keep-out (#24) but stall-keepers bind to vendor anchors — which
  cluster exactly where the player stands to do a market quest — so every keeper
  mobbed the player. Add a keeper keep-out: don't bind a keeper to an anchor within
  N of the player (leave that stall unstaffed until you step back) and place a bound
  keeper on the side of its stall AWAY from you. **Any "don't crowd the player" rule
  must enumerate ALL figure sources (wanderers AND anchor-stationed), or the one you
  forgot is the mob.** Prove it: warm the sim at the densest vendor cluster and
  assert 0 figures inside the keep-out (`qa/pop.mjs`); lock variety + the bind
  predicate in a canvas-free unit test (`src/city/population.test.ts` — DynamicTexture
  needs a canvas, so test the LOGIC, not the mounted billboards).

## §7. Storage

All packs run in the host WebView's single origin and **share one ~5 MB localStorage
budget**. Overflowing it (big catalogs/caches) silently breaks other packs. Per-pack
localStorage budget is **tens of KB**; put anything large in **IndexedDB** (quota-safe)
or an in-memory/session cache. See `corpan-pack-storage` memory.

---

## §8. Process & verification (how not to waste the owner's time)

- **Verify in the REAL embedded app, not just standalone.** The pack loads from the
  corpan-app vite server's `/packs` middleware (port `:1421`, NOT `:8989`). After a
  PACK change you must **rebuild `dist/` and reopen** (the corpan-app *src* HMRs live,
  but the pack bundle does not). Standalone friendly-angle testing hides embedding
  bugs (body-clip, joystick capture, host stacking).
- **Don't blame "stale build" when the user reports a bug.** The owner is 20+ yrs
  devops and verifies before reporting. Treat the report as accurate: pull a
  screenshot, re-read the exact element in context, look for layout/stacking quirks.
  "The device has stale code" is almost never it and wastes their time.
- **Errors noisy, not silent.** Every `catch` logs visibly. A swallowed error here is
  an afternoon lost later.
- **CSS-in-TS gotcha:** styles injected via backtick template literals — a literal
  backtick or `${` inside a CSS *comment* closes the template and breaks the build
  (cost a tsc failure this session). Don't put backticks in CSS-in-TS comments.
- **Ownership is single-owner, explicit.** Git commit/push and iOS device builds have
  ONE owner at a time, agreed out loud. Default owner = the human; leave changes
  staged for review unless handed control.
- **Document as you go (metacorpus).** Drop lessons into docs the moment you learn
  them — this file exists because we forget too much otherwise.

---

## Appendix — the World Plaza file map (where each facet lives)
- Engine/render: `src/world/` (`engine.ts`, `buildings.ts`, `atmosphere.ts`, `vista.ts`, `crowd.ts`, `topologyGen.ts`).
- Input/movement: `src/movement/` (`input.ts` dual-stick, `controller.ts`).
- Shell/chrome: `src/shell/` (`menuPanel.ts`, `menuButton.ts`, `placeTag.ts`, `chromeVisibility.ts`, `confirm.ts`, `exit.ts`).
- HUD: `src/quest/questTracker.ts` (Status Capsule), `src/map/` (minimap/fullMap/schematic/mapCore/mapStyles).
- NPC/LLM: `src/npc/` (`modelBroker.ts`, `npcRuntime.ts`, `promptProgram.ts`, `challengeSegues.ts`, `npcVoice.ts`, `dialogueUI.ts`).
- Economy/badges/items: `src/economy/`, `src/badges/`, `src/items/itemArt.ts` (IconRenderer), `src/inventory/`.
- Orchestrator + shared CSS: `src/game.ts`, `src/styles.css`.
- Contracts: `@world-plaza/contracts` + `src/contracts/runtime.ts`.
- Server: `server/` (Colyseus presence).
- Eval: `eval/judge/judge.sh` (Codex LLM judge).
- Design docs: `docs/` (DECISIONS, TOP_HUD, FAB_POLISH, NPC_PROMPT_STUDY, this playbook, …).
