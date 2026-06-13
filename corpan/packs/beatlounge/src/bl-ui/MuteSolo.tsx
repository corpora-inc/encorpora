/**
 * beatlounge — M / S toggle pair. Two ≥44px buttons with clear pressed states
 * (mute = dimmed/red wash, solo = accent wash). Keyboard accessible; ARIA
 * pressed. Pure presentational toggles — parent dispatches the command.
 */

import { ct } from "../i18n/strings"

export interface MuteSoloProps {
  mute: boolean
  solo: boolean
  onMute: () => void
  onSolo: () => void
  /** Compact variant for tile rows. */
  compact?: boolean
}

export const MuteSolo = ({ mute, solo, onMute, onSolo, compact }: MuteSoloProps) => (
  <div className={`bl-mutesolo${compact ? " is-compact" : ""}`}>
    <button
      type="button"
      className={`bl-ms-btn bl-ms-m${mute ? " is-on" : ""}`}
      aria-pressed={mute}
      aria-label={ct("ui.mute")}
      title={ct("ui.mute")}
      onClick={onMute}
    >
      M
    </button>
    <button
      type="button"
      className={`bl-ms-btn bl-ms-s${solo ? " is-on" : ""}`}
      aria-pressed={solo}
      aria-label={ct("ui.solo")}
      title={ct("ui.solo")}
      onClick={onSolo}
    >
      S
    </button>
  </div>
)
