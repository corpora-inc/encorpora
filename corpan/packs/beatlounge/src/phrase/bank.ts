/**
 * beatlounge — the phrase BANK: the user's accumulated library of rendered TTS
 * snippets. Saving a combo renders its audio (synthesizeToBuffer → IDB cache via
 * the AudioSource) and registers a FragmentRef in the doc's fragmentLibrary. The
 * sequencer screen reads the bank to place snippets on the grid.
 *
 * The bank list lives in the song (fragmentLibrary, persisted), while the heavy
 * audio bytes live once in IndexedDB keyed by content hash (shared across songs).
 */

import type { BeatloungeDoc, FragmentRef, Id } from "../model/document"
import { newId } from "../model/ids"
import type { AudioSource, AudioSourceTier } from "./audioSource"

export interface BankSaveResult {
  refId: Id
  tier: AudioSourceTier
  /** True if the render produced real audio (not the synth-vox floor). */
  hasAudio: boolean
}

/** Normalize a (text, lang, voice) identity for dedup. */
const ident = (text: string, lang: string, voiceId?: string): string =>
  `${lang.toLowerCase()}|${voiceId ?? ""}|${text}`

/** Is this exact snippet already in the bank? */
export const bankHas = (
  doc: BeatloungeDoc,
  text: string,
  lang: string,
  voiceId?: string
): boolean =>
  (doc.fragmentLibrary ?? []).some(
    (f) => ident(f.text ?? "", f.language ?? "", f.voiceId) === ident(text, lang, voiceId)
  )

/** The saved snippets (newest registrations last; the UI can reverse). */
export const bankSnippets = (doc: BeatloungeDoc): FragmentRef[] => doc.fragmentLibrary ?? []

/**
 * Render a combo's audio (or read cache) and return a FragmentRef to register.
 * Pure of the store — the caller dispatches `registerFragment` so it's one undo
 * step / testable. Returns null only if the combo text is empty.
 */
export const buildBankRef = async (
  audioSource: AudioSource,
  combo: { text: string; lang: string; voiceId?: string }
): Promise<{ ref: FragmentRef; result: BankSaveResult } | null> => {
  const text = combo.text.trim()
  if (!text) return null
  const resolved = await audioSource.resolveFragmentAudio(text, combo.lang, combo.voiceId)
  const refId = newId("frg")
  const ref: FragmentRef = {
    id: refId,
    source: resolved.tier === "voiceKit" ? "voiceKit" : "ttsRender",
    text,
    language: combo.lang,
    voiceId: resolved.voiceId ?? combo.voiceId,
    sha256: resolved.hash,
    durationSec: resolved.durationSec,
  }
  return {
    ref,
    result: { refId, tier: resolved.tier, hasAudio: Boolean(resolved.audio && resolved.audio.bytes.byteLength > 0) },
  }
}
