import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  linePlotCounts,
  linePlotValues,
  normalizeLinePlotBuild,
  type LinePlotBuildResponse,
} from "../math/line-plot-build";

type Props = {
  response: LinePlotBuildResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  answer?: string;
  skipped?: boolean;
};

/** The drawing has a fixed six-row capacity. Counts and feedback have reserved
 * rows too, so placing, removing, resetting and grading never resize it. */
export function LinePlotBuildDrawing({
  response,
  value,
  answer,
  print = false,
}: {
  response: LinePlotBuildResponse;
  value: string;
  answer?: string;
  /** Paper: the marks and values only. The count under each value is the
   * screen's running total of taps; on paper it would read "0 Xs" under an
   * empty plot, and the box ends below the values. */
  print?: boolean;
}) {
  const counts = linePlotCounts(response, value),
    values = linePlotValues(response);
  const expected =
    answer === undefined ? null : linePlotCounts(response, answer);
  const step = 352 / values.length;
  return (
    <svg
      className="line-build-drawing"
      viewBox={print ? "0 0 360 224" : "0 0 360 264"}
      aria-hidden="true"
      style={{
        width: "100%",
        maxWidth: "36rem",
        height: "auto",
        display: "block",
      }}
    >
      <line
        x1="4"
        y1="188"
        x2="356"
        y2="188"
        stroke="currentColor"
        strokeWidth="2"
      />
      {values.map((v, i) => {
        const x = 4 + step * (i + 0.5),
          count = counts[v] ?? 0;
        return (
          <g key={v}>
            <line
              x1={x}
              y1="182"
              x2={x}
              y2="194"
              stroke="currentColor"
              strokeWidth="2"
            />
            {Array.from({ length: count }, (_, j) => (
              <path
                key={j}
                className="line-build-x"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                d={`M${x - 7},${168 - j * 27 - 7} l14,14 m0,-14 l-14,14`}
              />
            ))}
            <text
              x={x}
              y="215"
              textAnchor="middle"
              fontSize="20"
              fill="currentColor"
              className="line-build-value"
            >
              {v}
            </text>
            {!print && (
              <text
                x={x}
                y="237"
                textAnchor="middle"
                fontSize="14"
                fill="currentColor"
                className="line-build-count"
              >
                {count} X{count === 1 ? "" : "s"}
              </text>
            )}
            {expected && (
              <text
                x={x}
                y="258"
                textAnchor="middle"
                fontSize="14"
                fill="currentColor"
                className="line-build-expected"
              >
                {(expected[v] ?? 0) === count
                  ? "✓"
                  : `Need ${expected[v] ?? 0}`}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function LinePlotBuildInput({
  response,
  value,
  onChange,
  locked,
  answer,
  skipped,
}: Props) {
  const values = linePlotValues(response),
    counts = linePlotCounts(response, value);
  const [selected, select] = useState(0);
  const [announcement, announce] = useState("");
  const columns = useRef<(HTMLDivElement | null)[]>([]);
  const id = useId();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const v = values[selected] ?? values[0]!,
    count = counts[v] ?? 0;
  const progress = (n: number) =>
    response.measurementCount === undefined
      ? `${n} Xs placed`
      : `${n} of ${response.measurementCount} placed`;
  useEffect(() => {
    if (total === 0) announce(`Plot empty. ${progress(0)}.`);
  }, [total]);
  function change(index: number, delta: number) {
    if (locked) return;
    select(index);
    const at = values[index]!,
      before = counts[at] ?? 0;
    const after = Math.max(0, Math.min(response.maxPerValue, before + delta));
    onChange(
      normalizeLinePlotBuild(
        response,
        JSON.stringify({ counts: { ...counts, [at]: after } }),
      )!,
    );
    announce(
      `${at} ${response.axis.unit}, ${after} ${after === 1 ? "X" : "Xs"}. ${progress(total + after - before)}.${after === response.maxPerValue ? " Column full." : ""}`,
    );
  }
  function move(index: number) {
    const next = Math.max(0, Math.min(values.length - 1, index));
    select(next);
    columns.current[next]?.focus({ preventScroll: true });
  }
  function key(event: KeyboardEvent, index: number) {
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "ArrowUp",
        "ArrowDown",
        "+",
        "-",
        "Enter",
        " ",
        "Backspace",
        "Delete",
      ].includes(event.key)
    )
      event.preventDefault();
    if (event.key === "ArrowLeft") move(index - 1);
    if (event.key === "ArrowRight") move(index + 1);
    if (event.key === "Home") move(0);
    if (event.key === "End") move(values.length - 1);
    if (["ArrowUp", "+", "Enter", " "].includes(event.key)) change(index, 1);
    if (["ArrowDown", "-", "Backspace", "Delete"].includes(event.key))
      change(index, -1);
  }
  return (
    <section className="line-build" aria-labelledby={`${id}-label`}>
      <h3 id={`${id}-label`}>{response.label}</h3>
      <p id={`${id}-help`} className="line-build-help">
        Tap above a number to add an X. Tap its top X to remove it.
      </p>
      <div className="line-build-canvas">
        <LinePlotBuildDrawing
          response={response}
          value={value}
          answer={answer}
        />
        <div
          className="line-build-columns"
          role="group"
          aria-label="Line plot"
          aria-describedby={`${id}-help`}
        >
          {values.map((number, index) => (
            <div
              key={number}
              ref={(node) => {
                columns.current[index] = node;
              }}
              className="line-build-column"
              role="group"
              tabIndex={selected === index ? 0 : -1}
              data-selected={!locked && selected === index}
              aria-disabled={locked}
              aria-label={`${number} ${response.axis.unit}, ${counts[number] ?? 0} Xs${answer === undefined ? "" : `, correct count ${linePlotCounts(response, answer)[number] ?? 0}`}`}
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter Space Backspace + -"
              onFocus={() => select(index)}
              onKeyDown={(event) => key(event, index)}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const y = event.clientY - rect.top;
                const top =
                  ((168 - ((counts[number] ?? 0) - 1) * 27) * rect.height) /
                  188;
                const removeTop = Math.max(
                  0,
                  Math.min(top - 22, rect.height - 44),
                );
                change(
                  index,
                  (counts[number] ?? 0) > 0 &&
                    y >= removeTop &&
                    y <= removeTop + 44
                    ? -1
                    : 1,
                );
              }}
            />
          ))}
        </div>
      </div>
      <p className="line-build-unit">{response.axis.unit}</p>
      <div
        className="line-build-stepper"
        role="group"
        aria-label="Edit a column"
      >
        <button
          type="button"
          aria-label="Previous value"
          disabled={locked || selected === 0}
          onClick={() => move(selected - 1)}
        >
          ←
        </button>
        <button
          type="button"
          aria-label={`Remove X at ${v}`}
          disabled={locked || count === 0}
          onClick={() => change(selected, -1)}
        >
          −
        </button>
        <span>
          <strong>{v}</strong>
          <small>
            {count} {count === 1 ? "X" : "Xs"}
          </small>
        </span>
        <button
          type="button"
          aria-label={`Add X at ${v}`}
          disabled={locked || count === response.maxPerValue}
          onClick={() => change(selected, 1)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Next value"
          disabled={locked || selected === values.length - 1}
          onClick={() => move(selected + 1)}
        >
          →
        </button>
      </div>
      <p className="line-build-status">
        {answer === undefined
          ? progress(total)
          : skipped
            ? "The completed plot is shown."
            : "Your Xs are shown. Correct counts are below each number."}
      </p>
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>
      <span className="sr-only">
        Left and right arrows move between values. Enter, Space, up arrow or
        plus adds an X. Backspace, down arrow or minus removes one.
      </span>
    </section>
  );
}

export function LinePlotBuildAnswer({
  response,
  value,
  onChange,
  locked,
  busy,
  sending,
  resolved,
  submit,
}: {
  response: LinePlotBuildResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  busy: boolean;
  sending: boolean;
  resolved: boolean;
  submit: () => void;
}) {
  const total = Object.values(linePlotCounts(response, value)).reduce(
    (a, b) => a + b,
    0,
  );
  return (
    <form
      className="line-build-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!locked && total > 0) submit();
      }}
    >
      <button
        className="secondary"
        type="button"
        disabled={locked || total === 0}
        onClick={() => onChange('{"counts":{}}')}
      >
        Reset
      </button>
      <button
        className="choice-submit"
        type="submit"
        disabled={locked || busy || resolved || total === 0}
        aria-busy={sending}
      >
        Check
      </button>
    </form>
  );
}
