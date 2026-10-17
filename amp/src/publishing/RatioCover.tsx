import React from "react";
import type { Diagram } from "./schema.js";
/** Reorganize the same equal parts from two quantities into their combined whole. */
export function RatioCover({
  diagram: d,
}: {
  diagram: Extract<Diagram, { kind: "ratio-tape" }>;
}) {
  const [a, b] = d.rows;
  if (!a || !b || d.rows.length !== 2)
    throw new Error("Ratio cover requires two quantities");
  const total = a.parts + b.parts,
    cell = Math.min(80, 540 / total),
    left = 40;
  const part = (i: number, row: number, color: string) => (
    <g key={`${row}-${i}`}>
      <rect
        x={left + i * cell}
        y={row}
        width={cell}
        height={38}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
      />
      <text
        x={left + (i + 0.5) * cell}
        y={row + 25}
        textAnchor="middle"
        fontSize={15}
        fontWeight={700}
        fill="#fff"
      >
        {color === "#c86d32" ? "A" : "B"}
      </text>
    </g>
  );
  return (
    <figure className="ratio-cover">
      <svg
        viewBox="0 0 640 300"
        role="img"
        aria-label={`${d.alt} The same ${a.parts} and ${b.parts} equal parts are reorganized into one whole of ${total} parts.`}
      >
        <rect width={640} height={300} fill="#fbf5ec" rx={8} />
        <text x={40} y={34} fontSize={15} fontWeight={700} fill="#87441d">
          NAME THE PARTS. KEEP THE RELATIONSHIP.
        </text>
        <text x={40} y={66} fontSize={15} fill="#87441d">
          A
        </text>
        {Array.from({ length: a.parts }, (_, i) => part(i, 76, "#c86d32"))}
        <text x={40} y={142} fontSize={15} fill="#176f76">
          B
        </text>
        {Array.from({ length: b.parts }, (_, i) => part(i, 152, "#26818a"))}
        <text x={390} y={104} fontSize={54} fontWeight={700} fill="#55406f">
          {a.parts} : {b.parts}
        </text>
        <text x={390} y={139} fontSize={16} fill="#55406f">
          A compared with B
        </text>
        <text x={40} y={222} fontSize={15} fontWeight={700} fill="#55406f">
          THE WHOLE CONTAINS BOTH QUANTITIES
        </text>
        {Array.from({ length: total }, (_, i) =>
          part(i, 236, i < a.parts ? "#c86d32" : "#26818a"),
        )}
      </svg>
      <figcaption>
        A: {a.label}. B: {b.label}. Equal parts use the same {d.unitLabel}{" "}
        measure. {d.caption}
      </figcaption>
    </figure>
  );
}
