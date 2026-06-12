/**
 * beatlounge — M / S toggle pair. Two ≥44px buttons with clear pressed states
 * (mute = dimmed/red wash, solo = accent wash). Keyboard accessible; ARIA
 * pressed. Pure presentational toggles — parent dispatches the command.
 */

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
      aria-label="Mute"
      title="Mute"
      onClick={onMute}
    >
      M
    </button>
    <button
      type="button"
      className={`bl-ms-btn bl-ms-s${solo ? " is-on" : ""}`}
      aria-pressed={solo}
      aria-label="Solo"
      title="Solo"
      onClick={onSolo}
    >
      S
    </button>
  </div>
)
