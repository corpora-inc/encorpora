import { useEffect, useRef, useState } from "react";
import { MathText } from "../MathText";
import { animationFrames, jumpStops, type AnimationModel } from "./model";
import "./animation.css";

export default function LessonAnimation({ model }: { model: AnimationModel }) {
  const panelRef = useRef<HTMLElement>(null);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [step, setStep] = useState(reduced ? 2 : 0);
  const [playing, setPlaying] = useState(false);
  const frames = animationFrames(model);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      setReduced(media.matches);
      if (media.matches) {
        setPlaying(false);
        setStep(2);
        if (panelRef.current?.contains(document.activeElement))
          panelRef.current.focus();
      }
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!playing || reduced) return;
    const timer = window.setTimeout(() => {
      if (step === 2) setPlaying(false);
      else {
        setStep(step + 1);
        if (step === 1) setPlaying(false);
      }
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [playing, reduced, step]);
  const current = reduced ? 2 : step;
  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      className="lesson-animation"
      aria-label="Explore the example"
      data-animation={model.kind}
      data-step={current}
    >
      <div className="animation-heading">
        <strong>Explore the example</strong>
        <span>{current + 1} / 3</span>
      </div>
      <svg
        className="animation-stage"
        viewBox="0 0 320 200"
        role="img"
        aria-label={`${frames[current].title}. ${frames[current].text}`}
      >
        <title>{frames[current].title}</title>
        {model.kind === "fraction" ? (
          <FractionModel model={model} step={current} />
        ) : model.kind === "array" ? (
          <ArrayModel model={model} step={current} />
        ) : model.kind === "opposite" ? (
          <OppositeModel model={model} step={current} />
        ) : model.kind === "jumps" ? (
          <JumpsModel model={model} step={current} />
        ) : (
          <ExchangeModel model={model} step={current} />
        )}
      </svg>
      <div className="animation-copy" aria-live="polite" aria-atomic="true">
        {frames.map((frame, index) => (
          <div
            key={index}
            className="animation-frame"
            style={{ visibility: index === current ? "visible" : "hidden" }}
            aria-hidden={index !== current}
          >
            <h4>{frame.title}</h4>
            <p>{frame.text}</p>
            <p className="animation-equation">
              <MathText text={frame.math} />
            </p>
          </div>
        ))}
      </div>
      {reduced ? (
        <p className="animation-static">Complete model</p>
      ) : (
        <div className="animation-controls">
          <button
            type="button"
            onClick={() => {
              if (playing) setPlaying(false);
              else {
                if (step === 2) setStep(0);
                setPlaying(true);
              }
            }}
          >
            {playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            aria-disabled={current === 2}
            onClick={() => {
              if (current === 2) return;
              setPlaying(false);
              setStep(step + 1);
            }}
          >
            Step
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setStep(0);
            }}
          >
            Replay
          </button>
        </div>
      )}
    </section>
  );
}

function FractionModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "fraction" }>;
  step: number;
}) {
  const { parts, selected } = model.figure,
    width = 272 / parts;
  return (
    <>
      <rect x="24" y="92" width="272" height="52" className="animation-empty" />
      {Array.from({ length: selected }, (_, i) => (
        <g
          key={i}
          className="animation-move"
          style={{ transform: `translateY(${step === 2 ? -64 : 0}px)` }}
        >
          <rect
            data-piece={i}
            x={24 + i * width}
            y="92"
            width={width}
            height="52"
            className="animation-fill"
            style={{ strokeWidth: step ? 1 : 0 }}
          />
        </g>
      ))}
      <g className="animation-fade" style={{ opacity: step > 0 ? 1 : 0 }}>
        {Array.from({ length: parts - 1 }, (_, i) => (
          <line
            key={i}
            x1={24 + (i + 1) * width}
            x2={24 + (i + 1) * width}
            y1="92"
            y2="144"
            className="animation-grid"
          />
        ))}
      </g>
      <path d="M24 152 v8 h272 v-8" className="animation-outline" />
      <text x="160" y="182" textAnchor="middle">
        one whole
      </text>
    </>
  );
}
function ArrayModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "array" }>;
  step: number;
}) {
  const { rows, columns, splitAfterRow: split } = model.figure;
  const cell = Math.min(25, 236 / columns, 140 / rows),
    x = (296 - cell * columns) / 2,
    y = (174 - cell * rows) / 2;
  return (
    <>
      {[0, 1].map((region) => (
        <g
          key={region}
          className="animation-move"
          style={{
            transform: `translateY(${step === 1 ? (region ? 12 : -12) : 0}px)`,
          }}
        >
          {Array.from(
            { length: (region ? rows - split : split) * columns },
            (_, i) => {
              const row = Math.floor(i / columns) + (region ? split : 0);
              return (
                <rect
                  key={i}
                  data-cell={region ? split * columns + i : i}
                  x={x + (i % columns) * cell}
                  y={y + row * cell}
                  width={cell}
                  height={cell}
                  className={region ? "animation-warm" : "animation-fill"}
                />
              );
            },
          )}
          {region === 0 && (
            <line
              x1={x}
              x2={x + cell * columns}
              y1={y + split * cell}
              y2={y + split * cell}
              className="animation-outline"
              strokeWidth="3"
            />
          )}
          <text
            x={x + cell * columns + 12}
            y={y + (region ? (split + rows) / 2 : split / 2) * cell + 5}
          >
            {region ? "B" : "A"}
          </text>
        </g>
      ))}
    </>
  );
}
function ExchangeModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "exchange" }>;
  step: number;
}) {
  const unit = model.unit,
    size = 12;
  const targetX = unit === 1 ? 154 : 100;
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => {
        const x = unit === 1 ? 108 + (i % 5) * 23 : 54 + i * 22;
        const y = unit === 1 ? 72 + Math.floor(i / 5) * 28 : 36;
        const finalX = targetX + (unit === 10 ? i * size : 0),
          finalY = 36 + (unit === 1 ? i * size : 0);
        return (
          <g
            key={i}
            data-exchange-unit={i}
            className="animation-move"
            style={{
              transform: `translate(${step ? finalX - x : 0}px, ${step ? finalY - y : 0}px)`,
            }}
          >
            <rect
              x={x}
              y={y}
              width={size}
              height={unit * size}
              className="animation-fill"
            />
            {Array.from({ length: unit - 1 }, (_, j) => (
              <line
                key={j}
                x1={x}
                x2={x + size}
                y1={y + (j + 1) * size}
                y2={y + (j + 1) * size}
                className="animation-grid"
              />
            ))}
          </g>
        );
      })}
      <rect
        x={targetX}
        y="36"
        width={unit * size}
        height="120"
        className="animation-outline animation-fade"
        style={{ opacity: step === 2 ? 1 : 0 }}
        strokeWidth="3"
      />
      <text x="160" y="185" textAnchor="middle">
        {step === 2
          ? `ten ${unit === 1 ? "ones → one ten" : "tens → one hundred"}`
          : `ten ${unit === 1 ? "ones" : "tens"}`}
      </text>
    </>
  );
}

