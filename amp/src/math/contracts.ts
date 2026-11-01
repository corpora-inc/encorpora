import { z } from "zod";
import {
  MAX_SELECTION_OPTIONS,
  normalizeSelection,
  selectionIdPattern,
} from "./selection-response";
import {
  measurementFigureSchemas,
  type MeasurementFigure,
} from "./measurement-models.js";
import {
  areaVolumeFigureSchemas,
  type AreaVolumeFigure,
} from "./area-volume-figures.js";
import { angleFigureSchemas, type AngleFigure } from "./geometry-models.js";
import { decimalFigureSchemas, type DecimalFigure } from "./decimal-models.js";
import {
  timeMoneyFigureSchemas,
  type TimeMoneyFigure,
} from "./time-money-models.js";
import {
  attributeFigureSchemas,
  type AttributeFigure,
} from "./attribute-models.js";
import {
  ratioRateFigureSchemas,
  type RatioRateFigure,
} from "./ratio-rate-models.js";
import {
  partWholeFigureSchemas,
  type PartWholeFigure,
} from "./part-whole-models.js";
import {
  earlyOperationsFigureSchemas,
  type EarlyOperationsFigure,
} from "./early-operations-models.js";
import {
  factArrayFigureSchemas,
  type FactArrayFigure,
} from "./fact-array-models.js";
import {
  dataDisplayFigureSchemas,
  type DataDisplayFigure,
} from "./data-display-models.js";
import { shapeFigureSchemas, type ShapeFigure } from "./shape-figures.js";
import {
  geometryFigureSchemas,
  type GeometryFigure,
} from "./geometry-figures.js";
import { sceneSchema, type Scene } from "./scene/spec.js";
import {
  gradePointPlot,
  normalizePointPlot,
  pointPlotGradingSchema,
  pointPlotResponseSchema,
  type PointPlotGrading,
  type PointPlotResponse,
} from "./point-plot.js";
import {
  multiPartChoiceResponseSchema,
  normalizeMultiPart,
  type MultiPartChoiceResponse,
} from "./multi-part-choice.js";
import {
  figureChoiceResponseSchema,
  normalizeFigureChoice,
  type FigureChoiceResponse,
} from "./figure-choice.js";
import {
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
  structuredWorkResponseSchema,
  workGradingSchema,
  type StructuredWorkResponse,
  type WorkGrading,
} from "./structured-work.js";
import { stepsSchema, type Step } from "./scene/timeline.js";
/** An input/output table, a first-quadrant graph, or both side by side.
 * A graph line is exact: y × run = rise × x + b × run. */
