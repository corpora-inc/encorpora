import React from "react";
import type { Diagram } from "./schema.js";
import { ArrayDrawing } from "./ArrayDrawing.js";
import { validateDiagram } from "./validate.js";
/** Opening composition derives every quantity from the authored array. */
export function ArrayCover({
  diagram: d,
}: {
  diagram: Extract<Diagram, { kind: "array" }>;
}) {
  validateDiagram(d);
  const height = 170 + d.rows * Math.min(38, 420 / d.columns, 240 / d.rows);
  return (
    <figure className="cover-composition">
      <svg viewBox={`0 0 600 ${height}`} role="img" aria-label={d.alt}>
        <rect width={600} height={height} fill="#eef4ef" rx={4} />
        <text x={28} y={30} fontSize={18} fill="#16483f">
          EQUAL GROUPS. FLEXIBLE THINKING.
        </text>
        <g transform="translate(0 35)">
          <ArrayDrawing diagram={d} />
        </g>
        <text
          x={300}
          y={height - 25}
          textAnchor="middle"
          fontSize={26}
          fill="#16483f"
        >
          {d.rows} × {d.columns} = {d.rows * d.columns}
        </text>
      </svg>
      <figcaption>{d.caption}</figcaption>
    </figure>
  );
}
