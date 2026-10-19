import { useEffect, useRef, useState } from "react";
import { MathText } from "../MathText";
import {
  animationFrames,
  coefficientText,
  rootZoom,
  scaled,
  standardForm,
  type AnimationModel,
} from "./model";
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
        {model.kind === "root-zoom" ? (
          <RootZoomModel model={model} step={current} />
        ) : model.kind === "decimal-shift" ? (
          <DecimalShiftModel model={model} step={current} />
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
          <line x1="0" x2="0" y1="64" y2="104" className="animation-outline" />
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
