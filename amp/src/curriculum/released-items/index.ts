import { templates } from "../../math/engine";
import { actualFacetMappings } from "../../content/facet-mappings";
import { skills } from "../catalog";
import { archetypes } from "../archetypes";
import { templateArchetypes } from "../template-archetypes";
import { buildReleasedItemReport, type ReleasedItemInput } from "./ledger";
import type { SourceLedger } from "./types";
import { mcasGrade3 } from "./mcas-2025-3";
import { mcasGrade4 } from "./mcas-2025-4";
import { mcasGrade5 } from "./mcas-2025-5";
import { mcasGrade6 } from "./mcas-2025-6";
import { mcasGrade7 } from "./mcas-2025-7";
import { mcasGrade8 } from "./mcas-2025-8";
import { mcasGrade10 } from "./mcas-2025-10";
import { ny2026Grade7 } from "./ny-2026-7";
import { staarGrade3 } from "./staar-2025-3";
import { staarGrade4 } from "./staar-2025-4";
import { staarGrade5 } from "./staar-2025-5";
import { staarGrade6 } from "./staar-2025-6";
import { staarGrade7 } from "./staar-2025-7";
import { staarGrade8 } from "./staar-2025-8";
import { staarAlgebra1 } from "./staar-2025-alg1";
import { satFramework2026 } from "./sat-framework-2026";
import { satPractice4 } from "./sat-practice-4";
import { satPractice5 } from "./sat-practice-5";
import { satPractice6 } from "./sat-practice-6";
import { satPractice7 } from "./sat-practice-7";
import { satPractice8 } from "./sat-practice-8";
import { satPractice9 } from "./sat-practice-9";
import { satPractice10 } from "./sat-practice-10";
import { satPractice11 } from "./sat-practice-11";
import { regentsAlgebra1June2026 } from "./regents-2026-06-algebra1";
import { regentsGeometryJune2026 } from "./regents-2026-06-geometry";
import { regentsAlgebra2June2026 } from "./regents-2026-06-algebra2";
import { familyRegistry } from "../../families/registry";

/** Ledger order is the saturation order: complete SAT practice forms in
 * publication order, then the framework and purposive state samples, then complete state forms. Append new sources at the end. */
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
  ny2026Grade7,
  staarGrade3,
  staarGrade4,
  staarGrade5,
  staarGrade6,
  staarGrade7,
  staarGrade8,
  staarAlgebra1,
  mcasGrade3,
  mcasGrade4,
  mcasGrade5,
  mcasGrade6,
  mcasGrade7,
  mcasGrade8,
  mcasGrade10,
  regentsAlgebra1June2026,
  regentsGeometryJune2026,
  regentsAlgebra2June2026,
  // Frozen legacy order above; family ledgers append from src/families/.
  ...familyRegistry.releasedLedgers,
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
