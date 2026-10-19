import { tenPair, type AnimationModel } from "./model";

const delay = (ms: number) => ({ transitionDelay: `${ms}ms` });

/** Counters in rows of five standing on a pan whose base is at y. */
function stack(n: number, cx: number, y: number, key: string, warm: boolean) {
  const pitch = 10,
    across = Math.min(5, n);
  return Array.from({ length: n }, (_, i) => (
    <circle
      key={`${key}-${i}`}
      data-counter={key}
      cx={cx - ((across - 1) * pitch) / 2 + (i % 5) * pitch}
      cy={y - 6 - Math.floor(i / 5) * pitch}
      r={4.2}
      style={{
        fill: warm ? "var(--color-figure-warm)" : "var(--color-figure-accent)",
      }}
    />
  ));
}

/** The beam tips toward the heavier pan; the pans hang level and move with
 * the beam ends. Step 0 loads one side, step 1 the other side's counters,
 * step 2 opens the box and the beam levels. */
export function BalanceLevelStage({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "balance-level" }>;
  step: number;
}) {
  const { full, partial, boxLeft } = model;
  const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
  const total = sum(full),
    known = sum(partial),
    missing = total - known;
  const boxSide = step === 0 ? 0 : step === 1 ? known : total,
    left = boxLeft ? boxSide : total,
    right = boxLeft ? total : boxSide;
  const arm = 110,
    pivot = { x: 160, y: 48 },
    angle = Math.max(-12, Math.min(12, (right - left) * 1.6)),
    drop = arm * Math.sin((angle * Math.PI) / 180);
  const pan = (side: "left" | "right") => {
    const cx = pivot.x + (side === "left" ? -arm : arm),
      dy = side === "left" ? -drop : drop,
      isBox = (side === "left") === boxLeft,
      y = 136;
    const groups = isBox ? partial : full;
    const slot = (i: number, n: number) => (n === 1 ? 0 : i === 0 ? -27 : 27);
    const items = isBox ? groups.length + 1 : groups.length;
    return (
      <g
        data-pan={side}
        className="animation-move"
        style={{ transform: `translateY(${dy}px)` }}
      >
        <line
          x1={cx}
          x2={cx - 50}
          y1={pivot.y}
          y2={y}
          className="animation-outline"
        />
        <line
          x1={cx}
          x2={cx + 50}
          y1={pivot.y}
          y2={y}
          className="animation-outline"
        />
        <path
          d={`M ${cx - 56} ${y} Q ${cx} ${y + 12} ${cx + 56} ${y}`}
          className="animation-outline"
          strokeWidth="2"
        />
        {isBox &&
          (() => {
            const bx = cx + slot(0, items);
            return (
              <g data-box>
                <rect
                  x={bx - 18}
                  y={y - 40}
                  width={36}
                  height={38}
                  rx={6}
                  className="animation-empty"
                  strokeDasharray={step === 2 ? "4 3" : undefined}
                />
                <g
                  className="animation-fade"
                  style={{ opacity: step === 2 ? 1 : 0 }}
                >
                  {Array.from({ length: missing }, (_, i) => (
                    <circle
                      key={i}
                      data-box-counter
                      cx={bx - 12 + (i % 4) * 8}
                      cy={y - 8 - Math.floor(i / 4) * 7}
                      r={3.2}
                      style={{ fill: "var(--color-figure-gold)" }}
                    />
                  ))}
                </g>
              </g>
            );
          })()}
        {groups.map((g, i) => {
          const at = isBox ? i + 1 : i;
          return (
            <g
              key={i}
              className="animation-fade"
              style={{
                opacity: isBox && step === 0 ? 0 : 1,
              }}
            >
              {stack(g, cx + slot(at, items), y, `${side}${i}`, i % 2 === 1)}
            </g>
          );
        })}
      </g>
    );
  };
  return (
    <>
      <path d="M 140 190 L 160 172 L 180 190 Z" className="animation-outline" />
      <line
        x1={160}
        x2={160}
        y1={pivot.y}
        y2={176}
        className="animation-outline"
        strokeWidth="3"
      />
      <line
        data-beam
        x1={pivot.x - arm}
        x2={pivot.x + arm}
        y1={pivot.y}
        y2={pivot.y}
        className="animation-outline animation-move"
        strokeWidth="4"
        strokeLinecap="round"
        style={{
          transform: `rotate(${angle}deg)`,
          transformOrigin: `${pivot.x}px ${pivot.y}px`,
        }}
      />
      {pan("left")}
      {pan("right")}
    </>
  );
}

