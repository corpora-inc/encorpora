import type { SourceInventory } from "../source-reconciliation";
import { georgiaG4ExpectedIds, georgiaG4Rows } from "./g4";
import { georgiaInventory, type GeorgiaBand } from "./inventory";

const stamp = "2026-11-04";
export const georgiaBands: readonly GeorgiaBand[] = [
  {
    id: `georgia-g4-sy2023-${stamp}`,
    grade: "4",
    rows: georgiaG4Rows,
    expectedIds: georgiaG4ExpectedIds,
    limitations: [
      "Grade 4 only. Parent clusters 4.NR.1, 4.NR.2, 4.PAR.3, 4.NR.4, 4.NR.5, 4.MDR.6, 4.GSR.7, and 4.GSR.8 are not rows.",
    ],
  },
];
export const georgiaInventories: readonly SourceInventory[] =
  georgiaBands.map(georgiaInventory);
