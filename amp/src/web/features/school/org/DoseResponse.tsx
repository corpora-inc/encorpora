import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { PracticeResponse } from "../../../../schools/org-contracts";
import {
  associationWords,
  summarize,
  type Fit,
} from "../../../../schools/practice-stats";
import { Segmented } from "../../../ui/Segmented";
import { number, shortDay, TipZone } from "../classes/teacher-shared";
import { heatColor, heatPosition } from "../heat-scale";
import { figure, StatsLine } from "../practice/heat";
import styles from "./Org.module.css";

type Dose = PracticeResponse["dose"];
export type DoseDots = "students" | "classes";

/** The width a figure has, measured before paint, so its text stays at its
 * real size on a phone instead of shrinking with a viewBox. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const HEIGHT = 280;
const PAD = { top: 12, right: 16, bottom: 40, left: 66 };
/** Round ticks across a range: 1, 2 or 5 times a power of ten. */
function ticksFor(low: number, high: number, count = 5) {
  const span = Math.max(1e-9, high - low);
  const raw = span / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * power).find((m) => m >= raw) ??
    10 * power;
  const first = Math.floor(low / step) * step;
  const last = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let tick = first; tick <= last + step / 2; tick += step)
    ticks.push(Math.round(tick * 1e6) / 1e6);
  return ticks;
}
const signedGrades = (value: number) =>
  `${value > 0.004 ? "+" : value < -0.004 ? "−" : ""}${Math.abs(value).toFixed(2)}`;

/** The frame both figures draw in: the same size with or without data, so
 * switching never moves the page. */
function Frame({
  label,
  message,
  children,
}: {
  label: string;
  message?: string;
  children: (width: number) => ReactNode;
}) {
  const [ref, width] = useWidth();
  return (
    <div ref={ref} className={styles.doseFrame} style={{ height: HEIGHT }}>
      {message ? (
        <p className={styles.doseNeeds} role="note">
          {message}
        </p>
      ) : (
        width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={label}
            className={styles.doseSvg}
          >
            {children(width)}
          </svg>
        )
      )}
    </div>
  );
}

function Axes({
  width,
  x,
  y,
  xTicks,
  yTicks,
  xLabel,
  yLabel,
  xFormat,
  yFormat,
}: {
  width: number;
  x: (value: number) => number;
  y: (value: number) => number;
  xTicks: number[];
  yTicks: number[];
  xLabel: string;
  yLabel: string;
  xFormat: (value: number) => string;
  yFormat: (value: number) => string;
}) {
  return (
    <g className={styles.doseAxes}>
      {yTicks.map((tick) => (
        <g key={`y${tick}`}>
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(tick)}
            y2={y(tick)}
            data-zero={Math.abs(tick) < 1e-9 || undefined}
          />
          <text x={PAD.left - 6} y={y(tick)} dy="0.32em" textAnchor="end">
            {yFormat(tick)}
          </text>
        </g>
      ))}
      {xTicks.map((tick, index) => (
        <text
          key={`x${tick}`}
          x={x(tick)}
          y={HEIGHT - PAD.bottom + 16}
          textAnchor={
            index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"
          }
        >
          {xFormat(tick)}
        </text>
      ))}
      <text
        x={(PAD.left + width - PAD.right) / 2}
        y={HEIGHT - 4}
        textAnchor="middle"
        className={styles.doseAxisLabel}
      >
        {xLabel}
      </text>
      <text
        transform={`translate(10 ${(PAD.top + HEIGHT - PAD.bottom) / 2}) rotate(-90)`}
        textAnchor="middle"
        className={styles.doseAxisLabel}
      >
        {yLabel}
      </text>
    </g>
  );
}

/** Minutes a week against growth this term, one dot a student or a class, with
 * the least-squares line and its 95% band. */
