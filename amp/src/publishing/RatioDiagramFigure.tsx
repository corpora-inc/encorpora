import React from "react";
import type { Diagram } from "./schema.js";
import {
  ratioLabel,
  ratioTapeLayout,
  validateRatioModel,
  type RatioModel,
} from "./ratio-models.js";
const singularUnits: Record<string, string> = {
  cups: "cup",
  liters: "liter",
  beads: "bead",
  milliliters: "milliliter",
};
const unitFor = (value: [number, number], unit: string) =>
  value[0] === value[1] ? (singularUnits[unit] ?? unit) : unit;
const colors = ["#b85b21", "#176f76", "#705094"];
/** Exact equal parts; all text uses wrapping HTML rather than clipped SVG labels. */
export function RatioDiagramFigure({
  diagram: d,
  screen = false,
}: {
  diagram: Diagram & RatioModel;
  screen?: boolean;
}) {
  validateRatioModel(d);
  const figureClass = `${screen ? "book-screen-figure" : "book-figure"} ratio-model-figure`;
  if (d.kind === "percent-grid") {
    const shaded = new Set(d.shadedCells);
    return (
      <figure className={`${figureClass} percent-grid-figure`}>
        <div className="ratio-model-art">
          <p className="ratio-whole-label">Whole: {d.wholeLabel}</p>
          <svg viewBox="0 0 320 240" role="img" aria-label={d.alt}>
            {Array.from({ length: 100 }, (_, i) => {
              const x = 50 + (i % 10) * 22,
                y = 10 + Math.floor(i / 10) * 22;
              return (
                <g key={i}>
                  <rect
                    data-percent-cell={i}
                    data-shaded={shaded.has(i)}
                    x={x}
                    y={y}
                    width={22}
                    height={22}
                    fill={shaded.has(i) ? "#e3d7ef" : "#fff"}
                    stroke="#705094"
                    strokeWidth={0.8}
                  />
                  {shaded.has(i) && (
                    <line
                      x1={x + 4}
                      y1={y + 18}
                      x2={x + 18}
                      y2={y + 4}
                      stroke="#705094"
                      strokeWidth={1.4}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="ratio-model-notes">
          <p className="ratio-model-key">
            100 equal squares make this whole. A marked square is selected.
          </p>
          <figcaption>{d.caption}</figcaption>
        </div>
      </figure>
    );
  }
  const layout = ratioTapeLayout(d);
  return (
    <figure
      className={`${figureClass} ratio-tape-figure`}
      data-ratio-frame={d.frameParts}
      data-ratio-unit={d.unitLabel}
      data-ratio-part-value={
        d.partValue ? JSON.stringify(d.partValue) : undefined
      }
    >
      <div className="ratio-model-art" role="group" aria-label={d.alt}>
        {d.rows.map((row, i) => (
          <div className="ratio-tape-row" key={row.label}>
            <p className="ratio-row-label">
              <span>{row.label}</span>
              {row.total && (
                <strong>
                  {ratioLabel(row.total)} {unitFor(row.total, d.unitLabel)}
                </strong>
              )}
            </p>
            <svg
              viewBox="0 0 320 44"
              role="img"
              aria-label={`${row.label}: ${row.parts} equal parts${row.total ? `, total ${ratioLabel(row.total)} ${d.unitLabel}` : "; amount not given"}.`}
            >
              {Array.from({ length: row.parts }, (_, j) => (
                <g key={j}>
                  <rect
                    data-ratio-cell={`${i}:${j}`}
                    x={layout.left + j * layout.cellWidth}
                    y={6}
                    width={layout.cellWidth}
                    height={32}
                    fill={["#f6dfc6", "#d3e9eb", "#e3d7ef"][i]}
                    stroke={colors[i]}
                    strokeWidth={1.5}
                  />
                  {i === 1 && (
                    <line
                      x1={layout.left + j * layout.cellWidth + 4}
                      y1={31}
                      x2={layout.left + (j + 1) * layout.cellWidth - 4}
                      y2={13}
                      stroke={colors[i]}
                      strokeWidth={1}
                    />
                  )}
                  {i === 2 && (
                    <circle
                      cx={layout.left + (j + 0.5) * layout.cellWidth}
                      cy={22}
                      r={2.5}
                      fill={colors[i]}
                    />
                  )}
                </g>
              ))}
            </svg>
          </div>
        ))}
      </div>
      <div className="ratio-model-notes">
        <p className="ratio-model-key">
          {d.partValue
            ? `Each part represents ${ratioLabel(d.partValue)} ${unitFor(d.partValue, d.unitLabel)}.`
            : `Equal parts represent equal amounts in ${d.unitLabel}.`}
        </p>
        <figcaption>{d.caption}</figcaption>
      </div>
    </figure>
  );
}
