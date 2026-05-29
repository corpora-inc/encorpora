/**
 * Phrases the player grabs and throws at the Rat King — the game's "sound is
 * force" idea made literal. Each is a word for listening / sound / speech drawn
 * from an ancient tongue.
 *
 * `ttsLang` is the voice we ask the host to speak it in, kept SEPARATE from
 * `label`/`displayLang`: several of these languages have no offline voice, so we
 * lean on a playful proxy voice for now (Sanskrit→Croatian, Nahuatl & K'iche'→
 * Latin-American Spanish, plus a few extra tongues for variety). The pronunciation
 * is approximate-and-fun for this pass; we can perfect it later with real audio
 * without touching the display text.
 */
export interface BossPhrase {
  id: string
  /** Text shown on the floating token (native script, or romanized for proxies). */
  display: string
  /** Short English gloss shown with the token. */
  gloss: string
  /** Language name shown to the player. */
  label: string
  /** Code passed to hostApi.speak — may be a proxy voice (see file header). */
  ttsLang: string
  /** Optional BCP-47 of the script, when it differs from the TTS voice. */
  displayLang?: string
}

export const BOSS_PHRASES: BossPhrase[] = [
  { id: "ta_kel", display: "கேள்", gloss: "Listen!", label: "Tamil", ttsLang: "ta" },
  { id: "ta_oli", display: "ஒலி", gloss: "Sound", label: "Tamil", ttsLang: "ta" },
  { id: "yue_teng", display: "聽住!", gloss: "Listen!", label: "Cantonese", ttsLang: "yue-Hant-HK" },
  { id: "el_akou", display: "Άκουσε", gloss: "Hear me", label: "Greek", ttsLang: "el" },
  { id: "el_foni", display: "Φωνή", gloss: "Voice", label: "Greek", ttsLang: "el" },
  // Sanskrit voiced via a Croatian proxy.
  { id: "sa_srnu", display: "Śṛṇu", gloss: "Hear!", label: "Sanskrit", ttsLang: "hr" },
  { id: "sa_nada", display: "Nāda", gloss: "Sound", label: "Sanskrit", ttsLang: "hr" },
  // Nahuatl + K'iche' voiced via a Latin-American Spanish proxy.
  { id: "nah_xikcaki", display: "Xikcaki", gloss: "Listen", label: "Nahuatl", ttsLang: "es-419" },
  { id: "nah_tlahtolli", display: "Tlahtōlli", gloss: "The word", label: "Nahuatl", ttsLang: "es-419" },
  { id: "quc_tatabej", display: "Tatabej", gloss: "Hear it", label: "K'iche'", ttsLang: "es-419" },
  { id: "quc_tzij", display: "Tzij", gloss: "The word", label: "K'iche'", ttsLang: "es-419" },
  // Extra tongues, for variety of voice.
  { id: "tr_dinle", display: "Dinle!", gloss: "Listen!", label: "Turkish", ttsLang: "tr" },
  { id: "pt_escuta", display: "Escuta!", gloss: "Listen!", label: "Portuguese", ttsLang: "pt-PT" },
  { id: "id_dengar", display: "Dengar!", gloss: "Listen!", label: "Indonesian", ttsLang: "id" },
]
