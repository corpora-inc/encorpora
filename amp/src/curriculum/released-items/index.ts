import { templates } from "../../math/engine";
import { actualFacetMappings } from "../../content/facet-mappings";
import { skills } from "../catalog";
import { archetypes } from "../archetypes";
import { templateArchetypes } from "../template-archetypes";
import { buildReleasedItemReport, type ReleasedItemInput } from "./ledger";
import type { SourceLedger } from "./types";
import { mcas2025Grade5 } from "./mcas-2025-5";
import { mcas2025Grade8 } from "./mcas-2025-8";
import { mcas2025Grade10 } from "./mcas-2025-10";
import { ny2026Grade7 } from "./ny-2026-7";
import { satFramework2026 } from "./sat-framework-2026";
import { satPractice4 } from "./sat-practice-4";
import { satPractice5 } from "./sat-practice-5";
import { satPractice6 } from "./sat-practice-6";
import { satPractice7 } from "./sat-practice-7";
import { satPractice8 } from "./sat-practice-8";
import { satPractice9 } from "./sat-practice-9";
import { satPractice10 } from "./sat-practice-10";
import { satPractice11 } from "./sat-practice-11";

/** Ledger order is the saturation order: complete SAT practice forms in
 * publication order, then the framework and purposive state samples. Append new sources at the end. */
export const releasedLedgers: readonly SourceLedger[] = [
  satPractice4,
  satPractice5,
  satPractice6,
  satPractice7,
  satPractice8,
  satPractice9,
  satPractice10,
  satPractice11,
  satFramework2026,
  mcas2025Grade5,
  mcas2025Grade8,
  mcas2025Grade10,
  ny2026Grade7,
];
export const releasedItems = releasedLedgers.flatMap((l) => l.items);
/** Production ledger. Pass `ledgers` (and matching `templates`) to report a
 * custom catalog; it never inherits production items. */
export function buildReleasedItemLedger(
  input: Partial<Omit<ReleasedItemInput, "archetypes">> = {},
) {
  return buildReleasedItemReport({
    ledgers: input.ledgers ?? releasedLedgers,
    archetypes,
    templates: input.templates ?? templates,
    templateArchetypes: input.templateArchetypes ?? templateArchetypes,
    skillIds: input.skillIds ?? skills.map((s) => s.id),
    facetMappings: input.facetMappings ?? actualFacetMappings,
  });
}
