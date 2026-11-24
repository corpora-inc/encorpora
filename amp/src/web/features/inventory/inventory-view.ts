import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { layerScope } from "../../nav/layer-store";
import { useLayerScope } from "../../nav/links";

/**
 * How an inventory is being looked at: by grade or by area, its search's
 * text, its collection (all, tried, earned, strong), its math area and its
 * grade. One owner per screen,
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
  /** How it is sliced, once chosen ("grade" or "area"); "" until it is
   * (the screen's default, grade-index.ts `inventoryMode`). Absent, like
   * `grade`, in a view kept from before there were two. */
  view?: string;
  /** By grade: the grade or course on view (a band of
   * features/pathways/model.ts); "" for the learner's own. */
  grade?: string;
};
const NONE: InventoryView = {
  topic: "",
  collection: "",
  area: "",
  view: "",
  grade: "",
};

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
            !next.topic &&
            !next.collection &&
            !next.area &&
            !next.view &&
            !next.grade;
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
 * A family's child's inventory, by grade: what a link to it sets as it is
 * followed (their block on Today, their Overall). On `band` when the link
 * names a grade ("All Grade 4 skills"), else on the child's own. The
 * address names the screen; this is its view. Its search, collection and
 * area stay as they were left.
 */
export function showByGrade(inventoryPath: string, band = "") {
  useInventoryViewStore
    .getState()
    .set(layerScope(inventoryPath, undefined), { view: "grade", grade: band });
}
