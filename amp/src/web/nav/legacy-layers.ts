import { queryClient, sessionOptions } from "../lib/query";
import { OPEN_KEY } from "./entities";

/**
 * Helpers for addresses from before the layer store (`?open=`, `?lesson=`, a
 * skill's or a student's own address), as their rows of
 * app/legacy-aliases.ts land them.
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
