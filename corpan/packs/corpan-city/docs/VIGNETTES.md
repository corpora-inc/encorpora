# Vignettes — enterable sub-experiences (the v2 scene seam)

> A **Vignette** is a focused, fullscreen, immersive little scene the player
> ENTERS from the open city (an interior like a café/bank, a vehicle like a
> taxi/bus, a transit hop like the subway) and EXITS back to the world. It is the
> keystone the whole roster — and the v2 "arbitrary scenes" plan — depends on.
>
> Code: `src/vignettes/` (own slice). Reference: the **taxi back-seat**.

---

## 1. Why this is the v2 enabler

Today the city is one open plaza. The next level is a world of *places* — a real
café, a historical bank, a fantasy tavern, a subway car. Every one of those is,
structurally, the **same thing**: a self-contained scene you enter, that reuses
the shipped systems (Qwen3 NPCs, challenges, the wallet, TTS, the icon renderer),
and that hands a result back to the city when you leave.

So we built ONE seam — `Vignette` — and a host that owns the lifecycle. A new
scene is **just another Vignette**: implement `enter(ctx) → VignetteResult`,
register it under an id, attach it to a portal anchor. No new orchestration, no
new chrome plumbing, no new pause/resume logic. The taxi proves the seam end to
end; the rest of the roster is data + a different framing.

---

## 2. The seam (API)

```ts
interface Vignette {
  enter(ctx: VignetteContext): Promise<VignetteResult>
  dispose(): void
}

interface VignetteResult {
  rewards?: VignetteReward    // already granted inside; echoed so the city can toast
  questStep?: string          // a step id the vignette satisfied (city advances it)
  travelTo?: string           // TRANSIT: topology anchor to RE-SPAWN the player at
}
```

`enter` builds the whole scene into `ctx.mountRoot`, runs until the player exits,
and resolves the result **exactly once**. It must NOT remove its own `mountRoot`
(the host owns the OUT transition + removal); it just resolves. `dispose` tears
down residual resources (idempotent).

### The injected context (services, not imports)

```ts
interface VignetteContext {
  mountRoot: HTMLElement        // fullscreen node the host made INSIDE .wp-overlay
  learnerPair: LearnerPair      // target they learn, native they know
  scene: Scene                  // active skin (palette/mood/place)
  anchorId: string              // the topology anchor the player entered FROM
  speak(lang, text): Promise    // host TTS
  openNpc(args): VignetteNpcHandle  // a real Qwen3 conversation, mounted in-scene
  wallet(): VignetteWallet      // balance + debit (fares are physical money)
  grant(reward): string[]       // applyReward path (XP/currency/items + HUD reveal)
  runChallenge(args): Promise<ChallengeResultPlus>  // centered challenge over the scene
  t(key, params?): string       // localized string, per-key English fallback
  iconRenderer: IconRenderer    // procedural coins/tokens/items — ZERO emoji
  reducedMotion: boolean        // skip non-essential motion
}
```

Every service is a **thin function adapter** (see `src/vignettes/types.ts`). A
vignette codes against these and **nothing else** — it never imports the
orchestrator, the npcRuntime, the economy store, or a sibling slice. This mirrors
the runtime-spine discipline in `contracts/runtime.ts`: functions injected,
internals hidden. That is exactly what makes a vignette a portable scene template.

---

## 3. Lifecycle (the host)

```ts
const host = createVignetteHost({ overlay, pauseWorld, resumeWorld, services, chrome })
registerBuiltinVignettes(host, { taxi: { destinations } })
// city portal: host.enter("taxi", { anchorId }) → VignetteResult | null
```

`host.enter(id, { anchorId })` runs the full lifecycle:

1. **guard** — one vignette at a time (`null` if already active / unknown id).
2. **`pauseWorld()`** — halt the sim + free the LLM (orchestrator wiring).
3. **recede chrome** — `chrome.set("menu")` (the vignette IS the surface, same
   full recede the menu uses); the prior state is remembered to restore on exit.
