# Quest Flow — the deterministic, hand-held loop

Goal: "Walk to the **glowing person**, talk, do one tiny challenge, celebrate,
pick the next quest." Beginner quests = 1 step. No new subsystems — this builds on
the deterministic quest engine (`questState.ts`), the special-NPC stationing
(`specialNpc.ts` + `crowd.ts`), the `forcedOffer` Begin chip (`npcRuntime.ts`), and
the completion interlude (`questInterlude.ts`), all of which already exist.

## The owner's recurring pain (root cause, finally pinned down)

> "I got to the fountain, I stand on the star, and NOTHING happens. Shouldn't
> there be a special NPC there to help me?"

The deterministic machinery was already wired — engine gate, `forcedOffer` Begin
chip, advance-on-win, interlude. The miss was **visibility + a landmark mismatch**:

1. **The objective NPC was indistinguishable.** A special (or generic
   "objective") agent IS stationed at the active step's anchor and hovers there —
   but it looked exactly like the 28 wandering townsfolk. Nothing said "talk to
   THIS one." There was no glow, no marker over its head.
2. **The star pointed at a place the owner didn't read as the objective.** The
   entry quest `es-cafe-travel` step anchor is `plaza` (the spawn, world `(0,12)`).
   The dominant visible landmark is the **fountain** at `(0,0)`, 12u away. The
   owner walks to the obvious fountain, stands there, and the objective NPC +
   star are 12u north — so "nothing happens." (And `es-directions`'s step anchor
   literally IS `fountain`, which only deepened the confusion across quests.)

## The fix (this round)

### 1. A glowing objective BEACON over the NPC — `src/wayfinding/objectiveBeacon.ts`

An unmissable, three-part, self-lit, warm-accent marker that hovers over the
objective NPC's **live** position (it tracks the hovering NPC, not a static spot):

- a tall vertical **light shaft** (a Y-billboarded column) visible over rooftops
  from anywhere in the plaza — the "here!" pillar;
- a bobbing downward **chevron** just above the head ("this one");
- a soft ground **ring** at the feet (the star, but welded to the *person* so the
  two can never disagree).

Self-lit, `disableDepthWrite`, `renderingGroupId 3` (draws THROUGH the world — a
beacon you can see from anywhere), `alwaysSelectAsActiveMesh` (no frustum pop),
gentle breathing pulse (static under reduced motion). Pure consumer mirroring
`roadArrow`: injected `getTarget()` + `isSuppressed()`, ticked `update(dt)`,
`dispose()`. Hidden when no active objective or while a dialogue/challenge owns
the screen.

### 2. The objective's LIVE point — `src/quest/objectiveLocator.ts`

`locateObjective(anchorId, focusables, anchorPoint)` returns the stationed
objective NPC's **live** world point (find the focusable whose `anchorId` ===
the step anchor → its billboard position), falling back to the static city anchor
when no NPC is placed there. Both the beacon AND the road arrow consume this, so
they always agree on WHERE the objective is. Pure + unit-tested
(`objectiveLocator.test.ts`).

### 3. Named beginner helpers — `content/npc/special.json`

The three beginner quests now declare a `duty:"deliver"` special at their step
anchor, so the objective NPC is a **named** helper (the café host / market vendor
/ a helpful local) with a fitting persona tone, not an anonymous "a local":

| quest             | anchor     | helper            |
| ----------------- | ---------- | ----------------- |
| `es-cafe-travel`  | `plaza`    | the café host     |
| `es-market-haggle`| `market`   | the market vendor |
| `es-directions`   | `fountain` | a helpful local   |

Mechanically these are stationed identically to before; the difference is a real
name in the dialogue header + a warm tone. Their `nameKey`s
(`special.cafe.plaza.name`, etc.) fall back to the English `name` until the i18n
teammate localizes them — no behavior change meanwhile.

