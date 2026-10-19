import { ClockFace } from "../TimeMoneyFigure";
import { handAngles } from "../../math/time-money-models";
import type { ClockSweepAnimation } from "./model";

/** Both hands on the hour, then the long hand sweeps to the minutes, then the
 * short hand moves its exact fraction of the way to the next hour. */
export function ClockSweepStage({
  model,
  step,
}: {
  model: ClockSweepAnimation;
  step: number;
}) {
  const { hour: h, minute: m } = model;
  const final = handAngles(h, m);
  const minuteAngle = step === 0 ? 0 : final.minute;
  const hourAngle = step < 2 ? (h % 12) * 30 : final.hour;
  // The minutes passed, as a band just outside the face (radius 116).
  const cx = 160,
    cy = 122,
    r = 116,
    rad = (final.minute * Math.PI) / 180;
  const end = { x: cx + Math.sin(rad) * r, y: cy - Math.cos(rad) * r };
  return (
    <g transform="translate(160 100) scale(0.74) translate(-160 -122)">
      <ClockFace
        cx={cx}
        cy={cy}
        hourAngle={hourAngle}
        minuteAngle={minuteAngle}
        handStyle={{}}
        handClassName="animation-move"
      />
      <path
        d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${final.minute > 180 ? 1 : 0} 1 ${end.x} ${end.y}`}
        fill="none"
        stroke="var(--color-figure-accent)"
        strokeWidth="7"
        strokeLinecap="round"
        className="animation-fade"
        style={{ opacity: step === 0 ? 0 : 1 }}
      />
    </g>
  );
}
