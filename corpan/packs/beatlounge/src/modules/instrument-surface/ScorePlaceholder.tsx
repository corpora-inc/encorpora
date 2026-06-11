/**
 * beatlounge — Score seam (placeholder). The Instruments page reserves a "Score"
 * drawer tab for the step/notation editor of the SAME track the ribbon performs
 * into: the ribbon performs + records, the score step-edits — two editors of one
 * track's `notes` (both write via addNote / removeNote). WS-F fills this in with
 * the real editor; this thin placeholder keeps the contract (ScoreProps) stable
 * so the tab is wired and sized correctly today.
 */

import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { Id } from "../../model/document"

export interface ScoreProps {
  host: BeatloungeHost
  store: BeatloungeStore
  trackId: Id
}

export const ScorePlaceholder = ({ trackId }: ScoreProps) => (
  <div className="bl-instr-score" data-bl-score-track={trackId} aria-hidden="true" />
)