function Scatter({
  dose,
  dots,
  target,
  rowWord,
}: {
  dose: Dose;
  dots: DoseDots;
  target: number;
  rowWord: string;
}) {
  const students = dots === "students";
  const points: { x: number; y: number; tip: string; n?: number }[] = students
    ? dose.students.map(([x, y]) => ({
        x,
        y,
        tip: `${figure(x)} active minutes a week\n${signedGrades(y)} grade levels this term`,
      }))
    : dose.groups.map((group) => ({
        x: group.minutes,
        y: group.growth,
        n: group.n,
        tip: `${group.name}: means of ${group.n} placed students\n${figure(group.minutes)} active minutes a week\n${signedGrades(group.growth)} grade levels this term`,
      }));
  const fit: Fit | null = students ? dose.studentFit : dose.groupFit;
  const needed = students ? dose.minimum.students : dose.minimum.groups;
  const message = fit
    ? undefined
    : students
      ? `A line needs ${needed} students with a growth reading this term (20 or more answers at the start and now). ${number(dose.placed)} so far.`
      : `A line needs ${needed} ${rowWord === "class" ? "classes" : "schools"} with 3 or more students with a growth reading. ${number(dose.groups.length)} so far.`;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const xMax = Math.max(target * 2, ...xs);
  const bandLows = fit?.band.map((row) => row.low) ?? [];
  const bandHighs = fit?.band.map((row) => row.high) ?? [];
  const yTicks = ticksFor(
    Math.min(0, ...ys, ...bandLows),
    Math.max(0.1, ...ys, ...bandHighs),
  );
  const xTicks = ticksFor(0, xMax);
  const label = fit
    ? `${associationWords(fit, students ? "Students" : rowWord === "class" ? "Classes" : "Schools")} Each dot is a ${students ? "student" : rowWord}.`
    : (message ?? "");
  return (
    <Frame label={label} message={message}>
      {(width) => {
        const x = (value: number) =>
          PAD.left +
          ((value - xTicks[0]!) / (xTicks.at(-1)! - xTicks[0]!)) *
            (width - PAD.left - PAD.right);
        const y = (value: number) =>
          PAD.top +
          (1 - (value - yTicks[0]!) / (yTicks.at(-1)! - yTicks[0]!)) *
            (HEIGHT - PAD.top - PAD.bottom);
        const band = fit!.band;
        const area = [
          ...band.map((row) => `${x(row.x)},${y(row.high)}`),
          ...[...band].reverse().map((row) => `${x(row.x)},${y(row.low)}`),
        ].join(" ");
        return (
          <>
            <Axes
              width={width}
              x={x}
              y={y}
              xTicks={xTicks}
              yTicks={yTicks}
              xLabel="Active minutes a week, this term"
              yLabel="Growth, grade levels"
              xFormat={(value) => number(value)}
              yFormat={signedGrades}
            />
            <polygon points={area} className={styles.doseBand} />
            {points.map((point, index) => (
              <circle
                key={index}
                cx={x(point.x)}
                cy={y(point.y)}
                r={students ? 4 : 4 + Math.min(6, Math.sqrt(point.n ?? 1))}
                className={styles.doseDot}
                style={{ fill: heatColor(heatPosition(point.x, target)) }}
                data-tip={point.tip}
              />
            ))}
            <line
              x1={x(band[0]!.x)}
              x2={x(band.at(-1)!.x)}
              y1={y(band[0]!.fit)}
              y2={y(band.at(-1)!.fit)}
              className={styles.doseLine}
            />
          </>
        );
      }}
    </Frame>
  );
}

const QUARTER_NAMES = ["Q1, least", "Q2", "Q3", "Q4, most"];
/** Mean growth since each student's first placed reading this term, week by
 * week, for the four quarters of students by practice time. */
function Quarters({ dose, weeks, current }: { dose: Dose; weeks: string[]; current: string }) {
  const last = weeks.indexOf(current);
  const quarters = dose.quartiles;
  const message = quarters
    ? undefined
    : `Quarters need ${dose.minimum.students} students with a growth reading this term. ${number(dose.placed)} so far.`;
  const means = quarters?.flatMap((quarter) =>
    quarter.weeks.flatMap((week) => (week ? [week.mean] : [])),
  ) ?? [0];
  const yTicks = ticksFor(Math.min(0, ...means), Math.max(0.1, ...means));
  const shown = weeks.slice(0, last + 1);
  const xTicks = shown.map((_, index) => index);
  return (
    <Frame
      label={
        quarters
          ? `Mean growth by week for four quarters of students by practice time. ${quarters
              .map(
                (quarter, index) =>
                  `${QUARTER_NAMES[index]}: ${figure(quarter.from)} to ${figure(quarter.to)} minutes a week, n ${quarter.n}, ${signedGrades(quarter.weeks[last]?.mean ?? 0)} by this week`,
              )
              .join("; ")}.`
          : (message ?? "")
      }
      message={message}
    >
      {(width) => {
        const x = (index: number) =>
          PAD.left +
          (shown.length < 2 ? 0.5 : index / (shown.length - 1)) *
            (width - PAD.left - PAD.right - 28);
        const y = (value: number) =>
          PAD.top +
          (1 - (value - yTicks[0]!) / (yTicks.at(-1)! - yTicks[0]!)) *
            (HEIGHT - PAD.top - PAD.bottom);
        const every = Math.max(1, Math.ceil(shown.length / Math.max(2, Math.floor(width / 90))));
        const labelled = xTicks.filter(
          (index) => index % every === 0 || index === shown.length - 1,
        );
        return (
          <>
            <Axes
              width={width}
              x={x}
              y={y}
              xTicks={labelled.filter((index, at) =>
                at === labelled.length - 1 || labelled[at + 1]! - index >= every,
              )}
              yTicks={yTicks}
              xLabel="Week of the term"
              yLabel="Mean growth, grade levels"
              xFormat={(index) => shortDay(shown[index]!)}
              yFormat={signedGrades}
            />
            {(() => {
              // End labels a line apart, in the order the lines end.
              const ends = quarters!
                .map((quarter, index) => {
                  const at = quarter.weeks
                    .slice(0, last + 1)
                    .flatMap((week, weekIndex) => (week ? [{ weekIndex, week }] : []))
                    .at(-1);
                  return at ? { index, x: x(at.weekIndex) + 6, y: y(at.week.mean) } : null;
                })
                .filter((end) => end !== null)
                .sort((a, b) => a.y - b.y);
              for (let i = 1; i < ends.length; i++)
                ends[i]!.y = Math.max(ends[i]!.y, ends[i - 1]!.y + 13);
              return ends.map((end) => (
                <text
                  key={`label${end.index}`}
                  x={end.x}
                  y={end.y}
                  dy="0.32em"
                  className={styles.doseQuarterLabel}
                >
                  Q{end.index + 1}
                </text>
              ));
            })()}
            {quarters!.map((quarter, index) => {
              const at = quarter.weeks
                .slice(0, last + 1)
                .flatMap((week, weekIndex) =>
                  week ? [{ weekIndex, week }] : [],
                );
              return (
                <g key={index} data-quarter={index + 1}>
                  <polyline
                    className={styles.doseQuarter}
                    points={at
                      .map(({ weekIndex, week }) => `${x(weekIndex)},${y(week.mean)}`)
                      .join(" ")}
                  />
                  {at.map(({ weekIndex, week }) => (
                    <circle
                      key={weekIndex}
                      cx={x(weekIndex)}
                      cy={y(week.mean)}
                      r={3.5}
                      className={styles.doseQuarterDot}
                      data-tip={`${QUARTER_NAMES[index]} (${figure(quarter.from)}–${figure(quarter.to)} min a week), week of ${shortDay(shown[weekIndex]!)}${weekIndex === last ? ", so far" : ""}\nMean ${signedGrades(week.mean)} grade levels\nn ${week.n} · median ${signedGrades(week.median)} · sd ${week.sd.toFixed(2)}`}
                    />
                  ))}
                </g>
              );
            })}
          </>
        );
      }}
    </Frame>
  );
}

