/**
 * beatlounge — the phrase-SCRATCH IMMERSIVE view: isolate ONE saved snippet and
 * scratch it like a REAL record. The headline widget.
 *
 *   • PLATTER — a real vinyl the user drags. The disc's accumulated (unwrapped)
 *     angular position maps to ONE LOOPED buffer PLAYHEAD; the fixed needle (3
 *     o'clock) points at that exact moment and the sound is LOCKED to it. A phrase
 *     longer than one revolution spirals inward across turns and LOOPS.
 *   • CONTINUOUS RATE — each frame we derive the disc's signed angular speed and post
 *     it as a RATE to the engine, which integrates `playhead += rate` every sample
 *     and loops at the ends. The audio never freezes between frames. The engine
 *     reports its true playhead back so the needle/visual stay locked to the sound.
 *   • SPIN / HOLD — Spin auto-rotates the platter at natural tempo (rate 1.0, the
 *     phrase plays at normal speed, looping); Hold stops it dead (silence). Scratching
 *     over the top overrides; on release it returns to Spin (if on) or coasts to rest.
 *   • CUT FADER — a throwable level fader on EACH deck (the scratch "cut"): flick it
 *     0→full for fast fade-ins. Exists with a single deck.
 *   • TWO DECKS — an optional second turntable, crossfaded against the first.
 *
 * The engine plays DIRECTLY on the shared AudioContext (a live instrument, not the
 * transport). We dispose the deck(s) + RAF on unmount / snippet change.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import type { EffectKind, EffectNode, FragmentRef } from "../../model/document"
import { bankSnippets } from "../../phrase/bank"
import type { AudioSource } from "../../phrase/audioSource"
import { decodeFragmentBytes } from "../../phrase/decode"
import { Glyph, prefersReducedMotion } from "../../bl-ui"
import { ensureAudio } from "../../engine/ensureAudio"
import { createScratchDeck, type ScratchDeck } from "./scratchEngine"
import { padBufferToRevolution } from "./scratchPad"
import { resolveWordSpans } from "./wordTiming"
import { createLoadToken } from "./loadToken"
import {
  advanceRotationByVel,
  angularVelocityToRate,
  clampRate,
  decayAngularVelocity,
  fmtRate,
  fmtTime,
  isHeld,
  NATURAL_ANGULAR_VEL,
  playheadToRotation,
  rotationToPlayhead,
  SECONDS_PER_RAD,
  wordIndexAt,
  type WordSpan,
} from "./scratchMath"
import { Platter } from "./Platter"
import { CutFader } from "./CutFader"
import { createScratchFxBus, type ScratchFxBus } from "./scratchFxBus"
import {
  emptyScratchChain,
  chainHasActive,
  addInsert,
  removeInsert,
  moveInsert,
  toggleInsert,
  setInsertParams,
} from "./scratchFxLive"
import { FxChainView, type FxForm } from "../fx-rack/FxChainView"
import { ScratchPhrasePanel } from "./ScratchPhrasePanel"
import {
  TrackDrawer,
  type DrawerState,
  type DrawerTabDef,
} from "../track-studio/TrackDrawer"
import "../track-studio/track-studio.css"

const LOG = "[beatlounge/phrase-scratch]"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audioSource: AudioSource
}

/** A snippet's stable identity for picker selection + dedup. */
const refKey = (r: FragmentRef): string => `${r.language ?? ""}:${r.text ?? ""}:${r.voiceId ?? ""}`

/** Split a phrase into word tokens for per-word labels (best-effort). */
const splitWords = (text: string): string[] =>
  text.split(/\s+/).map((w) => w.trim()).filter(Boolean)

/** Per-deck live state held in refs (no per-frame React churn). */
interface DeckRuntime {
  deck: ScratchDeck | null
  spans: WordSpan[]
  words: string[]
  durationSec: number // PADDED loop length (the disc wraps here — integer revolutions)
  phraseSec: number // REAL phrase duration (word placement spirals across this)
  // disc geometry (the 1:1 truth)
  discRot: number
  prevDiscRot: number
  angVel: number // coast/contact angular velocity (rad/s)
  grabbed: boolean
  spinDir: number // auto-rotate: +1 forward, -1 reverse, 0 hold
  // last playhead the ENGINE actually reported (audio truth) — to lock the needle.
  audioSec: number
  unsubPos: (() => void) | null
}

