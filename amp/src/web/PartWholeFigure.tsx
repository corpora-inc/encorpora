import type {
  PartWholeFigure as Data,
  PartitionedShape,
} from "../math/part-whole-models";

const ink = "var(--color-figure-ink)",
  shade = "var(--color-figure-accent)",
  empty = "var(--color-figure-empty)";
const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const WORDS = ["zero", "one", "two", "three", "four", "five", "six"];

/** Exact part outlines for a shape drawn in the box (x, y, w, h). Strip and
 * sector sizes are proportional to their integer weights. */
export function shapeParts(
  s: Pick<PartitionedShape, "shape" | "cut" | "sizes">,
  x: number,
  y: number,
  w: number,
  h: number,
): string[] {
  const sum = total(s.sizes);
  if (s.cut === "sectors") {
    const cx = x + w / 2,
      cy = y + h / 2,
      r = Math.min(w, h) / 2;
    let start = 0;
    return s.sizes.map((size) => {
      const end = start + size / sum;
      const point = (t: number) =>
        `${(cx + r * Math.sin(2 * Math.PI * t)).toFixed(3)} ${(cy - r * Math.cos(2 * Math.PI * t)).toFixed(3)}`;
      const d = `M${cx} ${cy} L${point(start)} A${r} ${r} 0 ${end - start > 0.5 ? 1 : 0} 1 ${point(end)} Z`;
      start = end;
      return d;
    });
  }
  const tl = `${x} ${y}`,
    tr = `${x + w} ${y}`,
    br = `${x + w} ${y + h}`,
    bl = `${x} ${y + h}`,
    c = `${x + w / 2} ${y + h / 2}`;
  if (s.cut === "diagonal")
    return [`M${tl} L${tr} L${br} Z`, `M${tl} L${br} L${bl} Z`];
  if (s.cut === "diagonals")
    return [
      `M${tl} L${tr} L${c} Z`,
      `M${tr} L${br} L${c} Z`,
      `M${br} L${bl} L${c} Z`,
      `M${bl} L${tl} L${c} Z`,
    ];
  if (s.cut === "grid")
    return [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ].map(([i, j]) => {
      const px = x + (i! * w) / 2,
        py = y + (j! * h) / 2;
      return `M${px} ${py} h${w / 2} v${h / 2} h${-w / 2} Z`;
    });
  let offset = 0;
  return s.sizes.map((size) => {
    const a = offset / sum,
      b = (offset + size) / sum;
    offset += size;
    return s.cut === "rows"
      ? `M${x} ${y + a * h} H${x + w} V${y + b * h} H${x} Z`
      : `M${x + a * w} ${y} H${x + b * w} V${y + h} H${x + a * w} Z`;
  });
}
export const shapeBox = (shape: PartitionedShape["shape"]) =>
  shape === "rectangle"
    ? { w: 170, h: 110 }
    : shape === "square"
      ? { w: 130, h: 130 }
      : { w: 140, h: 140 };

function describeShape(s: PartitionedShape) {
  const n = s.sizes.length,
    equal = s.sizes.every((w) => w === s.sizes[0]);
  const how =
    s.cut === "sectors"
      ? "from its centre"
      : s.cut === "columns"
        ? "by vertical lines"
        : s.cut === "rows"
          ? "by horizontal lines"
          : s.cut === "grid"
            ? "by one vertical and one horizontal line through its middle"
            : s.cut === "diagonal"
              ? "along one diagonal"
              : "along both diagonals";
  const sizes = equal
    ? "equal parts"
    : `parts with sizes in the ratio ${s.sizes.join(" : ")}`;
  const shaded = s.shaded.length
    ? `, ${WORDS[s.shaded.length]} shaded`
    : ", none shaded";
  return `${s.label ? `Shape ${s.label}: ` : ""}a ${s.shape} cut ${how} into ${WORDS[n] ?? n} ${sizes}${shaded}`;
}

