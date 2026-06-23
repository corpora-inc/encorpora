/**
 * beatlounge — the Home voice switcher: a compact prev / name / next control in
 * the Stage head that flips the SELECTED melodic track through the preset corpus
 * without opening the Instruments immersive. Purely presentational — the Shell
 * owns the selection + dispatch (one `setInstrument` per step = one undo), and the
 * wrap/step math lives in the unit-tested `cyclePresetId`. Rendered only when a
 * melodic track exists, so `name` is always present here.
 */

import { Glyph } from "../bl-ui"
import { ct } from "../i18n/strings"

interface Props {
  /** Display name of the selected track's current voice. */
  name: string
  onPrev: () => void
  onNext: () => void
}

export const VoiceSwitcher = ({ name, onPrev, onNext }: Props) => (
  <div className="bl-voice-switch" data-bl-nocapture>
    <button
      type="button"
      className="bl-icon-btn bl-voice-arrow"
      aria-label={ct("shell.voicePrev")}
      title={ct("shell.voicePrev")}
      onClick={onPrev}
    >
      <Glyph name="chevron-left" size={18} />
    </button>
    <span className="bl-voice-name" title={name}>
      {name}
    </span>
    <button
      type="button"
      className="bl-icon-btn bl-voice-arrow"
      aria-label={ct("shell.voiceNext")}
      title={ct("shell.voiceNext")}
      onClick={onNext}
    >
      <Glyph name="chevron-right" size={18} />
    </button>
  </div>
)
