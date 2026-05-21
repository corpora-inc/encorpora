import { useCatalogStore } from "@/store/catalog";

/**
 * Subscribes a React component to the live online/offline status.
 *
 * The catalog store already bridges `navigator.onLine` + the `online` /
 * `offline` window events into Zustand at module init (see `store/catalog.ts`),
 * so any subscriber rerenders on connectivity changes without each component
 * wiring its own listener.
 */
export function useOnlineStatus(): boolean {
    return useCatalogStore((s) => s.isOnline);
}
