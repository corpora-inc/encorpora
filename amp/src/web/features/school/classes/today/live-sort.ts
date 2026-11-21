import { useCallback } from "react";
import {
  liveSortKeys,
  type LiveSort,
  type LiveSortDirection,
  type LiveSortKey,
} from "../../../live/sort";
import {
  SESSION_LENGTHS,
  type SessionLength,
} from "../../../live/SessionControl";
import { useSessionOrNull } from "../../../../lib/session";
import { useViewStore, viewScope } from "../../view-store";

/** Who needs the adult first: the order a teacher opens the cockpit in. */
export const DEFAULT_COCKPIT_SORT: LiveSort = {
  key: "attention",
  direction: "ascending",
  version: 0,
};

/** The fields a sort keeps in the class's view. */
type SortView = {
  liveSort?: string;
  liveDirection?: string;
  liveVersion?: number;
};

/** The class's own scope, whichever address shows its Today. */
const scopeOf = (
  accountId: string | null | undefined,
  place: { org: string; class: string },
) => viewScope(accountId, `/school/${place.org}/classes/${place.class}/today`);

const isKey = (value: unknown): value is LiveSortKey =>
  (liveSortKeys as readonly unknown[]).includes(value);

/** The sort a view holds, or the default. */
export function sortOf(view: SortView | undefined): LiveSort {
  if (!view || !isKey(view.liveSort)) return DEFAULT_COCKPIT_SORT;
  const direction: LiveSortDirection =
    view.liveDirection === "descending" ? "descending" : "ascending";
  return {
    key: view.liveSort,
    direction,
    version: typeof view.liveVersion === "number" ? view.liveVersion : 0,
  };
}

/**
 * The cockpit's sort for one class, in the school view store as three flat
 * fields (key, direction, version): one owner for the screen, kept for the
 * tab through Back, Forward and a refresh, and the same whether Today is
 * reached at the class's address or its `/today`. Opening a student layer
 * and closing it leaves it as it was.
 */
export function useLiveSort(place: { org: string; class: string }) {
  const accountId = useSessionOrNull()?.accountId;
  const scope = scopeOf(accountId, place);
  const view = useViewStore((state) => state.views[scope]) as
    | SortView
    | undefined;
  const set = useCallback(
    (sort: LiveSort) =>
      useViewStore.getState().patch(scope, {
        liveSort: sort.key,
        liveDirection: sort.direction,
        liveVersion: sort.version,
      }),
    [scope],
  );
  return [sortOf(view), set] as const;
}

/** The session length chosen for the next Start (minutes; none: no set
 * length), kept with the class's view so the bar's Start class and
 * Today's control start the same session. */
export function useLiveLength(place: { org: string; class: string }) {
  const accountId = useSessionOrNull()?.accountId;
  const scope = scopeOf(accountId, place);
  const minutes = useViewStore(
    (state) => (state.views[scope] as { liveLength?: number } | undefined)
      ?.liveLength,
  );
  const set = useCallback(
    (length: SessionLength) =>
      useViewStore
        .getState()
        .patch(scope, { liveLength: length ?? undefined }),
    [scope],
  );
  const length: SessionLength = (SESSION_LENGTHS as readonly unknown[]).includes(
    minutes,
  )
    ? (minutes as SessionLength)
    : null;
  return [length, set] as const;
}
