/**
 * Photosensitivity governor. This is a children's product; this file is a safety
 * device, not an effect.
 *
 * WCAG 2.3.1 forbids more than three general flashes in any one second. We enforce a
 * hard floor of 340 ms between accepted *global* flashes (≤ 2.94 Hz) regardless of
 * tempo, cap the luminance a single flash can add, and refuse outright under
 * `prefers-reduced-motion`. Anything smaller than a quarter of the viewport is a
 * local highlight, not a general flash, and is not governed here.
 *
 * `accepted` and `rejected` are counted so a test can prove the limiter holds under
 * a 60-per-second request storm.
 */

export const MIN_FLASH_INTERVAL_SEC = 0.34;
export const MAX_FLASH_LUMINANCE = 0.16;

export class FlashGovernor {
  private last = -Infinity;
  private value = 0;
  private readonly reduced: () => boolean;
  accepted = 0;
  rejected = 0;

  constructor(reduced: () => boolean) {
    this.reduced = reduced;
  }

  /** Returns true when the flash was allowed. Never throws, never queues. */
  request(now: number, intensity: number): boolean {
    if (this.reduced()) {
      this.rejected++;
      return false;
    }
    if (now - this.last < MIN_FLASH_INTERVAL_SEC) {
      this.rejected++;
      return false;
    }
    this.last = now;
    this.accepted++;
    this.value = Math.min(MAX_FLASH_LUMINANCE, Math.max(this.value, intensity * MAX_FLASH_LUMINANCE));
    return true;
  }

  /** Decays fast — a flash is a transient, not a wash. */
  update(dt: number): void {
    this.value = Math.max(0, this.value - dt * 1.9);
  }

  /** Current additive luminance, already clamped to the legal maximum. */
  get level(): number {
    return Math.min(MAX_FLASH_LUMINANCE, this.value);
  }

  reset(): void {
    this.value = 0;
    this.last = -Infinity;
  }
}
