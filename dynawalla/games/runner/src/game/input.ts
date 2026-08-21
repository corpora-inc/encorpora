/**
 * Input.
 *
 * Two rules make a runner feel responsive, and both are about *when* an intent
 * fires rather than what it does:
 *
 *  1. A swipe fires the instant the finger crosses the threshold — never on
 *     lift. Waiting for pointerup adds ~120ms of pure lag and is the single
 *     biggest reason a homemade runner feels wrong next to Subway Surfers.
 *  2. Intents are *buffered*, not dropped. Pressing left again while a lane
 *     change is still animating queues the second move instead of eating it.
 *
 * After a swipe fires, the gesture origin is reset to the current point, so a
 * long drag can chain left-left-up without lifting the finger.
 */

export type Intent = "left" | "right" | "jump" | "slide";

type Buffered = { intent: Intent; at: number };

const KEY_MAP: Record<string, Intent> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
  ArrowDown: "slide",
  KeyS: "slide",
};

export class InputController {
  /** How long an unconsumed intent stays valid. */
  bufferMs = 145;
  /**
   * Milliseconds between the DOM event that expressed an intent and the frame
   * that acted on it. This is the number that decides whether the game feels
   * responsive, so it is measured rather than assumed.
   */
  lastLatencyMs = 0;

  private el: HTMLElement;
  private queue: Buffered[] = [];
  private pool: Buffered[] = [];
  private pointerId: number | null = null;
  private ox = 0;
  private oy = 0;
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private threshold = 30;
  private onAnyInput: () => void;
  private disposed = false;
  private paused = false;

  /** Set true while a modal owns input; gestures are ignored but keys still reach the DOM. */
  setPaused(v: boolean): void {
    this.paused = v;
    if (v) this.queue.length = 0;
  }

  constructor(el: HTMLElement, onAnyInput: () => void) {
    this.el = el;
    this.onAnyInput = onAnyInput;
    this.recomputeThreshold();

    el.addEventListener("pointerdown", this.down, { passive: false });
    el.addEventListener("pointermove", this.move, { passive: false });
    el.addEventListener("pointerup", this.up, { passive: false });
    el.addEventListener("pointercancel", this.up, { passive: false });
    window.addEventListener("keydown", this.key);
    window.addEventListener("resize", this.recomputeThreshold);
  }

  private recomputeThreshold = (): void => {
    // ~6% of the short edge, clamped. Small phones need a small threshold or
    // every swipe becomes a drag; big tablets need a large one or every scroll
    // becomes a swipe.
    const min = Math.min(window.innerWidth, window.innerHeight);
    this.threshold = Math.max(20, Math.min(52, min * 0.055));
  };

  private push(intent: Intent): void {
    const b = this.pool.pop() ?? { intent, at: 0 };
    b.intent = intent;
    b.at = performance.now();
    // Two of the same lane-move can legitimately queue (lane 0 -> 2). Cap the
    // depth so a mashed key does not schedule a five-second automaton.
    if (this.queue.length >= 2) this.pool.push(this.queue.shift()!);
    this.queue.push(b);
    this.onAnyInput();
  }

  private down = (e: PointerEvent): void => {
    if (this.paused) return;
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.ox = this.startX = e.clientX;
    this.oy = this.startY = e.clientY;
    this.startT = performance.now();
    this.el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    this.onAnyInput();
  };

  private move = (e: PointerEvent): void => {
    if (this.paused || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - this.ox;
    const dy = e.clientY - this.oy;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx < this.threshold && ady < this.threshold) return;
    if (adx > ady) {
      this.push(dx > 0 ? "right" : "left");
    } else {
      this.push(dy < 0 ? "jump" : "slide");
    }
    // Chain: the next swipe measures from here, no lift required.
    this.ox = e.clientX;
    this.oy = e.clientY;
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (this.paused) return;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const dist = Math.hypot(dx, dy);
    const dur = performance.now() - this.startT;
    // A tap is a lane move toward the side you tapped. Small hands should never
    // have to swipe across a 12" tablet.
    if (dist < 14 && dur < 260) {
      const r = this.el.getBoundingClientRect();
      this.push(e.clientX - r.left < r.width * 0.5 ? "left" : "right");
    }
  };

  private key = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const intent = KEY_MAP[e.code];
    if (!intent) return;
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    if (this.paused) {
      // Modal screens read keys directly; still wake the audio context.
      this.onAnyInput();
      return;
    }
    this.push(intent);
  };

  /**
   * Take the oldest still-valid intent matching `accept`, dropping anything
   * that has aged out. Returns null when there is nothing to do.
   */
  consume(accept: (i: Intent) => boolean): Intent | null {
    const now = performance.now();
    while (this.queue.length) {
      const head = this.queue[0];
      if (now - head.at > this.bufferMs) {
        this.pool.push(this.queue.shift()!);
        continue;
      }
      if (!accept(head.intent)) return null;
      this.lastLatencyMs = now - head.at;
      this.pool.push(this.queue.shift()!);
      return head.intent;
    }
    return null;
  }

  clear(): void {
    while (this.queue.length) this.pool.push(this.queue.pop()!);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.el.removeEventListener("pointerdown", this.down);
    this.el.removeEventListener("pointermove", this.move);
    this.el.removeEventListener("pointerup", this.up);
    this.el.removeEventListener("pointercancel", this.up);
    window.removeEventListener("keydown", this.key);
    window.removeEventListener("resize", this.recomputeThreshold);
  }
}
