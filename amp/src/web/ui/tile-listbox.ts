import { useId, useRef, useState, type KeyboardEvent } from "react";

/** Where a tile sits: measured on the page, or its grid cell in a test. */
type Box = { left: number; top: number };

/** The tile above or below `at`: the nearest row that way, then the tile in
 * it whose left edge is closest, so Up from any year in the first row
 * reaches a full-width "Adult" and Down from "Adult" reaches the first year. */
export function verticalNeighbour(
  boxes: readonly Box[],
  at: number,
  direction: 1 | -1,
): number | null {
  const here = boxes[at];
  if (!here) return null;
  const beyond = boxes
    .map((box, index) => ({ box, index }))
    .filter(({ box }) =>
      direction > 0 ? box.top > here.top + 0.5 : box.top < here.top - 0.5,
    );
  if (!beyond.length) return null;
  const tops = beyond.map(({ box }) => box.top);
  const rowTop = direction > 0 ? Math.min(...tops) : Math.max(...tops);
  return beyond
    .filter(({ box }) => Math.abs(box.top - rowTop) < 0.5)
    .reduce((best, next) =>
      Math.abs(next.box.left - here.left) < Math.abs(best.box.left - here.left)
        ? next
        : best,
    ).index;
}

/** The grid cells tiles fill in reading order, as CSS grid places them: a
 * "row" tile takes a whole row, a 2 tile wraps if it does not fit. */
export function gridCells(
  spans: readonly ("row" | 2 | undefined)[],
  columns: number,
): Box[] {
  let row = 0;
  let column = 0;
  return spans.map((span) => {
    const width = span === "row" ? columns : span === 2 ? 2 : 1;
    if (column > 0 && column + width > columns) {
      row += 1;
      column = 0;
    }
    const cell = { left: column, top: row };
    column += width;
    if (column >= columns) {
      row += 1;
      column = 0;
    }
    return cell;
  });
}

/** Typing within this long after the last key extends the search ("2", "20",
 * "201", "2015"); a longer pause starts a new one. */
const TYPE_AHEAD_MS = 1000;

/**
 * Keyboard and screen-reader behavior for a grid of tiles where choosing a
 * tile is the commit (a year that closes its dialog, or saves and moves on):
 * the WAI-ARIA single-select listbox in which selection does not follow
 * focus. The list is one tab stop and keeps focus; `aria-activedescendant`
 * names the active tile. Arrow keys move by tile and by row of the grid as
 * drawn, Home and End go to the first and last, Page Up and Page Down move
 * `page` tiles (ten years), typing jumps to the tile whose label starts with
 * what was typed, and Enter or Space chooses. Escape is the surrounding
 * dialog's.
 */
export function useTileListbox({
  labels,
  selected,
  onChoose,
  spans = [],
  columns,
  page = 10,
  disabled = false,
  onTypeUnmatched,
}: {
  /** Each tile's label, in order: what type-ahead matches. */
  labels: readonly string[];
  /** The chosen tile's index, or -1. */
  selected: number;
  onChoose: (index: number) => void;
  /** Tiles that span a row or two cells, for the grid's shape when it cannot
   * be measured. */
  spans?: readonly ("row" | 2 | undefined)[];
  /** Tiles to a row, when the grid cannot be measured. */
  columns: () => number;
  page?: number;
  disabled?: boolean;
  /** Four digits that match no tile: an exact year outside the choices. */
  onTypeUnmatched?: (typed: string) => void;
}) {
  const base = useId();
  const [active, setActive] = useState(Math.max(0, selected));
  const typed = useRef({ text: "", at: 0 });
  const optionId = (index: number) => `${base}-option-${index}`;
  const current = Math.min(active, labels.length - 1);

  const boxes = (): Box[] => {
    const rects = labels.map((_, index) =>
      document.getElementById(optionId(index))?.getBoundingClientRect(),
    );
    // Laid out on a page: where each tile really is, at this width.
    if (rects.every((rect) => rect && rect.width > 0))
      return rects.map((rect) => ({ left: rect!.left, top: rect!.top }));
    return gridCells(
      labels.map((_, index) => spans[index]),
      columns(),
    );
  };

  const moveTo = (index: number) => {
    setActive(index);
    document
      .getElementById(optionId(index))
      ?.scrollIntoView?.({ block: "nearest" });
  };

  const typeAhead = (key: string) => {
    const now = Date.now();
    const text =
      (now - typed.current.at < TYPE_AHEAD_MS ? typed.current.text : "") +
      key.toLowerCase();
    typed.current = { text, at: now };
    const match = labels.findIndex((label) =>
      label.toLowerCase().startsWith(text),
    );
    if (match >= 0) moveTo(match);
    else if (/^\d{4}$/.test(text)) {
      typed.current = { text: "", at: 0 };
      onTypeUnmatched?.(text);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    const last = labels.length - 1;
    let next: number | null | undefined;
    switch (event.key) {
      case "ArrowRight":
        next = Math.min(last, current + 1);
        break;
      case "ArrowLeft":
        next = Math.max(0, current - 1);
        break;
      case "ArrowDown":
        next = verticalNeighbour(boxes(), current, 1) ?? current;
        break;
      case "ArrowUp":
        next = verticalNeighbour(boxes(), current, -1) ?? current;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      case "PageDown":
        next = Math.min(last, current + page);
        break;
      case "PageUp":
        next = Math.max(0, current - page);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onChoose(current);
        return;
      default:
        if (event.key.length === 1 && event.key !== " ") {
          event.preventDefault();
          typeAhead(event.key);
        }
        return;
    }
    event.preventDefault();
    moveTo(next);
  };

  return {
    /** Spread on the grid element, with its name (aria-label/-labelledby). */
    listProps: {
      role: "listbox" as const,
      tabIndex: disabled ? -1 : 0,
      "aria-activedescendant": optionId(current),
      "aria-disabled": disabled || undefined,
      onKeyDown,
    },
    /** Spread on each tile, a `<button type="button">`. */
    optionProps: (index: number) => ({
      id: optionId(index),
      role: "option" as const,
      "aria-selected": index === selected,
      "data-active": index === current || undefined,
      // The list keeps focus, so it is never a second tab stop.
      tabIndex: -1,
      disabled,
      onMouseDown: (event: { preventDefault: () => void }) =>
        event.preventDefault(),
      onClick: () => {
        setActive(index);
        onChoose(index);
      },
    }),
  };
}