function Shapes({
  figure,
}: {
  figure: Extract<Data, { kind: "partitioned-shapes" }>;
}) {
  const cell = 190,
    width = cell * figure.shapes.length,
    labelled = figure.shapes.some((s) => s.label);
  const description = figure.shapes.map(describeShape).join(". ");
  return (
    <svg
      data-kind={figure.kind}
      className="figure part-whole-figure"
      viewBox={`0 0 ${width} ${labelled ? 200 : 160}`}
      role="img"
      aria-label={`${description}.`}
    >
      <title>{description}</title>
      {figure.shapes.map((s, index) => {
        const { w, h } = shapeBox(s.shape);
        const x = index * cell + (cell - w) / 2,
          y = 10 + (140 - h) / 2;
        const outlines = shapeParts(s, x, y, w, h);
        return (
          <g key={index} data-shape={s.label ?? index}>
            {outlines.map((d, part) => (
              <path
                key={part}
                d={d}
                data-part={part}
                fill={s.shaded.includes(part) ? shade : empty}
                stroke={ink}
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            ))}
            {s.label && (
              <text
                x={index * cell + cell / 2}
                y="188"
                textAnchor="middle"
                style={{ fontSize: 28, fontWeight: 700 }}
                fill={ink}
              >
                {s.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function AreaPartition({
  figure,
}: {
  figure: Extract<Data, { kind: "area-partition" }>;
}) {
  const { columns, rows, regions } = figure;
  const size = Math.min(300 / columns, 150 / rows),
    x0 = (320 - size * columns) / 2,
    y0 = 10;
  const at = (row: number, column: number) => regions[row * columns + column];
  const count = Math.max(...regions) + 1;
  const boundaries: string[] = [];
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const x = x0 + column * size,
        y = y0 + row * size;
      if (column + 1 < columns && at(row, column) !== at(row, column + 1))
        boundaries.push(`M${x + size} ${y} V${y + size}`);
      if (row + 1 < rows && at(row, column) !== at(row + 1, column))
        boundaries.push(`M${x} ${y + size} H${x + size}`);
    }
  const description = `A rectangle ${columns} unit squares wide and ${rows} high, split into ${count} parts of ${(columns * rows) / count} unit squares each${figure.shaded.length ? `; ${WORDS[figure.shaded.length] ?? figure.shaded.length} part shaded` : ""}${figure.units ? "" : ". Unit squares are not drawn"}.`;
  return (
    <svg
      data-kind={figure.kind}
      className="figure part-whole-figure"
      viewBox={`0 0 320 ${y0 * 2 + rows * size}`}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      {regions.map((region, i) => (
        <rect
          key={i}
          data-region={region}
          x={x0 + (i % columns) * size}
          y={y0 + Math.floor(i / columns) * size}
          width={size}
          height={size}
          fill={figure.shaded.includes(region) ? shade : empty}
          stroke={figure.units ? "var(--color-figure-grid)" : "none"}
          strokeWidth="1"
        />
      ))}
      <path
        d={boundaries.join(" ")}
        stroke={ink}
        strokeWidth="3"
        strokeLinecap="square"
      />
      <rect
        x={x0}
        y={y0}
        width={columns * size}
        height={rows * size}
        fill="none"
        stroke={ink}
        strokeWidth="3"
      />
    </svg>
  );
}

/** A label "a/b" is typeset as a stacked fraction. */
function Label({ text, x, y }: { text: string; x: number; y: number }) {
  const m = /^(\d+)\/(\d+)$/.exec(text);
  if (!m)
    return (
      <text
        x={x}
        y={y + 7}
        textAnchor="middle"
        style={{ fontSize: 20 }}
        fill={ink}
      >
        {text}
      </text>
    );
  return (
    <g>
      <text
        x={x}
        y={y - 5}
        textAnchor="middle"
        style={{ fontSize: 18 }}
        fill={ink}
      >
        {m[1]}
      </text>
      <line
        x1={x - 13}
        x2={x + 13}
        y1={y}
        y2={y}
        stroke={ink}
        strokeWidth="1.5"
      />
      <text
        x={x}
        y={y + 19}
        textAnchor="middle"
        style={{ fontSize: 18 }}
        fill={ink}
      >
        {m[2]}
      </text>
    </g>
  );
}
function Bars({
  figure,
}: {
  figure: Extract<Data, { kind: "fraction-bars" }>;
}) {
  const x0 = 64,
    width = 240,
    height = 40,
    gap = 22;
  const description = `${figure.bars.length} bars of the same length, each one whole. ${figure.bars
    .map(
      (b) =>
        `Bar ${b.label}: cut into ${b.parts} equal pieces${b.shaded ? `, ${b.shaded} shaded` : ""}`,
    )
    .join(". ")}.`;
  return (
    <svg
      data-kind={figure.kind}
      className="figure part-whole-figure"
      viewBox={`0 0 320 ${16 + figure.bars.length * (height + gap)}`}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      {figure.bars.map((bar, row) => {
        const y = 12 + row * (height + gap),
          piece = width / bar.parts;
        return (
          <g key={row} data-bar={row}>
            <Label text={bar.label} x={28} y={y + height / 2} />
            {Array.from({ length: bar.parts }, (_, i) => (
              <rect
                key={i}
                x={x0 + i * piece}
                y={y}
                width={piece}
                height={height}
                fill={i < bar.shaded ? shade : empty}
                stroke={ink}
                strokeWidth="2"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function PartWholeFigure({ figure }: { figure: Data }) {
  if (figure.kind === "partitioned-shapes") return <Shapes figure={figure} />;
  if (figure.kind === "area-partition")
    return <AreaPartition figure={figure} />;
  return <Bars figure={figure} />;
}
