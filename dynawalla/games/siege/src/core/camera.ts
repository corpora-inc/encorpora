/**
 * Screen shake (trauma model), zoom punch, and the photosensitivity-safe flash.
 *
 * Trauma, not offset: callers add trauma, shake is trauma² so small hits barely
 * register and big ones are violent, and it decays on its own. Rotation is
 * included because pure translation reads as a glitch, not a punch.
 */
import { clamp01, easeOutQuint } from "./easing.ts";
import { makeRng } from "./rng.ts";

/** Hard ceiling: no more than 3 full-screen luminance flashes per second. */
const FLASH_MIN_INTERVAL = 0.34;
const FLASH_MAX_ALPHA = 0.3;

export class Camera {
  trauma = 0;
  shakeX = 0;
  shakeY = 0;
  shakeRot = 0;
  /** multiplicative zoom, 1 = neutral */
  zoom = 1;
  private punch = 0;
  private punchT = 1;
  private punchDur = 0.26;
  flashAlpha = 0;
  private flashPeak = 0;
  private flashT = 1;
  private lastFlashAt = -10;
  private t = 0;
  private rng = makeRng(0x1a2b3c);
  reducedMotion = false;

  addTrauma(v: number): void {
    if (this.reducedMotion) return;
    this.trauma = clamp01(this.trauma + v);
  }

  /** zoom punch: snaps to 1+amount then eases back with easeOutQuint */
  addPunch(amount: number, durationSec = 0.26): void {
    if (this.reducedMotion) return;
    if (amount <= this.punch && this.punchT < 0.4) return;
    this.punch = amount;
    this.punchDur = durationSec;
    this.punchT = 0;
  }

  /** rate-limited full-screen flash. Silently refused if it would exceed 3 Hz. */
  flash(alpha: number, now: number): void {
    if (this.reducedMotion) return;
    if (now - this.lastFlashAt < FLASH_MIN_INTERVAL) return;
    this.lastFlashAt = now;
    this.flashPeak = Math.min(FLASH_MAX_ALPHA, alpha);
    this.flashT = 0;
  }

  reset(): void {
    this.trauma = 0;
    this.shakeX = this.shakeY = this.shakeRot = 0;
    this.zoom = 1;
    this.punch = 0;
    this.punchT = 1;
    this.flashAlpha = 0;
    this.flashT = 1;
    this.lastFlashAt = -10;
  }

  /** driven by WALL time so a hitstop does not freeze the shake — that is the point */
  update(dt: number): void {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - 1.75 * dt);

    const s = this.trauma * this.trauma;
    if (s > 0.00001) {
      // two out-of-phase sinusoids per axis reads as physical, pure random reads as noise
      const f = 34;
      this.shakeX = (Math.sin(this.t * f) * 0.6 + this.rng.r(-0.4, 0.4)) * s * 26;
      this.shakeY = (Math.cos(this.t * f * 1.17) * 0.6 + this.rng.r(-0.4, 0.4)) * s * 26;
      this.shakeRot = Math.sin(this.t * f * 0.83) * s * 0.022;
    } else {
      this.shakeX = this.shakeY = this.shakeRot = 0;
    }

    if (this.punchT < 1) {
      this.punchT = Math.min(1, this.punchT + dt / this.punchDur);
      this.zoom = 1 + this.punch * (1 - easeOutQuint(this.punchT));
    } else {
      this.zoom = 1;
    }

    if (this.flashT < 1) {
      this.flashT = Math.min(1, this.flashT + dt / 0.19);
      // ease out fast — a lingering white sheet is what triggers people
      this.flashAlpha = this.flashPeak * (1 - this.flashT) * (1 - this.flashT);
    } else {
      this.flashAlpha = 0;
    }
  }
}