export type FunctionDisplayFigure = {
  kind: "function-display";
  table?: {
    title?: string;
    columns: [string, string];
    rows: { x: number; y: number }[];
  };
  graph?: {
    xLabel: string;
    yLabel: string;
    xMax: number;
    yMax: number;
    xStep: number;
    yStep: number;
    series: {
      label?: string;
      points: { x: number; y: number }[];
      line?: { rise: number; run: number; b: number };
    }[];
  };
};
/** Reference templates demonstrate selected skills; they are not a complete curriculum. */
export type SemanticFigure =
  | MeasurementFigure
  | AreaVolumeFigure
  | RatioRateFigure
  | PartWholeFigure
  | AttributeFigure
  | FactArrayFigure
  | EarlyOperationsFigure
  | TimeMoneyFigure
  | DecimalFigure
  | DataDisplayFigure
  | GeometryFigure
  | FunctionDisplayFigure
  | AngleFigure
  | ShapeFigure
  /** Any figure built with the scene framework (docs/figures.md). */
  | { kind: "scene"; scene: Scene }
  | {
      kind: "unit-array";
      rows: number;
      columns: number;
      splitAfterRow?: number;
    }
  | { kind: "grouped-counters"; total: number; groupSize: number; unit: string }
  | {
      kind: "rational-line";
      denominator: number;
      maxWhole: number;
      points: { numerator: number; label: "P" | "A" | "B" }[];
      unit: string;
    }
  | {
      kind: "fraction-strips";
      parts: number;
      wholes: number;
      rows: { selected: number; label: string }[];
      unit: string;
    }
  | { kind: "ten-frame"; first: number; second: number; capacity: 10 | 20 }
  | { kind: "base-ten"; hundreds: number; tens: number; ones: number }
  | {
      kind: "counter-rows";
      circles: number;
      squares: number;
      spread: "circles" | "squares" | "none";
    }
  | { kind: "base-ten-pair"; values: [number, number] }
  | { kind: "area-model"; columns: number[]; rows: number[] }
  | { kind: "ten-frame-pair"; first: number; second: number }
  | {
      kind: "coordinate-plane";
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
      points: { x: number; y: number; label?: string }[];
      lines?: { m: number; b: number }[];
    }
  | {
      kind: "bar-chart";
      categories: string[];
      values: number[];
      valueLabel: string;
    }
  | { kind: "clock"; hour: number; minute: number }
  | { kind: "number-line"; min: number; max: number; points: number[] }
  | {
      /** One-unit ticks with 0 emphasized; jumps are signed changes drawn from `start`. */
      kind: "signed-line";
      min: number;
      max: number;
      labelEvery: number;
      points: { value: number; label: string }[];
      start?: number;
      jumps?: number[];
    }
  | { kind: "collection"; count: number }
  | { kind: "fraction"; selected: number; parts: number }
  | { kind: "rectangle"; width: number; height: number; unit: "cm" }
  | { kind: "right-triangle"; a: number; b: number; unit: "cm" }
  | { kind: "dataset"; values: number[] }
  | CoordinateGeometryFigure
  | SimilarTrianglesFigure
  | {
      /** Left pan: `groups` identical bags of `blocks` x blocks and `units`
       * one-unit cubes (a single group needs no bag). Right pan: `right` cubes. */
      kind: "balance-scale";
      groups: number;
      blocks: number;
      units: number;
      right: number;
    }
  | {
      /** One-unit ticks from min to max; each line graphs a half-line solution set. */
      kind: "inequality-lines";
      min: number;
      max: number;
      lines: {
        label?: "A" | "B" | "C" | "D";
        boundary: number;
        direction: "left" | "right";
        included: boolean;
      }[];
    };
/** A motion of the plane, stated in the prompt; every center is the origin. */
export type PlaneMotion =
  | { kind: "translate"; dx: number; dy: number }
  | { kind: "reflect"; axis: "x" | "y" }
  | { kind: "rotate"; degrees: 90 | 180 | 270 }
  | { kind: "dilate"; numerator: number; denominator: number };
/** Lattice shapes on a grid with equal unit scales on both axes. A "given"
 * shape is the pre-image; an "image" shape is drawn dashed. */
export interface CoordinateGeometryFigure {
  kind: "coordinate-geometry";
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  shapes: {
    role: "given" | "image";
    closed: boolean;
    vertices: { x: number; y: number; label: string }[];
  }[];
  /** A given of the prompt (never the asked-for motion). */
  motion?: PlaneMotion;
  /** Draw rays from the origin through corresponding vertices. */
  rays?: boolean;
}
/** Two similar triangles drawn to their true shape and relative size. Each
 * side list is [first–second, second–third, third–first] by vertex order;
 * null hides a side and "?" marks the asked-for side. Corresponding angles
 * carry the same number of arcs. */
export interface SimilarTrianglesFigure {
  kind: "similar-triangles";
  unit: "cm" | "m" | "in" | "ft";
  triangles: {
    vertices: [string, string, string];
    sides: [number | "?" | null, number | "?" | null, number | "?" | null];
  }[];
}
/** A client lists the figure families it can draw; a template that needs
 * another family is never sent to it. */
export const figureCapabilities = [
  "measurement-models-v1",
  "data-displays-v1",
  "geometry-figures-v1",
  "function-displays-v1",
  "volume-coordinate-figures-v1",
  "shape-figures-v1",
  "scenes-v1",
  /** Scenes that use the second component set: circle graphs, thermometers,
   * rulers, coins and stepped unit-cube solids (scene/capability.ts). A
   * figure-surface axis value that draws one falls back to its legacy
   * surface for a client without it (variation/axes.ts). */
  "scenes-v2",
] as const;
export type FigureCapability = (typeof figureCapabilities)[number];
/** Answer formats beyond typed numbers. A client lists those it can show;
 * a template that needs another is never sent to it. */
