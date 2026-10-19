import React from "react";
import {
  BalanceFrame,
  CUBE,
  Cube,
  XBlock,
  cubeGrid,
  leftLayout,
  rightLayout,
} from "../web/EquationFigure";

export type EquationIllustrationKind =
  | "balance-remove"
  | "balance-split"
  | "balance-bags"
  | "undo-chain"
  | "equation-tape"
  | "two-step-tape"
  | "inequality-many-solutions";

const ink = "var(--color-figure-ink, #174a43)",
  axis = "var(--color-figure-axis, #6f8a7d)",
  paper = "var(--color-figure-paper, #fffdf7)",
  accent = "var(--color-figure-accent, #20776d)",
  accentFill = "var(--color-figure-accent-fill, #d4e9e1)",
  gold = "var(--color-figure-gold, #9a5c12)",
  goldFill = "var(--color-figure-gold-fill, #fae2b9)",
  warm = "var(--color-figure-warm, #9c4420)";
const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const svgStyle = {
  width: "100%",
  maxWidth: 420,
  display: "block",
  margin: "0 auto",
} as const;
const captionStyle = { marginTop: 12, lineHeight: 1.6 };
const panels = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: "12px",
} as const;
const label = { fontSize: 24, fontWeight: 700 } as const;

/** Fixed teaching models with exact counts; data attributes let a reviewer recount them. */
export function EquationIllustration({
  kind,
}: {
  kind: EquationIllustrationKind;
}) {
  if (kind === "balance-remove") return <BalanceRemove />;
  if (kind === "balance-split") return <BalanceSplit />;
  if (kind === "balance-bags") return <BalanceBags />;
  if (kind === "undo-chain") return <UndoChain />;
  if (kind === "equation-tape") return <EquationTape />;
  if (kind === "two-step-tape") return <TwoStepTape />;
  return <ManySolutions />;
}

