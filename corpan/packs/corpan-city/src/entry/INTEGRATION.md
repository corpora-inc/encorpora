# Corpan City — Entry / Stack Reactivity integration (`src/entry/*`)

This slice makes `learnerPair` derive from the LIVE Corpán stack (not the
hardcoded `quest.learnerPair`) and adds the premium welcome + multi-target
language chooser. It owns ONLY `src/entry/*`. Below is the exact `game.ts`
wiring the orchestrator applies at integration. **No edits to `game.ts` were
made by this agent** — this is the patch the orchestrator/owner applies.

## What changes in `game.ts`

### 1. Import the entry seam

```ts
import { resolveEntry, bindStackReactivity, samePair } from "./entry"
```

### 2. Resolve `learnerPair` from the stack BEFORE building the world

`startGame(container, host)` currently: loads identity → `begin(identity)` →
`buildWorld(...)`. Wrap the world build so it FIRST resolves the entry against
the live stack, runs the chooser/welcome, then builds with the derived pair.

The cleanest shape (keeps onboarding as-is, then runs entry):

```ts
export function startGame(container: HTMLElement, host?: unknown): GameHandle {
  let disposed = false
  let teardownWorld: (() => void) | null = null
  let stopReactivity: (() => void) | null = null
  const npcHost = (host as NpcHostApi | undefined) ?? createMockHost()
  const chHost = host ? createChallengeHost(host as CorpanChallengeHostApi) : mockChallengeHost()

  // Build (or REBUILD) the world for a given pair. Tearing down + rebuilding is
  // safe because all per-Track state keys on the pair; this is the reactive path.
  const buildFor = (identity: OnboardingResult, learnerPair: LearnerPair) => {
    if (disposed) return
    teardownWorld?.()
    teardownWorld = buildWorld(container, npcHost, chHost, identity, learnerPair) // (+ new arg)
  }

  const begin = async (identity: OnboardingResult) => {
    if (disposed) return
    // Premium welcome + (multi-target) language chooser; derives the pair from
    // the live stack. `container` is the host's accepted render surface; the
    // surfaces mount a fullscreen root into it (same as onboarding).
    const { learnerPair } = await resolveEntry({
      host,
      container,
      accent: "#e8b54a",           // or the scene accent once known
      playerName: identity.name.displayName,
      place: "Corpan City",
    })
    buildFor(identity, learnerPair)

    // REACTIVITY: exit → flip stack in Corpán → return rebinds the world. A flip
    // arriving mid-session rebuilds to the new stack's first target (no modal
    // yanked over the player; the chooser is for intentional entry).
    stopReactivity = bindStackReactivity(
      host,
      () => currentPairRef(),          // however game.ts exposes the live pair
      (nextPair) => buildFor(identity, nextPair),
    )
  }

  // …existing identity load → begin(saved) / runOnboarding(...).then(begin)…

  return {
    dispose: () => {
      disposed = true
      stopReactivity?.()
      teardownWorld?.()
      teardownWorld = null
      container.replaceChildren()
    },
  }
}
```

### 3. `buildWorld` takes the pair as an argument (drop the hardcoded line)

Currently line 137:

```ts
const learnerPair = quest.learnerPair          // ← DELETE (the bug source)
```

Replace by threading the resolved pair in as a parameter:

```ts
function buildWorld(
  container, npcHost, chHost, identity,
  learnerPair: LearnerPair,                      // ← NEW PARAM
): () => void {
  // …everything downstream already reads `learnerPair` unchanged…
}
```

Every existing consumer (`econHud.locale`, `badges` trackKey/lang/label, the
`uiLocale`, `mapOpts.lang`, `placeTag.lang`, `anchorName(... learnerPair.target)`,
`npcRuntime.open({ learnerPair })`, the challenge `ChallengeContext`,
`adaptOpenNpc`, the vignette `services.learnerPair`) keeps working byte-for-byte
— they already key off the local `learnerPair`. Only its SOURCE changes.

> `quest.learnerPair` stays in the contract/JSON (the quest is still a template),
> but it is NO LONGER read for the world's pair. The Quest-Loop agent reads the
> orchestrator's `learnerPair` (this derived one), not the JSON's.

## Host stack API used

From `corpan-app/src/contentPacks/types.ts` `HostApi`:

- `getStackConfig(): StackConfig` — read on entry + on each reactive fire.
- `onStackConfigChange(listener): () => void` — the reactive subscription.

`StackConfig.languages` is ordered per `SINGLE_LANGUAGE_RULE`: `[0]` = primary /
native (UI language), `[1..]` = target languages. Both members are feature-
detected (`src/entry/stackAdapter.ts`), so a missing/older host (or standalone
dev) falls back to `DEFAULT_PAIR` (`es`/`en`) with no crash.

## Single-language handling (SINGLE_LANGUAGE_RULE)

- `targetsOf(stack)`: 0 langs → `[DEFAULT_PAIR.target]`; 1 lang → `[that lang]`
  (immersion); ≥2 → `languages[1..]` de-duped, primary removed.
- `pairFor(stack, target)`: native = `languages[0]`, EXCEPT a single-language
  stack (or `target === primary`) mirrors `native ← target` (immersion — there is
  no separate gloss). `isImmersion(pair)` = `target === native`.
- The chooser only appears when `targets.length > 1`, so a single-language /
  single-target stack goes straight to the welcome (which reads "practice" for
  immersion vs "today's goal: learn X" otherwise).

Downstream consumers that need a non-null `native: LanguageCode` keep working
(immersion just yields `native === target`); an immersion-aware consumer can call
`isImmersion()` (re-exported from `./entry`) to suppress glosses.

## Reactivity contract recap

- `bindStackReactivity(host, getCurrentPair, onChange)` subscribes and fires
  `onChange(nextPair, nextStack)` ONLY when the derived default pair actually
  differs from the world's current pair (no rebuild on unrelated axis changes
  like `rate`). Returns an unsubscribe — call it in `dispose`.
- The recommended `onChange` is a full world teardown+rebuild with the new pair
  (per-Track state keys on the pair). That's the simplest correct rebind.

## Verification (headless, mock host)

`qa/entry.html` + `qa/entry.mjs` mount the entry surfaces against mock stacks;
`node qa/entry.mjs.run.mjs` (vite dev on :5174) asserts all cases and screenshots
to `/tmp/wp-entry-*.png`. Verified:
multi-target → chooser (3 tiles) → pick → `fr-from-en`; single-target → no
chooser → `es-from-en`; **flipped `es,en` → `en-from-es` (the original bug)**;
single-language `es` → immersion `es/es` (no chooser, welcome reads "practice");
reactivity fires once on flip with the new pair; silent re-resolve → first
target.
