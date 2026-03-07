/**
 * Playback controller scaffolding for deterministic state transitions.
 *
 * Phase 1 goal: define a single typed state model and intent surface without
 * changing runtime behavior yet. Integration into game/audio orchestration is
 * intentionally deferred to later phases.
 */

export type PlaybackPhase =
  | "idle"
  | "playing"
  | "paused"
  | "seeking"
  | "scrubbing"
  | "recovering"

export type TimelineAnchor = {
  positionMs: number
  wallClockMs: number
  playing: boolean
}

export type PlaybackSnapshot = {
  phase: PlaybackPhase
  desiredPlaying: boolean
  appPlaying: boolean
  enginePlaying: boolean
  positionMs: number
  segmentIndex: number
  chapterTitle: string | null
  anchor: TimelineAnchor
  updatedAtMs: number
  revision: number
}

export type PlaybackIntent =
  | { type: "playRequested" }
  | { type: "pauseRequested" }
  | { type: "seekCommitted"; positionMs: number; segmentIndex: number; chapterTitle?: string | null }
  | { type: "scrubStarted" }
  | { type: "scrubCommitted" }
  | { type: "visibilityHidden" }
  | { type: "visibilityVisible" }
  | { type: "interruptionBegan" }
  | { type: "interruptionEnded"; shouldResume: boolean }
  | {
      type: "engineObserved"
      enginePlaying: boolean
      positionMs: number
      segmentIndex: number
      chapterTitle?: string | null
    }

type Listener = (snapshot: PlaybackSnapshot, intent: PlaybackIntent) => void

function nextPhaseFromSnapshot(snapshot: PlaybackSnapshot): PlaybackPhase {
  if (snapshot.appPlaying || snapshot.enginePlaying || snapshot.desiredPlaying) return "playing"
  return "paused"
}

export function reducePlaybackSnapshot(
  current: PlaybackSnapshot,
  intent: PlaybackIntent,
  nowMs: number
): PlaybackSnapshot {
  const next: PlaybackSnapshot = { ...current, updatedAtMs: nowMs, revision: current.revision + 1 }

  switch (intent.type) {
    case "playRequested":
      next.desiredPlaying = true
      next.phase = "recovering"
      return next
    case "pauseRequested":
      next.desiredPlaying = false
      next.appPlaying = false
      next.anchor = { positionMs: next.positionMs, wallClockMs: nowMs, playing: false }
      next.phase = "paused"
      return next
    case "seekCommitted":
      next.positionMs = intent.positionMs
      next.segmentIndex = intent.segmentIndex
      next.chapterTitle = intent.chapterTitle ?? next.chapterTitle
      next.anchor = { positionMs: intent.positionMs, wallClockMs: nowMs, playing: next.appPlaying }
      next.phase = "seeking"
      return next
    case "scrubStarted":
      next.phase = "scrubbing"
      return next
    case "scrubCommitted":
      next.phase = nextPhaseFromSnapshot(next)
      return next
    case "visibilityHidden":
      return next
    case "visibilityVisible":
      if (next.desiredPlaying) next.phase = "recovering"
      return next
    case "interruptionBegan":
      next.desiredPlaying = false
      next.appPlaying = false
      next.anchor = { positionMs: next.positionMs, wallClockMs: nowMs, playing: false }
      next.phase = "paused"
      return next
    case "interruptionEnded":
      next.desiredPlaying = intent.shouldResume
      next.phase = intent.shouldResume ? "recovering" : "paused"
      return next
    case "engineObserved":
      next.enginePlaying = intent.enginePlaying
      next.positionMs = intent.positionMs
      next.segmentIndex = intent.segmentIndex
      next.chapterTitle = intent.chapterTitle ?? next.chapterTitle
      next.appPlaying = intent.enginePlaying
      next.anchor = { positionMs: intent.positionMs, wallClockMs: nowMs, playing: intent.enginePlaying }
      next.phase = nextPhaseFromSnapshot(next)
      return next
    default: {
      const exhaustive: never = intent
      return exhaustive
    }
  }
}

export function createPlaybackController(initial?: Partial<PlaybackSnapshot>) {
  let snapshot: PlaybackSnapshot = {
    phase: "idle",
    desiredPlaying: false,
    appPlaying: false,
    enginePlaying: false,
    positionMs: 0,
    segmentIndex: 0,
    chapterTitle: null,
    anchor: { positionMs: 0, wallClockMs: Date.now(), playing: false },
    updatedAtMs: Date.now(),
    revision: 0,
    ...initial,
  }

  const listeners = new Set<Listener>()

  function dispatch(intent: PlaybackIntent): PlaybackSnapshot {
    snapshot = reducePlaybackSnapshot(snapshot, intent, Date.now())
    for (const listener of listeners) listener(snapshot, intent)
    return snapshot
  }

  return {
    dispatch,
    getSnapshot: (): PlaybackSnapshot => snapshot,
    subscribe: (listener: Listener): (() => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
