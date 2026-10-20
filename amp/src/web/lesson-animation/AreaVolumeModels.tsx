import { useEffect, useRef, useState } from "react";
import { avColor } from "../AreaVolumeFigure";
import {
  faceArea,
  foldNet,
  netBounds,
  netFaces,
  project,
  type NetFace,
} from "../area-volume-geometry";
import type { AreaVolumeAnimation } from "./area-volume-model";

type Pt = [number, number];
const r2 = (v: number) => Math.round(v * 100) / 100;
const d = (pts: Pt[]) =>
  `M${pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join(" L")} Z`;
const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The stage is 320 × 200; models draw inside 10..310 × 8..186. */
export function AreaVolumeModel({
  model,
  step,
}: {
  model: AreaVolumeAnimation;
  step: number;
}) {
  if (model.kind === "triangle-double")
    return <TriangleDouble model={model} step={step} />;
  if (model.kind === "net-fold") return <NetFold model={model} step={step} />;
  return <CylinderStack model={model} step={step} />;
}

function TriangleDouble({
  model,
  step,
}: {
  model: Extract<AreaVolumeAnimation, { kind: "triangle-double" }>;
  step: number;
}) {
  const { base: b, height: h, apex: x } = model;
  // Fit the parallelogram (0,0) (b,0) (b+x,h) (x,h) into the stage.
  const minX = Math.min(0, x),
    maxX = Math.max(b, b + x);
  const s = Math.min(280 / (maxX - minX), 150 / h);
  const ox = 160 - ((minX + maxX) / 2) * s,
    oy = 172 - (150 - h * s) / 2;
  const P = (px: number, py: number): Pt => [ox + px * s, oy - py * s];
  const tri: Pt[] = [P(0, 0), P(b, 0), P(x, h)];
  const pivot = P((b + x) / 2, h / 2);
  return (
    <>
      <path
        d={d([P(0, 0), P(b, 0), P(b + x, h), P(x, h)])}
        fill="none"
        stroke={avColor.ink}
        strokeWidth={2.5}
        strokeDasharray="6 4"
        className="animation-fade"
        style={{ opacity: step === 2 ? 1 : 0 }}
      />
      <g
        data-copy-turn={step >= 1 ? 180 : 0}
        className="animation-move"
        style={{
          transform: `rotate(${step >= 1 ? 180 : 0}deg)`,
          transformOrigin: `${r2(pivot[0])}px ${r2(pivot[1])}px`,
          transformBox: "view-box",
          opacity: step >= 1 ? 1 : 0,
          transitionProperty: "transform, opacity",
          transitionDuration: "1100ms, 300ms",
        }}
      >
        <path
          d={d(tri)}
          fill={avColor.goldFill}
          stroke={avColor.gold}
          strokeWidth={2}
        />
      </g>
      <path
        d={d(tri)}
        fill={avColor.fill}
        stroke={avColor.line}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {x !== 0 && x !== b && (
        <line
          x1={r2(P(x, 0)[0])}
          y1={r2(P(x, 0)[1])}
          x2={r2(P(x, h)[0])}
          y2={r2(P(x, h)[1])}
          stroke={avColor.warm}
          strokeWidth={2}
          strokeDasharray="5 4"
        />
      )}
      {(x < 0 || x > b) && (
        <line
          x1={r2(P(x, 0)[0])}
          y1={r2(P(x, 0)[1])}
          x2={r2(P(x < 0 ? 0 : b, 0)[0])}
          y2={r2(P(0, 0)[1])}
          stroke={avColor.guide}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
      )}
      <text x={r2(P(b / 2, 0)[0])} y={r2(oy + 20)} textAnchor="middle">
        b = {r2(b)}
      </text>
      <text
        x={r2(P(x, h / 2)[0] + (x > b / 2 ? 8 : -8))}
        y={r2(P(x, h / 2)[1] + 5)}
        textAnchor={x > b / 2 ? "start" : "end"}
        style={{ fill: avColor.warm, fontWeight: 700 }}
      >
        h = {r2(h)}
      </text>
    </>
  );
}

