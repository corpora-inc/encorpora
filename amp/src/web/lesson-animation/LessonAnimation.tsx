import { useEffect, useRef, useState } from "react";
import { MathText } from "../MathText";
import { animationFrames, type AnimationModel } from "./model";
import { IsoBox } from "../GeometryFigure";
import { isoFit, isoPoint } from "../../math/geometry-figures";
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
        ) : model.kind === "prism-layers" ? (
          <PrismLayersModel model={model} step={current} />
        ) : model.kind === "quadrant-walk" ? (
          <QuadrantWalkModel model={model} step={current} />
        ) : model.kind === "array" ? (
          <ArrayModel model={model} step={current} />
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

/** Unit cubes fill the prism one layer at a time; every layer is identical. */
function PrismLayersModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "prism-layers" }>;
  step: number;
}) {
  const { length: l, width: w, height: h } = model.figure;
  const { unit, origin } = isoFit(l, w, h, {
    width: 250,
    height: 196,
    pad: 8,
  });
  const project = (x: number, y: number, z: number) =>
    isoPoint(x, y, z, unit, origin);
  return (
    <>
      {Array.from({ length: h }, (_, k) => {
        const shown = k === 0 || step > 0;
        const label = project(l, 0, k + 0.5);
        return (
          <g key={k} data-layer={k}>
            <g
              className="animation-move animation-fade"
              style={{
                opacity: shown ? 1 : 0,
                transform: `translateY(${shown ? 0 : -36}px)`,
                transitionDelay: step === 1 ? `${(k - 1) * 160}ms` : "0ms",
              }}
            >
              <IsoBox at={[0, 0, k]} size={[l, w, 1]} grid project={project} />
            </g>
            <text
              x={label.x + 12}
              y={label.y + 5}
              className="animation-fade"
              style={{ opacity: step === 2 ? 1 : 0 }}
            >
              {k + 1}
            </text>
          </g>
        );
      })}
    </>
  );
}

/** A path traced from the origin: across by the first coordinate, then up. */
function QuadrantWalkModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "quadrant-walk" }>;
  step: number;
}) {
  const { size } = model.figure,
    { x: px, y: py } = model.figure.points[0]!;
  const cell = Math.min(26, 166 / size),
    left = 160 - (cell * size) / 2,
    bottom = 184;
  const x = (n: number) => left + n * cell,
    y = (n: number) => bottom - n * cell;
  const ticks = Array.from({ length: size + 1 }, (_, i) => i);
  return (
    <>
      {ticks.map((n) => (
        <g key={n}>
          <line
            x1={x(n)}
            x2={x(n)}
            y1={y(0)}
            y2={y(size)}
            className="animation-gridline"
          />
          <line
            x1={x(0)}
            x2={x(size)}
            y1={y(n)}
            y2={y(n)}
            className="animation-gridline"
          />
        </g>
      ))}
      <path
        d={`M${x(0)} ${y(0)} H${x(size)} M${x(0)} ${y(0)} V${y(size)}`}
        className="animation-outline"
        strokeWidth="2"
      />
      <text x={x(0) - 8} y={y(0) + 14} textAnchor="end">
        0
      </text>
      <text x={x(size) + 6} y={y(0) + 5}>
        x
      </text>
      <text x={x(0)} y={y(size) - 6} textAnchor="middle">
        y
      </text>
      <path
        d={`M${x(0)} ${y(0)} H${x(px)}`}
        pathLength={1}
        className="animation-trace"
        style={{ strokeDashoffset: step > 0 ? 0 : 1 }}
      />
      <path
        d={`M${x(px)} ${y(0)} V${y(py)}`}
        pathLength={1}
        className="animation-trace"
        style={{ strokeDashoffset: step > 1 ? 0 : 1 }}
      />
      <text
        x={(x(0) + x(px)) / 2}
        y={y(0) + 16}
        textAnchor="middle"
        className="animation-fade"
        style={{ opacity: step > 0 ? 1 : 0 }}
      >
        {px}
      </text>
      <text
        x={x(px) + 8}
        y={(y(0) + y(py)) / 2 + 5}
        className="animation-fade"
        style={{ opacity: step > 1 ? 1 : 0 }}
      >
        {py}
      </text>
      <circle cx={x(0)} cy={y(0)} r="5" className="animation-origin" />
      <circle cx={x(px)} cy={y(py)} r="6" className="animation-point" />
      <text x={x(px) + 9} y={y(py) - 8} className="animation-point-label">
        {step > 1 ? `P (${px}, ${py})` : "P"}
      </text>
    </>
  );
}
