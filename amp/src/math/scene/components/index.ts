/**
 * Every component, one file each. Adding a component: write
 * \`components/<name>.ts\` (its schema, its type and \`registerComponent\`), then
 * add one import line and one array entry below, in alphabetical order.
 */
import { areaModelSchema } from "./area-model";
import { arraySchema } from "./array";
import { baseTenSchema } from "./base-ten";
import { clockSchema } from "./clock";
import { fractionBarSchema } from "./fraction-bar";
import { graphSchema } from "./graph";
import { numberLineSchema } from "./number-line";
import { tableSchema } from "./table";
import { tenFrameSchema } from "./ten-frame";

export const componentSchemas = [
  areaModelSchema,
  arraySchema,
  baseTenSchema,
  clockSchema,
  fractionBarSchema,
  graphSchema,
  numberLineSchema,
  tableSchema,
  tenFrameSchema,
] as const;

export * from "./area-model";
export * from "./array";
export * from "./base-ten";
export * from "./clock";
export * from "./fraction-bar";
export * from "./graph";
export * from "./number-line";
export * from "./table";
export * from "./ten-frame";
