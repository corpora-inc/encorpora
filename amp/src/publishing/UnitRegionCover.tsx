import React from "react";
import type { Diagram } from "./schema.js";
import {
  regionBoundaryEdges,
  validateUnitRegionModel,
} from "./unit-regions.js";
/** Three exact views of the same known region; no inferred or hidden dimensions. */
export function UnitRegionCover({
  diagram: d,
}: {
  diagram: Extract<Diagram, { kind: "unit-region" }>;
}) {
  validateUnitRegionModel(d);
  const width = Math.max(...d.cells.map((c) => c.column)) + 1,
    height = Math.max(...d.cells.map((c) => c.row)) + 1,
    cell = Math.min(34, 220 / width, 145 / height),
    edges = regionBoundaryEdges(d.cells),
    left = (280 - width * cell) / 2;
  return (
    <figure className="cover-composition region-cover">
      <svg
        viewBox="0 0 640 370"
        role="img"
        aria-label={`Two views of the same region: ${d.cells.length} equal square units cover the inside, and ${edges.length} unit edges form its outside boundary. Each unit edge represents 1 ${d.unit}.`}
      >
        <rect x="0" y="0" width="640" height="370" rx="12" fill="#f1f6f1" />
        <text x="30" y="35" className="cover-kicker">
          ONE PLACE · TWO DIFFERENT JOBS
        </text>
        {[false, true].map((cover, i) => (
          <g key={String(cover)} transform={`translate(${30 + i * 300},70)`}>
            {cover &&
              d.cells.map((p, j) => (
                <rect
                  key={j}
                  x={left + p.column * cell}
                  y={p.row * cell}
                  width={cell}
                  height={cell}
                  fill="#bcd9cb"
                  stroke="#fff"
                  strokeWidth="1.2"
                />
              ))}
            {edges.map((e, j) => (
              <line
                key={j}
                x1={left + e.from.column * cell}
                y1={e.from.row * cell}
                x2={left + e.to.column * cell}
                y2={e.to.row * cell}
                stroke={cover ? "#18594f" : "#b65b35"}
                strokeWidth={cover ? 2 : 4}
                strokeLinecap="square"
              />
            ))}
            <text
              x="140"
              y="185"
              textAnchor="middle"
              style={{
                fontSize: 23,
                fontWeight: 700,
                fill: cover ? "#18594f" : "#994821",
              }}
            >
              {cover ? "COVER THE INSIDE" : "FOLLOW THE BORDER"}
            </text>
            <text
              x="140"
              y="216"
              textAnchor="middle"
              style={{ fontSize: 20, fill: "#18594f" }}
            >
              {cover
                ? `${d.cells.length} square ${d.unit === "unit" ? "units" : d.unit}`
                : `${edges.length} ${d.unit === "unit" ? "units" : d.unit} around`}
            </text>
          </g>
        ))}
        <text x="320" y="335" textAnchor="middle" className="cover-caption">
          Each unit edge represents 1 {d.unit}. The drawings are schematic.
        </text>
      </svg>
      <figcaption>{d.caption}</figcaption>
    </figure>
  );
}
