import type { SourceInventory } from "../source-reconciliation";
import { arizonaG4ExpectedIds, arizonaG4Rows } from "./g4";
import { arizonaInventory, type ArizonaBand } from "./inventory";

const stamp = "2026-11-04";
export const arizonaBands: readonly ArizonaBand[] = [
  {
    id: `arizona-g4-2016-${stamp}`,
    grade: "4",
    rows: arizonaG4Rows,
    expectedIds: arizonaG4ExpectedIds,
    limitations: [
      "Grade 4 only. The 2025 file is the 2016 standards with an Essential Standards overlay. Asterisks do not drop a standard.",
    ],
  },
];
export const arizonaInventories: readonly SourceInventory[] =
  arizonaBands.map(arizonaInventory);
