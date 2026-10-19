import type { AttributeFigure as Data } from "../math/attribute-models";

const ink = "var(--color-figure-ink)",
  fill = "var(--color-figure-accent-fill)",
  accent = "var(--color-figure-accent)",
  gold = "var(--color-figure-gold-fill)",
  empty = "var(--color-figure-empty)",
  water = "var(--color-figure-accent-fill-strong)";
const label = (size: number, weight = 700) => ({
  fontSize: size,
  fontWeight: weight,
});

type Rods = Extract<Data, { kind: "length-rods" }>;
export function RodsFigure({ figure }: { figure: Rods }) {
  const unit = 290 / 14,
    x0 = 50;
  const description = `${figure.rods.length} strips. ${figure.rods
    .map(
      (r) =>
        `Strip ${r.label} starts ${r.start === 0 ? "at the left line" : `${r.start} units right of the left line`} and is ${r.length} units long`,
    )
    .join(". ")}.`;
  return (
    <svg
      data-kind={figure.kind}
      className="figure attribute-figure"
      viewBox={`0 0 360 ${30 + figure.rods.length * 54}`}
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      <line
        x1={x0}
        x2={x0}
        y1="8"
        y2={22 + figure.rods.length * 54}
        stroke="var(--color-figure-axis)"
        strokeDasharray="5 4"
      />
      {figure.rods.map((rod, i) => (
        <g key={rod.label} data-rod={rod.label}>
          <text
            x="22"
            y={44 + i * 54}
            textAnchor="middle"
            style={label(22)}
            fill={ink}
          >
            {rod.label}
          </text>
          <rect
            x={x0 + rod.start * unit}
            y={22 + i * 54}
            width={rod.length * unit}
            height="30"
            rx="6"
            fill={i ? gold : fill}
            stroke={ink}
            strokeWidth="2.5"
          />
        </g>
      ))}
    </svg>
  );
}

type Units = Extract<Data, { kind: "unit-measure" }>;
/** One equal unit drawn at `x`, one unit long. Overlapping units are
 * staggered vertically so the overlap stays visible. */
