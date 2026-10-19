import type { FactArrayFigure as Data } from "../math/fact-array-models.js";

const ink = "var(--color-figure-ink)",
  paper = "var(--color-figure-paper)",
  dot = "var(--color-figure-accent)",
  card = "var(--color-figure-gold-fill)",
  cardEdge = "var(--color-figure-gold)",
  head = "var(--color-figure-accent-fill)",
  axis = "var(--color-figure-axis)";

/** Exact dot arrays, counters with their groups, and multiplication-table
 * windows. A card hides part of an array; when the hidden side is the answer,
 * the card's size is fixed so it cannot be measured. */
export function FactArrayFigure({ figure }: { figure: Data }) {
  if (figure.kind === "dot-array") return <DotArray figure={figure} />;
  if (figure.kind === "share-model") return <ShareModel figure={figure} />;
  return <TimesTable figure={figure} />;
}

function Card({
  x,
  y,
  width,
  height,
  mark,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  mark: boolean;
}) {
  return (
    <g data-card>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="8"
        fill={card}
        stroke={cardEdge}
        strokeWidth="1.5"
      />
      {mark && width >= 30 && height >= 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 9}
          textAnchor="middle"
          fontSize="26"
          fontWeight="600"
          fill={cardEdge}
        >
          ?
        </text>
      )}
    </g>
  );
}

function DotArray({
  figure,
}: {
  figure: Extract<Data, { kind: "dot-array" }>;
}) {
  const { show } = figure;
  const width = 360;
  if (show === "all" || show === "edges") {
    const rows = figure.rows!,
      columns = figure.columns!;
    const s = Math.min(30, 300 / columns, 200 / rows),
      w = s * columns,
      h = s * rows,
      x0 = (width - w) / 2,
      y0 = 8;
    const dots = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++)
        if (show === "all" || r === 0 || c === 0)
          dots.push(
            <circle
              key={`${r}-${c}`}
              data-dot={`${r}-${c}`}
              cx={x0 + (c + 0.5) * s}
              cy={y0 + (r + 0.5) * s}
              r={s * 0.32}
              fill={dot}
            />,
          );
    return (
      <svg
        className="figure fact-array-figure"
        data-kind="dot-array"
        viewBox={`0 0 ${width} ${h + 16}`}
        role="img"
        aria-label={
          show === "all"
            ? `An array of dots: ${rows} rows with ${columns} dots in each row.`
            : `An array of dots. The top row and the left column show; a card covers the rest of the array.`
        }
      >
        {dots}
        {show === "edges" && (
          <Card
            x={x0 + s + 2}
            y={y0 + s + 2}
            width={w - s - 2}
            height={h - s - 2}
            mark
          />
        )}
      </svg>
    );
  }
  const total = figure.total!;
  if (show === "first-column") {
    const rows = figure.rows!,
      s = Math.min(30, 170 / rows),
      h = s * rows,
      cardWidth = 190,
      x0 = (width - (s + 4 + cardWidth)) / 2,
      y0 = 8;
    return (
      <svg
        className="figure fact-array-figure"
        data-kind="dot-array"
        viewBox={`0 0 ${width} ${h + 48}`}
        role="img"
        aria-label={`${total} dots in equal rows. The left column shows ${rows} dots, one for each row; a card covers the rest of every row.`}
      >
        {Array.from({ length: rows }, (_, r) => (
          <circle
            key={r}
            data-dot={`${r}-0`}
            cx={x0 + s / 2}
            cy={y0 + (r + 0.5) * s}
            r={s * 0.32}
            fill={dot}
          />
        ))}
        <Card x={x0 + s + 4} y={y0} width={cardWidth} height={h} mark />
        <Total x={width / 2} y={h + 38} total={total} />
      </svg>
    );
  }
  const columns = figure.columns!,
    s = Math.min(30, 300 / columns),
    w = s * columns,
    cardHeight = 110,
    x0 = (width - w) / 2,
    y0 = 8;
  return (
    <svg
      className="figure fact-array-figure"
      data-kind="dot-array"
      viewBox={`0 0 ${width} ${s + cardHeight + 52}`}
      role="img"
      aria-label={`${total} dots in equal rows. The top row shows ${columns} dots; a card covers the other rows.`}
    >
      {Array.from({ length: columns }, (_, c) => (
        <circle
          key={c}
          data-dot={`0-${c}`}
          cx={x0 + (c + 0.5) * s}
          cy={y0 + s / 2}
          r={s * 0.32}
          fill={dot}
        />
      ))}
      <Card x={x0} y={y0 + s + 4} width={w} height={cardHeight} mark />
      <Total x={width / 2} y={s + cardHeight + 42} total={total} />
    </svg>
  );
}

function Total({ x, y, total }: { x: number; y: number; total: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize="18" fill={ink}>
      {total} dots in all
    </text>
  );
}

const PITCH = 22;
/** Counters in rows of ten, a gap after five, so the total can be read. */
function Pile({ total, top }: { total: number; top: number }) {
  const x0 = (360 - (10 * PITCH + 8)) / 2;
  return (
    <>
      {Array.from({ length: total }, (_, i) => {
        const c = i % 10;
        return (
          <circle
            key={i}
            data-counter={i}
            cx={x0 + PITCH / 2 + c * PITCH + (c >= 5 ? 8 : 0)}
            cy={top + PITCH / 2 + Math.floor(i / 10) * PITCH}
            r="7.5"
            fill={dot}
          />
        );
      })}
    </>
  );
}

