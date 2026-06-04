/**
 * npcVoice — STICKY per-NPC TTS voice (CHANGE 2).
 *
 * THE PROBLEM: the default TTS rotates through every chosen voice, so the SAME
 * NPC sounds different line to line and visit to visit. The owner wants ONE voice
 * per NPC that STICKS — the boatman always sounds like the boatman.
 *
 * THE DESIGN:
 *   - DETERMINISTIC: an NPC's voice is a hash of its id over the available voices
 *     for the target language. Same NPC → same voice, forever (no model, no RNG).
 *   - GENDER SPLIT (best effort): when the platform exposes `gender`, we hash the
 *     NPC into the male/female sub-list it falls in, so two NPCs of opposite
 *     "feel" don't collide on one voice. A language with a single voice (common on
 *     iOS) degrades to that one voice — never a crash.
 *   - PERSISTED: the resolved `{ npcId → voiceId }` is cached in localStorage
 *     (`wp:npc:voice:v1`, tiny — one short string per NPC) so returning to the same
 *     NPC reuses the same voice even before the (async) voice list resolves.
 *   - NEVER ROTATES MID-CONVERSATION: the runtime resolves the voice ONCE at open
 *     and reuses it for every line of that conversation (see `npcRuntime`).
 *
 * ──────────────────────────── PER-PLATFORM BEHAVIOR ────────────────────────────
 *   iOS / macOS (AVSpeechSynthesis): voices are per BCP-47 region ("es-ES",
 *     "es-MX"); gender is exposed; many languages have ONLY one installed voice
 *     until the user downloads more (the Apple "premium voices" gap). With one
 *     voice we deterministically pick it (sticky, but no variety) — variety
 *     improves automatically as the user installs voices.
 *   Android (TextToSpeech): voices enumerate richly per engine, gender often
 *     "unspecified" → we fall back to hashing over the whole language list (still
 *     deterministic + sticky). Network voices are allowed (the host filters).
 *   Browser / standalone dev (Web Speech): `speechSynthesis.getVoices()` is
 *     used by the host; enumeration is flaky on first paint (handled host-side).
 *
 * ──────────────────────────────── HOST GAP ─────────────────────────────────────
 *   The host does NOT yet expose voice listing OR a per-utterance voice id to
 *   packs (`hostApi.speak` is language-only; the native `voice_id` arg is not
 *   reachable). `hostTypes.ts` SPECS the two optional members this module needs:
 *     - `hostApi.listVoices(uiCode?)  → HostVoiceInfo[]`   (enumeration)
 *     - `hostApi.speakVoice(uiCode, text, voiceId)`        (voice-pinned speak)
 *   Until the host implements them, this module still ASSIGNS a deterministic
 *   voiceId per NPC and PERSISTS it (so the seam is ready), but the runtime cannot
 *   pin it at the TTS layer and falls back to `speak(uiCode, text)`. The chosen
 *   voiceId is logged once so the gap is visible (project rule: noisy, not silent).
 */

import type { HostApi, HostVoiceInfo } from "./hostTypes"

const LOG = "[wp/npcVoice]"
const STORE_KEY = "wp:npc:voice:v1"

/** Tiny stable hash (FNV-1a) → 32-bit. Same seed → same index, forever. */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Non-negative modulo (guards a negative/NaN seed). */
function mod(n: number, m: number): number {
  if (m <= 0) return 0
  return ((n % m) + m) % m
}

/* --------------------------------------------------------------- persistence */

type VoiceMap = Record<string, string>

function readMap(): VoiceMap {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as VoiceMap) : {}
  } catch (e) {
    console.warn(`${LOG} voice-map storage unavailable, using memory:`, e)
    return {}
  }
}

function writeMap(map: VoiceMap): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map))
  } catch (e) {
    console.warn(`${LOG} could not persist NPC voice map (non-fatal):`, e)
  }
}

/* ------------------------------------------------------------ voice selection */

/** A voice matches a target language if its BCP-47 base matches ("es" vs "es-MX"). */
function langMatches(voiceLang: string | undefined, target: string): boolean {
  if (!voiceLang) return false
  const v = voiceLang.toLowerCase()
  const t = target.toLowerCase().split("-")[0]
  return v === t || v.startsWith(t + "-")
}

/**
 * Choose a voice id DETERMINISTICALLY for an NPC from a list of candidate voices.
 * Prefers a male/female split when gender is exposed: the NPC id hashes to a
 * gender bucket AND to an index within it, so two NPCs spread across genders +
 * voices. Falls back to the whole list when gender is "unspecified"/absent (e.g.
 * Android). Returns null only for an empty list.
 */
