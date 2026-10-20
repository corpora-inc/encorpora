import { strandNames } from "../../BirthYearPrompt";
import type { TrialCatalog } from "./types";

/** Areas with practice in the catalog, in the map's order. */
export function strandOrder(catalog: TrialCatalog | undefined) {
  if (!catalog) return [];
  return Object.keys(strandNames).filter((strand) =>
    catalog.skills.some(
      (skill) =>
        skill.strand === strand &&
        catalog.templates.some((t) => t.skillId === skill.id),
    ),
  );
}
