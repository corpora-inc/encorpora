import React from "react";
import type { SemanticFigure } from "../math/contracts.js";

export type EquationFigureData = Extract<
  SemanticFigure,
  { kind: "balance-scale" | "inequality-lines" }
>;
// Role tokens, with their light values as fallbacks for printed pages.
const ink = "var(--color-figure-ink, #174a43)",
  axis = "var(--color-figure-axis, #6f8a7d)",
  paper = "var(--color-figure-paper, #fffdf7)",
  accent = "var(--color-figure-accent, #20776d)",
  accentFill = "var(--color-figure-accent-fill, #d4e9e1)",
  gold = "var(--color-figure-gold, #9a5c12)",
  goldFill = "var(--color-figure-gold-fill, #fae2b9)",
  warm = "var(--color-figure-warm, #9c4420)";
const minus = (n: number) => (n < 0 ? `−${-n}` : String(n));

export function EquationFigure({ figure }: { figure: EquationFigureData }) {
  return figure.kind === "balance-scale" ? (
    <BalanceFigure figure={figure} />
  ) : (
    <InequalityLinesFigure figure={figure} />
  );
}

/** Geometry shared by the problem figure, lesson figures and the animation. */
export const BLOCK = { w: 26, h: 40 } as const;
export const CUBE = { size: 14, pitch: 16 } as const;

export function XBlock({ x, y }: { x: number; y: number }) {
  return (
    <g data-x-block="true">
      <rect
        x={x}
        y={y}
        width={BLOCK.w}
        height={BLOCK.h}
        rx="3"
        fill={goldFill}
        stroke={gold}
        strokeWidth="2"
      />
      <text
        x={x + BLOCK.w / 2}
        y={y + BLOCK.h / 2 + 7}
        textAnchor="middle"
        fill={ink}
        style={{ fontSize: 20, fontStyle: "italic", fontWeight: 700 }}
      >
        x
      </text>
    </g>
  );
}
export function Cube({ x, y }: { x: number; y: number }) {
  return (
    <rect
      data-cube="true"
      x={x}
      y={y}
      width={CUBE.size}
      height={CUBE.size}
      rx="1.5"
      fill={accentFill}
      stroke={accent}
      strokeWidth="1.5"
    />
  );
}
/** The level beam, its two pans (tops at y = 142) and the fulcrum. */
export function BalanceFrame() {
  return (
    <g data-balance-frame="true">
      <path
        d="M200 160 L176 204 H224 Z"
        fill={accentFill}
        stroke={ink}
        strokeWidth="2"
      />
      <line x1="150" x2="250" y1="204" y2="204" stroke={ink} strokeWidth="2" />
      <line x1="60" x2="340" y1="160" y2="160" stroke={ink} strokeWidth="4" />
      <circle cx="200" cy="160" r="4" fill={ink} />
      {[100, 300].map((cx) => (
        <g key={cx}>
          <line
            x1={cx}
            x2={cx}
            y1="150"
            y2="160"
            stroke={ink}
            strokeWidth="3"
          />
          <rect
            x={cx - 86}
            y="142"
            width="172"
            height="8"
            rx="4"
            fill={paper}
            stroke={ink}
            strokeWidth="2"
          />
        </g>
      ))}
    </g>
  );
}
/** Cube positions in a grid whose bottom row rests on `floor`, filled from the bottom. */
export function cubeGrid(
  count: number,
  columns: number,
  left: number,
  floor: number,
) {
  return Array.from({ length: count }, (_, i) => ({
    x: left + (i % columns) * CUBE.pitch,
    y: floor - CUBE.size - Math.floor(i / columns) * CUBE.pitch,
  }));
}
type Balance = Extract<SemanticFigure, { kind: "balance-scale" }>;
/** Exact positions of every object on the left pan. */
export function leftLayout(f: Pick<Balance, "groups" | "blocks" | "units">) {
  const floor = 142;
  if (f.groups === 1) {
    const rows = 4,
      columns = Math.ceil(f.units / rows);
    const width =
      f.blocks * (BLOCK.w + 4) - 4 + (f.units ? 6 + columns * CUBE.pitch : 0);
    const start = 100 - width / 2;
    return {
      bags: [] as { x: number; y: number; w: number; h: number }[],
      blocks: Array.from({ length: f.blocks }, (_, i) => ({
        x: start + i * (BLOCK.w + 4),
        y: floor - BLOCK.h,
      })),
      cubes: cubeGrid(
        f.units,
        Math.max(columns, 1),
        start + f.blocks * (BLOCK.w + 4) + 2,
        floor,
      ).map((c, i) => ({ ...c, group: 0, index: i })),
    };
  }
  const inner = 4 + BLOCK.w + 4 + CUBE.size + 4,
    gap = 4;
  const start = 100 - (f.groups * inner + (f.groups - 1) * gap) / 2;
  const height = Math.max(BLOCK.h, f.units * CUBE.pitch) + 8;
  const bags = Array.from({ length: f.groups }, (_, g) => ({
    x: start + g * (inner + gap),
    y: floor - height - 2,
    w: inner,
    h: height,
  }));
  return {
    bags,
    blocks: bags.map((b) => ({ x: b.x + 4, y: floor - 6 - BLOCK.h })),
    cubes: bags.flatMap((b, g) =>
      cubeGrid(f.units, 1, b.x + 8 + BLOCK.w, floor - 6).map((c, i) => ({
        ...c,
        group: g,
        index: i,
      })),
    ),
  };
}
export const RIGHT_COLUMNS = 10;
export function rightLayout(count: number) {
  const columns = Math.min(RIGHT_COLUMNS, count);
  return cubeGrid(
    count,
    columns,
    300 - (columns * CUBE.pitch - (CUBE.pitch - CUBE.size)) / 2,
    142,
  );
}
export function describeBalance(f: Balance) {
  const cubes = (n: number) => `${n} ${n === 1 ? "cube" : "cubes"}`;
  const left =
    f.groups > 1
      ? `${f.groups} bags, each holding one x block and ${cubes(f.units)}`
      : `${f.blocks} x ${f.blocks === 1 ? "block" : "blocks"}${f.units ? ` and ${cubes(f.units)}` : ""}`;
  return `A level balance. Left pan: ${left}. Right pan: ${cubes(f.right)}. Each cube weighs 1 gram; every x block has the same unknown weight.`;
}