export function pickVoiceId(npcId: string, voices: readonly HostVoiceInfo[]): string | null {
  if (voices.length === 0) return null
  const h = hashStr(`voice|${npcId}`)

  const gendered = voices.filter((v) => v.gender === "male" || v.gender === "female")
  if (gendered.length > 0) {
    const males = gendered.filter((v) => v.gender === "male")
    const females = gendered.filter((v) => v.gender === "female")
    // Pick the gender bucket by a SECOND hash bit so it's independent of the index.
    const preferMale = (hashStr(`gender|${npcId}`) & 1) === 0
    const primary = preferMale ? males : females
    const fallback = preferMale ? females : males
    const bucket = primary.length > 0 ? primary : fallback.length > 0 ? fallback : gendered
    return bucket[mod(h, bucket.length)].id
  }

  // No gender info → deterministic over the whole candidate list.
  return voices[mod(h, voices.length)].id
}

/**
 * The sticky-voice resolver. Constructed once per game (or per runtime). It:
 *   - reads the persisted map at construction (so a known NPC resolves instantly),
 *   - lazily enumerates voices (host gap: only if `hostApi.listVoices` exists),
 *   - assigns + persists a deterministic voice on first sight of an NPC,
 *   - exposes `voiceIdFor(npcId, target)` the runtime calls ONCE at open.
 */
export interface NpcVoiceResolver {
  /**
   * The sticky voice id for this NPC + target language, or null when we cannot
   * determine one (no host enumeration AND nothing cached) — the runtime then
   * speaks with the language-only path. Resolves quickly: a cached id returns
   * synchronously-fast; a first sighting awaits one voice enumeration.
   */
  voiceIdFor(npcId: string, target: string): Promise<string | null>
  /** Whether the host can actually PIN the chosen voice (`speakVoice` present). */
  canPin(): boolean
  /** Speak `text` in `target`, pinning the NPC's voice when the host supports it. */
  speak(npcId: string, target: string, text: string): Promise<void>
}

export function createNpcVoiceResolver(hostApi: HostApi): NpcVoiceResolver {
  const map: VoiceMap = readMap()
  // Per (target) cache of the enumerated voice list, so we enumerate at most once
  // per language per session (enumeration can be slow / flaky on first paint).
  const voicesByLang = new Map<string, Promise<HostVoiceInfo[]>>()
  let gapLogged = false

  function logGapOnce(): void {
    if (gapLogged) return
    gapLogged = true
    console.warn(
      `${LOG} HOST GAP: hostApi.listVoices / speakVoice not exposed — NPC voices ` +
        `are chosen deterministically + persisted but cannot be pinned at the TTS ` +
        `layer; speaking with language-only speak(). See hostTypes.ts / npcVoice.ts.`,
    )
  }

  async function voicesFor(target: string): Promise<HostVoiceInfo[]> {
    const key = target.toLowerCase().split("-")[0]
    let p = voicesByLang.get(key)
    if (!p) {
      p = (async () => {
        if (!hostApi.listVoices) {
          logGapOnce()
          return []
        }
        try {
          const all = await hostApi.listVoices(target)
          const matched = all.filter((v) => langMatches(v.language, target))
          // If nothing matched the language (host returned all voices), keep the
          // full list so we still pick deterministically rather than nothing.
          return matched.length > 0 ? matched : all
        } catch (e) {
          console.error(`${LOG} listVoices failed:`, e)
          return []
        }
      })()
      voicesByLang.set(key, p)
    }
    return p
  }

  async function voiceIdFor(npcId: string, target: string): Promise<string | null> {
    const cached = map[npcId]
    if (cached) return cached
    const voices = await voicesFor(target)
    const chosen = pickVoiceId(npcId, voices)
    if (chosen) {
      map[npcId] = chosen
      writeMap(map)
      console.info(`${LOG} assigned sticky voice "${chosen}" to NPC "${npcId}" (${target}).`)
    }
    return chosen
  }

  function canPin(): boolean {
    return typeof hostApi.speakVoice === "function"
  }

  async function speak(npcId: string, target: string, text: string): Promise<void> {
    const clean = text.trim()
    if (!clean) return
    // Pin the sticky voice when the host can; otherwise language-only speak.
    if (hostApi.speakVoice) {
      const voiceId = await voiceIdFor(npcId, target)
      if (voiceId) {
        await hostApi.speakVoice(target, clean, voiceId)
        return
      }
    } else {
      // Still resolve+persist the deterministic choice so the seam is warm and the
      // gap is visible, even though we cannot pin it.
      void voiceIdFor(npcId, target)
      logGapOnce()
    }
    await hostApi.speak(target, clean)
  }

  return { voiceIdFor, canPin, speak }
}
