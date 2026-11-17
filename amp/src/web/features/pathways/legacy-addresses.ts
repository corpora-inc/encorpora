import { sessionAccount } from "../../nav/legacy-layers";
import { layerScope } from "../../nav/layer-store";
import { mapViewOf, seedMapView } from "./map-view";

/*
 * The map's view from before its store (map-view.ts), as the Pathways rows
 * of app/legacy-aliases.ts carry it: an older link's `?topic=`, `?filter=`
 * and `?area=` go into the view of the map it lands on, and `?view=` becomes
 * this device's choice of view, as choosing it on the map would. Loaded only
 * when such an address is opened.
 */

/** The keys an older map address carried its view in. */
export const MAP_VIEW_KEYS = ["topic", "filter", "area", "view"] as const;

/** An older map link's view, into the map's view at `href`. */
export async function carryMapView(
  href: string,
  search: Record<string, unknown>,
) {
  const view = search.view;
  if (view === "3d" || view === "grades")
    try {
      localStorage.setItem("amp.pathways-view", view);
    } catch (error) {
      console.warn("This device keeps no map view", error);
    }
  seedMapView(
    layerScope(href.split(/[?#]/)[0]!, await sessionAccount()),
    mapViewOf(search),
  );
}
