import { IndexMark } from "../../design/IndexMark.tsx"
import { strings } from "../../app/strings.ts"
import type { BoardCheck, BoardColumn, CountingBoard } from "../contrast.ts"

/**
 * The Stage-2 LOCATE contrast pair.
 *
 * Two boards. On each, the sockets carved into the stone are the number the
 * problem started from, and the counters are what that answer plus the
 * subtrahend actually comes to. The correct answer fills every socket and no
 * more. The child's answer leaves one counter with nowhere to sit — the thousand
 * that was borrowed and never given up, standing proud of the board.
 *
 * The contradiction is a thing you can see, and it is *the child's own procedure*
 * carried through to where it stops closing. Nothing here names a misconception,
 * says a step was missed, or tells the child they were wrong (M-16): the boards
 * go side by side and the arithmetic is left to do the talking.
 *
 * A counter that seats is a disc; one that cannot is a diamond, outside the
 * socket run. Shape and position, not colour, carry it (`Q-10`).
 */
export function CountingBoardCard({ board }: { board: CountingBoard }) {
  return (
    <div className="dw-present flex flex-col gap-4">
      <p className="numeral text-ink text-xl">
        {board.minuend} <span aria-hidden="true">−</span> {board.subtrahend}
      </p>
      <p className="text-ink-muted text-sm tracking-wide">{strings.practice.rebuild}</p>

      <div className="flex flex-col gap-4 sm:flex-row">
        <BoardPlate board={board} check={board.correct} />
        <BoardPlate board={board} check={board.yours} />
      </div>
    </div>
  )
}

function BoardPlate({ board, check }: { board: CountingBoard; check: BoardCheck }) {
  return (
    <div className="border-line-cut rounded-cut-md bg-ground-sunk flex-1 border-t border-b p-3">
      <p className="numeral text-ink mb-3 flex items-center gap-2 text-lg">
        <span>
          {check.addend} <span aria-hidden="true">+</span> {board.subtrahend} ={" "}
          <span className={check.rebuilds ? "text-seat" : "text-strike"}>{check.sum}</span>
        </span>
        {check.rebuilds ? <IndexMark className="text-seat" /> : null}
      </p>

      {/* `items-stretch` so every column is as tall as the tallest and the place
          labels land on one line. A place with nothing in it — the tens of
          606 — is then an empty column with a floor, which is what it is,
          rather than a label floating at the top of the board. */}
      <div className="flex items-stretch justify-start gap-1 overflow-x-auto">
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
  const seated = Math.min(column.counters, column.sockets)
  const empty = Math.max(0, column.sockets - column.counters)
  const surplus = Math.max(0, column.counters - column.sockets)

  return (
    <div className="flex min-w-10 flex-col items-center justify-end gap-1 px-1">
      {range(surplus).map((i) => (
        <span
          key={`surplus-${String(i)}`}
          className="border-strike bg-ground-raised mb-2 block size-4 rotate-45 border-2"
          aria-hidden="true"
        />
      ))}
      {range(seated).map((i) => (
        <span
          key={`seated-${String(i)}`}
          className="border-line-cut bg-index block size-4 rounded-full border"
          aria-hidden="true"
        />
      ))}
      {range(empty).map((i) => (
        <span
          key={`empty-${String(i)}`}
          className="border-line-cut block size-4 rounded-full border border-dashed"
          aria-hidden="true"
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
