import React from "react";
import type { SemanticFigure } from "../math/contracts.js";

export type SignedLineData = Extract<SemanticFigure, { kind: "signed-line" }>;

// Fallbacks keep printed worksheets legible where the app's tokens are absent.
const ink = "var(--color-figure-ink, #174a43)",
  axis = "var(--color-figure-axis, #6f8a7d)",
  accent = "var(--color-figure-accent, #20776d)",
  warm = "var(--color-figure-warm, #9c4420)",
  paper = "var(--color-figure-paper, #fffdf7)";

/** Typographic minus for displayed numbers. */
export const signedText = (n: number) => (n < 0 ? `−${String(-n)}` : String(n));
const changeText = (n: number) => (n < 0 ? signedText(n) : `+${n}`);

/** A filled arrowhead whose tip is (x, y), pointing along (dx, dy). */
function arrowHead(x: number, y: number, dx: number, dy: number) {
  const length = Math.hypot(dx, dy) || 1,
    ux = dx / length,
    uy = dy / length,
    bx = x - 10 * ux,
    by = y - 10 * uy;
  const f = (n: number) => n.toFixed(2);
  return `M${f(x)} ${f(y)} L${f(bx - 4.5 * uy)} ${f(by + 4.5 * ux)} L${f(bx + 4.5 * uy)} ${f(by - 4.5 * ux)} Z`;
}

/** One-unit ticks, 0 emphasized, labeled points and signed jumps drawn to exact scale. */
export function SignedLineFigure({ figure }: { figure: SignedLineData }) {
  const { min, max, labelEvery, points } = figure;
  const jumps = figure.jumps ?? [];
  const hasJumps = figure.start !== undefined && jumps.length > 0;
  const height = hasJumps ? 156 : 112,
    lineY = hasJumps ? 100 : 66;
  const x = (n: number) => 24 + ((n - min) / (max - min)) * 272;
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const positions = hasJumps
    ? jumps.reduce((all, j) => [...all, all.at(-1)! + j], [figure.start!])
    : [];
  const end = positions.at(-1);
  const description = hasJumps
    ? `Number line from ${signedText(min)} to ${signedText(max)} with one-unit ticks, labeled every ${labelEvery}. Arrows start at ${signedText(figure.start!)} and show the changes ${jumps.map(changeText).join(", then ")}. The end of the last arrow is marked with a question mark.`
    : `Number line from ${signedText(min)} to ${signedText(max)} with one-unit ticks, labeled every ${labelEvery}. ${points.map((p) => `Point ${p.label} is at ${signedText(p.value)}.`).join(" ")}`;
  // Start and end labels sit below the tick labels; separate them when close.
  const startX = hasJumps ? x(figure.start!) : 0,
    endX = end !== undefined ? x(end) : 0,
    gap = Math.abs(startX - endX) < 40 ? 20 - Math.abs(startX - endX) / 2 : 0,
    startShift = startX <= endX ? -gap : gap;
  return (
    <svg
      data-kind={figure.kind}
      className="figure graphical-figure signed-line-figure"
      viewBox={`0 0 320 ${height}`}
      role="img"
      aria-label={description}
    >
      <line
        x1="14"
        y1={lineY}
        x2="306"
        y2={lineY}
        stroke={ink}
        strokeWidth="2"
      />
      <path
        d={`M14 ${lineY} l8 -5 v10 z M306 ${lineY} l-8 -5 v10 z`}
        fill={ink}
      />
      {ticks.map((n) => {
        const zero = n === 0,
          labeled = n % labelEvery === 0;
        return (
          <g key={n}>
            <line
              data-tick={n}
              x1={x(n)}
              y1={lineY - (zero ? 12 : labeled ? 8 : 5)}
              x2={x(n)}
              y2={lineY + (zero ? 12 : labeled ? 8 : 5)}
              stroke={zero ? ink : axis}
              strokeWidth={zero ? 2.5 : 1.25}
            />
            {labeled && (
              <text
                data-tick-label={n}
                x={x(n)}
                y={lineY + 30}
                textAnchor="middle"
                fill={ink}
                style={{ fontSize: 16, fontWeight: zero ? 700 : 400 }}
              >
                {signedText(n)}
              </text>
            )}
          </g>
        );
      })}
      {hasJumps &&
        jumps.map((jump, i) => {
          const from = x(positions[i]!),
            to = x(positions[i + 1]!),
            lift = 24 + i * 22,
            peak = lineY - lift,
            mid = (from + to) / 2,
            control = peak - lift * 0.55,
            color = jump < 0 ? warm : accent;
          return (
            <g key={i} data-jump={jump}>
              <path
                d={`M${from} ${lineY - 4} Q${mid} ${control} ${to} ${lineY - 4}`}
                fill="none"
                stroke={color}
                strokeWidth="2.25"
                strokeDasharray={jump < 0 ? "6 4" : undefined}
              />
              <path
                d={arrowHead(to, lineY - 4, to - mid, lineY - 4 - control)}
                fill={color}
              />
            </g>
          );
        })}
      {hasJumps &&
        jumps.map((jump, i) => {
          // Labels after every arc, so no later arc crosses an earlier label.
          const lift = 24 + i * 22;
          return (
            <text
              key={i}
              x={(x(positions[i]!) + x(positions[i + 1]!)) / 2}
              y={lineY - lift - 2}
              textAnchor="middle"
              fill={jump < 0 ? warm : accent}
              stroke={paper}
              strokeWidth="4"
              paintOrder="stroke"
              style={{ fontSize: 15, fontWeight: 700 }}
            >
              {changeText(jump)}
            </text>
          );
        })}
      {hasJumps && (
        <>
          <circle
            data-start={figure.start}
            cx={startX}
            cy={lineY}
            r="5.5"
            fill={accent}
            stroke={paper}
            strokeWidth="1.5"
          />
          <text
            x={startX + startShift}
            y={lineY + 52}
            textAnchor="middle"
            fill={accent}
            style={{ fontSize: 15, fontWeight: 700 }}
          >
            {signedText(figure.start!)}
          </text>
          <circle
            data-end="?"
            cx={endX}
            cy={lineY}
            r="6"
            fill={paper}
            stroke={warm}
            strokeWidth="2.5"
          />
          <text
            x={endX - startShift}
            y={lineY + 52}
            textAnchor="middle"
            fill={warm}
            style={{ fontSize: 16, fontWeight: 700 }}
          >
            ?
          </text>
        </>
      )}
      {points.map((p) => (
        <g key={p.label} data-point={p.label}>
          <circle
            cx={x(p.value)}
            cy={lineY}
            r="6"
            fill={warm}
            stroke={paper}
            strokeWidth="1.5"
          />
          <text
            x={x(p.value)}
            y={lineY - 18}
            textAnchor="middle"
            fill={warm}
            style={{ fontSize: 18, fontWeight: 700 }}
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
