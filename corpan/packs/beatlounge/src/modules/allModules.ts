/**
 * beatlounge — central module registration. App calls registerAllModules once;
 * every Wave-2 team's module is wired in HERE by the integrator (teams export a
 * `createXModule(deps)` factory and never edit App.tsx or this file's call site,
 * so the registration point stays conflict-free across parallel worktrees).
 *
 * The shell lays out whatever is registered as Stage tiles; the LLM command bus
 * indexes every registered module's actions. Adding a widget is one line here.
 */

import type { AudioFacade } from "../contracts/audioFacade"
import type { BeatloungeHost, ModuleRegistry } from "../contracts/module"
import type { BeatloungeStore } from "../store/store"
import { createStepGridModule } from "./step-grid"
import { createMixerModule } from "./mixer"
import { createFxRackModule } from "./fx-rack"
import { createPhraseSamplerModule } from "./phrase-sampler"
import { createTweakersModule } from "./tweakers"
import { createSongSetupModule } from "./song-setup"
import { createInstrumentsModule } from "./instruments"
import { createRibbonModule } from "./ribbon"
import { createComposerModule } from "./composer"
import { createPhraseJamModule } from "./phrase-jam"
import { createPhraseScratchModule } from "./phrase-scratch"
import { createScenesModule } from "./scenes"

export interface ModuleDeps {
  store: BeatloungeStore
  audio: AudioFacade
  host: BeatloungeHost
}

/**
 * Registration order IS the Stage bento order (dense flow). Grouped by adjacency
 * so related surfaces cluster:
 *   • SESSION   — Rhythmic Cycle, Scenes (define the piece, near the top).
 *   • INSTRUMENTS — Instruments, Ribbon (live play strip), Harmony (popover).
 *   • DRUMS     — the live groove widget.
 *   • PHRASES   — Phrases, Phrase Jam, Scratch.
 *   • MIX       — Effects, Mixer, Tweakers.
 *
 * The old standalone Piano-roll ("Synth") tile is gone from Home — the in-
 * Instruments Score replaces it (the module code is kept for reuse, just not
 * registered). The Ribbon + Harmony tiles are now LIVE widgets (see their defs).
 */
export const registerAllModules = (registry: ModuleRegistry, deps: ModuleDeps): void => {
  // — session —
  registry.register(createSongSetupModule(deps))
  registry.register(createScenesModule(deps))
  // — instruments —
  registry.register(createInstrumentsModule(deps))
  registry.register(createRibbonModule(deps))
  registry.register(createComposerModule(deps))
  // — drums —
  registry.register(createStepGridModule(deps))
  // — phrases —
  registry.register(createPhraseSamplerModule(deps))
  registry.register(createPhraseJamModule(deps))
  registry.register(createPhraseScratchModule(deps))
  // — mix —
  registry.register(createFxRackModule(deps))
  registry.register(createMixerModule(deps))
  registry.register(createTweakersModule(deps))
}
