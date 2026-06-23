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
import { useTransport, stopTransport, syncTransportFromAudio } from "../store/transport"
import { useSelectedInstrument } from "../store/selectedInstrument"
import { useRecordArm } from "../store/recordArm"
import { ModuleHost } from "./ModuleHost"
import { Tile } from "./Tile"
import { Immersive } from "./Immersive"
import { DockRail } from "./DockRail"
import { VoiceSwitcher } from "./VoiceSwitcher"
import { cyclePresetId, instantiatePreset, matchPreset } from "../instruments/presets"
import { isInstrumentTrack } from "../model/document"
import { Toast, type ToastState } from "./Toast"
import { CommandBar, createCommandBarController } from "../modules/command-bar"
import { SCENES_ID } from "../modules/scenes"
import { ct, uiDir } from "../i18n/strings"

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
  /** Fired on each discrete user UI interaction (any tap inside the shell), so
   *  the rig's time-armed paywall gate can surface on the next tap past the
   *  interval. Optional so tests can omit it. */
  onUserInteraction?: () => void
  skin?: "midnight" | "noir" | "aurora"
}

export const Shell = ({
  store,
  audio,
  registry,
  host,
  attachChrome,
  onUserInteraction,
  skin = "midnight",
}: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const canUndo = useBeatloungeStore(store, (s) => s.canUndo)
  const canRedo = useBeatloungeStore(store, (s) => s.canRedo)

  const [form, setForm] = useState<FormFactor>("desktop")
  const [immersiveId, setImmersiveId] = useState<ModuleId | null>(null)
  // ONE global transport — the shell header, the Dock-Rail, and every immersive
  // page all read this same flag and toggle through this same path, so there is
  // no second copy of "playing" to drift out of sync.
  const { isPlaying: playing, toggle: toggleTransport } = useTransport(audio)
  // The Dock-Rail record button binds to the SAME selected melodic track the
  // Instruments page uses, and toggles its sticky, persisted record-arm — so you
  // can arm a synth from Home without opening the immersive page.
  const { trackId: selectedTrackId } = useSelectedInstrument(doc)
  const { armed: recordArmed, setArmed: setRecordArmed } = useRecordArm(selectedTrackId)
  // Home voice switcher: the selected melodic track's current instrument config,
  // flipped through the preset corpus (one setInstrument per step = one undo).
  const selectedTrack = selectedTrackId
    ? doc.tracks.find((t) => t.id === selectedTrackId)
    : undefined
  const voiceConfig =
    selectedTrack && isInstrumentTrack(selectedTrack) ? selectedTrack.instrument : undefined
  const switchVoice = (dir: 1 | -1) => {
    if (!selectedTrackId || !voiceConfig) return
    const config = instantiatePreset(cyclePresetId(voiceConfig, dir))
    if (config) store.dispatch({ t: "setInstrument", trackId: selectedTrackId, config })
  }
  const [masterLevel, setMasterLevel] = useState(0)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastSeq = useRef(0)
  const [commandOpen, setCommandOpen] = useState(false)

  // The headline natural-language surface: one controller for the pack,
  // opened from the Dock-Rail's command button into a palette-level overlay.
  const commandController = useMemo(
    () => createCommandBarController({ store, host, hostApi: host.hostApi, registry }),
    [store, host, registry]
  )
  useEffect(() => () => commandController.dispose(), [commandController])

  // A fresh facade (first mount / ErrorBoundary reset) is always stopped — seed
  // the global transport flag from its truth so the UI starts honest.
  useEffect(() => {
    syncTransportFromAudio(audio)
  }, [audio])

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

  // Stage tiles = every registered module EXCEPT those whose entry lives in the
  // nav / command surface (e.g. Scenes, opened from the Dock-Rail). Such modules
  // stay registered (actions indexed, immersive openable) but get no home tile.
  const tiles = useMemo(() => registry.all().filter((m) => !m.hideOnStage), [registry])
  const immersiveModule = immersiveId ? registry.get(immersiveId) : undefined
  // Scenes lives in the nav: show its Dock-Rail button only when registered.
  const hasScenes = registry.get(SCENES_ID) !== undefined

  const chromeState = immersiveId ? "immersive" : "stage"

  // Feed the time-armed paywall gate on each discrete user UI interaction. ONE
  // capture-phase pointerdown listener on the shell root covers every tappable
  // surface (transport, tile taps, dock actions) without touching individual
  // handlers and — crucially — without ever stopping playback or interrupting
  // an in-progress gesture. The gate's interval + session cap own the cadence.
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!el || !onUserInteraction) return
    const onDown = () => onUserInteraction()
    el.addEventListener("pointerdown", onDown, { capture: true })
    return () => el.removeEventListener("pointerdown", onDown, { capture: true })
  }, [onUserInteraction])

  return (
    <div
      ref={rootRef}
      className="bl-root bl-shell"
      dir={uiDir()}
      data-skin={skin}
      data-bl-chrome={chromeState}
    >
      {/* ---- Stage: calm canvas of placed module tiles ---- */}
      <main className={`bl-stage bl-stage--${form}`}>
        <div className="bl-stage-head">
          <span className="bl-wordmark">beatlounge</span>
          <span className="bl-song-name">{doc.name}</span>
          {voiceConfig && (
            <VoiceSwitcher
              name={matchPreset(voiceConfig)?.name ?? ct("shell.voiceCustom")}
              onPrev={() => switchVoice(-1)}
              onNext={() => switchVoice(1)}
            />
          )}
        </div>
        <div className="bl-stage-grid">
          {tiles.map((m) => (
            <Tile key={m.id} module={m} form={form} host={host} />
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
        onScenes={hasScenes ? () => enterImmersive(SCENES_ID) : undefined}
        onToggleRecordArm={() => setRecordArmed(!recordArmed)}
        recordArmed={recordArmed}
        recordArmAvailable={!!selectedTrackId}
        onExit={() => {
          stopTransport(audio)
          window.dispatchEvent(new CustomEvent("corpan:exit"))
        }}
      />

      {/* ---- Immersive: one module full-bleed at a time ---- */}
      {immersiveModule && (
        <Immersive
          title={immersiveModule.title}
          onExit={() => setImmersiveId(null)}
          playing={playing}
          onToggleTransport={toggleTransport}
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
