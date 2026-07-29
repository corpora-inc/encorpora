/**
 * Generator-family registry. One entry per family; 18 by the end of V1.
 */

import { erase } from "../types/generator.ts";
import type { AnyGeneratorFamily } from "../types/generator.ts";
import type { FamilyId } from "../types/ids.ts";
import { columnOpFamily } from "./columnOp/family.ts";
import { compareOrderFamily } from "./compareOrder/family.ts";
import { fracArithFamily } from "./fracArith/family.ts";
import { fracEquivalenceFamily } from "./fracEquivalence/family.ts";
import { longDivFamily } from "./longDiv/family.ts";
import { missingOperandFamily } from "./missingOperand/family.ts";
import { multidigitMulFamily } from "./multidigitMul/family.ts";
import { numberFactsFamily } from "./numberFacts/family.ts";
import { placeValueFamily } from "./placeValue/family.ts";
import { signedIntFamily } from "./signedInt/family.ts";
import { roundEstimateFamily } from "./roundEstimate/family.ts";
import { timesTableFamily } from "./timesTable/family.ts";

export const generatorFamilies: readonly AnyGeneratorFamily[] = [
  erase(numberFactsFamily),
  erase(columnOpFamily),
  erase(placeValueFamily),
  erase(compareOrderFamily),
  erase(roundEstimateFamily),
  erase(multidigitMulFamily),
  erase(longDivFamily),
  erase(fracEquivalenceFamily),
  erase(fracArithFamily),
  erase(missingOperandFamily),
  erase(timesTableFamily),
  erase(signedIntFamily),
];

export function familyById(
  id: FamilyId,
  families: readonly AnyGeneratorFamily[] = generatorFamilies,
): AnyGeneratorFamily | undefined {
  return families.find((family) => family.family === id);
}
