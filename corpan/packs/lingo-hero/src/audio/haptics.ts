/**
 * haptics.ts — navigator.vibrate wrappers, fully guarded for unsupported
 * platforms (iOS Safari, desktop). Every call is a safe no-op when the API is
 * missing, and patterns are kept short to respect battery + OS throttling.
 *
 * We also honor prefers-reduced-motion: vibration is a form of motion feedback,
 * so users who asked for reduced motion get no haptics.
 */

type VibratePattern = number | number[];

function canVibrate(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  );
}

export class Haptics {
  private enabled: boolean;

  constructor() {
    let reduced = false;
    try {
      reduced =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
    this.enabled = canVibrate() && !reduced;
  }

  setEnabled(on: boolean): void {
    this.enabled = on && canVibrate();
  }

  private fire(pattern: VibratePattern): void {
    if (!this.enabled) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers throw on certain patterns / focus states; ignore.
    }
  }

  /** Crisp single tick scaled lightly by combo for escalating feedback. */
  hit(combo: number): void {
    const ms = combo >= 10 ? 22 : combo >= 5 ? 16 : 12;
    this.fire(ms);
  }

  /** Buzzy double-pulse for a wrong tap. */
  miss(): void {
    this.fire([18, 40, 28]);
  }

  /** Soft passed-by nudge. */
  passed(): void {
    this.fire(10);
  }

  /** Celebratory triple-tap on a combo milestone. */
  milestone(): void {
    this.fire([14, 30, 14, 30, 22]);
  }

  /** Long rumble on game over. */
  gameOver(): void {
    this.fire([40, 60, 120]);
  }

  /** Stop any ongoing vibration (called on dispose). */
  cancel(): void {
    if (!canVibrate()) return;
    try {
      navigator.vibrate(0);
    } catch {
      /* ignore */
    }
  }
}
