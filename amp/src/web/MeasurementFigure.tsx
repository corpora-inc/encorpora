import type { MeasurementFigure as Model } from "../math/measurement-models.js";
import { rectangleComparisonLayout } from "../math/measurement-models.js";

const ink = "#174a43",
  teal = "#20776d",
  coral = "#b3533b";
const text = { fontFamily: "Arial, sans-serif", fontSize: 24, fill: ink };
const measure = (m: { value: number; unit: string } | null) =>
  m ? `${m.value} ${m.unit}` : "?";
export function MeasurementFigure({ figure }: { figure: Model }) {
  if (figure.kind === "length-interval") {
    const count = figure.maxWhole * figure.denominator,
      x = (n: number) => 24 + (272 * n) / count;
    const a = x(figure.startNumerator),
      b = x(figure.endNumerator);
    const fraction = (n: number) =>
      n % figure.denominator === 0
        ? String(n / figure.denominator)
        : `${n}/${figure.denominator}`;
    const description = `Schematic centimeter ruler. Each small space is ${figure.denominator === 1 ? "1" : `1/${figure.denominator}`} cm. A is at ${fraction(figure.startNumerator)} cm and B at ${fraction(figure.endNumerator)} cm. A strip joins A to B. Not life-size.`;
    return (
      <svg
        className="figure measurement-figure"
        data-kind={figure.kind}
        viewBox="0 0 320 148"
        role="img"
        aria-label={description}
      >
        <rect
          x={a}
          y={34}
          width={b - a}
          height={18}
          rx={4}
          fill="#f7d8b2"
          stroke={coral}
          strokeWidth={2}
        />
        {[
          ["A", a],
          ["B", b],
        ].map(([label, position]) => (
          <g key={label}>
            <line
              x1={position}
              x2={position}
              y1={32}
              y2={91}
              stroke={coral}
              strokeDasharray="4 4"
            />
            <text style={text} x={position} y={24} textAnchor="middle">
              {label}
            </text>
          </g>
        ))}
        <line x1={24} x2={296} y1={83} y2={83} stroke={ink} strokeWidth={2} />
        {Array.from({ length: count + 1 }, (_, n) => (
          <g key={n}>
            <line
              data-measure-tick={n}
              x1={x(n)}
              x2={x(n)}
              y1={n % figure.denominator === 0 ? 73 : 78}
              y2={91}
              stroke={ink}
              strokeWidth={n % figure.denominator === 0 ? 2 : 1}
            />
            {n % figure.denominator === 0 &&
              (figure.maxWhole <= 6 || (n / figure.denominator) % 2 === 0) && (
                <text style={text} x={x(n)} y={113} textAnchor="middle">
                  {n / figure.denominator}
                </text>
              )}
          </g>
        ))}
        <text
          style={{ ...text, fontSize: 22 }}
          x={160}
          y={141}
          textAnchor="middle"
        >
          cm · not life-size
        </text>
      </svg>
    );
  }
  if (figure.kind === "measure-rectangle") {
    // Known sides are drawn to scale. An unknown side cannot be: the drawing
    // would reveal the answer, so that case uses a neutral 3:2 shape.
    const cm = (m: { value: number; unit: string }) =>
      m.value * ({ km: 100000, m: 100, cm: 1, mm: 0.1 }[m.unit] ?? 1);
    const known = figure.width && figure.height;
    const ratio = known
      ? Math.min(4, Math.max(1 / 4, cm(figure.width!) / cm(figure.height!)))
      : 1.5;
    const w = ratio >= 2.2 ? 220 : 100 * ratio,
      h = ratio >= 2.2 ? 220 / ratio : 100,
      x = 172 - w / 2,
      y = 16 + (100 - h) / 2;
    return (
      <svg
        className="figure measurement-figure"
        data-kind={figure.kind}
        viewBox="0 0 320 150"
        role="img"
        aria-label={`Rectangle${known ? "" : ", not to scale"}. Horizontal side: ${figure.width ? measure(figure.width) : "unknown"}. Perpendicular vertical side: ${figure.height ? measure(figure.height) : "unknown"}. Opposite sides have equal lengths.`}
      >
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={3}
          fill="#e3eee8"
          stroke={teal}
          strokeWidth={2.5}
        />
        <path
          d={`M${x} ${y + h - 12} h12 v12`}
          fill="none"
          stroke={teal}
          strokeWidth={1.5}
        />
        <text style={text} x={x + w / 2} y={y + h + 24} textAnchor="middle">
          {measure(figure.width)}
        </text>
        <text style={text} x={x - 10} y={y + h / 2 + 6} textAnchor="end">
          {measure(figure.height)}
        </text>
        {!known && (
          <text
            style={{ ...text, fontSize: 13, opacity: 0.6 }}
            x={316}
            y={146}
            textAnchor="end"
          >
            Not to scale
          </text>
        )}
      </svg>
    );
  }
  const layout = rectangleComparisonLayout(figure);
  return (
    <svg
      className="figure measurement-figure"
      data-kind={figure.kind}
      viewBox="0 0 320 170"
      role="img"
      aria-label={`Rectangles drawn at the same scale. ${figure.rectangles.map((r, i) => `${i === 0 ? "A" : "B"}: ${r.width} cm by ${r.height} cm`).join(". ")}. Not life-size.`}
    >
      {figure.rectangles.map((r, i) => {
        const l = layout[i]!;
        return (
          <g key={i}>
            <rect
              data-measure-rectangle={i}
              x={l.x}
              y={l.y}
              width={l.width}
              height={l.height}
              fill={i === 0 ? "#e3eee4" : "#fae5cd"}
              stroke={i === 0 ? teal : coral}
              strokeWidth={2}
            />
            <text
              style={text}
              x={l.x + l.width / 2}
              y={l.y - 9}
              textAnchor="middle"
            >
              {r.width}
            </text>
            <text
              style={text}
              x={l.x - 7}
              y={l.y + l.height / 2 + 8}
              textAnchor="end"
            >
              {r.height}
            </text>
            <text
              style={{ ...text, fontWeight: 700 }}
              x={i * 160 + 88}
              y={135}
              textAnchor="middle"
            >
              {i === 0 ? "A" : "B"}
            </text>
          </g>
        );
      })}
      <text
        style={{ ...text, fontSize: 22 }}
        x={160}
        y={163}
        textAnchor="middle"
      >
        cm · same unit scale
      </text>
    </svg>
  );
}
