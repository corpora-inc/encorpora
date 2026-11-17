import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useLayerScope } from "../../nav/links";
import { areas, type AreaId } from "./model";

/**
 * How a map is being looked at: its search's text, its grade or course and
 * its area of math (the key). One owner per screen, keyed as the screen's
 * layers are (nav/layer-store.ts `layerScope`: a family's or school's
 * address, else the account and the address), so Back, a refresh and a
 * return from practice find the map as it was. The address names the
 * screen only; an older link's `?topic=`, `?filter=` and `?area=` land here
 * through their alias (app/legacy-aliases.ts).
 */
export type MapView = {
  topic: string;
  /** A grade band or a course (`gradeBand`); "" for all. */
  band: string;
  area: AreaId | null;
};
const NONE: MapView = { topic: "", band: "", area: null };

type MapViewState = {
  views: Record<string, MapView>;
  set: (scope: string, patch: Partial<MapView>) => void;
};

/** The screens remembered at once: the oldest is forgotten first. */
const SCOPES = 40;

const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch (error) {
      console.warn("The map's view is not restored", error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn("The map's view is not saved", error);
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch (error) {
      console.warn("The map's view is not cleared", error);
    }
  },
}));

const isArea = (value: unknown): value is AreaId =>
  areas.some((area) => area.id === value);

export const useMapViewStore = create<MapViewState>()(
  persist(
    (set) => ({
      views: {},
      set: (scope, patch) =>
        set((state) => {
          const { [scope]: before, ...others } = state.views;
          const next = { ...NONE, ...before, ...patch };
          const empty = !next.topic && !next.band && !next.area;
          const kept = Object.entries(others).slice(-(SCOPES - 1));
          return {
            views: Object.fromEntries(empty ? kept : [...kept, [scope, next]]),
          };
        }),
    }),
    {
      name: "amp.map-view",
      storage,
      version: 1,
      partialize: (state) => ({ views: state.views }),
    },
  ),
);

/** A view from an older link's keys (`?topic=`, `?filter=`, `?area=`). */
export function mapViewOf(search: Record<string, unknown>): Partial<MapView> {
  const view: Partial<MapView> = {};
  // A search longer than the field takes (100) is no search anyone typed:
  // an older shared link's is dropped, never an error.
  if (typeof search.topic === "string" && search.topic.length <= 100)
    view.topic = search.topic;
  if (typeof search.filter === "string") view.band = search.filter;
  if (isArea(search.area)) view.area = search.area;
  return view;
}

/** Sets a screen's view from outside React (an older link's alias). */
export function seedMapView(scope: string, view: Partial<MapView>) {
  if (Object.keys(view).length) useMapViewStore.getState().set(scope, view);
}

/** This screen's map view, and changing it. */
export function useMapView() {
  const scope = useLayerScope();
  const view = useMapViewStore((state) => state.views[scope] ?? NONE);
  return {
    ...view,
    set: (patch: Partial<MapView>) =>
      useMapViewStore.getState().set(scope, patch),
  };
}
