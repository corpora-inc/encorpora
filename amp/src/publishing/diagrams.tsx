import React from "react";
import { labelLanes } from "./label-layout.js";
import { ArrayDrawing } from "./ArrayDrawing.js";
import type { Diagram } from "./schema.js";
import {
  rational,
  validateDiagram,
  exactGroupCount,
  completeGroup,
} from "./validate.js";
const ink = "#16483f",
  teal = "#348879",
  amber = "#b56a1d";
const fmt = (q: [number, number]) =>
  q[1] === 1 ? String(q[0]) : `${q[0]}/${q[1]}`;
function ModelCell({
  x,
  y,
  width,
  height,
  selected = false,
  overlap = false,
  fill = "#fff",
  attributes = {},
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  selected?: boolean;
  overlap?: boolean;
  fill?: string;
  attributes?: Record<string, number | boolean>;
}) {
  return (
    <g>
      <rect
        {...attributes}
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke={ink}
        strokeWidth={0.8}
      />
      {selected &&
        Array.from({ length: Math.ceil((width + height) / 8) }, (_, i) => {
          const c = (i + 1) * 8;
          if (c >= width + height) return null;
          return (
            <line
              key={i}
              x1={x + Math.max(0, c - height)}
              y1={y + Math.min(height, c)}
              x2={x + Math.min(width, c)}
              y2={y + Math.max(0, c - width)}
              stroke={teal}
              strokeWidth={0.7}
            />
          );
        })}
      {overlap &&
        Array.from(
          { length: Math.floor(width / 8) * Math.floor(height / 8) },
          (_, i) => (
            <circle
              key={i}
              cx={x + 4 + (i % Math.floor(width / 8)) * 8}
              cy={y + 4 + Math.floor(i / Math.floor(width / 8)) * 8}
              r={1.1}
              fill={ink}
            />
          ),
        )}
    </g>
  );
}
export function BookDiagram({ diagram: d }: { diagram: Diagram }) {
  validateDiagram(d);
  const width = 600,
    left = 50,
    right = 550;
  let height = 180,
    drawing: React.ReactNode;
  switch (d.kind) {
    case "array": {
      height = 90 + d.rows * Math.min(38, 420 / d.columns, 240 / d.rows);
      drawing = <ArrayDrawing diagram={d} />;
      break;
    }
    case "strips": {
      height = 40 + d.rows.length * 72;
      const wholes = Math.max(...d.rows.map((r) => r.wholes ?? 1)),
        unit = 420 / wholes;
      drawing = (
        <>
          <text x={20} y={18} className="diagram-label">
            {d.wholeLabel} · each outlined whole is 1
          </text>
          {d.rows.map((row, i) => (
            <g key={i}>
              <text x={130} y={43 + i * 72} className="diagram-label">
                {row.label}
              </text>
              {Array.from({ length: row.parts * (row.wholes ?? 1) }, (_, j) => (
                <ModelCell
                  key={j}
                  attributes={{ "data-part": j, "data-shaded": j < row.shaded }}
                  selected={j < row.shaded}
                  x={130 + (j * unit) / row.parts}
                  y={51 + i * 72}
                  width={unit / row.parts}
                  height={32}
                  fill={j < row.shaded ? "#d9eee6" : "#fff"}
                />
              ))}
              {Array.from({ length: row.wholes ?? 1 }, (_, j) => (
                <rect
                  key={j}
                  x={130 + j * unit}
                  y={51 + i * 72}
                  width={unit}
                  height={32}
                  fill="none"
                  stroke={ink}
                  strokeWidth={2}
                />
              ))}
            </g>
          ))}
        </>
      );
      break;
    }
    case "number-line": {
      const min = rational(d.min),
        max = rational(d.max),
        x = (v: number) => left + ((v - min) / (max - min)) * (right - left);
      const jumpLanes = labelLanes(
        (d.jumps ?? []).map((j) => ({
          center: (x(rational(j.from)) + x(rational(j.to))) / 2,
          text: j.label,
        })),
        10,
      );
      const axisY = d.jumps?.length ? 90 + Math.max(0, ...jumpLanes) * 22 : 55;
      const ticks = Array.from(
        { length: Math.round((max - min) * d.divisionsPerUnit) + 1 },
        (_, i) => min + i / d.divisionsPerUnit,
      );
      const labels = [
        ...d.marks.map((mark) => ({
          at: rational(mark.at),
          label: mark.label,
        })),
        ...ticks
          .filter(
            (v) =>
              Number.isInteger(v) &&
              (v % (d.integerLabelInterval ?? 1) === 0 ||
                v === min ||
                v === max) &&
              !d.marks.some(
                (mark) => BigInt(mark.at[0]) === BigInt(v) * BigInt(mark.at[1]),
              ),
          )
          .map((v) => ({ at: v, label: String(v) })),
      ].sort((a, b) => a.at - b.at);
      // Conservative font-width allocation; stagger only labels whose horizontal spans meet.
      const ends: number[] = [];
      const placed = labels.map((label) => {
        const center = x(label.at),
          half = label.label.length * 4.4 + 6;
        let lane = ends.findIndex((end) => end < center - half);
        if (lane < 0) lane = ends.length;
        ends[lane] = center + half;
        return { ...label, center, lane };
      });
      height = axisY + 45 + Math.max(0, ends.length - 1) * 20;
      drawing = (
        <>
          <text x={left} y={20} className="diagram-label">
            {d.wholeLabel}
          </text>
          <line
            x1={left}
            x2={right}
            y1={axisY}
            y2={axisY}
            stroke={ink}
            strokeWidth={2}
          />
          {ticks.map((v, i) => (
            <line
              key={i}
              data-tick={v}
              x1={x(v)}
              x2={x(v)}
              y1={axisY - 6}
              y2={axisY + 8}
              stroke={ink}
            />
          ))}
          {d.marks.map((mark, i) => (
            <circle
              key={i}
              data-rational={fmt(mark.at)}
              cx={x(rational(mark.at))}
              cy={axisY}
              r={5}
              fill={amber}
            />
          ))}
          {placed.map((label, i) => (
            <text
              key={i}
              data-number-label={label.label}
              x={label.center}
              y={axisY + 29 + label.lane * 20}
              textAnchor="middle"
            >
              {label.label}
            </text>
          ))}
          {d.jumps?.map((j, i) => {
            const a = x(rational(j.from)),
              b = x(rational(j.to)),
              y = 48 + jumpLanes[i]! * 22;
            return (
              <g key={i}>
                <path
                  d={`M${a},${axisY - 9} Q${(a + b) / 2},${y - 18} ${b},${axisY - 9}`}
                  fill="none"
                  stroke={teal}
                  strokeWidth={2}
                  markerEnd={`url(#${d.id}-arrow)`}
                />
                <text
                  x={(a + b) / 2}
                  y={y}
                  textAnchor="middle"
                  className="diagram-label"
                >
                  {j.label}
                </text>
              </g>
            );
          })}
        </>
      );
      break;
    }
    case "area": {
      height = 220;
      const x = 175,
        y = 36,
        w = 250,
        h = 150;
      drawing = (
        <>
          <text x={left} y={20} className="diagram-label">
            {d.wholeLabel} · entire rectangle = 1
          </text>
          {Array.from({ length: d.columns * d.rows }, (_, i) => {
            const col = i % d.columns,
              row = Math.floor(i / d.columns),
              a = col < d.shadedColumns,
              b = row < d.shadedRows;
            return (
              <ModelCell
                key={i}
                attributes={{ "data-overlap": a && b }}
                selected={a}
                overlap={a && b}
                x={x + (col * w) / d.columns}
                y={y + (row * h) / d.rows}
                width={w / d.columns}
                height={h / d.rows}
                fill={b ? "#fae2b9" : a ? "#d9eee6" : "white"}
              />
            );
          })}
          <text x={60} y={210} className="diagram-label">
            Hatching: columns · gold: rows · dots: both
          </text>
        </>
      );
      break;
    }
    case "groups": {
      const total = rational(d.total),
        size = rational(d.groupSize),
        scale = 480 / total,
        count = exactGroupCount(d.total, d.groupSize);
      height = 185;
      drawing = (
        <>
          <text x={left} y={20} className="diagram-label">
            {d.wholeLabel} · group size {fmt(d.groupSize)}
          </text>
          {Array.from(
            {
              length: Number(
                (BigInt(d.total[0]) * BigInt(d.unitDivisions)) /
                  BigInt(d.total[1]),
              ),
            },
            (_, i) => {
              const start = i / d.unitDivisions,
                end = Math.min(total, (i + 1) / d.unitDivisions);
              return (
                <ModelCell
                  key={i}
                  selected
                  x={left + start * scale}
                  y={55}
                  width={(end - start) * scale}
                  height={38}
                  fill="#d9eee6"
                />
              );
            },
          )}
          {Array.from({ length: count }, (_, i) => {
            const a = i * size,
              b = Math.min(total, (i + 1) * size),
              x = left + a * scale,
              w = (b - a) * scale;
            return (
              <g
                key={i}
                data-group={i}
                data-complete={completeGroup(d.total, d.groupSize, i)}
              >
                <path
                  d={`M${x + 2},106 v9 h${w - 4} v-9`}
                  fill="none"
                  stroke={amber}
                  strokeWidth={2}
                />
                <text
                  x={x + w / 2}
                  y={138}
                  textAnchor="middle"
                  className="diagram-label"
                >
                  {d.unitDivisions === 1
                    ? completeGroup(d.total, d.groupSize, i)
                      ? String(i + 1)
                      : `${Math.round(total - i * size)} left`
                    : !completeGroup(d.total, d.groupSize, i)
                      ? "partial"
                      : `group ${i + 1}`}
                </text>
              </g>
            );
          })}
          <text x={left} y={169} className="diagram-label">
            Total amount: {fmt(d.total)} ·{" "}
            {d.unitDivisions === 1
              ? "each cell is one whole unit"
              : `each small division is 1/${d.unitDivisions}`}
          </text>
        </>
      );
      break;
    }
    case "double-line": {
      height = 210;
      const min = rational(d.pairs[0]!.top),
        max = rational(d.pairs.at(-1)!.top),
        x = (v: number) => left + ((v - min) / (max - min)) * 500;
      drawing = (
        <>
          <text x={left} y={18} className="diagram-label">
            {d.topLabel}
          </text>
          <text x={left} y={198} className="diagram-label">
            {d.bottomLabel}
          </text>
          {[65, 140].map((y) => (
            <line
              key={y}
              x1={left}
              x2={right}
              y1={y}
              y2={y}
              stroke={ink}
              strokeWidth={2}
            />
          ))}
          {d.pairs.map((pair, i) => (
            <g key={i}>
              <line
                x1={x(rational(pair.top))}
                x2={x(rational(pair.top))}
                y1={70}
                y2={135}
                stroke="#9baea5"
                strokeDasharray="3 4"
              />
              {(
                [
                  ["top", 65, 47],
                  ["bottom", 140, 169],
                ] as const
              ).map(([k, y, ty]) => (
                <g key={k}>
                  <line
                    x1={x(rational(pair.top))}
                    x2={x(rational(pair.top))}
                    y1={y - 6}
                    y2={y + 6}
                    stroke={ink}
                  />
                  <text x={x(rational(pair.top))} y={ty} textAnchor="middle">
                    {fmt(pair[k])}
                  </text>
                </g>
              ))}
            </g>
          ))}
        </>
      );
      break;
    }
  }
  return (
    <figure className={`book-figure figure-${d.kind}`}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={d.alt}>
        <defs>
          <marker
            id={`${d.id}-arrow`}
            markerWidth={6}
            markerHeight={6}
            refX={5}
            refY={3}
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6" fill={teal} />
          </marker>
        </defs>
        {drawing}
      </svg>
      <figcaption>{d.caption}</figcaption>
    </figure>
  );
}
