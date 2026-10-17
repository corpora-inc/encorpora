import React from "react";
import type { Diagram } from "./schema.js";
import {
  regionBoundaryEdges,
  unitRegionLayout,
  validateUnitRegionModel,
  type UnitRegionModel,
} from "./unit-regions.js";

export function UnitRegionFigure({
  diagram: d,
  screen = false,
}: {
  diagram: Diagram & UnitRegionModel;
  screen?: boolean;
}) {
  validateUnitRegionModel(d);
  const { cell, left, top, height, labels } = unitRegionLayout(d);
  const x = (column: number) => left + column * cell,
    y = (row: number) => top + row * cell;
  return (
    <figure
      data-region-frame={
        d.scaleFrame ? JSON.stringify(d.scaleFrame) : undefined
      }
      data-region-unit={d.unit}
      className={`${screen ? "book-screen-figure" : "book-figure"} unit-region-figure`}
    >
      <div className="unit-region-art">
        <svg viewBox={`0 0 320 ${height}`} role="img" aria-label={d.alt}>
          {d.cells.map((p) => (
            <rect
              key={`${p.column},${p.row}`}
              data-region-cell={`${p.column},${p.row}`}
              x={x(p.column)}
              y={y(p.row)}
              width={cell}
              height={cell}
              fill="#deeee8"
              stroke={d.showGrid ? "#9abdb0" : "none"}
              strokeWidth="0.8"
            />
          ))}
          {regionBoundaryEdges(d.cells).map((e, i) => (
            <line
              key={i}
              data-region-boundary={`${e.from.column},${e.from.row}:${e.to.column},${e.to.row}`}
              x1={x(e.from.column)}
              y1={y(e.from.row)}
              x2={x(e.to.column)}
              y2={y(e.to.row)}
              stroke="#18594f"
              strokeWidth="3"
              strokeLinecap="square"
            />
          ))}
          {(d.partitions ?? []).map((e, i) => (
            <line
              key={i}
              data-region-partition={i}
              x1={x(e.from.column)}
              y1={y(e.from.row)}
              x2={x(e.to.column)}
              y2={y(e.to.row)}
              stroke="#b65b35"
              strokeWidth="2.5"
              strokeDasharray="5 4"
            />
          ))}
          {labels.map((label, i) => (
            <text
              key={i}
              data-region-length={label.length}
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              style={{
                fontFamily: "Arial, sans-serif",
                fontSize: 20,
                fontWeight: 600,
              }}
              fill="#18594f"
            >
              {label.length}
            </text>
          ))}
        </svg>
      </div>
      <div className="unit-region-notes">
        <p className="unit-region-key">
          {d.showGrid
            ? `Each grid step represents 1 ${d.unit}.`
            : `Lengths are measured in ${d.unit === "unit" ? "units" : d.unit}.`}{" "}
          Drawings are not life-size.
        </p>
        <figcaption>{d.caption}</figcaption>
      </div>
    </figure>
  );
}
