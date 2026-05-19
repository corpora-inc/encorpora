import { useCallback, useEffect, useRef, useState } from "react"
import { listenToNetworkChanges } from "@/utils/network"

export type InstallStage =
  | "downloading"
  | "verifying"
  | "extracting"
  | "finalizing"
  | "complete"
  | "error"

export type InstallProgressEvent = {
  pack_id: string
  stage: string
  progress: number
  total: number
  message: string
}

export type InstallProgressState = {
  active: boolean
  stage: InstallStage
  progress: number
  total: number
  message: string
  packName: string
  error: string | null
  startedAt: number
}

const INITIAL_STATE: InstallProgressState = {
  active: false,
  stage: "downloading",
  progress: 0,
  total: 0,
  message: "",
  packName: "",
  error: null,
  startedAt: 0,
}

const TIMEOUT_MS = 120_000 // 2 minutes

export function useInstallProgress() {
  const [state, setState] = useState<InstallProgressState>(INITIAL_STATE)
  const unlistenRef = useRef<(() => void) | null>(null)
  const unlistenNetworkRef = useRef<(() => void) | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastEventRef = useRef<number>(0)

  const clearTimeout_ = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearInterval(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const cleanup = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current()
      unlistenRef.current = null
    }
    if (unlistenNetworkRef.current) {
      unlistenNetworkRef.current()
      unlistenNetworkRef.current = null
    }
    clearTimeout_()
  }, [clearTimeout_])

  const startListening = useCallback(
    (packId: string, packName: string) => {
      cleanup()

      const now = Date.now()
      lastEventRef.current = now
      setState({
        active: true,
        stage: "downloading",
        progress: 0,
        total: 0,
        message: "",
        packName,
        error: null,
        startedAt: now,
      })

      // Start timeout checker
      timeoutRef.current = setInterval(() => {
        if (Date.now() - lastEventRef.current > TIMEOUT_MS) {
          setState((prev) =>
            prev.active
              ? { ...prev, stage: "error", error: "stuck", active: true }
              : prev
          )
          clearTimeout_()
        }
      }, 5_000)

      // Watch for the device going offline mid-install. The Rust-side
      // downloader may keep waiting on a hung socket far longer than the
      // 2-minute event timeout — proactively flip the dialog to a calm
      // error state the moment we know we've lost the connection so the
      // user sees a Retry button instead of a forever-spinner.
      unlistenNetworkRef.current = listenToNetworkChanges((online) => {
        if (online) return
        setState((prev) =>
          prev.active && prev.stage !== "complete" && prev.stage !== "error"
            ? { ...prev, stage: "error", error: "offline", active: true }
            : prev,
        )
      })

      // Dynamically import Tauri event API
      import("@tauri-apps/api/event").then(({ listen }) => {
        listen<InstallProgressEvent>("pack-install-progress", (event) => {
          const payload = event.payload
          if (payload.pack_id !== packId) return

          lastEventRef.current = Date.now()

          const stage = payload.stage as InstallStage

          if (stage === "error") {
            setState((prev) => ({
              ...prev,
              stage: "error",
              error: payload.message,
              active: true,
            }))
            clearTimeout_()
            return
          }

          if (stage === "complete") {
            setState((prev) => ({
              ...prev,
              stage: "complete",
              message: payload.message,
              active: true,
            }))
            clearTimeout_()
            return
          }

          setState((prev) => ({
            ...prev,
            stage,
            progress: payload.progress,
            total: payload.total,
            message: payload.message,
          }))
        }).then((unlisten) => {
          unlistenRef.current = unlisten
        })
      })
    },
    [cleanup, clearTimeout_]
  )

  const setComplete = useCallback(() => {
    clearTimeout_()
    setState((prev) => ({
      ...prev,
      stage: "complete",
      active: true,
    }))
  }, [clearTimeout_])

  const setError = useCallback(
    (msg: string) => {
      clearTimeout_()
      setState((prev) => ({
        ...prev,
        stage: "error",
        error: msg,
        active: true,
      }))
    },
    [clearTimeout_]
  )

  const reset = useCallback(() => {
    cleanup()
    setState(INITIAL_STATE)
  }, [cleanup])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  return { state, startListening, setComplete, setError, reset }
}
