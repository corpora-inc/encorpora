import type { EarlyOperationsFigure as Data } from "../math/early-operations-models.js";

const ink = "var(--color-figure-ink)",
  paper = "var(--color-figure-paper)",
  accent = "var(--color-figure-accent)",
  accentFill = "var(--color-figure-accent-fill)",
  warm = "var(--color-figure-warm)",
  warmFill = "var(--color-figure-warm-fill)",
  gold = "var(--color-figure-gold)",
  goldFill = "var(--color-figure-gold-fill)",
  axis = "var(--color-figure-axis)";

/** Number bonds, bar models, a level balance, three counter groups and a
 * chain of two changes. The one unknown is always a gold box marked ?. */
export function EarlyOperationsFigure({ figure }: { figure: Data }) {
  switch (figure.kind) {
    case "number-bond":
      return <NumberBond figure={figure} />;
    case "bar-model":
      return <BarModel figure={figure} />;
    case "equal-balance":
      return <Balance figure={figure} />;
    case "addend-groups":
      return <AddendGroups figure={figure} />;
    case "change-chain":
      return <ChangeChain figure={figure} />;
  }
}

const label = (v: number | null) => (v === null ? "?" : `${v}`);

function NumberBond({
  figure,
}: {
  figure: Extract<Data, { kind: "number-bond" }>;
}) {
  const r = 32,
    nodes = [
      { x: 150, y: 42, v: figure.whole, role: "whole" },
      { x: 76, y: 142, v: figure.parts[0], role: "part" },
      { x: 224, y: 142, v: figure.parts[1], role: "part" },
    ];
  const edge = (to: (typeof nodes)[number]) => {
    const from = nodes[0]!,
      dx = to.x - from.x,
      dy = to.y - from.y,
      d = Math.hypot(dx, dy);
    return (
      <line
        key={to.x}
        x1={from.x + (dx / d) * r}
        y1={from.y + (dy / d) * r}
        x2={to.x - (dx / d) * r}
        y2={to.y - (dy / d) * r}
        stroke={ink}
        strokeWidth="2"
      />
    );
  };
  return (
    <svg
      className="figure early-operations-figure"
      data-kind="number-bond"
      viewBox="0 0 300 180"
      role="img"
      aria-label={`A number bond: the whole ${label(figure.whole)} on top joins the parts ${label(figure.parts[0])} and ${label(figure.parts[1])} below. A question mark is the missing number.`}
    >
      {edge(nodes[1]!)}
      {edge(nodes[2]!)}
      {nodes.map((n) => (
        <g
          key={n.x}
          data-node={n.role}
          data-unknown={n.v === null || undefined}
        >
          <circle
            cx={n.x}
            cy={n.y}
            r={r}
            fill={
              n.v === null ? goldFill : n.role === "whole" ? accentFill : paper
            }
            stroke={n.v === null ? gold : ink}
            strokeWidth="2"
            strokeDasharray={n.v === null ? "5 4" : undefined}
          />
          <text
            x={n.x}
            y={n.y + 9}
            textAnchor="middle"
            fontSize="26"
            fontWeight="600"
            fill={n.v === null ? gold : ink}
          >
            {label(n.v)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function BarModel({
  figure,
}: {
  figure: Extract<Data, { kind: "bar-model" }>;
}) {
  const known = figure.parts.reduce<number>((s, p) => s + (p ?? 0), 0),
    total = figure.whole ?? known,
    x0 = 20,
    width = 320,
    unit = width / total;
  let x = x0;
  const segments = figure.parts.map((p, i) => {
    const value = p ?? total - known,
      w = value * unit,
      left = x;
    x += w;
    return (
      <g key={i} data-part={i} data-unknown={p === null || undefined}>
        <rect
          x={left}
          y={70}
          width={w}
          height={42}
          fill={p === null ? goldFill : i % 2 ? warmFill : accentFill}
          stroke={p === null ? gold : ink}
          strokeWidth="1.5"
          strokeDasharray={p === null ? "5 4" : undefined}
        />
        <text
          x={left + w / 2}
          y={98}
          textAnchor="middle"
          fontSize="20"
          fontWeight="600"
          fill={p === null ? gold : ink}
        >
          {label(p)}
        </text>
      </g>
    );
  });
  return (
    <svg
      className="figure early-operations-figure"
      data-kind="bar-model"
      viewBox="0 0 360 124"
      role="img"
      aria-label={`A bar model. The whole bar is ${label(figure.whole)}. Below it, the parts are ${figure.parts.map(label).join(", ")}, end to end, as long as the whole.`}
    >
      <g data-whole data-unknown={figure.whole === null || undefined}>
        <rect
          x={x0}
          y={12}
          width={width}
          height={42}
          fill={figure.whole === null ? goldFill : paper}
          stroke={figure.whole === null ? gold : ink}
          strokeWidth="1.5"
          strokeDasharray={figure.whole === null ? "5 4" : undefined}
        />
        <text
          x={x0 + width / 2}
          y={40}
          textAnchor="middle"
          fontSize="20"
          fontWeight="600"
          fill={figure.whole === null ? gold : ink}
        >
          {label(figure.whole)}
        </text>
      </g>
      {segments}
    </svg>
  );
}

/** Counters in rows of five; returns elements and the stack height. */
function counterStack(
  n: number,
  cx: number,
  base: number,
  color: string,
  key: string,
) {
  const pitch = 15,
    perRow = Math.min(5, n);
  return Array.from({ length: n }, (_, i) => (
    <circle
      key={`${key}-${i}`}
      data-counter={key}
      cx={cx - ((perRow - 1) * pitch) / 2 + (i % 5) * pitch}
      cy={base - 8 - Math.floor(i / 5) * pitch}
      r="6.5"
      fill={color}
    />
  ));
}

function Pan({
  groups,
  cx,
  y,
  side,
}: {
  groups: (number | null)[];
  cx: number;
  y: number;
  side: string;
}) {
  const slot = groups.length === 1 ? [0] : [-40, 40];
  return (
    <g data-pan={side}>
      <line x1={cx - 82} x2={cx - 72} y1={y - 72} y2={y} stroke={axis} />
      <line x1={cx + 82} x2={cx + 72} y1={y - 72} y2={y} stroke={axis} />
      <path
        d={`M ${cx - 84} ${y} Q ${cx} ${y + 16} ${cx + 84} ${y}`}
        fill={paper}
        stroke={ink}
        strokeWidth="2"
      />
      {groups.map((g, i) =>
        g === null ? (
          <g key={i} data-box>
            <rect
              x={cx + slot[i]! - 24}
              y={y - 44}
              width={48}
              height={42}
              rx={6}
              fill={goldFill}
              stroke={gold}
              strokeWidth="2"
            />
            <text
              x={cx + slot[i]!}
              y={y - 15}
              textAnchor="middle"
              fontSize="22"
              fontWeight="600"
              fill={gold}
            >
              ?
            </text>
          </g>
        ) : (
          counterStack(g, cx + slot[i]!, y, i ? warm : accent, `${side}${i}`)
        ),
      )}
    </g>
  );
}

function Balance({
  figure,
}: {
  figure: Extract<Data, { kind: "equal-balance" }>;
}) {
  return (
    <svg
      className="figure early-operations-figure"
      data-kind="equal-balance"
      viewBox="0 0 360 200"
      role="img"
      aria-label={`A level balance. Left pan: ${figure.left.map((g) => (g === null ? "a closed box" : `${g} counters`)).join(" and ")}. Right pan: ${figure.right.map((g) => (g === null ? "a closed box" : `${g} counters`)).join(" and ")}.`}
    >
      <line
        x1={8}
        x2={352}
        y1={56}
        y2={56}
        stroke={ink}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <line x1={180} x2={180} y1={56} y2={176} stroke={ink} strokeWidth="3" />
      <path d="M 180 46 L 172 60 L 188 60 Z" fill={ink} />
      <path d="M 150 190 L 180 172 L 210 190 Z" fill={axis} />
      <Pan groups={figure.left} cx={92} y={128} side="left" />
      <Pan groups={figure.right} cx={268} y={128} side="right" />
    </svg>
  );
}

const shapes = [
  (x: number, y: number) => <circle cx={x} cy={y} r="11" fill={accent} />,
  (x: number, y: number) => (
    <rect x={x - 10} y={y - 10} width="20" height="20" rx="2" fill={warm} />
  ),
  (x: number, y: number) => (
    <path
      d={`M ${x} ${y - 12} L ${x + 12} ${y} L ${x} ${y + 12} L ${x - 12} ${y} Z`}
      fill={gold}
    />
  ),
];

function AddendGroups({
  figure,
}: {
  figure: Extract<Data, { kind: "addend-groups" }>;
}) {
  return (
    <svg
      className="figure early-operations-figure"
      data-kind="addend-groups"
      viewBox="0 0 360 140"
      role="img"
      aria-label={`Three groups: ${figure.addends[0]} circles, ${figure.addends[1]} squares and ${figure.addends[2]} diamonds.`}
    >
      {figure.addends.map((n, row) => (
        <g key={row} data-group={row}>
          {Array.from({ length: n }, (_, i) => (
            <g key={i} data-counter={row}>
              {shapes[row]!(36 + i * 32 + (i >= 5 ? 8 : 0), 24 + row * 46)}
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

function ChangeChain({
  figure,
}: {
  figure: Extract<Data, { kind: "change-chain" }>;
}) {
  const boxes = [
    { x: 56, v: figure.start, role: "start" },
    { x: 180, v: undefined, role: "middle" },
    { x: 304, v: figure.end, role: "end" },
  ];
  return (
    <svg
      className="figure early-operations-figure"
      data-kind="change-chain"
      viewBox="0 0 360 100"
      role="img"
      aria-label={`Start ${label(figure.start)}, then ${figure.steps[0]!.op} ${label(figure.steps[0]!.value)}, then ${figure.steps[1]!.op} ${label(figure.steps[1]!.value)}, ending at ${label(figure.end)}.`}
    >
      {figure.steps.map((s, i) => {
        const x1 = boxes[i]!.x + 38,
          x2 = boxes[i + 1]!.x - 38;
        return (
          <g key={i} data-step={i}>
            <line
              x1={x1}
              x2={x2 - 8}
              y1={70}
              y2={70}
              stroke={ink}
              strokeWidth="2"
            />
            <path d={`M ${x2} 70 l -10 -6 l 0 12 z`} fill={ink} />
            <rect
              x={(x1 + x2) / 2 - 24}
              y={20}
              width={48}
              height={30}
              rx={15}
              fill={
                s.value === null
                  ? goldFill
                  : s.op === "+"
                    ? accentFill
                    : warmFill
              }
              stroke={s.value === null ? gold : "none"}
              strokeWidth="2"
              strokeDasharray={s.value === null ? "5 4" : undefined}
            />
            <text
              x={(x1 + x2) / 2}
              y={41}
              textAnchor="middle"
              fontSize="18"
              fontWeight="600"
              fill={s.value === null ? gold : ink}
            >
              {s.op}
              {label(s.value)}
            </text>
          </g>
        );
      })}
      {boxes.map((b) => {
        const unknown = b.v === null;
        return (
          <g key={b.role} data-box={b.role}>
            <rect
              x={b.x - 36}
              y={50}
              width={72}
              height={40}
              rx={8}
              fill={unknown ? goldFill : paper}
              stroke={unknown ? gold : b.v === undefined ? axis : ink}
              strokeWidth="2"
              strokeDasharray={unknown || b.v === undefined ? "5 4" : undefined}
            />
            {b.v !== undefined && (
              <text
                x={b.x}
                y={78}
                textAnchor="middle"
                fontSize="20"
                fontWeight="600"
                fill={unknown ? gold : ink}
              >
                {label(b.v)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
