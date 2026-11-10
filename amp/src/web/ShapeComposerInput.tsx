import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  inspectShapeStage,
  normalizeShapeAnswer,
  parseShapeAnswer,
  placedCells,
  shapePath,
  type ShapeAnswer,
  type ShapeCell,
  type ShapeComposerResponse,
  type ShapePiece,
  type ShapePlacement,
} from "../math/shape-composer";

export const emptyShapeAnswer = (r: ShapeComposerResponse): ShapeAnswer =>
  r.stages.map(() => []);
const keyOf = (p: Pick<ShapePlacement, "pieceId" | "copy">) =>
  `${p.pieceId}:${p.copy}`;
const fresh = (pieceId: string, copy: number): ShapePlacement => ({
  pieceId,
  copy,
  x: 0,
  y: 0,
  rot: 0,
  flip: false,
});
function contains(c: ShapeCell, x: number, y: number): boolean {
  x -= c.x;
  y -= c.y;
  if (x < 0 || y < 0 || x > 1 || y > 1) return false;
  if (c.fill === "full") return true;
  const corner = c.fill.slice(2);
  if (corner.includes("E")) x = 1 - x;
  if (corner.includes("S")) y = 1 - y;
  return c.fill.startsWith("h:") ? x + y <= 1 : x * x + y * y <= 1;
}
/** Spoken estimate only; grading uses exact symbolic fills. Sampling also
 * handles invalid mixtures of curved and straight pieces without claiming
 * that a partially covered grid cell is completely empty. */
function emptyPercent(target: ShapeCell[], placed: ShapeCell[]): number {
  let total = 0,
    empty = 0;
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 60; x++) {
      const a = (x + 0.5) / 12,
        b = (y + 0.5) / 12;
      if (target.some((c) => contains(c, a, b))) {
        total++;
        if (!placed.some((c) => contains(c, a, b))) empty++;
      }
    }
  return total ? Math.round((empty / total) * 20) * 5 : 0;
}
const turnWords = (p: ShapePlacement) =>
  `${{ 0: "No turn", 90: "A quarter turn clockwise", 180: "A half turn", 270: "Three quarter turns clockwise" }[p.rot]}${p.flip ? ", flipped" : ""}`;

function PieceIcon({
  piece,
  pose,
}: {
  piece: ShapePiece;
  pose: ShapePlacement;
}) {
  const cells = placedCells(piece, { ...pose, x: 0, y: 0 });
  const w = Math.max(...cells.map((c) => c.x)) + 1,
    h = Math.max(...cells.map((c) => c.y)) + 1;
  return (
    <svg
      viewBox={`-.08 -.08 ${w + 0.16} ${h + 0.16}`}
      style={{
        width: `calc(${w + 0.16} * var(--shape-unit))`,
        height: `calc(${h + 0.16} * var(--shape-unit))`,
      }}
      aria-hidden="true"
    >
      <g>
        <path d={shapePath(cells)} data-kind={piece.kind} />
      </g>
    </svg>
  );
}