export const responseCapabilities = [
  "single-choice-v1",
  "multi-select-v1",
  "point-plot-v1",
  "multi-part-choice-v1",
  "figure-choice-v1",
  "structured-work-v1",
  "multi-part-cards-v1",
] as const;
export type ResponseCapability = (typeof responseCapabilities)[number];
/** The response and figure families a client declares it can show. */
export interface ClientCapabilities {
  responseCapabilities: readonly string[];
  figureCapabilities: readonly string[];
}
/** The one rule for what a client may be sent: it declares every capability
 * the template needs. Practice, placement openers and offline packs all
 * select from the templates this admits. */
export const clientCanDraw = (
  template: Pick<
    TemplateMetadata,
    "requiredFigureCapability" | "requiredResponseCapability"
  >,
  client: ClientCapabilities,
): boolean =>
  (!template.requiredResponseCapability ||
    client.responseCapabilities.includes(
      template.requiredResponseCapability,
    )) &&
  (!template.requiredFigureCapability ||
    client.figureCapabilities.includes(template.requiredFigureCapability));
export interface TemplateMetadata {
  /** Editorial local step on the curriculum-grade scale, not empirical calibration. */
  difficultyOffset?: number;
  requiredFigureCapability?: FigureCapability;
  /** Absent for the original number/fraction protocol. */
  requiredResponseCapability?: ResponseCapability;
  id: string;
  version: 1;
  title: string;
  skillId: string;
  gradeBand: "K–2" | "3–5" | "6–8" | "9–12";
  description: string;
}
export type MultiSelectResponse = {
  kind: "multi-select";
  label: string;
  options: { id: string; label: string }[];
  selectionCount: number;
};
export type {
  PointPlotResponse,
  PointPlotGrading,
  MultiPartChoiceResponse,
  FigureChoiceResponse,
  StructuredWorkResponse,
  WorkGrading,
};
export type ProblemResponse =
  | { kind: "number" | "fraction"; label: string }
  | { kind: "choice"; label: string; options: { id: string; label: string }[] }
  | MultiSelectResponse
  | PointPlotResponse
  | MultiPartChoiceResponse
  | FigureChoiceResponse
  | StructuredWorkResponse;
/** Safe teaching content delivered beside a problem; never grading data. */
export interface ProblemHint {
  hint: string;
  cue?: Step[];
}
export interface PublicProblem {
  id: string;
  templateId: string;
  templateVersion: 1;
  seed: string;
  prompt: string;
  skillId: string;
  response: ProblemResponse;
  figure?: SemanticFigure;
}
/** Keep this object on the grading side; send only `public` before an attempt. */
export interface GeneratedProblem {
  public: PublicProblem;
  answer: string;
  explanation: string[];
  /** One teaching step for this instance, written by the generator from its
   * own givens: it names the problem's quantities and the first move of the
   * authored method, and never states the answer. Gated by
   * tests/instance-hints.test.ts. Its figure cue (elements of this problem's
   * scene to highlight) travels beside it as `hintCue`. */
  hint: string;
  /** The hint's figure cue: timeline steps over this problem's own scene
   * (`public.figure.scene`), e.g. highlight `area.region.0.0`. Private, served
   * with the hint; it targets elements, never states the answer. */
  hintCue?: Step[];
  /** A worked model of this instance for its lesson: a scene with steps that
   * may show the answer (the factors of a tile rectangle, say). Used only
   * when this instance is a lesson's example; never sent with a problem. */
  walkthrough?: Scene;
  /** Private, selected-distractor feedback; never included before submission. */
  choiceFeedback?: Record<string, string>;
  /** Private grading rule of a point-plot response (point-plot.ts). */
  pointGrading?: PointPlotGrading;
  /** Private grading rule of a structured-work response (structured-work.ts):
   * expected fields, the moves a derivation's reasons name and its
   * solutions, or a proof's justified claims. Never public. */
  workGrading?: WorkGrading;
  /** Private answer-acceptance policy for numeric responses. Absent means exact
   * rational comparison. `sat-spr` also accepts the College Board's truncated
   * or rounded decimal for an answer that does not fit the entry space.
   * Absent on problems saved before the policy existed, which keep exact grading. */
  entryPolicy?: "sat-spr";
  /** Private realized surface: the family's variant label and the value of
   * each variation axis (src/math/variation). Saved with the instance and
   * copied to its attempt evidence so calibration and review can reason per
   * axis. Never in the public problem; it returns with the graded attempt,
   * beside the answer. Absent on older instances. */
  variant?: ProblemVariant;
}
export interface ProblemVariant {
  id: string;
  axes?: Record<string, string>;
}

