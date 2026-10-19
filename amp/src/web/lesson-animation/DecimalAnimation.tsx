import { chartColumns, gridCells } from "../DecimalFigure";
import {
  firstDifference,
  type DecimalAlignAnimation,
  type DecimalFillAnimation,
} from "./model";

/** An empty hundredths grid, then whole tenth columns, then single squares. */
export function DecimalFillStage({
  model,
  step,
}: {
  model: DecimalFillAnimation;
  step: number;
}) {
  const size = 170,
    x = (320 - size) / 2,
    y = 6;
  const tenths = Math.floor(model.shaded / 10) * 10;
  const filled = step === 0 ? 0 : step === 1 ? tenths : model.shaded;
  return (
    <>
      {gridCells("hundredths", x, y, size).map((c, i) => (
        <rect
          key={i}
          data-cell={i}
          x={c.x}
          y={c.y}
          width={c.w}
          height={c.h}
          className={`animation-paint ${i < filled ? "animation-shade" : "animation-empty"}`}
          strokeWidth="0.75"
        />
      ))}
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        className="animation-outline"
        strokeWidth="2.5"
      />
      <text x="160" y="194" textAnchor="middle">
        {filled} of 100 squares
      </text>
    </>
  );
}

/** Digits in a place-value chart; padded zeros appear, then the deciding
 * column is marked. */
export function DecimalAlignStage({
  model,
  step,
}: {
  model: DecimalAlignAnimation;
  step: number;
}) {
  const f = model.figure;
  const { xs, pointX, left, width, dividers, bounds } = chartColumns(f.places);
  const decide = firstDifference(f);
  const units = ["1", "0.1", "0.01", "0.001"];
  return (
    <svg x="0" y="12" width="320" height="176" viewBox="0 0 360 160">
      <rect
        x={bounds[decide]!.x}
        y="41"
        width={bounds[decide]!.width}
        height="112"
        className="animation-shade animation-fade"
        style={{ opacity: step === 2 ? 0.3 : 0 }}
      />
      <rect
        x={left}
        y="6"
        width={width}
        height="148"
        rx="8"
        className="animation-outline"
        strokeWidth="2"
      />
      <line
        x1={left}
        x2={left + width}
        y1="40"
        y2="40"
        className="animation-outline"
      />
      {dividers.map((d, i) => (
        <line
          key={i}
          x1={d}
          x2={d}
          y1="6"
          y2="154"
          className="animation-grid"
        />
      ))}
      {xs.map((cx, i) => (
        <text
          key={i}
          x={cx}
          y="30"
          textAnchor="middle"
          style={{ fontSize: 16 }}
        >
          {units[i]}
        </text>
      ))}
      {f.rows.map((row, r) => {
        const y = 84 + r * 52;
        const digits = [
          String(row.ones),
          ...row.decimals.padEnd(f.places, "0"),
        ];
        return (
          <g key={r}>
            {digits.map((d, i) => {
              const padded = i > row.decimals.length;
              return (
                <text
                  key={i}
                  x={xs[i]}
                  y={y}
                  textAnchor="middle"
                  className={padded ? "animation-fade" : undefined}
                  style={{
                    fontSize: 30,
                    fontWeight: step === 2 && i === decide ? 700 : 400,
                    opacity: padded && step === 0 ? 0 : 1,
                  }}
                >
                  {d}
                </text>
              );
            })}
            <circle
              cx={pointX}
              cy={y - 2}
              r="3.5"
              className="animation-shade"
            />
          </g>
        );
      })}
    </svg>
  );
}
