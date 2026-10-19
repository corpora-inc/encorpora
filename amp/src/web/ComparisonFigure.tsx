import type { SemanticFigure } from "../math/contracts.js";

export type ComparisonFigureData = Extract<
  SemanticFigure,
  { kind: "counter-rows" | "base-ten-pair" }
>;
const ink = "var(--color-figure-ink)";

/** Rows keep a common start; a spread row stretches across the full width, so
 * length and number can disagree, as they do on a table. */
function CounterRows({
  figure,
}: {
  figure: Extract<ComparisonFigureData, { kind: "counter-rows" }>;
}) {
  const left = 26,
    right = 294,
    step = 30;
  const xs = (count: number, spread: boolean) =>
    Array.from({ length: count }, (_, i) =>
      spread ? left + (i * (right - left)) / (count - 1) : left + i * step,
    );
  const note =
    figure.spread === "none"
      ? "Both rows use the same spacing."
      : `The ${figure.spread} are spread farther apart.`;
  return (
    <svg
      className="figure comparison-figure"
      data-kind="counter-rows"
      viewBox="0 0 320 128"
      role="img"
      aria-label={`A row of ${figure.circles} circles above a row of ${figure.squares} squares. ${note}`}
    >
      {xs(figure.circles, figure.spread === "circles").map((x, i) => (
        <circle
          key={`c${i}`}
          data-counter="circle"
          cx={x}
          cy={36}
          r={12}
          fill="var(--color-figure-accent)"
          stroke={ink}
          strokeWidth="1"
        />
      ))}
      {xs(figure.squares, figure.spread === "squares").map((x, i) => (
        <rect
          key={`s${i}`}
          data-counter="square"
          x={x - 11}
          y={81}
          width={22}
          height={22}
          rx={2}
          fill="var(--color-figure-warm)"
          stroke={ink}
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

/** Two numbers built from ten-rods and unit cubes, rows aligned by place. */
function BaseTenPair({
  figure,
}: {
  figure: Extract<ComparisonFigureData, { kind: "base-ten-pair" }>;
}) {
  const u = 9,
    rodStep = 13,
    label = 58,
    tensX = label + 8,
    onesX = tensX + 9 * rodStep + 18,
    top = 26,
    rowHeight = 10 * u + 22;
  return (
    <svg
      className="figure comparison-figure"
      data-kind="base-ten-pair"
      viewBox={`0 0 ${onesX + 5 * rodStep + 6} ${top + 2 * rowHeight}`}
      role="img"
      aria-label={figure.values
        .map(
          (n) =>
            `${n}: ${Math.floor(n / 10)} ten ${Math.floor(n / 10) === 1 ? "rod" : "rods"} and ${n % 10} one ${n % 10 === 1 ? "cube" : "cubes"}.`,
        )
        .join(" ")}
    >
      <text x={tensX} y={16} className="fig-scale">
        Tens
      </text>
      <text x={onesX} y={16} className="fig-scale">
        Ones
      </text>
      {figure.values.map((n, row) => {
        const y = top + row * rowHeight,
          tens = Math.floor(n / 10),
          ones = n % 10;
        return (
          <g key={row} data-value={n}>
            <text
              x={label - 6}
              y={y + 5 * u + 8}
              textAnchor="end"
              className="fig-label"
              style={{ fontSize: 22 }}
            >
              {n}
            </text>
            {Array.from({ length: tens }, (_, i) => (
              <g key={`t${i}`} data-unit="ten">
                <rect
                  x={tensX + i * rodStep}
                  y={y}
                  width={u}
                  height={10 * u}
                  rx={1.5}
                  className="base-block"
                />
                {Array.from({ length: 9 }, (_, j) => (
                  <line
                    key={j}
                    x1={tensX + i * rodStep}
                    x2={tensX + i * rodStep + u}
                    y1={y + (j + 1) * u}
                    y2={y + (j + 1) * u}
                    className="base-cell"
                  />
                ))}
              </g>
            ))}
            {Array.from({ length: ones }, (_, i) => (
              <rect
                key={`o${i}`}
                data-unit="one"
                x={onesX + (i % 5) * rodStep}
                y={y + 10 * u - (Math.floor(i / 5) + 1) * rodStep + 4}
                width={u}
                height={u}
                rx={1.5}
                className="base-block"
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export function ComparisonFigure({ figure }: { figure: ComparisonFigureData }) {
  return figure.kind === "counter-rows" ? (
    <CounterRows figure={figure} />
  ) : (
    <BaseTenPair figure={figure} />
  );
}
