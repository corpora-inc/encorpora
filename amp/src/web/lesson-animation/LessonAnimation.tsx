import { CoordinateGeometry } from "../TransformationFigure";
import { GeometryModel } from "./GeometryAnimation";
import { useEffect, useRef, useState } from "react";
import { MathText } from "../MathText";
import { areaModelLayout } from "../AreaModelFigure";
import {
  animationFrames,
  fiveNumbers,
  jumpStops,
  coefficientText,
  rootZoom,
  scaled,
  standardForm,
  type AnimationModel,
} from "./model";
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
import {
  ArrayBuildStage,
  ArrayTurnStage,
  DealStage,
} from "./FactArrayAnimation";
import {
  BalanceLevelStage,
  MakeTenThreeStage,
  TapeJoinStage,
} from "./EarlyOperationsAnimation";
import { ShapeMorphStage } from "./ShapeAnimation";
import { DecimalAlignStage, DecimalFillStage } from "./DecimalAnimation";
import { ClockSweepStage } from "./TimeMoneyAnimation";
import "./animation.css";
import { Jars } from "../AttributeFigure";
import { BoxMarks, LinePlotAxis, Mark } from "../DataDisplayFigure";
import { linePlotLayout } from "../../math/data-display-models";

function Stage({ model, step }: { model: AnimationModel; step: number }) {
  switch (model.kind) {
    case "motion":
      return <MotionModel model={model} step={step} />;
    case "triangle-sum":
    case "exterior-angle":
    case "transversal":
    case "plane-sweep":
      return <GeometryModel model={model} step={step} />;
    case "root-zoom":
      return <RootZoomModel model={model} step={step} />;
    case "decimal-shift":
      return <DecimalShiftModel model={model} step={step} />;
    case "opposite":
      return <OppositeModel model={model} step={step} />;
    case "jumps":
      return <JumpsModel model={model} step={step} />;
    case "pour":
      return (
        <g transform="translate(20 4) scale(0.86)">
          <Jars eighths={model.eighths} poured={step > 0} />
        </g>
      );
    case "area-model":
      return <AreaModelAnimation model={model} step={step} />;
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
    case "array-build":
      return <ArrayBuildStage model={model} step={step} />;
    case "array-turn":
      return <ArrayTurnStage model={model} step={step} />;
    case "deal":
      return <DealStage model={model} step={step} />;
    case "balance-level":
      return <BalanceLevelStage model={model} step={step} />;
    case "tape-join":
      return <TapeJoinStage model={model} step={step} />;
    case "make-ten-three":
      return <MakeTenThreeStage model={model} step={step} />;
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
    case "rate":
      return <RateLinesModel model={model} step={step} />;
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

/** Both lines share one scale; the highlighted pair shrinks to 1 and then
 * stretches to the target, always by the same factor on both lines. */
function RateLinesModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "rate" }>;
  step: number;
}) {
  const [b, t] = model.given,
    [tb, tt] = model.target,
    rate = t / b;
  const x0 = 104,
    x1 = 292,
    yTop = 72,
    yBottom = 140,
    max = Math.max(b, tb),
    x = (v: number) => x0 + (v / max) * (x1 - x0);
  const reach = [b, 1, tb][step]! / max;
  const tick = (v: number, key: string, show = true) => (
    <g
      key={key}
      className="animation-fade"
      style={{ opacity: show ? 1 : 0 }}
      data-rate-tick={key}
    >
      {[yTop, yBottom].map((y) => (
        <line
          key={y}
          x1={x(v)}
          x2={x(v)}
          y1={y - 7}
          y2={y + 7}
          className="animation-outline"
          strokeWidth="2"
        />
      ))}
    </g>
  );
  return (
    <>
      <text x="8" y={yTop + 5}>
        {model.top}
      </text>
      <text x="8" y={yBottom + 5}>
        {model.bottom}
      </text>
      {[yTop, yBottom].map((y) => (
        <g key={y}>
          <rect
            x={x0}
            y={y - 6}
            width={x1 - x0}
            height="12"
            rx="3"
            className="animation-move rate-bar"
            data-rate-bar={y === yTop ? "top" : "bottom"}
            style={{
              transformOrigin: `${x0}px ${y}px`,
              transform: `scaleX(${reach})`,
            }}
          />
          <line
            x1={x0}
            x2={x1 + 10}
            y1={y}
            y2={y}
            className="animation-outline"
            strokeWidth="2"
          />
        </g>
      ))}
      {tick(0, "zero")}
      <text x={x(0)} y={yTop - 14} textAnchor="middle">
        0
      </text>
      <text x={x(0)} y={yBottom + 26} textAnchor="middle">
        0
      </text>
      {tick(b, "given")}
      <text x={x(b)} y={yTop - 14} textAnchor="middle">
        {t}
      </text>
      <text x={x(b)} y={yBottom + 26} textAnchor="middle">
        {b}
      </text>
      {tick(1, "unit", step >= 1)}
      <g
        className="animation-fade"
        style={{ opacity: step >= 1 ? 1 : 0 }}
        data-rate-unit={`${rate}`}
      >
        <text x={x(1)} y={yTop + 24} textAnchor="middle" className="rate-unit">
          {rate}
        </text>
        <text
          x={x(1)}
          y={yBottom - 13}
          textAnchor="middle"
          className="rate-unit"
        >
          1
        </text>
      </g>
      {tick(tb, "target")}
      <text x={x(tb)} y={yTop - 14} textAnchor="middle" data-rate-target-top>
        {!model.findBottom && step < 2 ? "?" : tt}
      </text>
      <text
        x={x(tb)}
        y={yBottom + 26}
        textAnchor="middle"
        data-rate-target-bottom
      >
        {model.findBottom && step < 2 ? "?" : tb}
      </text>
    </>
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
  const u = 9,
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

/** The whole rectangle splits at its place-value parts; each region shows its
 * partial product, then the regions separate to be added. Drawn to scale. */
function AreaModelAnimation({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "area-model" }>;
  step: number;
}) {
  const gap = 6;
  const layout = areaModelLayout(model.figure, {
    x: 50,
    y: 24,
    // Room right of and below the rectangle for labels of slender regions.
    width: 214 - gap,
    height: 144 - gap,
  });
  const a = layout.columns.reduce((s, c) => s + c.n, 0),
    b = layout.rows.reduce((s, r) => s + r.n, 0);
  return (
    <>
      {layout.rows.flatMap((row, j) =>
        layout.columns.map((column, i) => (
          <g
            key={`${i}-${j}`}
            data-region={`${column.n}x${row.n}`}
            className="animation-move"
            style={{
              transform: `translate(${step === 2 ? i * gap : 0}px, ${step === 2 ? j * gap : 0}px)`,
            }}
          >
            <rect
              x={column.x}
              y={row.y}
              width={column.w}
              height={row.h}
              className={
                step && (i + j) % 2 ? "animation-warm" : "animation-fill"
              }
              style={{ strokeWidth: step ? 1 : 0 }}
            />
            {(() => {
              // A region too slender for its label is labelled beside it.
              const narrow = column.w < 28,
                thin = row.h < 16;
              return (
                <text
                  x={narrow ? column.x + column.w + 4 : column.x + column.w / 2}
                  y={thin ? row.y + row.h + 14 : row.y + row.h / 2 + 5}
                  textAnchor={narrow ? "start" : "middle"}
                  className="animation-fade"
                  style={{
                    opacity: step ? 1 : 0,
                    fontSize: narrow || thin || row.h < 22 ? 12 : 15,
                  }}
                >
                  {String(column.n * row.n).replace(
                    /\B(?=(\d{3})+(?!\d))/g,
                    ",",
                  )}
                </text>
              );
            })()}
          </g>
        )),
      )}
      <rect
        x={layout.x0}
        y={layout.y0}
        width={layout.width}
        height={layout.height}
        className="animation-outline animation-fade"
        style={{ opacity: step === 2 ? 0 : 1 }}
        strokeWidth="2"
      />
      <g className="animation-fade" style={{ opacity: step ? 0 : 1 }}>
        <text
          x={layout.x0 + layout.width / 2}
          y={layout.y0 - 8}
          textAnchor="middle"
        >
          {a}
        </text>
        <text
          x={layout.x0 - 8}
          y={layout.y0 + layout.height / 2 + 5}
          textAnchor="end"
        >
          {b}
        </text>
      </g>
      <g className="animation-fade" style={{ opacity: step ? 1 : 0 }}>
        {layout.columns.map((column, i) => (
          <text
            key={`c${i}`}
            x={column.x + column.w / 2 + (step === 2 ? i * gap : 0)}
            y={layout.y0 - 8}
            textAnchor="middle"
          >
            {column.n}
          </text>
        ))}
        {layout.rows.map((row, j) => (
          <text
            key={`r${j}`}
            x={layout.x0 - 8}
            y={row.y + row.h / 2 + 5 + (step === 2 ? j * gap : 0)}
            textAnchor="end"
          >
            {row.n}
          </text>
        ))}
      </g>
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
  const u = 9,
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

/** One number line whose window zooms: whole numbers, then tenths, then the
 * tenth interval around the root. Every mark sits at its true value. */
function RootZoomModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "root-zoom" }>;
  step: number;
}) {
  const { radicand: n, index: i } = model,
    { k, t } = rootZoom(n, i);
  const windows: [number, number][] = [
    [k - 1, k + 2],
    [k, k + 1],
    [t / 10, (t + 1) / 10],
  ];
  const [lo, hi] = windows[step]!,
    x = (v: number) => 52 + ((v - lo) / (hi - lo)) * 216;
  const root = i === 2 ? Math.sqrt(n) : Math.cbrt(n),
    sign = i === 2 ? "√" : "∛";
  const mark = (
    key: string,
    value: number,
    size: number,
    labelText: string | null,
    below: string | null,
    visible: boolean,
    anchor: "start" | "middle" | "end" = "middle",
  ) => (
    <g
      key={key}
      className="animation-move"
      data-mark={key}
      style={{ transform: `translate(${x(value)}px, 0px)` }}
    >
      <g className="animation-fade" style={{ opacity: visible ? 1 : 0 }}>
        <line
          x1="0"
          x2="0"
          y1={110 - size}
          y2={110 + size}
          className="animation-grid"
          strokeWidth={size > 6 ? 2 : 1}
        />
        {labelText && (
          <text
            x={anchor === "start" ? 3 : anchor === "end" ? -3 : 0}
            y="90"
            textAnchor={anchor}
          >
            {labelText}
          </text>
        )}
        {below && (
          <text x="0" y="140" textAnchor="middle" className="animation-small">
            {below}
          </text>
        )}
      </g>
    </g>
  );
  const marks = [
    ...[k - 1, k, k + 1, k + 2].map((v) =>
      mark(`whole-${v}`, v, 9, String(v), String(v ** i), step === 0),
    ),
    ...Array.from({ length: 11 }, (_, j) => {
      const tenth = 10 * k + j,
        named = step === 1 && (tenth === t || tenth === t + 1),
        // Ends are named only when clear of the two named neighbours.
        end =
          step === 1 &&
          (j === 0 || j === 10) &&
          Math.min(Math.abs(tenth - t), Math.abs(tenth - t - 1)) >= 3;
      return mark(
        `tenth-${tenth}`,
        tenth / 10,
        named ? 9 : 5,
        named || end ? scaled(tenth, 1) : null,
        null,
        step >= 1,
        // Adjacent named tenths lean apart so their labels never touch.
        tenth === t ? "end" : tenth === t + 1 ? "start" : "middle",
      );
    }),
    ...[t, t + 0.5, t + 1].map((v, j) =>
      mark(
        `zoom-${j}`,
        v / 10,
        9,
        scaled(10 * v, 2).replace(/0$/, ""),
        scaled((10 * v) ** i, 2 * i).replace(/\.?0+$/, ""),
        step === 2,
      ),
    ),
  ];
  return (
    <>
      <defs>
        <clipPath id="root-zoom-window">
          <rect x="4" y="0" width="312" height="200" />
        </clipPath>
      </defs>
      <line x1="16" x2="304" y1="110" y2="110" className="animation-outline" />
      <g clipPath="url(#root-zoom-window)">
        {marks}
        <g
          className="animation-move"
          data-mark="root"
          style={{ transform: `translate(${x(root)}px, 0px)` }}
        >
          {/* Broken at the tick-label band so the pointer never strikes a label. */}
          <line x1="0" x2="0" y1="62" y2="74" className="animation-outline" />
          <line x1="0" x2="0" y1="96" y2="104" className="animation-outline" />
          <circle cx="0" cy="110" r="6" className="animation-root" />
          <text x="0" y="56" textAnchor="middle" className="animation-strong">
            {`${sign}${n}`}
          </text>
        </g>
      </g>
      <text x="160" y="186" textAnchor="middle" className="animation-small">
        {step === 0
          ? `${i === 2 ? "squares" : "cubes"} below the line`
          : step === 1
            ? `tenths from ${k} to ${k + 1}`
            : `${i === 2 ? "squares" : "cubes"} below the line`}
      </text>
    </>
  );
}

