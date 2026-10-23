import React from "react";
import { gridCells } from "../web/DecimalFigure";

const ink = "var(--color-figure-ink)",
  shade = "var(--color-figure-accent)",
  empty = "var(--color-figure-empty)",
  grid = "var(--color-figure-grid)",
  warm = "var(--color-figure-warm)",
  warmFill = "var(--color-figure-warm-fill)",
  accentFill = "var(--color-figure-accent-fill)";

function Text({
  x,
  y,
  children,
  size = 20,
  anchor = "middle",
  fill = ink,
  weight,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  size?: number;
  anchor?: "start" | "middle" | "end";
  fill?: string;
  weight?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      // Inline, so the global svg text color does not override the role.
      style={{ fill, fontSize: size, fontWeight: weight }}
    >
      {children}
    </text>
  );
}

/** 0.47 on a hundredths grid: 4 full columns are tenths, 7 squares hundredths. */
function TenthsHundredths() {
  const size = 200,
    x = 30,
    y = 14;
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 600 240"
      role="img"
      aria-label="A square that is one whole, cut into 100 equal small squares. Four full columns are shaded: 4 tenths, 0.4. Seven more squares in the next column are shaded: 7 hundredths, 0.07. Together 0.47, or 47 hundredths."
    >
      {gridCells("hundredths", x, y, size).map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h}
          fill={i < 40 ? shade : i < 47 ? warm : empty}
          stroke={grid}
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={i}
          x1={x + (i + 1) * 20}
          x2={x + (i + 1) * 20}
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
        height={size}
        fill="none"
        stroke={ink}
        strokeWidth="3"
      />
      <rect x="270" y="27" width="22" height="22" fill={shade} />
      <Text x={302} y={44} anchor="start" size={22}>
        4 columns:
      </Text>
      <Text x={302} y={70} anchor="start" size={22}>
        4 tenths = 0.4
      </Text>
      <rect x="270" y="87" width="22" height="22" fill={warm} />
      <Text x={302} y={104} anchor="start" size={22}>
        7 squares:
      </Text>
      <Text x={302} y={130} anchor="start" size={22}>
        7 hundredths = 0.07
      </Text>
      <line x1="270" x2="580" y1="150" y2="150" stroke={grid} strokeWidth="2" />
      <Text x={270} y={184} anchor="start" size={26} weight={700}>
        0.4 + 0.07 = 0.47
      </Text>
      <Text x={270} y={214} anchor="start" size={22}>
        47 of 100 squares: 47/100
      </Text>
    </svg>
  );
}

/** 0.5 and 0.45 in a place-value chart; the filled zero and deciding column. */
function CompareChart() {
  const cols = [
    { head: "ones", unit: "1", x: 170 },
    { head: "tenths", unit: "0.1", x: 300 },
    { head: "hundredths", unit: "0.01", x: 430 },
  ];
  const rows = [
    { digits: ["0", "5", "0"], padded: 2, y: 132 },
    { digits: ["0", "4", "5"], padded: -1, y: 194 },
  ];
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 600 240"
      role="img"
      aria-label="Place-value chart with columns ones, tenths and hundredths. 0.5 is written with an added 0 in the hundredths as 0.50, above 0.45. The tenths column is highlighted: 5 tenths is more than 4 tenths, so 0.5 is greater than 0.45."
    >
      <rect
        x="235"
        y="76"
        width="130"
        height="152"
        fill={accentFill}
        stroke={shade}
        strokeWidth="2"
      />
      <rect
        x="105"
        y="12"
        width="390"
        height="216"
        rx="10"
        fill="none"
        stroke={ink}
        strokeWidth="2"
      />
      <line x1="105" x2="495" y1="76" y2="76" stroke={ink} strokeWidth="1.5" />
      {[235, 365].map((x) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1="12"
          y2="228"
          stroke={grid}
          strokeWidth="1.5"
        />
      ))}
      {cols.map((c) => (
        <g key={c.head}>
          <Text x={c.x} y={40} size={22}>
            {c.head}
          </Text>
          <Text x={c.x} y={66} size={19}>
            {c.unit}
          </Text>
        </g>
      ))}
      {rows.map((row) => (
        <g key={row.y}>
          {row.digits.map((d, i) => (
            <Text
              key={i}
              x={cols[i]!.x}
              y={row.y}
              size={34}
              fill={i === row.padded ? warm : ink}
              weight={i === 1 ? 700 : 400}
            >
              {d}
            </Text>
          ))}
          <circle cx="235" cy={row.y - 3} r="4" fill={ink} />
        </g>
      ))}
      <Text x={512} y={132} anchor="start" size={24}>
        0.5
      </Text>
      <Text x={512} y={194} anchor="start" size={24}>
        0.45
      </Text>
    </svg>
  );
}

