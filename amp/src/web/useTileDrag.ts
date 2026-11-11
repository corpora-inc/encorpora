import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

/** Drag and drop for tiles and rows, with pointer events: one path for
 * touch, pen and mouse. A press that moves less than a few pixels is a tap
 * and reaches the control's own click (tap-to-place stays the accessible
 * path); a press that travels lifts a copy of the tile, which follows the
 * pointer while the drop zone under it lights up. The page never scrolls
 * under a dragged tile: sources set `touch-action: none` (tile-drag.css),
 * and the scrolling stage creeps when the tile nears its edge.
 *
 * Nothing on the page moves while dragging: the lifted copy floats in its
 * own fixed layer, the source keeps its box, and zones change only colour.
 * Drop zones are elements with `data-drop="<zone>"`. */
export type TileDrag<S> = {
  /** Spread on a source's pointer-down. */
  start: (source: S, event: ReactPointerEvent<HTMLElement>) => void;
  /** False for the click that ends a drag; the control ignores it. */
  tapped: () => boolean;
};

type Point = { x: number; y: number };
type Options<S> = {
  disabled: boolean;
  /** May this source land in this zone? */
  accepts: (source: S, zone: string) => boolean;
  /** Land it; may return where the lifted copy should settle. */
  drop: (source: S, zone: string) => DOMRect | void;
  /** What floats under the pointer, at its own size (default: a copy of
   * the source, at the source's size). */
  ghost?: (
    source: S,
    element: HTMLElement,
  ) => { item: HTMLElement; size?: { width: number; height: number } };
  /** A list's rows move along it only. */
  axis?: "y";
  /** While dragging, for lists that make room as the tile passes. */
  moved?: (source: S, point: Point) => void;
  /** After a drop or a cancel. */
  ended?: () => void;
};

const THRESHOLD = 6;
const EDGE = 48;
const reduced = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The floating copy: the item, in a shallow copy of the source's parent,
 * so it keeps the styles its context gives it. */
function shellAround(item: HTMLElement, element: HTMLElement) {
  item.removeAttribute("id");
  item.removeAttribute("data-drag-source");
  item.classList.add("tile-ghost-item");
  const shell = element.parentElement?.cloneNode(false) as
    HTMLElement | undefined;
  if (!shell) return item;
  shell.removeAttribute("id");
  shell.append(item);
  return shell;
}

function scroller(element: HTMLElement) {
  for (let at = element.parentElement; at; at = at.parentElement) {
    const style = getComputedStyle(at);
    if (
      /(auto|scroll)/.test(style.overflowY) &&
      at.scrollHeight > at.clientHeight
    )
      return at;
  }
  return null;
}

