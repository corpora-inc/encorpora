/**
 * beatlounge — the phrase-sampler PIPELINE: turn a corpus phrase into a playable
 * sampler track.
 *
 *   pick/resolve a phrase (host corpus, languageCodes:[native,target] so we get
 *   gloss + target + romanization) → tokenize the TARGET text into fragments →
 *   resolve audio per fragment via the AudioSource (IDB-cached, synth-vox floor)
 *   → build a TTSFragmentClip → emit registerFragment + addTrack(FragmentTrack)
 *   + placeFragment commands.
 *
 * Two placement modes:
 *   - "stack":   ONE word re-pitched across the steps — the headline riff. The
 *                first token (or a chosen token) is placed on every step with an
 *                ASCENDING in-scale pitch (a major-pentatonic run), so tapping
 *                play sweeps the same sample up the scale.
 *   - "scatter": each token in turn on successive steps at root pitch — the
 *                phrase "spoken" across the bar.
 *
 * The builder is split from the command-emit so the clip can be unit-tested
 * without a store/audio. Resolution of audio is async (AudioSource); building
 * the commands from an already-resolved clip is pure.
 */

import type { Command, TrackInit } from "../model/command"
import type {
  FragmentEvent,
  FragmentRef,
  Grid,
  Id,
  Normalized,
} from "../model/document"
import { newId } from "../model/ids"
import { PPQ, stepsInLoop, tickForStep } from "../model/timing"
import type { EntryOut, HostApi } from "../sdk/types"
import type { AudioSource, ResolvedFragmentAudio } from "./audioSource"
import { tokenizePhrase } from "./tokenize"

export type ClipMode = "stack" | "scatter"

/** One placeable fragment: its resolved audio + display strings. */
export interface ClipFragment {
  /** FragmentRef / library id this maps to. */
  refId: Id
  /** The token text (target language). */
  text: string
  /** Source token index in the phrase. */
  tokenIndex: number
  tier: ResolvedFragmentAudio["tier"]
  hash: string
  durationSec: number
}

/** Per-step performance modifier the stack/scatter mode bakes in. */
export interface StepMod {
  step: number
  /** Which clip fragment (by array index) plays at this step. */
  fragmentIndex: number
  /** -24..+24 semitones — the in-scale "performance". */
  pitchSemis: number
  gain: Normalized
}

/** The fully-resolved sampler clip — the unit the command-builder consumes. */
export interface TTSFragmentClip {
  trackId: Id
  sourceEntryId: number
  sourceName: string
  phraseText: string
  gloss: string
  romanization?: string
  targetLang: string
  nativeLang: string | null
  mode: ClipMode
  fragments: ClipFragment[]
  steps: StepMod[]
  /** The track grid the steps address (sixteenths by default). */
  grid: Grid
  /** Loop length the steps span (ticks). */
  loopTicks: number
}

// ----------------------------------------------------------- scale mapping
/**
 * Major pentatonic degrees (semitone offsets from the root) — the friendliest
 * scale for a "tap a word up the scale" riff: no avoid-notes, always consonant.
 * We wrap across octaves so a long bar keeps climbing.
 */
const PENTATONIC = [0, 2, 4, 7, 9] as const

/** The Nth ascending in-scale step from the root, in semitones. */
export const scaleDegreeSemis = (n: number): number => {
  const octave = Math.floor(n / PENTATONIC.length)
  const degree = ((n % PENTATONIC.length) + PENTATONIC.length) % PENTATONIC.length
  return PENTATONIC[degree] + octave * 12
}

// ----------------------------------------------------------- phrase shaping
/** Pull the translation row for `lang` from an entry (case-insensitive code). */
const rowFor = (entry: EntryOut, lang: string) =>
  entry.translations.find(
    (t) => t.language_code.toLowerCase() === lang.toLowerCase()
  )

/** Resolved phrase strings (target + native gloss + romanization). */
export interface PhraseContent {
  entry: EntryOut
  targetLang: string
  nativeLang: string | null
  phraseText: string
  gloss: string
  romanization?: string
}

