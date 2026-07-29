/**
 * Two first-class control schemes, neither a port of the other.
 *
 * TOUCH — drag anywhere. The ship keeps its offset from the finger, so a child
 * can steer from the bottom corner without their hand covering the thing they
 * are aiming at, and the first touch never teleports the ship. A quick tap
 * (short, still) spends Deep Focus.
 *
 * DESKTOP — the ship tracks the mouse's x directly, with no button held: the
 * pointer *is* the ship. Arrow keys and A/D work at full speed for players who
 * want them, space spends Deep Focus. Both schemes are live at once and either
 * can take over mid-run.
 */

import { screenToWorldX } from "../core/camera.ts";
import type { World } from "./world.ts";

export type Input = {
  /** -1..1 from the keyboard, 0 when nothing is held. */
  axis(): number;
  detach(): void;
};

export type InputHandlers = {
  /**
   * True while something the player can see is covering the game — today, the
   * how-to-play panel.
   *
   * Every listener below is on `window`, not on the canvas, so a DOM scrim
   * stops the pointer but not the keyboard. Without this, `keyDown` falls out
   * of its switch into `onStart()` for EVERY key, so a child who opened the
   * rules on the game-over screen and pressed Escape to close them closed the
   * panel into a brand new run — wave, lives, score and best combo all reset,
   * the game-over screen gone. `p` was worse: it paused a game that returns
   * before it renders, so the panel closed onto a frozen trench with nothing
   * on screen saying why.
   */
  blocked(): boolean;
  onStart(): void;
  onFocus(): void;
  onToggleMute(): void;
  onTogglePause(): void;
  onToggleStats(): void;
};

export function attachInput(canvas: HTMLCanvasElement, world: World, on: InputHandlers): Input {
  let left = false;
  let right = false;
  let dragging = false;
  let pointerId = -1;
  let dragOffset = 0;
  let downAt = 0;
  let downX = 0;
  let moved = 0;

  const rectX = (): number => canvas.getBoundingClientRect().left;

  const pointerDown = (e: PointerEvent): void => {
    if (on.blocked()) return;
    canvas.setPointerCapture?.(e.pointerId);
    pointerId = e.pointerId;
    dragging = true;
    downAt = performance.now();
    downX = e.clientX;
    moved = 0;
    if (e.pointerType === "touch") {
      world.touch = true;
      dragOffset = world.ship.x - screenToWorldX(world.cam, e.clientX - rectX());
    } else {
      dragOffset = 0;
      world.ship.targetX = screenToWorldX(world.cam, e.clientX - rectX());
    }
    on.onStart();
    e.preventDefault();
  };

  const pointerMove = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && !dragging) {
      world.ship.targetX = screenToWorldX(world.cam, e.clientX - rectX());
      return;
    }
    if (!dragging || e.pointerId !== pointerId) return;
    moved = Math.max(moved, Math.abs(e.clientX - downX));
    world.ship.targetX = screenToWorldX(world.cam, e.clientX - rectX()) + dragOffset;
    e.preventDefault();
  };

  const pointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId || on.blocked()) return;
    dragging = false;
    pointerId = -1;
    if (performance.now() - downAt < 230 && moved < 14) on.onFocus();
  };

  const keyDown = (e: KeyboardEvent): void => {
    if (e.repeat || on.blocked()) return;
    switch (e.key) {
      case "ArrowLeft":
      case "a":
      case "A":
        left = true;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        right = true;
        break;
      case " ":
      case "Spacebar":
        on.onFocus();
        e.preventDefault();
        break;
      case "m":
      case "M":
        on.onToggleMute();
        break;
      case "p":
      case "P":
        on.onTogglePause();
        break;
      case "`":
        on.onToggleStats();
        break;
    }
    on.onStart();
  };

  const keyUp = (e: KeyboardEvent): void => {
    // Not gated: a key held down when the panel opened must still be released,
    // or the ship steers into the wall the moment the child closes it.
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") right = false;
  };

  const blur = (): void => {
    left = false;
    right = false;
    dragging = false;
  };

  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerUp);
  window.addEventListener("pointercancel", pointerUp);
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("blur", blur);
  canvas.addEventListener("contextmenu", preventDefault);

  return {
    axis: () => (left ? -1 : 0) + (right ? 1 : 0),
    detach() {
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
      canvas.removeEventListener("contextmenu", preventDefault);
    },
  };
}

function preventDefault(e: Event): void {
  e.preventDefault();
}
