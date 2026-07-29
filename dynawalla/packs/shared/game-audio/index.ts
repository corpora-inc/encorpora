/**
 * Shared game audio safety: the one place 27 games agree about how loud they
 * are allowed to be.
 *
 * `createSafetyBus` — the graph a game's output must pass through.
 * `safeAttack`      — the shortest onset an envelope may use.
 * `VoiceBudget`     — the polyphony cap, with no timers and an injected clock.
 *
 * Usage, in a game's `start()`:
 *
 *     import { createSafetyBus, safeAttack, VoiceBudget }
 *       from "../../../packs/shared/game-audio/index.ts"
 *
 *     this.safety = createSafetyBus(ctx)
 *     this.master.connect(this.safety.input)   // NOT ctx.destination
 *
 * and in the game's envelope helper:
 *
 *     const a = safeAttack(attack)
 */
export {
  CEILING,
  KNEE,
  MIN_ATTACK,
  MAX_VOICES,
  FREE_VOICES,
  safeAttack,
  voiceScale,
  shaperCurve,
  shape,
  dbfs,
} from "./ceiling.ts"
export { VoiceBudget } from "./budget.ts"
export {
  createSafetyBus,
  type SafetyBus,
  type SafetyBusOptions,
  type BusContext,
} from "./safetyBus.ts"
