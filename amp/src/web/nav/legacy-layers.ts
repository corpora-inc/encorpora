import { redirect } from "@tanstack/react-router";
import { queryClient, sessionOptions } from "../lib/query";
import { OPEN_KEY } from "./entities";
import { layerScope, seedLayers, type Layer } from "./layer-store";

/**
 * Addresses from before the layer store, in their one legacy hop (a route's
 * `beforeLoad`): `map/<student>`, `students/<student>/work/<answer>`,
 * `/pathways/<skill>`, `?lesson=`, `/lessons?topic=`. The layers they name
 * go into the store for the screen they land on, and that address names
 * the screen only: one replaced entry, never a second for `?open=`.
 */

/** The session's account, for a layer stack keyed by it (nav/layer-store). */
async function layerAccount() {
  const session = await queryClient
    .ensureQueryData(sessionOptions)
    .catch((error: unknown) => {
      console.warn("Layers from an older link go to the guest's map", error);
      return null;
    });
  return session?.accountId;
}
/** An older address's layers, in its one legacy hop: the store holds them
 * for the screen it lands on (never for a preload), and the address it
 * lands on names the screen only. */
export async function landWithLayers(
  href: string,
  stack: Layer[],
  preload: boolean | undefined,
): Promise<never> {
  if (!preload)
    seedLayers(layerScope(href.split(/[?#]/)[0]!, await layerAccount()), stack);
  throw redirect({ href, replace: true });
}
/** An address without the keys that named layers before the store. */
export function withoutLayerKeys(
  pathname: string,
  search: Record<string, unknown>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search))
    if (![OPEN_KEY, "lesson", "skill"].includes(key) && value !== undefined)
      params.set(
        key,
        typeof value === "string" ? value : JSON.stringify(value),
      );
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}