/** The whole bar above; the known part below; the missing part slides in
 * from the right to fill the bar, then shows its value. */
export function TapeJoinStage({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "tape-join" }>;
  step: number;
}) {
  const { whole, part, partFirst } = model,
    missing = whole - part,
    x0 = 20,
    width = 280,
    unit = width / whole;
  const partX = partFirst ? x0 : x0 + missing * unit,
    missX = partFirst ? x0 + part * unit : x0;
  return (
    <>
      <rect
        x={x0}
        y={34}
        width={width}
        height={40}
        className="animation-empty"
      />
      <text x={x0 + width / 2} y={60} textAnchor="middle">
        {whole}
      </text>
      <rect
        data-part="known"
        x={partX}
        y={104}
        width={part * unit}
        height={40}
        style={{
          fill: "var(--color-figure-accent-fill)",
          stroke: "var(--color-figure-ink)",
        }}
      />
      <text x={partX + (part * unit) / 2} y={130} textAnchor="middle">
        {part}
      </text>
      <g
        data-part="missing"
        className="animation-step"
        style={{
          transform: `translateX(${step === 0 ? 320 - missX : 0}px)`,
          opacity: step === 0 ? 0 : 1,
        }}
      >
        <rect
          x={missX}
          y={104}
          width={missing * unit}
          height={40}
          style={{
            fill: "var(--color-figure-gold-fill)",
            stroke: "var(--color-figure-gold)",
          }}
          strokeDasharray={step === 2 ? undefined : "4 3"}
        />
        <text x={missX + (missing * unit) / 2} y={130} textAnchor="middle">
          {step === 2 ? missing : "?"}
        </text>
      </g>
    </>
  );
}

const SLOT = 26;
/** Three rows of counters; step 1 moves the pair that makes ten (or the first
 * two groups) into the ten-frames, step 2 moves the third group after them. */
export function MakeTenThreeStage({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "make-ten-three" }>;
  step: number;
}) {
  const { addends } = model,
    order = tenPair(addends) ?? [0, 1, 2];
  const frames = [20, 170],
    frameTop = 118;
  const slot = (k: number) => ({
    x: frames[Math.floor(k / 10)]! + (k % 5) * SLOT + SLOT / 2,
    y: frameTop + (Math.floor(k / 5) % 2) * SLOT + SLOT / 2,
  });
  // Where each group's counters land, in the order the groups are placed.
  const firstSlot: number[] = [];
  let k = 0;
  for (const g of order) {
    firstSlot[g] = k;
    k += addends[g]!;
  }
  const moves = (g: number) => step >= 2 || (step === 1 && g !== order[2]);
  return (
    <>
      {[0, 1].map((f) =>
        Array.from({ length: 10 }, (_, i) => (
          <rect
            key={`${f}-${i}`}
            data-slot={`${f}-${i}`}
            x={frames[f]! + (i % 5) * SLOT}
            y={frameTop + Math.floor(i / 5) * SLOT}
            width={SLOT}
            height={SLOT}
            className="animation-empty"
          />
        )),
      )}
      {addends.map((n, g) =>
        Array.from({ length: n }, (_, i) => {
          const from = { x: 40 + i * 24 + (i >= 5 ? 6 : 0), y: 22 + g * 30 },
            to = slot(firstSlot[g]! + i),
            moved = moves(g);
          const shape =
            g === 0 ? (
              <circle
                cx={from.x}
                cy={from.y}
                r={8}
                style={{ fill: "var(--color-figure-accent)" }}
              />
            ) : g === 1 ? (
              <rect
                x={from.x - 7.5}
                y={from.y - 7.5}
                width={15}
                height={15}
                rx={2}
                style={{ fill: "var(--color-figure-warm)" }}
              />
            ) : (
              <path
                d={`M ${from.x} ${from.y - 9} L ${from.x + 9} ${from.y} L ${from.x} ${from.y + 9} L ${from.x - 9} ${from.y} Z`}
                style={{ fill: "var(--color-figure-gold)" }}
              />
            );
          return (
            <g
              key={`${g}-${i}`}
              data-counter={g}
              className="animation-step"
              style={{
                ...delay(moved ? i * 50 : 0),
                transform: `translate(${moved ? to.x - from.x : 0}px, ${moved ? to.y - from.y : 0}px)`,
              }}
            >
              {shape}
            </g>
          );
        }),
      )}
    </>
  );
}
