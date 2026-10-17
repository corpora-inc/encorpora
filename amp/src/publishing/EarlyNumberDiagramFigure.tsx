import React from "react";
import type { Diagram } from "./schema.js";
import {
  validateEarlyNumberModel,
  type EarlyNumberModel,
} from "./early-number-models.js";
export type EarlyNumberDiagram = Diagram & EarlyNumberModel;
const ink = "#18594f";
/** Finite strokes avoid PDF expansion of repeated SVG pattern resources. */
function Unit({
  x,
  y,
  size,
  circle = false,
  marked = false,
  unit,
}: {
  x: number;
  y: number;
  size: number;
  circle?: boolean;
  marked?: boolean;
  unit: string | number;
}) {
  const lines: React.ReactNode[] = [];
  if (marked) {
    if (circle) {
      const radius = size / 2;
      // Intersect x+y=s with x²+y²=r² in coordinates centered on the unit.
      for (let s = -size; s <= size; s += 6) {
        const discriminant = 2 * radius * radius - s * s;
        if (discriminant <= 0) continue;
        const root = Math.sqrt(discriminant);
        const a = (s - root) / 2,
          b = (s + root) / 2;
        lines.push(
          <path
            key={s}
            d={`M${x + radius + a},${y + radius + b} L${x + radius + b},${y + radius + a}`}
          />,
        );
      }
    } else {
      // Clip the diagonal (s+t,size-t) to the square, retaining actual endpoints.
      for (let s = -size + 6; s < size; s += 6) {
        const lo = Math.max(0, -s),
          hi = Math.min(size, size - s);
        if (hi <= lo) continue;
        lines.push(
          <path
            key={s}
            d={`M${x + s + lo},${y + size - lo} L${x + s + hi},${y + size - hi}`}
          />,
        );
      }
    }
  }
  const style = {
    fill: marked ? "#f3dca2" : "#8abbb0",
    stroke: ink,
    strokeWidth: circle ? (marked ? 3 : 1.5) : 1,
  };
  return (
    <g>
      {circle ? (
        <circle
          data-unit={unit}
          data-emphasized={marked || undefined}
          cx={x + size / 2}
          cy={y + size / 2}
          r={size / 2}
          {...style}
        />
      ) : (
        <rect
          data-unit={unit}
          data-emphasized={marked || undefined}
          x={x}
          y={y}
          width={size}
          height={size}
          {...style}
        />
      )}
      {marked && (
        <g data-hatching="true" fill="none" stroke={ink} strokeWidth="1.3">
          {lines}
        </g>
      )}
    </g>
  );
}
/** The same unit geometry is used in print and screen, including exchange tools. */
export function EarlyNumberDiagramFigure({
  diagram: d,
  screen = false,
}: {
  diagram: EarlyNumberDiagram;
  screen?: boolean;
}) {
  validateEarlyNumberModel(d);
  let art: React.ReactNode;
  if (d.kind === "ten-frame") {
    art = (
      <svg
        viewBox={`0 0 320 ${d.frames * 108 + 8}`}
        role="img"
        aria-label={d.alt}
      >
        {Array.from({ length: d.frames }, (_, frame) => (
          <g key={frame} data-frame={frame}>
            {Array.from({ length: 10 }, (_, i) => {
              const index = frame * 10 + i,
                x = 40 + (i % 5) * 48,
                y = 8 + frame * 108 + Math.floor(i / 5) * 48;
              return (
                <g key={index}>
                  <rect
                    x={x}
                    y={y}
                    width="48"
                    height="48"
                    fill="#fffefa"
                    stroke={ink}
                    strokeWidth="1.5"
                  />
                  {d.occupied.includes(index) && (
                    <Unit
                      unit={index}
                      x={x + 8}
                      y={y + 8}
                      size={32}
                      circle
                      marked={d.emphasized?.includes(index)}
                    />
                  )}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    );
  } else if (d.kind === "base-ten") {
    art = (
      <svg viewBox="0 0 320 236" role="img" aria-label={d.alt}>
        <rect
          x="8"
          y="4"
          width="304"
          height="228"
          rx="10"
          fill="#fffefa"
          stroke={ink}
        />
        {Array.from({ length: d.tens }, (_, rod) => (
          <g key={rod} data-ten={rod}>
            {Array.from({ length: 10 }, (_, unit) => (
              <Unit
                key={unit}
                unit="ten-cell"
                x={16 + rod * 24}
                y={16 + unit * 20}
                size={20}
                marked={d.emphasizedTens?.includes(rod)}
              />
            ))}
          </g>
        ))}
        {Array.from({ length: d.ones }, (_, unit) => (
          <Unit
            key={unit}
            unit="one-cell"
            x={180 + (unit % 5) * 24}
            y={16 + Math.floor(unit / 5) * 30}
            size={20}
            marked={d.emphasizedOnes?.includes(unit)}
          />
        ))}
      </svg>
    );
  } else {
    art = (
      <div className="early-collection-panels" role="group" aria-label={d.alt}>
        {d.panels.map((panel, i) => (
          <div key={i} className="early-collection-panel">
            <p className="early-panel-label">{panel.label}</p>
            <svg viewBox="0 0 320 124" role="img" aria-label={panel.label}>
              <rect
                x="8"
                y="4"
                width="304"
                height="116"
                rx="12"
                fill="#fffefa"
                stroke={ink}
              />
              {panel.cells.map((cell, index) => (
                <Unit
                  key={index}
                  unit={index}
                  x={30 + cell.column * 48}
                  y={10 + cell.row * 28}
                  size={20}
                  circle={d.icon === "circle"}
                  marked={panel.emphasized?.includes(index)}
                />
              ))}
            </svg>
            {panel.emphasisLabel && (
              <p className="early-emphasis">▨ {panel.emphasisLabel}</p>
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <figure
      className={`${screen ? "book-screen-figure" : "book-figure"} early-number-figure early-${d.kind}`}
    >
      <div className="early-number-art">{art}</div>
      <div className="early-number-notes">
        <p className="early-unit">{d.unitLabel}</p>
        {d.kind !== "count-collection" && d.emphasisLabel && (
          <p className="early-emphasis">▨ {d.emphasisLabel}</p>
        )}
        <figcaption>{d.caption}</figcaption>
      </div>
    </figure>
  );
}
