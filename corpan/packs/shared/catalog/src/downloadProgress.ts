import type { DownloadState } from "./types"

type ProgressCallback = (state: DownloadState) => void

type TauriEvent = {
  payload: {
    pack_id: string
    stage: string
    progress: number
    total: number
    message: string
  }
}

type TauriInternals = {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
}

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: TauriInternals
  __TAURI__?: {
    event?: {
      listen: (event: string, handler: (event: TauriEvent) => void) => Promise<() => void>
    }
  }
}

function getTauriListen(): ((event: string, handler: (e: TauriEvent) => void) => Promise<() => void>) | null {
  const w = window as TauriWindow
  return w.__TAURI__?.event?.listen ?? null
}

/** Per-narration progress tracker */
const trackers = new Map<string, {
  state: DownloadState
  listeners: Set<ProgressCallback>
}>()

let globalUnlisten: (() => void) | null = null

function getTracker(narrationId: string) {
  let tracker = trackers.get(narrationId)
  if (!tracker) {
    tracker = {
      state: { stage: "idle", progress: 0, total: 0, message: "" },
      listeners: new Set(),
    }
    trackers.set(narrationId, tracker)
  }
  return tracker
}

function handleEvent(event: TauriEvent): void {
  const { pack_id, stage, progress, total, message } = event.payload
  const tracker = getTracker(pack_id)

  const mapped: DownloadState["stage"] =
    stage === "downloading" ? "downloading" :
    stage === "verifying" ? "verifying" :
    stage === "extracting" ? "extracting" :
    stage === "finalizing" ? "extracting" :
    stage === "complete" ? "complete" :
    stage === "error" ? "error" : "idle"

  tracker.state = {
    stage: mapped,
    progress,
    total,
    message,
    error: mapped === "error" ? message : undefined,
  }

  for (const cb of tracker.listeners) {
    cb(tracker.state)
  }

  // Clean up completed/errored trackers after notifying
  if (mapped === "complete" || mapped === "error") {
    setTimeout(() => {
      if (tracker.listeners.size === 0) {
        trackers.delete(pack_id)
      }
    }, 5000)
  }
}

/** Start listening for Tauri pack-install-progress events (call once at app init) */
export async function startListening(): Promise<void> {
  if (globalUnlisten) return // already listening

  const listen = getTauriListen()
  if (!listen) return // no Tauri runtime

  globalUnlisten = await listen("pack-install-progress", handleEvent)
}

/** Stop listening for events */
export function stopListening(): void {
  if (globalUnlisten) {
    globalUnlisten()
    globalUnlisten = null
  }
}

/**
 * Subscribe to download progress for a specific narration.
 * Returns an unsubscribe function.
 */
export function subscribe(narrationId: string, cb: ProgressCallback): () => void {
  const tracker = getTracker(narrationId)
  tracker.listeners.add(cb)
  // Immediately call with current state
  cb(tracker.state)
  return () => {
    tracker.listeners.delete(cb)
  }
}

/** Get current download state for a narration */
export function getState(narrationId: string): DownloadState {
  return getTracker(narrationId).state
}

/** Mark a narration as starting download — notifies all subscribers immediately */
export function setStarting(narrationId: string): void {
  const tracker = getTracker(narrationId)
  tracker.state = { stage: "starting", progress: 0, total: 0, message: "" }
  for (const cb of tracker.listeners) {
    cb(tracker.state)
  }
}
