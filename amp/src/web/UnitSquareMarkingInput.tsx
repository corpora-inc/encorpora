import React, {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  unitSquareRowDescription,
  type UnitSquareMarkingResponse,
} from "../math/unit-square-marking";

/** Marks are intentionally local, optional scratch work, independent of the answer. */
export function UnitSquareMarkingInput({
  response,
  locked,
  resolved,
  resetKey,
}: {
  response: UnitSquareMarkingResponse;
  locked: boolean;
  resolved: boolean;
  resetKey: number;
}) {
  const [marks, setMarks] = useState<Set<number>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");
  const [cursor, setCursor] = useState(0);
  const refs = useRef(new Map<number, HTMLButtonElement>());
  const help = useId();
  const description = useId();
  const shaded = new Set(
    response.cells.map(([col, row]) => row * response.cols + col),
  );
  const first = response.cells[0]![1] * response.cols + response.cells[0]![0];
  const active = response.showEmptyGrid || shaded.has(cursor) ? cursor : first;
  // Set iteration preserves tap order; removing a mark closes the numbering gap.
  const numbers = new Map([...marks].map((index, order) => [index, order + 1]));
  useEffect(() => {
    setMarks(new Set());
    setAnnouncement("");
  }, [resetKey, resolved]);
  function move(index: number, direction: string) {
    let col = index % response.cols,
      row = Math.floor(index / response.cols);
    const [dx, dy] =
      direction === "ArrowLeft"
        ? [-1, 0]
        : direction === "ArrowRight"
          ? [1, 0]
          : direction === "ArrowUp"
            ? [0, -1]
            : [0, 1];
    // Uncovered cells in a tiled surface are absent; arrows skip them along the row/column.
    for (;;) {
      col += dx!;
      row += dy!;
      if (col < 0 || col >= response.cols || row < 0 || row >= response.rows)
        return;
      const next = row * response.cols + col;
      if (response.showEmptyGrid || shaded.has(next)) {
        setCursor(next);
        refs.current.get(next)?.focus({ preventScroll: true });
        refs.current
          .get(next)
          ?.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
    }
  }
  return (
    <section
      className="square-marking"
      data-resolved={resolved}
      aria-label="Count unit squares"
    >
      <div className="square-marking-legend">
        <span
          className="square-marking-swatch"
          data-tile={response.tile}
          aria-hidden="true"
        />
        <span>{response.unit}</span>
      </div>
      <p id={help} className="square-marking-help">
        Tap squares to number them. Tap again to undo.
      </p>
      <p id={description} className="sr-only">
        {unitSquareRowDescription(response)} Use arrow keys to move. Enter or
        Space marks or unmarks a square. Numbers follow the order you tap;
        removing a mark renumbers later squares. When you have counted every
        shaded square, the last number is the area. Only the area you enter is
        checked.
      </p>
      <div
        className="square-marking-grid"
        role="group"
        aria-label="Unit squares"
        aria-describedby={`${help} ${description}`}
        style={{ "--square-columns": response.cols } as CSSProperties}
      >
        {Array.from({ length: response.rows * response.cols }, (_, index) => {
          const col = index % response.cols,
            row = Math.floor(index / response.cols);
          const inside = shaded.has(index),
            number = numbers.get(index),
            marked = number !== undefined;
          const location = `Square at row ${row + 1}, column ${col + 1}`;
          if (!inside && !response.showEmptyGrid)
            return <span key={index} aria-hidden="true" />;
          const edges = inside
            ? {
                borderTopWidth: !shaded.has(index - response.cols) ? 2 : 0,
                borderBottomWidth: !shaded.has(index + response.cols) ? 2 : 0,
                borderLeftWidth: col === 0 || !shaded.has(index - 1) ? 2 : 0,
                borderRightWidth:
                  col === response.cols - 1 || !shaded.has(index + 1) ? 2 : 0,
              }
            : undefined;
          return (
            <button
              type="button"
              key={index}
              className="square-marking-cell"
              ref={(node) => {
                if (node) refs.current.set(index, node);
                else refs.current.delete(index);
              }}
              data-col={col}
              data-row={row}
              data-shaded={inside}
              data-tile={response.tile}
              aria-label={`${location}, ${marked ? `number ${number}` : "not marked"}, ${inside ? "shaded" : "unshaded"}`}
              aria-pressed={marked}
              aria-disabled={locked}
              tabIndex={resolved ? -1 : index === active ? 0 : -1}
              onFocus={() => setCursor(index)}
              onKeyDown={(event) => {
                if (event.key.startsWith("Arrow")) {
                  event.preventDefault();
                  if (!locked) move(index, event.key);
                }
              }}
              onClick={() => {
                if (locked) return;
                setCursor(index);
                const next = new Set(marks);
                if (marked) next.delete(index);
                else next.add(index);
                setMarks(next);
                setAnnouncement(
                  marked
                    ? `${location}, unmarked. Later squares renumbered. `
                    : `${location}, number ${next.size}. `,
                );
              }}
            >
              {inside && (
                <span
                  className="square-marking-boundary"
                  style={edges}
                  aria-hidden="true"
                />
              )}
              {inside && response.tile !== "square" && (
                <svg
                  className="square-marking-tile"
                  viewBox="0 0 44 44"
                  aria-hidden="true"
                >
                  {response.tile === "sticky" ? (
                    <path d="M5 5H39V29L29 39H5ZM29 39V29H39" />
                  ) : response.tile === "cracker" ? (
                    <>
                      <rect x="5" y="5" width="34" height="34" rx="4" />
                      {[14, 22, 30].flatMap((x) =>
                        [14, 22, 30].map((y) => (
                          <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />
                        )),
                      )}
                    </>
                  ) : (
                    <>
                      <rect x="5" y="5" width="34" height="34" />
                      {response.tile === "napkin" && <path d="M5 5L39 39" />}
                      {response.tile === "card" && (
                        <path d="M10 28H34M10 32H34" />
                      )}
                    </>
                  )}
                </svg>
              )}
              <span
                className="square-marking-mark"
                data-marked={marked}
                aria-hidden="true"
              >
                {number}
              </span>
            </button>
          );
        })}
      </div>
      <div className="square-marking-tools" aria-hidden={resolved || undefined}>
        <output role="status" aria-live="polite" aria-atomic="true">
          <span className="sr-only">{announcement}</span>
          <span className="square-marking-count">
            <strong>{marks.size}</strong> marked
          </span>
        </output>
        <button
          type="button"
          className="secondary"
          disabled={locked || marks.size === 0}
          onClick={() => {
            setMarks(new Set());
            setAnnouncement("Marks reset. ");
          }}
        >
          Reset marks
        </button>
      </div>
    </section>
  );
}