export function ShapeComposerInput({
  response: r,
  value,
  onChange,
  locked,
  resolved,
  stageIndex,
  setStage,
  answer,
  skipped = false,
}: {
  response: ShapeComposerResponse;
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
  resolved: boolean;
  stageIndex: number;
  setStage: (n: number) => void;
  answer?: string;
  skipped?: boolean;
}) {
  const uid = useId().replaceAll(":", ""),
    board = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ShapePlacement | null>(null),
    [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);
  const [announcement, say] = useState(""),
    [showAnswer, setShowAnswer] = useState(false);
  const drag = useRef<{
    p: ShapePlacement;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const stage = r.stages[stageIndex]!,
    a =
      parseShapeAnswer(r, (showAnswer || skipped) && answer ? answer : value) ??
      emptyShapeAnswer(r),
    placements = a[stageIndex]!;
  const drawn = placements.map((p) => ({
    p,
    piece: stage.tray.find((t) => t.id === p.pieceId)!,
    cells: placedCells(
      stage.tray.find((t) => t.id === p.pieceId)!,
      p,
    ),
  }));
  const cells = drawn.flatMap((d) => d.cells),
    empty = emptyPercent(stage.target, cells);
  const active =
    !resolved && selected
      ? stage.tray.find((p) => p.id === selected.pieceId)
      : undefined;
  const current =
    active && selected
      ? (placements.find((p) => keyOf(p) === keyOf(selected)) ?? selected)
      : null;
  const status = inspectShapeStage(stage, placements);
  const previousCount = useRef(0);
  useEffect(() => {
    if (!resolved && placements.length === 0 && previousCount.current > 0) {
      setSelected(null);
      say("Board reset. Select a piece from the tray.");
    }
    previousCount.current = placements.length;
  }, [placements.length, resolved]);
  const describe = (p: ShapePlacement, verb: string) =>
    `${stage.tray.find((t) => t.id === p.pieceId)!.name} ${p.copy + 1} ${verb}. ${turnWords(p)}. Column ${p.x + 1}, row ${p.y + 1}.`;
  function update(p: ShapePlacement, verb = "placed") {
    if (locked) return;
    const next = [...a];
    next[stageIndex] = [
      ...placements.filter((old) => keyOf(old) !== keyOf(p)),
      p,
    ];
    onChange(normalizeShapeAnswer(r, JSON.stringify(next))!);
    setSelected(p);
    setCursor({ x: p.x, y: p.y });
    say(describe(p, verb));
  }
  function select(p: ShapePlacement) {
    if (locked) return;
    setSelected(p);
    setCursor({ x: p.x, y: p.y });
    say(describe(p, "selected"));
  }
  function turn(flip = false) {
    if (!current || !active || locked) return;
    const p = {
      ...current,
      ...(flip
        ? { flip: !current.flip }
        : { rot: ((current.rot + 90) % 360) as ShapePlacement["rot"] }),
    };
    if (placements.some((old) => keyOf(old) === keyOf(p)))
      update(p, flip ? "flipped" : "turned");
    else {
      setSelected(p);
      say(describe(p, flip ? "flipped" : "turned"));
    }
  }
  function remove() {
    if (!current || locked) return;
    const next = [...a];
    next[stageIndex] = placements.filter((p) => keyOf(p) !== keyOf(current));
    onChange(JSON.stringify(next));
    say(`${active!.name} returned to the tray.`);
    setSelected(null);
  }
  function hitAt(x: number, y: number) {
    return [...drawn]
      .reverse()
      .find((d) => d.cells.some((c) => contains(c, x, y)));
  }
  function boardPoint(clientX: number, clientY: number) {
    const b = board
      .current!.querySelector(".shape-grid")!
      .getBoundingClientRect();
    return {
      x: ((clientX - b.left) / b.width) * 5,
      y: ((clientY - b.top) / b.height) * 4,
    };
  }
  function at(x: number, y: number, point = { x: x + 0.5, y: y + 0.5 }) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (locked) return;
    const hit = hitAt(point.x, point.y);
    if (
      current &&
      placements.some((p) => keyOf(p) === keyOf(current)) &&
      hit &&
      keyOf(hit.p) !== keyOf(current)
    ) {
      select(hit.p);
      return;
    }
    if (current)
      update(
        { ...current, x, y },
        placements.some((p) => keyOf(p) === keyOf(current))
          ? "moved"
          : "placed",
      );
    else {
      if (hit) select(hit.p);
      else {
        setCursor({ x, y });
        say(`Column ${x + 1}, row ${y + 1}. Select a piece from the tray.`);
      }
    }
  }
  function keyboard(e: KeyboardEvent) {
    if (locked) return;
    if (e.key.toLowerCase() === "r" && active?.canRotate) {
      e.preventDefault();
      turn();
    } else if (e.key.toLowerCase() === "f" && active?.canFlip) {
      e.preventDefault();
      turn(true);
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      remove();
    } else if (e.key === "Escape") {
      setSelected(null);
      say("Piece unselected.");
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const x = Math.max(
          0,
          Math.min(
            4,
            cursor.x +
              (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0),
          ),
        ),
        y = Math.max(
          0,
          Math.min(
            3,
            cursor.y +
              (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0),
          ),
        );
      setCursor({ x, y });
      board.current
        ?.querySelector<HTMLButtonElement>(`[data-cell="${x},${y}"]`)
        ?.focus();
      say(
        `Column ${x + 1}, row ${y + 1}. Press Enter to place the selected piece.`,
      );
    }
  }
  function pointerDown(e: PointerEvent, p: ShapePlacement) {
    suppressClick.current = false;
    if (locked || e.button !== 0) return;
    drag.current = { p, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: PointerEvent) {
    if (locked) return;
    const d = drag.current;
    if (d && !d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) {
      d.moved = true;
      setSelected(d.p);
    }
    const point = boardPoint(e.clientX, e.clientY);
    setPreview(
      point.x >= 0 && point.x < 5 && point.y >= 0 && point.y < 4
        ? { x: Math.floor(point.x), y: Math.floor(point.y) }
        : null,
    );
  }
  function pointerUp(e: PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved || locked) return;
    const point = boardPoint(e.clientX, e.clientY),
      x = Math.floor(point.x),
      y = Math.floor(point.y);
    if (x >= 0 && x < 5 && y >= 0 && y < 4) update({ ...d.p, x, y });
    suppressClick.current = true;
    // A drag ends with a synthetic click. Keep it from re-selecting the old pose.
    e.preventDefault();
  }
  return (
    <section
      className="shape-composer"
      data-resolved={resolved || undefined}
      onKeyDown={keyboard}
      aria-label="Shape composer"
    >
      <div
        className="shape-stage-tabs"
        hidden={r.stages.length === 1}
        role="group"
        aria-label="Composition steps"
      >
        {r.stages.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-pressed={stageIndex === i}
            aria-current={stageIndex === i ? "step" : undefined}
            aria-label={
              i === 0
                ? "Step 1: Make the first shape"
                : "Step 2: Use it as one piece"
            }
            disabled={!resolved && stageIndex !== i}
            onClick={() => {
              setStage(i);
              setSelected(null);
            }}
          >
            <span className="shape-step-number" aria-hidden="true">
              {i + 1}
            </span>
            <span>{i === 0 ? "Make a shape" : "Use it as one piece"}</span>
          </button>
        ))}
      </div>
      <p className="shape-instruction">{stage.prompt}</p>
      <div
        className="shape-board"
        ref={board}
        onPointerLeave={() => setPreview(null)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setPreview(null);
        }}
      >
        <svg
          viewBox="-.12 -.12 5.24 4.24"
          aria-hidden="true"
          className="shape-canvas"
        >
          <defs>
            <pattern
              id={`${uid}-hatch`}
              patternUnits="userSpaceOnUse"
              width=".16"
              height=".16"
              patternTransform="rotate(45)"
            >
              <rect width=".16" height=".16" className="shape-error-fill" />
              <path d="M0 0V.16" className="shape-hatch-line" />
            </pattern>
            <clipPath id={`${uid}-outside`}>
              <path
                d={`M0 0H5V4H0Z${shapePath(stage.target)}`}
                clipRule="evenodd"
              />
            </clipPath>
            {drawn.map((d, i) => (
              <clipPath key={i} id={`${uid}-piece-${i}`}>
                <path d={shapePath(d.cells)} />
              </clipPath>
            ))}
          </defs>
          <path d={shapePath(stage.target)} className="shape-target-fill" />
          {drawn.map((d, i) => (
            <path
              key={keyOf(d.p)}
              d={shapePath(d.cells)}
              data-kind={d.piece.kind}
              className="shape-placed"
              data-selected={
                (!resolved && current && keyOf(d.p) === keyOf(current)) ||
                undefined
              }
            />
          ))}
          <g clipPath={`url(#${uid}-outside)`}>
            {drawn.map((d) => (
              <path
                key={keyOf(d.p)}
                d={shapePath(d.cells)}
                fill={`url(#${uid}-hatch)`}
              />
            ))}
          </g>
          {drawn.flatMap((d, i) =>
            drawn
              .slice(i + 1)
              .map((other) => (
                <path
                  key={`${keyOf(d.p)}-${keyOf(other.p)}`}
                  d={shapePath(other.cells)}
                  clipPath={`url(#${uid}-piece-${i})`}
                  fill={`url(#${uid}-hatch)`}
                />
              )),
          )}
          {!resolved && current && preview && (
            <path
              d={shapePath(placedCells(active!, { ...current, ...preview }))}
              data-kind={active!.kind}
              className="shape-cursor"
            />
          )}
          <path d={shapePath(stage.target)} className="shape-target-halo" />
          <path d={shapePath(stage.target)} className="shape-target-edge" />
        </svg>
        <div
          className="shape-grid"
          role="group"
          aria-label="Placement grid, 5 columns and 4 rows"
          aria-describedby={`${uid}-outline`}
        >
          {Array.from({ length: 20 }, (_, i) => {
            const x = i % 5,
              y = Math.floor(i / 5);
            return (
              <button
                type="button"
                key={i}
                data-cell={`${x},${y}`}
                aria-label={`Column ${x + 1}, row ${y + 1}${current ? `, place ${active!.name}` : ""}`}
                tabIndex={
                  resolved ? -1 : cursor.x === x && cursor.y === y ? 0 : -1
                }
                disabled={locked}
                onFocus={() => {
                  setCursor({ x, y });
                  setPreview({ x, y });
                }}
                onClick={(e) =>
                  at(
                    x,
                    y,
                    e.detail ? boardPoint(e.clientX, e.clientY) : undefined,
                  )
                }
                onPointerDown={(e) => {
                  const point = boardPoint(e.clientX, e.clientY),
                    hit = hitAt(point.x, point.y);
                  if (hit) pointerDown(e, hit.p);
                }}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              />
            );
          })}
        </div>
      </div>
      <div className="shape-tray" role="group" aria-label="Piece tray">
        {stage.tray.flatMap((piece) =>
          Array.from({ length: piece.copies }, (_, copy) => {
            const p =
              placements.find(
                (p) => p.pieceId === piece.id && p.copy === copy,
              ) ??
              (selected?.pieceId === piece.id && selected.copy === copy
                ? selected
                : fresh(piece.id, copy));
            const used = placements.some(
              (p) => p.pieceId === piece.id && p.copy === copy,
            );
            return (
              <button
                type="button"
                key={keyOf(p)}
                data-piece={keyOf(p)}
                data-placed={used || undefined}
                disabled={locked}
                aria-label={`${piece.name} ${copy + 1}${used ? ", on the board" : ""}. ${turnWords(p)}.`}
                aria-pressed={
                  !resolved && !!current && keyOf(p) === keyOf(current)
                }
                onClick={() => {
                  if (suppressClick.current) suppressClick.current = false;
                  else select(p);
                }}
                onPointerDown={(e) => pointerDown(e, p)}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              >
                <div className="shape-piece-icon">
                  <PieceIcon piece={piece} pose={p} />
                </div>
                <span>{piece.name}</span>
                {used && (
                  <span className="shape-piece-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
      <div className="shape-tools">
        <button
          type="button"
          disabled={locked || !active?.canRotate}
          onClick={() => turn()}
          aria-label="Turn selected piece clockwise"
        >
          ↻ Turn
        </button>
        {stage.tray.some((p) => p.canFlip) && (
          <button
            type="button"
            disabled={locked || !active?.canFlip}
            onClick={() => turn(true)}
          >
            ↔ Flip
          </button>
        )}
        <button
          type="button"
          disabled={
            locked ||
            !current ||
            !placements.some((p) => keyOf(p) === keyOf(current))
          }
          onClick={remove}
        >
          Remove
        </button>
        {resolved && answer && !skipped && (
          <button type="button" onClick={() => setShowAnswer(!showAnswer)}>
            {showAnswer ? "Your pieces" : "Show one way"}
          </button>
        )}
      </div>
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {resolved
          ? `Shape ${stageIndex + 1}. ${showAnswer || skipped ? "One way to fill the outline" : "Your arrangement"}. ${placements.map((p) => describe(p, "placed")).join(" ")}`
          : announcement}{" "}
        About {empty}% of the outline is empty.{" "}
        {status.overlap ? "Pieces overlap." : ""}{" "}
        {status.outside ? "A piece sticks out." : ""}
      </span>
      <span className="sr-only">
        Arrow keys choose a grid space. Enter places. R turns, F flips, Delete
        removes. Escape unselects. Grid positions name the top-left cell of a
        piece.
      </span>
      <span className="sr-only" id={`${uid}-outline`}>
        Outline:{" "}
        {stage.target
          .map(
            (c) =>
              `column ${c.x + 1}, row ${c.y + 1}, ${c.fill === "full" ? "full square" : `${c.fill.startsWith("h:") ? "triangle" : "quarter-circle"} at the ${{ NW: "top left", NE: "top right", SW: "bottom left", SE: "bottom right" }[c.fill.slice(2) as "NW" | "NE" | "SW" | "SE"]} corner`}`,
          )
          .join("; ")}
        .
      </span>
    </section>
  );
}

export function ShapeComposerAnswer({
  response: r,
  value,
  onChange,
  locked,
  sending,
  submit,
  stageIndex,
  setStage,
}: {
  response: ShapeComposerResponse;
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
  sending: boolean;
  submit: () => void;
  stageIndex: number;
  setStage: (n: number) => void;
}) {
  const a = parseShapeAnswer(r, value) ?? emptyShapeAnswer(r),
    hasPieces = a[stageIndex]!.length > 0;
  return (
    <form
      className="shape-answer"
      onSubmit={(e) => {
        e.preventDefault();
        if (locked || !hasPieces) return;
        if (
          stageIndex < r.stages.length - 1 &&
          inspectShapeStage(r.stages[stageIndex]!, a[stageIndex]!).ok
        )
          setStage(stageIndex + 1);
        else submit();
      }}
    >
      <button
        type="button"
        className="secondary"
        disabled={locked || !hasPieces}
        onClick={() => {
          const next = [...a];
          next[stageIndex] = [];
          onChange(JSON.stringify(next));
        }}
      >
        Reset
      </button>
      <button
        type="submit"
        className="choice-submit"
        disabled={locked || !hasPieces}
        aria-busy={sending}
      >
        {stageIndex < r.stages.length - 1 ? "Join pieces" : "Check"}
      </button>
    </form>
  );
}
