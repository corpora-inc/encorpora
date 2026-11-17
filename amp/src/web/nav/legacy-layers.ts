import { queryClient, sessionOptions } from "../lib/query";
import { OPEN_KEY } from "./entities";
import { layerScope, seedLayers, type Layer } from "./layer-store";

/**
 * Addresses from before the layer store (`?open=`, `?lesson=`, a skill's or
 * a student's own address), as their rows of app/legacy-aliases.ts land
 * them: the layers they name go into the store for the screen they land on,
 * and that address names the screen only. The alias table makes the one hop
 * (and only for a navigation that shows, never a preload).
 */

/** The session's account, for a layer stack keyed by it (nav/layer-store). */
export async function sessionAccount() {
  const session = await queryClient
    .ensureQueryData(sessionOptions)
    .catch((error: unknown) => {
      console.warn("Layers from an older link go to the guest's map", error);
      return null;
    });
  return session?.accountId;
}

/** An older address's layers into the store for the screen `href` names;
 * `href`, for its alias to go to. */
export async function landingWithLayers(
  href: string,
  stack: Layer[],
): Promise<string> {
  seedLayers(layerScope(href.split(/[?#]/)[0]!, await sessionAccount()), stack);
  return href;
}

/** An address without the keys that named layers (or a map's view) before
 * their stores. */
export function withoutLayerKeys(
  pathname: string,
  search: Record<string, unknown>,
  keys: readonly string[] = [OPEN_KEY, "lesson", "skill"],
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search))
    if (!keys.includes(key) && value !== undefined)
      params.set(
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      );
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
