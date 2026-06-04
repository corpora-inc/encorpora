import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { NpcRole, Quest, Scene } from "@world-plaza/contracts"
import {
  composeSystemPrompt,
  splitToolBlock,
  parseToolBlock,
  extractProseAndIntent,
  selectMood,
  personaSeed,
  MOOD_BEATS,
  resolveGameOffer,
  TOOL_OPEN,
  TOOL_CLOSE,
} from "./promptProgram"
import {
  resolveSegue,
  resolveSegueForSeed,
  segueChipLabel,
  segueTag,
  seguePhraseCount,
} from "./challengeSegues"
import { pickVoiceId } from "./npcVoice"
import { targetLanguageDirective, promptLocaleFor } from "./promptLocale"
import type { HostVoiceInfo } from "./hostTypes"

const here = dirname(fileURLToPath(import.meta.url))
const content = (rel: string) =>
  JSON.parse(readFileSync(resolve(here, "../../content", rel), "utf8"))

describe("content validates against contracts", () => {
  it("content/npc/roles.json → NpcRole[]", () => {
    const roles = NpcRole.array().parse(content("npc/roles.json"))
    expect(roles.map((r) => r.id)).toEqual(["cafe_counter", "tailor", "traveler"])
  })

  it("content/quests/es-cafe.json → Quest", () => {
    const quest = Quest.parse(content("quests/es-cafe.json"))
    expect(quest.learnerPair).toEqual({ target: "es", native: "en" })
    expect(quest.promptProgram.toolWhitelist).toContain("repeat-after")
  })

  it("role anchorIds match scene npcSkins", () => {
    const roles = NpcRole.array().parse(content("npc/roles.json"))
    const scene = Scene.parse(content("scenes/antigua-1770.json"))
    for (const r of roles) expect(scene.npcSkins[r.id]).toBeDefined()
  })
})

