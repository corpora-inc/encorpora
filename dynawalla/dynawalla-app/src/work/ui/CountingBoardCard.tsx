import { IndexMark } from "../../design/IndexMark.tsx"
import { fill, strings } from "../../app/strings.ts"
import type { BoardCheck, BoardColumn, CountingBoard } from "../contrast.ts"

/**
 * The Stage-2 LOCATE contrast pair.
 *
 * Two boards over **one** column set. The sockets carved in the stone are the
 * number the problem started from; the counters are what that answer plus the
 * subtrahend comes to. The correct answer fills every socket and no more; the
 * child's fills them too and has a counter left over — the thousand borrowed and
 * never given up, standing proud of the board.
 *
 * The shared column set is load-bearing, not tidiness: a plate that omits its
 * empty leading places puts its hundreds under the other's thousands, and the
 * comparison the card exists to make is gone. Every place in `board.places` is
 * drawn on both plates, empty or not.
 *
 * Nothing here names a misconception, says a step was missed, or tells the child
 * they were wrong (M-16). `Q-10`: a counter that seats is a disc, one that cannot
 * is a diamond outside the run — shape and position, never colour — and each
 * plate is a `role="img"` carrying the whole board in words, counts and all.
 */
export function CountingBoardCard({ board }: { board: CountingBoard }) {
  return (
    <div className="dw-present flex flex-col gap-4">
      <p className="numeral text-ink text-xl">
        {board.minuend}{" "}
        <span aria-hidden="true">−</span>
        <span className="sr-only">{strings.practice.minus}</span> {board.subtrahend}
      </p>
      <p className="text-ink-muted text-sm tracking-wide">{strings.practice.rebuild}</p>

      <div className="flex flex-col gap-4 sm:flex-row">
        <BoardPlate board={board} check={board.correct} />
        <BoardPlate board={board} check={board.yours} />
      </div>
    </div>
  )
}

/**
 * One plate, in words: the sum, then every place that holds anything, then the
 * counters with nowhere to sit — or the fact that there are none. Empty places
 * are drawn (the columns must line up) and skipped here (silence is not a column).
 */
function plateLabel(board: CountingBoard, check: BoardCheck): string {
  const parts = [
    fill(strings.practice.boardSum, {
      addend: check.addend,
      subtrahend: board.subtrahend,
      sum: check.sum,
    }),
  ]
  for (const column of check.columns) {
    if (column.sockets > 0) {
      parts.push(
        fill(strings.practice.boardPlace, {
          place: placeLabel(column.place),
          seated: column.seated,
          sockets: column.sockets,
        }),
      )
    }
  }
  for (const column of check.columns) {
    if (column.spare > 0) {
      parts.push(
        fill(strings.practice.boardSpare, {
          place: placeLabel(column.place),
          spare: column.spare,
        }),
      )
    }
  }
  if (check.rebuilds) parts.push(strings.practice.boardCloses)
  return parts.join(" ")
}

function BoardPlate({ board, check }: { board: CountingBoard; check: BoardCheck }) {
  return (
    <div
      // `role="img"`: the plate is a picture and this is its alternative. Under
      // that role the descendants are presentational, so the numerals and place
      // labels are not read a second time in a different order.
      role="img"
      aria-label={plateLabel(board, check)}
      className="border-line-cut rounded-cut-md bg-ground-sunk flex-1 border-t border-b p-3"
    >
      {/* Explicitly presentational. `role="img"` makes descendants presentational
          by the ARIA spec, but Chrome still lists every numeral in the tree it
          hands a driver, so the drawing is hidden outright and the label above is
          the only thing exposed. */}
      <p aria-hidden="true" className="numeral text-ink mb-3 flex items-center gap-2 text-lg">
        <span>
          {check.addend} + {board.subtrahend} ={" "}
          <span className={check.rebuilds ? "text-seat" : "text-strike"}>{check.sum}</span>
        </span>
        {check.rebuilds ? <IndexMark className="text-seat" /> : null}
      </p>

      {/* `items-stretch` so every column is as tall as the tallest and the place
          labels land on one line. A place with nothing in it — the tens of
          606 — is then an empty column with a floor, which is what it is,
          rather than a label floating at the top of the board. */}
      <div aria-hidden="true" className="flex items-stretch justify-start gap-1 overflow-x-auto">
        {check.columns.map((column) => (
          <PlaceColumn key={column.place} column={column} />
        ))}
      </div>
    </div>
  )
}

/**
 * One place value: the sockets cut for it, the counters dropped into them, and
 * anything left over sitting above the run with nowhere to go.
 */
function PlaceColumn({ column }: { column: BoardColumn }) {
  return (
    <div className="flex min-w-10 flex-col items-center justify-end gap-1 px-1">
      {range(column.spare).map((i) => (
        <span
          key={`spare-${String(i)}`}
          className="border-strike bg-ground-raised mb-2 block size-4 rotate-45 border-2"
        />
      ))}
      {range(column.seated).map((i) => (
        <span
          key={`seated-${String(i)}`}
          className="border-line-cut bg-index block size-4 rounded-full border"
        />
      ))}
      {range(column.sockets - column.seated).map((i) => (
        <span
          key={`empty-${String(i)}`}
          className="border-line-cut block size-4 rounded-full border border-dashed"
        />
      ))}
      <span className="numeral text-ink-muted border-line mt-1 w-full border-t pt-1 text-center text-xs">
        {placeLabel(column.place)}
      </span>
    </div>
  )
}

/** The place written as the unit it holds: 1, 10, 100, 1000. */
function placeLabel(place: number): string {
  return `1${"0".repeat(place)}`
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}
