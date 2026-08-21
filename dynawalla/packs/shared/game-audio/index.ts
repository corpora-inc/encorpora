/**
 * Shared game audio safety: the one place 27 games agree about how loud they
 * are allowed to be.
 *
 * `createSafetyBus` — the graph a game's output must pass through.
 * `safeAttack`      — the shortest onset an envelope may use.
 * `VoiceBudget`     — the polyphony cap, with no timers and an injected clock.
 * `playVoice`       — the synthesis for a `game-soundscape` voice, including
 *                     the rubble recipe, so no pack writes its own.
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
 *
 * A game does not have to do anything else to honour the app's Sound setting.
 * `game-host` publishes it through `setHostSound`, every live bus follows it,
 * and a bus the app has closed cannot be reopened by the game's own mute
 * button. See `sound.ts`.
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
export { setHostSound, hostSoundAllowed, onHostSound, resetHostSound } from "./sound.ts"
export {
  RUBBLE_CEILING_HZ,
  RUBBLE_GRAINS,
  TONE_CEILING_HZ,
  playVoice,
  voiceBrightestHz,
  voiceGrains,
  voicePeak,
  type Grain,
  type PlayableVoice,
  type VoiceContext,
  type VoiceTimbre,
} from "./voices.ts"
