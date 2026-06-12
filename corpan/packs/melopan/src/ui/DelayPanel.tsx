import { useProjectStore } from "../storage/projectStore"
import {
  DELAY_TIME_GRID,
  DELAY_CHANNELS,
  DEFAULT_DELAY,
  DEFAULT_DELAY_ROUTING,
} from "../model/project"

type Props = {
  open: boolean
  onClose: () => void
}

export const DelayPanel = ({ open, onClose }: Props) => {
  const delay = useProjectStore((s) => s.project.delay ?? DEFAULT_DELAY)
  const setDelay = useProjectStore((s) => s.setDelay)

  if (!open) return null

  return (
    <div className="mp-modal-backdrop" onClick={onClose}>
      <div className="mp-delay-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mp-modal-head">
          <h3>Delay</h3>
          <button className="mp-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="mp-delay-row">
          <button
            className={`mp-btn ${delay.enabled ? "is-playing" : ""}`}
            onClick={() => setDelay({ enabled: !delay.enabled })}
            aria-pressed={delay.enabled}
            title={delay.enabled ? "Turn delay off" : "Turn delay on"}
          >
            {delay.enabled ? "ON" : "OFF"}
          </button>
          <span className="mp-delay-hint">
            {delay.enabled
              ? "Master delay is feeding all tracks."
              : "Turn on to add echoes to the whole mix."}
          </span>
        </div>

        <div className="mp-delay-section">
          <label className="mp-delay-label">Time</label>
          <div className="mp-delay-time-grid">
            {DELAY_TIME_GRID.map((opt) => {
              const isActive = delay.time === opt.id
              return (
                <button
                  key={opt.id}
                  className={`mp-btn mp-delay-time-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => setDelay({ time: opt.id })}
                  title={opt.id}
                >
                  <span className="mp-delay-time-glyph">{opt.label}</span>
                  <span className="mp-delay-time-id">{opt.id}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mp-delay-section">
          <label className="mp-delay-label" htmlFor="mp-delay-feedback">
            Feedback <span className="mp-delay-value">{Math.round(delay.feedback * 100)}%</span>
          </label>
          <input
            id="mp-delay-feedback"
            type="range"
            min={0}
            max={0.9}
            step={0.01}
            value={delay.feedback}
            onChange={(e) => setDelay({ feedback: Number(e.target.value) })}
          />
        </div>

        <div className="mp-delay-section">
          <label className="mp-delay-label" htmlFor="mp-delay-wet">
            Mix <span className="mp-delay-value">{Math.round(delay.wet * 100)}%</span>
          </label>
          <input
            id="mp-delay-wet"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={delay.wet}
            onChange={(e) => setDelay({ wet: Number(e.target.value) })}
          />
        </div>

        <div className="mp-delay-section">
          <div className="mp-delay-label">
            Routing
            <span className="mp-delay-value">
              <button
                className="mp-btn mp-delay-routing-quick"
                onClick={() => {
                  const all: Record<string, { enabled: boolean }> = {}
                  for (const c of DELAY_CHANNELS) all[c.id] = { enabled: true }
                  setDelay({ routing: all })
                }}
                title="Route every channel to delay"
              >
                all
              </button>
              <button
                className="mp-btn mp-delay-routing-quick"
                onClick={() => {
                  const none: Record<string, { enabled: boolean }> = {}
                  for (const c of DELAY_CHANNELS) none[c.id] = { enabled: false }
                  setDelay({ routing: none })
                }}
                title="Take every channel off the delay"
              >
                none
              </button>
            </span>
          </div>
          <div className="mp-delay-channels">
            {DELAY_CHANNELS.map((c) => {
              const send = (delay.routing ?? DEFAULT_DELAY_ROUTING)[c.id]
              return (
                <div key={c.id} className="mp-delay-channel-row">
                  <button
                    className={`mp-btn mp-delay-channel-toggle ${send.enabled ? "is-active" : ""}`}
                    onClick={() =>
                      setDelay({ routing: { [c.id]: { enabled: !send.enabled } } })
                    }
                    aria-pressed={send.enabled}
                    title={send.enabled ? "Disable send" : "Enable send"}
                  >
                    {c.label}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={send.level}
                    onChange={(e) =>
                      setDelay({ routing: { [c.id]: { level: Number(e.target.value) } } })
                    }
                    disabled={!send.enabled}
                    title={`Send level: ${Math.round(send.level * 100)}%`}
                  />
                  <span className="mp-delay-channel-value">{Math.round(send.level * 100)}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
