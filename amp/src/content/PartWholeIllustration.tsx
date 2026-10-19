import React from "react";
import { shapeBox, shapeParts } from "../web/PartWholeFigure";
import { snakeRegions, type PartitionedShape } from "../math/part-whole-models";

const ink = "var(--color-figure-ink)",
  shade = "var(--color-figure-accent)",
  empty = "var(--color-figure-empty)",
  warm = "var(--color-figure-warm)";

function Shape({
  s,
  cx,
  caption,
  note,
}: {
  s: Omit<PartitionedShape, "label">;
  cx: number;
  caption: string;
  note?: string;
}) {
  const { w, h } = shapeBox(s.shape);
  const x = cx - w / 2,
    y = 20 + (140 - h) / 2;
  return (
    <g>
      {shapeParts(s, x, y, w, h).map((d, i) => (
        <path
          key={i}
          d={d}
          fill={s.shaded.includes(i) ? shade : empty}
          stroke={ink}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      ))}
      <text
        x={cx}
        y="190"
        textAnchor="middle"
        style={{ fontSize: 22 }}
        fill={ink}
      >
        {caption}
      </text>
      {note && (
        <text
          x={cx}
          y="216"
          textAnchor="middle"
          style={{ fontSize: 20 }}
          fill={note.startsWith("not") ? warm : ink}
        >
          {note}
        </text>
      )}
    </g>
  );
}

function EqualShares() {
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 600 228"
      role="img"
      aria-label="Three shapes. A square cut into 2 equal parts shows halves. A rectangle cut into 2 parts of different sizes does not show halves. A circle cut into 4 equal parts shows quarters, with one quarter shaded."
    >
      <Shape
        s={{ shape: "square", cut: "columns", sizes: [1, 1], shaded: [0] }}
        cx={100}
        caption="halves"
        note="one half shaded"
      />
      <Shape
        s={{ shape: "rectangle", cut: "columns", sizes: [1, 2], shaded: [] }}
        cx={300}
        caption="2 unequal parts"
        note="not halves"
      />
      <Shape
        s={{
          shape: "circle",
          cut: "sectors",
          sizes: [1, 1, 1, 1],
          shaded: [1],
        }}
        cx={500}
        caption="quarters"
        note="one quarter shaded"
      />
    </svg>
  );
}

function SameShareShapes() {
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 600 228"
      role="img"
      aria-label="Two same-size squares. The first is cut in half by a vertical line, the second by a diagonal; one half of each is shaded. A third square is cut into 3 equal strips with one third shaded, which is less than one half."
    >
      <Shape
        s={{ shape: "square", cut: "columns", sizes: [1, 1], shaded: [0] }}
        cx={100}
        caption="one half"
      />
      <Shape
        s={{ shape: "square", cut: "diagonal", sizes: [1, 1], shaded: [1] }}
        cx={300}
        caption="one half"
        note="same amount"
      />
      <Shape
        s={{ shape: "square", cut: "rows", sizes: [1, 1, 1], shaded: [0] }}
        cx={500}
        caption="one third"
        note="less than a half"
      />
    </svg>
  );
}

function EqualAreaRegions() {
  const columns = 4,
    rows = 3,
    size = 46,
    x0 = 30,
    y0 = 20;
  const regions = snakeRegions(columns, rows, 4);
  const at = (r: number, c: number) => regions[r * columns + c];
  const borders: string[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const x = x0 + c * size,
        y = y0 + r * size;
      if (c + 1 < columns && at(r, c) !== at(r, c + 1))
        borders.push(`M${x + size} ${y} V${y + size}`);
      if (r + 1 < rows && at(r, c) !== at(r + 1, c))
        borders.push(`M${x} ${y + size} H${x + size}`);
    }
  const fills = [shade, empty, "var(--color-figure-gold-fill)", empty];
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 520 190"
      role="img"
      aria-label="A rectangle 4 unit squares wide and 3 high, 12 squares in all, split into 4 parts of 3 squares each. Two parts are straight strips and two bend around a corner. Each part is one quarter of the area."
    >
      {regions.map((region, i) => (
        <rect
          key={i}
          x={x0 + (i % columns) * size}
          y={y0 + Math.floor(i / columns) * size}
          width={size}
          height={size}
          fill={fills[region]}
          stroke="var(--color-figure-grid)"
        />
      ))}
      <path d={borders.join(" ")} stroke={ink} strokeWidth="3.5" />
      <rect
        x={x0}
        y={y0}
        width={columns * size}
        height={rows * size}
        fill="none"
        stroke={ink}
        strokeWidth="3.5"
      />
      <text x="250" y="60" style={{ fontSize: 18 }} fill={ink}>
        12 unit squares in all
      </text>
      <text x="250" y="92" style={{ fontSize: 18 }} fill={ink}>
        4 parts × 3 squares each
      </text>
      <text x="250" y="124" style={{ fontSize: 18 }} fill={ink}>
        each part: 3/12 = 1/4 of the area
      </text>
      <text
        x={x0 + (columns * size) / 2}
        y="182"
        textAnchor="middle"
        style={{ fontSize: 15 }}
        fill={warm}
      >
        different shapes, equal areas
      </text>
    </svg>
  );
}

function CompareSameWhole() {
  const x0 = 120,
    width = 400;
  const bars = [
    { n: 1, d: 2, label: "1/2" },
    { n: 1, d: 3, label: "1/3" },
    { n: 1, d: 4, label: "1/4" },
    { n: 2, d: 3, label: "2/3" },
    { n: 2, d: 5, label: "2/5" },
  ];
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 560 300"
      role="img"
      aria-label="Five bars of the same length, each one whole. One half, one third and one quarter are shaded on the first three: the shaded length shrinks as the number of pieces grows. Two thirds is longer than two fifths."
    >
      {bars.map((bar, row) => {
        const y = 14 + row * 56 + (row > 2 ? 12 : 0),
          piece = width / bar.d;
        return (
          <g key={bar.label}>
            <text
              x="62"
              y={y + 26}
              textAnchor="middle"
              style={{ fontSize: 20 }}
              fill={ink}
            >
              {bar.label}
            </text>
            {Array.from({ length: bar.d }, (_, i) => (
              <rect
                key={i}
                x={x0 + i * piece}
                y={y}
                width={piece}
                height={36}
                fill={i < bar.n ? shade : empty}
                stroke={ink}
                strokeWidth="2"
              />
            ))}
          </g>
        );
      })}
      <line
        x1={x0 + (2 * width) / 5}
        x2={x0 + (2 * width) / 5}
        y1="180"
        y2="296"
        stroke={warm}
        strokeWidth="2"
        strokeDasharray="6 4"
      />
    </svg>
  );
}

export function PartWholeIllustration({
  kind,
}: {
  kind:
    | "equal-shares"
    | "same-share-shapes"
    | "equal-area-regions"
    | "compare-same-whole";
}) {
  if (kind === "equal-shares") return <EqualShares />;
  if (kind === "same-share-shapes") return <SameShareShapes />;
  if (kind === "equal-area-regions") return <EqualAreaRegions />;
  return <CompareSameWhole />;
}
