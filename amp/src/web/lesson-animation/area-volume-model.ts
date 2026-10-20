import type { ProblemLessonView } from "../../content/problem-lessons";
import type { AreaVolumeFigure } from "../../math/area-volume-figures";
import { faceArea, netFaces } from "../area-volume-geometry";

type Polygon = Extract<AreaVolumeFigure, { kind: "measured-polygon" }>;
type NetFigure = Extract<
  AreaVolumeFigure,
  {
    kind:
      "rectangular-prism-net" | "triangular-prism-net" | "square-pyramid-net";
  }
>;
type Solid = Extract<AreaVolumeFigure, { kind: "curved-solid" }>;
export type AreaVolumeAnimation =
  | {
      kind: "triangle-double";
      base: number;
      height: number;
      apex: number;
      unit: Polygon["unit"];
    }
  | { kind: "net-fold"; figure: NetFigure }
  | {
      kind: "cylinder-stack";
      radius: number;
      height: number;
      byDiameter: boolean;
      unit: Solid["unit"];
    };

const positive = (n: unknown, max = 60): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0 && n <= max;

/** Only the example's own semantic figure feeds the model; never the answer. */
export function areaVolumeAnimationModel(
  lesson: ProblemLessonView,
): AreaVolumeAnimation | null {
  const f = lesson.example.figure as AreaVolumeFigure | undefined;
  if (!f) return null;
  if (
    lesson.templateId === "triangle-area-base-height" &&
    f.kind === "measured-polygon"
  ) {
    const v = f.vertices;
    // A triangle with its base on the x-axis from 0 to b and its apex above it.
    if (v.length !== 3 || v[0]![0] !== 0 || v[0]![1] !== 0 || v[1]![1] !== 0)
      return null;
    const [base, apex, height] = [v[1]![0], v[2]![0], v[2]![1]];
    if (
      !positive(base) ||
      !positive(height) ||
      !Number.isFinite(apex) ||
      Math.abs(apex) > 40
    )
      return null;
    return { kind: "triangle-double", base, height, apex, unit: f.unit };
  }
  if (
    lesson.templateId === "net-surface-area" &&
    (f.kind === "rectangular-prism-net" ||
      f.kind === "triangular-prism-net" ||
      f.kind === "square-pyramid-net")
  )
    return { kind: "net-fold", figure: f };
  if (
    lesson.templateId === "cylinder-volume" &&
    f.kind === "curved-solid" &&
    f.solid === "cylinder"
  ) {
    const radius = f.radius ?? (f.diameter === null ? null : f.diameter / 2);
    if (
      !positive(radius, 30) ||
      !positive(f.height, 40) ||
      !Number.isInteger(f.height)
    )
      return null;
    return {
      kind: "cylinder-stack",
      radius,
      height: f.height,
      byDiameter: f.radius === null,
      unit: f.unit,
    };
  }
  return null;
}

const num = (v: number) => String(Number(v.toFixed(4)));
/** TeX for a value in halves (radii from odd diameters). */
const tex = (v: number) =>
  Number.isInteger(v) ? String(v) : `\\tfrac{${Math.round(v * 2)}}{2}`;
const texSquare = (v: number) =>
  Number.isInteger(v) ? `${v}^2` : `\\left(${tex(v)}\\right)^2`;
const piCoefficient = (v: number) => {
  // v is a multiple of 1/4 here (radius in halves, squared).
  if (Number.isInteger(v)) return v === 1 ? "\\pi" : `${v}\\pi`;
  const n = Math.round(v * 4);
  const g = n % 2 === 0 ? 2 : 1;
  return `\\tfrac{${n / g}}{${4 / g}}\\pi`;
};

export function areaVolumeFrames(model: AreaVolumeAnimation) {
  if (model.kind === "triangle-double") {
    const { base: b, height: h } = model;
    return [
      {
        title: "Base and height",
        text: `The base is ${num(b)} ${model.unit}. The height, ${num(h)} ${model.unit}, meets the base at a right angle.`,
        math: `$b = ${num(b)},\\ h = ${num(h)}$`,
      },
      {
        title: "Turn a copy halfway around",
        text: "The copy fits against the triangle and fills a parallelogram with the same base and height.",
        math: `$${num(b)} \\times ${num(h)} = ${num(b * h)}$`,
      },
      {
        title: "The triangle is half",
        text: "The two triangles match, so each is half of the parallelogram.",
        math: `$\\tfrac{1}{2} \\times ${num(b)} \\times ${num(h)} = ${num((b * h) / 2)}$`,
      },
    ];
  }
  if (model.kind === "net-fold") {
    const faces = netFaces(model.figure);
    // Matching faces (same role and area) are counted together.
    const groups = new Map<string, { area: number; count: number }>();
    for (const f of faces) {
      const key = `${f.role}:${faceArea(f)}`;
      const g = groups.get(key) ?? { area: faceArea(f), count: 0 };
      g.count++;
      groups.set(key, g);
    }
    const terms = [...groups.values()].map(({ area, count }) =>
      count === 1 ? num(area) : `${count} \\times ${num(area)}`,
    );
    const total = faces.reduce((s, f) => s + faceArea(f), 0);
    return [
      {
        title: "The closed solid",
        text: `Its surface is made of ${faces.length} flat faces.`,
        math: `$${faces.length}$ faces`,
      },
      {
        title: "Unfold it into a net",
        text: "Cutting along edges lays every face flat. Each face keeps its area.",
        math: "surface area = total area of the net",
      },
      {
        title: "Add the face areas",
        text: "Matching faces have equal areas.",
        math: `$${terms.join(" + ")} = ${num(total)}$`,
      },
    ];
  }
  const { radius: r, height: h } = model;
  const base = r * r;
  return [
    {
      title: "The base is a circle",
      text: `${model.byDiameter ? `The radius is half the diameter: ${num(r)}. ` : ""}A layer 1 ${model.unit} tall holds the base area.`,
      math: `$\\pi \\times ${texSquare(r)} = ${piCoefficient(base)}$`,
    },
    {
      title: "Stack the layers",
      text: `The cylinder is ${h} ${h === 1 ? "layer" : "layers"} of that circle, one on another.`,
      math: `$${h}$ ${h === 1 ? "layer" : "layers"} of $${piCoefficient(base)}$`,
    },
    {
      title: "Volume = base area × height",
      text: "Every layer holds the same amount.",
      math: `$${piCoefficient(base)} \\times ${h} = ${piCoefficient(base * h)}$`,
    },
  ];
}
