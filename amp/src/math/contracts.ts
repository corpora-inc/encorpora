import { z } from "zod";
import {
  measurementFigureSchemas,
  type MeasurementFigure,
} from "./measurement-models.js";
import {
  dataDisplayFigureSchemas,
  type DataDisplayFigure,
} from "./data-display-models.js";
/** Reference templates demonstrate selected skills; they are not a complete curriculum. */
export type SemanticFigure =
  | MeasurementFigure
  | DataDisplayFigure
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
  | { kind: "collection"; count: number }
  | { kind: "fraction"; selected: number; parts: number }
  | { kind: "rectangle"; width: number; height: number; unit: "cm" }
  | { kind: "right-triangle"; a: number; b: number; unit: "cm" }
  | { kind: "dataset"; values: number[] }
  | CoordinateGeometryFigure
  | SimilarTrianglesFigure;
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
] as const;
export type FigureCapability = (typeof figureCapabilities)[number];
export interface TemplateMetadata {
  requiredFigureCapability?: FigureCapability;
  /** Absent for the original number/fraction protocol. */
  requiredResponseCapability?: "single-choice-v1";
  id: string;
  version: 1;
  title: string;
  skillId: string;
  gradeBand: "K–2" | "3–5" | "6–8" | "9–12";
  description: string;
}
export type ProblemResponse =
  | { kind: "number" | "fraction"; label: string }
  | { kind: "choice"; label: string; options: { id: string; label: string }[] };
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
  hint: string;
  /** Private, selected-distractor feedback; never included before submission. */
  choiceFeedback?: Record<string, string>;
}

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
    ...measurementFigureSchemas,
    ...dataDisplayFigureSchemas,
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
export const generatedProblemSchema: z.ZodType<GeneratedProblem> = z
  .object({
    public: publicProblemSchema,
    answer: z.string().min(1).max(100),
    explanation: z.array(z.string().min(1).max(4000)).min(1).max(20),
    hint: z.string().min(1).max(4000),
    choiceFeedback: z
      .record(choiceIdSchema, z.string().trim().min(1).max(1000))
      .optional(),
  })
  .strict()
  .refine((problem) => {
    const response = problem.public.response;
    if (response.kind !== "choice") return !problem.choiceFeedback;
    const ids = response.options.map((option) => option.id);
    return (
      ids.includes(problem.answer) &&
      Object.keys(problem.choiceFeedback ?? {}).every(
        (id) => ids.includes(id) && id !== problem.answer,
      )
    );
  }, "Choice answers and private feedback must reference displayed options");
