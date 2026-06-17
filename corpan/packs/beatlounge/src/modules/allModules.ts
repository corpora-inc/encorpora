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
import { createPhraseSamplerModule } from "./phrase-sampler"
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
 * Registration order IS the Stage bento order (dense flow). Grouped by the home
 * information architecture so related surfaces cluster as one reads down:
 *   • CYCLE + DRUMS   — Rhythmic Cycle, Drums.
 *   • SOUND           — Harmony, Instruments, Ribbon.
 *   • PHRASES         — Phrases, Phrase Jam, Scratch.
 *   • GLOBAL          — Mixer (now the home for per-track Effects + Players).
 *
 * Off the Stage: Scenes lives in the Dock-Rail (`hideOnStage`) — registered for
 * the nav button + its save/load actions, but no tile. Effects + Tweakers→Players
 * are folded INTO the Mixer (no standalone tiles). The old Piano-roll ("Synth")
 * tile is gone (the in-Instruments Score replaced it). Ribbon + Harmony are live
 * widgets (see their defs).
 */
export const registerAllModules = (registry: ModuleRegistry, deps: ModuleDeps): void => {
  // Scenes — Dock-Rail nav (hideOnStage; registered for nav + actions only).
  registry.register(createScenesModule(deps))
  // — cycle + drums —
  registry.register(createSongSetupModule(deps))
  registry.register(createStepGridModule(deps))
  // — sound: harmony · instruments · ribbon —
  registry.register(createComposerModule(deps))
  registry.register(createInstrumentsModule(deps))
  registry.register(createRibbonModule(deps))
  // — phrases —
  registry.register(createPhraseSamplerModule(deps))
  registry.register(createPhraseJamModule(deps))
  registry.register(createPhraseScratchModule(deps))
  // — global —
  registry.register(createMixerModule(deps))
}