const freshRuntime = (): DeckRuntime => ({
  deck: null,
  spans: [],
  words: [],
  durationSec: 0,
  phraseSec: 0,
  discRot: 0,
  prevDiscRot: 0,
  angVel: 0,
  grabbed: false,
  spinDir: 0,
  audioSec: 0,
  unsubPos: null,
})

/** Which deck a UI surface refers to. */
type DeckId = "a" | "b"

interface DeckView {
  rotation: number
  rate: number
  playheadSec: number
  wordIdx: number
}

const freshView = (): DeckView => ({ rotation: 0, rate: 0, playheadSec: 0, wordIdx: -1 })

export const PhraseScratchImmersive = ({ host, store, audioSource }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const bank = bankSnippets(doc)
  const reduced = prefersReducedMotion()

  // Selection per deck (default: newest saved for A; previous for B).
  const [selKeyA, setSelKeyA] = useState<string | null>(null)
  const [selKeyB, setSelKeyB] = useState<string | null>(null)
  const [showDeckB, setShowDeckB] = useState(false)
  const [crossfade, setCrossfade] = useState(0) // 0 = all A, 1 = all B
  const [pickerFor, setPickerFor] = useState<DeckId | null>(null)
  // Per-deck spin direction (0 = held in the groove, +1 = spin forward, -1 = reverse).
  const [dirA, setDirA] = useState(0)
  const [dirB, setDirB] = useState(0)
  // Cut-fader level per deck (the deck's own level; multiplied with the crossfade).
  const [cutA, setCutA] = useState(1)
  const [cutB, setCutB] = useState(1)

  // ---- master FX rack + phrase discovery: ONE shared bottom drawer (the same
  // surface Drums / Instruments use), with Effects + Phrases tabs. No bespoke
  // popovers. The chain is scratch-local (live bus, no doc coupling). ----------
  const [fxChain, setFxChain] = useState<EffectNode[]>(() => emptyScratchChain())
  const [drawerTab, setDrawerTab] = useState("fx")
  const [drawer, setDrawer] = useState<DrawerState>("peek")
  // Which deck a discovered phrase lands on (A unless the user aims B).
  const [aimDeck, setAimDeck] = useState<DeckId>("a")
  const fxBusRef = useRef<ScratchFxBus | null>(null)

  const selectFor = (key: string | null, fallbackIdx: number): FragmentRef | null => {
    if (bank.length === 0) return null
    if (key) {
      const found = bank.find((r) => refKey(r) === key)
      if (found) return found
    }
    return bank[fallbackIdx] ?? bank[bank.length - 1] ?? null
  }
  const selectedA = useMemo(() => selectFor(selKeyA, bank.length - 1), [bank, selKeyA])
  const selectedB = useMemo(
    () => selectFor(selKeyB, Math.max(0, bank.length - 2)),
    [bank, selKeyB]
  )

  const [loadingA, setLoadingA] = useState(false)
  const [loadingB, setLoadingB] = useState(false)
  const [active, setActive] = useState(false) // a finger is on either platter
  const [viewA, setViewA] = useState<DeckView>(freshView)
  const [viewB, setViewB] = useState<DeckView>(freshView)

  const rtA = useRef<DeckRuntime>(freshRuntime())
  const rtB = useRef<DeckRuntime>(freshRuntime())
  const tokenA = useRef(createLoadToken())
  const tokenB = useRef(createLoadToken())

  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)

  // Keep the runtime's spin direction in sync with the toggles (read in the RAF loop).
  rtA.current.spinDir = dirA
  rtB.current.spinDir = dirB

  // ---- master FX bus: decks feed this; it inserts the chain → destination -----
  // Built once; the decks connect into bus.input (their destination) so the chain
  // colours BOTH decks. The chain is pushed whenever the config changes.
  if (!fxBusRef.current) {
    // Build the bus + wire the initial (bypassed) chain. Idempotent via the ref
    // guard; recreated after a StrictMode dispose/remount. Toggles + param moves
    // go through updateInsert/liveParam (no rebuild).
    const bus = createScratchFxBus(host.audioContext())
    bus.setInserts(fxChain)
    fxBusRef.current = bus
  }
  useEffect(() => {
    return () => {
      fxBusRef.current?.dispose()
      fxBusRef.current = null
    }
  }, [])

  // ---- deck level = cut (this deck) × crossfade contribution ------------------
  useEffect(() => {
    // Equal-power crossfade (only when the second deck exists); otherwise the deck
    // is full and the cut fader alone trims it.
    const xa = showDeckB ? Math.cos((crossfade * Math.PI) / 2) : 1
    const xb = showDeckB ? Math.cos(((1 - crossfade) * Math.PI) / 2) : 0
    rtA.current.deck?.setGain(cutA * xa)
    rtB.current.deck?.setGain(cutB * (showDeckB ? xb : 0))
  }, [crossfade, showDeckB, cutA, cutB])

  // ---- load a snippet onto a deck -------------------------------------------
  const loadDeck = (
    rt: React.MutableRefObject<DeckRuntime>,
    token: React.MutableRefObject<ReturnType<typeof createLoadToken>>,
    selected: FragmentRef | null,
    setLoading: (v: boolean) => void,
    initialGain: number
  ) => {
    const id = token.current.open()
    const stale = () => !token.current.isCurrent(id)

    rt.current.unsubPos?.()
    rt.current.deck?.dispose()
    rt.current = freshRuntime()

    if (!selected || !selected.text || !selected.language) {
      setLoading(false)
      return
    }
    const text = selected.text
    const language = selected.language
    const voiceId = selected.voiceId
    const sha256 = selected.sha256

    setLoading(true)
    void (async () => {
      try {
        const ctx = host.audioContext()
        let bytes = sha256 ? await audioSource.getCachedAudio(sha256) : null
        if (stale()) return
        if (!bytes) {
          const resolved = await audioSource.resolveFragmentAudio(text, language, voiceId)
          if (stale()) return
          if (resolved.audio && resolved.audio.bytes.byteLength > 0) bytes = resolved.audio
        }
        if (!bytes) {
          console.warn(`${LOG} no audio bytes for snippet:`, text)
          host.toast("That snippet has no audio yet — open Phrases to render it")
          if (!stale()) setLoading(false)
          return
        }
        const decoded = await decodeFragmentBytes(ctx, bytes)
        if (stale()) return
        if (!decoded) {
          host.toast("Couldn't decode that snippet")
          setLoading(false)
          return
        }
        // Word spans live on the REAL phrase timeline (before padding).
        const channel = decoded.getChannelData(0)
        const { spans, labels } = resolveWordSpans(
          channel,
          decoded.sampleRate,
          decoded.duration,
          splitWords(text)
        )
        // LOOP-ANGLE FIX: pad the wave with trailing silence to a WHOLE number of
        // revolutions (+ boundary fades) so the loop wraps at an integer disc turn —
        // the phrase START returns under the needle at the SAME angle every loop. The
        // disc mapping uses the PADDED duration; words stay on the real timeline.
        const padded = padBufferToRevolution(ctx, decoded)
        const deck = await createScratchDeck(ctx, padded, {
          gain: initialGain,
          destination: fxBusRef.current?.input,
        })
        if (stale()) {
          deck.dispose()
          return
        }
        rt.current.deck = deck
        rt.current.spans = spans
        rt.current.words = labels.length > 0 ? labels : [text]
        rt.current.durationSec = padded.duration
        rt.current.phraseSec = decoded.duration
        // Lock the needle to the audio: the engine reports its true playhead.
        rt.current.unsubPos = deck.onPos((p) => {
          rt.current.audioSec = p.seconds
        })
        deck.hold()
        setLoading(false)
      } catch (err) {
        console.warn(`${LOG} load failed:`, err)
        if (!stale()) {
          host.toast("Couldn't load that snippet")
          setLoading(false)
        }
      }
    })()
  }

  useEffect(() => {
    loadDeck(rtA, tokenA, selectedA, setLoadingA, 1)
    return () => tokenA.current.invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedA, host, audioSource])

  useEffect(() => {
    if (!showDeckB) return
    loadDeck(rtB, tokenB, selectedB, setLoadingB, 0)
    return () => tokenB.current.invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedB, showDeckB, host, audioSource])

  // ---- the RAF loop: drive both decks --------------------------------------
  useEffect(() => {
    const driveDeck = (rt: DeckRuntime, dt: number): DeckView => {
      const deck = rt.deck
      const dur = rt.durationSec
      if (rt.grabbed) {
        // CONTACT: the disc is where the finger put it (onSweep moved discRot). The
        // signed angular speed this frame → the rate the engine should integrate.
        const moved = rt.discRot - rt.prevDiscRot
        rt.angVel = moved / dt
        deck?.setRate(clampRate(rt.angVel * SECONDS_PER_RAD))
      } else if (rt.spinDir !== 0) {
        // SPIN: auto-rotate at natural tempo (forward or reverse), the phrase at
        // normal speed; the disc turns the matching way.
        rt.angVel = NATURAL_ANGULAR_VEL * rt.spinDir
        rt.discRot = advanceRotationByVel(rt.discRot, rt.angVel, dt)
        deck?.setRate(rt.spinDir)
      } else {
        // RELEASED, not spinning: friction-decay the coast, then HOLD at rest.
        const prevVel = rt.angVel
        rt.angVel = decayAngularVelocity(rt.angVel, dt)
        rt.discRot = advanceRotationByVel(rt.discRot, rt.angVel, dt)
        if (rt.angVel !== 0) deck?.setRate(clampRate(rt.angVel * SECONDS_PER_RAD))
        else if (prevVel !== 0) deck?.hold()
      }

      // NEEDLE LOCK: off-contact (Spin / coast), trust the engine's reported playhead
      // and re-derive the disc rotation from it so visual + sound can never drift over
      // a long spin. While the FINGER owns the disc, discRot is the truth (the audio
      // follows it through the rate slew); while held (dead), the disc stays put.
      const moving = !rt.grabbed && (rt.spinDir !== 0 || rt.angVel !== 0)
      if (moving && dur > 0) {
        // Gently pull discRot toward the rotation that matches the audio playhead,
        // preserving the whole-revolution winding so the spiral/coast stay smooth.
        const targetWithinRev = playheadToRotation(rt.audioSec)
        const revSpan = playheadToRotation(dur)
        if (revSpan > 0) {
          const winding = Math.round((rt.discRot - targetWithinRev) / revSpan)
          const lockedRot = targetWithinRev + winding * revSpan
          rt.discRot += (lockedRot - rt.discRot) * 0.25
        }
      }

      rt.prevDiscRot = rt.discRot
      const playheadSec = rotationToPlayhead(rt.discRot, dur)
      const rate = angularVelocityToRate(rt.angVel)
      const wordIdx = wordIndexAt(rt.spans, playheadSec)
      return { rotation: rt.discRot, rate, playheadSec, wordIdx }
    }

    const tick = (ts: number) => {
      const last = lastTsRef.current
      const dt = last == null ? 1 / 60 : Math.min(0.05, (ts - last) / 1000)
      lastTsRef.current = ts

      const va = driveDeck(rtA.current, dt)
      setViewA((p) =>
        Math.abs(p.rate - va.rate) > 0.01 || p.wordIdx !== va.wordIdx || p.rotation !== va.rotation
          ? va
          : p
      )
      if (showDeckB) {
        const vb = driveDeck(rtB.current, dt)
        setViewB((p) =>
          Math.abs(p.rate - vb.rate) > 0.01 ||
          p.wordIdx !== vb.wordIdx ||
          p.rotation !== vb.rotation
            ? vb
            : p
        )
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastTsRef.current = null
    }
  }, [showDeckB])

  // Tear decks down on unmount.
  useEffect(() => {
    return () => {
      rtA.current.unsubPos?.()
      rtB.current.unsubPos?.()
      rtA.current.deck?.dispose()
      rtB.current.deck?.dispose()
      rtA.current.deck = null
      rtB.current.deck = null
    }
  }, [])

  // ---- platter drag handlers (per deck) -------------------------------------
  const onGrab = (rt: React.MutableRefObject<DeckRuntime>) => () => {
    rt.current.grabbed = true
    rt.current.angVel = 0
    rt.current.prevDiscRot = rt.current.discRot
    setActive(true)
    void ensureAudio(host.audioContext())
  }
  const onSweep = (rt: React.MutableRefObject<DeckRuntime>) => (deltaRadians: number) => {
    rt.current.discRot += deltaRadians
  }
  const onRelease = (rt: React.MutableRefObject<DeckRuntime>) => () => {
    rt.current.grabbed = false
    setActive(false)
    if (rt.current.spinDir !== 0) return // returns to natural spin in the loop
    // Throw the engine with the finger's last rate → it coasts under friction.
    const rate = angularVelocityToRate(rt.current.angVel)
    if (isHeld(rate)) {
      rt.current.angVel = 0
      rt.current.deck?.hold()
    } else {
      rt.current.deck?.setRate(rate)
    }
  }

  const onSelect = (id: DeckId) => (r: FragmentRef) => {
    if (id === "a") setSelKeyA(refKey(r))
    else setSelKeyB(refKey(r))
    setPickerFor(null)
  }

  // Set a deck's spin direction. Tapping the active direction again returns to
  // hold (play/stop are the same button). The RAF reads spinDir live.
  const setSpin = (id: DeckId, want: number) => () => {
    void ensureAudio(host.audioContext())
    const set = id === "a" ? setDirA : setDirB
    const rt = id === "a" ? rtA : rtB
    set((cur) => {
      const next = cur === want ? 0 : want
      if (next === 0) {
        rt.current.angVel = 0
        rt.current.deck?.hold()
      }
      return next
    })
  }

  // ---- master FX rack edits — the FULL canonical pipeline (FxChainView) driven
  // over the LIVE bus. Scratch is a hand-driven performance: the chain lives in
  // local state (no doc, no undo). STRUCTURAL edits (add/remove/reorder) rebuild
  // the bus chain with `setInserts`; toggle/param commits re-apply ONE insert via
  // `updateInsert`; knob drags drive the node in real time via `liveParam`. ------
  const onFxAdd = (kind: EffectKind) => {
    void ensureAudio(host.audioContext())
    setFxChain((chain) => {
      const next = addInsert(chain, kind)
      fxBusRef.current?.setInserts(next)
      return next
    })
  }
  const onFxRemove = (id: string) => {
    setFxChain((chain) => {
      const next = removeInsert(chain, id)
      fxBusRef.current?.setInserts(next)
      return next
    })
  }
  const onFxMove = (id: string, dir: -1 | 1) => {
    setFxChain((chain) => {
      const next = moveInsert(chain, id, dir)
      fxBusRef.current?.setInserts(next)
      return next
    })
  }
  const onFxToggle = (id: string) => {
    void ensureAudio(host.audioContext())
    setFxChain((chain) => {
      const next = toggleInsert(chain, id)
      const node = next.find((n) => n.id === id)
      if (node) fxBusRef.current?.updateInsert(node)
      return next
    })
  }
  const onFxParamLive = (id: string, param: string, value: number) =>
    fxBusRef.current?.liveParam(id, param, value)
  const onFxParamCommit = (id: string, params: Record<string, number | string>) => {
    setFxChain((chain) => {
      const next = setInsertParams(chain, id, params)
      const node = next.find((n) => n.id === id)
      if (node) fxBusRef.current?.updateInsert(node)
      return next
    })
  }

  // ---- a freshly-DISCOVERED phrase (saved to the bank in the Phrases tab) is
  // auto-loaded onto the active deck so "discover → on the platter" is one move.
  // The bank ref keyed by (lang|voice|text) is what the picker/loader selects on.
  const onDiscovered = (saved: { text: string; language: string }) => {
    void ensureAudio(host.audioContext())
    const ref = bank.find(
      (r) => r.text === saved.text && r.language === saved.language
    )
    if (!ref) return
    if (aimDeck === "a") setSelKeyA(refKey(ref))
    else {
      if (!showDeckB) setShowDeckB(true)
      setSelKeyB(refKey(ref))
    }
  }

  // Open the bottom drawer on a given tab (header tools route here). A peeked
  // drawer grows to working height; an already-open one just switches tab.
  const openDrawer = (tab: string) => {
    setDrawerTab(tab)
    setDrawer((d) => (d === "peek" ? "open" : d))
  }

  const fxActive = chainHasActive(fxChain)

  // The shared drawer's tabs: the FULL master effect rack + catalog discovery.
  const drawerTabs: DrawerTabDef[] = [
    {
      id: "fx",
      label: "Effects",
      render: () => (
        <div className="bl-scrfx-chain">
          <FxChainView
            effects={fxChain}
            bpm={doc.bpm}
            form={host.form() as FxForm}
            onAdd={onFxAdd}
            onRemove={onFxRemove}
            onMove={onFxMove}
            onToggle={onFxToggle}
            onParamLive={onFxParamLive}
            onParamCommit={onFxParamCommit}
            header={
              <div className="bl-fxchain-bar" data-bl-nocapture>
                <span className="bl-fxchain-count">
                  {fxChain.length} effect{fxChain.length === 1 ? "" : "s"} · master
                </span>
              </div>
            }
          />
        </div>
      ),
    },
    {
      id: "phrases",
      label: "Phrases",
      render: () => (
        <ScratchPhrasePanel
          host={host}
          store={store}
          audioSource={audioSource}
          loadDeck={aimDeck}
          onAimDeck={setAimDeck}
          showDeckB={showDeckB}
          onDiscovered={onDiscovered}
        />
      ),
    },
  ]

  // ---- empty state: no snippet yet. Keep the shared drawer mounted (open on
  // Phrases) so the user can DISCOVER + load their first phrase right here. -----
  if (bank.length === 0) {
    return (
      <div className="bl-scr">
        <div className="bl-scr-empty">
          <Glyph name="wave" size={28} />
          <p className="bl-scr-empty-title">No snippet to scratch yet</p>
          <p className="bl-scr-empty-sub">
            Open <strong>Phrases</strong> below to find a phrase in the catalog and
            load it onto the turntable.
          </p>
        </div>
        <TrackDrawer
          label="Scratch tools"
          tabsLabel="Scratch tools"
          tabs={drawerTabs}
          activeTab="phrases"
          onTab={openDrawer}
          state={drawer === "peek" ? "open" : drawer}
          setState={setDrawer}
        />
      </div>
    )
  }

  const renderDeck = (
    id: DeckId,
    selected: FragmentRef | null,
    rt: React.MutableRefObject<DeckRuntime>,
    view: DeckView,
    loading: boolean,
    dir: number,
    cut: number,
    setCut: (v: number) => void
  ) => {
    const label = selected?.text ?? ""
    const langTag = selected?.language?.toUpperCase()
    return (
      <div className="bl-scr-deck">
        <div className="bl-scr-bar" data-bl-nocapture>
          <button
            type="button"
            className="bl-scr-picker-btn"
            aria-haspopup="listbox"
            aria-expanded={pickerFor === id}
            onClick={() => setPickerFor((v) => (v === id ? null : id))}
            title="Choose the snippet to scratch"
          >
            <span className="bl-scr-picker-cur" lang={selected?.language}>
              {label || "Pick a snippet"}
            </span>
            <Glyph name="chevron-down" size={14} />
          </button>
        </div>

        {pickerFor === id && (
          <div
            className="bl-scr-picker"
            role="listbox"
            aria-label="Bank snippets"
            data-bl-nocapture
          >
            {[...bank].reverse().map((r) => {
              const k = refKey(r)
              const isSel = selected ? refKey(selected) === k : false
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  className={`bl-scr-picker-row${isSel ? " is-sel" : ""}`}
                  onClick={() => onSelect(id)(r)}
                >
                  <span className="bl-scr-picker-text" lang={r.language}>
                    {r.text ?? "—"}
                  </span>
                  {r.language && (
                    <span className="bl-scr-picker-lang">{r.language.toUpperCase()}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div className="bl-scr-stage">
          <Platter
            rotation={view.rotation}
            phraseSec={rt.current.phraseSec}
            spans={rt.current.spans}
            words={rt.current.words}
            currentWord={view.wordIdx}
            langTag={langTag}
            active={active}
            reducedMotion={reduced}
            onGrab={onGrab(rt)}
            onSweep={onSweep(rt)}
            onRelease={onRelease(rt)}
          />
        </div>
        <CutFader
          value={cut}
          label="Cut fader — fade this deck 0 to full"
          onChange={setCut}
        />

        <div className="bl-scr-transport" data-bl-nocapture>
          <button
            type="button"
            className={`bl-scr-tbtn bl-scr-tbtn--rev${dir === -1 ? " is-on" : ""}`}
            onClick={setSpin(id, -1)}
            aria-pressed={dir === -1}
            aria-label="Reverse — spin backward"
            title="Reverse"
          >
            <Glyph name="play" size={18} />
          </button>
          <button
            type="button"
            className={`bl-scr-tbtn bl-scr-tbtn--spin${dir === 1 ? " is-on" : ""}`}
            onClick={setSpin(id, 1)}
            aria-pressed={dir === 1}
            aria-label="Spin — play at natural tempo (tap again to stop)"
            title="Spin"
          >
            <Glyph name="play" size={18} />
          </button>
        </div>

        <div className="bl-scr-readout" aria-live="off">
          {loading ? (
            <span className="bl-scr-loading">
              <span className="bl-scr-spin" /> loading…
            </span>
          ) : (
            <>
              <span className={`bl-scr-rate${isHeld(view.rate) ? " is-hold" : ""}`}>
                {fmtRate(view.rate)}
              </span>
              <span className="bl-scr-pos">{fmtTime(view.playheadSec)}</span>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`bl-scr${showDeckB ? " is-dual" : ""}`}>
      {/* TOP header: the deck toggle (moved up here so the bottom is free for the
          crossfader + phrase management). FX + Phrases live on the right. */}
      <div className="bl-scr-header" data-bl-nocapture>
        <button
          type="button"
          className={`bl-scr-deckbtn${showDeckB ? " is-on" : ""}`}
          onClick={() => setShowDeckB((v) => !v)}
          aria-pressed={showDeckB}
          aria-label={showDeckB ? "Hide the second deck" : "Add a second deck"}
        >
          <Glyph name="wave" size={16} />
          <span>{showDeckB ? "One deck" : "Two decks"}</span>
        </button>
        <div className="bl-scr-header-tools">
          {/* The header tools OPEN the shared bottom drawer on a tab (they no
              longer toggle bespoke popovers). The drawer's own tab bar reflects
              the active surface; "is-open" lights the tool when its tab is up. */}
          <button
            type="button"
            className={`bl-scr-tool${drawer !== "peek" && drawerTab === "fx" ? " is-open" : ""}${fxActive ? " is-active" : ""}`}
            onClick={() => openDrawer("fx")}
            aria-label="Master effects"
          >
            <Glyph name="sliders" size={16} />
            <span>Effects</span>
          </button>
          <button
            type="button"
            className={`bl-scr-tool${drawer !== "peek" && drawerTab === "phrases" ? " is-open" : ""}`}
            onClick={() => openDrawer("phrases")}
            aria-label="Discover phrases"
          >
            <Glyph name="drawer" size={16} />
            <span>Phrases</span>
          </button>
        </div>
      </div>

      <div className="bl-scr-decks">
        {renderDeck("a", selectedA, rtA, viewA, loadingA, dirA, cutA, setCutA)}
        {showDeckB && renderDeck("b", selectedB, rtB, viewB, loadingB, dirB, cutB, setCutB)}
      </div>

      {/* The foot: the horizontal crossfader (A↔B, fixed above the drawer's peek
          zone, big grab). Never floats; always reachable on stage. */}
      <div className="bl-scr-foot" data-bl-nocapture>
        {showDeckB && (
          <div className="bl-scr-xfade">
            <span className="bl-scr-xfade-end">A</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={crossfade}
              onChange={(e) => setCrossfade(parseFloat(e.target.value))}
              aria-label="Crossfader (A on the left, B on the right)"
              className="bl-scr-xfade-input"
            />
            <span className="bl-scr-xfade-end">B</span>
          </div>
        )}
      </div>

      {/* ---- the SHARED bottom drawer (Effects / Phrases) — the same surface as
          Drums / Instruments. Effects is the FULL master rack; Phrases discovers
          from the whole catalog and loads a new phrase onto a deck. ---- */}
      <TrackDrawer
        label="Scratch tools"
        tabsLabel="Scratch tools"
        tabs={drawerTabs}
        activeTab={drawerTab}
        onTab={openDrawer}
        state={drawer}
        setState={setDrawer}
      />
    </div>
  )
}
