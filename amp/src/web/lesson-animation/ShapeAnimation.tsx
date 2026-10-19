import { useEffect, useRef, useState } from "react";
import type { ShapeMorphAnimation } from "./shape-model";

type Pt = [number, number];
/** Rotate the vertex order so each corner travels the least distance. */
function aligned(from: Pt[], to: Pt[]) {
  let best = to,
    cost = Infinity;
  for (let k = 0; k < to.length; k++) {
    const turned = to.map((_, i) => to[(i + k) % to.length]!);
    const c = turned.reduce(
      (sum, p, i) => sum + Math.hypot(p[0] - from[i]![0], p[1] - from[i]![1]),
      0,
    );
    if (c < cost) {
      cost = c;
      best = turned;
    }
  }
  return best;
}
const centered = (p: Pt[]) => {
  const xs = p.map((q) => q[0]),
    ys = p.map((q) => q[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return p.map(([x, y]) => [x - cx, y - cy] as Pt);
};
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** One shape reshapes from A to B to C; its corners stay marked throughout. */
export function ShapeMorphStage({
  model,
  step,
}: {
  model: ShapeMorphAnimation;
  step: number;
}) {
  const targets = useRef<Pt[][]>([]);
  if (targets.current.length === 0) {
    const first = centered(model.shapes[0]!.points);
    targets.current = [first];
    for (const s of model.shapes.slice(1))
      targets.current.push(
        aligned(
          targets.current[targets.current.length - 1]!,
          centered(s.points),
        ),
      );
  }
  const all = targets.current.flat();
  const span = Math.max(
    ...all.map((p) => Math.abs(p[0])),
    ...all.map((p) => Math.abs(p[1]) * 1.6),
  );
  const unit = 120 / span;
  const [shown, setShown] = useState(targets.current[step]!);
  const from = useRef(shown);
  useEffect(() => {
    const goal = targets.current[step]!;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) {
      from.current = goal;
      setShown(goal);
      return;
    }
    const start = performance.now(),
      origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = ease(Math.min(1, (now - start) / 900));
      const next = origin.map(
        (p, i) =>
          [
            p[0] + (goal[i]![0] - p[0]) * t,
            p[1] + (goal[i]![1] - p[1]) * t,
          ] as Pt,
      );
      from.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step]);
  const s = (p: Pt) => ({ x: 160 + p[0] * unit, y: 104 - p[1] * unit });
  return (
    <>
      <path
        d={`M${shown.map((p) => `${s(p).x.toFixed(2)} ${s(p).y.toFixed(2)}`).join(" L")} Z`}
        className="animation-morph-shape"
      />
      {shown.map((p, i) => (
        <circle
          key={i}
          cx={s(p).x}
          cy={s(p).y}
          r={5}
          className="animation-point"
        />
      ))}
      <text x={300} y={24} textAnchor="end" className="animation-point-label">
        {model.shapes[step]!.label}
      </text>
    </>
  );
}