/** One balance state. `removed` cubes on each pan are drawn as dashed outlines. */
function MiniBalance({
  equation,
  groups = 1,
  blocks,
  units,
  right,
  removed = 0,
  rightGroups = 1,
  description,
}: {
  equation: string;
  groups?: number;
  blocks: number;
  units: number;
  right: number;
  removed?: number;
  rightGroups?: number;
  description: string;
}) {
  const left = leftLayout({ groups, blocks, units });
  // Right cubes either fill one grid or stand in equal groups of two columns.
  const per = right / rightGroups;
  const rightCubes =
    rightGroups === 1
      ? rightLayout(right)
      : Array.from({ length: rightGroups }, (_, g) => {
          const width = 2 * CUBE.pitch,
            gap = 12,
            span = rightGroups * width + (rightGroups - 1) * gap;
          return cubeGrid(per, 2, 300 - span / 2 + g * (width + gap), 142);
        }).flat();
  const ghost = (i: number, count: number) => i >= count - removed;
  return (
    <svg
      viewBox="0 20 400 190"
      role="img"
      aria-label={description}
      data-equation={equation}
      data-left-groups={groups}
      data-left-blocks={groups * blocks}
      data-left-cubes={groups * units}
      data-right-cubes={right}
      data-removed={removed}
      style={svgStyle}
    >
      <title>{equation}</title>
      <text x="200" y="48" textAnchor="middle" fill={ink} style={label}>
        {equation}
      </text>
      <BalanceFrame />
      {left.bags.map((b, i) => (
        <rect
          key={i}
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
      {left.cubes.map((c, i) =>
        ghost(i, left.cubes.length) ? (
          <Ghost key={i} x={c.x} y={c.y} />
        ) : (
          <Cube key={i} x={c.x} y={c.y} />
        ),
      )}
      {rightCubes.map((c, i) =>
        ghost(i, rightCubes.length) ? (
          <Ghost key={i} x={c.x} y={c.y} />
        ) : (
          <Cube key={i} x={c.x} y={c.y} />
        ),
      )}
      {rightGroups > 1 &&
        Array.from({ length: rightGroups - 1 }, (_, g) => {
          const width = 2 * CUBE.pitch,
            gap = 12,
            span = rightGroups * width + (rightGroups - 1) * gap;
          const x = 300 - span / 2 + (g + 1) * (width + gap) - gap / 2 - 1;
          return (
            <line
              key={g}
              x1={x}
              x2={x}
              y1="84"
              y2="140"
              stroke={warm}
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          );
        })}
    </svg>
  );
}
function Ghost({ x, y }: { x: number; y: number }) {
  return (
    <rect
      data-removed-cube="true"
      x={x}
      y={y}
      width={CUBE.size}
      height={CUBE.size}
      rx="1.5"
      fill="none"
      stroke={warm}
      strokeWidth="1.5"
      strokeDasharray="3 2"
    />
  );
}

function BalanceRemove() {
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <div style={panels} data-lesson-illustration="balance-remove">
        <MiniBalance
          equation="x + 3 = 7"
          blocks={1}
          units={3}
          right={7}
          removed={3}
          description="A level balance: one x block and 3 cubes on the left, 7 cubes on the right. The 3 cubes on the left and 3 of the cubes on the right are marked for removal."
        />
        <MiniBalance
          equation="x = 4"
          blocks={1}
          units={0}
          right={4}
          description="After removing 3 cubes from each pan, the balance is still level: one x block balances 4 cubes."
        />
      </div>
      <figcaption style={captionStyle}>
        Removing 3 cubes from each pan keeps the balance level, so x + 3 = 7
        becomes x = 4. Dashed outlines mark the cubes taken off. Each cube
        weighs 1 gram.
      </figcaption>
    </figure>
  );
}

function BalanceSplit() {
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <div style={panels} data-lesson-illustration="balance-split">
        <MiniBalance
          equation="3x = 12"
          blocks={3}
          units={0}
          right={12}
          rightGroups={3}
          description="A level balance: 3 x blocks on the left, 12 cubes on the right arranged in 3 equal groups of 4."
        />
        <MiniBalance
          equation="x = 4"
          blocks={1}
          units={0}
          right={4}
          description="One x block balances one of the groups: 4 cubes."
        />
      </div>
      <figcaption style={captionStyle}>
        Split both pans into 3 equal groups. Each x block matches one group of 4
        cubes, so 3x = 12 gives x = 12 ÷ 3 = 4.
      </figcaption>
    </figure>
  );
}

function BalanceBags() {
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <div style={panels} data-lesson-illustration="balance-bags">
        <MiniBalance
          equation="2(x + 1) = 10"
          groups={2}
          blocks={1}
          units={1}
          right={10}
          rightGroups={2}
          description="A level balance: 2 bags on the left, each holding one x block and 1 cube; 10 cubes on the right in 2 equal groups of 5."
        />
        <MiniBalance
          equation="x + 1 = 5"
          blocks={1}
          units={1}
          right={5}
          removed={1}
          description="One bag balances 5 cubes. The cube in the bag and one cube on the right are marked for removal."
        />
        <MiniBalance
          equation="x = 4"
          blocks={1}
          units={0}
          right={4}
          description="One x block balances 4 cubes."
        />
      </div>
      <figcaption style={captionStyle}>
        Split both pans into 2 equal groups: one bag balances 5 cubes. Then
        remove 1 cube from each side: x = 4.
      </figcaption>
    </figure>
  );
}

function Node({
  x,
  y,
  text,
  value,
}: {
  x: number;
  y: number;
  text: string;
  value?: number;
}) {
  return (
    <g
      data-node={text}
      {...(value !== undefined ? { "data-value": value } : {})}
    >
      <rect
        x={x - 34}
        y={y - 22}
        width="68"
        height="44"
        rx="10"
        fill={paper}
        stroke={ink}
        strokeWidth="2"
      />
      <text x={x} y={y + 8} textAnchor="middle" fill={ink} style={label}>
        {text}
      </text>
    </g>
  );
}
function Arrow({
  from,
  to,
  y,
  op,
  color,
}: {
  from: number;
  to: number;
  y: number;
  op: string;
  color: string;
}) {
  const dir = Math.sign(to - from);
  return (
    <g data-step={op}>
      <line
        x1={from}
        x2={to - dir * 8}
        y1={y}
        y2={y}
        stroke={color}
        strokeWidth="3"
      />
      <path
        d={`M${to} ${y} L${to - dir * 10} ${y - 7} L${to - dir * 10} ${y + 7} Z`}
        fill={color}
      />
      <text
        x={(from + to) / 2}
        y={y - 10}
        textAnchor="middle"
        fill={color}
        style={{ fontSize: 20, fontWeight: 700 }}
      >
        {op}
      </text>
    </g>
  );
}
function UndoChain() {
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="undo-chain"
        viewBox="0 0 400 200"
        role="img"
        aria-label="Top row, building the equation: x, times 3, gives 3x; plus 5 gives 20. Bottom row, undoing it in reverse: 20, minus 5, gives 15; divided by 3 gives 5."
        style={svgStyle}
      >
        <title>Undo the operations in reverse order</title>
        <text
          x="200"
          y="22"
          textAnchor="middle"
          fill={ink}
          style={{ fontSize: 18 }}
        >
          Build 3x + 5 = 20
        </text>
        <Node x={50} y={62} text="x" />
        <Arrow from={86} to={162} y={62} op="× 3" color={gold} />
        <Node x={200} y={62} text="3x" />
        <Arrow from={236} to={312} y={62} op="+ 5" color={gold} />
        <Node x={350} y={62} text="20" value={20} />
        <text
          x="200"
          y="122"
          textAnchor="middle"
          fill={ink}
          style={{ fontSize: 18 }}
        >
          Undo in reverse order
        </text>
        <Node x={350} y={162} text="20" value={20} />
        <Arrow from={314} to={238} y={162} op="− 5" color={accent} />
        <Node x={200} y={162} text="15" value={15} />
        <Arrow from={164} to={88} y={162} op="÷ 3" color={accent} />
        <Node x={50} y={162} text="5" value={5} />
      </svg>
      <figcaption style={captionStyle}>
        Building 3x + 5 multiplies by 3 and then adds 5. Solving undoes the last
        step first: 20 − 5 = 15, then 15 ÷ 3 = 5, so x = 5.
      </figcaption>
    </figure>
  );
}

