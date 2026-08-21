// Synthesized metronome. Renders whichever voice kit is selected; kits live in
// voices.ts. Tracks the nodes it schedules so a stop or a cycle swap can silence
// the clicks still in the lookahead window instead of letting them ring out.

import type { ClickRole } from "./clock"
import { renderStroke, type VoiceKitId, type StrokeResult } from "./voices"

export class Metronome {
  private ctx: AudioContext
  private out: AudioNode
  private kit: VoiceKitId = "tonal"
  private live = new Set<StrokeResult>()

  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx
    this.out = out
  }

  setKit(kit: VoiceKitId): void {
    this.kit = kit
  }

  getKit(): VoiceKitId {
    return this.kit
  }

  // Schedule one click at absolute audio time `time`. Times come from the pure
  // planner, so they are always in the near future relative to the context
  // clock.
  trigger(role: ClickRole, time: number): void {
    const stroke = renderStroke(this.ctx, this.out, this.kit, role, time)
    this.live.add(stroke)
    const primary = stroke.sources[0]
    if (primary) {
      primary.onended = () => {
        stroke.bus.disconnect()
        this.live.delete(stroke)
      }
    } else {
      this.live.delete(stroke)
    }
  }

  // Silence every scheduled click still in flight. Anything sounding fades out
  // over a few milliseconds to avoid a pop; anything not yet started never
  // sounds.
  cancelAll(): void {
    const now = this.ctx.currentTime
    for (const stroke of this.live) {
      try {
        stroke.bus.gain.cancelScheduledValues(now)
        stroke.bus.gain.setTargetAtTime(0, now, 0.005)
        for (const s of stroke.sources) {
          try {
            s.stop(now + 0.03)
          } catch {
            // Already stopped.
          }
        }
      } catch {
        // Node already torn down.
      }
    }
  }
}