describe("system prompt composition", () => {
  const load = () => ({
    roles: NpcRole.array().parse(content("npc/roles.json")),
    quest: Quest.parse(content("quests/es-cafe.json")),
    scene: Scene.parse(content("scenes/antigua-1770.json")),
  })

  it("fills slots and includes the tool protocol", () => {
    const { roles, quest, scene } = load()
    const prompt = composeSystemPrompt({
      npcRole: roles[0],
      scene,
      quest,
      learnerPair: { target: "es", native: "en" },
    })
    expect(prompt).toContain("Spanish")
    expect(prompt).toContain("English")
    expect(prompt).toContain("travel")
    expect(prompt).toContain(TOOL_OPEN)
    expect(prompt).toContain("repeat-after")
    expect(prompt).not.toContain("{persona}")
    expect(prompt).not.toContain("{target}")
  })

  // M1 REGRESSION TEST, UPDATED: the old test asserted byte-identity to the
  // legacy prompt. The owner now WANTS personality on every NPC, so we assert the
  // NEW intended baseline structure instead: a persona SEED, a rotating MOOD beat,
  // and the hard anti-ramble / target-only rails are all present (and the
  // ≤2-sentence cap), for a plain NPC with NO quest facts.
  it("generic NPC prompt carries the new baseline structure (persona seed + mood + rails)", () => {
    const { roles, quest, scene } = load()
    const npcRole = roles[0]
    const mood = selectMood(npcRole.id, 0)
    const prompt = composeSystemPrompt({
      npcRole,
      scene,
      quest,
      learnerPair: { target: "es", native: "en" },
      mood,
    })
    // Persona seed: name/label + scene place, as one sharp clause.
    expect(prompt).toContain(personaSeed(npcRole, scene))
    // Mood beat present and verbatim from the rotation.
    expect(prompt).toContain(mood)
    expect(MOOD_BEATS).toContain(mood)
    // R2-2: the decisive language+behaviour directive is composed IN THE TARGET
    // LANGUAGE (Spanish here), and ENDS the prompt so it primes target-language
    // output. It must be the verbatim es directive (not English) and must name the
    // target's own endonym ("español").
    const directive = targetLanguageDirective("es", false)
    expect(prompt).toContain(directive)
    expect(directive).toContain("Habla SOLO en español")
    // The English "reply in {target} ONLY" rail is GONE (it primed English output).
    expect(prompt).not.toContain("Reply in Spanish ONLY")
    // #37: light, anti-drill direction (be a real local, say something NEW, no
    // "repeat after me", don't ramble) — NOT a rigid drill instruction.
    expect(prompt).toContain("real, warm local")
    expect(prompt).toContain("something NEW every turn")
    expect(prompt).toContain("don't ramble")
    // #37: the OBJECTIVE the model reads is the warm, human goal — it must NOT leak
    // the mechanical challenge toolId or a count (the source of the robotic loop).
    expect(prompt).toContain("help the traveler pick up a few useful, real phrases")
    expect(prompt).not.toContain('"repeat-after" challenge')
    expect(prompt).not.toContain("lots of repetition")
    // A generic NPC injects NO quest-facts block.
    expect(prompt).not.toContain("QUEST CONTEXT")
  })

  it("CHANGE 1: the prompt NEVER mentions challenges or a play-invite (decoupled from LLM)", () => {
    const { roles, quest, scene } = load()
    const prompt = composeSystemPrompt({
      npcRole: roles[0],
      scene,
      quest,
      learnerPair: { target: "es", native: "en" },
      mood: selectMood(roles[0].id, 0),
    })
    // The old per-turn play-invite instruction is GONE — the model does only the
    // free conversation; the segue is a deterministic runtime line now.
    expect(prompt).not.toContain("END your turn")
    expect(prompt).not.toContain("inviting them to learn/play")
    expect(prompt).not.toContain("inviting the traveler to play")
    expect(prompt).not.toContain("game (")
    // The in-language segue TAG is NOT injected into the prompt anymore.
    expect(prompt).not.toContain(segueTag("word-scramble", "es"))
  })

  it("single-language stack → immersion discipline (IN the target language)", () => {
    const { roles, quest, scene } = load()
    const prompt = composeSystemPrompt({
      npcRole: roles[0],
      scene,
      quest,
      learnerPair: { target: "es", native: "es" },
    })
    // The immersion directive is the es immersion variant, composed in Spanish
    // ("inmersión total") — not an English "immersion" string.
    const immersion = targetLanguageDirective("es", true)
    expect(prompt).toContain(immersion)
    expect(immersion).toContain("inmersión total")
  })

  it("R2-2: prompt directive language = TARGET; AR target → Arabic directive (native script)", () => {
    const { roles, quest, scene } = load()
    // Learning AR from EN → the decisive directive must be Arabic, in Arabic script,
    // naming the target's endonym ("العربية"), so a small model is primed to write
    // Arabic instead of Latin-character babble.
    const arPrompt = composeSystemPrompt({
      npcRole: roles[0],
      scene,
      quest,
      learnerPair: { target: "ar", native: "en" },
    })
    const arDirective = targetLanguageDirective("ar", false)
    expect(arPrompt).toContain(arDirective)
    expect(arDirective).toContain(promptLocaleFor("ar").endonym) // العربية
    expect(arDirective).toMatch(/[؀-ۿ]/) // contains Arabic script
    expect(arPrompt).not.toContain("Reply in")

    // Learning EN from AR → the directive is English ("Speak ONLY in English").
    const enPrompt = composeSystemPrompt({
      npcRole: roles[0],
      scene,
      quest,
      learnerPair: { target: "en", native: "ar" },
    })
    expect(enPrompt).toContain(targetLanguageDirective("en", false))
    expect(enPrompt).toContain("Speak ONLY in English")
  })
})