/** A bar whose segment widths are proportional to their values. */
function Tape({
  y,
  segments,
  total,
  title,
  scale,
}: {
  y: number;
  segments: {
    label: string;
    value: number;
    unknown: boolean;
    group?: number;
  }[];
  total: number;
  title: string;
  scale: number;
}) {
  const sum = segments.reduce((a, s) => a + s.value, 0);
  const left = 200 - (sum * scale) / 2;
  let x = left;
  return (
    <g data-tape={title} data-total={total}>
      <text x="200" y={y - 56} textAnchor="middle" fill={ink} style={label}>
        {title}
      </text>
      <path
        d={`M${left} ${y - 8} V${y - 18} H${left + sum * scale} V${y - 8}`}
        fill="none"
        stroke={ink}
        strokeWidth="2"
      />
      <text
        x="200"
        y={y - 24}
        textAnchor="middle"
        fill={ink}
        style={{ fontSize: 18 }}
      >
        {total}
      </text>
      {segments.map((s, i) => {
        const w = s.value * scale,
          at = x;
        x += w;
        return (
          <g
            key={i}
            data-segment={s.label}
            data-value={s.value}
            {...(s.group !== undefined ? { "data-group": s.group } : {})}
          >
            <rect
              x={at}
              y={y}
              width={w}
              height="40"
              fill={s.unknown ? goldFill : accentFill}
              stroke={s.unknown ? gold : accent}
              strokeWidth="2"
            />
            <text
              x={at + w / 2}
              y={y + 27}
              textAnchor="middle"
              fill={ink}
              style={{
                fontSize: 20,
                fontStyle: s.unknown ? "italic" : "normal",
              }}
            >
              {s.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}
function EquationTape() {
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="equation-tape"
        viewBox="0 0 400 262"
        role="img"
        aria-label="Two tape diagrams. First: a bar split into s and 14, with total length 41, showing s + 14 = 41. Second: a bar of 4 equal parts, each t, with total 28, showing 4t = 28."
        style={svgStyle}
      >
        <title>Tape diagrams for one-step equations</title>
        <Tape
          y={78}
          title="s + 14 = 41"
          total={41}
          scale={8}
          segments={[
            { label: "s", value: 27, unknown: true },
            { label: "14", value: 14, unknown: false },
          ]}
        />
        <Tape
          y={206}
          title="4t = 28"
          total={28}
          scale={12}
          segments={Array.from({ length: 4 }, () => ({
            label: "t",
            value: 7,
            unknown: true,
          }))}
        />
      </svg>
      <figcaption style={captionStyle}>
        Each bar’s length is its total. In the first, the unknown part s and the
        known part 14 make 41, so s = 41 − 14 = 27. In the second, 4 equal parts
        make 28, so t = 28 ÷ 4 = 7. Lengths are drawn to scale.
      </figcaption>
    </figure>
  );
}
function TwoStepTape() {
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="two-step-tape"
        viewBox="0 0 400 262"
        role="img"
        aria-label="Two tape diagrams. First: three parts x and one part 6, total 21, showing 3x + 6 = 21. Second: three equal groups, each made of c and 2, total 21, showing 3(c + 2) = 21."
        style={svgStyle}
      >
        <title>px + q compared with p(x + q)</title>
        <Tape
          y={78}
          title="3x + 6 = 21"
          total={21}
          scale={15}
          segments={[
            { label: "x", value: 5, unknown: true },
            { label: "x", value: 5, unknown: true },
            { label: "x", value: 5, unknown: true },
            { label: "6", value: 6, unknown: false },
          ]}
        />
        <Tape
          y={206}
          title="3(c + 2) = 21"
          total={21}
          scale={15}
          segments={[0, 1, 2].flatMap((g) => [
            { label: "c", value: 5, unknown: true, group: g },
            { label: "2", value: 2, unknown: false, group: g },
          ])}
        />
      </svg>
      <figcaption style={captionStyle}>
        In 3x + 6 = 21 the 6 appears once: 3x = 15 and x = 5. In 3(c + 2) = 21
        every one of the 3 groups contains c and 2: c + 2 = 7 and c = 5. Lengths
        are drawn to scale.
      </figcaption>
    </figure>
  );
}

function ManySolutions() {
  const line = (
    y: number,
    min: number,
    max: number,
    step: number,
    points: number[],
    title: string,
  ) => {
    const x0 = 24,
      x1 = 376;
    const px = (n: number) =>
      x0 + 14 + ((n - min) / (max - min)) * (x1 - x0 - 28);
    const ticks = Array.from(
      { length: Math.round((max - min) / step) + 1 },
      (_, i) => Math.round((min + i * step) * 10) / 10,
    );
    return (
      <g data-number-line={title} data-min={min} data-max={max}>
        <text
          x="200"
          y={y - 44}
          textAnchor="middle"
          fill={ink}
          style={{ fontSize: 18 }}
        >
          {title}
        </text>
        <line x1={x0} x2={x1} y1={y} y2={y} stroke={axis} strokeWidth="1.5" />
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={px(t)}
              x2={px(t)}
              y1={y - 6}
              y2={y + 6}
              stroke={ink}
              strokeWidth="1.5"
            />
            {(step === 1 || t === min || t === max || t === 2.5) && (
              <text
                x={px(t)}
                y={y + 28}
                textAnchor="middle"
                fill={ink}
                style={{ fontSize: 16 }}
              >
                {t}
              </text>
            )}
          </g>
        ))}
        <line
          x1={px(2)}
          x2={x1}
          y1={y}
          y2={y}
          stroke={accent}
          strokeWidth="5"
        />
        <path
          d={`M${x1 - 12} ${y - 9} L${x1 + 1} ${y} L${x1 - 12} ${y + 9} Z`}
          fill={accent}
        />
        <circle
          cx={px(2)}
          cy={y}
          r="7"
          fill={paper}
          stroke={accent}
          strokeWidth="3"
        />
        {points.map((p) => (
          <g key={p} data-solution={p}>
            <circle
              cx={px(p)}
              cy={y}
              r="5"
              fill={warm}
              stroke={paper}
              strokeWidth="1.5"
            />
            <text
              x={px(p)}
              y={y - 14}
              textAnchor="middle"
              fill={warm}
              style={{ fontSize: 16, fontWeight: 700 }}
            >
              {p}
            </text>
          </g>
        ))}
      </g>
    );
  };
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="inequality-many-solutions"
        data-relation=">"
        data-boundary="2"
        viewBox="0 0 400 230"
        role="img"
        aria-label="Two number lines for x > 2, each with an open circle at 2 and a thick ray to the right. The first, from 0 to 6, marks solutions 2.5, 4 and 5.5. The second zooms in between 2 and 3 in tenths and marks solutions 2.1, 2.5 and 2.9."
        style={svgStyle}
      >
        <title>x &gt; 2 has infinitely many solutions</title>
        {line(70, 0, 6, 1, [2.5, 4, 5.5], "x > 2, from 0 to 6")}
        {line(180, 2, 3, 0.1, [2.1, 2.5, 2.9], "Zoomed in between 2 and 3")}
      </svg>
      <figcaption style={captionStyle}>
        The open circle at 2 means 2 is not a solution. Every point on the thick
        ray is a solution. Zooming in between 2 and 3 shows more solutions, 2.1,
        2.5 and 2.9, and there are more between any two of them.
      </figcaption>
    </figure>
  );
}