function UnitShape({
  kind,
  x,
  y,
  u,
}: {
  kind: Units["unit"];
  x: number;
  y: number;
  u: number;
}) {
  if (kind === "cube")
    return (
      <rect
        x={x}
        y={y}
        width={u}
        height={u * 0.8}
        fill={fill}
        stroke={ink}
        strokeWidth="1.5"
      />
    );
  const h = u * 0.42;
  return (
    <g>
      <rect
        x={x + 1}
        y={y}
        width={u - 2}
        height={h}
        rx={h / 2}
        fill="none"
        stroke={accent}
        strokeWidth="2.5"
      />
      <rect
        x={x + u * 0.22}
        y={y + h * 0.28}
        width={u * 0.56}
        height={h * 0.44}
        rx={h * 0.22}
        fill="none"
        stroke={accent}
        strokeWidth="2"
      />
    </g>
  );
}
export function UnitMeasureFigure({ figure }: { figure: Units }) {
  const longest = Math.max(
    ...figure.panels.map((p) =>
      Math.max(p.length, (p.placements.at(-1) ?? 0) + 1),
    ),
  );
  const u = Math.min(30, 280 / longest),
    x0 = 52,
    panelHeight = 30 + u * 1.3;
  const name = figure.unit === "cube" ? "cubes" : "paper clips";
  const description = figure.panels
    .map(
      (p) =>
        `${p.label ? `Picture ${p.label}: ` : ""}an object ${p.length} units long with ${p.placements.length} ${name} below it, left ends at ${p.placements.join(", ")} units from the object's left end`,
    )
    .join(". ");
  return (
    <svg
      data-kind={figure.kind}
      className="figure attribute-figure"
      viewBox={`0 0 360 ${12 + figure.panels.length * panelHeight}`}
      role="img"
      aria-label={`${description}.`}
    >
      <title>{description}</title>
      {figure.panels.map((panel, i) => {
        const y = 8 + i * panelHeight;
        return (
          <g key={i} data-panel={panel.label ?? i}>
            {panel.label && (
              <text
                x="22"
                y={y + 26}
                textAnchor="middle"
                style={label(22)}
                fill={ink}
              >
                {panel.label}
              </text>
            )}
            <rect
              x={x0}
              y={y + 4}
              width={panel.length * u}
              height="16"
              rx="8"
              fill={gold}
              stroke={ink}
              strokeWidth="2"
            />
            {panel.placements.map((at, k) => {
              const staggered =
                k > 0 && at - panel.placements[k - 1]! < 1 && k % 2 === 1;
              return (
                <UnitShape
                  key={k}
                  kind={figure.unit}
                  x={x0 + at * u}
                  y={y + 24 + (staggered ? u * 0.3 : 0)}
                  u={u}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

type Balance = Extract<Data, { kind: "balance" }>;
type Item = Extract<Balance["left"], { shape: string }>;
function Thing({ item, cx, base }: { item: Item; cx: number; base: number }) {
  const s = 18 + item.size * 9;
  const body =
    item.shape === "box" ? (
      <rect
        x={cx - s / 2}
        y={base - s}
        width={s}
        height={s}
        rx="3"
        fill={gold}
        stroke={ink}
        strokeWidth="2"
      />
    ) : item.shape === "ball" ? (
      <circle
        cx={cx}
        cy={base - s / 2}
        r={s / 2}
        fill={fill}
        stroke={ink}
        strokeWidth="2"
      />
    ) : (
      <path
        d={`M${cx - s / 2} ${base} Q${cx - s / 2} ${base - s * 0.9} ${cx - s * 0.18} ${base - s} L${cx + s * 0.18} ${base - s} Q${cx + s / 2} ${base - s * 0.9} ${cx + s / 2} ${base} Z`}
        fill={empty}
        stroke={ink}
        strokeWidth="2"
      />
    );
  return (
    <g>
      {body}
      {item.label && (
        <text
          x={cx}
          y={base - s - 8}
          textAnchor="middle"
          style={label(20)}
          fill={ink}
        >
          {item.label}
        </text>
      )}
    </g>
  );
}
/** Beam geometry shared by the figure and the lesson animation. */
export function beamEnds(tilt: Balance["tilt"]) {
  const angle = tilt === "level" ? 0 : tilt === "left" ? -12 : 12;
  const rad = (angle * Math.PI) / 180,
    half = 120;
  return {
    angle,
    left: { x: 180 - half * Math.cos(rad), y: 110 - half * Math.sin(rad) },
    right: { x: 180 + half * Math.cos(rad), y: 110 + half * Math.sin(rad) },
  };
}
export function BalanceScale({
  figure,
  tilt = figure.tilt,
}: {
  figure: Balance;
  tilt?: Balance["tilt"];
}) {
  const ends = beamEnds(tilt);
  const pan = (x: number, y: number) => {
    const base = y + 46;
    return {
      base,
      d: `M${x - 44} ${base} Q${x} ${base + 14} ${x + 44} ${base} Z`,
    };
  };
  const leftPan = pan(ends.left.x, ends.left.y),
    rightPan = pan(ends.right.x, ends.right.y);
  return (
    <>
      <path
        d="M180 112 L156 198 H204 Z"
        fill={empty}
        stroke={ink}
        strokeWidth="2.5"
      />
      <line
        className="balance-beam"
        x1={ends.left.x}
        y1={ends.left.y}
        x2={ends.right.x}
        y2={ends.right.y}
        stroke={ink}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="180" cy="110" r="6" fill={ink} />
      {[ends.left, ends.right].map((end, i) => (
        <g key={i}>
          <line
            x1={end.x}
            y1={end.y}
            x2={end.x - 40}
            y2={end.y + 46}
            stroke={ink}
          />
          <line
            x1={end.x}
            y1={end.y}
            x2={end.x + 40}
            y2={end.y + 46}
            stroke={ink}
          />
          <path
            d={(i ? rightPan : leftPan).d}
            fill={empty}
            stroke={ink}
            strokeWidth="2.5"
          />
        </g>
      ))}
      <Thing item={figure.left} cx={ends.left.x} base={leftPan.base} />
      {"grams" in figure.right ? (
        <g>
          {figure.right.grams.map((g, i, all) => {
            const w = 30,
              gap = 2,
              total = all.length * w + (all.length - 1) * gap;
            const x = ends.right.x - total / 2 + i * (w + gap);
            const h = 18 + Math.min(16, Math.log10(g) * 6);
            return (
              <g key={i} data-grams={g}>
                <rect
                  x={x}
                  y={rightPan.base - h}
                  width={w}
                  height={h}
                  rx="3"
                  fill={gold}
                  stroke={ink}
                  strokeWidth="1.5"
                />
                <text
                  x={x + w / 2}
                  y={rightPan.base - h - 6}
                  textAnchor="middle"
                  style={label(11, 600)}
                  fill={ink}
                >
                  {g} g
                </text>
              </g>
            );
          })}
        </g>
      ) : (
        <Thing item={figure.right} cx={ends.right.x} base={rightPan.base} />
      )}
    </>
  );
}
function describeBalance(f: Balance) {
  const side = (item: Balance["right"]) =>
    "grams" in item
      ? `standard masses of ${item.grams.map((g) => `${g} grams`).join(", ")}`
      : `${item.label ? `${item.label}, ` : ""}a ${["small", "medium", "large"][item.size - 1]} ${item.shape}`;
  return `A balance. Left pan: ${side(f.left)}. Right pan: ${side(f.right)}. The beam ${f.tilt === "level" ? "is level" : `is lower on the ${f.tilt}`}.`;
}


export function Jars({
  eighths,
  poured = true,
}: {
  eighths: number;
  poured?: boolean;
}) {
  const a = { x: 50, y: 30, w: 70, h: 150 },
    b = { x: 190, y: 90, w: 130, h: 90 };
  const level = Math.min(8, eighths) / 8;
  return (
    <>
      <rect
        x={a.x}
        y={a.y}
        width={a.w}
        height={a.h}
        rx="8"
        fill={poured ? empty : water}
        stroke={ink}
        strokeWidth="2.5"
      />
      <rect
        x={b.x}
        y={b.y + b.h * (1 - level)}
        width={b.w}
        height={b.h * level}
        fill={water}
        className="animation-move"
        style={rise(poured)}
      />
      <path
        d={`M${b.x} ${b.y} V${b.y + b.h} H${b.x + b.w} V${b.y}`}
        fill="none"
        stroke={ink}
        strokeWidth="2.5"
      />
      {poured && eighths > 8 && (
        <g fill={water} stroke={accent}>
          <path d={`M${b.x + b.w} ${b.y} q10 6 8 20 q-4 8 -8 0 Z`} />
          <ellipse cx={b.x + b.w + 14} cy={b.y + b.h + 4} rx="22" ry="5" />
          <path d={`M${b.x} ${b.y} q-10 6 -8 20 q4 8 8 0 Z`} />
        </g>
      )}
      <text
        x={a.x + a.w / 2}
        y="206"
        textAnchor="middle"
        style={label(22)}
        fill={ink}
      >
        A
      </text>
      <text
        x={b.x + b.w / 2}
        y="206"
        textAnchor="middle"
        style={label(22)}
        fill={ink}
      >
        B
      </text>
    </>
  );
}

type Liquid = Extract<Data, { kind: "liquid-scale" }>;
const rise = (shown: boolean) => ({
  transform: `scaleY(${shown ? 1 : 0})`,
  transformBox: "fill-box" as const,
  transformOrigin: "bottom",
});
export function LiquidScale({
  figure,
  filled = true,
}: {
  figure: Liquid;
  filled?: boolean;
}) {
  const level = figure.level;
  const x = 120,
    w = 120,
    top = 18,
    h = 180;
  const ticks = figure.max / figure.step;
  const y = (liters: number) => top + h - (liters / figure.max) * h;
  return (
    <>
      <rect
        x={x}
        y={y(level)}
        width={w}
        height={(level / figure.max) * h}
        fill={water}
        className="animation-move"
        style={rise(filled)}
      />
      <path
        d={`M${x} ${top - 6} V${top + h} H${x + w} V${top - 6}`}
        fill="none"
        stroke={ink}
        strokeWidth="3"
      />
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const major = i % figure.labelEvery === 0;
        const ty = y(i * figure.step);
        return (
          <g key={i}>
            <line
              x1={x}
              x2={x + (major ? 26 : 14)}
              y1={ty}
              y2={ty}
              stroke={ink}
              strokeWidth={major ? 2.5 : 1.5}
            />
            {major && (
              <text
                x={x - 10}
                y={ty + 6}
                textAnchor="end"
                style={label(17, 500)}
                fill={ink}
              >
                {i * figure.step} L
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

export function AttributeFigure({ figure }: { figure: Data }) {
  if (figure.kind === "length-rods") return <RodsFigure figure={figure} />;
  if (figure.kind === "unit-measure")
    return <UnitMeasureFigure figure={figure} />;
  if (figure.kind === "balance") {
    const description = describeBalance(figure);
    return (
      <svg
        data-kind={figure.kind}
        className="figure attribute-figure"
        viewBox="0 0 360 210"
        role="img"
        aria-label={description}
      >
        <title>{description}</title>
        <BalanceScale figure={figure} />
      </svg>
    );
  }
  if (figure.kind === "pour") {
    const description = `Jar A is tall and narrow; jar B is short and wide. All the water from full jar A was poured into empty jar B. ${figure.eighths < 8 ? `Jar B is filled ${figure.eighths} eighths of the way up.` : figure.eighths === 8 ? "Jar B is filled exactly to the top." : "Jar B is full and water has spilled over."}`;
    return (
      <svg
        data-kind={figure.kind}
        className="figure attribute-figure"
        viewBox="0 0 360 216"
        role="img"
        aria-label={description}
      >
        <title>{description}</title>
        <Jars eighths={figure.eighths} />
      </svg>
    );
  }
  const description = `A container with a scale from 0 to ${figure.max} liters. Tick marks every ${figure.step} ${figure.step === 1 ? "liter" : "liters"}, labeled every ${figure.labelEvery} ticks. The water reaches tick ${figure.level / figure.step} from the bottom.`;
  return (
    <svg
      data-kind={figure.kind}
      className="figure attribute-figure"
      viewBox="0 0 360 210"
      role="img"
      aria-label={description}
    >
      <title>{description}</title>
      <LiquidScale figure={figure} />
    </svg>
  );
}
