import { useEffect, useRef, useState } from "react";
import { MathText } from "../MathText";
import { animationFrames, fiveNumbers, type AnimationModel } from "./model";
import { MadGapStage } from "./ComparisonAnimation";
import {
  BalanceFrame,
  CUBE,
  Cube,
  XBlock,
  cubeGrid,
  leftLayout,
  rightLayout,
} from "../EquationFigure";
import { IsoBox } from "../GeometryFigure";
import { isoFit, isoPoint } from "../../math/geometry-figures";
import { AreaStage, CompareStage, PartitionStage } from "./PartWholeAnimation";
import { ShapeMorphStage } from "./ShapeAnimation";
import { DecimalAlignStage, DecimalFillStage } from "./DecimalAnimation";
import { ClockSweepStage } from "./TimeMoneyAnimation";
import "./animation.css";
import { BoxMarks, LinePlotAxis, Mark } from "../DataDisplayFigure";
import { linePlotLayout } from "../../math/data-display-models";

function Stage({ model, step }: { model: AnimationModel; step: number }) {
  switch (model.kind) {
    case "shape-morph":
      return <ShapeMorphStage model={model} step={step} />;
    case "plot":
      return <PlotModel model={model} step={step} />;
    case "clock-sweep":
      return <ClockSweepStage model={model} step={step} />;
    case "decimal-fill":
      return <DecimalFillStage model={model} step={step} />;
    case "decimal-align":
      return <DecimalAlignStage model={model} step={step} />;
    case "prism-layers":
      return <PrismLayersModel model={model} step={step} />;
    case "quadrant-walk":
      return <QuadrantWalkModel model={model} step={step} />;
    case "line-plot-stack":
      return <StackModel model={model} step={step} />;
    case "line-plot-share":
      return <ShareModel model={model} step={step} />;
    case "make-ten":
      return <MakeTenModel model={model} step={step} />;
    case "pairing":
      return <PairingModel model={model} step={step} />;
    case "place-compare":
      return <PlaceCompareModel model={model} step={step} />;
    case "regroup-sum":
      return <RegroupSumModel model={model} step={step} />;
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
      return <EquationBalanceModel model={model} step={step} />;
    case "mean-balance":
      return <BalanceModel model={model} step={step} />;
    case "box-build":
      return <BoxBuildModel model={model} step={step} />;
    case "mad-gap":
      return <MadGapStage model={model} step={step} />;
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

/** Table rows become points one at a time; then the rule's line appears. */
function PlotModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "plot" }>;
  step: number;
}) {
  const { rows, graph, rule } = model;
  const rowHeight = Math.min(26, 150 / rows.length);
  const tableTop = 30;
  const gx = (v: number) => 162 + (v / graph.xMax) * 140,
    gy = (v: number) => 168 - (v / graph.yMax) * 140;
  // The rule's line, clipped to the grid: y = k·x + offset.
  const xEnd = Math.min(graph.xMax, (graph.yMax - rule.offset) / rule.k);
  return (
    <>
      <text x="34" y="20" textAnchor="middle" style={{ fontWeight: 700 }}>
        {rule.x}
      </text>
      <text x="92" y="20" textAnchor="middle" style={{ fontWeight: 700 }}>
        {rule.y}
      </text>
      <line
        x1="63"
        x2="63"
        y1="6"
        y2={tableTop + rowHeight * rows.length}
        className="animation-outline"
      />
      {rows.map((r, i) => (
        <g key={i} data-plot-row={`${r.x},${r.y}`}>
          <rect
            x="6"
            y={tableTop + i * rowHeight}
            width="114"
            height={rowHeight}
            className="animation-empty animation-fade"
            style={{
              opacity: step === 1 ? 1 : 0,
              transitionDelay: step === 1 ? `${i * 300}ms` : "0ms",
            }}
          />
          <text
            x="34"
            y={tableTop + i * rowHeight + rowHeight * 0.7}
            textAnchor="middle"
          >
            {r.x}
          </text>
          <text
            x="92"
            y={tableTop + i * rowHeight + rowHeight * 0.7}
            textAnchor="middle"
          >
            {r.y}
          </text>
        </g>
      ))}
      <line
        x1={gx(0)}
        x2={gx(graph.xMax)}
        y1={gy(0)}
        y2={gy(0)}
        className="animation-outline"
      />
      <line
        x1={gx(0)}
        x2={gx(0)}
        y1={gy(0)}
        y2={gy(graph.yMax)}
        className="animation-outline"
      />
      <text x={gx(0)} y="190" textAnchor="middle">
        0
      </text>
      <text x={gx(graph.xMax)} y="190" textAnchor="middle">
        {graph.xMax}
      </text>
      <text x={gx(0) - 6} y={gy(graph.yMax) + 5} textAnchor="end">
        {graph.yMax}
      </text>
      <text x={gx(graph.xMax)} y={gy(0) - 8} textAnchor="end">
        {rule.x}
      </text>
      <text
        x={gx(0)}
        y={gy(graph.yMax) - 10}
        textAnchor="middle"
        style={{ fontWeight: 700 }}
      >
        {rule.y}
      </text>
      <line
        data-plot-line={`${rule.k},${rule.offset}`}
        x1={gx(0)}
        y1={gy(rule.offset)}
        x2={gx(xEnd)}
        y2={gy(rule.k * xEnd + rule.offset)}
        className="animation-grid animation-fade"
        strokeWidth="2.5"
        strokeDasharray="7 5"
        style={{ opacity: step === 2 ? 1 : 0 }}
      />
      {rows.map((r, i) => (
        <circle
          key={i}
          data-plot-point={`${r.x},${r.y}`}
          cx={gx(r.x)}
          cy={gy(r.y)}
          r="5.5"
          className="animation-fill animation-fade"
          style={{
            opacity: step >= 1 ? 1 : 0,
            transitionDelay: step === 1 ? `${i * 300}ms` : "0ms",
          }}
        />
      ))}
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
function EquationBalanceModel({
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

/** Both numbers' rods and cubes slide into one row of tens and a column of
 * ones; ten ones then stack beside the tens as one new ten. */
function RegroupSumModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "regroup-sum" }>;
  step: number;
}) {
  const [a, b] = model.figure.values;
  const u = 7,
    rodStep = 11,
    tensX = 64,
    onesX = tensX + 9 * rodStep + 18,
    joinedY = 52;
  const tens = Math.floor(a / 10) + Math.floor(b / 10),
    ones = (a % 10) + (b % 10),
    trade = step === 2 && ones >= 10;
  const joinedTensX = 34;
  const joinedOnesX = joinedTensX + tens * rodStep + 18;
  const pieces: {
    unit: "ten" | "one";
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    traded?: boolean;
  }[] = [];
  let ten = 0,
    one = 0;
  [a, b].forEach((n, row) => {
    const y = 12 + row * 92;
    for (let i = 0; i < Math.floor(n / 10); i++, ten++)
      pieces.push({
        unit: "ten",
        x0: tensX + i * rodStep,
        y0: y,
        x1: joinedTensX + ten * rodStep,
        y1: joinedY,
      });
    for (let i = 0; i < n % 10; i++, one++) {
      // Joined ones stack in columns of ten, the height of one rod.
      const traded = trade && one < 10;
      const column = Math.floor(one / 10) - (trade ? 1 : 0);
      pieces.push({
        unit: "one",
        x0: onesX + (i % 5) * rodStep,
        y0: y + 10 * u - (Math.floor(i / 5) + 1) * rodStep + 4,
        x1: traded
          ? joinedTensX + tens * rodStep
          : joinedOnesX + (trade ? rodStep : 0) + column * (u + 4),
        y1: joinedY + 10 * u - ((one % 10) + 1) * u,
        traded,
      });
    }
  });
  return (
    <>
      <g className="animation-fade" style={{ opacity: step === 0 ? 1 : 0 }}>
        {[a, b].map((n, row) => (
          <text
            key={row}
            x={50}
            y={12 + row * 92 + 40}
            textAnchor="end"
            style={{ fontSize: 20 }}
          >
            {n}
          </text>
        ))}
      </g>
      {pieces.map((piece, i) => (
        <g
          key={i}
          className="animation-move"
          style={{
            transform: `translate(${step ? piece.x1 - piece.x0 : 0}px, ${step ? piece.y1 - piece.y0 : 0}px)`,
          }}
        >
          <rect
            data-unit={piece.unit}
            x={piece.x0}
            y={piece.y0}
            width={piece.unit === "ten" ? u : u - 1}
            height={piece.unit === "ten" ? 10 * u : u - 1}
            className={
              piece.unit === "ten" || piece.traded
                ? "animation-fill"
                : "animation-warm"
            }
          />
        </g>
      ))}
      <rect
        x={joinedTensX + tens * rodStep - 2}
        y={joinedY - 2}
        width={u + 4}
        height={10 * u + 4}
        className="animation-outline animation-fade"
        strokeWidth="2"
        style={{ opacity: trade ? 1 : 0 }}
      />
      <text x="160" y="185" textAnchor="middle">
        {step === 0
          ? `${a} + ${b}`
          : trade
            ? `${tens + 1} ${tens + 1 === 1 ? "ten" : "tens"} and ${ones - 10} ${ones - 10 === 1 ? "one" : "ones"}`
            : `${tens} ${tens === 1 ? "ten" : "tens"} and ${ones} ${ones === 1 ? "one" : "ones"}`}
      </text>
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

/** The mean as a balance point: the data sit on a beam; off the mean it tips. */
function BalanceModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "mean-balance" }>;
  step: number;
}) {
  const layout = linePlotLayout(model.figure, 320);
  const { values } = model.figure;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const torque = values.reduce((a, v) => a + (v - model.trial), 0);
  const tilt =
    step === 1
      ? Math.sign(torque) *
        Math.min(9, 3 + (6 * Math.abs(torque)) / values.length)
      : 0;
  const pivot = step === 2 ? mean : model.trial;
  const origin = `${layout.x(model.trial)}px ${layout.axisY}px`;
  return (
    <>
      <text x="6" y="16" style={{ fontSize: 14 }}>
        {model.figure.unit}
      </text>
      <g
        className="animation-move"
        style={{
          transform: `rotate(${tilt}deg)`,
          transformBox: "view-box",
          transformOrigin: origin,
        }}
      >
        <LinePlotAxis layout={layout} labelGap={20} />
        {layout.marks.map((m, i) => (
          <Mark key={i} kind="dot" cx={m.cx} cy={m.cy} />
        ))}
      </g>
      <g
        data-pivot={pivot}
        className="animation-move animation-fade"
        style={{
          transform: `translateX(${layout.x(pivot) - layout.x(model.trial)}px)`,
          opacity: step ? 1 : 0,
          transition:
            "transform 900ms cubic-bezier(0.22, 0.7, 0.18, 1), opacity 400ms ease",
        }}
      >
        <path
          d={`M${layout.x(model.trial)} ${layout.axisY + 2} l7 13 h-14 Z`}
          fill="var(--color-figure-warm)"
          stroke="var(--color-figure-paper)"
          strokeWidth={1.5}
        />
      </g>
    </>
  );
}
/** Quartile lines split the ordered dots; the box rises over the middle half. */
function BoxBuildModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "box-build" }>;
  step: number;
}) {
  const layout = linePlotLayout(model.figure, 320);
  const q = fiveNumbers(model.figure.values);
  const box = {
    top: 34,
    bottom: layout.axisY - 6,
    min: layout.x(q.min),
    q1: layout.x(q.q1),
    median: layout.x(q.median),
    q3: layout.x(q.q3),
    max: layout.x(q.max),
  };
  return (
    <>
      <text x="6" y="16" style={{ fontSize: 14 }}>
        {model.figure.unit}
      </text>
      <g className="animation-fade" style={{ opacity: step === 2 ? 0.85 : 0 }}>
        <BoxMarks box={box} />
      </g>
      <LinePlotAxis layout={layout} />
      {layout.marks.map((m, i) => (
        <Mark key={i} kind="dot" cx={m.cx} cy={m.cy} />
      ))}
      <g className="animation-fade" style={{ opacity: step === 1 ? 1 : 0 }}>
        {[
          [q.q1, "Q1"],
          [q.median, "M"],
          [q.q3, "Q3"],
        ].map(([v, name]) => (
          <g key={name} data-quartile={name}>
            <line
              x1={layout.x(v as number)}
              x2={layout.x(v as number)}
              y1={28}
              y2={layout.axisY}
              stroke="var(--color-figure-warm)"
              strokeWidth={2}
              strokeDasharray="5 4"
            />
            <text
              x={layout.x(v as number)}
              y={22}
              textAnchor="middle"
              style={{ fontSize: 13 }}
            >
              {name}
            </text>
          </g>
        ))}
      </g>
    </>
  );
}
/** Two ten-frames side by side; step 1 slides the needed squares from the
 * second frame into the first frame's empty places. */
function MakeTenModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "make-ten" }>;
  step: number;
}) {
  const { first: a, second: b } = model.figure;
  const need = 10 - a,
    size = 29,
    top = 52,
    frames = [7, 168];
  const slot = (frame: number, i: number) => ({
    x: frames[frame]! + (i % 5) * size,
    y: top + Math.floor(i / 5) * size,
  });
  return (
    <>
      {[0, 1].map((frame) => (
        <g key={frame}>
          {Array.from({ length: 10 }, (_, i) => {
            const { x, y } = slot(frame, i);
            return (
              <rect
                key={i}
                data-slot={`${frame}-${i}`}
                x={x}
                y={y}
                width={size}
                height={size}
                className="animation-empty"
              />
            );
          })}
        </g>
      ))}
      {Array.from({ length: a }, (_, i) => {
        const { x, y } = slot(0, i);
        return (
          <circle
            key={i}
            data-counter="first"
            cx={x + size / 2}
            cy={y + size / 2}
            r={10}
            className="animation-fill"
          />
        );
      })}
      {Array.from({ length: b }, (_, j) => {
        const from = slot(1, j);
        const moves = j >= b - need;
        const to = moves ? slot(0, a + j - (b - need)) : from;
        return (
          <g
            key={j}
            data-counter="second"
            data-moves={moves || undefined}
            className="animation-move"
            style={{
              transform: `translate(${step ? to.x - from.x : 0}px, ${step ? to.y - from.y : 0}px)`,
            }}
          >
            <rect
              x={from.x + 5}
              y={from.y + 5}
              width={size - 10}
              height={size - 10}
              rx={2}
              className="animation-warm"
              strokeWidth={moves && step ? 2.5 : 1}
            />
          </g>
        );
      })}
      <rect
        x={frames[0]! - 3}
        y={top - 3}
        width={5 * size + 6}
        height={2 * size + 6}
        rx={4}
        className="animation-outline animation-fade"
        strokeWidth="3"
        style={{ opacity: step === 2 ? 1 : 0 }}
      />
      {[0, 1].map((frame) => (
        <text
          key={frame}
          x={frames[frame]! + 2.5 * size}
          y={top + 2 * size + 34}
          textAnchor="middle"
          className="animation-fade"
          style={{ opacity: step === 2 ? 1 : 0 }}
        >
          {frame === 0 ? "10" : `${b - need}`}
        </text>
      ))}
    </>
  );
}
