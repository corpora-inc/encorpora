/** Monotonic elapsed time. Long timer gaps are treated as suspend, not use. */
export class EngagementClock {
  visibleMs = 0;
  activeMs = 0;
  private last: number;
  private input: number;
  private visible: boolean;
  constructor(now: number, visible: boolean) {
    this.last = this.input = now;
    this.visible = visible;
  }
  sample(now: number, visible: boolean, interaction = false) {
    const elapsed = Math.max(0, now - this.last);
    if (this.visible && elapsed <= 60000) {
      this.visibleMs = Math.min(86400000, this.visibleMs + elapsed);
      this.activeMs = Math.min(
        86400000,
        this.activeMs +
          Math.max(0, Math.min(now, this.input + 60000) - this.last),
      );
    }
    if (interaction && visible) this.input = now;
    this.visible = visible;
    this.last = now;
  }
}
