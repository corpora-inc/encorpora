/**
 * Input. Touch and desktop are designed, not ported.
 *
 * TOUCH — the lane you tap is the lane you hit, anywhere in the playfield's band, so
 * the target is a third of the screen rather than a button. Every `pointerdown` is
 * independent, so two thumbs on two lanes on the same beat both land.
 *
 * DESKTOP — three rows of keys, home-row for either hand, plus the arrows, plus
 * space for the middle. A one-lane stage accepts all of them.
 *
 * Timestamps come from `event.timeStamp`, which is sampled by the browser when the
 * event was generated rather than when JavaScript got around to it. On a busy frame
 * that is worth 8-16 ms of accuracy, which is a whole judgment grade.
 */

import { laneAtPoint, type Layout } from "./render/layout.ts";

export type Slot = "top" | "mid" | "bottom";

const KEY_SLOT: Record<string, Slot> = {
  f: "top",
  j: "top",
  w: "top",
  i: "top",
  arrowup: "top",
  g: "mid",
  k: "mid",
  s: "mid",
  arrowright: "mid",
  " ": "mid",
  h: "bottom",
  l: "bottom",
  x: "bottom",
  arrowdown: "bottom",
};

export function slotToLane(slot: Slot, laneCount: number): number {
  if (laneCount <= 1) return 0;
  if (laneCount === 2) return slot === "top" ? 0 : 1;
  return slot === "top" ? 0 : slot === "mid" ? 1 : 2;
}

export type InputHandlers = {
  hit(lane: number, perfMs: number): void;
  /** Return true to swallow the event (a UI button was pressed). */
  tap(x: number, y: number): boolean;
  pause(): void;
  togglePerf(): void;
};

export type InputBinding = { dispose(): void };

export function bindInput(
  el: HTMLElement,
  getLayout: () => Layout,
  getLaneCount: () => number,
  h: InputHandlers,
): InputBinding {
  const held = new Set<string>();

  const onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (k === "escape" || k === "p") {
      h.pause();
      e.preventDefault();
      return;
    }
    if (k === "`" || e.code === "F3") {
      h.togglePerf();
      e.preventDefault();
      return;
    }
    const slot = KEY_SLOT[k];
    if (!slot) return;
    e.preventDefault();
    if (e.repeat || held.has(k)) return;
    held.add(k);
    h.hit(slotToLane(slot, getLaneCount()), stamp(e));
  };

  const onKeyUp = (e: KeyboardEvent): void => {
    held.delete(e.key.toLowerCase());
  };

  const onPointerDown = (e: PointerEvent): void => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (h.tap(x, y)) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    h.hit(laneAtPoint(getLayout(), x, y), stamp(e));
  };

  const onBlur = (): void => held.clear();

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  el.addEventListener("pointerdown", onPointerDown, { passive: false });
  el.addEventListener("contextmenu", preventDefault);

  return {
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("contextmenu", preventDefault);
    },
  };
}

function preventDefault(e: Event): void {
  e.preventDefault();
}

/** `event.timeStamp` is in the `performance.now()` epoch for trusted events. */
function stamp(e: Event): number {
  const t = e.timeStamp;
  return Number.isFinite(t) && t > 0 ? t : performance.now();
}
