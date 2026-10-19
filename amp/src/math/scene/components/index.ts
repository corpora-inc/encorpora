/**
 * Every component, one file each. Adding a component: write
 * `components/<name>.ts` (its schema, its type and `registerComponent`), then
 * add one import line and one array entry below, in alphabetical order.
 */
import { angleSchema, protractorSchema } from "./angle";
import { areaModelSchema } from "./area-model";
import { arraySchema } from "./array";
import { baseTenSchema } from "./base-ten";
import { boxPlotSchema } from "./box-plot";
import { clockSchema } from "./clock";
import { dotPlotSchema } from "./dot-plot";
import { fractionBarSchema } from "./fraction-bar";
import { graphSchema } from "./graph";
import { isoSolidSchema } from "./iso-solid";
import { lineTableSchema } from "./line-table";
import { numberLineSchema } from "./number-line";
import { polyAreaSchema } from "./poly-area";
import { rowBarsSchema } from "./row-bars";
import { shapePuzzleSchema } from "./shape-puzzle";
import { shapesSchema } from "./shapes";
import { solidSchema } from "./solid";
import { tableSchema } from "./table";
import { tenFrameSchema } from "./ten-frame";
import { treeSchema } from "./tree";
import { vennSchema } from "./venn";

export const componentSchemas = [
  angleSchema,
  areaModelSchema,
  arraySchema,
  baseTenSchema,
  boxPlotSchema,
  clockSchema,
  dotPlotSchema,
  fractionBarSchema,
  graphSchema,
  isoSolidSchema,
  lineTableSchema,
  numberLineSchema,
  polyAreaSchema,
  protractorSchema,
  rowBarsSchema,
  shapePuzzleSchema,
  shapesSchema,
  solidSchema,
  tableSchema,
  tenFrameSchema,
  treeSchema,
  vennSchema,
] as const;

export * from "./angle";
export * from "./area-model";
export * from "./array";
export * from "./base-ten";
export * from "./box-plot";
export * from "./clock";
export * from "./dot-plot";
export * from "./fraction-bar";
export * from "./graph";
export * from "./iso-solid";
export * from "./line-table";
export * from "./number-line";
export * from "./poly-area";
export * from "./row-bars";
export * from "./shape-puzzle";
export * from "./shapes";
export * from "./solid";
export * from "./table";
export * from "./ten-frame";
export * from "./tree";
export * from "./venn";
