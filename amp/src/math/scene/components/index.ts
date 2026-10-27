/**
 * Every component, one file each. Adding a component: write
 * `components/<name>.ts` (its schema, its type and `registerComponent`), then
 * add one import line and one array entry below, in alphabetical order.
 */
import { angleSchema, protractorSchema } from "./angle";
import { areaModelSchema } from "./area-model";
import { arraySchema } from "./array";
import { barChartSchema } from "./bar-chart";
import { barsSchema } from "./bars";
import { baseTenSchema } from "./base-ten";
import { boxPlotSchema } from "./box-plot";
import { circleDiagramSchema } from "./circle-diagram";
import { circleGraphSchema } from "./circle-graph";
import { clockSchema } from "./clock";
import { coinsSchema } from "./coins";
import { dotPlotSchema } from "./dot-plot";
import { fractionBarSchema } from "./fraction-bar";
import { graphSchema } from "./graph";
import { isoSolidSchema } from "./iso-solid";
import { lineTableSchema } from "./line-table";
import { numberLineSchema } from "./number-line";
import { pictureGraphSchema } from "./picture-graph";
import { polyAreaSchema } from "./poly-area";
import { rowBarsSchema } from "./row-bars";
import { rulerSchema } from "./ruler";
import { shapePuzzleSchema } from "./shape-puzzle";
import { shapesSchema } from "./shapes";
import { solidSchema } from "./solid";
import { shapeSortSchema } from "./shape-sort";
import { tableSchema } from "./table";
import { tenFrameSchema } from "./ten-frame";
import { thermometerSchema } from "./thermometer";
import { treeSchema } from "./tree";
import { triangleSchema } from "./triangle";
import { vennSchema } from "./venn";

export const componentSchemas = [
  angleSchema,
  areaModelSchema,
  arraySchema,
  barChartSchema,
  barsSchema,
  baseTenSchema,
  boxPlotSchema,
  circleDiagramSchema,
  circleGraphSchema,
  clockSchema,
  coinsSchema,
  dotPlotSchema,
  fractionBarSchema,
  graphSchema,
  isoSolidSchema,
  lineTableSchema,
  numberLineSchema,
  pictureGraphSchema,
  polyAreaSchema,
  protractorSchema,
  rowBarsSchema,
  rulerSchema,
  shapePuzzleSchema,
  shapesSchema,
  solidSchema,
  shapeSortSchema,
  tableSchema,
  tenFrameSchema,
  thermometerSchema,
  treeSchema,
  triangleSchema,
  vennSchema,
] as const;

export * from "./angle";
export * from "./area-model";
export * from "./array";
export * from "./bar-chart";
export * from "./bars";
export * from "./base-ten";
export * from "./box-plot";
export * from "./circle-diagram";
export * from "./circle-graph";
export * from "./clock";
export * from "./coins";
export * from "./dot-plot";
export * from "./fraction-bar";
export * from "./graph";
export * from "./iso-solid";
export * from "./line-table";
export * from "./number-line";
export * from "./picture-graph";
export * from "./poly-area";
export * from "./row-bars";
export * from "./ruler";
export * from "./shape-puzzle";
export * from "./shapes";
export * from "./solid";
export * from "./shape-sort";
export * from "./table";
export * from "./ten-frame";
export * from "./thermometer";
export * from "./tree";
export * from "./triangle";
export * from "./venn";
