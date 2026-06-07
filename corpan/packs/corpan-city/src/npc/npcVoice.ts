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
 *   - TARGET-LANGUAGE ONLY (R2-2): the candidate set is STRICTLY the voices whose
 *     own `.language` matches the TARGET (what the player is learning). We NEVER
 *     pin a wrong-language voice — if the host returns zero matching voices we pin
 *     nothing and speak language-only, so the NPC's target-language text is never
 *     spoken through a non-target voice (the ES-voice-on-EN-text bug).
 *   - GENDER SPLIT (best effort): when the platform exposes `gender`, we hash the
 *     NPC into the male/female sub-list it falls in, so two NPCs of opposite
 *     "feel" don't collide on one voice. A language with a single voice (common on
 *     iOS) degrades to that one voice — never a crash.
 *   - SESSION-ONLY (#21): the resolved `{ "npcId|target" → {id,language} }` map is
 *     IN-MEMORY ONLY for the life of the resolver (one app run). It is STABLE
 *     within a session (an NPC keeps its voice while you play) but FRESHLY resolved
 *     on each app start, so a stale/old pin can never carry across a restart — the
 *     owner asked to stop persisting individual NPC voices. The key is still SCOPED
 *     TO THE TARGET so a voice pinned for "en" is never reused for "es", and a pin
 *     whose language no longer matches the target is discarded. Any legacy
 *     localStorage pins (`wp:npc:voice:v1`/`v2`) are CLEARED on construction so
 *     nothing from before this change survives.
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
// LEGACY persistence keys to CLEAR on construction (#21 — voices are now
// session-only/in-memory and must NOT be read or written; any pin left by an older
// build must not survive a restart). We never write these anymore.
const LEGACY_STORE_KEYS = ["wp:npc:voice:v1", "wp:npc:voice:v2"] as const

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

/* ----------------------------------------------------------- session-only map */

/** A sticky-voice pin: the chosen voice id + the voice's OWN BCP-47 language, so
 *  the pin site can verify the voice still matches the target. */
type VoicePin = { id: string; language: string }
type VoiceMap = Record<string, VoicePin>

/** The cache key — npcId scoped to the TARGET language, so a voice pinned for one
 *  target is never reused for another (the cross-language leak). */
function pinKey(npcId: string, target: string): string {
  return `${npcId}|${target.toLowerCase()}`
}

/**
 * #21: voices are SESSION-ONLY now. We never read or persist the pin map; it lives
 * in memory for one app run. On construction we CLEAR any legacy localStorage pins
 * (from older builds that persisted) so nothing stale carries across a restart.
 * Best-effort + non-fatal (storage may be unavailable, e.g. tests/private mode).
 */
function clearLegacyPersistedPins(): void {
  try {
    if (typeof localStorage === "undefined") return
    for (const key of LEGACY_STORE_KEYS) {
      if (localStorage.getItem(key) != null) {
        localStorage.removeItem(key)
        console.info(`${LOG} cleared legacy persisted voice map "${key}" (voices are session-only now).`)
      }
    }
  } catch (e) {
    console.warn(`${LOG} could not clear legacy voice-map storage (non-fatal):`, e)
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
 * Choose a voice DETERMINISTICALLY for an NPC from a list of candidate voices.
 * Prefers a male/female split when gender is exposed: the NPC id hashes to a
 * gender bucket AND to an index within it, so two NPCs spread across genders +
 * voices. Falls back to the whole list when gender is "unspecified"/absent (e.g.
 * Android). Returns null only for an empty list.
 *
 * Returns the WHOLE `HostVoiceInfo` (not just the id) so the caller keeps the
 * voice's `.language` — needed to (a) persist it and (b) refuse to pin a
 * wrong-language voice at the TTS layer. The candidate list MUST already be
 * filtered to the target language by the caller (see `voicesFor`).
 */
export function pickVoice(
  npcId: string,
  voices: readonly HostVoiceInfo[],
): HostVoiceInfo | null {
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
    return bucket[mod(h, bucket.length)]
  }

  // No gender info → deterministic over the whole candidate list.
  return voices[mod(h, voices.length)]
}

/**
 * Back-compat shim: the id-only form. Kept because tests + any external caller
 * use it. Prefer `pickVoice` internally (it preserves `.language`).
 */
export function pickVoiceId(npcId: string, voices: readonly HostVoiceInfo[]): string | null {
  return pickVoice(npcId, voices)?.id ?? null
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
  /**
   * CLEAR all voice stickiness (#115): drop every pinned NPC→voice AND the
   * per-language enumerated-voice cache, so the NEXT speak re-resolves from scratch
   * in the CURRENT target. Call on world ENTRY + on any stack/target change. The
   * old design held pins for the life of the resolver, so an ES→EN learner kept the
   * Spanish voices (the `es` voicesByLang cache + `es` pins) after switching to
   * English — "entering the world clears the voice stickiness." Within ONE
   * conversation the runtime resolves once + reuses, so a reset BETWEEN
   * conversations never destabilises an in-flight one.
   */
  reset(): void
}

export function createNpcVoiceResolver(hostApi: HostApi): NpcVoiceResolver {
  // #21: SESSION-ONLY pin map — a fresh empty object per resolver (one app run),
  // never read from / written to localStorage. Clear any legacy persisted pins so
  // nothing from an older (persisting) build carries across a restart.
  clearLegacyPersistedPins()
  const map: VoiceMap = {}
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
          // R2-2 VOICE-LANGUAGE FIX: ONLY voices whose own language matches the
          // TARGET are candidates. The old code kept the FULL list when nothing
          // matched ("so we still pick deterministically") — but that pinned a
          // WRONG-LANGUAGE voice (e.g. a Spanish voice for an English NPC on an
          // ES-locale device, or when the host returns an unfiltered/ES-heavy set),
          // so the NPC spoke English text in a Spanish voice. We now return ONLY
          // matched voices; an empty result → no pin → language-only speak(target),
          // which at least asks the host for the right LANGUAGE.
          // DIAGNOSTIC (noisy, not silent): show what the host returned so we can
          // see on-device whether listVoices honors the language.
          console.info(
            `${LOG} listVoices("${target}") → ${all.length} voices, ${matched.length} match ` +
              `lang "${target}". returned langs: [${[...new Set(all.map((v) => v.language))]
                .slice(0, 12)
                .join(", ")}]`,
          )
          if (matched.length === 0 && all.length > 0) {
            console.warn(
              `${LOG} HOST RETURNED 0 voices matching "${target}" out of ${all.length} — ` +
                `NOT pinning a wrong-language voice; falling back to language-only speak. ` +
                `If this persists, the host's listVoices("${target}") is not language-filtering.`,
            )
          }
          return matched
        } catch (e) {
          console.error(`${LOG} listVoices failed:`, e)
          return []
        }
      })()
      voicesByLang.set(key, p)
    }
    return p
  }

  /**
   * Resolve the sticky voice PIN ({id, language}) for an NPC + target. Cache is
   * keyed by `npcId|target` so a voice pinned for one target is never reused for
   * another. A cached pin whose language no longer matches the target is DISCARDED
   * (defense for any stale/legacy poison). Returns null when no target-language
   * voice is available (then the runtime speaks language-only).
   */
  async function pinFor(npcId: string, target: string): Promise<VoicePin | null> {
    const key = pinKey(npcId, target)
    const cached = map[key]
    if (cached) {
      if (langMatches(cached.language, target)) return cached
      // Stale/wrong-language pin (e.g. left by the old buggy path): drop it.
      console.warn(
        `${LOG} dropping cached voice "${cached.id}" (lang "${cached.language}") for NPC ` +
          `"${npcId}" — does NOT match target "${target}"; re-resolving.`,
      )
      delete map[key]
    }
    const voices = await voicesFor(target)
    const chosen = pickVoice(npcId, voices)
    if (chosen) {
      // SESSION-ONLY (#21): cache in memory for this run; never persisted.
      const pin: VoicePin = { id: chosen.id, language: chosen.language }
      map[key] = pin
      console.info(
        `${LOG} pinned voice "${chosen.id}" (lang "${chosen.language}") to NPC "${npcId}" ` +
          `for target "${target}".`,
      )
      return pin
    }
    return null
  }

  async function voiceIdFor(npcId: string, target: string): Promise<string | null> {
    return (await pinFor(npcId, target))?.id ?? null
  }

  function canPin(): boolean {
    return typeof hostApi.speakVoice === "function"
  }

  /**
   * #115 — clear ALL voice stickiness so the next speak re-resolves in the CURRENT
   * target. Wipes the pin map AND the per-language enumerated-voice cache (an `es`
   * cache must not survive an ES→EN switch). `gapLogged` resets so the host-gap
   * notice can re-surface for the new world entry. Cheap + synchronous.
   */
  function reset(): void {
    const had = Object.keys(map).length
    for (const k of Object.keys(map)) delete map[k]
    voicesByLang.clear()
    gapLogged = false
    console.info(`${LOG} reset voice stickiness (dropped ${had} pin(s) + voice cache).`)
  }

  async function speak(npcId: string, target: string, text: string): Promise<void> {
    const clean = text.trim()
    if (!clean) return
    // Pin the sticky voice when the host can; otherwise language-only speak.
    if (hostApi.speakVoice) {
      const pin = await pinFor(npcId, target)
      // PIN-SITE LANGUAGE GUARD: only pin a voice whose own language matches the
      // target. `pinFor` already filters, but this is belt-and-braces so NO path
      // can ever speak the target's text through a wrong-language voice.
      if (pin && langMatches(pin.language, target)) {
        console.info(
          `${LOG} speakVoice(lang="${target}", voice="${pin.id}" lang="${pin.language}").`,
        )
        await hostApi.speakVoice(target, clean, pin.id)
        return
      }
      // No target-language voice → language-only speak (right LANGUAGE, host picks
      // the voice). Never pin the wrong language.
      console.info(
        `${LOG} no target-language voice to pin for "${target}" → language-only speak.`,
      )
    } else {
      // Still resolve+persist the deterministic choice so the seam is warm and the
      // gap is visible, even though we cannot pin it.
      void pinFor(npcId, target)
      logGapOnce()
    }
    await hostApi.speak(target, clean)
  }

  return { voiceIdFor, canPin, speak, reset }
}