function ShareModel({
  figure,
}: {
  figure: Extract<Data, { kind: "share-model" }>;
}) {
  const { total, count, mode } = figure,
    pileHeight = Math.ceil(total / 10) * PITCH,
    top = pileHeight + 34;
  if (mode === "share") {
    const pitch = Math.min(84, 344 / count),
      radius = Math.min(30, pitch / 2 - 4),
      left = (360 - pitch * count) / 2;
    return (
      <svg
        className="figure fact-array-figure"
        data-kind="share-model"
        viewBox={`0 0 360 ${top + 2 * radius + 10}`}
        role="img"
        aria-label={`${total} counters to share, and ${count} empty groups below them.`}
      >
        <Pile total={total} top={6} />
        {Array.from({ length: count }, (_, g) => (
          <g key={g} data-group={g}>
            <circle
              cx={left + pitch * (g + 0.5)}
              cy={top + radius}
              r={radius}
              fill={paper}
              stroke={axis}
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <text
              x={left + pitch * (g + 0.5)}
              y={top + radius + 7}
              textAnchor="middle"
              fontSize="18"
              fill={axis}
            >
              ?
            </text>
          </g>
        ))}
      </svg>
    );
  }
  const boxWidth = count * PITCH + 12,
    boxHeight = 34,
    left = (360 - boxWidth - 54) / 2;
  return (
    <svg
      className="figure fact-array-figure"
      data-kind="share-model"
      viewBox={`0 0 360 ${top + boxHeight + 10}`}
      role="img"
      aria-label={`${total} counters, and one empty group with room for ${count}. How many such groups the counters fill is unknown.`}
    >
      <Pile total={total} top={6} />
      <g data-group="0">
        <rect
          x={left}
          y={top}
          width={boxWidth}
          height={boxHeight}
          rx="10"
          fill={paper}
          stroke={ink}
          strokeWidth="1.5"
        />
        {Array.from({ length: count }, (_, i) => (
          <circle
            key={i}
            data-place={i}
            cx={left + 6 + PITCH / 2 + i * PITCH}
            cy={top + boxHeight / 2}
            r="7.5"
            fill="none"
            stroke={axis}
            strokeWidth="1.2"
            strokeDasharray="2 2"
          />
        ))}
      </g>
      <text
        x={left + boxWidth + 12}
        y={top + boxHeight / 2 + 7}
        fontSize="20"
        fill={ink}
      >
        × ?
      </text>
    </svg>
  );
}

function TimesTable({
  figure,
}: {
  figure: Extract<Data, { kind: "times-table" }>;
}) {
  const { rows, columns, ask, blank } = figure,
    w = Math.min(64, 340 / (columns.length + 1)),
    h = 40,
    left = (360 - w * (columns.length + 1)) / 2,
    top = 4;
  const isBlank = (r: number, c: number) =>
    blank.some(([br, bc]) => br === r && bc === c);
  const cell = (
    key: string,
    x: number,
    y: number,
    text: string,
    fill: string,
    extra: Record<string, string> = {},
  ) => (
    <g key={key} {...extra}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill={fill}
        stroke={ink}
        strokeWidth="1.2"
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + 7}
        textAnchor="middle"
        fontSize="19"
        fill={ink}
        fontWeight={fill === head ? "600" : "400"}
      >
        {text}
      </text>
    </g>
  );
  const cells = [cell("corner", left, top, "×", head)];
  columns.forEach((c, j) =>
    cells.push(cell(`c${j}`, left + w * (j + 1), top, `${c}`, head)),
  );
  rows.forEach((r, i) => {
    cells.push(cell(`r${i}`, left, top + h * (i + 1), `${r}`, head));
    columns.forEach((c, j) => {
      const asked = ask[0] === i && ask[1] === j;
      cells.push(
        cell(
          `${i}-${j}`,
          left + w * (j + 1),
          top + h * (i + 1),
          asked ? "?" : isBlank(i, j) ? "" : `${r * c}`,
          paper,
          { "data-cell": asked ? "ask" : isBlank(i, j) ? "blank" : "given" },
        ),
      );
    });
  });
  const ax = left + w * (ask[1] + 1),
    ay = top + h * (ask[0] + 1);
  return (
    <svg
      className="figure fact-array-figure"
      data-kind="times-table"
      viewBox={`0 0 360 ${h * (rows.length + 1) + 8}`}
      role="img"
      aria-label={`Part of a multiplication table with rows ${rows.join(", ")} and columns ${columns.join(", ")}. The cell in the row for ${rows[ask[0]]} and the column for ${columns[ask[1]]} is marked with a question mark${blank.length ? `; ${blank.length} other cell${blank.length === 1 ? " is" : "s are"} empty` : ""}.`}
    >
      {cells}
      <rect
        x={ax + 1.5}
        y={ay + 1.5}
        width={w - 3}
        height={h - 3}
        fill="none"
        stroke={cardEdge}
        strokeWidth="3"
      />
    </svg>
  );
}
