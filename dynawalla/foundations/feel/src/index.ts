// @dynawalla/feel — the game-feel foundation.
//
// The core has **no runtime dependencies**. Three.js appears only in
// `src/three/`, so a 2D prototype pays nothing for it and the same camera rig,
// tween pool and tier table serve both.

export { Feel, feel, type AttachOptions, type ReactOptions, type EmitFn } from "./feel.ts"
export { FeelClock, MAX_DT_MS, type Tick, type TickFn, type Channel } from "./clock.ts"
export { CameraRig, type CameraLike, type CameraRigOptions, type Vec3Like } from "./camera.ts"
export { Shake, Kick, noise1, type ShakeOptions } from "./shake.ts"
export { Spring1D, Spring3D } from "./spring.ts"
export {
  Tweens,
  CH_WORLD,
  CH_UI,
  CH_REAL,
  type TweenChannel,
  type TweenHandle,
  type ToOptions,
} from "./tween.ts"
export { Squash, pop, ANTICIPATION_MS, RELEASE_MS, type ScaleLike } from "./squash.ts"
export { ScreenFlash, type FlashOptions } from "./flash.ts"
export { FeelAudio, snapPentatonic, type FeelAudioOptions } from "./audio.ts"
export { Haptics, type HapticStyle, type HapticsOptions } from "./haptics.ts"
export {
  TIERS,
  TIER_ORDER,
  HARD,
  chooseTier,
  energy,
  type FeelTier,
  type TierName,
  type Outcome,
} from "./tiers.ts"
export {
  QUALITY,
  QualityGovernor,
  detectTier,
  readSignals,
  type QualityTier,
  type QualitySettings,
  type DetectSignals,
  type GovernorOptions,
} from "./quality.ts"
export {
  InputBuffer,
  Coyote,
  nearestTarget,
  COYOTE_MS,
  BUFFER_MS,
  HIT_SLOP_PX,
  TOUCH_CSS,
  type Target,
  type BufferedInput,
} from "./input.ts"
export * as ease from "./ease.ts"
export { EASE, cubicBezier, spring, spike, type EaseFn, type EaseName } from "./ease.ts"
