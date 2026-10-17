import { useId } from "react";
import type { Diagram } from "../publishing/schema.js";
import { labelLanes } from "../publishing/label-layout.js";
import { validateDiagram } from "../publishing/validate.js";

/** Sparse integer lines and multiple disjoint jumps keep their label lanes separate. */
export function BookIntegerLineDrawing({
  diagram: d,
}: {
  diagram: Extract<Diagram, { kind: "number-line" }>;
}) {
  validateDiagram(d);
  const arrow = `line-arrow-${useId().replace(/[^a-z0-9]/gi, "")}`;
  const min = d.min[0] / d.min[1],
    max = d.max[0] / d.max[1];
  const x = (n: number) => 24 + ((n - min) / (max - min)) * 272;
  const center = (at: number, text: string) => {
    const half = Math.max(10, text.length * 5.5);
    return Math.max(half + 3, Math.min(317 - half, x(at)));
  };
  const marks = [
    ...d.marks.map((m) => ({
      at: m.at[0] / m.at[1],
      text: m.label,
      point: true,
    })),
    ...Array.from(
      { length: Math.floor(max) - Math.ceil(min) + 1 },
      (_, i) => Math.ceil(min) + i,
    )
      .filter(
        (n) =>
          (n === min || n === max || n % (d.integerLabelInterval ?? 1) === 0) &&
          !d.marks.some((m) => m.at[0] / m.at[1] === n),
      )
      .map((at) => ({ at, text: String(at), point: false })),
  ].map((m) => ({ ...m, center: center(m.at, m.text) }));
  const markLanes = labelLanes(marks, 11, 5);
  const jumps = (d.jumps ?? []).map((j) => {
    const from = j.from[0] / j.from[1],
      to = j.to[0] / j.to[1];
    return {
      ...j,
      from,
      to,
      text: j.label,
      center: center((from + to) / 2, j.label),
    };
  });
  const jumpLanes = labelLanes(jumps, 11, 5);
  const axis = 54 + Math.max(0, ...jumpLanes) * 23;
  const height = axis + 48 + Math.max(0, ...markLanes) * 23;
  const ticks = Math.round((max - min) * d.divisionsPerUnit);
  return (
    <>
      <p className="model-unit">{d.wholeLabel}</p>
      <svg viewBox={`0 0 320 ${height}`} aria-hidden="true">
        <defs>
          <marker
            id={arrow}
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8" fill="#18594f" />
          </marker>
        </defs>
        <line
          x1="24"
          x2="296"
          y1={axis}
          y2={axis}
          stroke="#18594f"
          strokeWidth="2"
        />
        {Array.from({ length: ticks + 1 }, (_, i) => (
          <line
            key={i}
            data-line-tick={min + i / d.divisionsPerUnit}
            x1={x(min + i / d.divisionsPerUnit)}
            x2={x(min + i / d.divisionsPerUnit)}
            y1={axis - 5}
            y2={axis + 7}
            stroke="#18594f"
          />
        ))}
        {marks.map((m, i) => (
          <g key={i}>
            {m.point && <circle cx={x(m.at)} cy={axis} r="4" fill="#ac671a" />}
            <text
              data-line-label={m.at}
              x={m.center}
              y={axis + 25 + markLanes[i]! * 23}
              textAnchor="middle"
            >
              {m.text}
            </text>
          </g>
        ))}
        {jumps.map((j, i) => (
          <g key={i}>
            <path
              data-jump-from={j.from}
              data-jump-to={j.to}
              d={`M${x(j.from)},${axis - 9} Q${(x(j.from) + x(j.to)) / 2},${axis - 43 - jumpLanes[i]! * 23} ${x(j.to)},${axis - 9}`}
              fill="none"
              stroke="#18594f"
              strokeWidth="2"
              markerEnd={`url(#${arrow})`}
            />
            <text
              x={j.center}
              y={axis - 34 - jumpLanes[i]! * 23}
              textAnchor="middle"
            >
              {j.label}
            </text>
          </g>
        ))}
      </svg>
    </>
  );
}
