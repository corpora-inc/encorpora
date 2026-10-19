import { shapeBox, shapeParts } from "../PartWholeFigure";
import type {
  AreaAnimation,
  CompareAnimation,
  PartitionAnimation,
} from "./model";

/** One whole, then its equal cuts, then the shaded count. */
export function PartitionStage({
  model,
  step,
}: {
  model: PartitionAnimation;
  step: number;
}) {
  const s = model.shape,
    { w, h } = shapeBox(s.shape);
  const x = (320 - w) / 2,
    y = (170 - h) / 2;
  const whole =
    s.shape === "circle" ? (
      <circle
        cx={x + w / 2}
        cy={y + h / 2}
        r={Math.min(w, h) / 2}
        className="animation-outline"
        strokeWidth="3"
      />
    ) : (
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        className="animation-outline"
        strokeWidth="3"
      />
    );
  return (
    <>
      {shapeParts(s, x, y, w, h).map((d, i) => (
        <path
          key={i}
          d={d}
          data-part={i}
          className={`animation-paint ${step === 2 && s.shaded.includes(i) ? "animation-shade" : "animation-empty"}`}
          style={{ strokeOpacity: step ? 1 : 0 }}
          strokeWidth="2"
        />
      ))}
      {whole}
      <text x="160" y="192" textAnchor="middle">
        {step === 0
          ? "one whole"
          : `${s.sizes.length} equal parts${step === 2 ? `, ${s.shaded.length} shaded` : ""}`}
      </text>
    </>
  );
}

/** Two bars of one whole length: cut each, then shade and compare lengths. */
export function CompareStage({
  model,
  step,
}: {
  model: CompareAnimation;
  step: number;
}) {
  const x0 = 70,
    width = 230,
    height = 40;
  return (
    <>
      {model.bars.map((bar, row) => {
        const y = 28 + row * 78,
          piece = width / bar.d,
          end = x0 + bar.n * piece;
        return (
          <g key={row} data-bar={row}>
            <text x="34" y={y + 15} textAnchor="middle">
              {bar.n}
            </text>
            <line
              x1="22"
              x2="46"
              y1={y + 20}
              y2={y + 20}
              className="animation-outline"
              strokeWidth="1.5"
            />
            <text x="34" y={y + 38} textAnchor="middle">
              {bar.d}
            </text>
            {Array.from({ length: bar.d }, (_, i) => (
              <rect
                key={i}
                x={x0 + i * piece}
                y={y}
                width={piece}
                height={height}
                className={`animation-paint ${step === 2 && i < bar.n ? "animation-shade" : "animation-empty"}`}
                style={{ strokeOpacity: step ? 1 : 0 }}
              />
            ))}
            <rect
              x={x0}
              y={y}
              width={width}
              height={height}
              className="animation-outline"
              strokeWidth="2.5"
            />
            <line
              x1={end}
              x2={end}
              y1="20"
              y2={28 + 78 + height + 8}
              className="animation-outline animation-fade"
              strokeDasharray="5 4"
              strokeWidth="2"
              style={{ opacity: step === 2 ? 1 : 0 }}
            />
          </g>
        );
      })}
    </>
  );
}

/** Unit squares, then equal-area regions, then the one shaded share. */
export function AreaStage({
  model,
  step,
}: {
  model: AreaAnimation;
  step: number;
}) {
  const { columns, rows, regions, shaded } = model.figure;
  const size = Math.min(280 / columns, 160 / rows),
    x0 = (320 - size * columns) / 2,
    y0 = (176 - size * rows) / 2;
  const at = (row: number, column: number) => regions[row * columns + column];
  const borders: string[] = [];
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++) {
      const x = x0 + column * size,
        y = y0 + row * size;
      if (column + 1 < columns && at(row, column) !== at(row, column + 1))
        borders.push(`M${x + size} ${y} V${y + size}`);
      if (row + 1 < rows && at(row, column) !== at(row + 1, column))
        borders.push(`M${x} ${y + size} H${x + size}`);
    }
  return (
    <>
      {regions.map((region, i) => (
        <rect
          key={i}
          data-region={region}
          x={x0 + (i % columns) * size}
          y={y0 + Math.floor(i / columns) * size}
          width={size}
          height={size}
          className={`animation-paint ${step === 2 && shaded.includes(region) ? "animation-shade" : "animation-empty"}`}
          strokeWidth="1"
        />
      ))}
      <path
        d={borders.join(" ")}
        className="animation-outline animation-fade"
        strokeWidth="3.5"
        strokeLinecap="square"
        style={{ opacity: step ? 1 : 0 }}
      />
      <rect
        x={x0}
        y={y0}
        width={columns * size}
        height={rows * size}
        className="animation-outline"
        strokeWidth="3.5"
      />
    </>
  );
}
