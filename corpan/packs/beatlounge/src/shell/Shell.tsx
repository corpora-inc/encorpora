/**
 * beatlounge — the Stage + Dock-Rail + Immersive shell.
 *
 * ONE chrome-recede owner: the shell root carries `data-bl-chrome="stage" |
 * "immersive"`; everything keys its recede off that single attribute. The Stage
 * is a calm canvas of placed module tiles; the Dock-Rail is the one persistent
 * strip; entering immersive shows one module full-bleed at a time, and exit
 * restores the Stage. The shell injects its chrome callbacks (enterImmersive /
 * toast / form) into the host so the host stays a thin adapter.
 *
 * z-scale comes entirely from styles.css (--bl-z-*). We never touch document.body.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { AudioFacade } from "../contracts/audioFacade"
import type {
  BeatloungeHost,
  FormFactor,
  ModuleId,
  ModuleRegistry,
} from "../contracts/module"
import type { BeatloungeStore } from "../store/store"
import { createFormObserver } from "../host/formFactor"
import { useBeatloungeStore } from "../store/store"
import { ModuleHost } from "./ModuleHost"
import { Immersive } from "./Immersive"
import { DockRail } from "./DockRail"
import { Toast, type ToastState } from "./Toast"
import { CommandBar, createCommandBarController } from "../modules/command-bar"

export interface ShellChromeApi {
  enterImmersive(id: ModuleId): () => void
  toast(message: string, opts?: { undo?: () => void }): void
  form(): FormFactor
}

interface Props {
  store: BeatloungeStore
  audio: AudioFacade
  registry: ModuleRegistry
  /** The host, whose chrome seams the shell fills in (see attachChrome). */
  host: BeatloungeHost
  /** Lets App wire the live chrome callbacks into the host it already built. */
  attachChrome: (chrome: ShellChromeApi) => void
  skin?: "midnight" | "noir" | "aurora"
}

export const Shell = ({
  store,
  audio,
  registry,
  host,
  attachChrome,
  skin = "midnight",
}: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const canUndo = useBeatloungeStore(store, (s) => s.canUndo)
  const canRedo = useBeatloungeStore(store, (s) => s.canRedo)

  const [form, setForm] = useState<FormFactor>("desktop")
  const [immersiveId, setImmersiveId] = useState<ModuleId | null>(null)
  const [playing, setPlaying] = useState(audio.isPlaying())
  const [masterLevel, setMasterLevel] = useState(0)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastSeq = useRef(0)
  const [commandOpen, setCommandOpen] = useState(false)

  // The headline natural-language surface: one controller for the pack,
  // opened from the Dock-Rail's command button into a palette-level overlay.
  const commandController = useMemo(
    () => createCommandBarController({ store, host, hostApi: host.hostApi }),
    [store, host]
  )
  useEffect(() => () => commandController.dispose(), [commandController])

  // --- form factor (single resize owner) ---
  useEffect(() => {
    const obs = createFormObserver(setForm)
    setForm(obs.get())
    return () => obs.dispose()
  }, [])

  // --- chrome callbacks injected into the host ---
  const enterImmersive = useCallback((id: ModuleId): (() => void) => {
    setImmersiveId(id)
    return () => setImmersiveId((cur) => (cur === id ? null : cur))
  }, [])

  const showToast = useCallback((message: string, opts?: { undo?: () => void }) => {
    toastSeq.current += 1
    setToast({ id: toastSeq.current, message, undo: opts?.undo })
  }, [])

  useEffect(() => {
    attachChrome({ enterImmersive, toast: showToast, form: () => form })
  }, [attachChrome, enterImmersive, showToast, form])

  // --- master meter: a smoothed playhead-driven pulse until the real engine
  //     reports RMS (the facade is a silent stub in Wave 1). Calm, not jumpy. ---
  useEffect(() => {
    let frame = 0
    let level = 0
    const off = audio.onPlayhead((tick) => {
      if (tick < 0) {
        level = 0
        setMasterLevel(0)
        return
      }
      // Pulse on the beat: brightest at downbeats, decaying between.
      const phase = (tick % doc.ppq) / doc.ppq
      const target = (1 - phase) * 0.85 * (doc.masterVolume || 1)
      level = Math.max(target, level * 0.9)
      if (!frame) {
        frame = requestAnimationFrame(function tickFn() {
          level *= 0.9
          setMasterLevel(level)
          frame = level > 0.01 ? requestAnimationFrame(tickFn) : 0
        })
      }
    })
    return () => {
      off()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [audio, doc.ppq, doc.masterVolume])

  const toggleTransport = useCallback(() => {
    if (audio.isPlaying()) {
      audio.stop()
      setPlaying(false)
    } else {
      void audio.start()
      setPlaying(true)
    }
  }, [audio])

  const modules = useMemo(() => registry.all(), [registry])
  const immersiveModule = immersiveId ? registry.get(immersiveId) : undefined

  const chromeState = immersiveId ? "immersive" : "stage"

  return (
    <div className="bl-root bl-shell" data-skin={skin} data-bl-chrome={chromeState}>
      {/* ---- Stage: calm canvas of placed module tiles ---- */}
      <main className={`bl-stage bl-stage--${form}`}>
        <div className="bl-stage-head">
          <span className="bl-wordmark">beatlounge</span>
          <span className="bl-song-name">{doc.name}</span>
        </div>
        <div className="bl-stage-grid">
          {modules.map((m) => (
            <button
              type="button"
              key={m.id}
              className={`bl-tile bl-tile--${m.tileAspect ?? "square"}`}
              onClick={() => host.enterImmersive(m.id)}
              aria-label={`Open ${m.title}`}
            >
              <ModuleHost
                module={m}
                surface="tile"
                form={form}
                host={host}
                className="bl-tile-mount"
              />
            </button>
          ))}
        </div>
      </main>

      {/* ---- Dock-Rail: the one persistent strip ---- */}
      <DockRail
        form={form}
        playing={playing}
        onToggle={toggleTransport}
        bpm={doc.bpm}
        onBpm={(bpm) => store.dispatch({ t: "setTempo", bpm })}
        masterLevel={masterLevel}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={store.undo}
        onRedo={store.redo}
        onCommand={() => setCommandOpen(true)}
        onExit={() => {
          audio.stop()
          window.dispatchEvent(new CustomEvent("corpan:exit"))
        }}
      />

      {/* ---- Immersive: one module full-bleed at a time ---- */}
      {immersiveModule && (
        <Immersive
          title={immersiveModule.title}
          onExit={() => setImmersiveId(null)}
        >
          <ModuleHost
            module={immersiveModule}
            surface="immersive"
            form={form}
            host={host}
            className="bl-immersive-mount"
          />
        </Immersive>
      )}

      {/* ---- Command bar: the headline natural-language surface ---- */}
      {commandOpen && (
        <div
          className="bl-command-overlay"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setCommandOpen(false)
          }}
        >
          <CommandBar
            controller={commandController}
            onClose={() => setCommandOpen(false)}
          />
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