function BalanceFigure({ figure: f }: { figure: Balance }) {
  const left = leftLayout(f);
  return (
    <svg
      data-kind={f.kind}
      className="figure equation-figure"
      viewBox="0 50 400 160"
      role="img"
      aria-label={describeBalance(f)}
    >
      <BalanceFrame />
      <g
        data-pan="left"
        data-groups={f.groups}
        data-blocks={f.blocks}
        data-cubes={f.groups * f.units}
      >
        {left.bags.map((b, i) => (
          <rect
            key={i}
            data-bag={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="8"
            fill="none"
            stroke={warm}
            strokeWidth="2"
            strokeDasharray="5 4"
          />
        ))}
        {left.blocks.map((b, i) => (
          <XBlock key={i} x={b.x} y={b.y} />
        ))}
        {left.cubes.map((c, i) => (
          <Cube key={i} x={c.x} y={c.y} />
        ))}
      </g>
      <g data-pan="right" data-cubes={f.right}>
        {rightLayout(f.right).map((c, i) => (
          <Cube key={i} x={c.x} y={c.y} />
        ))}
      </g>
    </svg>
  );
}

type Lines = Extract<SemanticFigure, { kind: "inequality-lines" }>;
const ROW = 76;
function InequalityLinesFigure({ figure: f }: { figure: Lines }) {
  const labeled = f.lines.length > 1;
  const x0 = labeled ? 46 : 18,
    x1 = 344;
  const px = (n: number) =>
    x0 + 16 + ((n - f.min) / (f.max - f.min)) * (x1 - x0 - 32);
  const wide = Math.max(Math.abs(f.min), Math.abs(f.max)) >= 10;
  const ticks = Array.from({ length: f.max - f.min + 1 }, (_, i) => f.min + i);
  const relation = (l: Lines["lines"][number]) =>
    l.direction === "right" ? (l.included ? "≥" : ">") : l.included ? "≤" : "<";
  const description = f.lines
    .map(
      (l) =>
        `${l.label ? `Number line ${l.label}` : "The number line"}: ${l.included ? "a filled circle" : "an open circle"} at ${minus(l.boundary)} and a thick ray to the ${l.direction}`,
    )
    .join(". ");
  return (
    <svg
      data-kind={f.kind}
      className="figure equation-figure"
      viewBox={`0 0 360 ${f.lines.length * ROW + 4}`}
      role="img"
      aria-label={`One-unit ticks from ${minus(f.min)} to ${minus(f.max)}. ${description}.`}
    >
      {f.lines.map((l, row) => {
        const y = row * ROW + 32;
        const b = px(l.boundary),
          end = l.direction === "right" ? x1 : x0;
        return (
          <g
            key={row}
            data-line={l.label ?? "only"}
            data-boundary={l.boundary}
            data-direction={l.direction}
            data-included={l.included}
            data-relation={relation(l)}
          >
            {l.label && (
              <text
                x="14"
                y={y + 7}
                fill={ink}
                style={{ fontSize: 22, fontWeight: 700 }}
              >
                {l.label}
              </text>
            )}
            <line
              x1={x0}
              x2={x1}
              y1={y}
              y2={y}
              stroke={axis}
              strokeWidth="1.5"
            />
            <path
              d={`M${x0 + 7} ${y - 5} L${x0} ${y} L${x0 + 7} ${y + 5} M${x1 - 7} ${y - 5} L${x1} ${y} L${x1 - 7} ${y + 5}`}
              fill="none"
              stroke={axis}
              strokeWidth="1.5"
            />
            {ticks.map((n) => (
              <g key={n}>
                <line
                  x1={px(n)}
                  x2={px(n)}
                  y1={y - 6}
                  y2={y + 6}
                  stroke={ink}
                  strokeWidth="1.5"
                />
                {(n === l.boundary ||
                  (!wide && Math.abs(n - l.boundary) !== 0) ||
                  (wide && n % 2 === 0 && Math.abs(n - l.boundary) > 1)) && (
                  <text
                    x={px(n)}
                    y={y + 28}
                    textAnchor="middle"
                    fill={ink}
                    style={{
                      fontSize: 16,
                      fontWeight: n === l.boundary ? 700 : 400,
                    }}
                  >
                    {minus(n)}
                  </text>
                )}
              </g>
            ))}
            <line
              data-solution-ray="true"
              x1={b}
              x2={end}
              y1={y}
              y2={y}
              stroke={accent}
              strokeWidth="5"
            />
            <path
              d={
                l.direction === "right"
                  ? `M${x1 - 12} ${y - 9} L${x1 + 1} ${y} L${x1 - 12} ${y + 9} Z`
                  : `M${x0 + 12} ${y - 9} L${x0 - 1} ${y} L${x0 + 12} ${y + 9} Z`
              }
              fill={accent}
            />
            <circle
              cx={b}
              cy={y}
              r="7"
              fill={l.included ? accent : paper}
              stroke={accent}
              strokeWidth="3"
            />
          </g>
        );
      })}
    </svg>
  );
}
