/**
 * beatlounge — Score seam. The Instruments page's "Score" drawer tab edits the
 * SAME track the ribbon performs into: the ribbon performs + records, the score
 * layers + step-edits — two editors of one track's `notes`. The real editor is
 * `../score/Score.tsx` (the +/− melody "layer" dial); this file keeps the stable
 * import path + the `ScoreProps` contract so the drawer wiring is unchanged.
 */

export { Score as ScorePlaceholder, type ScoreProps } from "../score/Score"