4. **create `.wp-vig-root`** INSIDE `.wp-overlay` (NEVER `document.body` — the
   host clips body-fixed modals; GAME_DEV_PLAYBOOK §4.2), transition **IN**
   (compositor-only opacity+transform, reduced-motion aware).
5. **build the context** (services + `mountRoot` + `anchorId` + `reducedMotion`).
6. **run** the scene until it exits (its own resolve, OR the framework Exit/ESC,
   OR a transit completing — all settle once).
7. **transition OUT**, remove the node.
8. **`dispose()`**, **`resumeWorld()`**, **restore chrome**.
9. **resolve** the `VignetteResult`.

The host mounts a **universal Exit affordance** (a ≥44px "Leave" chevron, top-left)
and an **ESC** handler into every root, so any vignette is always leavable even if
it forgets its own door. A scene can register `registerRootHooks(root, { exit,
exitLabel })` so the framework Exit runs the scene's own dismiss (e.g. relabel to
"Get out"). No `window.confirm/alert` (project rule).

### Styles

A single injected `<style data-wp-vignette>` block, namespaced `.wp-vig-*`
(framework) and `.wp-vig-taxi-*` (taxi). We do **not** touch the shared
`styles.css`. Note `.wp-vignette` (no `-vig-`) is the unrelated screen-space
color-effect div — never reuse it.

---

## 4. The taxi reference (sets the bar)

`createTaxiVignette({ destinations?, driverId?, driverName? })`:

- **Back-seat framing** — the driver is a procedural 2D paper-person billboard
  seen from behind (`driverArt.ts`), with an idle sway + drop shadow (HD-2D, never
  paper-thin). The city slides past the window as two parallax skyline strips; a
  seatbelt crosses the POV; the dashboard + door pillar frame the seat. A meter
  HUD ticks in the corner. Warm low-sun wash + soft vignette for mood.
- **The driver is a real Qwen3 NPC** — opened via `ctx.openNpc` into a lower
  dialogue tray (so it reads as "you, talking to the driver", not a centered
  modal). Persona = a warm, talkative city cabbie; small talk + "where to?". Falls
  back to scripted lines with no LLM. TARGET-language TTS throughout.
- **The purposeful beat** — pick a destination → a short `say-it-back` challenge
  EARNS the trip (drill the place name) → the taxi pulls up.
- **Pay the fare** — debited from the wallet in the Track's default currency
  (physical money). Can't afford it? The driver waives the difference — dignified,
  never a wall.
- **Transit result** — on arrival, resolves `{ travelTo: dest.anchorId, rewards }`
  so the city re-spawns the player at that landmark. Just chat + leave → `{}` (no
  travel). **No dark pattern forces the ride.**
- **Premium juice** — a two-note arrival ding (WebAudio, no asset), a fare-paid
  coin-pop, a reduced-motion path that flattens all of it.

---

## 5. How the city triggers a vignette (integration)

The orchestrator (game.ts) owns the wiring. See the INTEGRATION NOTE in the slice
hand-off, summarized:

1. **Build the host** once, after the overlay + chrome + services exist:
   ```ts
   const vignetteHost = createVignetteHost({
     overlay,                       // the .wp-overlay element
     pauseWorld: () => { setWorldActive(false); npcRuntime.onBackground() },
     resumeWorld: () => setWorldActive(true),
     chrome: { set: chrome.set, current: chrome.current },
     services: {
       learnerPair, scene, iconRenderer,
       speak: (lang, text) => hostApi.speak(lang, text),
       openNpc: adaptOpenNpc(npcRuntime, scene, quest, learnerPair),
       wallet: () => inventory(),               // balance/debit/defaultCurrency
       grant: (r) => inventory().applyReward(r),
       runChallenge: (a) => runChallenge(a.tool, a.ctx, chHost, { container: a.container, npc: a.npc }),
       t: (key, params) => t(key, immersion.uiLocale(), params),
     },
   })
   registerBuiltinVignettes(vignetteHost, { taxi: { destinations: taxiDestinations() } })
   ```
