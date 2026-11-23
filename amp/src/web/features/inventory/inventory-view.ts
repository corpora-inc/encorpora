import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { layerScope } from "../../nav/layer-store";
import { useLayerScope } from "../../nav/links";
import { OWN_GRADE } from "./grade-index";

/**
 * How an inventory is being looked at: its search's text, its collection
 * (all, tried, earned, strong), its math area and its grade. One owner per
 * screen,
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
  /** One grade or course (a band of features/pathways/model.ts), or the
   * learner's own (`OWN_GRADE`); "" for every grade. Absent in a view kept
   * from before it had one. */
  grade?: string;
};
const NONE: InventoryView = { topic: "", collection: "", area: "", grade: "" };

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
          const empty =
            !next.topic && !next.collection && !next.area && !next.grade;
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

/**
 * A family's child's inventory, opened on their own grade with every skill
 * of it: what a link to it sets as it is followed (a child's block on
 * Today, their Overall). The address names the screen; this is its view.
 */
export function showOwnGrade(inventoryPath: string) {
  useInventoryViewStore.getState().set(layerScope(inventoryPath, undefined), {
    topic: "",
    collection: "",
    area: "",
    grade: OWN_GRADE,
  });
}
