import type { SourceInventory } from "../source-reconciliation";
import { texasK2Inventories } from "./k2";
import { texasGrades35Inventories } from "./35";
import { texasGrades68Inventories } from "./68";
import { texasHighSchoolInventories } from "./hs";

/** Texas mathematics TEKS: Kindergarten through Grade 8, Algebra I, Geometry, Algebra II and Precalculus. */
export const texasInventories: readonly SourceInventory[] = [
  ...texasK2Inventories,
  ...texasGrades35Inventories,
  ...texasGrades68Inventories,
  ...texasHighSchoolInventories,
];