/** "Does more AMP mean more progress?" as data: the dose-response scatter and
 * the quarters over the weeks. Associations only, with their n and interval;
 * no causal claim. */
export function DoseResponse({
  data,
  dots,
  onDots,
  target,
}: {
  data: PracticeResponse;
  dots: DoseDots;
  onDots: (dots: DoseDots) => void;
  target: number;
}) {
  const { dose } = data;
  const rowWord = data.rowKind;
  const fit = dots === "students" ? dose.studentFit : dose.groupFit;
  const x = summarize(dose.students.map(([minutes]) => minutes));
  const y = summarize(dose.students.map(([, growth]) => growth));
  const last = data.weeks.indexOf(data.current);
  return (
    <div className={styles.dose}>
      <figure className={styles.doseFigure}>
        <div className={styles.trendHead}>
          <h3 className={styles.doseTitle}>Minutes a week and growth</h3>
          <div className={styles.trendToggle}>
            <Segmented<DoseDots>
              label="Each dot"
              options={[
                { value: "students", label: "Students" },
                {
                  value: "classes",
                  label: rowWord === "class" ? "Classes" : "Schools",
                },
              ]}
              value={dots}
              compact
              dense
              onChange={onDots}
            />
          </div>
        </div>
        <TipZone>
          <Scatter dose={dose} dots={dots} target={target} rowWord={rowWord} />
        </TipZone>
        <figcaption className={styles.doseCaption}>
          <p className={styles.doseFinding}>
            {fit
              ? associationWords(
                  fit,
                  dots === "students"
                    ? "Students"
                    : rowWord === "class"
                      ? "Classes"
                      : "Schools",
                )
              : "No line yet."}{" "}
            {fit && (
              <span className={styles.doseSlope}>
                Slope {signedGrades(fit.slope * 60)} grade levels per extra
                hour a week. An association, not a measured effect.
              </span>
            )}
          </p>
          {x && y && (
            <>
              <StatsLine label="Minutes a week" {...x} />
              <StatsLine label="Growth, grade levels" {...y} places={2} />
            </>
          )}
        </figcaption>
      </figure>
      <figure className={styles.doseFigure}>
        <div className={styles.trendHead}>
          <h3 className={styles.doseTitle}>Growth over the term, by practice time</h3>
        </div>
        <TipZone>
          <Quarters dose={dose} weeks={data.weeks} current={data.current} />
        </TipZone>
        {dose.quartiles && (
          <figcaption className={styles.doseCaption}>
            <ul className={styles.doseKey}>
              {dose.quartiles.map((quarter, index) => {
                const now = quarter.weeks[last] ?? quarter.weeks[last - 1];
                return (
                  <li key={index}>
                    <span
                      className={styles.doseSwatch}
                      data-quarter={index + 1}
                      aria-hidden="true"
                    />
                    <b>{QUARTER_NAMES[index]}</b> · {figure(quarter.from)}–
                    {figure(quarter.to)} min a week · n {quarter.n}
                    {now
                      ? ` · now ${signedGrades(now.mean)} (median ${signedGrades(now.median)}, sd ${now.sd.toFixed(2)})`
                      : ""}
                  </li>
                );
              })}
            </ul>
            <p className={styles.tableNote}>
              Growth is each student’s latest level minus their first this term
              with 20 or more answers. Quarters are by active minutes a week
              this term.
            </p>
          </figcaption>
        )}
      </figure>
    </div>
  );
}
