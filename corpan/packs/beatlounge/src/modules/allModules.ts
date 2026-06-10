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

export interface ModuleDeps {
  store: BeatloungeStore
  audio: AudioFacade
  host: BeatloungeHost
}

export const registerAllModules = (registry: ModuleRegistry, deps: ModuleDeps): void => {
  registry.register(createStepGridModule(deps))
  // ---- Wave 2 modules (integrator wires each as it lands) ----
  // registry.register(createDrumPadsModule(deps))
  // registry.register(createPianoRollModule(deps))
  // registry.register(createMixerModule(deps))
  // registry.register(createFxRackModule(deps))
  // registry.register(createPhraseSamplerModule(deps))
}
