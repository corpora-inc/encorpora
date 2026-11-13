import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

/**
 * The one layer that owns every open popover in the app: chart tips, the
 * curve readout, a figure's Details, menus, list and date pickers, the
 * glossary card. The rules, the same everywhere:
 *
 * - One open at a time. Opening one closes the others, except the one it
 *   opened from (a list inside a dialog keeps the dialog).
 * - A press anywhere outside closes it: a pointerdown on the window in the
 *   capture phase, so no element beneath (a chart that stops propagation, an
 *   SVG, plain text) can swallow it. A press inside its own zone is left to
 *   the zone, which toggles it (the same target again) or moves it.
 * - A scroll of the page or of any panel but its own list, a resize, Escape,
 *   Back and Forward, and a route change close it. Escape closes only the
 *   top one, and focus returns to its trigger.
 *
 * A modal (a dialog-style picker, the glossary card, a Radix menu) keeps its
 * own outside-press and Escape handling, focus trap and scroll lock: the layer
 * only closes it when another popover opens over it from elsewhere, or the
 * route changes.
 *
 * Why not the platform's `popover="auto"`: its light dismiss fires on a click
 * (after the press), never on scroll or resize, and only among elements that
 * carry the attribute; the tips here float with pointer-events off, the
 * menus are Radix, and anchoring without CSS anchor positioning still needs
 * this script. One script-owned layer covers all of them alike.
 */
export type CloseReason =
  | "outside"
  | "scroll"
  | "resize"
  | "escape"
  | "history"
  | "navigate"
  | "replaced";

export type Popover = {
  /** True when a press on this node belongs to the popover (its zone, its
   * trigger, its panel). */
  contains: (node: Node) => boolean;
  /** What it opened from: a popover containing it stays open. */
  anchor?: () => Node | null;
  close: (reason: CloseReason) => void;
  /** A scroll closes it unless this returns true: a tip opened by keyboard
   * focus follows its target as a keyboard walk scrolls the page. */
  keepOnScroll?: () => boolean;
  /** It handles outside presses, Escape and scrolling itself. */
  modal?: boolean;
};

/** Open popovers, the most recent last. */
const stack: Popover[] = [];
let listening = false;

function closeAt(index: number, reason: CloseReason) {
  const [popover] = stack.splice(index, 1);
  popover?.close(reason);
}
/** Close every popover above (and including) `from`. */
function closeFrom(from: number, reason: CloseReason, skipModal = false) {
  for (let index = stack.length - 1; index >= from; index--)
    if (!(skipModal && stack[index]!.modal)) closeAt(index, reason);
}
/** The index of the innermost open popover that contains `node`, or -1. */
const holder = (node: Node | null) => {
  if (!node) return -1;
  for (let index = stack.length - 1; index >= 0; index--)
    if (stack[index]!.contains(node)) return index;
  return -1;
};

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (!stack.length) return;
      const target = event.target instanceof Node ? event.target : null;
      // Everything above the popover the press landed in closes; modals
      // dismiss themselves.
      closeFrom(holder(target) + 1, "outside", true);
    },
    true,
  );
  const moved = (reason: CloseReason) => (event: Event) => {
    const target = event.target instanceof Node ? event.target : null;
    for (let index = stack.length - 1; index >= 0; index--) {
      const popover = stack[index]!;
      if (popover.modal || popover.keepOnScroll?.()) continue;
      // Scrolling its own long list moves nothing it is anchored to.
      if (reason === "scroll" && target && popover.contains(target)) continue;
      closeAt(index, reason);
    }
  };
  window.addEventListener("scroll", moved("scroll"), {
    capture: true,
    passive: true,
  });
  window.addEventListener("resize", moved("resize"));
  window.addEventListener("popstate", moved("history"));
  window.addEventListener(
    "keydown",
    (event) => {
      const top = stack.at(-1);
      if (event.key !== "Escape" || !top || top.modal) return;
      // Only the top one, never a sheet or drawer beneath it.
      event.stopPropagation();
      event.preventDefault();
      closeAt(stack.length - 1, "escape");
    },
    true,
  );
}

/** This popover is now open; every other closes except those it opened
 * from. */
export function openPopover(popover: Popover) {
  listen();
  const at = stack.indexOf(popover);
  if (at >= 0) stack.splice(at, 1);
  closeFrom(holder(popover.anchor?.() ?? null) + 1, "replaced");
  stack.push(popover);
}

/** This popover closed by itself (or unmounted): forget it, without calling
 * its `close` again. */
export function releasePopover(popover: Popover) {
  const at = stack.indexOf(popover);
  if (at >= 0) stack.splice(at, 1);
}

/** Close everything: a route change. */
export function closeAllPopovers(reason: CloseReason = "navigate") {
  closeFrom(0, reason);
}

/** Registers a component's popover while `open` is true. The options may
 * change on every render; the registration stays the same object. */
export function usePopover(open: boolean, options: Popover) {
  const latest = useRef(options);
  latest.current = options;
  const popover = useMemo<Popover>(
    () => ({
      contains: (node) => latest.current.contains(node),
      anchor: () => latest.current.anchor?.() ?? null,
      close: (reason) => latest.current.close(reason),
      keepOnScroll: () => latest.current.keepOnScroll?.() ?? false,
      get modal() {
        return latest.current.modal;
      },
    }),
    [],
  );
  // Before paint: the other popover closes in the frame this one opens.
  useLayoutEffect(() => {
    if (open) openPopover(popover);
    else releasePopover(popover);
  }, [open, popover]);
  useEffect(() => () => releasePopover(popover), [popover]);
}
