/**
 * Audio engine entry point.
 *
 * Re-exports the Web Audio SFX engine. Call sites use the `useSfx()` hook
 * (src/hooks/useSfx.ts), which wraps `getSfxEngine()` and respects
 * `settings.soundEffectsEnabled`.
 */
export { getSfxEngine } from "./SfxEngine"
export type { SfxEngine, SfxName } from "./SfxEngine"
