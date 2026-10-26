import type { SourceInventory } from "../source-reconciliation";
import { floridaInventory, type FloridaBand } from "./inventory";
import { floridaG35ExpectedIds, floridaG35Rows } from "./g35";
import { floridaG68ExpectedIds, floridaG68Rows } from "./g68";
import { floridaHsExpectedIds, floridaHsRows } from "./hs";
import { floridaK2ExpectedIds, floridaK2Rows } from "./k2";
import { floridaMtrRows } from "./mtr";

const stamp = "2026-10-26";
export const floridaBands: readonly FloridaBand[] = [
  {
    id: `florida-k2-best-2025-${stamp}`,
    grade: "K-2",
    rows: floridaK2Rows,
    expectedIds: floridaK2ExpectedIds,
    limitations: [
      "Kindergarten to grade 2 benchmarks are inventoried in full, including measurement, geometry and data strands.",
    ],
  },
  {
    id: `florida-35-best-2025-${stamp}`,
    grade: "3-5",
    rows: floridaG35Rows,
    expectedIds: floridaG35ExpectedIds,
    limitations: [
      "Grades 3 to 5 include the separate Fractions strand; clarifications limit denominators and operand sizes.",
    ],
  },
  {
    id: `florida-68-best-2025-${stamp}`,
    grade: "6-8",
    rows: floridaG68Rows,
    expectedIds: floridaG68ExpectedIds,
    limitations: [
      "Grades 6 to 8 are inventoried in full, including the grade 8 Functions strand.",
    ],
  },
  {
    id: `florida-912-best-2025-${stamp}`,
    grade: "Algebra 1, Geometry, Algebra 2, Precalculus",
    rows: floridaHsRows,
    expectedIds: floridaHsExpectedIds,
    limitations: [
      "Only the 181 benchmarks listed for Algebra 1, Geometry (July 2025 PDF course overview), Algebra 2 and Precalculus Honors (FLDOE course descriptions) are inventoried. The other 156 MA.912 benchmarks (45 calculus, 39 further data, 28 logic and discrete mathematics, 24 financial literacy, and 20 in algebra, geometry, number and function strands used only by other courses) are out of scope for this inventory.",
      "A benchmark shared by several courses carries every stated course limit; template presence satisfies it only where sampled cases respect the strictest relevant limit.",
    ],
  },
  {
    id: `florida-mtr-best-2025-${stamp}`,
    grade: "K-12 process",
    rows: floridaMtrRows,
    expectedIds: floridaMtrRows.map((r) => r[0]),
    crossCutting: true,
    limitations: [
      "The seven Mathematical Thinking and Reasoning standards are embedded in instruction for every benchmark. They are recorded as cross-cutting and not assessed by item practice.",
    ],
  },
];
export const floridaInventories: readonly SourceInventory[] =
  floridaBands.map(floridaInventory);
