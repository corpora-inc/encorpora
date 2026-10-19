import type { GeometryFigure as Model } from "../math/geometry-models";
import {
  FONT,
  f,
  parallelLayout,
  rayLayout,
  solidLayout,
  triangleLayout,
  type Label,
} from "./geometry-layout";

/** Role tokens with print fallbacks: printed pages carry no theme variables. */
export const geometryInk = {
  ink: "var(--color-figure-ink, #174a43)",
  given: "var(--color-figure-accent, #20776d)",
  givenFill: "var(--color-figure-accent-fill, #d4e9e1)",
  unknown: "var(--color-figure-warm, #9c4420)",
  plane: "var(--color-figure-gold, #9a5c12)",
  planeFill: "var(--color-figure-gold-fill, #fae2b9)",
  paper: "var(--color-figure-paper, #fffdf7)",
};
const { ink, given, unknown, plane, planeFill } = geometryInk;

export function Text({
  label,
  color = ink,
  weight = 600,
}: {
  label: Label;
  color?: string;
  weight?: number;
}) {
  const size = label.size ?? FONT;
  return (
    <text
      x={f(label.x)}
      y={f(label.y + size * 0.35)}
      textAnchor="middle"
      style={{
        font: `${weight} ${size}px Arial, sans-serif`,
        fill: color,
        // A paper halo keeps labels legible where they cross a line or plane.
        stroke: geometryInk.paper,
        strokeWidth: 4,
        strokeLinejoin: "round",
        paintOrder: "stroke",
      }}
    >
      {label.text}
    </text>
  );
}
const say = (label: string) => (label === "?" ? "unknown" : label);
const positions = [
  "above the line, right of the transversal",
  "above the line, left of the transversal",
  "below the line, left of the transversal",
  "below the line, right of the transversal",
];

