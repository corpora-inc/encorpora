import { expect, test } from "vitest";
import {
  cardsThatFit,
  guardRows,
  noneDropped,
  type Dropped,
  type Seen,
} from "../progress-page-size";

const tablet = { card: 141, gap: 12, largeText: false };

test("a page holds as many rows as the stage, in the stylesheet's columns", () => {
  // 1024×768: a 394px stage in two columns holds two rows.
  expect(cardsThatFit({ ...tablet, height: 394, columns: 2 })).toBe(4);
  // 1280×900.
  expect(cardsThatFit({ ...tablet, height: 526, columns: 2 })).toBe(6);
  // 320×568: the phone's shorter card and tighter gap.
  expect(
    cardsThatFit({
      height: 216,
      card: 132,
      gap: 10,
      columns: 1,
      largeText: false,
    }),
  ).toBe(1);
  // Never less than one row; large text shows one card.
  expect(cardsThatFit({ ...tablet, height: 40, columns: 2 })).toBe(2);
  expect(
    cardsThatFit({ ...tablet, height: 900, columns: 2, largeText: true }),
  ).toBe(1);
});

const seen = (over: Partial<Seen>): Seen => ({
  overflows: false,
  canDrop: true,
  page: 0,
  ids: "a b c d",
  height: 300,
  ...over,
});
/** Runs the guard the way the page does, re-rendering until it rests. */
function settle(start: Dropped, look: (rows: number) => Seen) {
  let state = start;
  for (let renders = 0; renders < 20; renders++) {
    const next = guardRows(state, look(state.rows));
    if (next === state) return state;
    state = next;
  }
  throw new Error("the guard never rests");
}

test("cards taller than the estimate drop a row until the page fits, then rest", () => {
  const rested = settle(noneDropped, (rows) =>
    rows < 2 ? seen({ overflows: true }) : seen({ ids: "a b", height: 200 }),
  );
  expect(rested.rows).toBe(2);
  expect(rested.settled).toEqual({ page: 0, ids: "a b", height: 200 });
});

test("one row is never dropped", () => {
  const state = guardRows(
    noneDropped,
    seen({ overflows: true, canDrop: false }),
  );
  expect(state).toBe(noneDropped);
});

test("the same page coming back (an idea opened and closed) keeps its size", () => {
  const dropped: Dropped = {
    rows: 1,
    settled: { page: 0, ids: "a b", height: 200 },
  };
  expect(guardRows(dropped, seen({ ids: "a b", height: 200 }))).toBe(dropped);
});

test("paging keeps the size, so no idea is skipped between pages", () => {
  const dropped: Dropped = {
    rows: 1,
    settled: { page: 0, ids: "a b", height: 200 },
  };
  const next = guardRows(dropped, seen({ page: 1, ids: "c d", height: 140 }));
  expect(next.rows).toBe(1);
  expect(next.settled).toEqual({ page: 1, ids: "c d", height: 140 });
});

test("a row dropped while cards were briefly taller comes back when they shrink", () => {
  // Transiently tall cards: two rows overflow, one is dropped.
  let state = settle(noneDropped, (rows) =>
    rows === 0
      ? seen({ overflows: true, ids: "a b c d", height: 340 })
      : seen({ ids: "a b", height: 164 }),
  );
  expect(state.rows).toBe(1);
  // The same cards are now 141px: the full page is tried again, and fits.
  state = settle(state, (rows) =>
    rows === 0
      ? seen({ ids: "a b c d", height: 294 })
      : seen({ ids: "a b", height: 141 }),
  );
  expect(state).toEqual(noneDropped);
});

test("other ideas filling the page try the full page again; still too tall, the row goes again and rests", () => {
  const dropped: Dropped = {
    rows: 1,
    settled: { page: 0, ids: "a b", height: 200 },
  };
  const state = settle(dropped, (rows) =>
    rows === 0
      ? seen({ overflows: true, ids: "x y z w" })
      : seen({ ids: "x y", height: 210 }),
  );
  expect(state.rows).toBe(1);
  expect(state.settled).toEqual({ page: 0, ids: "x y", height: 210 });
});
