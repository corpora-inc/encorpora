import type { DecimalFigure as Data } from "../math/decimal-models";
import { decimal } from "../math/decimal-models";

const ink = "var(--color-figure-ink)",
  shade = "var(--color-figure-accent)",
  empty = "var(--color-figure-empty)",
  grid = "var(--color-figure-grid)",
  warm = "var(--color-figure-warm)";

/** Cells of a one-whole grid, filled column by column from the left so full
 * columns read as tenths. */
export function gridCells(
  unit: "tenths" | "hundredths",
  x: number,
  y: number,
  size: number,
) {
  if (unit === "tenths")
    return Array.from({ length: 10 }, (_, i) => ({
      x: x + (i * size) / 10,
      y,
      w: size / 10,
      h: size,
    }));
  return Array.from({ length: 100 }, (_, i) => ({
    x: x + Math.floor(i / 10) * (size / 10),
    y: y + (i % 10) * (size / 10),
    w: size / 10,
    h: size / 10,
  }));
}

function Grid({ figure }: { figure: Extract<Data, { kind: "decimal-grid" }> }) {
  const tenths = figure.unit === "tenths";
  const size = tenths ? 300 : 200,
    x = (320 - size) / 2,
    y = 10,
    h = tenths ? 70 : 200;
  const description = tenths
    ? `A strip that is one whole, cut into 10 equal parts; ${figure.shaded} shaded.`
    : `A square that is one whole, cut into 10 columns of 10 equal small squares; ${figure.shaded} small squares shaded, filling columns from the left.`;
  return (
    <svg
      data-kind={figure.kind}
      className="figure decimal-figure"
      viewBox={`0 0 320 ${h + 20}`}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      {gridCells(figure.unit, x, y, size).map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width={c.w}
          height={tenths ? h : c.h}
          fill={i < figure.shaded ? shade : empty}
          stroke={tenths ? ink : grid}
          strokeWidth={tenths ? 2 : 1}
        />
      ))}
      {!tenths &&
        Array.from({ length: 9 }, (_, i) => (
          <line
            key={i}
            x1={x + ((i + 1) * size) / 10}
            x2={x + ((i + 1) * size) / 10}
            y1={y}
            y2={y + size}
            stroke={ink}
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />
        ))}
      <rect
        x={x}
        y={y}
        width={size}
        height={h}
        fill="none"
        stroke={ink}
        strokeWidth="3"
      />
    </svg>
  );
}

function Line({ figure }: { figure: Extract<Data, { kind: "decimal-line" }> }) {
  const x = (i: number) => 24 + i * 27.2;
  const places = figure.denominator === 10 ? 1 : 2;
  const left = decimal(figure.start, places),
    right = decimal(figure.start + 10, places);
  const description = `Number line from ${left} to ${right}, cut into 10 equal intervals. Point P is ${figure.point} intervals to the right of ${left}.`;
  return (
    <svg
      data-kind={figure.kind}
      className="figure decimal-figure"
      viewBox="0 0 320 130"
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      <line x1="14" x2="306" y1="80" y2="80" stroke={ink} strokeWidth="2" />
      {Array.from({ length: 11 }, (_, i) => (
        <line
          key={i}
          data-tick={i}
          x1={x(i)}
          x2={x(i)}
          y1={i % 10 === 0 ? 66 : i === 5 ? 70 : 73}
          y2="87"
          stroke={ink}
          strokeWidth={i % 10 === 0 ? 2.5 : 1.5}
        />
      ))}
      <text x={x(0)} y="112" textAnchor="middle" style={{ fontSize: 20 }}>
        {left}
      </text>
      <text x={x(10)} y="112" textAnchor="middle" style={{ fontSize: 20 }}>
        {right}
      </text>
      <line
        x1={x(figure.point)}
        x2={x(figure.point)}
        y1="40"
        y2="74"
        stroke={warm}
        strokeWidth="2"
      />
      <circle cx={x(figure.point)} cy="80" r="5.5" fill={warm} />
      <text
        x={x(figure.point)}
        y="32"
        textAnchor="middle"
        style={{ fontSize: 22, fontWeight: 700 }}
      >
        P
      </text>
    </svg>
  );
}

const UNITS = ["1", "0.1", "0.01", "0.001"];
/** Equal columns, one per place; the decimal point sits on the line between
 * the ones and the tenths. An unwritten place stays blank. */
export function chartColumns(places: number) {
  const width = places === 2 ? 300 : 340;
  const column = width / (places + 1);
  const left = (360 - width) / 2;
  const xs = Array.from(
    { length: places + 1 },
    (_, i) => left + column * (i + 0.5),
  );
  const dividers = Array.from(
    { length: places },
    (_, i) => left + column * (i + 1),
  );
  const bounds = xs.map((x) => ({ x: x - column / 2, width: column }));
  return { xs, pointX: left + column, left, width, dividers, bounds };
}
function Chart({
  figure,
}: {
  figure: Extract<Data, { kind: "place-value-chart" }>;
}) {
  const { xs, pointX, left, width, dividers } = chartColumns(figure.places);
  const description = `Place-value chart with columns ones, ${["tenths", "hundredths", "thousandths"].slice(0, figure.places).join(", ")}. ${figure.rows
    .map((r) => `${r.ones}.${r.decimals}`)
    .join(
      " and ",
    )} are written in it, digit by digit; unwritten places are blank.`;
  return (
    <svg
      data-kind={figure.kind}
      className="figure decimal-figure"
      viewBox="0 0 360 160"
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      <rect
        x={left}
        y="6"
        width={width}
        height="148"
        rx="8"
        fill={empty}
        stroke={ink}
        strokeWidth="2"
      />
      <line
        x1={left}
        x2={left + width}
        y1="40"
        y2="40"
        stroke={ink}
        strokeWidth="1.5"
      />
      {xs.map((cx, i) => (
        <text
          key={i}
          x={cx}
          y="30"
          textAnchor="middle"
          style={{ fontSize: 16 }}
        >
          {UNITS[i]}
        </text>
      ))}
      {dividers.map((x, i) => (
        <line
          key={i}
          x1={x}
          x2={x}
          y1="6"
          y2="154"
          stroke={grid}
          strokeWidth="1.5"
        />
      ))}
      {figure.rows.map((row, r) => {
        const y = 84 + r * 52;
        const digits = [String(row.ones), ...row.decimals.split("")];
        return (
          <g key={r} data-row={r}>
            {digits.map((d, i) => (
              <text
                key={i}
                x={xs[i]}
                y={y}
                textAnchor="middle"
                style={{ fontSize: 30 }}
              >
                {d}
              </text>
            ))}
            <circle cx={pointX} cy={y - 3} r="4.5" fill={ink} />
          </g>
        );
      })}
    </svg>
  );
}

export function DecimalFigure({ figure }: { figure: Data }) {
  if (figure.kind === "decimal-grid") return <Grid figure={figure} />;
  if (figure.kind === "decimal-line") return <Line figure={figure} />;
  return <Chart figure={figure} />;
}
