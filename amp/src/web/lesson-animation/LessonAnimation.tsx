import { useEffect, useRef, useState } from "react";
import { MathText } from "../MathText";
import { animationFrames, type AnimationModel } from "./model";
import {
  BalanceFrame,
  CUBE,
  Cube,
  XBlock,
  cubeGrid,
  leftLayout,
  rightLayout,
} from "../EquationFigure";
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
        {model.kind === "balance" ? (
          <BalanceModel model={model} step={current} />
        ) : model.kind === "fraction" ? (
          <FractionModel model={model} step={current} />
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

/** Positions of the right pan's cubes split into `groups` equal groups. */
function groupedRight(count: number, groups: number) {
  const per = count / groups,
    columns = 2,
    width = columns * CUBE.pitch,
    gap = groups >= 5 ? 4 : 10,
    span = groups * width + (groups - 1) * gap,
    start = 300 - span / 2;
  return {
    cubes: Array.from({ length: groups }, (_, g) =>
      cubeGrid(per, columns, start + g * (width + gap), 142).map((c) => ({
        ...c,
        group: g,
      })),
    ).flat(),
    dividers: Array.from(
      { length: groups - 1 },
      (_, g) => start + (g + 1) * (width + gap) - gap / 2 - 1,
    ),
  };
}
function BalanceModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "balance" }>;
  step: number;
}) {
  const f = model.figure,
    form = model.form;
  const left = leftLayout(f);
  const start = rightLayout(f.right);
  const p = f.groups > 1 ? f.groups : f.blocks;
  // Which right-pan cubes leave, and where the rest stand, at each step.
  const removedRight = (j: number) =>
    form === "add" || form === "remove-split"
      ? step >= 1 && j >= f.right - f.units
      : form === "split-remove"
        ? step >= 2 && j % (f.right / p) >= f.right / p - f.units
        : false;
  const split =
    (form === "times" && step >= 1) ||
    (form === "remove-split" && step >= 2) ||
    (form === "split-remove" && step >= 1);
  const kept = form === "remove-split" ? f.right - f.units : f.right;
  const grouped = groupedRight(kept, p);
  // For split-remove, cube j belongs to group floor(j / per) in the grouped layout.
  const target = (j: number) =>
    split && j < kept ? grouped.cubes[j]! : start[j]!;
  const dimmed = (group: number) => form === "times" && step === 2 && group > 0;
  const leftRemoved = (i: number) =>
    form === "split-remove" ? step >= 2 : form !== "times" && step >= 1;
  // Dividers rise just above the tallest group on either pan.
  const dividerTop = Math.min(...grouped.cubes.map((c) => c.y), 142 - 40) - 8;
  const leftDividers =
    f.groups > 1
      ? []
      : Array.from(
          { length: f.blocks - 1 },
          (_, i) => left.blocks[i + 1]!.x - 2,
        );
  return (
    <g transform="translate(0 -8) scale(0.8)" data-balance-step={step}>
      <BalanceFrame />
      {left.bags.map((b, i) => (
        <rect
          key={`bag${i}`}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx="8"
          className="animation-bag"
        />
      ))}
      {left.blocks.map((b, i) => (
        <g
          key={`block${i}`}
          className="animation-lift"
          style={{ opacity: dimmed(i) ? 0.25 : 1 }}
        >
          <XBlock x={b.x} y={b.y} />
        </g>
      ))}
      {left.cubes.map((c, i) => (
        <g
          key={`left${i}`}
          data-left-cube={i}
          className="animation-lift"
          style={{
            transform: `translateY(${leftRemoved(i) ? -28 : 0}px)`,
            opacity: leftRemoved(i) ? 0 : 1,
          }}
        >
          <Cube x={c.x} y={c.y} />
        </g>
      ))}
      {start.map((c, j) => {
        const to = target(j),
          gone = removedRight(j);
        const group = split && j < kept ? grouped.cubes[j]!.group : 0;
        return (
          <g
            key={`right${j}`}
            data-right-cube={j}
            className="animation-lift"
            style={{
              transform: `translate(${to.x - c.x}px, ${to.y - c.y - (gone ? 28 : 0)}px)`,
              opacity: gone ? 0 : dimmed(group) ? 0.25 : 1,
            }}
          >
            <Cube x={c.x} y={c.y} />
          </g>
        );
      })}
      <g className="animation-fade" style={{ opacity: split ? 1 : 0 }}>
        {[...grouped.dividers, ...(split ? leftDividers : [])].map((x, i) => (
          <line
            key={i}
            x1={x}
            x2={x}
            y1={dividerTop}
            y2="140"
            className="animation-divider"
          />
        ))}
      </g>
    </g>
  );
}
