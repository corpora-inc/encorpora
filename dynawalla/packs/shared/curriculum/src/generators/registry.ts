/**
 * Generator-family registry. One entry per family; 18 by the end of V1.
 */

import { erase } from "../types/generator.ts";
import type { AnyGeneratorFamily } from "../types/generator.ts";
import type { FamilyId } from "../types/ids.ts";
import { columnOpFamily } from "./columnOp/family.ts";

export const generatorFamilies: readonly AnyGeneratorFamily[] = [erase(columnOpFamily)];

export function familyById(
  id: FamilyId,
  families: readonly AnyGeneratorFamily[] = generatorFamilies,
): AnyGeneratorFamily | undefined {
  return families.find((family) => family.family === id);
}
