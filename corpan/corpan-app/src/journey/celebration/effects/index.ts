// effects/index.ts — the celebration-effect registry public surface.
export type {
  CelebrationEffect,
  EffectContext,
  EffectIntensity,
} from "./types.ts"
export { INTENSITY_RANK } from "./types.ts"
export {
  EFFECTS,
  eligibleEffects,
  isEligible,
  effectWeight,
  createEffectPicker,
  type EffectPicker,
  type EffectPickerOpts,
} from "./registry.ts"
