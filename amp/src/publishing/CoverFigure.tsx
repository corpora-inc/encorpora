import React from "react";
import type { Diagram } from "./schema.js";
/** The cover connects three exact representations of the author's same unit fraction amount. */
export function CoverFigure({
  diagram: d,
}: {
  diagram: Extract<Diagram, { kind: "strips" }>;
}) {
  const row = d.rows[0]!,
    parts = row.parts,
    shaded = row.shaded,
    fraction = shaded / parts;
  return (
    <figure className="cover-composition">
      <svg
        viewBox="0 0 640 260"
        role="img"
        aria-label={`${d.alt} The same ${shaded} over ${parts} amount is shown as an area, a length and a position on a number line.`}
      >
        <rect x="0" y="0" width="640" height="260" rx="4" fill="#eef4ef" />
        <text x="28" y="32" className="cover-kicker">
          ONE QUANTITY. THREE WAYS TO SEE IT.
        </text>
        <text x="52" y="105" className="cover-number">
          {shaded}
        </text>
        <line
          x1="40"
          y1="120"
          x2="106"
          y2="120"
          stroke="#16483f"
          strokeWidth="3"
        />
        <text x="52" y="185" className="cover-number">
          {parts}
        </text>
        <text x="28" y="254" className="cover-caption">
          {d.wholeLabel}
        </text>
        <text x="155" y="67" className="cover-caption">
          PARTS · equal shares
        </text>
        {Array.from({ length: parts }, (_, i) => (
          <rect
            key={i}
            x={155 + (i * 180) / parts}
            y={82}
            width={180 / parts}
            height={58}
            fill={i < shaded ? "#b56a1d" : "white"}
            stroke="#16483f"
            strokeWidth="1.5"
          />
        ))}
        <text x="385" y="67" className="cover-caption">
          LENGTH · same unit
        </text>
        {Array.from({ length: parts }, (_, i) => (
          <rect
            key={i}
            x={385 + (i * 220) / parts}
            y={98}
            width={220 / parts}
            height={25}
            fill={i < shaded ? "#bd6e55" : "white"}
            stroke="#16483f"
            strokeWidth="1.5"
          />
        ))}
        <text x="155" y="176" className="cover-caption">
          POSITION · distance from zero
        </text>
        <line
          x1="155"
          x2="605"
          y1="203"
          y2="203"
          stroke="#16483f"
          strokeWidth="2"
        />
        {Array.from({ length: parts + 1 }, (_, i) => (
          <line
            key={i}
            x1={155 + (i * 450) / parts}
            x2={155 + (i * 450) / parts}
            y1={196}
            y2={211}
            stroke="#16483f"
          />
        ))}
        <circle cx={155 + fraction * 450} cy="203" r="7" fill="#16483f" />
        <text x="155" y="235" className="cover-caption" textAnchor="middle">
          0
        </text>
        <text x="605" y="235" className="cover-caption" textAnchor="middle">
          1
        </text>
        {shaded > 0 && shaded < parts && (
          <text
            x={155 + fraction * 450}
            y="235"
            className="cover-caption"
            textAnchor="middle"
          >
            {shaded}/{parts}
          </text>
        )}
      </svg>
      <figcaption>{d.caption}</figcaption>
    </figure>
  );
}
