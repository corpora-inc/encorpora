# Wiring NPC dialogue into the game

The NPC AI dialogue system is self-contained under `src/npc/`. It does **not**
touch `src/game.ts`, `src/world/*`, `src/movement/*`, or `src/scene/*`. The game
orchestrator wires it into the existing NPC engage hook.

## Where it plugs in

`src/game.ts` already builds `createNpcFocus(...)` with an `onEngage(it)` callback
(today it just rings + toasts a greeting). Replace the body of that callback with
a `createNpcRuntime(...).open(...)` call. You have, in scope at that point:

- `overlay` — the `.wp-overlay` element (mount the panel here; it positions
  itself absolutely over the canvas).
- `scene` — the parsed `Scene` (already `WorldSceneSchema.parse(sceneJson)`).
- `it: Interactable` — `{ anchorId, kind: "npc", billboard }`. `it.anchorId`
  is the **NpcRole id** (the scene's `npcSkins` are keyed by it).

## Minimal wiring (drop-in)

```ts
import { createNpcRuntime } from "./npc/npcRuntime"
import rolesJson from "../content/npc/roles.json"
import questJson from "../content/quests/es-cafe.json"
import { NpcRole, Quest } from "@corpan-city/contracts"

// once, at startGame() top — validate content + build the runtime.
// `hostApi` is the real Corpán HostApi when running as a pack; in standalone
// dev use `createMockHost()` from "./npc/mockHost".
const roles = NpcRole.array().parse(rolesJson)
const quest  = Quest.parse(questJson)
const npcRuntime = createNpcRuntime(hostApi)
const learnerPair = { target: "es", native: "en" } // from host stackConfig later

let openDialogue: { close(): void } | null = null

// inside createNpcFocus(..., (it) => { ... }) — the onEngage callback:
const role = roles.find((r) => r.id === it.anchorId)
if (!role) { /* not an AI NPC — keep the old greeting toast */ return }
openDialogue?.close()                 // only one conversation at a time
juice.ring(it.billboard.root.position.x, it.billboard.root.position.z, scene.palette?.accent)
openDialogue = npcRuntime.open({
  npcRole: role,
  scene,
  quest,
  learnerPair,
  container: overlay,                 // the .wp-overlay element
  onIntent: (intent) => {
    // hook into quest/economy/challenge systems as they land:
    //   intent.kind === "callTool"  → launch the challenge tool (intent.tool, intent.spec)
    //   intent.kind === "reward"    → grant XP/coins
    //   intent.kind === "questStep" → mark the step done
    //   intent.kind === "end"       → conversation closed itself
  },
})
```

## Lifecycle to forward (recommended, not required for a spike)

- **App background / page hidden** → call `npcRuntime.onBackground()` so the
  broker unloads the ~2.5 GB resident model (iOS jetsam bait on background). E.g.
  `document.addEventListener("visibilitychange", () => { if (document.hidden) npcRuntime.onBackground() })`.
- **Game dispose** → `openDialogue?.close()` then `await npcRuntime.dispose()`
  (cancels any in-flight stream, unloads the model, clears the idle timer).

## Behavior notes

- The model is **lazy-loaded on the first `open()`** and stays resident across
  turns; after a conversation closes it becomes idle-eligible and the broker
  reclaims it ~105 s later. Back-to-back NPC chats stay warm and fast.
- If `hostApi.llm` is absent, the model isn't installed, or a load fails, the
  panel runs the NPC's `scriptedFallback` lines — **NPCs always work**.
- TTS uses `hostApi.speak(voiceCode, prose)`; `voiceCode` defaults to the scene's
  `npcSkins[role.id].voiceHint`, then the learner's target language.
- Voice input is stubbed today (keyboard floor). When the native-STT plugin
  lands, swap the backend at `resolveVoiceInput()` in `voiceInput.ts` — no game
  logic changes.

## Standalone / QA

- `qa/npc.html` + `qa/npc-mount.ts` mount the dialogue with the **mock host**
  (no model). `node qa/npc.mjs` drives a streamed conversation + a parsed
  tool-call in WebKit and screenshots `/tmp/wp-npc-stream.png` and
  `/tmp/wp-npc-tool.png`.
- `npx vitest run src/npc/npc.test.ts` validates the sample content against the
  contracts and the prompt/tool-parser logic.
```
