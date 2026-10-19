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
import { AreaStage, CompareStage, PartitionStage } from "./PartWholeAnimation";
import "./animation.css";
import { LinePlotAxis, Mark } from "../DataDisplayFigure";
import { linePlotLayout } from "../../math/data-display-models";

function Stage({ model, step }: { model: AnimationModel; step: number }) {
  switch (model.kind) {
    case "line-plot-stack":
      return <StackModel model={model} step={step} />;
    case "line-plot-share":
      return <ShareModel model={model} step={step} />;
    case "pairing":
      return <PairingModel model={model} step={step} />;
    case "place-compare":
      return <PlaceCompareModel model={model} step={step} />;
    case "fraction":
      return <FractionModel model={model} step={step} />;
    case "array":
      return <ArrayModel model={model} step={step} />;
    case "exchange":
      return <ExchangeModel model={model} step={step} />;
    case "partition":
      return <PartitionStage model={model} step={step} />;
    case "compare":
      return <CompareStage model={model} step={step} />;
    case "area":
      return <AreaStage model={model} step={step} />;
    case "balance":
      return <BalanceModel model={model} step={step} />;
  }
}

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
        <Stage model={model} step={current} />
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

/** Rows start like the problem figure; step 1 slides every counter to a common
 * spacing, step 2 draws the pairs and marks the counters left over. */
function PairingModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "pairing" }>;
  step: number;
}) {
  const { circles, squares, spread } = model.figure;
  const left = 26,
    right = 294,
    gap = 30;
  const start = (i: number, count: number, spreadRow: boolean) =>
    spreadRow ? left + (i * (right - left)) / (count - 1) : left + i * gap;
  const pairs = Math.min(circles, squares);
  const row = (count: number, shape: "circle" | "square", y: number) =>
    Array.from({ length: count }, (_, i) => {
      const x0 = start(
        i,
        count,
        spread === (shape === "circle" ? "circles" : "squares"),
      );
      const x1 = left + i * gap;
      const unpaired = step === 2 && i >= pairs;
      return (
        <g
          key={`${shape}${i}`}
          data-counter={shape}
          className="animation-move"
          style={{ transform: `translateX(${step ? x1 - x0 : 0}px)` }}
        >
          {unpaired && (
            <circle
              cx={x0}
              cy={y}
              r={17}
              className="animation-outline"
              strokeDasharray="3 3"
              strokeWidth={1.5}
            />
          )}
          {shape === "circle" ? (
            <circle
              cx={x0}
              cy={y}
              r={11}
              className={unpaired ? "animation-warm" : "animation-fill"}
              strokeWidth={unpaired ? 3 : 1}
            />
          ) : (
            <rect
              x={x0 - 10}
              y={y - 10}
              width={20}
              height={20}
              rx={2}
              className={unpaired ? "animation-warm" : "animation-fill"}
              strokeWidth={unpaired ? 3 : 1}
            />
          )}
        </g>
      );
    });
  return (
    <>
      <g className="animation-fade" style={{ opacity: step === 2 ? 1 : 0 }}>
        {Array.from({ length: pairs }, (_, i) => (
          <line
            key={i}
            data-pair={i}
            x1={left + i * gap}
            x2={left + i * gap}
            y1={68}
            y2={120}
            className="animation-grid"
            strokeDasharray="4 3"
          />
        ))}
      </g>
      {row(circles, "circle", 56)}
      {row(squares, "square", 132)}
      <text x="160" y="185" textAnchor="middle">
        {step === 2
          ? circles === squares
            ? "every counter has a partner"
            : `${Math.abs(circles - squares)} left over`
          : step === 1
            ? "same spacing"
            : spread === "none"
              ? "same spacing"
              : `${spread} spread out`}
      </text>
    </>
  );
}

/** Rods and cubes for two numbers; the place being compared stays solid while
 * the other place fades. */
function PlaceCompareModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "place-compare" }>;
  step: number;
}) {
  const [a, b] = model.figure.values;
  const tensMatch = Math.floor(a / 10) === Math.floor(b / 10);
  const focus = step === 0 ? "both" : step === 2 && tensMatch ? "ones" : "tens";
  const u = 7,
    rodStep = 11,
    tensX = 64,
    onesX = tensX + 9 * rodStep + 18;
  return (
    <>
      {[a, b].map((n, row) => {
        const y = 12 + row * 92,
          tens = Math.floor(n / 10),
          ones = n % 10;
        return (
          <g key={row} data-value={n}>
            <text x={50} y={y + 40} textAnchor="end" style={{ fontSize: 20 }}>
              {n}
            </text>
            <g
              className="animation-fade"
              data-place="tens"
              style={{ opacity: focus === "ones" ? 0.25 : 1 }}
            >
              {Array.from({ length: tens }, (_, i) => (
                <rect
                  key={i}
                  data-unit="ten"
                  x={tensX + i * rodStep}
                  y={y}
                  width={u}
                  height={10 * u}
                  className="animation-fill"
                />
              ))}
            </g>
            <g
              className="animation-fade"
              data-place="ones"
              style={{ opacity: focus === "tens" ? 0.25 : 1 }}
            >
              {Array.from({ length: ones }, (_, i) => (
                <rect
                  key={i}
                  data-unit="one"
                  x={onesX + (i % 5) * rodStep}
                  y={y + 10 * u - (Math.floor(i / 5) + 1) * rodStep + 4}
                  width={u}
                  height={u}
                  className="animation-warm"
                />
              ))}
            </g>
            <text
              x={onesX + 5 * rodStep + 12}
              y={y + 40}
              className="animation-fade"
              style={{ opacity: focus === "both" ? 0 : 1 }}
            >
              {focus === "ones"
                ? `${ones} ${ones === 1 ? "one" : "ones"}`
                : `${tens} ${tens === 1 ? "ten" : "tens"}`}
            </text>
          </g>
        );
      })}
    </>
  );
}

const motion = (delay: number) => ({
  transition:
    "transform 700ms cubic-bezier(0.22, 0.7, 0.18, 1), opacity 400ms ease",
  transitionDelay: `${delay}ms`,
});
/** Each measurement drops onto its value; repeats land on the stack below. */
function StackModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "line-plot-stack" }>;
  step: number;
}) {
  const layout = linePlotLayout(model.figure, 320);
  const half = Math.ceil(model.figure.values.length / 2);
  return (
    <>
      <text x="6" y="16" style={{ fontSize: 14 }}>
        {model.figure.unit}
      </text>
      <LinePlotAxis layout={layout} />
      {layout.marks.map((m, i) => {
        const shown = step === 2 || (step === 1 && i < half);
        return (
          <g
            key={i}
            data-stack-mark={i}
            className="animation-move"
            style={{
              ...motion(step === 2 ? Math.max(0, i - half) * 70 : i * 70),
              transform: `translateY(${shown ? 0 : -(m.cy + 24)}px)`,
              opacity: shown ? 1 : 0,
            }}
          >
            <Mark kind="x" cx={m.cx} cy={m.cy} />
          </g>
        );
      })}
    </>
  );
}
/** Pool every amount, then give each beaker the same share: all marks move to the mean. */
function ShareModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "line-plot-share" }>;
  step: number;
}) {
  const layout = linePlotLayout(model.figure, 320);
  const target = layout.x(model.share);
  return (
    <>
      <text x="6" y="16" style={{ fontSize: 14 }}>
        {model.figure.unit}
      </text>
      <LinePlotAxis layout={layout} />
      <line
        className="animation-fade"
        x1={target}
        x2={target}
        y1={14}
        y2={layout.axisY}
        stroke="var(--color-figure-warm)"
        strokeWidth={2}
        strokeDasharray="5 4"
        style={{ opacity: step === 2 ? 1 : 0 }}
      />
      {layout.marks.map((m, i) => {
        // Step 1 pours every amount into one row; step 2 gives each the same share.
        const n = layout.marks.length,
          pooled = layout.left + ((i + 0.5) * (layout.right - layout.left)) / n;
        const dx = step === 2 ? target - m.cx : step === 1 ? pooled - m.cx : 0,
          dy =
            step === 2
              ? layout.axisY - 15 - i * 18 - m.cy
              : step === 1
                ? 34 - m.cy
                : 0;
        return (
          <g
            key={i}
            data-share-mark={i}
            className="animation-move"
            style={{
              ...motion(step === 2 ? i * 80 : 0),
              transform: `translate(${dx}px, ${dy}px)`,
            }}
          >
            <Mark kind="x" cx={m.cx} cy={m.cy} />
          </g>
        );
      })}
    </>
  );
}
