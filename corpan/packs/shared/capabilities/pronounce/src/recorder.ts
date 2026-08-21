// Push-to-talk + prepare/retry state machine — MOVED from
// packs/pronunciation-coach/src/game.ts (cancelActiveSession, startRecording,
// stopRecording, tryPrepareOnce, prepareWithMemoryRetry, ensureLoaded,
// beginMicHold/endMicHold — capability-modules.md §4.1), parameterized so the
// pack keeps its own UI-state + error routing in callbacks while the flow
// logic has exactly one implementation.
import type {
  CapabilitySttApi,
  SttErrorCode,
  SttPrepareResult,
  SttTranscriptionResult,
} from "@shared/capabilities/core"
import { sttErrCode } from "@shared/capabilities/core"
import { mergeForLang } from "./whisperTuning"
import { mergeScoringForLangModel } from "./scoringTuning"
import { newSessionId, whisperLang } from "./session"

export const TRANSCRIBE_TIMEOUT_MS = 90_000

export const withTimeout = async <T>(
  p: Promise<T>,
  ms: number,
  label: string
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`))
    }, ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// ------------------------------------------------------------ push-to-talk

export type RecorderPhrase = {
  /** The exact expected text (target language). */
  text: string
  /** Corpán code of `text` (mapped to whisper's code internally). */
  lang: string
}

export type PushToTalkCallbacks = {
  /** Model FOLDER currently loaded (scoring params are per (lang, model)). */
  model: () => string
  onState: (state: "recording" | "scoring" | "idle") => void
  onResult: (result: SttTranscriptionResult) => void
  onError: (err: unknown, code: SttErrorCode | undefined, phase: "start" | "stop") => void
}

export type PushToTalkRecorder = {
  /** Begin a session for the phrase. Resolves once recording started. */
  start(phrase: RecorderPhrase): Promise<void>
  /** Stop + score the active session. Resolves after onResult/onError. */
  stop(): Promise<void>
  /** Cancel the active session, if any (mic released native-side). */
  cancel(): void
  isActive(): boolean
  /** True once ANY session was opened (dispose must releaseAudio then). */
  sessionEverOpened(): boolean
  /** cancel() + stt.releaseAudio (iOS mic-indicator rule). */
  dispose(): void
}

export const createPushToTalkRecorder = (
  stt: CapabilitySttApi,
  cb: PushToTalkCallbacks,
): PushToTalkRecorder => {
  let activeSessionId: string | null = null
  let everOpened = false
  let disposed = false

  const cancel = () => {
    const sessionId = activeSessionId
    activeSessionId = null
    if (sessionId) {
      stt.cancelSession({ sessionId }).catch((err) => {
        console.error("[cap-pronounce] cancelSession failed:", err)
      })
    }
  }

  return {
    async start(phrase) {
      if (disposed) return
      const sessionId = newSessionId()
      activeSessionId = sessionId
      try {
        cb.onState("recording")
        const lang = whisperLang(phrase.lang)
        const res = await stt.startSession({
          sessionId,
          language: lang,
          expectedText: phrase.text,
          whisperParams: mergeForLang(lang),
          scoringParams: mergeScoringForLangModel(lang, cb.model()),
        })
        everOpened = true
        if (disposed) return
        if (!res.started) {
          throw new Error("STT plugin reported started=false")
        }
      } catch (err) {
        console.error("[cap-pronounce] startSession failed:", err)
        activeSessionId = null
        cb.onError(err, sttErrCode(err), "start")
        cb.onState("idle")
      }
    },

    async stop() {
      const sessionId = activeSessionId
      if (!sessionId) {
        cb.onState("idle")
        return
      }
      activeSessionId = null
      try {
        cb.onState("scoring")
        const result = await withTimeout(
          stt.stopSession({ sessionId }),
          TRANSCRIBE_TIMEOUT_MS,
          "Scoring"
        )
        if (disposed) return
        cb.onResult(result)
        cb.onState("idle")
      } catch (err) {
        const code = sttErrCode(err)
        console.error(
          `[cap-pronounce] stopSession failed (code=${code ?? "—"}):`,
          err
        )
        cb.onState("idle")
        cb.onError(err, code, "stop")
      }
    },

    cancel,
    isActive: () => activeSessionId !== null,
    sessionEverOpened: () => everOpened,
    dispose() {
      if (disposed) return
      disposed = true
      const opened = everOpened || activeSessionId !== null
      cancel()
      if (opened && stt.releaseAudio) {
        stt.releaseAudio().catch((err) => {
          console.error("[cap-pronounce] releaseAudio failed:", err)
        })
      }
    },
  }
}

/** Hold-to-speak binding: press and hold to record, release to stop + score.
 *  Pointer events (not click) so it works for touch and mouse;
 *  setPointerCapture keeps pointerup landing on the button even if the finger
 *  slides off, and pointercancel covers an interrupted gesture (call, system
 *  gesture) so the mic can never get stuck recording. Returns an unbind fn. */
export const bindPushToTalk = (
  button: HTMLElement,
  opts: {
    canStart: () => boolean
    onStart: () => void
    onStop: () => void
  },
): (() => void) => {
  let holdActive = false
  const begin = (e: PointerEvent) => {
    if (!opts.canStart()) return
    e.preventDefault()
    holdActive = true
    try {
      button.setPointerCapture(e.pointerId)
    } catch {
      /* capture is best-effort; pointercancel still ends the hold */
    }
    opts.onStart()
  }
  const end = (e: PointerEvent) => {
    if (!holdActive) return
    holdActive = false
    try {
      button.releasePointerCapture(e.pointerId)
    } catch {
      /* no-op if capture was never granted */
    }
    opts.onStop()
  }
  button.addEventListener("pointerdown", begin)
  button.addEventListener("pointerup", end)
  button.addEventListener("pointercancel", end)
  return () => {
    button.removeEventListener("pointerdown", begin)
    button.removeEventListener("pointerup", end)
    button.removeEventListener("pointercancel", end)
  }
}

// ------------------------------------------------------------ model prepare

/** prepare() is local-only — never downloads. Throws with `code` attached so
 *  callers route on err.code instead of substring-matching the message. */
export const tryPrepareOnce = async (
  stt: CapabilitySttApi,
  model: string,
  opts: { timeoutMs: number; label: string },
): Promise<SttPrepareResult> => {
  const r = await withTimeout(stt.prepare({ model }), opts.timeoutMs, opts.label)
  if (!r.ready) {
    const e = new Error(r.message || "Model not ready") as Error & {
      code?: SttErrorCode
    }
    e.code = r.code
    throw e
  }
  return r
}

/** Sentinel thrown when the user cancels the INSUFFICIENT_MEMORY retry wait.
 *  Distinct from a real error so callers can do "switch cancelled" instead of
 *  "load failed" messaging. */
export class SwitchCancelledError extends Error {
  constructor() {
    super("Switch cancelled by user")
    this.name = "SwitchCancelledError"
  }
}

const MEMORY_WAIT_INTERVAL_MS = 1500
const MEMORY_WAIT_MAX_ATTEMPTS = 10

/** Wraps `tryPrepareOnce` with a memory-wait retry loop. The native plugin's
 *  headroom gate returns `INSUFFICIENT_MEMORY` when the OS still has the
 *  previous model parked on the C heap freelist; empirically 5–10 s is enough
 *  for iOS to reclaim those pages, so rather than surfacing a scary error we
 *  absorb the failure, let the consumer show a "freeing memory" overlay (with
 *  cancel) via `onWait`, and retry. Throws SwitchCancelledError on cancel, or
 *  re-throws the underlying error when it isn't INSUFFICIENT_MEMORY / when
 *  attempts are exhausted. */
export const prepareWithMemoryRetry = async (
  stt: CapabilitySttApi,
  model: string,
  opts: {
    timeoutMs: number
    label: string
    /** Called before each wait interval; `cancel` aborts the loop. */
    onWait?: (attempt: number, remaining: number, cancel: () => void) => void
  },
): Promise<SttPrepareResult> => {
  let lastError: unknown = null
  let cancelled = false
  const cancel = () => {
    cancelled = true
  }
  for (let attempt = 1; attempt <= MEMORY_WAIT_MAX_ATTEMPTS; attempt++) {
    if (cancelled) throw new SwitchCancelledError()
    try {
      return await tryPrepareOnce(stt, model, opts)
    } catch (err) {
      const code = sttErrCode(err)
      if (code !== "INSUFFICIENT_MEMORY") {
        // Different failure mode — bubble up to the regular catch
        // (MODEL_NOT_INSTALLED, NETWORK, LOAD_FAILED, etc.).
        throw err
      }
      lastError = err
      if (attempt === MEMORY_WAIT_MAX_ATTEMPTS) break
      const remaining = MEMORY_WAIT_MAX_ATTEMPTS - attempt
      opts.onWait?.(attempt, remaining, cancel)
      console.log(
        `[cap-pronounce] INSUFFICIENT_MEMORY on attempt ${attempt}; ` +
          `waiting ${MEMORY_WAIT_INTERVAL_MS}ms, ${remaining} retries left`
      )
      await new Promise<void>((resolve) =>
        setTimeout(resolve, MEMORY_WAIT_INTERVAL_MS)
      )
    }
  }
  throw lastError ?? new Error("INSUFFICIENT_MEMORY")
}

/** Re-prepare a model if it isn't currently loaded. Idempotent: if prepare
 *  hits its in-memory cache, returns immediately. Install/unload paths can
 *  drop the previous native context while leaving files on disk; calling this
 *  restores the working state without a JS-side guess. */
export const ensureLoaded = async (
  stt: CapabilitySttApi,
  model: string,
): Promise<boolean> => {
  if (!stt?.prepare) return false
  try {
    const r = await stt.prepare({ model })
    if (r.ready) return true
    console.error(
      `[cap-pronounce] ensureLoaded(${model}) failed: code=${r.code ?? "—"} msg=${r.message ?? ""}`
    )
    return false
  } catch (err) {
    console.error(`[cap-pronounce] ensureLoaded(${model}) threw:`, err)
    return false
  }
}
