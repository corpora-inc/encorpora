import { useLayoutEffect, useId, useRef, useState } from "react";
import {
  loopSticks,
  parsePegBoard,
  pegBoardAnswerText,
  pegPoint,
  pegTopology,
  stickKey,
  type PegBoardResponse,
  type Stick,
} from "../math/peg-board";

const pegName = (id: number) =>
  `row ${Math.floor(id / 5) + 1}, column ${(id % 5) + 1}`;
const position = (id: number) => {
  const [x, y] = pegPoint(id);
  return [10 + x * 20, 10 + y * 20];
};
export function PegBoardInput({
  response: r,
  value,
  onChange,
  locked,
  resolved,
  resetKey,
}: {
  response: PegBoardResponse;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  resolved: boolean;
  resetKey: number;
}) {
  const a = parsePegBoard(r, value) ?? { sticks: r.given };
  const [selected, select] = useState<number | null>(null),
    [cursor, setCursor] = useState(0);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [announcement, announce] = useState("");
  const pegs = useRef<(HTMLButtonElement | null)[]>([]),
    drag = useRef<number | null>(null),
    suppressClick = useRef(false);
  const id = useId();
  useLayoutEffect(() => {
    select(null);
    setDragStart(null);
    drag.current = null;
    announce(
      `Board reset. ${pegBoardAnswerText(r, JSON.stringify({ sticks: r.given }))}`,
    );
  }, [resetKey, r]);
  const provisional = !locked ? (dragStart ?? selected) : null;
  const topology = pegTopology(a.sticks);
  function change(sticks: Stick[], message: string) {
    const raw = JSON.stringify({ sticks });
    onChange(raw);
    announce(`${message} ${pegBoardAnswerText(r, raw)}`);
    select(null);
  }
  function connect(from: number, to: number) {
    if (locked || from === to) {
      select(null);
      return;
    }
    const edge: Stick = [from, to],
      key = stickKey(edge);
    if (a.sticks.some((s) => stickKey(s) === key)) {
      remove(edge);
      return;
    }
    if (a.sticks.length >= r.maxSticks) {
      announce("Tap a stick to remove it before adding another.");
      select(null);
      return;
    }
    change([...a.sticks, edge], `Joined ${pegName(from)} to ${pegName(to)}.`);
  }
  function tap(peg: number) {
    if (locked) return;
    if (selected === null) {
      select(peg);
      announce(`Start at ${pegName(peg)}. Choose the other end.`);
    } else connect(selected, peg);
  }
  function remove(edge: Stick) {
    if (locked || r.given.some((s) => stickKey(s) === stickKey(edge))) return;
    change(
      a.sticks.filter((s) => stickKey(s) !== stickKey(edge)),
      "Removed one stick.",
    );
  }
  function release(event: React.PointerEvent) {
    const from = drag.current;
    drag.current = null;
    setDragStart(null);
    if (from === null) return;
    const node = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-peg]");
    const to = node ? Number(node.dataset.peg) : from;
    if (to !== from) {
      suppressClick.current = true;
      connect(from, to);
    }
  }
  return (
    <section
      className="peg-builder"
      aria-label={r.label}
      data-resolved={resolved}
      data-skin={r.skin}
    >
      <p id={`${id}-help`} className="peg-help">
        Tap two pegs to join them. Tap a stick to remove it.
      </p>
      <div className="peg-workbench">
        {r.copy && (
          <figure className="peg-reference">
            <svg
              viewBox="0 0 100 100"
              role="img"
              aria-label={`Shape to copy. Corners at ${r.copy.pegs.map(pegName).join("; ")}. ${r.copy.allowRotation ? "You may turn it." : "Keep it the same way up."}`}
            >
              {loopSticks(r.copy.pegs).map(([a, b], i) => (
                <line
                  key={i}
                  x1={position(a)[0]}
                  y1={position(a)[1]}
                  x2={position(b)[0]}
                  y2={position(b)[1]}
                  className="peg-reference-side"
                />
              ))}
              {Array.from({ length: 25 }, (_, i) => (
                <circle
                  key={i}
                  cx={position(i)[0]}
                  cy={position(i)[1]}
                  r="2.6"
                  className="peg-reference-dot"
                />
              ))}
            </svg>
          </figure>
        )}
        <div
          className="peg-board"
          onPointerUp={release}
          onPointerCancel={() => {
            drag.current = null;
            setDragStart(null);
            select(null);
          }}
        >
          <svg className="peg-sticks" viewBox="0 0 100 100">
            {a.sticks.map((edge) => {
              const [x1, y1] = position(edge[0]),
                [x2, y2] = position(edge[1]);
              const given = r.given.some((s) => stickKey(s) === stickKey(edge));
              return (
                <g
                  key={stickKey(edge)}
                  className="peg-remove"
                  data-stick={stickKey(edge)}
                  role="button"
                  tabIndex={locked || given ? -1 : 0}
                  aria-disabled={locked || given}
                  aria-label={`${given ? "Placed" : "Remove"} stick from ${pegName(edge[0])} to ${pegName(edge[1])}`}
                  onClick={() => remove(edge)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      remove(edge);
                      pegs.current[edge[0]]?.focus({ preventScroll: true });
                    }
                  }}
                >
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    className="peg-stick-hit"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} className="peg-stick" />
                </g>
              );
            })}
          </svg>
          <div
            className="peg-grid"
            role="grid"
            aria-label="Five rows of five pegs"
            aria-describedby={`${id}-help ${id}-keys`}
          >
            {Array.from({ length: 5 }, (_, y) => (
              <div key={y} role="row">
                {Array.from({ length: 5 }, (_, x) => {
                  const peg = y * 5 + x;
                  return (
                    <div key={peg} role="gridcell">
                      <button
                        type="button"
                        data-peg={peg}
                        ref={(el) => {
                          pegs.current[peg] = el;
                        }}
                        disabled={locked}
                        tabIndex={cursor === peg ? 0 : -1}
                        aria-label={`Peg ${pegName(peg)}`}
                        aria-pressed={provisional === peg}
                        onFocus={() => setCursor(peg)}
                        onClick={() => {
                          if (suppressClick.current) {
                            suppressClick.current = false;
                            return;
                          }
                          tap(peg);
                        }}
                        onPointerDown={(e) => {
                          suppressClick.current = false;
                          if (r.skin === "draw" && !locked) {
                            drag.current = peg;
                            setDragStart(peg);
                            e.currentTarget.setPointerCapture(e.pointerId);
                          }
                        }}
                        onKeyDown={(e) => {
                          const next =
                            e.key === "ArrowRight"
                              ? y * 5 + Math.min(4, x + 1)
                              : e.key === "ArrowLeft"
                                ? y * 5 + Math.max(0, x - 1)
                                : e.key === "ArrowDown"
                                  ? Math.min(4, y + 1) * 5 + x
                                  : e.key === "ArrowUp"
                                    ? Math.max(0, y - 1) * 5 + x
                                    : e.key === "Home"
                                      ? y * 5
                                      : e.key === "End"
                                        ? y * 5 + 4
                                        : null;
                          if (next !== null) {
                            e.preventDefault();
                            pegs.current[next]?.focus({ preventScroll: true });
                          }
                          if (e.key === "Escape") {
                            select(null);
                            announce("Start cleared.");
                          }
                        }}
                      >
                        <span className="peg-ball" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="peg-counts" aria-hidden="true">
        <span>{a.sticks.length} sticks</span>
        <span>{topology.corners} corners</span>
        <span>{topology.cycle.length ? "Closed" : "Open"}</span>
      </div>
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement || pegBoardAnswerText(r, JSON.stringify(a))}
      </span>
      <span className="sr-only" id={`${id}-keys`}>
        Use arrow keys to move between pegs. Enter or Space chooses each end of
        a stick. Escape clears the start. Tab reaches placed sticks; Enter
        removes one.
      </span>
    </section>
  );
}
export function PegBoardAnswer({
  response,
  value,
  reset,
  locked,
  sending,
  submit,
}: {
  response: PegBoardResponse;
  value: string;
  reset: () => void;
  locked: boolean;
  sending: boolean;
  submit: () => void;
}) {
  const a = parsePegBoard(response, value),
    count = a?.sticks.length ?? response.given.length;
  return (
    <form
      className="peg-board-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked && a && count >= 1) submit();
      }}
    >
      <button
        className="secondary"
        type="button"
        disabled={locked}
        onClick={reset}
      >
        Reset
      </button>
      <button
        className="choice-submit"
        type="submit"
        disabled={locked || !a || count < 1}
        aria-busy={sending}
      >
        Check
      </button>
    </form>
  );
}