/**
 * Resolve the display content for an entry against a stack. languages[0] is the
 * native; the chosen target is the first non-native language (or the only one in
 * a single-language stack, where native is null and the target IS the language).
 */
export const resolvePhraseContent = (
  entry: EntryOut,
  languages: string[]
): PhraseContent => {
  const native = languages[0] ?? null
  const target =
    languages.find((_l, i) => i > 0) ?? languages[0] ?? "en"
  const single = languages.length <= 1
  const nativeLang = single ? null : native
  const targetRow = rowFor(entry, target)
  const nativeRow = nativeLang ? rowFor(entry, nativeLang) : undefined
  return {
    entry,
    targetLang: target,
    nativeLang,
    phraseText: targetRow?.text ?? entry.translations[0]?.text ?? "",
    gloss: nativeRow?.text ?? (single ? "" : entry.translations[0]?.text ?? ""),
    romanization: targetRow?.romanization,
  }
}

/** The language codes to request from the corpus: native + target (deduped). */
export const phraseLanguageCodes = (languages: string[]): string[] => {
  const native = languages[0]
  const target = languages.find((_l, i) => i > 0) ?? languages[0]
  const out: string[] = []
  if (native) out.push(native)
  if (target && target !== native) out.push(target)
  return out
}

// ----------------------------------------------------------- corpus fetch
/** Fetch a random entry (with native+target translations) from the host. */
export const fetchRandomPhrase = async (
  hostApi: HostApi,
  languages: string[],
  filters?: { domains?: string[]; levels?: string[] }
): Promise<EntryOut | null> => {
  const languageCodes = phraseLanguageCodes(languages)
  if (hostApi.getRandomEntries) {
    const list = await hostApi.getRandomEntries({
      count: 1,
      languageCodes,
      domains: filters?.domains,
      levels: filters?.levels,
    })
    return list[0] ?? null
  }
  if (hostApi.getRandomEntry) return (await hostApi.getRandomEntry()) ?? null
  return null
}

// ----------------------------------------------------------- clip builder
const SAMPLER_COLORS = ["#39e0ff", "#c66bff", "#46f0a8", "#ffb24d", "#ff5d6c"]

/** Stable-ish color from an entry id (cosmetic). */
const colorFor = (entryId: number): string =>
  SAMPLER_COLORS[Math.abs(entryId) % SAMPLER_COLORS.length]

const sixteenth: Grid = { denominator: 16 }

export interface BuildClipDeps {
  audioSource: AudioSource
  hostApi: HostApi
  /** Override grid / loop for tests; defaults to a 1-bar sixteenth grid. */
  grid?: Grid
  loopTicks?: number
}

export interface BuildClipOpts {
  content: PhraseContent
  mode: ClipMode
  /** For "stack": which token to riff on (default 0 / first word). */
  stackTokenIndex?: number
  voiceId?: string
}

/**
 * Resolve audio for the phrase's tokens and assemble a TTSFragmentClip. Async
 * because audio resolution hits the AudioSource (synthesize / kit / IDB). The
 * clip is mode-shaped: "stack" maps an ascending pentatonic run of ONE token
 * across the steps; "scatter" lays each token on a successive step at root.
 */
