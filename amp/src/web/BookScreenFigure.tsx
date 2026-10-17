import { AlgebraDiagramFigure } from "../publishing/AlgebraDiagramFigure.js";
import { BookArrayDrawing } from "./BookArrayDrawing.js";
import { BookIntegerLineDrawing } from "./BookIntegerLineDrawing.js";
import { exactGroupCount, completeGroup } from "../publishing/validate.js";
import { useId } from "react";
import type {
  Diagram,
  Rational,
} from "../../books/fraction-field-guide/schema.js";
const value = ([n, d]: Rational) => n / d;
const label = ([n, d]: Rational) => (d === 1 ? String(n) : `${n}/${d}`);
const ink = "#18594f",
  green = "#8abbb0",
  gold = "#e2b662";
/** Screen diagrams keep captions and unit labels in HTML so they do not shrink
 * with an SVG viewBox. Mathematical coordinates remain derived from quantities. */
export function BookScreenFigure({ diagram: d }: { diagram: Diagram }) {
  const pattern = `reader-${useId().replace(/[^a-z0-9]/gi, "")}`;
  if (
    d.kind === "balance" ||
    d.kind === "coordinate-plot" ||
    d.kind === "value-table"
  )
    return <AlgebraDiagramFigure diagram={d} screen />;
  const defs = (id = pattern) => (
    <defs>
      <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse">
        <rect width="7" height="7" fill="#e3f0e9" />
        <path
          d="M-2,2 L2,-2 M0,7 L7,0 M5,9 L9,5"
          stroke="#398777"
          strokeWidth="1"
        />
      </pattern>
    </defs>
  );
  let drawing;
  if (d.kind === "array") {
    drawing = <BookArrayDrawing diagram={d} />;
  } else if (d.kind === "strips") {
    const max = Math.max(...d.rows.map((row) => row.wholes ?? 1));
    drawing = (
      <>
        <p className="model-unit">{d.wholeLabel} · each outlined whole is 1</p>
        {d.rows.map((row, index) => (
          <div className="screen-strip" key={index}>
            <p>{row.label}</p>
            <svg viewBox="0 0 320 42" aria-hidden="true">
              {defs(`${pattern}-${index}`)}
              {Array.from({ length: row.parts * (row.wholes ?? 1) }, (_, j) => (
                <rect
                  key={j}
                  x={10 + (j * 300) / max / row.parts}
                  y="4"
                  width={300 / max / row.parts}
                  height="32"
                  fill={j < row.shaded ? `url(#${pattern}-${index})` : "#fff"}
                  stroke={ink}
                  strokeWidth=".8"
                />
              ))}
              {Array.from({ length: row.wholes ?? 1 }, (_, j) => (
                <rect
                  key={j}
                  x={10 + (j * 300) / max}
                  y="4"
                  width={300 / max}
                  height="32"
                  fill="none"
                  stroke={ink}
                  strokeWidth="2"
                />
              ))}
            </svg>
          </div>
        ))}
      </>
    );
  } else if (
    d.kind === "number-line" &&
    (value(d.max) - value(d.min) > 12 ||
      (d.jumps?.length ?? 0) > 1 ||
      d.integerLabelInterval !== undefined)
  ) {
    drawing = <BookIntegerLineDrawing diagram={d} />;
  } else if (d.kind === "number-line") {
    const min = value(d.min),
      max = value(d.max),
      x = (n: number) => 24 + ((n - min) / (max - min)) * 272;
    const ticks = Math.round((max - min) * d.divisionsPerUnit);
    const marks = [
      ...d.marks.map((mark) => ({
        at: value(mark.at),
        text: mark.label,
        point: true,
      })),
      ...Array.from(
        { length: Math.floor(max) - Math.ceil(min) + 1 },
        (_, i) => Math.ceil(min) + i,
      )
        .filter((n) => !d.marks.some((mark) => value(mark.at) === n))
        .map((n) => ({ at: n, text: String(n), point: false })),
    ].sort((a, b) => a.at - b.at);
    const ends = [-Infinity, -Infinity];
    const positioned = marks.map((mark) => {
      const width = Math.max(12, mark.text.length * 7),
        left = x(mark.at) - width / 2;
      const row = left > ends[0] + 5 ? 0 : 1;
      ends[row] = x(mark.at) + width / 2;
      return { ...mark, row };
    });
    drawing = (
      <>
        <p className="model-unit">{d.wholeLabel}</p>
        <svg viewBox="0 0 320 120" aria-hidden="true">
          <line x1="24" y1="54" x2="296" y2="54" stroke={ink} strokeWidth="2" />
          {Array.from({ length: ticks + 1 }, (_, i) => (
            <line
              key={i}
              x1={x(min + i / d.divisionsPerUnit)}
              x2={x(min + i / d.divisionsPerUnit)}
              y1="49"
              y2="61"
              stroke={ink}
            />
          ))}
          {positioned.map((mark, i) => (
            <g key={i}>
              {mark.point && (
                <circle cx={x(mark.at)} cy="54" r="4" fill="#ac671a" />
              )}
              <text x={x(mark.at)} y={79 + mark.row * 20} textAnchor="middle">
                {mark.text}
              </text>
            </g>
          ))}
          {d.jumps?.map((jump, i) => (
            <g key={i}>
              <path
                d={`M${x(value(jump.from))},45 Q${(x(value(jump.from)) + x(value(jump.to))) / 2},${5 + i * 5} ${x(value(jump.to))},45`}
                fill="none"
                stroke={ink}
                strokeWidth="2"
              />
              <text
                x={(x(value(jump.from)) + x(value(jump.to))) / 2}
                y="15"
                textAnchor="middle"
              >
                {jump.label}
              </text>
            </g>
          ))}
        </svg>
      </>
    );
  } else if (d.kind === "area") {
    drawing = (
      <>
        <p className="model-unit">{d.wholeLabel} · entire rectangle = 1</p>
        <svg viewBox="0 0 320 190" aria-hidden="true">
          {defs()}
          {Array.from({ length: d.rows * d.columns }, (_, i) => {
            const c = i % d.columns,
              r = Math.floor(i / d.columns),
              a = c < d.shadedColumns,
              b = r < d.shadedRows;
            return (
              <g key={i}>
                <rect
                  x={20 + (c * 280) / d.columns}
                  y={10 + (r * 160) / d.rows}
                  width={280 / d.columns}
                  height={160 / d.rows}
                  fill={a ? `url(#${pattern})` : b ? "#fae2b9" : "white"}
                  stroke={ink}
                />
                {a && b && (
                  <circle
                    cx={20 + ((c + 0.5) * 280) / d.columns}
                    cy={10 + ((r + 0.5) * 160) / d.rows}
                    r="5"
                    fill="#a86818"
                  />
                )}
              </g>
            );
          })}
        </svg>
        <p className="model-key">Hatching: columns · gold: rows · dots: both</p>
      </>
    );
  } else if (d.kind === "groups") {
    const total = value(d.total),
      size = value(d.groupSize),
      cells = Math.round(total * d.unitDivisions),
      groups = exactGroupCount(d.total, d.groupSize),
      x = (n: number) => 10 + (n / total) * 300;
    drawing = (
      <>
        <p className="model-unit">
          {d.wholeLabel} · group size {label(d.groupSize)}
        </p>
        <svg viewBox="0 0 320 110" aria-hidden="true">
          {defs()}
          {Array.from({ length: cells }, (_, i) => (
            <rect
              key={i}
              x={10 + (i * 300) / cells}
              y="10"
              width={300 / cells}
              height="32"
              fill={`url(#${pattern})`}
              stroke={ink}
              strokeWidth=".8"
            />
          ))}
          {Array.from({ length: groups }, (_, i) => {
            const a = x(i * size),
              b = x(Math.min((i + 1) * size, total));
            return (
              <g key={i}>
                <path
                  d={`M${a + 2},52 v7 H${b - 2} v-7`}
                  fill="none"
                  stroke={ink}
                  strokeWidth="2"
                />
                <text
                  x={
                    d.unitDivisions === 1 &&
                    !completeGroup(d.total, d.groupSize, i)
                      ? b
                      : (a + b) / 2
                  }
                  y={
                    d.unitDivisions === 1 &&
                    !completeGroup(d.total, d.groupSize, i)
                      ? 103
                      : 80
                  }
                  textAnchor={
                    d.unitDivisions === 1 &&
                    !completeGroup(d.total, d.groupSize, i)
                      ? "end"
                      : "middle"
                  }
                >
                  {completeGroup(d.total, d.groupSize, i)
                    ? String(i + 1)
                    : d.unitDivisions === 1
                      ? `${total - i * size} left`
                      : "part"}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="model-key">
          Total: {label(d.total)} ·{" "}
          {d.unitDivisions === 1
            ? "each cell is one whole unit"
            : `each small division is 1/${d.unitDivisions}`}
        </p>
      </>
    );
  } else {
    const max = value(d.pairs.at(-1)!.top),
      x = (n: number) => 24 + (n / max) * 272;
    drawing = (
      <>
        <p className="model-unit">{d.topLabel}</p>
        <svg viewBox="0 0 320 150" aria-hidden="true">
          <line x1="24" x2="296" y1="35" y2="35" stroke={ink} />
          <line x1="24" x2="296" y1="115" y2="115" stroke={ink} />
          {d.pairs.map((pair, i) => (
            <g key={i}>
              <line
                x1={x(value(pair.top))}
                x2={x(value(pair.top))}
                y1="30"
                y2="120"
                stroke={green}
                strokeDasharray="3 3"
              />
              <circle cx={x(value(pair.top))} cy="35" r="3" fill={ink} />
              <circle cx={x(value(pair.top))} cy="115" r="3" fill={gold} />
              <text x={x(value(pair.top))} y="20" textAnchor="middle">
                {label(pair.top)}
              </text>
              <text x={x(value(pair.top))} y="140" textAnchor="middle">
                {label(pair.bottom)}
              </text>
            </g>
          ))}
        </svg>
        <p className="model-unit">{d.bottomLabel}</p>
      </>
    );
  }
  return (
    <figure className="book-screen-figure" role="img" aria-label={d.alt}>
      {drawing}
      <figcaption>{d.caption}</figcaption>
    </figure>
  );
}