2. **Attach portals** — a topology anchor with a `vignette` tag (e.g. a taxi rank)
   becomes a portal: when the player is focused on it and taps "Enter" (or walks
   into the trigger), call:
   ```ts
   const result = await vignetteHost.enter("taxi", { anchorId })
   if (result?.travelTo) movement.respawnAt(result.travelTo)   // TRANSIT re-spawn
   if (result?.questStep) questEngine.advance(result.questStep)
   // rewards were already granted inside; the HUD reveal already fired.
   ```
   While `vignetteHost.isActive()`, suppress world portals/focus (the host already
   pauses the sim; this just stops re-triggering).
3. **`travelTo` → re-spawn** — `taxiDestinations()` maps REAL topology anchors to
   labels + fares; the chosen anchor id flows back as `travelTo`. The city moves
   the player there (camera + position), exactly as if they had walked. A taxi at
   anchor `taxi_rank_n` dropping you at `cathedral` = `movement.respawnAt("cathedral")`.

### Services the orchestrator must inject

| service       | bind to                                                        |
|---------------|----------------------------------------------------------------|
| `speak`       | `hostApi.speak(lang, text)`                                    |
| `openNpc`     | adapter over `npcRuntime.open` (synthesizes a `NpcRole` from the persona seed + scriptedFallback; returns `{ send, close, dispose }`) |
| `wallet`      | `() => inventory()` (it already has `balance`/`debit`/`defaultCurrency`) |
| `grant`       | `(r) => inventory().applyReward(r)` (+ optional badge deposit / econ-HUD reveal) |
| `runChallenge`| `(a) => runChallenge(a.tool, a.ctx, chHost, { container, npc })` |
| `t`           | the pack `t` bound to `immersion.uiLocale()`                   |
| `iconRenderer`| the shared `iconRenderer` from `items/itemArt.ts`             |
| `pauseWorld`  | `setWorldActive(false)` + `npcRuntime.onBackground()`         |
| `resumeWorld` | `setWorldActive(true)`                                         |
| `chrome`      | `{ set: chrome.set, current: chrome.current }`                |

The `openNpc` adapter is the only non-trivial bind: it maps `OpenNpcArgs`
(`persona`/`scriptedFallback`/`voiceCode`) onto a synthetic `NpcRole` and calls
`npcRuntime.open({ npcRole, scene, quest, learnerPair, container, npcName, voiceCode, starterChips, onClose })`,
returning the runtime handle's `{ send, close, dispose }`. The taxi never needs the
quest-engine/special-NPC machinery, so those args are omitted (generic-persona path).

---

## 6. The roster

| vignette        | kind      | status | notes |
|-----------------|-----------|--------|-------|
| **taxi**        | transit   | ✓ ref  | back-seat, driver NPC, fare, `travelTo` re-spawn |
| café            | interior  | planned| order at the counter; menu = corpus food entries; pay the bill |
| bank            | interior  | planned| teller; exchange currencies (reuse `economy/exchange`); withdraw |
| bus             | transit   | planned| multi-stop; buy a ticket; `travelTo` the chosen stop |
| subway          | transit   | planned| read the line map; tap in/out; `travelTo` a station anchor |
| airport gate    | transit   | planned| boarding-pass dialogue; long-haul `travelTo` to another Scene |
| restaurant      | interior  | planned| sit, order courses, converse with the waiter, settle the check |

Each is the SAME template: a framing (DOM + scoped `.wp-vig-*` CSS), a persona
for `openNpc`, a purposeful beat via `runChallenge`, an optional fare via the
wallet, and a `VignetteResult` (transit → `travelTo`; interior → `rewards`/
`questStep`). When v2 lands, "an arbitrary scene" is authored exactly this way —
**a Vignette is a self-contained scene template, so arbitrary scenes are just more
vignettes.**
```
