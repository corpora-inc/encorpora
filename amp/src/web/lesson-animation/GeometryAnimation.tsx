import type { CSSProperties } from "react";
import { Text, geometryInk } from "../AngleTriangleFigure";
import {
  arcPath,
  dir,
  f,
  parallelLayout,
  solidLayout,
  triangleLayout,
  type Point,
} from "../geometry-layout";
import type { GeometryAnimationModel } from "./geometry";

const { ink, given, unknown, plane, planeFill, givenFill } = geometryInk;
const gold = plane;

/** A filled wedge with its arc: the piece of angle that moves. */
function wedge(c: Point, r: number, d1: number, s: number) {
  const a = { x: c.x + dir(d1).x * r, y: c.y + dir(d1).y * r };
  return `M${f(c.x)} ${f(c.y)} L${f(a.x)} ${f(a.y)} ${arcPath(c, r, d1, s).replace(/^M[^A]*/, "")} Z`;
}
const move = (transform: string, origin?: Point): CSSProperties => ({
  transform,
  transformOrigin: origin ? `${f(origin.x)}px ${f(origin.y)}px` : undefined,
  transformBox: "view-box",
});
const heading = (p: Point, q: Point) =>
  (Math.atan2(-(q.y - p.y), q.x - p.x) * 180) / Math.PI;

