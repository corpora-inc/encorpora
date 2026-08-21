// Compose a Drift micro-story from the learner's real corpus — pair-agnostic.
import type { HostApi, EntryOut } from "../sdk/types"
import type { ActivitySpec, ItemRef } from "../sdk/activityContract"
import { pickScene, type Scene, type SceneMotif } from "./stories"

/** One read beat: a target-language line + its native gloss, split into
 *  tappable tokens (each token carries its own gloss where we have one). */
export type Beat = {
  motif: SceneMotif
  /** Full target-language line spoken by TTS + shown. */
  targetText: string
  /** Native-language gloss for the whole line (tap the line to reveal). */
  nativeGloss: string
  /** Word tokens for tap-to-reveal + word-highlighting. Punctuation stays
   *  attached; glossable tokens map to a per-word gloss where available. */
  tokens: Token[]
  /** The ItemRef this beat came from (for journey reporting), when known. */
  itemRef?: ItemRef
}

export type Token = {
  text: string
  /** Native gloss for THIS token, when we have one (else the line gloss). */
  gloss?: string
  glossable: boolean
}

export type ComposedStory = {
  scene: Scene
  beats: Beat[]
  targetLang: string
  nativeLang: string | null
}

/** Resolve native + target codes from stack/spec. Pair-agnostic: never
 *  hardcoded. On a single-language (immersion) stack nativeLang is null and
 *  Drift degrades to target-only (no gloss reveal). */
export function resolveLangs(
  hostApi: HostApi,
  spec: ActivitySpec | null,
): { targetLang: string; nativeLang: string | null } {
  if (spec) {
    return { targetLang: spec.targetLang, nativeLang: spec.nativeLang ?? null }
  }
  const cfg = hostApi.getStackConfig()
  const langs = cfg.languages ?? []
  // Convention: languages[0] = native, languages[1..] = targets. A
  // single-entry list is an immersion stack (target only).
  if (langs.length >= 2) return { nativeLang: langs[0], targetLang: langs[1] }
  if (langs.length === 1) return { nativeLang: null, targetLang: langs[0] }
  return { nativeLang: "en", targetLang: "es" }
}

const pick = (entry: EntryOut, code: string) =>
  entry.translations.find((t) => t.language_code === code)

/** Tokenize a target line into tappable words (punctuation-aware). Whole-line
 *  gloss is used as the fallback per-token gloss so every word reveals meaning
 *  even when we lack a word-level gloss. */
function tokenize(target: string, lineGloss: string): Token[] {
  const parts = target.match(/\S+|\s+/g) ?? [target]
  return parts.map((p) => {
    const isSpace = /^\s+$/.test(p)
    const core = p.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "")
    return {
      text: p,
      glossable: !isSpace && core.length > 0,
      gloss: isSpace ? undefined : lineGloss,
    }
  })
}

function beatFromEntry(
  entry: EntryOut,
  motif: SceneMotif,
  targetLang: string,
  nativeLang: string | null,
): Beat | null {
  const t = pick(entry, targetLang)
  if (!t || !t.text.trim()) return null
  const n = nativeLang ? pick(entry, nativeLang) : null
  const gloss = n?.text ?? ""
  return {
    motif,
    targetText: t.text,
    nativeGloss: gloss,
    tokens: tokenize(t.text, gloss),
    itemRef: entry.source
      ? { kind: "phrase", source: entry.source, id: String(entry.entry_id) }
      : { kind: "phrase", source: "base", id: String(entry.entry_id) },
  }
}

/**
 * Compose a story. When a journey spec supplies itemRefs, the FIRST few phrase
 * refs become the story's beats (so a Drift can feature the learner's current
 * word/phrase). Remaining beats are filled from getRandomEntries so the scene
 * always has enough calm lines. Fully pair-agnostic + multilingual.
 */
export async function composeStory(
  hostApi: HostApi,
  spec: ActivitySpec | null,
  seed: number,
): Promise<ComposedStory> {
  const { targetLang, nativeLang } = resolveLangs(hostApi, spec)
  const scene = pickScene(seed)
  const wanted = scene.motifs.length
  const beats: Beat[] = []

  // 1. Feature spec itemRefs (the current word/phrase) first, when present.
  const phraseRefs = (spec?.itemRefs ?? []).filter((r) => r.kind === "phrase")
  for (const ref of phraseRefs) {
    if (beats.length >= wanted) break
    if (!hostApi.getEntryById) break
    try {
      const idNum = Number(ref.id)
      if (!Number.isFinite(idNum)) continue
      const entry = await hostApi.getEntryById(idNum, ref.source)
      if (!entry) continue
      const beat = beatFromEntry(entry, scene.motifs[beats.length], targetLang, nativeLang)
      if (beat) { beat.itemRef = ref; beats.push(beat) }
    } catch {
      /* fall through to random fill */
    }
  }

  // 2. Fill the rest from the learner's corpus.
  if (beats.length < wanted) {
    const need = wanted - beats.length
    let pool: EntryOut[] = []
    try {
      pool = (await hostApi.getRandomEntries?.(need + 3)) ?? []
    } catch { pool = [] }
    if (pool.length === 0 && hostApi.getRandomEntry) {
      for (let i = 0; i < need; i++) {
        try { const e = await hostApi.getRandomEntry(); if (e) pool.push(e) } catch { /* ignore */ }
      }
    }
    for (const entry of pool) {
      if (beats.length >= wanted) break
      const beat = beatFromEntry(entry, scene.motifs[beats.length], targetLang, nativeLang)
      if (beat) beats.push(beat)
    }
  }

  return { scene, beats, targetLang, nativeLang }
}
