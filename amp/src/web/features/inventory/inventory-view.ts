import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useLayerScope } from "../../nav/links";

/**
 * How an inventory is being looked at: its search's text, its collection
 * (all, tried, earned, strong) and its math area. One owner per screen,
 * keyed as the screen's layers are (nav/layer-store.ts `layerScope`: a
 * family child's address, else the account and the address), so Back, a
 * refresh and a return from practice find it as it was. The address names
 * the screen only, never this view (amp/AGENTS.md, "URLs name screens, not
 * state"); like the map's (features/pathways/map-view.ts).
 */
export type InventoryView = {
  topic: string;
  /** The collection chosen; "" until one is (the screen's default). */
  collection: string;
  /** A math area's id, as Pathways names it; "" for all. */
  area: string;
};
const NONE: InventoryView = { topic: "", collection: "", area: "" };

type InventoryViewState = {
  views: Record<string, InventoryView>;
  set: (scope: string, patch: Partial<InventoryView>) => void;
};

/** The screens remembered at once: the oldest is forgotten first. */
const SCOPES = 40;

const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch (error) {
      console.warn("The inventory's view is not restored", error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn("The inventory's view is not saved", error);
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch (error) {
      console.warn("The inventory's view is not cleared", error);
    }
  },
}));

export const useInventoryViewStore = create<InventoryViewState>()(
  persist(
    (set) => ({
      views: {},
      set: (scope, patch) =>
        set((state) => {
          const before = state.views[scope];
          const next = { ...NONE, ...before, ...patch };
          const empty = !next.topic && !next.collection && !next.area;
          const kept = Object.entries(state.views)
            .filter(([key]) => key !== scope)
            .slice(-(SCOPES - 1));
          return {
            views: Object.fromEntries(empty ? kept : [...kept, [scope, next]]),
          };
        }),
    }),
    {
      name: "amp.inventory-view",
      storage,
      version: 1,
      partialize: (state) => ({ views: state.views }),
    },
  ),
);

/** This screen's inventory view, and changing it. */
export function useInventoryView() {
  const scope = useLayerScope();
  const view = useInventoryViewStore((state) => state.views[scope] ?? NONE);
  return {
    ...view,
    set: (patch: Partial<InventoryView>) =>
      useInventoryViewStore.getState().set(scope, patch),
  };
}
