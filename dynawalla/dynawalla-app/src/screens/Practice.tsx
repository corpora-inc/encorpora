import { useCallback, useEffect } from "react"
import { useNavigate } from "react-router"

import { Destination } from "./Destination.tsx"
import { strings } from "../app/strings.ts"
import { entryModelFor, glyphFromKey } from "../work/entry.ts"
import { now, record } from "../work/metrics.ts"
import { autoAdvanceMs, committable, enterAction } from "../work/session.ts"
import { scheduleDeckFill, usePractice } from "../work/store.ts"
import { CountingBoardCard } from "../work/ui/CountingBoardCard.tsx"
import { Keypad } from "../work/ui/Keypad.tsx"
import { Plate } from "../work/ui/Plate.tsx"
import { ProblemSlate } from "../work/ui/ProblemSlate.tsx"

/**
 * The practice loop.
 *
 * The screen is a renderer and a scheduler. Every decision — what the answer is,
 * which misconception a wrong one matches, what comes next — was made in
 * `src/work/*.ts` by a pure function, which is what makes any of it testable
 * without a browser.
 *
 * Three timing rules are implemented here and nowhere else:
 *
 *   * The commit span is measured from the input event to the frame that paints
 *     the verdict — a double `requestAnimationFrame`, because the first one runs
 *     before the paint it schedules.
 *   * The deck is topped up from `requestIdleCallback`, so the problem after the
 *     one on screen is generated while the child is reading, never when they
 *     answer.
 *   * A seated answer holds for `SEAT_HOLD_MS` and then presents the next card
 *     by itself. A struck one never auto-advances: the child is looking at the
 *     correct answer and taking that away is the app deciding it has finished
 *     with them.
 */
export function PracticeScreen() {
  const session = usePractice((state) => state.session)
  const begin = usePractice((state) => state.begin)
  const press = usePractice((state) => state.press)
  const commitAnswer = usePractice((state) => state.commitAnswer)
  const next = usePractice((state) => state.next)
  const end = usePractice((state) => state.end)
  const navigate = useNavigate()

  useEffect(() => {
    begin()
  }, [begin])

  // Idle generation. Re-armed whenever the session changes, which is more often
  // than strictly needed and costs nothing: `prepare` returns the same state
  // when there is no work, so the store does not even re-render.
  useEffect(() => scheduleDeckFill(), [session])

  // Commit, and time the frame the verdict lands on.
  //
  // The measurement is here rather than in an effect on purpose: an effect keyed
  // on the session re-runs when the idle pass tops the deck up, cancelling the
  // pending frame callback and dropping roughly a quarter of the samples. Two
  // frames, because the first callback runs *before* the paint it was scheduled
  // for and the second runs after it.
  const commitNow = useCallback(() => {
    const started = now()
    commitAnswer()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        record("commitToFeedback", now() - started)
      })
    })
  }, [commitAnswer])

  // A seated answer presents the next card on its own.
  useEffect(() => {
    if (session === null) return
    const hold = autoAdvanceMs(session)
    if (hold === null) return
    const handle = setTimeout(next, hold)
    return () => clearTimeout(handle)
  }, [session, next])

  // The hardware keyboard, at the window, so the loop is fully operable without
  // ever hitting Tab. Enter is left alone while a button has focus — that is the
  // button's activation and stealing it would break keyboard-only operation
  // rather than improve it.
  useEffect(() => {
    if (session === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      const glyph = glyphFromKey(event.key)
      if (glyph !== null) {
        event.preventDefault()
        press({ kind: "glyph", glyph })
        return
      }
      if (event.key === "Backspace") {
        event.preventDefault()
        press({ kind: "delete" })
        return
      }
      if (event.key === "Escape") {
        event.preventDefault()
        press({ kind: "clear" })
        return
      }
      if (event.key === "Enter" && !(document.activeElement instanceof HTMLButtonElement)) {
        event.preventDefault()
        if (enterAction(session) === "commit") commitNow()
        else next()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [session, press, commitNow, next])

  if (session === null) return <Destination />

  const { card, entry, feedback } = session
  const model = card.kind === "problem" ? entryModelFor(card.exercise.schema) : undefined

  return (
    <Destination>
      <div className="flex flex-col gap-6">
        {card.kind === "problem" ? (
          <ProblemSlate
            key={card.exercise.exerciseId}
            card={card}
            entry={entry}
            feedback={feedback}
          />
        ) : (
          <CountingBoardCard board={card.board} />
        )}

        {/* Capped and centred: on a tablet an uncapped three-column grid makes
            each key a 220 px slab across the whole plate, which is further from
            a thumb than it is from the last key. The cap keeps the pad the size
            of a hand at every width. */}
        <div className="mx-auto flex w-full max-w-xs flex-col gap-4">
          {/* The keypad stays mounted while a verdict is up, disabled rather
              than removed. Unmounting it would pull the action row a hundred
              pixels up the screen at the exact moment the child is looking at
              their answer — the jolting reflow the design rules forbid. */}
          {card.kind === "problem" && model !== undefined ? (
            <Keypad
              model={model}
              schema={card.exercise.schema}
              onKey={press}
              disabled={feedback !== null}
            />
          ) : null}

          <div className="flex gap-3">
            {session.stopping ? (
              <>
                <Plate
                  onPress={() => {
                    // Ends the run, not the progress: the ladder position, the
                    // seed cursor and the totals are already persisted. Coming
                    // back gives a fresh card where they left off rather than
                    // the one they walked away from.
                    end()
                    void navigate("/")
                  }}
                >
                  {strings.practice.done}
                </Plate>
                <Plate onPress={next}>{strings.practice.keepGoing}</Plate>
              </>
            ) : feedback === null && card.kind === "problem" ? (
              <Plate onPress={commitNow} disabled={!committable(session)}>
                {strings.practice.check}
              </Plate>
            ) : (
              <Plate onPress={next}>{strings.practice.next}</Plate>
            )}
          </div>
        </div>
      </div>
    </Destination>
  )
}
