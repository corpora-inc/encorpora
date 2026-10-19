import type {
  AreaVolumeFigure,
  FigureFraction,
  LengthUnit,
} from "../math/area-volume-figures";

/** Pure geometry for area/volume figures: label text, net layouts and the
 * exact 3D fold of a net. Shared by the problem figures and lesson animations. */
export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
const GLYPHS: Record<string, string> = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
};
/** “2½”, “⅔”, “13”; other values fall back to a decimal. */
export function lengthText(value: number | FigureFraction | null): string {
  if (value === null) return "?";
  const [n, d] =
    typeof value === "number" ? decimalFraction(value) : [value.n, value.d];
  const whole = Math.floor(n / d),
    rest = n - whole * d;
  if (!rest) return String(whole);
  const glyph = GLYPHS[`${rest}/${d}`];
  return glyph ? `${whole || ""}${glyph}` : String(Number((n / d).toFixed(3)));
}
function decimalFraction(v: number): [number, number] {
  for (const d of [1, 2, 3, 4])
    if (Math.abs(v * d - Math.round(v * d)) < 1e-9)
      return [Math.round(v * d), d];
  return [v, 1];
}
export const withUnit = (
  value: number | FigureFraction | null,
  unit: LengthUnit,
) => (value === null ? "?" : `${lengthText(value)} ${unit}`);