export function useTileDrag<S>(options: Options<S>): TileDrag<S> {
  const latest = useRef(options);
  latest.current = options;
  const suppress = useRef(false);
  const stop = useRef<(() => void) | null>(null);
  // A drag in flight ends with the component (a new problem, a check).
  useEffect(() => () => stop.current?.(), []);

  function start(source: S, event: ReactPointerEvent<HTMLElement>) {
    if (latest.current.disabled || stop.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const element = event.currentTarget;
    const id = event.pointerId;
    const from: Point = { x: event.clientX, y: event.clientY };
    const rect = element.getBoundingClientRect();
    // The floating copy's box, centred where the source is.
    let box = {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
    const area = scroller(element);
    const still = reduced();
    let ghost: HTMLElement | null = null;
    let over: HTMLElement | null = null;
    let zone: string | null = null;
    let point = from;
    let frame = 0;

    const lift = () => {
      const custom = latest.current.ghost?.(source, element);
      const item = custom?.item ?? (element.cloneNode(true) as HTMLElement);
      if (custom?.size)
        box = {
          left: rect.left + (rect.width - custom.size.width) / 2,
          top: rect.top + (rect.height - custom.size.height) / 2,
          ...custom.size,
        };
      const body = shellAround(item, element);
      body.classList.add("tile-ghost-body");
      ghost = document.createElement("div");
      ghost.className = "tile-ghost";
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, {
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      });
      ghost.append(body);
      document.body.append(ghost);
      element.setAttribute("data-drag-source", "");
      document.documentElement.classList.add("tile-dragging");
      if (!still)
        requestAnimationFrame(() => ghost?.setAttribute("data-lifted", ""));
      else ghost.setAttribute("data-lifted", "");
    };
    const follow = () => {
      if (!ghost) return;
      const dx = latest.current.axis === "y" ? 0 : point.x - from.x;
      ghost.style.transform = `translate(${dx}px, ${point.y - from.y}px)`;
      const hit = document
        .elementFromPoint(
          latest.current.axis === "y" ? from.x : point.x,
          point.y,
        )
        ?.closest<HTMLElement>("[data-drop]");
      const next =
        hit && latest.current.accepts(source, hit.dataset.drop!) ? hit : null;
      if (next !== over) {
        over?.removeAttribute("data-drop-over");
        next?.setAttribute("data-drop-over", "");
        over = next;
        zone = next?.dataset.drop ?? null;
      }
      latest.current.moved?.(source, point);
    };
    // Creep the stage while the tile waits near its top or bottom edge.
    const creep = () => {
      frame = 0;
      if (!ghost || !area) return;
      const box = area.getBoundingClientRect();
      const by =
        point.y < box.top + EDGE
          ? -Math.ceil((box.top + EDGE - point.y) / 6)
          : point.y > box.bottom - EDGE
            ? Math.ceil((point.y - box.bottom + EDGE) / 6)
            : 0;
      if (!by) return;
      const before = area.scrollTop;
      area.scrollTop += by;
      if (area.scrollTop !== before) {
        follow();
        frame = requestAnimationFrame(creep);
      }
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      point = { x: e.clientX, y: e.clientY };
      if (!ghost) {
        if (Math.hypot(point.x - from.x, point.y - from.y) < THRESHOLD) return;
        lift();
      }
      e.preventDefault();
      follow();
      if (!frame) frame = requestAnimationFrame(creep);
    };
    const settle = (target: DOMRect | null) => {
      const floating = ghost;
      element.removeAttribute("data-drag-source");
      document.documentElement.classList.remove("tile-dragging");
      over?.removeAttribute("data-drop-over");
      latest.current.ended?.();
      if (!floating) return;
      if (still || !target) {
        floating.remove();
        return;
      }
      floating.setAttribute("data-settling", "");
      floating.removeAttribute("data-lifted");
      floating.style.transform = `translate(${target.left + (target.width - box.width) / 2 - box.left}px, ${target.top + (target.height - box.height) / 2 - box.top}px)`;
      const done = () => floating.remove();
      floating.addEventListener("transitionend", done, { once: true });
      setTimeout(done, 400);
    };
    const finish = (e: PointerEvent | null, cancelled: boolean) => {
      if (e && e.pointerId !== id) return;
      cleanup();
      if (!ghost) return;
      // The click that follows this pointer-up is the drop, not a tap.
      suppress.current = true;
      setTimeout(() => (suppress.current = false), 0);
      if (!cancelled && zone) {
        const landed = latest.current.drop(source, zone);
        settle(landed ?? over?.getBoundingClientRect() ?? null);
      } else settle(element.getBoundingClientRect());
    };
    const up = (e: PointerEvent) => finish(e, false);
    const cancel = (e: PointerEvent) => finish(e, true);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ghost) {
        e.preventDefault();
        finish(null, true);
      }
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key, true);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      stop.current = null;
    };
    stop.current = () => {
      cleanup();
      element.removeAttribute("data-drag-source");
      document.documentElement.classList.remove("tile-dragging");
      over?.removeAttribute("data-drop-over");
      (ghost as HTMLElement | null)?.remove();
      latest.current.ended?.();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key, true);
  }

  return {
    start,
    tapped: () => {
      if (!suppress.current) return true;
      suppress.current = false;
      return false;
    },
  };
}
