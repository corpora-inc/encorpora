import { LaneIndex } from "./types";

type InputCallback = (lane: LaneIndex) => void;

/**
 * Maps player input to a lane. CRITICAL: pointer x is measured relative to the
 * CANVAS's own bounding rect — the element the notes are actually drawn into —
 * NOT the container. The canvas is absolutely positioned, so in the app (where
 * the host passes its own, possibly unpositioned container) the canvas and the
 * container do NOT share an origin; measuring against the container made every
 * tap land in the wrong lane. Measuring against the canvas rect (with scale
 * normalization for any CSS transform) is correct regardless of layout.
 */
export class InputManager {
  private listeners: InputCallback[] = [];

  constructor(
    _container: HTMLElement,
    private canvas: HTMLCanvasElement,
    private getLaneFromX: (x: number) => LaneIndex | null
  ) {
    this.setupKeyboard();
    this.setupPointer();
  }

  onInput(callback: InputCallback) {
    this.listeners.push(callback);
  }

  private trigger(lane: LaneIndex | null) {
    if (lane === null) return;
    this.listeners.forEach((cb) => cb(lane));
  }

  /** Convert a viewport clientX to the canvas's internal CSS-pixel x. */
  private canvasX(clientX: number): number {
    const rect = this.canvas.getBoundingClientRect();
    // Normalize for any CSS scaling/transform on the canvas or its ancestors so
    // the value is in the same coordinate space the renderer/lanes use.
    const scaleX = rect.width > 0 ? this.canvas.clientWidth / rect.width : 1;
    return (clientX - rect.left) * scaleX;
  }

  private setupKeyboard() {
    window.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "1":
        case "a":
        case "ArrowLeft":
          this.trigger(LaneIndex.Left);
          break;
        case "2":
        case "s":
        case "ArrowDown":
          this.trigger(LaneIndex.Center);
          break;
        case "3":
        case "d":
        case "ArrowRight":
          this.trigger(LaneIndex.Right);
          break;
      }
    });
  }

  /**
   * Pointer Events unify mouse + touch + pen and fire once per press (no
   * touch→click double-trigger). Listen on the container so taps anywhere in the
   * play area count (they bubble up from the canvas / HUD overlay), but resolve
   * the lane against the CANVAS rect.
   */
  private setupPointer() {
    // Listen on the CANVAS (z-index 1), NOT the container. The HUD/controls live
    // in a separate `pointer-events:none` overlay ABOVE the canvas; only the
    // buttons are `pointer-events:auto`. So a tap on a button (mute / replay /
    // exit) is handled by that button and NEVER reaches the canvas — no
    // tap-through into a lane — while a tap on the play area passes through the
    // transparent overlay to the canvas and fires a lane.
    this.canvas.addEventListener(
      "pointerdown",
      (e: PointerEvent) => {
        e.preventDefault();
        this.trigger(this.getLaneFromX(this.canvasX(e.clientX)));
      },
      { passive: false }
    );
  }

  dispose() {
    // Listeners are cleaned up when the container/canvas are removed on unmount.
  }
}
