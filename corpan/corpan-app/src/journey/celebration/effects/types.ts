// src/journey/celebration/effects/types.ts — the pluggable celebration-effect
// contract (PREMIUM_SCROLL §3.4). An effect is a self-contained, self-cleaning
// visual flourish. The CelebrationLayer owns ONE overlay + ONE particle canvas
// and rotates through a registry of these on every correct — so we can invent
// many effects and plug them in without touching the layer.
//
// Effects are cheap by construction: CSS 3D transforms (Web Animations API) and
// the shared canvas only — NO per-correct WebGL/Babylon/Three. Every effect
// participates in NO layout flow (absolute children of an inset-0 overlay).

/** The intensity floor an effect needs. minimal shows NO effects (text only). */
export type EffectIntensity = "reduced" | "full"

export const INTENSITY_RANK: Record<"minimal" | "reduced" | "full", number> = {
  minimal: 0,
  reduced: 1,
  full: 2,
}

/** Everything an effect needs to draw itself, resolved by the layer per moment. */
export interface EffectContext {
  /** Combo depth for this moment (drives escalation + density). */
  comboCount: number
  /** A clean, fast, hint-free first try — earns BONUS flair (gold), not a gate. */
  perfect: boolean
  /** The celebration tier (1 = correct, 2 = milestone). */
  tier: number
  /** The learner asked for reduced motion — no 3D spin. */
  reducedMotion: boolean
  /** Effective juice intensity (already downgraded for reduced-motion). */
  intensity: "minimal" | "reduced" | "full"
  /** Center X in overlay-local px (anchor midpoint, else overlay center). */
  cx: number
  /** Center Y in overlay-local px. */
  cy: number
  /** Overlay width in px. */
  width: number
  /** Overlay height in px. */
  height: number
  /** Base accent hue (course/app purple ~262). */
  hue: number
  /** The shared, pre-sized particle canvas (confetti reuses it). */
  canvas: HTMLCanvasElement | null
}

export interface CelebrationEffect {
  /** Stable id (rotation memory + tests). */
  id: string
  /** How long the effect runs, in ms (informs the layer's cleanup budget). */
  durationMs: number
  /** Minimum effective intensity to run at. */
  minIntensity: EffectIntensity
  /** Uses CSS 3D spin ⇒ excluded under reduced-motion. */
  uses3d: boolean
  /** 0..1 visual energy — drives combo-weighting (calm low, fireworks high). */
  energy: number
  /** Combo depth below which the effect is withheld (keeps early cards calm). */
  minCombo?: number
  /**
   * Draw into `container` (an absolute, inset-0, pointer-events-none host).
   * MUST return a cleanup that cancels animations + removes any nodes it added.
   */
  render(container: HTMLElement, ctx: EffectContext): () => void
}