/** Digits sit in fixed place cells; only the decimal point travels. */
function DecimalShiftModel({
  model,
  step,
}: {
  model: Extract<AnimationModel, { kind: "decimal-shift" }>;
  step: number;
}) {
  const { digits, exponent: e, toStandard } = model,
    length = digits.length;
  // Point positions count digits to its left, measured from the first digit.
  const scientificPoint = 1,
    standardPoint = 1 + e;
  const [from, to] = toStandard
    ? [scientificPoint, standardPoint]
    : [standardPoint, scientificPoint];
  const point = step === 0 ? from : to;
  // Columns: the leading 0 (ones place) of a small number through trailing zeros of a large one.
  const lo = Math.min(0, standardPoint - 1),
    hi = Math.max(length - 1, standardPoint - 1);
  const count = hi - lo + 1,
    width = Math.min(30, 272 / count),
    left = 160 - (count * width) / 2;
  const centre = (column: number) => left + (column - lo + 0.5) * width;
  const boundary = (p: number) => left + (p - lo) * width;
  // Zeros that standard form needs: leading (small numbers) or trailing (large numbers).
  const zeros = Array.from({ length: count }, (_, j) => j + lo).filter(
    (c) => c < 0 || c >= length,
  );
  const zerosVisible = toStandard ? step === 2 : step < 2;
  const hops = Array.from({ length: Math.abs(e) }, (_, j) => {
    const a = from + Math.sign(to - from) * j,
      b = a + Math.sign(to - from);
    return { a, b };
  });
  const fontSize = Math.min(26, width * 0.9);
  return (
    <>
      {Array.from({ length: count }, (_, j) => (
        <rect
          key={j}
          x={left + j * width}
          y="70"
          width={width}
          height="56"
          className="animation-empty"
        />
      ))}
      {digits.split("").map((d, j) => (
        <text
          key={`d${j}`}
          data-digit-column={j}
          x={centre(j)}
          y="108"
          textAnchor="middle"
          className="animation-strong"
          style={{ fontSize }}
        >
          {d}
        </text>
      ))}
      {zeros.map((c) => (
        <text
          key={`z${c}`}
          data-zero-column={c}
          x={centre(c)}
          y="108"
          textAnchor="middle"
          className="animation-fade"
          style={{ fontSize, opacity: zerosVisible ? 0.6 : 0 }}
        >
          0
        </text>
      ))}
      <g className="animation-fade" style={{ opacity: step === 1 ? 1 : 0 }}>
        {hops.map(({ a, b }, j) => (
          <path
            key={j}
            d={`M${boundary(a)} 136 Q${(boundary(a) + boundary(b)) / 2} ${150} ${boundary(b)} 136`}
            className="animation-outline"
          />
        ))}
      </g>
      <g
        className="animation-move"
        data-point={point}
        style={{ transform: `translate(${boundary(point)}px, 0px)` }}
      >
        <circle cx="0" cy="106" r="3.5" className="animation-root" />
      </g>
      <text x="160" y="44" textAnchor="middle" className="animation-small">
        {step === 1
          ? `${Math.abs(e)} ${Math.abs(e) === 1 ? "place" : "places"} ${to > from ? "right" : "left"}`
          : (step === 2) === toStandard
            ? withCommas(standardForm(digits, e))
            : `${coefficientText(digits)} × 10${superscript(e)}`}
      </text>
    </>
  );
}

const superscript = (n: number) =>
  String(n)
    .replace("-", "⁻")
    .replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]!);
const withCommas = (text: string) => {
  const [whole, part] = text.split(".");
  const grouped =
    whole!.length >= 5 ? whole!.replace(/\B(?=(\d{3})+$)/g, ",") : whole!;
  return part === undefined ? grouped : `${grouped}.${part}`;
};

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
