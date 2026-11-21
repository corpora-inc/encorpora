/**
 * How many idea cards the Overview shows on a page (ProgressWorkspace.tsx).
 *
 * The page size comes from the stage and the stylesheet alone: its height,
 * and the columns, card height and gap that progress-workspace.css declares
 * for this layout. It never depends on what is on screen when it is counted,
 * so the history and the catalog may arrive in either order. (The columns
 * used to be read from the cards' grid, which the stage only holds once both
 * have arrived: a history that came first counted one column on a two-column
 * layout, and the page showed one row with a card-sized gap under it.)
 */
export function cardsThatFit({
  height,
  card,
  gap,
  columns,
  largeText,
}: {
  height: number;
  card: number;
  gap: number;
  columns: number;
  largeText: boolean;
}) {
  if (largeText) return 1;
  return Math.max(1, Math.floor((height + gap) / (card + gap))) * columns;
}

/**
 * Rows dropped because a page's cards came out taller than the estimate (a
 * title that wraps). `settled` is the page they settled on, so a drop is
 * undone only when that same page changes: its cards became shorter, or
 * other ideas now fill it. Opening an idea and coming back changes neither,
 * so the page keeps its cards.
 */
export type Dropped = {
  rows: number;
  settled: { page: number; ids: string; height: number } | null;
};
export const noneDropped: Dropped = { rows: 0, settled: null };

/** What the guard saw after a render, or when the cards changed size. */
export type Seen = {
  /** The cards scroll inside the stage. */
  overflows: boolean;
  /** More than one row is showing, so one can go. */
  canDrop: boolean;
  page: number;
  /** The ideas on the page, in order. */
  ids: string;
  /** The cards' height. */
  height: number;
};

/**
 * The next state of the dropped rows. Returns `dropped` itself when nothing
 * changes. Every step runs in a layout effect, before the browser paints:
 * a restored row that overflows again is dropped again in the same frame,
 * so no page ever shows one row too many.
 */
export function guardRows(dropped: Dropped, seen: Seen): Dropped {
  if (seen.overflows)
    return seen.canDrop ? { rows: dropped.rows + 1, settled: null } : dropped;
  if (!dropped.rows) return dropped;
  const { page, ids, height } = seen;
  const settled = dropped.settled;
  // Paging keeps the size: another page's cards are another page's.
  if (!settled || settled.page !== page)
    return { rows: dropped.rows, settled: { page, ids, height } };
  if (settled.ids !== ids || height < settled.height - 1) return noneDropped;
  return dropped;
}