const displayInteger = z.number().int().min(-100000).max(100000);
const displayPoint = z
  .object({ x: displayInteger, y: displayInteger })
  .strict();
const displayLabel = z.string().trim().min(1).max(24);
export const functionDisplaySchema = z
  .object({
    kind: z.literal("function-display"),
    table: z
      .object({
        title: displayLabel.optional(),
        columns: z.tuple([displayLabel, displayLabel]),
        rows: z.array(displayPoint).min(2).max(6),
      })
      .strict()
      .optional(),
    graph: z
      .object({
        xLabel: displayLabel,
        yLabel: displayLabel,
        xMax: z.number().int().positive(),
        yMax: z.number().int().positive(),
        xStep: z.number().int().positive(),
        yStep: z.number().int().positive(),
        series: z
          .array(
            z
              .object({
                label: z.string().trim().min(1).max(12).optional(),
                points: z.array(displayPoint).max(8),
                line: z
                  .object({
                    rise: displayInteger,
                    run: z.number().int().positive(),
                    b: displayInteger,
                  })
                  .strict()
                  .optional(),
              })
              .strict(),
          )
          .min(1)
          .max(2),
      })
      .strict()
      .refine(
        (g) =>
          g.xMax % g.xStep === 0 &&
          g.yMax % g.yStep === 0 &&
          g.xMax / g.xStep <= 12 &&
          g.yMax / g.yStep <= 12 &&
          g.series.every(
            (s) =>
              (s.points.length > 0 || s.line) &&
              s.points.every(
                (p) =>
                  p.x >= 0 &&
                  p.y >= 0 &&
                  p.x <= g.xMax &&
                  p.y <= g.yMax &&
                  (!s.line ||
                    p.y * s.line.run ===
                      s.line.rise * p.x + s.line.b * s.line.run),
              ),
          ),
        "Graph points must lie on the grid and on their stated line",
      )
      .optional(),
  })
  .strict()
  .refine(
    (f) => f.table || f.graph,
    "A function display needs a table or a graph",
  );
const gridInteger = z.number().int().min(-20).max(20);
const vertexLabel = z.string().regex(/^[A-Z]′?$/);
const coordinateGeometrySchema = z
  .object({
    kind: z.literal("coordinate-geometry"),
    xMin: gridInteger,
    xMax: gridInteger,
    yMin: gridInteger,
    yMax: gridInteger,
    shapes: z
      .array(
        z
          .object({
            role: z.enum(["given", "image"]),
            closed: z.boolean(),
            vertices: z
              .array(
                z
                  .object({
                    x: gridInteger,
                    y: gridInteger,
                    label: vertexLabel,
                  })
                  .strict(),
              )
              .min(1)
              .max(6),
          })
          .strict(),
      )
      .min(1)
      .max(3),
    motion: z
      .discriminatedUnion("kind", [
        z
          .object({
            kind: z.literal("translate"),
            dx: z.number().int().min(-20).max(20),
            dy: z.number().int().min(-20).max(20),
          })
          .strict(),
        z
          .object({ kind: z.literal("reflect"), axis: z.enum(["x", "y"]) })
          .strict(),
        z
          .object({
            kind: z.literal("rotate"),
            degrees: z.union([z.literal(90), z.literal(180), z.literal(270)]),
          })
          .strict(),
        z
          .object({
            kind: z.literal("dilate"),
            numerator: z.number().int().min(1).max(12),
            denominator: z.number().int().min(1).max(12),
          })
          .strict(),
      ])
      .optional(),
    rays: z.boolean().optional(),
  })
  .strict()
  .refine(
    (f) =>
      f.xMax > f.xMin &&
      f.yMax > f.yMin &&
      f.xMax - f.xMin <= 24 &&
      f.yMax - f.yMin <= 24 &&
      f.shapes.every((s) =>
        s.vertices.every(
          (p) =>
            p.x >= f.xMin && p.x <= f.xMax && p.y >= f.yMin && p.y <= f.yMax,
        ),
      ),
    "Every vertex lies inside the grid window",
  );
