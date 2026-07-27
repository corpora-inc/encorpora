/**
 * Two control schemes, designed separately, both first class.
 *
 * Mouse: absolute aim. The head turns toward the cursor, always, with no click
 * needed. Hold any button (or Space / Shift) to boost. A mouse has a cursor
 * already on screen — pointing at where you want to go is the whole idea.
 *
 * Touch: a floating relative stick. Wherever the thumb lands becomes the
 * origin; the serpent swims in the direction you drag. Absolute touch aiming
 * would put your hand over the thing you are steering at, which is why every
 * good mobile snake uses a relative stick. Shove the stick past 72% of its
 * travel — or put a second finger down anywhere — to boost, so the whole game
 * is one thumb.
 *
 * Keyboard: eight-way, for players who want it. It overrides the mouse while a
 * key is held and hands control back when released.
 */

import { TAU, clamp } from "./num.ts";

export type Pointer = {
  active: boolean;
  anchorX: number;
  anchorY: number;
  dx: number;
  dy: number;
  /** 0..1 how far the stick is pushed. */
  push: number;
};

export type Input = {
  /** Desired heading in radians, or null to hold the current one. */
  heading: number | null;
  boost: boolean;
  pointer: Pointer;
  /** True for one read after a confirm (tap / click / Space / Enter). */
  takeConfirm(): boolean;
  /** True for one read after the sound key. */
  takeMute(): boolean;
  takeDebug(): boolean;
  takePause(): boolean;
  /** Latest world-space cursor, used by the mouse scheme. */
  setWorldCursor(x: number, y: number): void;
  usingTouch: boolean;
  dispose(): void;
};

const STICK_RADIUS = 96; // CSS px of travel for a full push
const STICK_DEADZONE = 9;
const BOOST_PUSH = 0.72;

type Opts = {
  /** Convert a client point to world units. */
  toWorld(clientX: number, clientY: number): { x: number; y: number };
  /** Current serpent head, world units — the mouse aims relative to it. */
  headAt(): { x: number; y: number };
};

export function createInput(el: HTMLElement, opts: Opts): Input {
  const pointer: Pointer = { active: false, anchorX: 0, anchorY: 0, dx: 0, dy: 0, push: 0 };
  const keys = new Set<string>();
  let confirm = false;
  let mute = false;
  let debug = false;
  let pause = false;
  let mouseHeading: number | null = null;
  let mouseBoost = false;
  let usingTouch = false;
  let stickId = -1;
  let extraTouches = 0;

  const state: Input = {
    heading: null,
    boost: false,
    pointer,
    takeConfirm() {
      const v = confirm;
      confirm = false;
      return v;
    },
    takeMute() {
      const v = mute;
      mute = false;
      return v;
    },
    takeDebug() {
      const v = debug;
      debug = false;
      return v;
    },
    takePause() {
      const v = pause;
      pause = false;
      return v;
    },
    setWorldCursor(x: number, y: number) {
      const h = opts.headAt();
      const dx = x - h.x;
      const dy = y - h.y;
      if (dx * dx + dy * dy > 0.0009) mouseHeading = Math.atan2(dy, dx);
    },
    usingTouch: false,
    dispose() {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    },
  };

  function recompute(): void {
    // Keyboard wins while held: it is an explicit, deliberate input.
    let kx = 0;
    let ky = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) kx -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) kx += 1;
    if (keys.has("ArrowUp") || keys.has("KeyW")) ky -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) ky += 1;

    if (kx !== 0 || ky !== 0) {
      state.heading = Math.atan2(ky, kx);
    } else if (usingTouch) {
      state.heading = pointer.push > 0 ? Math.atan2(pointer.dy, pointer.dx) : null;
    } else {
      state.heading = mouseHeading;
    }

    state.boost =
      keys.has("Space") ||
      keys.has("ShiftLeft") ||
      keys.has("ShiftRight") ||
      mouseBoost ||
      extraTouches > 0 ||
      (usingTouch && pointer.push >= BOOST_PUSH);
    state.usingTouch = usingTouch;
  }

  function onDown(e: PointerEvent): void {
    confirm = true;
    try {
      // Throws if the pointer is not active — which a browser is entitled to
      // decide mid-gesture. Losing capture must never lose the input.
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is an optimisation, not a requirement */
    }
    if (e.pointerType === "mouse") {
      usingTouch = false;
      mouseBoost = true;
      const w = opts.toWorld(e.clientX, e.clientY);
      state.setWorldCursor(w.x, w.y);
    } else {
      usingTouch = true;
      if (stickId === -1) {
        stickId = e.pointerId;
        pointer.active = true;
        pointer.anchorX = e.clientX;
        pointer.anchorY = e.clientY;
        pointer.dx = 0;
        pointer.dy = 0;
        pointer.push = 0;
      } else {
        extraTouches++;
      }
    }
    recompute();
  }

  function onMove(e: PointerEvent): void {
    if (e.pointerType === "mouse") {
      usingTouch = false;
      const w = opts.toWorld(e.clientX, e.clientY);
      state.setWorldCursor(w.x, w.y);
    } else if (e.pointerId === stickId) {
      let dx = e.clientX - pointer.anchorX;
      let dy = e.clientY - pointer.anchorY;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        // Drag the anchor along so a long swipe never runs out of travel.
        pointer.anchorX += dx * (1 - STICK_RADIUS / len);
        pointer.anchorY += dy * (1 - STICK_RADIUS / len);
        dx *= STICK_RADIUS / len;
        dy *= STICK_RADIUS / len;
      }
      pointer.dx = dx;
      pointer.dy = dy;
      pointer.push = len < STICK_DEADZONE ? 0 : clamp(Math.min(len, STICK_RADIUS) / STICK_RADIUS, 0, 1);
    }
    recompute();
  }

  function onUp(e: PointerEvent): void {
    if (e.pointerType === "mouse") {
      mouseBoost = false;
    } else if (e.pointerId === stickId) {
      stickId = -1;
      pointer.active = false;
      pointer.push = 0;
    } else if (extraTouches > 0) {
      extraTouches--;
    }
    recompute();
  }

  function onContext(e: Event): void {
    e.preventDefault();
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    if (e.code === "KeyM") mute = true;
    if (e.code === "F3" || (e.code === "Backquote" && e.shiftKey)) debug = true;
    if (e.code === "KeyP" || e.code === "Escape") pause = true;
    if (e.code === "Space" || e.code === "Enter") confirm = true;
    if (e.code === "Space" || e.code === "Tab") e.preventDefault();
    keys.add(e.code);
    recompute();
  }

  function onKeyUp(e: KeyboardEvent): void {
    keys.delete(e.code);
    recompute();
  }

  function onBlur(): void {
    keys.clear();
    mouseBoost = false;
    extraTouches = 0;
    stickId = -1;
    pointer.active = false;
    pointer.push = 0;
    recompute();
  }

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("contextmenu", onContext);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return state;
}

export const stickRadiusPx = STICK_RADIUS;
export const stickBoostPush = BOOST_PUSH;
export const fullTurn = TAU;