export const buildClip = async (
  deps: BuildClipDeps,
  opts: BuildClipOpts
): Promise<TTSFragmentClip> => {
  const { audioSource } = deps
  const { content, mode } = opts
  const grid = deps.grid ?? sixteenth
  const loopTicks = deps.loopTicks ?? PPQ * 4
  const totalSteps = Math.max(1, stepsInLoop(loopTicks, grid))

  const tokens = tokenizePhrase(content.phraseText, content.targetLang)
  // Always at least one fragment so a clip is never empty (whole phrase).
  const effectiveTokens =
    tokens.length > 0
      ? tokens
      : [{ text: content.phraseText.trim() || content.gloss.trim() || "—", index: 0 }]

  const trackId = newId("trk")

  if (mode === "stack") {
    const ti = Math.min(
      Math.max(0, opts.stackTokenIndex ?? 0),
      effectiveTokens.length - 1
    )
    const token = effectiveTokens[ti]
    const resolved = await audioSource.resolveFragmentAudio(
      token.text,
      content.targetLang,
      opts.voiceId
    )
    const refId = newId("frg")
    const fragment: ClipFragment = {
      refId,
      text: token.text,
      tokenIndex: token.index,
      tier: resolved.tier,
      hash: resolved.hash,
      durationSec: resolved.durationSec,
    }
    // One word, re-pitched up the scale across EVERY step → the riff.
    const steps: StepMod[] = []
    for (let s = 0; s < totalSteps; s++) {
      steps.push({
        step: s,
        fragmentIndex: 0,
        pitchSemis: scaleDegreeSemis(s),
        gain: 0.9,
      })
    }
    return {
      trackId,
      sourceEntryId: content.entry.entry_id,
      sourceName: content.entry.source ?? "base",
      phraseText: content.phraseText,
      gloss: content.gloss,
      romanization: content.romanization,
      targetLang: content.targetLang,
      nativeLang: content.nativeLang,
      mode,
      fragments: [fragment],
      steps,
      grid,
      loopTicks,
    }
  }

  // scatter — each token on a successive step at root pitch.
  const fragments: ClipFragment[] = []
  const steps: StepMod[] = []
  const count = Math.min(effectiveTokens.length, totalSteps)
  for (let i = 0; i < count; i++) {
    const token = effectiveTokens[i]
    const resolved = await audioSource.resolveFragmentAudio(
      token.text,
      content.targetLang,
      opts.voiceId
    )
    fragments.push({
      refId: newId("frg"),
      text: token.text,
      tokenIndex: token.index,
      tier: resolved.tier,
      hash: resolved.hash,
      durationSec: resolved.durationSec,
    })
    steps.push({ step: i, fragmentIndex: i, pitchSemis: 0, gain: 0.9 })
  }

  return {
    trackId,
    sourceEntryId: content.entry.entry_id,
    sourceName: content.entry.source ?? "base",
    phraseText: content.phraseText,
    gloss: content.gloss,
    romanization: content.romanization,
    targetLang: content.targetLang,
    nativeLang: content.nativeLang,
    mode,
    fragments,
    steps,
    grid,
    loopTicks,
  }
}

/**
 * Synchronous clip builder for the LLM action path (no async audio resolution).
 * Builds a clip from plain text whose fragments use the synth-vox FLOOR tier
 * (no bytes) so it is pure + deterministic — the cell still performs (tone), and
 * a later trigger lazily upgrades to real audio if the AudioSource has it cached.
 * Used by `placePhraseText` so the command bus can place a phrase by NL.
 */
