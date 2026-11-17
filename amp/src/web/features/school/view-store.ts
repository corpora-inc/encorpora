import { useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useSessionOrNull } from "../../lib/session";

/*
 * A school screen's view (amp/AGENTS.md, "Frontend architecture": URLs name
 * screens, not state): what a person has chosen on a screen that has no
 * address of its own (a list's sort and filter, the term shown, the sheet
 * open over it). The path names the screen; its view lives here, keyed by
 * the account and the screen's path, so it is one owner shared by every
 * part of the screen, Back and Forward return to it as it was left, and a
 * refresh restores it (sessionStorage: this tab only).
 *
 * A link that opens another screen with something chosen ("Add a class",
 * one term's report cards) sets that screen's view in its click, before it
 * navigates (`openView`, ViewLink.tsx): the destination is whole on arrival,
 * and the address carries nothing.
 */

export type ViewValue = string | number | undefined;
export type View = Readonly<Record<string, ViewValue>>;

/** A screen's path as a scope: no trailing slash, no search, no hash. */
const pathOf = (path: string) =>
  `/${path.split(/[?#]/)[0]!.replace(/^\/+|\/+$/g, "")}`;

/** The scope a screen's view lives under: the account, then the path. */
export const viewScope = (accountId: string | null | undefined, path: string) =>
  `${accountId ?? "guest"}:${pathOf(path)}`;

/** The screens remembered at once: the oldest is forgotten first. */
const SCOPES = 60;

type ViewState = {
  views: Record<string, View>;
  /** Merges `patch` into a screen's view; an undefined value removes it. */
  patch: (scope: string, patch: View) => void;
};

const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch (error) {
      console.warn("School views not restored", error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn("School views not saved", error);
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch (error) {
      console.warn("School views not cleared", error);
    }
  },
}));

const merged = (view: View | undefined, patch: View): View => {
  const next: Record<string, ViewValue> = { ...view };
  for (const [key, value] of Object.entries(patch))
    if (value === undefined || value === "") delete next[key];
    else next[key] = value;
  return next;
};

export const useViewStore = create<ViewState>()(
  persist(
    (set) => ({
      views: {},
      patch: (scope, patch) =>
        set((state) => {
          const { [scope]: old, ...others } = state.views;
          const next = merged(old, patch);
          // The newest screen last, so the oldest goes first.
          const kept = Object.entries(others).slice(-(SCOPES - 1));
          return {
            views: Object.fromEntries(
              Object.keys(next).length ? [...kept, [scope, next]] : kept,
            ),
          };
        }),
    }),
    { name: "amp.school-views", storage, version: 1 },
  ),
);

const EMPTY: View = {};

/** Sets another screen's view before a link or a handler goes there. */
export function openView(
  accountId: string | null | undefined,
  path: string,
  patch: View,
) {
  useViewStore.getState().patch(viewScope(accountId, path), patch);
}

/** `openView` for the signed-in account: `(path, patch) => void`. */
export function useOpenView() {
  const accountId = useSessionOrNull()?.accountId;
  return useCallback(
    (path: string, patch: View) => openView(accountId, path, patch),
    [accountId],
  );
}

/**
 * This screen's view, and the ways to change it: `set(patch)` merges (an
 * undefined value clears a key) and `clear(...keys)` puts keys down (a
 * sheet's close). Neither touches the address or history.
 */
export function useScreenView<T extends View = Record<string, ViewValue>>() {
  const accountId = useSessionOrNull()?.accountId;
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const scope = viewScope(accountId, pathname);
  const view = useViewStore((state) => state.views[scope] ?? EMPTY) as Partial<T>;
  const set = useCallback(
    (patch: { [K in keyof T]?: ViewValue }) =>
      useViewStore.getState().patch(scope, patch as View),
    [scope],
  );
  const clear = useCallback(
    (...keys: (keyof T & string)[]) =>
      useViewStore
        .getState()
        .patch(scope, Object.fromEntries(keys.map((key) => [key, undefined]))),
    [scope],
  );
  return [view, set, clear] as const;
}
