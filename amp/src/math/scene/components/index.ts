/**
 * Every component, one file each. Adding a component: write
 * `components/<name>.ts` (its schema, its type and `registerComponent`), then
 * add one import line and one array entry below, in alphabetical order.
 */
import { angleSchema, protractorSchema } from "./angle";
import { areaModelSchema } from "./area-model";
import { arraySchema } from "./array";
import { baseTenSchema } from "./base-ten";
import { clockSchema } from "./clock";
import { fractionBarSchema } from "./fraction-bar";
import { graphSchema } from "./graph";
import { lineTableSchema } from "./line-table";
import { numberLineSchema } from "./number-line";
import { polyAreaSchema } from "./poly-area";
import { rowBarsSchema } from "./row-bars";
import { tableSchema } from "./table";
import { tenFrameSchema } from "./ten-frame";

export const componentSchemas = [
  angleSchema,
  areaModelSchema,
  arraySchema,
  baseTenSchema,
  clockSchema,
  fractionBarSchema,
  graphSchema,
  lineTableSchema,
  numberLineSchema,
  polyAreaSchema,
  protractorSchema,
  rowBarsSchema,
  tableSchema,
  tenFrameSchema,
] as const;

export * from "./angle";
export * from "./area-model";
export * from "./array";
export * from "./base-ten";
export * from "./clock";
export * from "./fraction-bar";
export * from "./graph";
export * from "./line-table";
export * from "./number-line";
export * from "./poly-area";
export * from "./row-bars";
export * from "./table";
export * from "./ten-frame";