export const buildSynthVoxClip = (args: {
  text: string
  targetLang: string
  nativeLang?: string | null
  gloss?: string
  romanization?: string
  mode: ClipMode
  entryId?: number
  sourceName?: string
  grid?: Grid
  loopTicks?: number
  stackTokenIndex?: number
}): TTSFragmentClip => {
  const grid = args.grid ?? sixteenth
  const loopTicks = args.loopTicks ?? PPQ * 4
  const totalSteps = Math.max(1, stepsInLoop(loopTicks, grid))
  const tokens = tokenizePhrase(args.text, args.targetLang)
  const effective =
    tokens.length > 0 ? tokens : [{ text: args.text.trim() || "—", index: 0 }]
  const trackId = newId("trk")
  const mkFrag = (text: string, tokenIndex: number): ClipFragment => ({
    refId: newId("frg"),
    text,
    tokenIndex,
    tier: "synthVox",
    hash: contentHashLite(text, args.targetLang),
    durationSec: 0.4,
  })

  let fragments: ClipFragment[]
  let steps: StepMod[]
  if (args.mode === "stack") {
    const ti = Math.min(Math.max(0, args.stackTokenIndex ?? 0), effective.length - 1)
    const token = effective[ti]
    fragments = [mkFrag(token.text, token.index)]
    steps = []
    for (let s = 0; s < totalSteps; s++) {
      steps.push({ step: s, fragmentIndex: 0, pitchSemis: scaleDegreeSemis(s), gain: 0.9 })
    }
  } else {
    fragments = []
    steps = []
    const count = Math.min(effective.length, totalSteps)
    for (let i = 0; i < count; i++) {
      fragments.push(mkFrag(effective[i].text, effective[i].index))
      steps.push({ step: i, fragmentIndex: i, pitchSemis: 0, gain: 0.9 })
    }
  }

  return {
    trackId,
    sourceEntryId: args.entryId ?? -1,
    sourceName: args.sourceName ?? "base",
    phraseText: args.text,
    gloss: args.gloss ?? "",
    romanization: args.romanization,
    targetLang: args.targetLang,
    nativeLang: args.nativeLang ?? null,
    mode: args.mode,
    fragments,
    steps,
    grid,
    loopTicks,
  }
}

/** A tiny inline hash (avoids importing the audioSource into the pure path). */
const contentHashLite = (text: string, lang: string): string => {
  const input = `${text} ${lang} synthVox`
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

// ----------------------------------------------------------- command emit
/**
 * The fragment track is named by KIND, never by the phrase it carries. A placed
 * phrase used to become the track name ("I will always…"), so a mixer strip read
 * as a sentence and the user couldn't tell what it was. The phrase text lives on
 * the fragment events / lanes — the TRACK is just "Phrases".
 */
const PHRASE_TRACK_NAME = "Phrases"
const trackName = (_clip: TTSFragmentClip): string => PHRASE_TRACK_NAME

/**
 * Compile a resolved clip into the command list (pure). Order matters:
 *   1. registerFragment for each unique fragment (FragmentRef in the library),
 *   2. addTrack(FragmentTrack) with the clip's explicit trackId,
 *   3. placeFragment per step (FragmentEvent at its tick + pitch).
 * The caller wraps these in one undo step (batch) via applyCommands.
 */
export const clipToCommands = (clip: TTSFragmentClip): Command[] => {
  const commands: Command[] = []

  for (const frag of clip.fragments) {
    // FragmentRef.source is the engine asset lane; synthVox rides the ttsRender
    // lane (it's a live-render placeholder with no bytes — the instrument tones
    // it and lazily upgrades when real bytes are cached under the same hash).
    const source: FragmentRef["source"] =
      frag.tier === "voiceKit" ? "voiceKit" : "ttsRender"
    const ref: FragmentRef = {
      id: frag.refId,
      source,
      text: frag.text,
      language: clip.targetLang,
      voiceId: undefined,
      sha256: frag.hash,
      durationSec: frag.durationSec,
    }
    commands.push({ t: "registerFragment", ref })
  }

  const track: TrackInit = {
    id: clip.trackId,
    kind: "fragment",
    name: trackName(clip),
    color: colorFor(clip.sourceEntryId),
    grid: clip.grid,
    volume: 0.8,
    pan: 0,
    mute: false,
    solo: false,
    inserts: [],
    sends: [],
    automation: [],
    instrument: { kind: "ttsFragment" },
    fragments: [],
  }
  commands.push({ t: "addTrack", track })

  for (const mod of clip.steps) {
    const frag = clip.fragments[mod.fragmentIndex]
    if (!frag) continue
    const fragEvent: Omit<FragmentEvent, "id"> = {
      tick: tickForStep(mod.step, clip.grid),
      fragmentId: frag.refId,
      gain: mod.gain,
      pitchSemis: mod.pitchSemis,
    }
    commands.push({ t: "placeFragment", trackId: clip.trackId, frag: fragEvent })
  }

  return commands
}