/** Exact angle and solid figures: every angle is drawn at its true measure. */
export function GeometryFigure({ figure }: { figure: Model }) {
  if (figure.kind === "angle-rays") {
    const L = rayLayout(figure);
    const name = (i: number) => figure.points[i]!;
    const description = `Rays from point ${figure.vertex} toward ${figure.points.join(", ")}. ${figure.marks
      .map((m) =>
        m.right
          ? `∠${name(m.from)}${figure.vertex}${name(m.to)} is marked as a right angle.`
          : `∠${name(m.from)}${figure.vertex}${name(m.to)} is marked ${say(m.label)}.`,
      )
      .join(" ")}`;
    return (
      <svg
        className="figure geometry-figure"
        data-kind={figure.kind}
        viewBox={L.viewBox}
        role="img"
        aria-label={description}
      >
        {L.marks.map((m, i) => (
          <path
            key={`m${i}`}
            d={m.path}
            fill="none"
            stroke={m.unknown ? unknown : given}
            strokeWidth={m.right ? 2 : 2.5}
          />
        ))}
        {L.rays.map((r, i) => (
          <line
            key={i}
            x1={0}
            y1={0}
            x2={f(r.end.x)}
            y2={f(r.end.y)}
            stroke={ink}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ))}
        <circle r={3.5} fill={ink} />
        {L.rays.map((r, i) => (
          <Text key={`p${i}`} label={r.label} />
        ))}
        <Text label={L.vertex} />
        {L.marks.map((m, i) =>
          m.label ? (
            <Text
              key={`l${i}`}
              label={m.label}
              color={m.unknown ? unknown : given}
              weight={700}
            />
          ) : null,
        )}
      </svg>
    );
  }
  if (figure.kind === "triangle-angles") {
    const L = triangleLayout(figure);
    const [A, B, C] = figure.vertices;
    const parts = figure.labels.map((label, i) =>
      label ? `∠${figure.vertices[i]} is marked ${say(label)}` : null,
    );
    const description = `Triangle ${A}${B}${C}.${figure.exterior ? ` Side ${A}${B} is extended past ${B} to ${figure.exterior.point}; the exterior angle ∠${C}${B}${figure.exterior.point} is marked ${say(figure.exterior.label ?? "")}.` : ""} ${parts.filter(Boolean).join(". ")}.`;
    return (
      <svg
        className="figure geometry-figure"
        data-kind={figure.kind}
        viewBox={L.viewBox}
        role="img"
        aria-label={description}
      >
        <polygon
          points={L.points.map((p) => `${f(p.x)},${f(p.y)}`).join(" ")}
          fill={geometryInk.givenFill}
          fillOpacity={0.45}
          stroke="none"
        />
        {L.exterior && (
          <line
            x1={f(L.points[1]!.x)}
            y1={f(L.points[1]!.y)}
            x2={f(L.exterior.end.x)}
            y2={f(L.exterior.end.y)}
            stroke={ink}
            strokeWidth={2.5}
            strokeDasharray="7 5"
          />
        )}
        {L.corners.map((c, i) =>
          c.label ? (
            <path
              key={i}
              d={c.path}
              fill="none"
              stroke={c.unknown ? unknown : given}
              strokeWidth={2.5}
            />
          ) : null,
        )}
        {L.exterior?.label && (
          <path
            d={L.exterior.path}
            fill="none"
            stroke={L.exterior.unknown ? unknown : given}
            strokeWidth={2.5}
          />
        )}
        <polygon
          points={L.points.map((p) => `${f(p.x)},${f(p.y)}`).join(" ")}
          fill="none"
          stroke={ink}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {L.names.map((n, i) => (
          <Text key={i} label={n} />
        ))}
        {L.exterior && <Text label={L.exterior.name} />}
        {L.corners.map((c, i) =>
          c.label ? (
            <Text
              key={`l${i}`}
              label={c.label}
              color={c.unknown ? unknown : given}
              weight={700}
            />
          ) : null,
        )}
        {L.exterior?.label && (
          <Text
            label={L.exterior.label}
            color={L.exterior.unknown ? unknown : given}
            weight={700}
          />
        )}
      </svg>
    );
  }
  if (figure.kind === "parallel-transversal") {
    const L = parallelLayout(figure);
    const [m, n, t] = figure.lines;
    const description = `Parallel lines ${m} (above) and ${n} (below), crossed by line ${t}. ${figure.marks
      .map(
        (k) =>
          `At line ${k.crossing ? n : m}, the angle ${positions[k.position]} is marked ${say(k.label)}.`,
      )
      .join(" ")}`;
    return (
      <svg
        className="figure geometry-figure"
        data-kind={figure.kind}
        viewBox={L.viewBox}
        role="img"
        aria-label={description}
      >
        {L.marks.map((k, i) => (
          <path
            key={`m${i}`}
            d={k.path}
            fill="none"
            stroke={k.unknown ? unknown : given}
            strokeWidth={2.5}
          />
        ))}
        {L.lines.map((l, i) => (
          <line
            key={i}
            x1={f(l.a.x)}
            y1={f(l.a.y)}
            x2={f(l.b.x)}
            y2={f(l.b.y)}
            stroke={ink}
            strokeWidth={2.5}
          />
        ))}
        {L.arrows.map((a, i) => (
          <path
            key={`a${i}`}
            d={`M${f(a.x - 6)} ${f(a.y - 6)} l6 6 l-6 6 M${f(a.x + 2)} ${f(a.y - 6)} l6 6 l-6 6`}
            fill="none"
            stroke={ink}
            strokeWidth={2}
          />
        ))}
        <line
          x1={f(L.transversal[0]!.x)}
          y1={f(L.transversal[0]!.y)}
          x2={f(L.transversal[1]!.x)}
          y2={f(L.transversal[1]!.y)}
          stroke={ink}
          strokeWidth={2.5}
        />
        {L.names.map((name, i) => (
          <Text key={`n${i}`} label={name} weight={700} />
        ))}
        {L.marks.map((k, i) => (
          <Text
            key={`l${i}`}
            label={k.label}
            color={k.unknown ? unknown : given}
            weight={700}
          />
        ))}
      </svg>
    );
  }
  const L = solidLayout(figure);
  const solidName =
    figure.solid === "prism"
      ? "A right rectangular prism"
      : "A right rectangular pyramid";
  const dims = figure.unit
    ? ` ${figure.length} ${figure.unit} long, ${figure.width} ${figure.unit} wide and ${figure.height} ${figure.unit} tall`
    : "";
  const description = `${solidName}${dims}, with a slicing plane ${planeWords[figure.plane]}. Hidden edges are dashed.`;
  const poly = (ps: { x: number; y: number }[]) =>
    ps.map((p) => `${f(p.x)},${f(p.y)}`).join(" ");
  return (
    <svg
      className="figure geometry-figure"
      data-kind={figure.kind}
      viewBox={L.viewBox}
      role="img"
      aria-label={description}
    >
      {L.edges
        .filter((e) => e.hidden)
        .map((e, i) => (
          <line
            key={`h${i}`}
            x1={f(e.a.x)}
            y1={f(e.a.y)}
            x2={f(e.b.x)}
            y2={f(e.b.y)}
            stroke={ink}
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
        ))}
      <polygon
        points={poly(L.patch)}
        fill={planeFill}
        fillOpacity={0.6}
        stroke={plane}
        strokeWidth={2}
      />
      {L.height && (
        <line
          x1={f(L.height.a.x)}
          y1={f(L.height.a.y)}
          x2={f(L.height.b.x)}
          y2={f(L.height.b.y)}
          stroke={ink}
          strokeWidth={1.25}
          strokeDasharray="2 4"
        />
      )}
      {L.edges
        .filter((e) => !e.hidden)
        .map((e, i) => (
          <line
            key={`v${i}`}
            x1={f(e.a.x)}
            y1={f(e.a.y)}
            x2={f(e.b.x)}
            y2={f(e.b.y)}
            stroke={ink}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        ))}
      {L.labels.map((l, i) => (
        <Text key={i} label={l} />
      ))}
    </svg>
  );
}

export const planeWords: Record<
  Extract<Model, { kind: "solid-section" }>["plane"],
  string
> = {
  "parallel-base": "parallel to the base",
  "perpendicular-front":
    "perpendicular to the base and parallel to the front face",
  "perpendicular-side":
    "perpendicular to the base and parallel to the side face",
  "perpendicular-diagonal":
    "perpendicular to the base through two diagonally opposite vertical edges",
  corner: "through the three vertices next to one corner",
  "through-apex":
    "perpendicular to the base through the apex, parallel to the front edge",
  "off-apex":
    "perpendicular to the base, parallel to the front edge, in front of the apex",
};
