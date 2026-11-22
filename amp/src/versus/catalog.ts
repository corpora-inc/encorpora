/** Readings of the hub's catalog, shared by the screens and the static
 * documents. Each takes the catalog, so it runs in the app and in Node. */
import { versusCategories, type VersusCategoryInfo } from "./amp";
import type { VersusCatalogEntry } from "./types";

/** The catalog by category, in the hub's order. A category with no
 * comparison yet is left out. */
export function versusGroups(
  catalog: readonly VersusCatalogEntry[],
): { category: VersusCategoryInfo; entries: VersusCatalogEntry[] }[] {
  return versusCategories
    .map((category) => ({
      category,
      entries: catalog.filter((entry) => entry.category === category.id),
    }))
    .filter((group) => group.entries.length > 0);
}

/** Up to three other comparisons in the same category: the ones after this
 * page in the catalog, around again from the top, so every page in a
 * category is linked from others. */
export function relatedComparisons(
  slug: string,
  catalog: readonly VersusCatalogEntry[],
  count = 3,
): VersusCatalogEntry[] {
  const own = catalog.find((entry) => entry.slug === slug);
  if (!own) return [];
  const group = catalog.filter((entry) => entry.category === own.category);
  const at = group.indexOf(own);
  return [...group.slice(at + 1), ...group.slice(0, at)].slice(0, count);
}

export const versusPath = (slug: string) => `/versus/${slug}`;
