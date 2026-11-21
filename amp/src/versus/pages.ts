/** The comparison content as the app loads it: the catalog with the versus
 * screens, and each page's file only when its page opens, so the hub never
 * downloads every comparison. */
import raw from "./catalog.json";
import type { VersusCatalogEntry, VersusPage } from "./types";

export const versusCatalog = raw as VersusCatalogEntry[];

const files = import.meta.glob<{ default: VersusPage }>("./pages/*.json");

/** One comparison, or undefined when no page has this slug. */
export async function loadVersusPage(
  slug: string,
): Promise<VersusPage | undefined> {
  const load = files[`./pages/${slug}.json`];
  return load ? (await load()).default : undefined;
}