const triangleSide = z.union([
  z.number().positive().finite().max(1000),
  z.literal("?"),
  z.null(),
]);
const similarTrianglesSchema = z
  .object({
    kind: z.literal("similar-triangles"),
    unit: z.enum(["cm", "m", "in", "ft"]),
    triangles: z
      .array(
        z
          .object({
            vertices: z.tuple([vertexLabel, vertexLabel, vertexLabel]),
            sides: z.tuple([triangleSide, triangleSide, triangleSide]),
          })
          .strict(),
      )
      .length(2),
  })
  .strict()
  .refine((f) => {
    const first = f.triangles[0]!,
      second = f.triangles[1]!;
    const s = first.sides;
    if (!s.every((v) => typeof v === "number")) return false;
    const [a, b, c] = s as number[];
    return (
      a! + b! > c! &&
      b! + c! > a! &&
      c! + a! > b! &&
      second.sides.some((v) => typeof v === "number")
    );
  }, "The first triangle states three valid sides; the second states one");
export const semanticFigureSchema: z.ZodType<SemanticFigure> =
  z.discriminatedUnion("kind", [
    functionDisplaySchema,
    ...measurementFigureSchemas,
    ...areaVolumeFigureSchemas,
    ...angleFigureSchemas,
    ...ratioRateFigureSchemas,
    ...partWholeFigureSchemas,
    ...attributeFigureSchemas,
    ...factArrayFigureSchemas,
    ...earlyOperationsFigureSchemas,
    ...timeMoneyFigureSchemas,
    ...decimalFigureSchemas,
    ...dataDisplayFigureSchemas,
    ...geometryFigureSchemas,
    ...shapeFigureSchemas,
    z.object({ kind: z.literal("scene"), scene: sceneSchema }).strict(),
    z
      .object({
        kind: z.literal("unit-array"),
        rows: z.number().int().min(1).max(10),
        columns: z.number().int().min(1).max(10),
        splitAfterRow: z.number().int().min(1).optional(),
      })
      .strict()
      .refine((f) => f.splitAfterRow === undefined || f.splitAfterRow < f.rows),
    z
      .object({
        kind: z.literal("grouped-counters"),
        total: z.number().int().min(1).max(64),
        groupSize: z.number().int().min(2).max(8),
        unit: z.string().min(1).max(20),
      })
      .strict()
      .refine((f) => Math.ceil(f.total / f.groupSize) <= 8),
    z
      .object({
        kind: z.literal("rational-line"),
        denominator: z.number().int().min(2).max(12),
        maxWhole: z.number().int().min(1).max(3),
        points: z
          .array(
            z
              .object({
                numerator: z.number().int().nonnegative(),
                label: z.enum(["P", "A", "B"]),
              })
              .strict(),
          )
          .min(1)
          .max(2),
        unit: z.string().min(1).max(40),
      })
      .strict()
      .refine(
        (f) =>
          f.points.every((p) => p.numerator <= f.denominator * f.maxWhole) &&
          new Set(f.points.map((p) => p.label)).size === f.points.length &&
          new Set(f.points.map((p) => p.numerator)).size === f.points.length,
      ),
    z
      .object({
        kind: z.literal("fraction-strips"),
        parts: z.number().int().min(2).max(12),
        wholes: z.number().int().min(1).max(3),
        rows: z
          .array(
            z
              .object({
                selected: z.number().int().nonnegative(),
                label: z.string().min(1).max(40),
              })
              .strict(),
          )
          .min(1)
          .max(3),
        unit: z.string().min(1).max(40),
      })
      .strict()
      .refine((f) => f.rows.every((r) => r.selected <= f.parts * f.wholes)),
    z
      .object({
        kind: z.literal("ten-frame"),
        first: z.number().int().min(0).max(20),
        second: z.number().int().min(0).max(20),
        capacity: z.union([z.literal(10), z.literal(20)]),
      })
      .strict()
      .refine(
        (f) => f.first + f.second <= f.capacity,
        "Counters must fit the frames",
      ),
    z
      .object({
        kind: z.literal("base-ten"),
        hundreds: z.number().int().min(0).max(9),
        tens: z.number().int().min(0).max(19),
        ones: z.number().int().min(0).max(19),
      })
      .strict()
      .refine(
        (f) => 100 * f.hundreds + 10 * f.tens + f.ones <= 999,
        "Base-ten total must be at most999",
      ),
    z
      .object({
        kind: z.literal("counter-rows"),
        circles: z.number().int().min(1).max(10),
        squares: z.number().int().min(1).max(10),
        spread: z.enum(["circles", "squares", "none"]),
      })
      .strict()
      .refine(
        (f) => f.spread === "none" || f[f.spread] >= 2,
        "A spread row needs at least two counters",
      ),
    z
      .object({
        kind: z.literal("area-model"),
        columns: z.array(z.number().int().min(1).max(9000)).min(1).max(4),
        rows: z.array(z.number().int().min(1).max(9000)).min(1).max(4),
      })
      .strict(),
    z
      .object({
        kind: z.literal("ten-frame-pair"),
        first: z.number().int().min(1).max(10),
        second: z.number().int().min(1).max(10),
      })
      .strict(),
    z
      .object({
        kind: z.literal("base-ten-pair"),
        values: z.tuple([
          z.number().int().min(10).max(99),
          z.number().int().min(10).max(99),
        ]),
      })
      .strict(),
    z
      .object({
        kind: z.literal("coordinate-plane"),
        xMin: z.number().finite(),
        xMax: z.number().finite(),
        yMin: z.number().finite(),
        yMax: z.number().finite(),
        points: z
          .array(
            z
              .object({
                x: z.number().finite(),
                y: z.number().finite(),
                label: z.string().max(40).optional(),
              })
              .strict(),
          )
          .max(20),
        lines: z
          .array(
            z
              .object({ m: z.number().finite(), b: z.number().finite() })
              .strict(),
          )
          .max(10)
          .optional(),
      })
      .strict()
      .refine(
        (v) =>
          v.xMax > v.xMin &&
          v.yMax > v.yMin &&
          v.points.every(
            (p) =>
              p.x >= v.xMin && p.x <= v.xMax && p.y >= v.yMin && p.y <= v.yMax,
          ),
      ),
    z
      .object({
        kind: z.literal("bar-chart"),
        categories: z.array(z.string().min(1).max(40)).min(1).max(20),
        values: z.array(z.number().nonnegative().finite()).min(1).max(20),
        valueLabel: z.string().max(100),
      })
      .strict()
      .refine((v) => v.categories.length === v.values.length),
    z
      .object({
        kind: z.literal("clock"),
        hour: z.number().int().min(0).max(23),
        minute: z.number().int().min(0).max(59),
      })
      .strict(),
    z
      .object({
        kind: z.literal("number-line"),
        min: z.number().finite(),
        max: z.number().finite(),
        points: z.array(z.number().finite()).min(1).max(20),
      })
      .strict()
      .refine(
        (v) => v.max > v.min && v.points.every((p) => p >= v.min && p <= v.max),
      ),
    z
      .object({
        kind: z.literal("signed-line"),
        min: z.number().int().max(0),
        max: z.number().int().min(0),
        labelEvery: z.number().int().min(1).max(10),
        points: z
          .array(
            z
              .object({
                value: z.number().finite(),
                label: z.string().regex(/^[A-Z]$/),
              })
              .strict(),
          )
          .max(2),
        start: z.number().finite().optional(),
        jumps: z.array(z.number().finite()).min(1).max(4).optional(),
      })
      .strict()
      .refine((v) => {
        const inside = (n: number) =>
          n >= v.min && n <= v.max && Number.isInteger(n * 2);
        if (v.max - v.min < 4 || v.max - v.min > 30) return false;
        if (!v.points.every((p) => inside(p.value))) return false;
        if ((v.start === undefined) !== (v.jumps === undefined)) return false;
        if (v.start === undefined) return v.points.length > 0;
        let at = v.start;
        if (!inside(at)) return false;
        for (const jump of v.jumps!) {
          at += jump;
          if (jump === 0 || !inside(at)) return false;
        }
        return true;
      }),
    z
      .object({
        kind: z.literal("collection"),
        count: z.number().int().min(1).max(20),
      })
      .strict(),
    z
      .object({
        kind: z.literal("fraction"),
        selected: z.number().int().nonnegative(),
        parts: z.number().int().min(1).max(100),
      })
      .strict()
      .refine((v) => v.selected <= v.parts),
    z
      .object({
        kind: z.literal("rectangle"),
        width: z.number().positive().finite(),
        height: z.number().positive().finite(),
        unit: z.literal("cm"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("right-triangle"),
        a: z.number().positive().finite(),
        b: z.number().positive().finite(),
        unit: z.literal("cm"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("dataset"),
        values: z.array(z.number().finite()).min(1).max(100),
      })
      .strict(),
    coordinateGeometrySchema,
    similarTrianglesSchema,
    z
      .object({
        kind: z.literal("balance-scale"),
        groups: z.number().int().min(1).max(3),
        blocks: z.number().int().min(1).max(5),
        units: z.number().int().min(0).max(12),
        right: z.number().int().min(1).max(30),
      })
      .strict()
      .refine(
        (f) =>
          (f.groups === 1 || f.blocks === 1) &&
          f.groups * (f.blocks + f.units) <= 18 &&
          f.right > f.groups * f.units &&
          (f.right - f.groups * f.units) % (f.groups * f.blocks) === 0,
        "A level balance needs a positive whole block weight and drawable counts",
      ),
    z
      .object({
        kind: z.literal("inequality-lines"),
        min: z.number().int().min(-100).max(100),
        max: z.number().int().min(-100).max(110),
        lines: z
          .array(
            z
              .object({
                label: z.enum(["A", "B", "C", "D"]).optional(),
                boundary: z.number().int(),
                direction: z.enum(["left", "right"]),
                included: z.boolean(),
              })
              .strict(),
          )
          .min(1)
          .max(4),
      })
      .strict()
      .refine(
        (f) =>
          f.max - f.min >= 6 &&
          f.max - f.min <= 12 &&
          f.lines.every((l) => l.boundary > f.min && l.boundary < f.max) &&
          (f.lines.length === 1
            ? f.lines[0]!.label === undefined
            : f.lines.every((l, i) => l.label === "ABCD"[i])),
        "Inequality lines need an interior boundary and labels A–D in order",
      ),
  ]);
const choiceIdSchema = z.string().regex(/^option-[a-d]$/);
export const problemResponseSchema: z.ZodType<ProblemResponse> = z.union([
  z
    .object({
      kind: z.enum(["number", "fraction"]),
      label: z.string().trim().min(1).max(200),
    })
    .strict(),
  z
    .object({
      kind: z.literal("choice"),
      label: z.string().trim().min(1).max(200),
      options: z
        .array(
          z
            .object({
              id: choiceIdSchema,
              label: z.string().trim().min(1).max(120),
            })
            .strict(),
        )
        .min(2)
        .max(4),
    })
    .strict()
    .refine(
      (value) =>
        new Set(value.options.map((option) => option.id)).size ===
          value.options.length &&
        new Set(value.options.map((option) => option.label)).size ===
          value.options.length,
      "Choices need unique identifiers and labels",
    ),
  z
    .object({
      kind: z.literal("multi-select"),
      label: z.string().trim().min(1).max(200),
      options: z
        .array(
          z
            .object({
              id: z.string().regex(selectionIdPattern),
              label: z.string().trim().min(1).max(120),
            })
            .strict(),
        )
        .min(3)
        .max(MAX_SELECTION_OPTIONS),
      selectionCount: z
        .number()
        .int()
        .min(2)
        .max(MAX_SELECTION_OPTIONS - 1),
    })
    .strict()
    .refine(
      (value) =>
        value.selectionCount < value.options.length &&
        new Set(value.options.map((option) => option.id)).size ===
          value.options.length &&
        new Set(value.options.map((option) => option.label)).size ===
          value.options.length,
      "Select fewer than all options, using unique identifiers and labels",
    ),
  pointPlotResponseSchema,
  multiPartChoiceResponseSchema,
  figureChoiceResponseSchema,
  structuredWorkResponseSchema,
]);
export const publicProblemSchema: z.ZodType<PublicProblem> = z
  .object({
    id: z.string().regex(/^[a-f0-9]{64}$/),
    templateId: z.string().min(1).max(100),
    templateVersion: z.literal(1),
    seed: z.string().min(1).max(128),
    prompt: z.string().min(1).max(4000),
    skillId: z.string().min(1).max(100),
    response: problemResponseSchema,
    figure: semanticFigureSchema.optional(),
  })
  .strict();
const variantText = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
export const problemVariantSchema: z.ZodType<ProblemVariant> = z
  .object({
    id: variantText,
    axes: z
      .record(z.string().regex(/^[a-z][a-z0-9-]{0,31}$/), variantText)
      .refine((axes) => Object.keys(axes).length <= 6, "At most six axes")
      .optional(),
  })
  .strict();
export const generatedProblemSchema: z.ZodType<GeneratedProblem> = z
  .object({
    public: publicProblemSchema,
    // A worked structured response (every row of the key) may run to 200
    // characters; every other answer stays within 100.
    answer: z.string().min(1).max(200),
    explanation: z.array(z.string().min(1).max(4000)).min(1).max(20),
    hint: z.string().min(1).max(4000),
    hintCue: stepsSchema.optional(),
    walkthrough: sceneSchema.optional(),
    choiceFeedback: z
      .record(choiceIdSchema, z.string().trim().min(1).max(1000))
      .optional(),
    pointGrading: pointPlotGradingSchema.optional(),
    workGrading: workGradingSchema.optional(),
    entryPolicy: z.literal("sat-spr").optional(),
    variant: problemVariantSchema.optional(),
  })
  .strict()
  .refine((problem) => {
    const response = problem.public.response;
    // A worked key is canonical, fits its private rule and earns credit.
    if (response.kind === "structured-work")
      return (
        !problem.choiceFeedback &&
        !problem.entryPolicy &&
        !problem.pointGrading &&
        !!problem.workGrading &&
        gradingFits(response, problem.workGrading) &&
        normalizeStructuredWork(response, problem.answer) === problem.answer &&
        gradeStructuredWork(response, problem.workGrading, problem.answer)
      );
    if (problem.workGrading || problem.answer.length > 100) return false;
    // A plotted answer is canonical, complete, and accepted by its own rule.
    if (response.kind === "point-plot")
      return (
        !problem.choiceFeedback &&
        !problem.entryPolicy &&
        !!problem.pointGrading &&
        (problem.pointGrading.mode === "on-curve") ===
          (response.connect === "curve") &&
        normalizePointPlot(response, problem.answer) === problem.answer &&
        gradePointPlot(
          response,
          problem.pointGrading,
          problem.answer,
          problem.answer,
        )
      );
    if (problem.pointGrading) return false;
    // Every blank's correct option is a displayed option; the key is canonical.
    if (response.kind === "multi-part-choice")
      return (
        !problem.choiceFeedback &&
        !problem.entryPolicy &&
        normalizeMultiPart(response, problem.answer) === problem.answer
      );
    // A figure choice names a displayed option; distractor feedback keys
    // name the other options, like a single choice.
    if (response.kind === "figure-choice")
      return (
        !problem.entryPolicy &&
        normalizeFigureChoice(response, problem.answer) === problem.answer &&
        Object.keys(problem.choiceFeedback ?? {}).every(
          (id) =>
            normalizeFigureChoice(response, id) !== null &&
            id !== problem.answer,
        )
      );
    if (response.kind === "multi-select")
      return (
        !problem.choiceFeedback &&
        normalizeSelection(response, problem.answer) === problem.answer
      );
    if (response.kind !== "choice") return !problem.choiceFeedback;
    const ids = response.options.map((option) => option.id);
    return (
      ids.includes(problem.answer) &&
      Object.keys(problem.choiceFeedback ?? {}).every(
        (id) => ids.includes(id) && id !== problem.answer,
      )
    );
  }, "Choice answers and private feedback must reference displayed options");
