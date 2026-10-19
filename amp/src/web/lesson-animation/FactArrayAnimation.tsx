import type { AnimationModel } from "./model";

/** Staggered motion; transitions live in CSS so reduced motion removes them. */
const motion = (delay: number) => ({ transitionDelay: `${delay}ms` });

/** Rows of b dots appear one under another until there are a rows; then the
 * running total marks each row end. */
export function ArrayBuildStage({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "array-build" }>;
  step: number;
}) {
  const { rows: a, columns: b } = model;
  const p = Math.min(18, 230 / b, 184 / a),
    x0 = (262 - b * p) / 2,
    y0 = (200 - a * p) / 2;
  return (
    <>
      {Array.from({ length: a }, (_, r) => (
        <g
          key={r}
          data-row={r}
          className="animation-step"
          style={{
            ...motion(step >= 1 ? r * 90 : 0),
            transform: `translateY(${step >= 1 || r === 0 ? 0 : -r * p}px)`,
            opacity: step >= 1 || r === 0 ? 1 : 0,
          }}
        >
          {Array.from({ length: b }, (_, c) => (
            <circle
              key={c}
              data-dot={`${r}-${c}`}
              cx={x0 + (c + 0.5) * p}
              cy={y0 + (r + 0.5) * p}
              r={p * 0.32}
              className="animation-fill"
            />
          ))}
          <text
            data-row-total={b * (r + 1)}
            x={x0 + b * p + 10}
            y={y0 + (r + 0.5) * p + 5}
            className="animation-step"
            style={{
              ...motion(step === 2 ? r * 120 : 0),
              opacity: step === 2 ? 1 : 0,
              fontSize: Math.min(15, p * 0.9),
            }}
          >
            {b * (r + 1)}
          </text>
        </g>
      ))}
    </>
  );
}

/** The array turns a quarter turn about its centre (rows become columns),
 * then turns back with one row and one column outlined: the two divisions. */
export function ArrayTurnStage({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "array-turn" }>;
  step: number;
}) {
  const { rows: d, columns: q } = model;
  const p = Math.min(17, 180 / Math.max(d, q)),
    cx = 160,
    cy = 100;
  const x = (c: number) => cx + (c - (q - 1) / 2) * p,
    y = (r: number) => cy + (r - (d - 1) / 2) * p;
  return (
    <>
      <g
        data-turned={step === 1 || undefined}
        className="animation-move"
        style={{
          transform: `rotate(${step === 1 ? 90 : 0}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        {Array.from({ length: d * q }, (_, i) => (
          <circle
            key={i}
            data-dot={i}
            cx={x(i % q)}
            cy={y(Math.floor(i / q))}
            r={p * 0.32}
            data-first-row={Math.floor(i / q) === 0 || undefined}
            className="animation-fill"
            style={
              Math.floor(i / q) === 0
                ? { fill: "var(--color-figure-warm)" }
                : undefined
            }
          />
        ))}
      </g>
      <g className="animation-fade" style={{ opacity: step === 2 ? 1 : 0 }}>
        <rect
          data-outline="row"
          x={x(0) - p / 2}
          y={y(0) - p / 2}
          width={q * p}
          height={p}
          rx={p / 2}
          className="animation-outline"
          strokeWidth="2"
        />
        <rect
          data-outline="column"
          x={x(0) - p / 2 - 3}
          y={y(0) - p / 2 - 3}
          width={p + 6}
          height={d * p + 6}
          rx={p / 2 + 3}
          className="animation-outline"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <text x={x(q - 1) + p / 2 + 8} y={y(0) + 5}>
          {q}
        </text>
        <text
          x={x(0) - p / 2 - 10}
          y={y(d - 1) + p / 2 + 18}
          textAnchor="middle"
        >
          {d}
        </text>
      </g>
    </>
  );
}

const PITCH = 13,
  SLOT = 11,
  TRAY_TOP = 106;
type Layout = {
  groups: number;
  size: number;
  at: (i: number) => [number, number];
};
/** Where counter i sits when dealt (share) or filled (measure). */
function layout(n: number, k: number, mode: "share" | "measure"): Layout {
  return mode === "share"
    ? { groups: k, size: n / k, at: (i) => [i % k, Math.floor(i / k)] }
    : { groups: n / k, size: k, at: (i) => [Math.floor(i / k), i % k] };
}
function trayGeometry(groups: number, size: number) {
  const pitch = 320 / groups,
    width = Math.min(pitch - 6, 72),
    across = Math.max(1, Math.floor((width - 4) / SLOT)),
    height = Math.ceil(size / across) * SLOT + 6;
  const left = (g: number) => g * pitch + (pitch - width) / 2;
  const slot = (g: number, j: number) => ({
    x: left(g) + (width - across * SLOT) / 2 + ((j % across) + 0.5) * SLOT,
    y: TRAY_TOP + 3 + (Math.floor(j / across) + 0.5) * SLOT,
  });
  return { width, height, left, slot };
}

/** Counters leave the pile one round at a time into their groups; the last
 * step regroups the same counters by the other meaning of the division. */
export function DealStage({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "deal" }>;
  step: number;
}) {
  const { total: n, count: k, first } = model;
  const phases = [
    layout(n, k, first),
    layout(n, k, first === "share" ? "measure" : "share"),
  ];
  const geometry = phases.map((l) => trayGeometry(l.groups, l.size));
  const pileLeft = (320 - (10 * PITCH + 6)) / 2;
  const pile = (i: number) => ({
    x: pileLeft + PITCH / 2 + (i % 10) * PITCH + (i % 10 >= 5 ? 6 : 0),
    y: 8 + PITCH / 2 + Math.floor(i / 10) * PITCH,
  });
  const phase = step === 2 ? 1 : 0;
  return (
    <>
      {phases.map((l, which) => (
        <g
          key={which}
          data-trays={which}
          className="animation-fade"
          style={{ opacity: which === phase ? 1 : 0 }}
        >
          {Array.from({ length: l.groups }, (_, g) => (
            <rect
              key={g}
              x={geometry[which]!.left(g)}
              y={TRAY_TOP}
              width={geometry[which]!.width}
              height={geometry[which]!.height}
              rx={8}
              className="animation-empty"
              strokeDasharray={step === 0 ? "4 3" : undefined}
            />
          ))}
        </g>
      ))}
      {Array.from({ length: n }, (_, i) => {
        const from = pile(i),
          l = phases[phase]!,
          [g, j] = l.at(i),
          to = geometry[phase]!.slot(g, j),
          // Sharing moves a round (one per group) at a time; measuring fills
          // one group at a time.
          wave = l === phases[0] ? (first === "share" ? j : g) : 0,
          moved = step >= 1;
        return (
          <g
            key={i}
            data-counter={i}
            data-group={moved ? g : undefined}
            className="animation-step"
            style={{
              ...motion(moved && step === 1 ? wave * 80 : 0),
              transform: `translate(${moved ? to.x - from.x : 0}px, ${moved ? to.y - from.y : 0}px)`,
            }}
          >
            <circle
              cx={from.x}
              cy={from.y}
              r={4.5}
              className="animation-fill"
            />
          </g>
        );
      })}
    </>
  );
}
