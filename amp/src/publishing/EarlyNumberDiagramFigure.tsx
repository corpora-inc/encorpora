import React, { useId } from "react";
import type { Diagram } from "./schema.js";
import {
  validateEarlyNumberModel,
  type EarlyNumberModel,
} from "./early-number-models.js";
export type EarlyNumberDiagram = Diagram & EarlyNumberModel;
const ink = "#18594f";
/** The same unit geometry is used in print and screen, including exchange tools. */
export function EarlyNumberDiagramFigure({
  diagram: d,
  screen = false,
}: {
  diagram: EarlyNumberDiagram;
  screen?: boolean;
}) {
  validateEarlyNumberModel(d);
  const pattern = `early-${useId().replace(/[^a-z0-9]/gi, "")}`;
  const defs = (id = pattern) => (
    <defs>
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#f3dca2" />
        <path d="M-1 1L1-1M0 6L6 0M5 7L7 5" stroke={ink} strokeWidth="1.3" />
      </pattern>
    </defs>
  );
  const fill = (marked: boolean, id = pattern) =>
    marked ? `url(#${id})` : "#8abbb0";
  let art: React.ReactNode;
  if (d.kind === "ten-frame") {
    art = (
      <svg
        viewBox={`0 0 320 ${d.frames * 108 + 8}`}
        role="img"
        aria-label={d.alt}
      >
        {defs()}
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
                    <circle
                      data-unit={index}
                      data-emphasized={
                        d.emphasized?.includes(index) || undefined
                      }
                      cx={x + 24}
                      cy={y + 24}
                      r="16"
                      fill={fill(!!d.emphasized?.includes(index))}
                      stroke={ink}
                      strokeWidth={d.emphasized?.includes(index) ? 3 : 1.5}
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
        {defs()}
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
              <rect
                key={unit}
                data-unit="ten-cell"
                x={16 + rod * 24}
                y={16 + unit * 20}
                width="20"
                height="20"
                fill={fill(!!d.emphasizedTens?.includes(rod))}
                stroke={ink}
                strokeWidth="1"
              />
            ))}
          </g>
        ))}
        {Array.from({ length: d.ones }, (_, unit) => (
          <rect
            key={unit}
            data-unit="one-cell"
            x={180 + (unit % 5) * 24}
            y={16 + Math.floor(unit / 5) * 30}
            width="20"
            height="20"
            fill={fill(!!d.emphasizedOnes?.includes(unit))}
            stroke={ink}
            strokeWidth="1"
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
              {defs(`${pattern}-${i}`)}
              <rect
                x="8"
                y="4"
                width="304"
                height="116"
                rx="12"
                fill="#fffefa"
                stroke={ink}
              />
              {panel.cells.map((cell, index) => {
                const x = 40 + cell.column * 48,
                  y = 20 + cell.row * 28,
                  marked = !!panel.emphasized?.includes(index);
                return d.icon === "circle" ? (
                  <circle
                    key={index}
                    data-unit={index}
                    cx={x}
                    cy={y}
                    r="10"
                    fill={fill(marked, `${pattern}-${i}`)}
                    stroke={ink}
                    strokeWidth={marked ? 3 : 1.5}
                  />
                ) : (
                  <rect
                    key={index}
                    data-unit={index}
                    x={x - 10}
                    y={y - 10}
                    width="20"
                    height="20"
                    fill={fill(marked, `${pattern}-${i}`)}
                    stroke={ink}
                    strokeWidth={marked ? 3 : 1.5}
                  />
                );
              })}
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