describe("mood selector (deterministic rotation)", () => {
  it("same (id, visit) → same mood; consecutive visits differ", () => {
    const a0 = selectMood("crowd:baker:7", 0)
    const a0b = selectMood("crowd:baker:7", 0)
    const a1 = selectMood("crowd:baker:7", 1)
    expect(a0).toBe(a0b) // deterministic
    expect(a0).not.toBe(a1) // two different visit counts pick different moods
    expect(MOOD_BEATS).toContain(a0)
    expect(MOOD_BEATS).toContain(a1)
  })

  it("wraps around the beat set and stays in-range for any visit", () => {
    for (let v = 0; v < 40; v++) {
      expect(MOOD_BEATS).toContain(selectMood("npc-x", v))
    }
    // Wrap: visit N and visit N+MOOD_BEATS.length collide (mod arithmetic).
    expect(selectMood("npc-x", 2)).toBe(selectMood("npc-x", 2 + MOOD_BEATS.length))
  })
})

// The English fallback phrases (used to assert the ES bank never leaks English).
const EN_WORD_SCRAMBLE = [
  "Here, let me show you a word.",
  "See if you can unscramble it.",
  "Let's build a word.",
]

describe("challenge segues (deterministic, target-language, no English) — CHANGE 1", () => {
  it("resolveSegue returns a TARGET-LANGUAGE phrase for a known tool (never English)", () => {
    const seg = resolveSegue("word-scramble", "es", 0)
    expect(typeof seg).toBe("string")
    expect(seg.length).toBeGreaterThan(0)
    // Never one of the English fallback phrases for this tool.
    expect(EN_WORD_SCRAMBLE).not.toContain(seg)
  })

  it("the ES bank has ~10 distinct phrases per tool (varied intros)", () => {
    for (const tool of ["word-scramble", "read-aloud", "number-drill", "fast-translate"] as const) {
      expect(seguePhraseCount(tool, "es")).toBeGreaterThanOrEqual(10)
      // distinctness within the tool's ES phrase bag
      const set = new Set(
        Array.from({ length: seguePhraseCount(tool, "es") }, (_, i) => resolveSegue(tool, "es", i)),
      )
      expect(set.size).toBe(seguePhraseCount(tool, "es"))
    }
  })

  it("resolveSegue rotates deterministically by turn (and wraps)", () => {
    const s0 = resolveSegue("number-drill", "es", 0)
    const s0b = resolveSegue("number-drill", "es", 0)
    const s1 = resolveSegue("number-drill", "es", 1)
    expect(s0).toBe(s0b) // deterministic
    expect(s0).not.toBe(s1) // the next turn picks a different phrase
    // wraps cleanly at the bag length (no throw / NaN)
    const n = seguePhraseCount("number-drill", "es")
    expect(resolveSegue("number-drill", "es", n)).toBe(s0)
  })

  it("resolveSegueForSeed varies by NPC seed, stays target-language, is stable", () => {
    const a = resolveSegueForSeed("word-scramble", "es", "crowd:baker:7|0|0")
    const aAgain = resolveSegueForSeed("word-scramble", "es", "crowd:baker:7|0|0")
    expect(a).toBe(aAgain) // same seed → same phrase (sticky)
    // Across a spread of NPC/visit seeds we see real variety, all Spanish.
    const seen = new Set<string>()
    for (let npc = 0; npc < 12; npc++) {
      for (let visit = 0; visit < 4; visit++) {
        const p = resolveSegueForSeed("word-scramble", "es", `crowd:n${npc}|${visit}|0`)
        expect(EN_WORD_SCRAMBLE).not.toContain(p) // never English
        seen.add(p)
      }
    }
    expect(seen.size).toBeGreaterThan(4) // genuinely varied, not monotonous
  })

  it("chip label is a short target-language word", () => {
    expect(segueChipLabel("read-aloud", "es")).toBe("Leer")
    expect(segueChipLabel("word-scramble", "es")).toBe("Jugar")
  })

  it("legacy/alias tool ids resolve to their canonical segues", () => {
    // repeat-after → say-it-back
    expect(segueChipLabel("repeat-after", "es")).toBe(segueChipLabel("say-it-back", "es"))
  })

  it("resolveGameOffer carries a target-language segue + chip label (not English)", () => {
    const roles = NpcRole.array().parse(content("npc/roles.json"))
    const quest = Quest.parse(content("quests/es-cafe.json"))
    const offer = resolveGameOffer(roles[0], quest, 0, "es")
    expect(offer).not.toBeNull()
    expect(typeof offer!.segue).toBe("string")
    expect(offer!.chipLabel.length).toBeGreaterThan(0)
    // The chip label matches the resolved tool's Spanish label.
    expect(offer!.chipLabel).toBe(segueChipLabel(offer!.tool, "es"))
  })
})

