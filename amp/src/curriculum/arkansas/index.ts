import type { SourceInventory } from "../source-reconciliation";
import { arkansasG4ExpectedIds, arkansasG4Rows } from "./g4";
import { arkansasInventory, type ArkansasBand } from "./inventory";

const stamp = "2026-11-04";
export const arkansasBands: readonly ArkansasBand[] = [
  {
    id: `arkansas-g4-2023-${stamp}`,
    grade: "4",
    rows: arkansasG4Rows,
    expectedIds: arkansasG4ExpectedIds,
    limitations: [
      "Grade 4 only, printed pages 18-20 of the 21 June 2023 PDF. The grade-4 section does not number a process standard.",
    ],
  },
];
export const arkansasInventories: readonly SourceInventory[] =
  arkansasBands.map(arkansasInventory);
