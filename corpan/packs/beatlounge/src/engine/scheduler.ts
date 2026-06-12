/**
 * beatlounge — the lookahead scheduler.
 *
 * Replaces melopan's single Tone.Loop with a tick-addressed lookahead clock on
 * the raw AudioContext time (the Chris-Wilson "two clocks" pattern): a 25ms
 * wake timer schedules every event whose audio time falls inside a 120ms
 * window, at sample-accurate `ctx.currentTime`-relative times. This is what
 * enables per-track polymeter, coexisting triplet/straight tracks, and
 * 128-beat loops — none of which a single shared Loop interval can do.
 *
 * The pure core (`collectTriggers`) is exported and unit-tested with zero audio:
 * given a doc and a tick window it returns exactly which events fire and when.
 */

import type { Scheduler, ScheduledTrigger, TriggerNote } from "../contracts/engine"
import type { BeatloungeDoc, Track } from "../model/document"
import { isInstrumentTrack } from "../model/document"
import { gridTicks, secondsPerTick, swingOffsetTicks, wrapTick, type Tick } from "../model/timing"

const LOOKAHEAD_SEC = 0.12
const TIMER_MS = 25

export interface PlannedTrigger {
  trackId: string
  /** Base local-tick occurrence mapped to an absolute tick (pre-swing). */
  baseTick: Tick
  /** Absolute tick the event is actually voiced at (swing + micro applied). */
  scheduledTick: Tick
  note: TriggerNote
}

/** Effective loop length for a track (polymeter via per-track lengthTicks). */
export const trackLength = (doc: BeatloungeDoc, track: Track): Tick =>
  track.lengthTicks && track.lengthTicks > 0 ? track.lengthTicks : doc.loopLengthTicks

/** Absolute ticks in [from, to) at which a local-tick event recurs in a loop. */
export const occurrencesInWindow = (
  localTick: Tick,
  loopLen: Tick,
  from: Tick,
  to: Tick
): Tick[] => {
  if (loopLen <= 0 || to <= from) return []
  const out: Tick[] = []
  let k = Math.ceil((from - localTick) / loopLen)
  if (k < 0) k = 0
  for (;;) {
    const abs = localTick + k * loopLen
    if (abs >= to) break
    if (abs >= from) out.push(abs)
    k++
    if (out.length > 4096) break // runaway guard
  }
  return out
}

/**
 * The pure scheduling core: every event firing in [fromTick, toTick), with
 * swing + intentional micro-offset applied to the voiced tick. Deterministic —
 * probability is applied later, at dispatch.
 */
export const collectTriggers = (
  doc: BeatloungeDoc,
  fromTick: Tick,
  toTick: Tick
): PlannedTrigger[] => {
  const out: PlannedTrigger[] = []
  const spt = secondsPerTick(doc.bpm)
  const swingCell = gridTicks(doc.swing.grid)

  for (const track of doc.tracks) {
    const loopLen = trackLength(doc, track)
    if (loopLen <= 0) continue

    if (isInstrumentTrack(track)) {
      for (const n of track.notes) {
        if (n.tick < 0 || n.tick >= loopLen) continue
        const occ = occurrencesInWindow(n.tick, loopLen, fromTick, toTick)
        if (occ.length === 0) continue
        const stepIdx = Math.round(n.tick / swingCell)
        const swing = swingOffsetTicks(stepIdx, doc.swing.amount, doc.swing.grid)
        const micro = n.micro ?? 0
        const note: TriggerNote = {
          pitch: n.pitch,
          velocity: n.velocity,
          durationSec: Math.max(0.02, n.duration * spt),
        }
        for (const abs of occ) {
          out.push({ trackId: track.id, baseTick: abs, scheduledTick: abs + swing + micro, note })
        }
      }
    } else {
      for (const f of track.fragments) {
        if (f.tick < 0 || f.tick >= loopLen) continue
        const occ = occurrencesInWindow(f.tick, loopLen, fromTick, toTick)
        if (occ.length === 0) continue
        const stepIdx = Math.round(f.tick / swingCell)
        const swing = swingOffsetTicks(stepIdx, doc.swing.amount, doc.swing.grid)
        const note: TriggerNote = {
          pitch: 60,
          velocity: f.gain,
          durationSec: 0.5,
          fragmentId: f.fragmentId,
          pitchSemis: f.pitchSemis,
          stretch: f.stretch,
          reverse: f.reverse,
          scratchCurve: f.scratch?.curve,
        }
        for (const abs of occ) {
          out.push({ trackId: track.id, baseTick: abs, scheduledTick: abs + swing, note })
        }
      }
    }
  }

  out.sort((a, b) => a.scheduledTick - b.scheduledTick)
  return out
}

export interface SchedulerDeps {
  context: AudioContext
  /** Optional injected clock for tests; defaults to ctx.currentTime. */
  now?: () => number
}

export const createScheduler = (deps: SchedulerDeps): Scheduler => {
  const ctx = deps.context
  const now = deps.now ?? (() => ctx.currentTime)

  let doc: BeatloungeDoc | null = null
  let playing = false
  let timer: ReturnType<typeof setInterval> | null = null
  let raf = 0
  let audioStart = 0 // ctx time corresponding to tick 0
  let lastScheduledTick = 0

  const triggerSubs = new Set<(e: ScheduledTrigger) => void>()
  const playheadSubs = new Set<(t: Tick) => void>()

  const spt = () => secondsPerTick(doc ? doc.bpm : 120)
  const tickAtTime = (t: number) => (t - audioStart) / spt()

  const scheduleWindow = () => {
    if (!playing || !doc) return
    const nowTick = tickAtTime(now())
    const lookaheadTicks = LOOKAHEAD_SEC / spt()
    const windowEnd = nowTick + lookaheadTicks
    if (windowEnd <= lastScheduledTick) return
    const planned = collectTriggers(doc, lastScheduledTick, windowEnd)
    for (const p of planned) {
      const when = audioStart + p.scheduledTick * spt()
      triggerSubs.forEach((cb) => cb({ trackId: p.trackId, when, note: p.note }))
    }
    lastScheduledTick = windowEnd
  }

  const playheadFrame = () => {
    if (!playing || !doc) return
    const t = wrapTick(Math.floor(tickAtTime(now())), doc.loopLengthTicks)
    playheadSubs.forEach((cb) => cb(t))
    raf = requestAnimationFrame(playheadFrame)
  }

  return {
    async start(fromTick = 0) {
      if (ctx.state !== "running") {
        try {
          await ctx.resume()
        } catch {
          /* resumed elsewhere on the user gesture */
        }
      }
      playing = true
      audioStart = now() - fromTick * spt()
      lastScheduledTick = fromTick
      if (timer) clearInterval(timer)
      timer = setInterval(scheduleWindow, TIMER_MS)
      scheduleWindow()
      if (typeof requestAnimationFrame === "function") {
        raf = requestAnimationFrame(playheadFrame)
      }
    },
    stop() {
      playing = false
      if (timer) clearInterval(timer)
      timer = null
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      playheadSubs.forEach((cb) => cb(-1))
    },
    isPlaying: () => playing,
    setDoc(next) {
      doc = next
    },
    onTrigger(cb) {
      triggerSubs.add(cb)
      return () => triggerSubs.delete(cb)
    },
    onPlayhead(cb) {
      playheadSubs.add(cb)
      return () => playheadSubs.delete(cb)
    },
    dispose() {
      this.stop()
      triggerSubs.clear()
      playheadSubs.clear()
    },
  }
}