const shown = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
/** A number line across the stage: one-unit ticks, labels every 5, 0 emphasized. */
function StageLine({
  min,
  max,
  y,
  x,
}: {
  min: number;
  max: number;
  y: number;
  x: (n: number) => number;
}) {
  return (
    <>
      <line x1="12" x2="308" y1={y} y2={y} className="animation-outline" />
      {Array.from({ length: max - min + 1 }, (_, i) => {
        const n = min + i,
          major = n % 5 === 0;
        return (
          <g key={n}>
            <line
              x1={x(n)}
              x2={x(n)}
              y1={y - (n === 0 ? 10 : major ? 7 : 4)}
              y2={y + (n === 0 ? 10 : major ? 7 : 4)}
              className="animation-outline"
              strokeWidth={n === 0 ? 2.5 : 1}
            />
            {major && (
              <text
                x={x(n)}
                y={y + 26}
                textAnchor="middle"
                style={{ fontWeight: n === 0 ? 700 : 400 }}
              >
                {shown(n)}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}
function OppositeModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "opposite" }>;
  step: number;
}) {
  const { value: a, min, max } = model,
    y = 130;
  const x = (n: number) => 24 + ((n - min) / (max - min)) * 272;
  const radius = Math.abs(x(a) - x(0));
  // Rotating about 0 by a half turn lands exactly on the opposite, passing above the line.
  const turn = a < 0 ? 180 : -180;
  const brace = (to: number, show: boolean) => (
    <g className="animation-fade" style={{ opacity: show ? 1 : 0 }}>
      <path
        d={`M${x(to)} ${y + 34} v8 H${x(0)} v-8`}
        className="animation-outline"
      />
      <text x={(x(to) + x(0)) / 2} y={y + 60} textAnchor="middle">
        {Math.abs(a)}
      </text>
    </g>
  );
  return (
    <>
      <StageLine min={min} max={max} y={y} x={x} />
      <path
        d={`M${x(a)} ${y} A${radius} ${radius} 0 0 ${a < 0 ? 1 : 0} ${x(-a)} ${y}`}
        className="animation-guide animation-fade"
        style={{ opacity: step > 0 ? 1 : 0 }}
      />
      {brace(a, true)}
      {brace(-a, step === 2)}
      <circle cx={x(a)} cy={y} r="7" className="animation-warm-dot" />
      <text x={x(a)} y={y - 16} textAnchor="middle" style={{ fontWeight: 700 }}>
        P
      </text>
      <g
        className="animation-move"
        style={{
          transformOrigin: `${x(0)}px ${y}px`,
          transform: `rotate(${step > 0 ? turn : 0}deg)`,
        }}
      >
        <circle
          data-opposite-mark={step > 0 ? -a : a}
          cx={x(a)}
          cy={y}
          r="7"
          className="animation-accent-dot"
        />
      </g>
      <text
        x={x(-a)}
        y={y - 16}
        textAnchor="middle"
        className="animation-fade"
        style={{ opacity: step === 2 ? 1 : 0, fontWeight: 700 }}
      >
        {shown(-a)}
      </text>
    </>
  );
}
function JumpsModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "jumps" }>;
  step: number;
}) {
  const { start, jumps, min, max } = model,
    y = 140;
  const x = (n: number) => 24 + ((n - min) / (max - min)) * 272;
  const stops = jumpStops(start, jumps),
    end = stops.at(-1)!;
  return (
    <>
      <StageLine min={min} max={max} y={y} x={x} />
      {jumps.map((jump, i) => {
        const from = x(stops[i]!),
          to = x(stops[i + 1]!),
          lift = 28 + i * 22,
          control = y - 4 - lift * 1.6;
        return (
          <g key={i} data-jump={jump}>
            <path
              d={`M${from} ${y - 4} Q${(from + to) / 2} ${control} ${to} ${y - 4}`}
              pathLength={1}
              className={`animation-draw ${jump < 0 ? "animation-jump-negative" : "animation-jump-positive"}`}
              style={{
                strokeDashoffset: step > 0 ? 0 : 1,
                transitionDelay: step > 0 ? `${i * 450}ms` : "0ms",
              }}
            />
          </g>
        );
      })}
      {jumps.map((jump, i) => {
        const lift = 28 + i * 22;
        return (
          <text
            key={i}
            x={(x(stops[i]!) + x(stops[i + 1]!)) / 2}
            y={y - 8 - lift}
            textAnchor="middle"
            className="animation-fade animation-halo"
            style={{
              opacity: step > 0 ? 1 : 0,
              fontWeight: 700,
              transitionDelay: step > 0 ? `${i * 450 + 300}ms` : "0ms",
            }}
          >
            {jump > 0 ? `+${jump}` : shown(jump)}
          </text>
        );
      })}
      <circle cx={x(start)} cy={y} r="6" className="animation-accent-dot" />
      <text x={x(start)} y={y + 48} textAnchor="middle">
        {shown(start)}
      </text>
      <circle
        data-end-mark={end}
        cx={x(end)}
        cy={y}
        r="7"
        className="animation-ring animation-fade"
        style={{
          opacity: step === 2 ? 1 : 0,
        }}
      />
      <text
        x={x(end)}
        y={y + 48}
        textAnchor="middle"
        className="animation-fade"
        style={{ opacity: step === 2 ? 1 : 0, fontWeight: 700 }}
      >
        {shown(end)}
      </text>
    </>
  );
}
