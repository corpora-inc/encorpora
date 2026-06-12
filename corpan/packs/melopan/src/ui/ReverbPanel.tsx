import { useProjectStore } from "../storage/projectStore"
import {
  REVERB_ROOM_GRID,
  DELAY_CHANNELS,
  DEFAULT_REVERB,
  DEFAULT_REVERB_ROUTING,
} from "../model/project"

type Props = {
  open: boolean
  onClose: () => void
}

export const ReverbPanel = ({ open, onClose }: Props) => {
  const reverb = useProjectStore((s) => s.project.reverb ?? DEFAULT_REVERB)
  const setReverb = useProjectStore((s) => s.setReverb)

  if (!open) return null

  return (
    <div className="mp-modal-backdrop" onClick={onClose}>
      <div className="mp-delay-panel mp-reverb-panel" onClick={(e) => e.stopPropagation()}>
        <div className="mp-modal-head">
          <h3>Reverb</h3>
          <button className="mp-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="mp-delay-row">
          <button
            className={`mp-btn ${reverb.enabled ? "is-playing" : ""}`}
            onClick={() => setReverb({ enabled: !reverb.enabled })}
            aria-pressed={reverb.enabled}
            title={reverb.enabled ? "Turn reverb off" : "Turn reverb on"}
          >
            {reverb.enabled ? "ON" : "OFF"}
          </button>
          <span className="mp-delay-hint">
            {reverb.enabled
              ? "Master reverb is feeding routed channels."
              : "Turn on to add room sound to the mix."}
          </span>
        </div>

        <div className="mp-delay-section">
          <label className="mp-delay-label">Room</label>
          <div className="mp-delay-time-grid">
            {REVERB_ROOM_GRID.map((opt) => {
              const isActive = reverb.room === opt.id
              return (
                <button
                  key={opt.id}
                  className={`mp-btn mp-delay-time-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => setReverb({ room: opt.id })}
                  title={opt.label}
                >
                  <span className="mp-delay-time-glyph">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mp-delay-section">
          <label className="mp-delay-label" htmlFor="mp-reverb-damp">
            Dampening <span className="mp-delay-value">{Math.round(reverb.dampening * 100)}%</span>
          </label>
          <input
            id="mp-reverb-damp"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={reverb.dampening}
            onChange={(e) => setReverb({ dampening: Number(e.target.value) })}
          />
        </div>

        <div className="mp-delay-section">
          <label className="mp-delay-label" htmlFor="mp-reverb-wet">
            Mix <span className="mp-delay-value">{Math.round(reverb.wet * 100)}%</span>
          </label>
          <input
            id="mp-reverb-wet"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={reverb.wet}
            onChange={(e) => setReverb({ wet: Number(e.target.value) })}
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
                  setReverb({ routing: all })
                }}
                title="Route every channel to reverb"
              >
                all
              </button>
              <button
                className="mp-btn mp-delay-routing-quick"
                onClick={() => {
                  const none: Record<string, { enabled: boolean }> = {}
                  for (const c of DELAY_CHANNELS) none[c.id] = { enabled: false }
                  setReverb({ routing: none })
                }}
                title="Take every channel off the reverb"
              >
                none
              </button>
            </span>
          </div>
          <div className="mp-delay-channels">
            {DELAY_CHANNELS.map((c) => {
              const send = (reverb.routing ?? DEFAULT_REVERB_ROUTING)[c.id]
              return (
                <div key={c.id} className="mp-delay-channel-row">
                  <button
                    className={`mp-btn mp-delay-channel-toggle ${send.enabled ? "is-active" : ""}`}
                    onClick={() =>
                      setReverb({ routing: { [c.id]: { enabled: !send.enabled } } })
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
                      setReverb({ routing: { [c.id]: { level: Number(e.target.value) } } })
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
