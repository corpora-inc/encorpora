/**
 * beatlounge — the shared TINY CLEAR button: an icon-only (trash) clear used in
 * every track-editor header. Volume/Pan/Mute/Solo live in the Mixer drawer now,
 * so the editor header carries no redundant knobs — just this small Clear. Squared
 * `.bl-icon-btn`, icon-only (no per-pane string to translate ~50×).
 */

import { Glyph } from "../../bl-ui"

interface Props {
  onClear: () => void
  /** Accessible label / tooltip (defaults to "Clear"). */
  label?: string
}

export const ClearButton = ({ onClear, label = "Clear" }: Props) => (
  <button
    type="button"
    className="bl-icon-btn bl-clear-btn"
    onClick={onClear}
    aria-label={label}
    title={label}
  >
    <Glyph name="trash" size={16} />
  </button>
)