// ---------------------------------------------------------------- nets
export type NetFace = {
  id: string;
  /** Vertices in flat net coordinates (x right, y down), in the figure unit. */
  points: Vec2[];
  /** Matching faces share a role, so equal areas share a color. */
  role: "pair-a" | "pair-b" | "pair-c" | "base" | "lateral" | "end";
  parent: string | null;
  hinge?: [Vec2, Vec2];
  /** Rotation, in radians, that folds the face up from the flat net. */
  fold?: number;
  /** Width and height, or base and height for a triangle, for its area. */
  dims: [number, number];
  triangle: boolean;
};
const rect = (x: number, y: number, w: number, h: number): Vec2[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
type NetFigure = Extract<
  AreaVolumeFigure,
  {
    kind:
      "rectangular-prism-net" | "triangular-prism-net" | "square-pyramid-net";
  }
>;
export function netFaces(f: NetFigure): NetFace[] {
  const right = Math.PI / 2;
  if (f.kind === "rectangular-prism-net") {
    const { length: l, width: w, height: h } = f;
    return [
      {
        id: "bottom",
        points: rect(h, h, l, w),
        role: "pair-a",
        parent: null,
        dims: [l, w],
        triangle: false,
      },
      {
        id: "back",
        points: rect(h, 0, l, h),
        role: "pair-b",
        parent: "bottom",
        hinge: [
          [h, h],
          [h + l, h],
        ],
        fold: right,
        dims: [l, h],
        triangle: false,
      },
      {
        id: "front",
        points: rect(h, h + w, l, h),
        role: "pair-b",
        parent: "bottom",
        hinge: [
          [h, h + w],
          [h + l, h + w],
        ],
        fold: right,
        dims: [l, h],
        triangle: false,
      },
      {
        id: "top",
        points: rect(h, 2 * h + w, l, w),
        role: "pair-a",
        parent: "front",
        hinge: [
          [h, 2 * h + w],
          [h + l, 2 * h + w],
        ],
        fold: right,
        dims: [l, w],
        triangle: false,
      },
      {
        id: "left",
        points: rect(0, h, h, w),
        role: "pair-c",
        parent: "bottom",
        hinge: [
          [h, h],
          [h, h + w],
        ],
        fold: right,
        dims: [h, w],
        triangle: false,
      },
      {
        id: "right",
        points: rect(h + l, h, h, w),
        role: "pair-c",
        parent: "bottom",
        hinge: [
          [h + l, h],
          [h + l, h + w],
        ],
        fold: right,
        dims: [h, w],
        triangle: false,
      },
    ];
  }
  if (f.kind === "triangular-prism-net") {
    const { base: b, height: t, length: L } = f;
    const [s0, s1] = f.sides;
    const ax = (s0 * s0 - s1 * s1 + b * b) / (2 * b);
    const alpha = Math.atan2(t, ax),
      beta = Math.atan2(t, b - ax);
    const top = t;
    return [
      {
        id: "middle",
        points: rect(s0, top, b, L),
        role: "lateral",
        parent: null,
        dims: [b, L],
        triangle: false,
      },
      {
        id: "left",
        points: rect(0, top, s0, L),
        role: "lateral",
        parent: "middle",
        hinge: [
          [s0, top],
          [s0, top + L],
        ],
        fold: Math.PI - alpha,
        dims: [s0, L],
        triangle: false,
      },
      {
        id: "right",
        points: rect(s0 + b, top, s1, L),
        role: "lateral",
        parent: "middle",
        hinge: [
          [s0 + b, top],
          [s0 + b, top + L],
        ],
        fold: Math.PI - beta,
        dims: [s1, L],
        triangle: false,
      },
      {
        id: "end-top",
        points: [
          [s0, top],
          [s0 + b, top],
          [s0 + ax, top - t],
        ],
        role: "end",
        parent: "middle",
        hinge: [
          [s0, top],
          [s0 + b, top],
        ],
        fold: right,
        dims: [b, t],
        triangle: true,
      },
      {
        id: "end-bottom",
        points: [
          [s0, top + L],
          [s0 + b, top + L],
          [s0 + ax, top + L + t],
        ],
        role: "end",
        parent: "middle",
        hinge: [
          [s0, top + L],
          [s0 + b, top + L],
        ],
        fold: right,
        dims: [b, t],
        triangle: true,
      },
    ];
  }
  const { side: s, slant: t } = f;
  const fold = Math.PI - Math.acos(s / 2 / t);
  return [
    {
      id: "base",
      points: rect(t, t, s, s),
      role: "base",
      parent: null,
      dims: [s, s],
      triangle: false,
    },
    {
      id: "north",
      points: [
        [t, t],
        [t + s, t],
        [t + s / 2, 0],
      ],
      role: "lateral",
      parent: "base",
      hinge: [
        [t, t],
        [t + s, t],
      ],
      fold,
      dims: [s, t],
      triangle: true,
    },
    {
      id: "south",
      points: [
        [t, t + s],
        [t + s, t + s],
        [t + s / 2, 2 * t + s],
      ],
      role: "lateral",
      parent: "base",
      hinge: [
        [t, t + s],
        [t + s, t + s],
      ],
      fold,
      dims: [s, t],
      triangle: true,
    },
    {
      id: "west",
      points: [
        [t, t],
        [t, t + s],
        [0, t + s / 2],
      ],
      role: "lateral",
      parent: "base",
      hinge: [
        [t, t],
        [t, t + s],
      ],
      fold,
      dims: [s, t],
      triangle: true,
    },
    {
      id: "east",
      points: [
        [t + s, t],
        [t + s, t + s],
        [2 * t + s, t + s / 2],
      ],
      role: "lateral",
      parent: "base",
      hinge: [
        [t + s, t],
        [t + s, t + s],
      ],
      fold,
      dims: [s, t],
      triangle: true,
    },
  ];
}
export function netBounds(faces: NetFace[]) {
  const xs = faces.flatMap((f) => f.points.map((p) => p[0])),
    ys = faces.flatMap((f) => f.points.map((p) => p[1]));
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/** Rotate p about the line through a and b (z = 0 plane) by angle. */
function rotateAbout(p: Vec3, a: Vec2, b: Vec2, angle: number): Vec3 {
  const ax = b[0] - a[0],
    ay = b[1] - a[1],
    n = Math.hypot(ax, ay);
  const [kx, ky] = [ax / n, ay / n];
  const v: Vec3 = [p[0] - a[0], p[1] - a[1], p[2]];
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const dot = kx * v[0] + ky * v[1];
  // Rodrigues' rotation with axis k = (kx, ky, 0).
  const cross: Vec3 = [ky * v[2], -kx * v[2], kx * v[1] - ky * v[0]];
  return [
    a[0] + v[0] * c + cross[0] * s + kx * dot * (1 - c),
    a[1] + v[1] * c + cross[1] * s + ky * dot * (1 - c),
    v[2] * c + cross[2] * s,
  ];
}
/** Each face's 3D vertices when the net is folded by `amount` (0 flat, 1 closed).
 * Faces fold toward +z, away from the paper. */
export function foldNet(faces: NetFace[], amount: number): Map<string, Vec3[]> {
  const byId = new Map(faces.map((f) => [f.id, f]));
  const sign = new Map<string, number>();
  const centroid = (pts: Vec2[]): Vec2 => [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
  for (const f of faces)
    if (f.hinge) {
      const c = centroid(f.points);
      sign.set(
        f.id,
        rotateAbout([c[0], c[1], 0], f.hinge[0], f.hinge[1], 0.1)[2] > 0
          ? 1
          : -1,
      );
    }
  const place = (id: string, p: Vec3): Vec3 => {
    const f = byId.get(id)!;
    if (!f.hinge || !f.parent) return p;
    const turned = rotateAbout(
      p,
      f.hinge[0],
      f.hinge[1],
      sign.get(id)! * f.fold! * amount,
    );
    return place(f.parent, turned);
  };
  return new Map(
    faces.map((f) => [f.id, f.points.map(([x, y]) => place(f.id, [x, y, 0]))]),
  );
}
/** A fixed camera: turn about the vertical axis, tilt toward the viewer, then
 * drop depth. tilt 0 looks straight down at the flat net. */
export function project(p: Vec3, center: Vec3, tilt: number, turn: number) {
  const x = p[0] - center[0],
    y = p[1] - center[1],
    z = p[2] - center[2];
  const x1 = x * Math.cos(turn) - y * Math.sin(turn),
    y1 = x * Math.sin(turn) + y * Math.cos(turn);
  // Tilting about the screen's x axis moves height (z) up the screen.
  const y2 = y1 * Math.cos(tilt) - z * Math.sin(tilt),
    depth = y1 * Math.sin(tilt) + z * Math.cos(tilt);
  return { x: x1, y: y2, depth };
}
export const faceArea = (f: NetFace) =>
  f.triangle ? (f.dims[0] * f.dims[1]) / 2 : f.dims[0] * f.dims[1];
