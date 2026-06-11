/**
 * beatlounge — the phrase-SCRATCH IMMERSIVE view: isolate ONE saved snippet and
 * scratch it like a REAL record. The headline widget.
 *
 *   • PLATTER — a real vinyl the user drags. The disc's accumulated (unwrapped)
 *     angular position maps to ONE clamped buffer PLAYHEAD; the fixed needle points
 *     at that exact moment and the sound is LOCKED to it. A phrase longer than one
 *     revolution spirals inward across turns. No grains, no looping — one wave, one
 *     read-head (the AudioWorklet scratch engine; ScriptProcessor fallback).
 *   • IN CONTACT — the parent posts the exact target buffer position each frame;
 *     the engine scrubs the playhead to it. Emergent rate = the finger's speed.
 *   • RELEASE — the engine is thrown with the finger's last rate and coasts under
 *     friction; the AUDIO slows + stops with the disc.
 *   • TWO DECKS — an optional second turntable, crossfaded against the first.
 *   • PICKER — choose which bank snippet is loaded onto each deck.
 *
 * The engine plays DIRECTLY on the shared AudioContext (a live instrument, not the
 * transport). We dispose the deck(s) + RAF on unmount / snippet change.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import type { FragmentRef } from "../../model/document"
import { bankSnippets } from "../../phrase/bank"
import type { AudioSource } from "../../phrase/audioSource"
import { decodeFragmentBytes } from "../../phrase/decode"
import { Glyph, prefersReducedMotion } from "../../bl-ui"
import { ensureAudio } from "../../engine/ensureAudio"
import { createScratchDeck, type ScratchDeck } from "./scratchEngine"
import { resolveWordSpans } from "./wordTiming"
import { createLoadToken } from "./loadToken"
import {
  advanceRotationByVel,
  angularVelocityToRate,
  decayAngularVelocity,
  fmtRate,
  fmtTime,
  isHeld,
  rotationToPlayhead,
  wordIndexAt,
  type WordSpan,
} from "./scratchMath"
import { Platter } from "./Platter"

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
  durationSec: number
  // disc geometry (the 1:1 truth)
  discRot: number
  prevDiscRot: number
  angVel: number // coast angular velocity (rad/s), off-contact only
  grabbed: boolean
}

const freshRuntime = (): DeckRuntime => ({
  deck: null,
  spans: [],
  words: [],
  durationSec: 0,
  discRot: 0,
  prevDiscRot: 0,
  angVel: 0,
  grabbed: false,
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

  // ---- crossfade → deck gains (equal-power-ish) -----------------------------
  useEffect(() => {
    const a = Math.cos((crossfade * Math.PI) / 2)
    const b = Math.cos(((1 - crossfade) * Math.PI) / 2)
    rtA.current.deck?.setGain(showDeckB ? a : 1)
    rtB.current.deck?.setGain(showDeckB ? b : 0)
  }, [crossfade, showDeckB])

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
        // RAW wave — one buffer, one read-head. Word spans for the groove labels.
        const channel = decoded.getChannelData(0)
        const { spans, labels } = resolveWordSpans(
          channel,
          decoded.sampleRate,
          decoded.duration,
          splitWords(text)
        )
        const deck = await createScratchDeck(ctx, decoded, { gain: initialGain })
        if (stale()) {
          deck.dispose()
          return
        }
        rt.current.deck = deck
        rt.current.spans = spans
        rt.current.words = labels.length > 0 ? labels : [text]
        rt.current.durationSec = decoded.duration
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
      if (rt.grabbed) {
        // Contact: the disc is where the finger put it (onSweep). Post the exact
        // buffer position (seconds) the needle should be at → the engine scrubs
        // the single playhead there. Rate emerges from the move this frame.
        const moved = rt.discRot - rt.prevDiscRot
        rt.angVel = moved / dt
        const playheadSec = rotationToPlayhead(rt.discRot, rt.durationSec)
        deck?.setTargetSeconds(playheadSec)
      } else {
        // Released: friction-decay the coast. The disc advances and we keep the
        // visual + audio locked by re-posting position; when it stops, hold.
        const prevVel = rt.angVel
        rt.angVel = decayAngularVelocity(rt.angVel, dt)
        rt.discRot = advanceRotationByVel(rt.discRot, rt.angVel, dt)
        const playheadSec = rotationToPlayhead(rt.discRot, rt.durationSec)
        if (rt.angVel !== 0) {
          deck?.setTargetSeconds(playheadSec)
        } else if (prevVel !== 0) {
          deck?.hold() // just came to rest → silence (held record)
        }
      }
      rt.prevDiscRot = rt.discRot
      const playheadSec = rotationToPlayhead(rt.discRot, rt.durationSec)
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
    // Throw the engine with the finger's last rate → it coasts under friction.
    const rate = angularVelocityToRate(rt.current.angVel)
    if (isHeld(rate)) rt.current.deck?.hold()
    else rt.current.deck?.release(rate)
  }

  const onSelect = (id: DeckId) => (r: FragmentRef) => {
    if (id === "a") setSelKeyA(refKey(r))
    else setSelKeyB(refKey(r))
    setPickerFor(null)
  }

  // ---- empty state ----------------------------------------------------------
  if (bank.length === 0) {
    return (
      <div className="bl-scr">
        <div className="bl-scr-empty">
          <Glyph name="wave" size={28} />
          <p className="bl-scr-empty-title">No snippet to scratch yet</p>
          <p className="bl-scr-empty-sub">
            Open <strong>Phrases</strong> to audition words and save them to your
            bank. Saved snippets can be loaded onto the turntable here.
          </p>
        </div>
      </div>
    )
  }

  const renderDeck = (
    id: DeckId,
    selected: FragmentRef | null,
    rt: React.MutableRefObject<DeckRuntime>,
    view: DeckView,
    loading: boolean
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

        <Platter
          rotation={view.rotation}
          durationSec={rt.current.durationSec}
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
      <div className="bl-scr-decks">
        {renderDeck("a", selectedA, rtA, viewA, loadingA)}
        {showDeckB && renderDeck("b", selectedB, rtB, viewB, loadingB)}
      </div>

      {showDeckB && (
        <div className="bl-scr-xfade" data-bl-nocapture>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={crossfade}
            onChange={(e) => setCrossfade(parseFloat(e.target.value))}
            aria-label="Crossfader (deck A to deck B)"
            className="bl-scr-xfade-input"
          />
        </div>
      )}

      <div className="bl-scr-controls" data-bl-nocapture>
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
      </div>
    </div>
  )
}
