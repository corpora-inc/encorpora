import { useSyncExternalStore, type ComponentType } from "react";

/*
 * The bar's Start class for a class (#2465), kept out of the app's entry:
 * its live reads and the start belong to the class's own code. The class's
 * route loads it with its data (`loadClassSessionAction`), so the bar's
 * first paint already has it: never an empty slot that fills a moment
 * later. Until then the bar holds its place (AppShell).
 */

export type ClassSessionActionProps = {
  org: string;
  classId: string;
  /** Today is on screen: its own session control is the action there. */
  today: boolean;
};

let loaded: ComponentType<ClassSessionActionProps> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function loadClassSessionAction(): Promise<void> {
  loading ??= import("./ClassSessionAction").then(
    (module) => {
      loaded = module.ClassSessionAction;
      for (const listener of listeners) listener();
    },
    (error: unknown) => {
      loading = null;
      console.error("AMP: the class's Start class didn’t load", error);
    },
  );
  return loading;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The action, once its code is here; null before. */
export function useClassSessionAction() {
  return useSyncExternalStore(
    subscribe,
    () => loaded,
    () => null,
  );
}
