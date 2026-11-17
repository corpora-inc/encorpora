import { useRouter, useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";

/*
 * A sheet opened over a screen without an address of its own (docs/design/
 * ia.md; the IA v2 spec, "Two overlay mechanisms"): adding a child, an
 * invitation, the year's dates, the devices, one child's settings.
 *
 * The screen's address names the screen; which sheet is open over it lives
 * in the history entry's state (`state.sheet`). Opening pushes the same
 * address with that state: a history entry with no URL change, so the
 * browser's Back (and Android's) closes the sheet, as ✕ and Escape do. A
 * reload keeps it, because history state survives a reload. A shared link
 * carries no state, so it opens the screen behind. A legacy address opens one
 * on its one hop: `redirect({ href, state: sheetState(name), replace: true })`.
 *
 * One sheet at a time: opening another replaces the open one's entry, never a
 * stack of sheets for Back to walk through.
 */

/** Where a history entry names its sheet. */
export const SHEET_KEY = "sheet";
/** Set on an entry this hook pushed: closing it goes Back to the screen. */
const PUSHED_KEY = "sheetPushed";

type State = Record<string, unknown>;

/** The sheet a history entry's state names, or null. */
export function sheetOf(state: unknown): string | null {
  const value =
    state && typeof state === "object" ? (state as State)[SHEET_KEY] : null;
  return typeof value === "string" && value ? value : null;
}

/** The history state a legacy hop writes to open a sheet on arrival. */
export function sheetState(name: string): State {
  return { [SHEET_KEY]: name };
}

/** The state with the sheet put down (and this hook's own mark gone). */
function without(state: unknown): State {
  const {
    [SHEET_KEY]: _sheet,
    [PUSHED_KEY]: _pushed,
    ...rest
  } = state && typeof state === "object" ? (state as State) : {};
  return rest;
}

/** Whether closing goes Back: this entry was pushed by an open over the same
 * screen, so the entry before it is that screen without the sheet. */
export function closesBack(state: unknown) {
  return (
    !!state &&
    typeof state === "object" &&
    (state as State)[PUSHED_KEY] === true &&
    sheetOf(state) !== null
  );
}

/** Opening and closing any named sheet over the current screen (a screen
 * that hosts a sheet per row, `child:<learner>`). */
export function useSheetNav() {
  const router = useRouter();
  const show = useCallback(
    (name: string) => {
      const here = router.history.location;
      const current = sheetOf(here.state);
      if (current === name) return;
      // Another sheet is open: this one takes its entry, so Back still
      // closes to the screen and never to the sheet before.
      const replace = current !== null;
      void router.navigate({
        href: here.href,
        replace,
        resetScroll: false,
        state: {
          ...without(here.state),
          [SHEET_KEY]: name,
          [PUSHED_KEY]: replace ? closesBack(here.state) : true,
        } as never,
      });
    },
    [router],
  );
  const close = useCallback(
    (name: string) => {
      const here = router.history.location;
      if (sheetOf(here.state) !== name) return;
      if (closesBack(here.state)) router.history.back();
      // Opened on arrival (a legacy hop, a restored tab with no entry
      // behind): put it down in place, never a new entry.
      else
        void router.navigate({
          href: here.href,
          replace: true,
          resetScroll: false,
          state: without(here.state) as never,
        });
    },
    [router],
  );
  return { show, close };
}

/**
 * One named sheet over the current screen: whether it is open, and the way
 * to open and close it. `onOpenChange` fits `ui/Sheet` directly.
 */
export function useSheet(name: string) {
  const nav = useSheetNav();
  const open = useRouterState({
    select: (state) => sheetOf(state.location.state) === name,
  });
  const show = useCallback(() => nav.show(name), [nav, name]);
  const close = useCallback(() => nav.close(name), [nav, name]);
  const onOpenChange = useCallback(
    (next: boolean) => (next ? show() : close()),
    [show, close],
  );
  return { open, show, close, onOpenChange };
}

/** Which sheet is open over this screen, for a screen that hosts several
 * keyed sheets (`child:<learner>`). */
export function useOpenSheet(): string | null {
  return useRouterState({ select: (state) => sheetOf(state.location.state) });
}
