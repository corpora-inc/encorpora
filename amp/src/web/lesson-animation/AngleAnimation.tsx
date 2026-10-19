import { Protractor } from "../AngleFigure";
import type { ProtractorSweepAnimation } from "./angle-model";

const rad = Math.PI / 180;
const polar = (c: { x: number; y: number }, r: number, d: number) => ({
  x: c.x + r * Math.cos(d * rad),
  y: c.y - r * Math.sin(d * rad),
});

/** The baseline ray lights up, an arc sweeps along the scale to the other
 * ray, then the reading on the same scale is circled. */
export function ProtractorSweepStage({
  model,
  step,
}: {
  model: ProtractorSweepAnimation;
  step: number;
}) {
  const c = { x: 160, y: 182 },
    radius = 140;
  const [r0, r1] = model.rays;
  const right = r0 === 0;
  // The arc runs from the baseline ray to the other ray, near the scale.
  const ar = radius - 62;
  const s = polar(c, ar, r0),
    e = polar(c, ar, r1);
  const arc = `M${s.x.toFixed(2)} ${s.y.toFixed(2)} A${ar} ${ar} 0 0 ${right ? 0 : 1} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  const zero = polar(c, right ? radius - 48 : radius - 25, right ? 6 : 174);
  const reading = polar(c, radius - 6, r1);
  // The value sits inside the scales, beside the ray, toward the zero ray.
  const value = polar(c, radius - 92, r1 + (right ? -14 : 14));
  const end0 = polar(c, radius + 4, r0),
    end1 = polar(c, radius + 4, r1);
  return (
    <>
      <Protractor c={c} radius={radius}>
        <path
          d={`M${c.x} ${c.y} L${end0.x} ${end0.y}`}
          className="animation-ray animation-ray-base"
        />
        <path
          d={`M${c.x} ${c.y} L${end1.x} ${end1.y}`}
          className="animation-ray"
          style={{ opacity: step > 0 ? 1 : 0.25 }}
        />
      </Protractor>
      <path
        d={arc}
        pathLength={1}
        className="animation-trace"
        style={{ strokeDashoffset: step > 0 ? 0 : 1 }}
      />
      <circle cx={zero.x} cy={zero.y - 5} r={13} className="animation-ring" />
      <g className="animation-fade" style={{ opacity: step > 1 ? 1 : 0 }}>
        <circle
          cx={reading.x}
          cy={reading.y}
          r={9}
          className="animation-ring"
        />
        <text
          x={value.x}
          y={value.y + 6}
          textAnchor="middle"
          className="animation-point-label"
        >
          {model.measure}°
        </text>
      </g>
    </>
  );
}
