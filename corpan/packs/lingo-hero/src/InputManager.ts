import { LaneIndex } from "./types";

type InputCallback = (lane: LaneIndex) => void;

export class InputManager {
  private listeners: InputCallback[] = [];

  constructor(private container: HTMLElement, private getLaneFromX: (x: number) => LaneIndex | null) {
    this.setupKeyboard();
    this.setupTouch();
  }

  onInput(callback: InputCallback) {
    this.listeners.push(callback);
  }

  private trigger(lane: LaneIndex) {
    this.listeners.forEach(cb => cb(lane));
  }

  private setupKeyboard() {
    window.addEventListener("keydown", (e) => {
      // 1, 2, 3 or A, S, D or Left, Down, Right
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

  private setupTouch() {
    // Basic touch support - split screen into 3 columns
    // Better way: use the LaneSystem coordinates. 
    // We passed a helper `getLaneFromX` for this.
    
    this.container.addEventListener("touchstart", (e) => {
      e.preventDefault(); // Prevent scrolling
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        // Get X relative to container
        const rect = this.container.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        
        const lane = this.getLaneFromX(x);
        if (lane !== null) {
          this.trigger(lane);
        }
      }
    }, { passive: false });
  }

  dispose() {
    // Remove listeners if needed (mostly for HMR/cleanup)
    // For now simple reload handles it
  }
}