const roleFill: Record<NetFace["role"], string> = {
  "pair-a": avColor.fill,
  "pair-b": avColor.goldFill,
  "pair-c": avColor.warmFill,
  base: avColor.goldFill,
  lateral: avColor.fill,
  end: avColor.goldFill,
};
/** Folds the net in 3D with an eased tween; reduced motion jumps to the end. */
function NetFold({
  model,
  step,
}: {
  model: Extract<AreaVolumeAnimation, { kind: "net-fold" }>;
  step: number;
}) {
  const target = step === 0 ? 1 : 0;
  const [amount, setAmount] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced()) {
      setAmount(target);
      return;
    }
    const start = performance.now(),
      begin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const value = begin + (target - begin) * eased;
      from.current = value;
      setAmount(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  const faces = netFaces(model.figure);
  const b = netBounds(faces);
  const folded = foldNet(faces, amount);
  const center: [number, number, number] = [
    (b.minX + b.maxX) / 2,
    (b.minY + b.maxY) / 2,
    0,
  ];
  const tilt = 1.05 * amount,
    turn = 0.45 * amount;
  const raw = faces.map((f) => {
    const pts = folded.get(f.id)!.map((p) => project(p, center, tilt, turn));
    return {
      face: f,
      pts,
      depth: pts.reduce((t, p) => t + p.depth, 0) / pts.length,
    };
  });
  // Fit the current shape: the camera eases out as the solid unfolds.
  const ux = raw.flatMap((p) => p.pts.map((q) => q.x)),
    uy = raw.flatMap((p) => p.pts.map((q) => q.y));
  const s = Math.min(
    280 / (Math.max(...ux) - Math.min(...ux) || 1),
    168 / (Math.max(...uy) - Math.min(...uy) || 1),
  );
  const projected = raw.map((p) => ({
    ...p,
    pts: p.pts.map((q) => [q.x * s, q.y * s] as Pt),
  }));
  const xs = projected.flatMap((p) => p.pts.map((q) => q[0])),
    ys = projected.flatMap((p) => p.pts.map((q) => q[1]));
  const dx = 160 - (Math.min(...xs) + Math.max(...xs)) / 2,
    dy = 97 - (Math.min(...ys) + Math.max(...ys)) / 2;
  return (
    <g data-fold={r2(amount)}>
      {projected
        .sort((p, q) => p.depth - q.depth)
        .map(({ face, pts }) => {
          const moved = pts.map(([px, py]) => [px + dx, py + dy] as Pt);
          const cx = moved.reduce((t, p) => t + p[0], 0) / moved.length,
            cy = moved.reduce((t, p) => t + p[1], 0) / moved.length;
          return (
            <g key={face.id} data-face={face.id}>
              <path
                d={d(moved)}
                fill={roleFill[face.role]}
                stroke={avColor.line}
                strokeWidth={1.75}
                strokeLinejoin="round"
              />
              {step === 2 &&
                amount < 0.02 &&
                Math.min(...face.dims) * s >= 22 && (
                  <text x={r2(cx)} y={r2(cy + 5)} textAnchor="middle">
                    {r2(faceArea(face))}
                  </text>
                )}
            </g>
          );
        })}
    </g>
  );
}

function CylinderStack({
  model,
  step,
}: {
  model: Extract<AreaVolumeAnimation, { kind: "cylinder-stack" }>;
  step: number;
}) {
  const { radius: r, height: h } = model;
  const s = Math.min(70 / r, 140 / (h + 0.6 * r));
  const R = r * s,
    ry = 0.3 * R,
    layer = s,
    cx = 120,
    bottom = 180 - ry;
  const groups = h,
    per = 1;
  return (
    <>
      {Array.from({ length: groups }, (_, i) => {
        const lift = (i + 1) * per * layer,
          top = bottom - lift,
          low = top + per * layer;
        const shown = step >= 1 || i === 0;
        return (
          <g
            key={i}
            data-layer={i + 1}
            className="animation-move"
            style={{
              transform: `translateY(${shown ? 0 : lift - per * layer}px)`,
              opacity: shown ? 1 : 0,
              transitionDelay: `${step >= 1 ? i * 90 : 0}ms`,
              transitionProperty: "transform, opacity",
            }}
          >
            <path
              d={`M${r2(cx - R)} ${r2(top)} L${r2(cx - R)} ${r2(low)} A${r2(R)} ${r2(ry)} 0 0 0 ${r2(cx + R)} ${r2(low)} L${r2(cx + R)} ${r2(top)} Z`}
              fill={avColor.fill}
              stroke={avColor.line}
              strokeWidth={1.25}
            />
            <ellipse
              cx={cx}
              cy={r2(top)}
              rx={r2(R)}
              ry={r2(ry)}
              fill={
                i === 0 && step === 0 ? avColor.goldFill : avColor.fillStrong
              }
              stroke={avColor.line}
              strokeWidth={1.25}
            />
          </g>
        );
      })}
      <line
        x1={cx}
        y1={r2(bottom - per * layer)}
        x2={r2(cx + R)}
        y2={r2(bottom - per * layer)}
        stroke={avColor.warm}
        strokeWidth={2}
        className="animation-fade"
        style={{ opacity: step === 0 ? 1 : 0 }}
      />
      <text
        x={r2(cx + R + 14)}
        y={r2(bottom - per * layer + 5)}
        className="animation-fade"
        style={{ opacity: step === 0 ? 1 : 0 }}
      >
        r = {r2(r)}
      </text>
      <g className="animation-fade" style={{ opacity: step >= 1 ? 1 : 0 }}>
        <line
          x1={r2(cx + R + 14)}
          y1={r2(bottom - h * layer)}
          x2={r2(cx + R + 14)}
          y2={r2(bottom)}
          stroke={avColor.warm}
          strokeWidth={2}
        />
        <text
          x={r2(cx + R + 22)}
          y={r2(bottom - (h * layer) / 2 + 5)}
          style={{ fill: avColor.warm, fontWeight: 700 }}
        >
          h = {h}
        </text>
      </g>
    </>
  );
}
