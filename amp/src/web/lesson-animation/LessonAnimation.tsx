import { useEffect, useRef, useState } from "react";
import { MathText } from "../MathText";
import { animationFrames, type AnimationModel } from "./model";
import { CoordinateGeometry } from "../GeometryFigure";
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
        ) : model.kind === "motion" ? (
          <MotionModel model={model} step={current} />
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

/** The pre-image moves by the motion itself: a slide, a flip through the
 * mirror line, a turn about the origin or a scaling from it. */
function MotionModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "motion" }>;
  step: number;
}) {
  const m = model.motion;
  return (
    <svg x="0" y="0" width="320" height="200" viewBox="0 0 320 250">
      <CoordinateGeometry
        figure={model.figure}
        className="animation-grid-figure"
        description=""
      >
        {({ x, y, unit }) => {
          const origin = `${x(0)}px ${y(0)}px`;
          const transform =
            m.kind === "translate"
              ? `translate(${m.dx * unit}px, ${-m.dy * unit}px)`
              : m.kind === "reflect"
                ? m.axis === "x"
                  ? "scale(1, -1)"
                  : "scale(-1, 1)"
                : m.kind === "rotate"
                  ? `rotate(${m.degrees === 90 ? -90 : m.degrees === 270 ? 90 : -180}deg)`
                  : `scale(${m.numerator / m.denominator})`;
          const pts = (list: { x: number; y: number }[]) =>
            list.map((p) => `${x(p.x)},${y(p.y)}`).join(" ");
          const guides = model.given.map((p, i) => {
            const q = model.image[i]!;
            return m.kind === "dilate" ? (
              <line
                key={i}
                x1={x(0)}
                y1={y(0)}
                x2={x(
                  Math.abs(q.x) > Math.abs(p.x) || Math.abs(q.y) > Math.abs(p.y)
                    ? q.x
                    : p.x,
                )}
                y2={y(
                  Math.abs(q.x) > Math.abs(p.x) || Math.abs(q.y) > Math.abs(p.y)
                    ? q.y
                    : p.y,
                )}
                className="animation-guide"
              />
            ) : m.kind === "rotate" ? (
              <line
                key={i}
                x1={x(0)}
                y1={y(0)}
                x2={x(p.x)}
                y2={y(p.y)}
                className="animation-guide"
              />
            ) : (
              <line
                key={i}
                x1={x(p.x)}
                y1={y(p.y)}
                x2={x(q.x)}
                y2={y(q.y)}
                className="animation-guide"
              />
            );
          });
          return (
            <>
              <g
                className="animation-fade"
                style={{ opacity: step >= 1 ? 1 : 0 }}
              >
                {m.kind === "reflect" &&
                  (m.axis === "x" ? (
                    <line
                      x1={x(model.figure.xMin)}
                      x2={x(model.figure.xMax)}
                      y1={y(0)}
                      y2={y(0)}
                      className="animation-mirror"
                    />
                  ) : (
                    <line
                      x1={x(0)}
                      x2={x(0)}
                      y1={y(model.figure.yMin)}
                      y2={y(model.figure.yMax)}
                      className="animation-mirror"
                    />
                  ))}
                {guides}
                {(m.kind === "rotate" || m.kind === "dilate") && (
                  <circle
                    cx={x(0)}
                    cy={y(0)}
                    r="4"
                    className="animation-center"
                  />
                )}
              </g>
              <g
                className="animation-fade"
                style={{ opacity: step === 2 ? 1 : 0 }}
              >
                <polygon
                  points={pts(model.image)}
                  className="animation-image"
                />
                {model.image.map((p, i) => {
                  const cx = model.image.reduce((a, v) => a + v.x, 0) / 3,
                    cy = model.image.reduce((a, v) => a + v.y, 0) / 3;
                  const dx = p.x - cx,
                    dy = p.y - cy,
                    len = Math.hypot(dx, dy) || 1;
                  return (
                    <text
                      key={i}
                      x={x(p.x) + (dx / len) * 15}
                      y={y(p.y) - (dy / len) * 15 + 5}
                      textAnchor="middle"
                      className="animation-image-label"
                    >
                      {p.label}
                    </text>
                  );
                })}
              </g>
              <polygon
                data-moving="true"
                points={pts(model.given)}
                className={`animation-move animation-moving${step === 2 ? " landed" : ""}`}
                style={{
                  transformBox: "view-box",
                  transformOrigin: origin,
                  transform: step === 2 ? transform : "none",
                }}
              />
            </>
          );
        }}
      </CoordinateGeometry>
    </svg>
  );
}
