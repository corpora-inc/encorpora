/**
 * Trauma-based screen shake (Squirrel Eiserloh model). External impulses add
 * "trauma" (0..1); the actual shake offset scales with trauma^2 so small events
 * barely nudge and big ones slam. Trauma decays linearly so the screen settles
 * quickly. We sample smooth pseudo-noise (summed sines) instead of pure random
 * so the motion reads as a physical jolt, not white-noise jitter.
 */
export class ScreenShake {
  private trauma = 0;
  private t = 0;
  private maxOffset: number;
  private maxAngle: number;

  // Current resolved offsets (CSS px) + rotation (radians), read by the orchestrator.
  offsetX = 0;
  offsetY = 0;
  angle = 0;

  constructor(maxOffsetPx = 22, maxAngleRad = 0.035) {
    this.maxOffset = maxOffsetPx;
    this.maxAngle = maxAngleRad;
  }

  /** Add an impulse. amount 0..1 (clamped, additive). */
  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  get active(): boolean {
    return this.trauma > 0.0001;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.trauma <= 0) {
      this.offsetX = this.offsetY = this.angle = 0;
      return;
    }
    // Decay (full trauma settles in ~0.9s).
    this.trauma = Math.max(0, this.trauma - dt * 1.1);
    const shake = this.trauma * this.trauma;
    const ta = this.t * 32;
    this.offsetX = this.maxOffset * shake * noise(ta, 0);
    this.offsetY = this.maxOffset * shake * noise(ta, 17.3);
    this.angle = this.maxAngle * shake * noise(ta, 41.7);
  }

  reset(): void {
    this.trauma = 0;
    this.offsetX = this.offsetY = this.angle = 0;
  }
}

/** Smooth, deterministic [-1,1] noise from summed sines (cheap, no allocation). */
function noise(t: number, seed: number): number {
  const s =
    Math.sin(t * 1.0 + seed) * 0.6 +
    Math.sin(t * 2.17 + seed * 1.7) * 0.3 +
    Math.sin(t * 4.31 + seed * 0.5) * 0.1;
  return s;
}