/** Exact motion: translations and half turns that carry angles onto equal angles. */
export function GeometryModel({
  model,
  step,
}: {
  model: GeometryAnimationModel;
  step: number;
}) {
  if (model.kind === "triangle-sum" || model.kind === "exterior-angle") {
    const exterior = model.kind === "exterior-angle";
    const L = triangleLayout(model.figure);
    const [A, B, C] = L.points as [Point, Point, Point];
    const r = 34;
    const corner = (i: number) => L.corners[i]!;
    const mid = (p: Point, q: Point) => ({
      x: (p.x + q.x) / 2,
      y: (p.y + q.y) / 2,
    });
    // Sum: B slides to C, A half-turns about the midpoint of AC.
    // Exterior: A slides to B, C half-turns about the midpoint of BC.
    const slide = exterior ? 0 : 1,
      turn = exterior ? 2 : 0;
    const target = exterior ? B : C;
    const from = corner(slide).at;
    const pivot = mid(corner(turn).at, target);
    const moved = step >= 1;
    const D = L.exterior?.end;
    const lineY = C.y;
    return (
      <svg x="8" y="6" width="304" height="188" viewBox={L.viewBox}>
        <polygon
          points={L.points.map((p) => `${f(p.x)},${f(p.y)}`).join(" ")}
          fill={givenFill}
          fillOpacity={0.4}
          stroke={ink}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {D && (
          <line
            x1={f(B.x)}
            y1={f(B.y)}
            x2={f(D.x)}
            y2={f(D.y)}
            stroke={ink}
            strokeWidth={2.5}
            strokeDasharray="7 5"
          />
        )}
        {exterior && L.exterior && (
          <path
            d={arcPath(B, r + 14, 0, L.exterior.s)}
            fill="none"
            stroke={gold}
            strokeWidth={3}
          />
        )}
        {!exterior && (
          <g className="animation-fade" style={{ opacity: step === 2 ? 1 : 0 }}>
            <line
              x1={f(Math.min(A.x, C.x) - 60)}
              x2={f(Math.max(B.x, C.x) + 60)}
              y1={f(lineY)}
              y2={f(lineY)}
              stroke={gold}
              strokeWidth={2}
              strokeDasharray="6 5"
            />
          </g>
        )}
        {[0, 1, 2].map((i) => {
          const k = corner(i);
          const still = i !== slide && i !== turn;
          if (exterior && i === 1) return null;
          const color = i === 0 ? given : i === 1 ? unknown : gold;
          const transform =
            i === slide && moved
              ? `translate(${f(target.x - from.x)}px, ${f(target.y - from.y)}px) rotate(0deg)`
              : i === turn && moved
                ? "translate(0px, 0px) rotate(180deg)"
                : "translate(0px, 0px) rotate(0deg)";
          return (
            <g key={i}>
              {!still && (
                <path
                  d={wedge(k.at, r, k.d1, k.s)}
                  fill={color}
                  fillOpacity={0.12}
                  stroke={color}
                  strokeDasharray="3 3"
                />
              )}
              <g
                className="animation-move"
                data-corner={i}
                style={move(transform, i === turn ? pivot : undefined)}
              >
                <path
                  d={wedge(k.at, r, k.d1, k.s)}
                  fill={color}
                  fillOpacity={0.55}
                  stroke={color}
                  strokeWidth={2}
                />
              </g>
            </g>
          );
        })}
        {L.names.map((n, i) => (
          <Text key={`n${i}`} label={n} />
        ))}
        {L.exterior && <Text label={L.exterior.name} />}
        {L.corners.map((k, i) =>
          k.label ? (
            <Text
              key={`l${i}`}
              label={k.label}
              color={k.unknown ? unknown : ink}
              weight={700}
            />
          ) : null,
        )}
        {L.exterior?.label && (
          <Text
            label={L.exterior.label}
            color={L.exterior.unknown ? unknown : ink}
            weight={700}
          />
        )}
      </svg>
    );
  }
  if (model.kind === "transversal") {
    const L = parallelLayout(model.figure);
    const [g, u] = L.marks as [(typeof L.marks)[0], (typeof L.marks)[0]];
    const from = L.cross[g.crossing]!,
      to = L.cross[u.crossing]!;
    // Slide to the other crossing, then a half turn if the angles are opposite.
    const shift = `translate(${f(to.x - from.x)}px, ${f(to.y - from.y)}px)`;
    const opposite = Math.abs(g.position - u.position) === 2;
    const same = g.crossing === u.crossing;
    const transform =
      step === 0 || (same && !opposite)
        ? "translate(0px, 0px) rotate(0deg)"
        : same
          ? "translate(0px, 0px) rotate(180deg)"
          : step === 1 || !opposite
            ? `${shift} rotate(0deg)`
            : `${shift} rotate(180deg)`;
    return (
      <svg x="8" y="6" width="304" height="188" viewBox={L.viewBox}>
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
        <line
          x1={f(L.transversal[0]!.x)}
          y1={f(L.transversal[0]!.y)}
          x2={f(L.transversal[1]!.x)}
          y2={f(L.transversal[1]!.y)}
          stroke={ink}
          strokeWidth={2.5}
        />
        <path
          d={wedge(to, 30, u.d1, u.s)}
          fill={unknown}
          fillOpacity={step === 2 ? 0.5 : 0.18}
          stroke={unknown}
          strokeWidth={2}
          className="animation-fade"
        />
        <path
          d={wedge(from, 30, g.d1, g.s)}
          fill={given}
          fillOpacity={0.15}
          stroke={given}
          strokeDasharray="3 3"
        />
        <g className="animation-move" style={move(transform, from)}>
          <path
            d={wedge(from, 30, g.d1, g.s)}
            fill={given}
            fillOpacity={0.55}
            stroke={given}
            strokeWidth={2}
          />
        </g>
        {L.names.map((n, i) => (
          <Text key={`n${i}`} label={n} weight={700} />
        ))}
        {L.marks.map((k, i) => (
          <Text
            key={`l${i}`}
            label={k.label}
            color={k.unknown ? unknown : ink}
            weight={700}
          />
        ))}
      </svg>
    );
  }
  const L = solidLayout(model.figure, 200);
  const poly = (ps: Point[]) => ps.map((p) => `${f(p.x)},${f(p.y)}`).join(" ");
  // The plane enters from beyond the solid along its own normal direction.
  const entry =
    model.figure.plane === "parallel-base"
      ? { x: 0, y: -120 }
      : { x: 150, y: 0 };
  return (
    <svg x="8" y="6" width="304" height="188" viewBox={L.viewBox}>
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
      <g
        className="animation-move"
        style={{
          ...move(
            step === 0
              ? `translate(${entry.x}px, ${entry.y}px)`
              : "translate(0px, 0px)",
          ),
          opacity: step === 0 ? 0 : 1,
          transition:
            "transform 700ms cubic-bezier(0.22, 0.7, 0.18, 1), opacity 400ms ease",
        }}
      >
        <polygon
          points={poly(L.patch)}
          fill={planeFill}
          fillOpacity={0.45}
          stroke={gold}
          strokeWidth={1.5}
        />
      </g>
      <polygon
        className="animation-fade"
        points={poly(L.section)}
        fill={gold}
        fillOpacity={0.55}
        stroke={gold}
        strokeWidth={3}
        strokeLinejoin="round"
        style={{ opacity: step === 2 ? 1 : 0 }}
      />
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
