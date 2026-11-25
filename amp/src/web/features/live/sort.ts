import type {
  LiveRow,
  LiveSignal,
  LiveStatus,
} from "../../../schools/live/contracts";
import { lastActive, percentValue } from "./format";
import { STATUS_ORDER } from "./status-words";

/*
 * How the roster is ordered. The order is taken when the adult chooses a
 * sort and held until the next choice: rows never move because an answer
 * came in (LiveRoster freezes it). The screen keeps the sort in its view
 * store; `version` counts the choices, so choosing the same sort again
 * takes a fresh order.
 */

export const liveSortKeys = [
  "attention",
  "name",
  "problems",
  "correct",
  "level",
] as const;
export type LiveSortKey = (typeof liveSortKeys)[number];
export type LiveSortDirection = "ascending" | "descending";
export type LiveSort = {
  key: LiveSortKey;
  direction: LiveSortDirection;
  /** Bumped on every choice, so the same choice again re-sorts. */
  version: number;
};

export const DEFAULT_LIVE_SORT: LiveSort = {
  key: "name",
  direction: "ascending",
  version: 0,
};

/** Each sort's first direction: who needs you first, A to Z, most
 * problems, highest percent and highest level first. */
export const FIRST_DIRECTION: Record<LiveSortKey, LiveSortDirection> = {
  attention: "ascending",
  name: "ascending",
  problems: "descending",
  correct: "descending",
  level: "descending",
};

/** The sort after a tap on `key`. The same key again reverses it, except
 * "needs you", which only has one useful direction: tapping it again takes
 * a fresh order. */
export function nextSort(current: LiveSort, key: LiveSortKey): LiveSort {
  const version = current.version + 1;
  if (current.key !== key)
    return { key, direction: FIRST_DIRECTION[key], version };
  if (key === "attention")
    return { key, direction: current.direction, version };
  return {
    key,
    direction: current.direction === "ascending" ? "descending" : "ascending",
    version,
  };
}

export type SortContext = {
  statuses: ReadonlyMap<string, LiveStatus>;
  /** Open requests, by student. */
  signals: ReadonlyMap<string, readonly LiveSignal[]>;
};

const collator = new Intl.Collator("en", { sensitivity: "base" });
const byName = (a: LiveRow, b: LiveRow) =>
  collator.compare(a.name, b.name) || a.personId.localeCompare(b.personId);

const time = (at: string | null) => (at === null ? 0 : Date.parse(at));

/** Who needs the adult, most first: an open request (oldest first), then
 * needs help, quiet the longest, not signed in, working, on a roll. */
function attention(a: LiveRow, b: LiveRow, context: SortContext) {
  const askedA = context.signals.get(a.personId)?.[0]?.createdAt ?? null;
  const askedB = context.signals.get(b.personId)?.[0]?.createdAt ?? null;
  if (askedA !== null || askedB !== null) {
    if (askedA === null) return 1;
    if (askedB === null) return -1;
    const order = time(askedA) - time(askedB);
    if (order) return order;
  }
  const statusA = context.statuses.get(a.personId) ?? "working";
  const statusB = context.statuses.get(b.personId) ?? "working";
  const order = STATUS_ORDER.indexOf(statusA) - STATUS_ORDER.indexOf(statusB);
  if (order) return order;
  // Within a status, the one waiting longest first.
  if (statusA === "idle") return time(lastActive(a)) - time(lastActive(b));
  return 0;
}

/** The primary key alone, ascending. */
function primary(
  key: LiveSortKey,
  a: LiveRow,
  b: LiveRow,
  context: SortContext,
) {
  switch (key) {
    case "attention":
      return attention(a, b, context);
    case "name":
      return 0;
    case "problems":
      return a.problems - b.problems;
    case "correct":
      return percentValue(a) - percentValue(b);
    case "level":
      return (a.level ?? -Infinity) === (b.level ?? -Infinity)
        ? 0
        : (a.level ?? -Infinity) < (b.level ?? -Infinity)
          ? -1
          : 1;
  }
}

/** Students' ids in the order a sort puts them. The direction turns the
 * key only: ties always read A to Z. */
export function sortedIds(
  rows: readonly LiveRow[],
  sort: Pick<LiveSort, "key" | "direction">,
  context: SortContext,
): string[] {
  const factor = sort.direction === "descending" ? -1 : 1;
  const nameFactor = sort.key === "name" ? factor : 1;
  return [...rows]
    .sort(
      (a, b) =>
        factor * primary(sort.key, a, b, context) || nameFactor * byName(a, b),
    )
    .map((row) => row.personId);
}

/** Open requests by student, oldest first. */
export function signalsByPerson(signals: readonly LiveSignal[]) {
  const map = new Map<string, LiveSignal[]>();
  for (const signal of [...signals].sort(
    (a, b) => time(a.createdAt) - time(b.createdAt),
  ))
    map.set(signal.personId, [...(map.get(signal.personId) ?? []), signal]);
  return map;
}