describe("sticky per-NPC voice (CHANGE 2)", () => {
  const V = (id: string, gender: HostVoiceInfo["gender"] = "unspecified"): HostVoiceInfo => ({
    id,
    language: "es-ES",
    gender,
  })

  it("pickVoiceId is DETERMINISTIC: same NPC → same voice, forever", () => {
    const voices = [V("v1"), V("v2"), V("v3"), V("v4")]
    const a = pickVoiceId("crowd:baker:7", voices)
    const aAgain = pickVoiceId("crowd:baker:7", voices)
    expect(a).toBe(aAgain)
    expect(voices.map((v) => v.id)).toContain(a)
  })

  it("different NPCs spread across the available voices (variety)", () => {
    const voices = [V("v1"), V("v2"), V("v3"), V("v4"), V("v5")]
    const chosen = new Set(
      Array.from({ length: 20 }, (_, i) => pickVoiceId(`npc-${i}`, voices)),
    )
    expect(chosen.size).toBeGreaterThan(1)
  })

  it("prefers a male/female split when gender is exposed", () => {
    const voices = [V("m1", "male"), V("m2", "male"), V("f1", "female"), V("f2", "female")]
    // Across many NPCs both genders are used (not stuck on one bucket).
    const ids = new Set(Array.from({ length: 30 }, (_, i) => pickVoiceId(`p${i}`, voices)))
    const males = ["m1", "m2"].filter((id) => ids.has(id))
    const females = ["f1", "f2"].filter((id) => ids.has(id))
    expect(males.length).toBeGreaterThan(0)
    expect(females.length).toBeGreaterThan(0)
  })

  it("single-voice language degrades to that one voice, never crashes", () => {
    const one = [V("only-one")]
    expect(pickVoiceId("crowd:boatman:1", one)).toBe("only-one")
    expect(pickVoiceId("anyone", one)).toBe("only-one")
  })

  it("empty voice list → null (runtime then speaks language-only)", () => {
    expect(pickVoiceId("npc", [])).toBeNull()
  })

  it("#21: STICKY within a session, SESSION-ONLY (never persisted to localStorage)", async () => {
    // Minimal localStorage shim (vitest env is node).
    const backing = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
      clear: () => backing.clear(),
      key: () => null,
      length: 0,
    }
    const { createNpcVoiceResolver } = await import("./npcVoice")
    const voices = [V("v1", "male"), V("v2", "female"), V("v3", "male")]
    const host = {
      speak: async () => {},
      speakVoice: async () => {},
      listVoices: async () => voices,
    }
    const r = createNpcVoiceResolver(host as never)
    const first = await r.voiceIdFor("crowd:boatman:1", "es")
    expect(first).not.toBeNull()
    // Same NPC, same resolver → identical (sticky WITHIN the session, no rotation).
    expect(await r.voiceIdFor("crowd:boatman:1", "es")).toBe(first)
    // #21: NOTHING is persisted — no voice-map key is written to localStorage.
    expect(backing.has("wp:npc:voice:v2")).toBe(false)
    expect(backing.has("wp:npc:voice:v1")).toBe(false)
    expect(r.canPin()).toBe(true)
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it("#21: a fresh resolver re-resolves from scratch (NOT loaded from storage) + clears legacy pins on load", async () => {
    const backing = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
      clear: () => backing.clear(),
      key: () => null,
      length: 0,
    }
    // Seed a STALE persisted pin from an older (persisting) build — boatman|en
    // wrongly pinned to a Spanish voice. A fresh resolver must IGNORE it (no read)
    // AND remove the legacy key on construction.
    backing.set(
      "wp:npc:voice:v2",
      JSON.stringify({ "crowd:boatman:1|en": { id: "es-ES-stale", language: "es-ES" } }),
    )
    backing.set("wp:npc:voice:v1", JSON.stringify({ "crowd:boatman:1": "es-ES-older" }))
    const { createNpcVoiceResolver } = await import("./npcVoice")
    const host = {
      speak: async () => {},
      speakVoice: async () => {},
      listVoices: async () => [{ id: "en-US-1", language: "en-US", gender: "male" as const }],
    }
    const r = createNpcVoiceResolver(host as never)
    // Legacy keys cleared on construction (voices are session-only now).
    expect(backing.has("wp:npc:voice:v2")).toBe(false)
    expect(backing.has("wp:npc:voice:v1")).toBe(false)
    // The stale es pin is NOT reused — a real EN voice is freshly resolved.
    expect(await r.voiceIdFor("crowd:boatman:1", "en")).toBe("en-US-1")
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it("resolver: no host listVoices/speakVoice → still deterministic, language-only speak", async () => {
    const backing = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
      clear: () => backing.clear(),
      key: () => null,
      length: 0,
    }
    const { createNpcVoiceResolver } = await import("./npcVoice")
    let spoke = ""
    const host = { speak: async (_l: string, t: string) => void (spoke = t) }
    const r = createNpcVoiceResolver(host as never)
    expect(r.canPin()).toBe(false)
    // No enumeration → null voice, but speak() still works via language-only path.
    expect(await r.voiceIdFor("npc", "es")).toBeNull()
    await r.speak("npc", "es", "Hola")
    expect(spoke).toBe("Hola")
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it("R2-2: voice is enumerated + spoken from the TARGET language code passed", async () => {
    const backing = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
      clear: () => backing.clear(),
      key: () => null,
      length: 0,
    }
    const { createNpcVoiceResolver } = await import("./npcVoice")
    // Voices for several languages; the resolver must pick from the language code
    // it is given (the TARGET) — proving an EN-learning NPC gets an EN voice, never
    // a Spanish one (the ES→EN bug). `listVoices(target)` here returns ALL voices;
    // the resolver filters by the requested language.
    const all = [
      { id: "es-ES-1", language: "es-ES", gender: "male" as const },
      { id: "en-US-1", language: "en-US", gender: "male" as const },
      { id: "en-GB-2", language: "en-GB", gender: "female" as const },
    ]
    let listedWith = ""
    let spokeWith = ""
    const host = {
      speak: async (lang: string) => void (spokeWith = lang),
      speakVoice: async (lang: string) => void (spokeWith = lang),
      listVoices: async (code?: string) => {
        listedWith = code ?? ""
        return all
      },
    }
    const r = createNpcVoiceResolver(host as never)
    // Learning EN → voice must be an EN voice (the resolver matched on "en").
    const v = await r.voiceIdFor("boatman", "en")
    expect(listedWith).toBe("en")
    expect(v).toMatch(/^en-/)
    await r.speak("boatman", "en", "Hello")
    expect(spokeWith).toBe("en") // spoken in the TARGET language, not "es"
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  // The ACTIVE on-device bug: host returns voices for listVoices("en") but NONE
  // are English (ES-locale device / unfiltered host). The OLD code kept the full
  // list and pinned a Spanish voiceId → ES voice speaking EN text. Now: no pin,
  // language-only speak — never a wrong-language voice.
  it("R2-2: host returns ZERO target-language voices → NO pin, language-only speak (no wrong-lang voice)", async () => {
    const backing = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
      clear: () => backing.clear(),
      key: () => null,
      length: 0,
    }
    const { createNpcVoiceResolver } = await import("./npcVoice")
    // listVoices("en") returns ONLY Spanish voices (the device-locale failure mode).
    const esOnly = [
      { id: "es-ES-1", language: "es-ES", gender: "male" as const },
      { id: "es-MX-2", language: "es-MX", gender: "female" as const },
    ]
    const calls: Array<{ fn: string; lang: string; voice?: string }> = []
    const host = {
      speak: async (lang: string) => void calls.push({ fn: "speak", lang }),
      speakVoice: async (lang: string, _t: string, voice: string) =>
        void calls.push({ fn: "speakVoice", lang, voice }),
      listVoices: async () => esOnly,
    }
    const r = createNpcVoiceResolver(host as never)
    // No English voice exists → resolve to null (never pin a Spanish voice for EN).
    expect(await r.voiceIdFor("boatman", "en")).toBeNull()
    await r.speak("boatman", "en", "Hello")
    // MUST have used language-only speak("en", …), NOT speakVoice with an es voice.
    expect(calls.some((c) => c.fn === "speakVoice")).toBe(false)
    expect(calls).toEqual([{ fn: "speak", lang: "en" }])
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it("R2-2: pin cache is scoped to TARGET — an 'en' voice is never reused for 'es'", async () => {
    const backing = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
      clear: () => backing.clear(),
      key: () => null,
      length: 0,
    }
    const { createNpcVoiceResolver } = await import("./npcVoice")
    const all = [
      { id: "en-US-1", language: "en-US", gender: "male" as const },
      { id: "es-ES-1", language: "es-ES", gender: "male" as const },
    ]
    const host = {
      speak: async () => {},
      speakVoice: async () => {},
      listVoices: async () => all,
    }
    const r = createNpcVoiceResolver(host as never)
    const en = await r.voiceIdFor("npc-1", "en")
    const es = await r.voiceIdFor("npc-1", "es")
    expect(en).toMatch(/^en-/)
    expect(es).toMatch(/^es-/) // NOT the cached en voice — different target → own pin.
    expect(en).not.toBe(es)
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  it("R2-2: a stale wrong-language cached pin is DISCARDED, not reused", async () => {
    const backing = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
      clear: () => backing.clear(),
      key: () => null,
      length: 0,
    }
    // Seed a poisoned pin: NPC "boatman" learning "en" wrongly pinned to a Spanish
    // voice (what the old buggy path could persist). Under the v2 key shape.
    backing.set(
      "wp:npc:voice:v2",
      JSON.stringify({ "boatman|en": { id: "es-ES-9", language: "es-ES" } }),
    )
    const { createNpcVoiceResolver } = await import("./npcVoice")
    const host = {
      speak: async () => {},
      speakVoice: async () => {},
      listVoices: async () => [{ id: "en-US-1", language: "en-US", gender: "male" as const }],
    }
    const r = createNpcVoiceResolver(host as never)
    // The stale es pin must be dropped and a real EN voice resolved instead.
    expect(await r.voiceIdFor("boatman", "en")).toBe("en-US-1")
    delete (globalThis as { localStorage?: unknown }).localStorage
  })

  // THE on-device symptom, reproduced as a regression: the player FIRST lives in
  // an es-target context (immersion, or a prior ES-target stack) so the NPC's
  // voice is pinned to a Spanish voice; THEN they switch to learn EN. The same NPC
  // id must NOT reuse the Spanish pin for the English visit. This is the exact
  // sequence behind "EN text, ES voice". VERIFIED red against the pre-fix code
  // (`map[npcId]` cache, no target in the key → returns the es voice for "en") and
  // green after the fix (cache keyed by `npcId|target` + language guard).
  it("R2-2 REGRESSION: live in es THEN learn en → the en visit gets an en voice, never the es one", async () => {
    const backing = new Map<string, string>()
    ;(globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => void backing.set(k, v),
      removeItem: (k: string) => void backing.delete(k),
      clear: () => backing.clear(),
      key: () => null,
      length: 0,
    }
    const { createNpcVoiceResolver } = await import("./npcVoice")
    // A correctly language-FILTERED host (the owner says the host is fine): it
    // returns only the voices for the requested language code.
    const all = [
      { id: "es-ES-Monica", language: "es-ES", gender: "female" as const },
      { id: "en-US-Samantha", language: "en-US", gender: "female" as const },
    ]
    const host = {
      speak: async () => {},
      speakVoice: async () => {},
      listVoices: async (uiCode?: string) => {
        const base = (uiCode ?? "").toLowerCase().split("-")[0]
        return base ? all.filter((v) => v.language.toLowerCase().split("-")[0] === base) : all
      },
    }
    const r = createNpcVoiceResolver(host as never)
    // 1) Player lives in es → boatman pinned to the (only) Spanish voice.
    expect(await r.voiceIdFor("boatman", "es")).toBe("es-ES-Monica")
    // 2) Player switches the stack to learn EN. SAME npc id, target now "en".
    const enVoice = await r.voiceIdFor("boatman", "en")
    // MUST be an English voice — the bug returned "es-ES-Monica" here.
    expect(enVoice).toBe("en-US-Samantha")
    expect(enVoice!.toLowerCase().split("-")[0]).toBe("en")
    delete (globalThis as { localStorage?: unknown }).localStorage
  })
})

describe("clue-giver item grant is idempotent (CHANGE 3)", () => {
  // Mirrors npcRuntime.maybeGrantClueItem's contract: grant once, never on a
  // repeat visit, against a REAL inventory (the engine grants, never the model).
  const grantOnce = (
    store: { has: (id: string) => boolean; grant: (id: string, q?: number) => void; qtyOf: (id: string) => number },
    duty: "clue" | "deliver" | undefined,
    givesItemId: string | undefined,
  ): boolean => {
    if (duty !== "clue" || !givesItemId) return false
    if (store.has(givesItemId)) return false // idempotent
    store.grant(givesItemId, 1)
    return true
  }

  it("a clue-giver grants exactly once across repeat visits", async () => {
    const { createInventory } = await import("../economy/inventory")
    const store = createInventory()
    store.reset()
    expect(store.has("ferry-token")).toBe(false)
    // First visit → granted + revealed.
    expect(grantOnce(store, "clue", "ferry-token")).toBe(true)
    expect(store.qtyOf("ferry-token")).toBe(1)
    // Repeat visits → no double-grant, no reveal.
    expect(grantOnce(store, "clue", "ferry-token")).toBe(false)
    expect(grantOnce(store, "clue", "ferry-token")).toBe(false)
    expect(store.qtyOf("ferry-token")).toBe(1)
    store.reset()
  })

  it("a deliver-duty NPC (or no gives) never grants", async () => {
    const { createInventory } = await import("../economy/inventory")
    const store = createInventory()
    store.reset()
    expect(grantOnce(store, "deliver", "ferry-token")).toBe(false)
    expect(grantOnce(store, "clue", undefined)).toBe(false)
    expect(store.has("ferry-token")).toBe(false)
    store.reset()
  })
})

describe("tool-block streaming split + parse", () => {
  it("plain prose has no tool", () => {
    const r = splitToolBlock("Hola, ¿cómo estás?")
    expect(r.prose).toBe("Hola, ¿cómo estás?")
    expect(r.toolStarted).toBe(false)
    expect(r.rawTool).toBeUndefined()
  })

  it("hides prose once the opener streams in, before the closer arrives", () => {
    const partial = `Bien hecho.\n${TOOL_OPEN}{"kind":"reward","xp":10`
    const r = splitToolBlock(partial)
    expect(r.prose).toBe("Bien hecho.\n")
    expect(r.toolStarted).toBe(true)
    expect(r.rawTool).toBeUndefined()
  })

  it("extracts + validates a complete callTool block", () => {
    const full = `Repite conmigo.\n${TOOL_OPEN}{"kind":"callTool","tool":"repeat-after","spec":{"phrase":"Un café, por favor."}}${TOOL_CLOSE}`
    const { prose, intent } = extractProseAndIntent(full)
    expect(prose).toBe("Repite conmigo.")
    expect(intent?.kind).toBe("callTool")
    if (intent?.kind === "callTool") {
      expect(intent.tool).toBe("repeat-after")
      expect(intent.spec).toEqual({ phrase: "Un café, por favor." })
    }
  })

  it("malformed JSON → null, never throws", () => {
    expect(parseToolBlock("{not json")).toBeNull()
  })

  it("schema-invalid block → null", () => {
    expect(parseToolBlock('{"kind":"explode"}')).toBeNull()
  })

  // ---- #38: bare control JSON (no <<tool>> delimiters) must NEVER leak ---------
  it("#38: a BARE control object (no delimiters) is stripped from prose + parsed as intent", () => {
    // The exact screenshot leak: a reward object emitted as plain text.
    const full = '¡Muy bien! Lo dijiste perfecto.\n{ "kind": "reward", "xp": 10 }'
    const { prose, intent } = extractProseAndIntent(full)
    // The JSON is GONE from the spoken/displayed prose.
    expect(prose).toBe("¡Muy bien! Lo dijiste perfecto.")
    expect(prose).not.toContain("kind")
    expect(prose).not.toContain("{")
    // …and it parsed as the reward intent.
    expect(intent?.kind).toBe("reward")
    if (intent?.kind === "reward") expect(intent.xp).toBe(10)
  })

  it("#38: a bare control object mid-line is removed; the surrounding prose survives", () => {
    const full = 'Toma esto {"kind":"questStep","stepId":"docks"} y sigue.'
    const { prose, intent } = extractProseAndIntent(full)
    expect(prose).not.toContain("{")
    expect(prose).not.toContain("questStep")
    expect(prose).toContain("Toma esto")
    expect(prose).toContain("y sigue")
    expect(intent?.kind).toBe("questStep")
  })

  it("#38: streaming holds prose once a bare control object STARTS forming", () => {
    const partial = 'Bien hecho. {"kind":"reward","xp":1'
    const r = splitToolBlock(partial)
    expect(r.prose).toBe("Bien hecho. ")
    expect(r.toolStarted).toBe(true)
    expect(r.prose).not.toContain("kind")
    expect(r.rawTool).toBeUndefined()
  })

  it("#38: a bare callTool object (no delimiters) is still routed as a tool call", () => {
    const full = 'Vamos a practicar.\n{"kind":"callTool","tool":"repeat-after","spec":{}}'
    const { prose, intent } = extractProseAndIntent(full)
    expect(prose).toBe("Vamos a practicar.")
    expect(intent?.kind).toBe("callTool")
  })

  it("#38: a NON-control JSON-looking brace in prose is LEFT ALONE (no false positive)", () => {
    // A normal aside with braces that is NOT a control payload must stay visible.
    const full = "El horario es {de 9 a 5}. ¿Te ayudo?"
    const r = splitToolBlock(full)
    expect(r.prose).toBe("El horario es {de 9 a 5}. ¿Te ayudo?")
    expect(r.toolStarted).toBe(false)
    expect(r.rawTool).toBeUndefined()
  })

  it("#38: a JSON object WITHOUT a control kind is not treated as control", () => {
    const full = 'Mira: {"precio": 10, "moneda": "EUR"} es el costo.'
    const r = splitToolBlock(full)
    expect(r.prose).toContain('{"precio": 10, "moneda": "EUR"}')
    expect(r.rawTool).toBeUndefined()
  })
})