Because these steps are **challenge-gated** (a `toolId`, no inventory rule), the
special's `stepState` is `"needs-challenge"` → **no** spurious hand-over chip
fires; the `forcedOffer` "Begin" challenge chip drives the launch, and game.ts
marks-beaten + advances on the win. The deliver hand-over path stays dormant for
these quests (it's for the inventory-gated Guadalajara chain).

## Why the deterministic loop is now complete

- **Guaranteed objective NPC** at every step anchor (special.json for beginners +
  the generic objective-station fallback in game.ts for any uncovered anchor).
- **Impossible to miss** — the beacon glows over the right person; the road arrow
  + the beacon + the map star all resolve through `locateObjective`, so they
  agree.
- **Deterministic Begin → win → advance** — `forcedOffer` always surfaces the
  Begin chip (bypassing `resolveGameOffer`'s empty-whitelist null); on win game.ts
  `markStepBeaten` + `advance`, no LLM dependence. Steps with no `toolId` default
  to `repeat-after`.
- **Juicy completion + next pick** — the engine's `complete` event opens the
  interlude (`questInterlude.ts`); picking a card calls `setActiveQuest`, which
  re-points the engine, markers, capsule, road arrow, AND the beacon (all read the
  live proxy engine).

## game.ts wiring (the lead owns game.ts — this is the exact change)

`game.ts` already imports `createRoadArrow` and resolves the objective via
`city.getAnchor(...)`. Three small additions:

1. **Import** (top, near `createRoadArrow`):
   ```ts
   import { createObjectiveBeacon } from "./wayfinding/objectiveBeacon"
   import { locateObjective } from "./quest/objectiveLocator"
   ```
2. **A shared objective-point resolver** (near the `roadArrow` block, ~line 1045).
   Replace the road arrow's inline `getTarget` and add the beacon so both agree:
   ```ts
   // The objective NPC's LIVE point (it hovers near its anchor): track the actual
   // person, falling back to the static anchor when none is stationed there.
   const objectivePoint = (): { x: number; z: number } | null => {
     const obj = questEngine.getQuestMarkers().find((m) => m.kind === "objective")
     return locateObjective(
       obj?.anchorId,
       crowd.focusables,
       (id) => {
         const a = city.getAnchor(id)
         return a ? { x: a.x, z: a.z } : null
       },
     )
   }
   const roadArrow = createRoadArrow(world.scene, {
     getPlayer: () => ({ ...player.getPos(), facing: player.getFacing() }),
     getTarget: objectivePoint,
     accent: scene.palette?.accent,
   })
   // The glowing "talk to THIS person" beacon over the objective NPC. Suppressed
   // while a dialogue/challenge/vignette owns the screen.
   const objectiveBeacon = createObjectiveBeacon(world.scene, {
     getTarget: objectivePoint,
     isSuppressed: () => !!openDialogue || challengeDepth > 0 || vignetteHost.isActive(),
     accent: scene.palette?.accent,
   })
   ```
   (`challengeDepth` and `vignetteHost` are already in scope in game.ts.)
3. **Tick** in the frame loop, right after `roadArrow.update(dt)` (~line 1098):
   ```ts
   objectiveBeacon.update(dt)
   ```
4. **Dispose** in `teardown()`, next to `roadArrow.dispose()`:
   ```ts
   objectiveBeacon.dispose()
   ```

No `setActiveQuest` change needed — the beacon reads `questEngine.getQuestMarkers()`
through the live proxy, so it re-points automatically when the interlude swaps the
active quest.

## Challenge presentation fixes (same round)

Two challenge-UX corrections, both about how a challenge presents:

### Bailing is not a win

X / ESC / backdrop-tap dismissal must NOT celebrate. The overlay already routed
all of those through `doCancel` (→ `onCancel`, no reward reveal) — but the game's
post-challenge `.then` ran the reward/badge/advance handling on EVERY resolve.
`runChallenge` now tags the result with `outcome: "completed" | "aborted"`
(additive optional field on `ChallengeResultPlus`; `makeResult` → "completed",
`emptyResult` → "aborted"), and game.ts early-returns on `"aborted"` before any
celebration or `markStepBeaten`/`advance`. (A cancel already carried zero rewards
+ score 0, so this is belt-and-braces over the existing safety, and makes the
intent explicit instead of relying on score 0.)

**game.ts edit (lead owns game.ts)** — at the top of the `runChallenge(...).then((res) => {`
handler (~line 669), add:
```ts
.then((res) => {
  // Bailing out (X / ESC / backdrop) is NOT a win: no reward reveal, no win
  // juice, no quest advance. Only an actual completion celebrates.
  if (res.outcome === "aborted") return
  const granted = inventory().applyReward(res.rewards)
  // …unchanged…
```

### Instruction = a quiet caption, never a spoken bubble

The challenge meta-instruction now renders via `overlay.setInstruction(text)` — a
small, secondary, uppercase-tracked caption (`.wp-ch-instruction`) at the top of
the card — distinct from `setPrompt`, which is now reserved for actual STIMULUS
content (the phrase to read/say, the word to build, the conjugation stem). The
instruction-only tools (the choice family's "Which is it?", unscramble/build-order,
missing-line, which-typo, memory/sort/memorise/find-hidden, picture-match,
which-meant, which-rhymes) were migrated `setPrompt → setInstruction`. Instructions
were NEVER passed to TTS — only the target-language stimulus (`overlay.speak(...)`)
is voiced — so this is purely a visual/register change; the NPC's spoken dialogue
and the challenge's stimulus audio are untouched. No game.ts change needed (all in
`overlay.ts` + the tool files + `challenge.css`).

## Verify (standalone `:5174`)

Fresh start → the entry quest `es-cafe-travel` is active → a glowing beacon
(shaft + chevron + ring) stands over the café host at the **plaza** (right where
you spawn) → walk up, tap Talk → the **Begin** chip appears after the greeting →
tap it → the `repeat-after` challenge launches → repeat the phrase → on win the
step advances → the quest completes → the completion interlude celebrates +
offers 2–3 next quests → picking one re-points the beacon + arrow + star at the
new objective.
