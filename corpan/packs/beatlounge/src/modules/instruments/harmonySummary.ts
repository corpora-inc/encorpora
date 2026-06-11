/**
 * beatlounge — a compact ONE-LINE summary of the song's harmony, for the
 * Instruments page's collapsed harmony row (the bar leads the page; the full
 * editor lives behind a popover). Pure + tiny so it unit-tests without a DOM.
 *
 *   modal   → "C Ionian"           (tonic + scale name)
 *   chordal → "C · Cmaj7 G7 …"     (tonic + the first few chord symbols)
 */

import type { BeatloungeDoc } from "../../model/document"
import { docHarmony } from "../../model/document"
import { tonicLabel, modeById, displayChord } from "../composer/harmonyView"

export interface HarmonySummary {
  /** Tonic name (e.g. "C", "F#"). */
  tonic: string
  /** The scale name (modal) or a short chord list (chordal). */
  detail: string
}

/** Build the collapsed-row summary for the doc's current harmony. */
export const harmonySummary = (doc: BeatloungeDoc): HarmonySummary => {
  const h = docHarmony(doc)
  const tonic = tonicLabel(h.tonic)
  if (h.mode === "chordal") {
    const symbols = h.progression.map((c) => displayChord(c.symbol))
    const detail =
      symbols.length === 0
        ? "No chords yet"
        : symbols.slice(0, 4).join(" ") + (symbols.length > 4 ? " …" : "")
    return { tonic, detail }
  }
  const mode = modeById(h.scale.family, h.scale.id)
  return { tonic, detail: mode?.name ?? h.scale.id }
}