/** 2.37 between 2.3 and 2.4: past the halfway point 2.35, so nearer 2.4. */
function RoundingLine() {
  const x = (i: number) => 60 + i * 48;
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 600 196"
      role="img"
      aria-label="Number line from 2.3 to 2.4 cut into 10 hundredths. The halfway point 2.35 is marked. A point at 2.37 is past halfway, so it rounds to 2.4."
    >
      <rect
        x={x(5)}
        y="70"
        width={x(10) - x(5)}
        height="36"
        fill={accentFill}
      />
      <line x1="40" x2="560" y1="106" y2="106" stroke={ink} strokeWidth="2" />
      {Array.from({ length: 11 }, (_, i) => (
        <line
          key={i}
          x1={x(i)}
          x2={x(i)}
          y1={i % 10 === 0 ? 90 : i === 5 ? 84 : 98}
          y2="114"
          stroke={ink}
          strokeWidth={i % 10 === 0 || i === 5 ? 2.5 : 1.5}
        />
      ))}
      <Text x={x(0)} y={142} size={22}>
        2.3
      </Text>
      <Text x={x(5)} y={142} size={20}>
        2.35
      </Text>
      <Text x={x(10)} y={142} size={22}>
        2.4
      </Text>
      <Text x={x(5)} y={172} size={19}>
        halfway
      </Text>
      <circle cx={x(7)} cy="106" r="7" fill={warm} />
      <Text x={x(7)} y={60} size={22} weight={700} fill={ink}>
        2.37
      </Text>
      <path
        d={`M ${x(7) + 14} 40 Q ${(x(7) + x(10)) / 2} 18 ${x(10) - 4} 76`}
        fill="none"
        stroke={warm}
        strokeWidth="2.5"
      />
      <path
        d={`M ${x(10) - 12} 66 L ${x(10) - 4} 78 L ${x(10) + 4} 66`}
        fill="none"
        stroke={warm}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The exact half-up interval for values rounding to 4.68 hundredths. */
function InverseRoundingLine() {
  const marks = [
    { x: 48, value: "4.67" },
    { x: 174, value: "4.675" },
    { x: 300, value: "4.68" },
    { x: 426, value: "4.685" },
    { x: 552, value: "4.69" },
  ];
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 600 182"
      role="img"
      aria-label="Number line from 4.67 to 4.69. The shaded interval for decimals rounding to 4.68 starts at 4.675 with a filled dot and ends at 4.685 with an open dot. Halfway rounds up."
    >
      <rect x="174" y="58" width="252" height="34" fill={accentFill} />
      <line x1="48" x2="552" y1="92" y2="92" stroke={ink} strokeWidth="2" />
      {marks.map((mark) => (
        <g key={mark.value}>
          <line
            x1={mark.x}
            x2={mark.x}
            y1="78"
            y2="105"
            stroke={ink}
            strokeWidth="2"
          />
          <Text x={mark.x} y={135} size={mark.value.length > 4 ? 17 : 19}>
            {mark.value}
          </Text>
        </g>
      ))}
      <circle cx="174" cy="92" r="7" fill={ink} />
      <circle
        cx="426"
        cy="92"
        r="7"
        fill={empty}
        stroke={ink}
        strokeWidth="2"
      />
      <Text x={174} y={49} size={17}>
        included
      </Text>
      <Text x={426} y={49} size={17}>
        excluded
      </Text>
    </svg>
  );
}

/** 12.5 + 3.75 with the points lined up and an added 0 in the hundredths. */
function AlignedSum() {
  const xs = [200, 250, 330, 380]; // tens, ones | tenths, hundredths
  const point = 290;
  const rows: { digits: (string | null)[]; padded?: number; y: number }[] = [
    { digits: ["1", "2", "5", "0"], padded: 3, y: 84 },
    { digits: [null, "3", "7", "5"], y: 136 },
    { digits: ["1", "6", "2", "5"], y: 204 },
  ];
  return (
    <svg
      className="lesson-illustration"
      viewBox="0 0 600 230"
      role="img"
      aria-label="12.5 plus 3.75 written in columns with the decimal points lined up. 12.5 is written 12.50 with an added zero in the hundredths. The sum is 16.25."
    >
      <rect x="305" y="50" width="100" height="168" fill={warmFill} />
      {["10", "1", "0.1", "0.01"].map((u, i) => (
        <Text key={u} x={xs[i]!} y={34} size={20}>
          {u}
        </Text>
      ))}
      {rows.map((row) => (
        <g key={row.y}>
          {row.digits.map((d, i) =>
            d === null ? null : (
              <Text
                key={i}
                x={xs[i]!}
                y={row.y}
                size={36}
                fill={i === row.padded ? warm : ink}
              >
                {d}
              </Text>
            ),
          )}
          <circle cx={point} cy={row.y - 3} r="4.5" fill={ink} />
        </g>
      ))}
      <Text x={150} y={136} size={36}>
        +
      </Text>
      <line
        x1="135"
        x2="410"
        y1="158"
        y2="158"
        stroke={ink}
        strokeWidth="2.5"
      />
      <line
        x1={point}
        x2={point}
        y1="48"
        y2="218"
        stroke={shade}
        strokeWidth="1.5"
        strokeDasharray="4 5"
      />
    </svg>
  );
}

export function DecimalIllustration({
  kind,
}: {
  kind:
    | "decimal-tenths-hundredths"
    | "decimal-compare-chart"
    | "decimal-rounding-line"
    | "inverse-decimal-rounding-line"
    | "decimal-aligned-sum";
}) {
  if (kind === "decimal-tenths-hundredths") return <TenthsHundredths />;
  if (kind === "decimal-compare-chart") return <CompareChart />;
  if (kind === "decimal-rounding-line") return <RoundingLine />;
  if (kind === "inverse-decimal-rounding-line") return <InverseRoundingLine />;
  return <AlignedSum />;
}
