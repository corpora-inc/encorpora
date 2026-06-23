/**
 * challengeSegues — SHORT, target-language ways to hand a micro-challenge to the
 * traveler, plus a short target-language label for the Play chip and a 2–3-word
 * "tag" naming the game.
 *
 * WHY THIS EXISTS — and what changed (CHANGE 1, the "decouple the segue from the
 * LLM" pass):
 *
 *   The challenge intro USED to be the model's job: we injected the challenge
 *   TYPE into the Qwen3-4B system prompt and told it to END every turn with a
 *   one-clause invite. That (a) burned the 4B model's limited brain, (b) made it
 *   re-append a redundant "¿me ayudas…?" on every turn (NPC_PROMPT_STUDY
 *   pathology #1), and (c) sometimes drifted into English. The model is now
 *   NEVER told about challenges — it does ONLY the free, natural conversation.
 *
 *   The challenge intro is now 100% DETERMINISTIC and TARGET-LANGUAGE. When the
 *   runtime is about to surface the Play chip it speaks one HARDCODED segue phrase
 *   from this bank — no model, no English, ever. Selection is deterministic (by
 *   tool + a rotating index/visit) so it VARIES across NPCs/visits without the
 *   model. `resolveSegue(tool, target, turn)` picks the phrase; the runtime drives
 *   `turn` off the NPC seed + visit (see `npcRuntime.segueForOffer`).
 *
 * Keyed by `ChallengeToolId`, then by language code. Legacy tool ids are aliased
 * onto their canonical tool. A target with no per-tool locale uses generated
 * TARGET-LANGUAGE generic handoff text; it never falls back to English/Spanish
 * for a different target.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * LOCALIZATION-SCALE PLAN (≈ 20 tools × 10 phrases × ~50 langs ≈ 10k strings).
 *
 *   The structure below is built to make "add a language" a pure DATA edit: drop
 *   a new `<langCode>: { tag, chip, phrases:[…10…] }` block under each tool key.
 *   Nothing in the resolver is language-specific. The full 50-language fill is a
 *   SEPARATE localization-generation task (see docs/LOCALIZATION_SCALE.md): the
 *   pipeline that translates the 10k phrase pack (one tool×phrase row per lang)
 *   will emit a generated `challengeSegues.<lang>.ts` (or a JSON sidecar) merged
 *   in via `registerSegueLocale(lang, table)`. We ship rich `es` + `en` banks by
 *   hand now; all other shipped targets use generated target-language generic
 *   handoffs until the full per-tool generator backfills the rest. KEEP phrases
 *   short, imperative, in-character (TEACHER/GUIDE, varied — NOT the monotonous
 *   "help me"), and read-cleanly-aloud, because TTS speaks them verbatim.
 * ───────────────────────────────────────────────────────────────────────────
 */

import type { ChallengeToolId } from "@corpan-city/contracts"
import { genericSegueText } from "./runtimeLanguageText"

/** Per-language data for one challenge tool. */
type SegueLocale = {
  /** A 2–3-word in-language TAG naming the game ("una palabra", "los precios"). */
  tag: string
  /** A SHORT target-language Play-chip label ("Jugar", "Adivinar"). */
  chip: string
  /** A handful of SHORT target-language segue phrases (no-LLM fallback). */
  phrases: readonly string[]
}

/** Legacy/alias tool ids → the canonical tool whose segues we reuse. */
const SEGUE_ALIAS: Partial<Record<ChallengeToolId, ChallengeToolId>> = {
  "pronunciation-duel": "read-aloud",
  "speed-drill": "fast-translate",
  "listen-choose": "listen-choose-pic",
  "translate-fast": "fast-translate",
  "fill-blank": "fill-the-blank",
  "repeat-after": "say-it-back",
}

/**
 * The rich segue data. Spanish is authored for the shipping Antigua world, and
 * English is authored for English-target tracks. Other targets must not use these
 * as cross-language fallbacks; the resolver drops to generated target-language
 * generic handoffs instead.
 *
 * REFRAME (NPC-prompt-craft pass): the NPC is the TEACHER/GUIDE, not a helpless
 * person. Every tool used to open with the SAME "¿me ayudas…?" ("help ME") frame,
 * which was monotonous and confusing. Each tool now has a VARIED bag of ~10
 * invites keyed to what the game actually does — show / guess / say-back /
 * practice / test-your-ear / try — framed as the NPC guiding the learner. "Help
 * me" survives as ONE flavour (e.g. a scramble the NPC pretends fell apart),
 * never universal. ~10 distinct phrases per tool ⇒ across NPCs+visits the intro
 * almost never repeats.
 *
 * NOTE on `mutableSegues`: exported as `let` (not `const`) so a generated
 * per-language locale module can MERGE additional `<lang>` blocks at load via
 * `registerSegueLocale()` without re-shipping this file — the 50-language plan.
 */
let mutableSegues: Partial<Record<ChallengeToolId, Record<string, SegueLocale>>> = {
  "word-scramble": {
    es: { tag: "una palabra", chip: "Jugar", phrases: ["Mira, te enseño una palabra.", "A ver si la ordenas.", "Vamos a armar una palabra.", "Estas letras están revueltas; ordénalas.", "¿Puedes desordenarla y armarla bien?", "Te reto: ordena esta palabra.", "Practiquemos una palabra juntos.", "Acomoda las letras en su lugar.", "Esta palabra está hecha un lío, ¿la arreglas?", "¿Te animas a armarla?"] },
    en: { tag: "a word", chip: "Play", phrases: ["Here, let me show you a word.", "See if you can unscramble it.", "Let's build a word.", "My letters got jumbled — help me?", "Can you put it back in order?", "I'll challenge you: order this word.", "Let's practice a word together.", "Set the letters in their place.", "This word's a mess — fix it?", "Up for building it?"] },
  },
  "read-aloud": {
    es: { tag: "este letrero", chip: "Leer", phrases: ["Léeme este letrero, a ver.", "Practica leyéndolo en voz alta.", "Pruébalo: léelo conmigo.", "A ver cómo suena en tu voz.", "Anímate, léelo despacio.", "Te toca leer este cartel.", "Dilo en voz alta, sin miedo.", "Vamos a leerlo juntos.", "Muéstrame cómo lo lees.", "¿Le das voz a estas palabras?"] },
    en: { tag: "this sign", chip: "Read", phrases: ["Read me this sign, let's hear it.", "Practice reading it aloud.", "Give it a try — read it with me.", "Let's hear it in your voice.", "Go on, read it slowly.", "Your turn to read this sign.", "Say it aloud, don't be shy.", "Let's read it together.", "Show me how you read it.", "Want to give these words a voice?"] },
  },
  "listen-choose-pic": {
    es: { tag: "qué digo", chip: "Escuchar", phrases: ["Aguza el oído: ¿qué digo?", "A ver si adivinas qué digo.", "Escucha bien y elige.", "Pon a prueba tu oído conmigo.", "Te digo una y tú la señalas.", "¿Cuál es? Escucha con cuidado.", "Afina el oído, va una.", "Adivina cuál digo por su sonido.", "A ver si lo distingues.", "Practiquemos escuchando."] },
    en: { tag: "what I say", chip: "Listen", phrases: ["Test your ear — what am I saying?", "See if you can guess what I say.", "Listen closely and choose.", "Let's test your ear together.", "I'll say one — you point to it.", "Which is it? Listen carefully.", "Sharpen your ear, here comes one.", "Guess it by the sound.", "I'll challenge you to hear it right.", "Let's practice by listening."] },
  },
  "picture-match": {
    es: { tag: "las etiquetas", chip: "Emparejar", phrases: ["Te reto a emparejarlas.", "A ver si las unes bien.", "Practica: junta cada par.", "Cada dibujo con su palabra.", "¿Puedes casar las parejas?", "Une lo que va junto.", "Vamos a emparejar conmigo.", "Pon cada uno con el suyo.", "A ver tu vista: emparéjalos.", "Junta los que combinan."] },
    en: { tag: "the labels", chip: "Match", phrases: ["I'll challenge you to pair these.", "See if you can match them up.", "Practice — join each pair.", "Each picture to its word.", "Can you wed the pairs?", "Join what belongs together.", "Let's match them up with me.", "Put each with its own.", "Test your eye — pair them.", "Join the ones that fit."] },
  },
  "fast-translate": {
    es: { tag: "rápido", chip: "Traducir", phrases: ["Rápido, ¿qué significa?", "A ver qué tan veloz eres.", "Te lanzo una: ¿qué quiere decir?", "Sin pensarlo: ¿cómo se dice?", "Veloz, tradúceme esta.", "¿Lista la mente? Va una rápida.", "Dime al vuelo qué significa.", "Te reto a contestar rapidito.", "Practiquemos traduciendo rápido.", "A toda prisa: ¿qué es?"] },
    en: { tag: "quick", chip: "Translate", phrases: ["Quick — what does it mean?", "Let's see how fast you are.", "I'll toss you one: what's it mean?", "No thinking — how do you say it?", "Fast, translate this for me.", "Mind ready? Here's a quick one.", "Tell me on the fly what it means.", "I'll challenge you to answer fast.", "Let's practice translating quickly.", "In a hurry — what is it?"] },
  },
  "fill-the-blank": {
    es: { tag: "el hueco", chip: "Completar", phrases: ["Adivina qué palabra falta.", "A ver si llenas el hueco.", "Completa esta para mí.", "Falta una palabra, ¿cuál es?", "Llena el espacio que dejé.", "Te reto a completar la frase.", "¿Qué va en el hueco?", "Pon la palabra que falta.", "Practiquemos completando.", "Dale, termina la frase."] },
    en: { tag: "the gap", chip: "Fill", phrases: ["Guess which word is missing.", "See if you can fill the gap.", "Complete this one.", "A word's missing — which one?", "Fill in the space I left.", "I'll challenge you to complete it.", "What goes in the gap?", "Drop in the missing word.", "Let's practice by filling it.", "Go on, finish the phrase."] },
  },
  "build-sentence": {
    es: { tag: "la frase", chip: "Ordenar", phrases: ["A ver si ordenas la frase.", "Te reto a armarla bien.", "Pon estas palabras en orden.", "Se desarmó la frase, ¿la armas?", "Acomoda las palabras conmigo.", "¿Puedes ponerla en orden?", "Construye la oración bien.", "Cada palabra en su sitio.", "Practiquemos armando la frase.", "Dale forma a esta oración."] },
    en: { tag: "the sentence", chip: "Build", phrases: ["See if you can order the sentence.", "I'll challenge you to build it.", "Put these words in order.", "The sentence fell apart — rebuild it?", "Arrange the words with me.", "Can you put it in order?", "Build the sentence right.", "Each word in its place.", "Let's practice building the phrase.", "Give this sentence its shape."] },
  },
  "number-drill": {
    es: { tag: "los precios", chip: "Contar", phrases: ["¿Qué número es? Dímelo.", "Practiquemos los precios.", "Te pregunto: ¿cuánto es?", "¿Sabes los números? A ver.", "Te reto a contar conmigo.", "Dime cuánto cuesta esto.", "Vamos con las cifras.", "¿Cuánto suman? A ver si lo sabes.", "Pon a prueba tus números.", "Una de precios, ¿te animas?"] },
    en: { tag: "the prices", chip: "Count", phrases: ["Tell me the number, let's see.", "Let's practice the prices.", "I'll quiz you: how much?", "Know your numbers? Let's see.", "I'll challenge you to count with me.", "Tell me what this costs.", "Let's do the figures.", "How much do they add to? Guess.", "Test your numbers.", "A price one — up for it?"] },
  },
  "odd-one-out": {
    es: { tag: "el intruso", chip: "Buscar", phrases: ["¿Cuál sobra aquí? A ver.", "Te reto a hallar el intruso.", "Encuentra el que no va.", "Uno no pertenece, ¿cuál?", "Saca el que está de más.", "¿Cuál no combina con los otros?", "Caza al intruso conmigo.", "Vista atenta: ¿cuál sobra?", "Practiquemos: halla el raro.", "Detecta el que no encaja."] },
    en: { tag: "the odd one", chip: "Spot", phrases: ["Which one doesn't belong? Let's see.", "I'll challenge you to spot the odd one.", "Find the one that's out of place.", "One doesn't belong — which?", "Pull out the extra one.", "Which one doesn't fit the rest?", "Hunt the odd one with me.", "Sharp eyes: which is spare?", "Let's practice: find the odd one.", "Spot the one that doesn't fit."] },
  },
  "memory-pairs": {
    es: { tag: "las parejas", chip: "Recordar", phrases: ["Pon a prueba tu memoria.", "A ver si hallas las parejas.", "Recordemos juntos las parejas.", "¿Buena memoria? Vamos a verlo.", "Encuentra cada pareja oculta.", "Te reto a destapar los pares.", "Practiquemos memorizando.", "Destapa y junta las iguales.", "A ver cuánto recuerdas.", "Hallemos las parejas conmigo."] },
    en: { tag: "the pairs", chip: "Match", phrases: ["Let's test your memory.", "See if you can find the pairs.", "Let's recall the pairs together.", "Good memory? Let's find out.", "Find each hidden pair.", "I'll challenge you to flip the pairs.", "Let's practice by memorizing.", "Flip and join the matching ones.", "Let's see how much you recall.", "Let's find the pairs together."] },
  },
  "say-it-back": {
    es: { tag: "repetir", chip: "Repetir", phrases: ["Dímelo de vuelta, a ver.", "Repite después de mí.", "Practica diciéndolo otra vez.", "Escucha y devuélvemelo.", "A ver si lo repites igual.", "Te toca: dilo como yo.", "Imítame, palabra por palabra.", "Vamos, repite conmigo.", "Pon a prueba tu memoria: repite.", "Hazlo eco de mi voz."] },
    en: { tag: "repeat", chip: "Repeat", phrases: ["Say it back to me, let's hear.", "Repeat after me.", "Practice saying it again.", "Listen and give it back to me.", "See if you can repeat it just so.", "Your turn — say it like I do.", "Mimic me, word for word.", "Come on, repeat with me.", "Test your memory: repeat it.", "Echo my voice."] },
  },
  "dialogue-fill": {
    es: { tag: "mi línea", chip: "Responder", phrases: ["A ver cómo contestarías.", "Te toca: ¿qué le dirías?", "Practica la respuesta conmigo.", "Yo digo lo mío, ¿y tú?", "Sígueme la conversación.", "¿Qué responderías aquí?", "Te reto a darme la réplica.", "Completa el diálogo conmigo.", "Imagina y contéstame.", "Dale, dame tu línea."] },
    en: { tag: "my line", chip: "Reply", phrases: ["Let's see how you'd answer.", "Your turn — what would you say?", "Practice the reply with me.", "I say my part — and you?", "Follow the conversation with me.", "What would you reply here?", "I'll challenge you for the comeback.", "Finish the dialogue with me.", "Imagine and answer me.", "Go on, give me your line."] },
  },
  "category-sort": {
    es: { tag: "las canastas", chip: "Clasificar", phrases: ["A ver si los clasificas.", "Te reto a ordenarlos por tipo.", "Practica: cada cosa a su canasta.", "Separa esto por grupos.", "¿Puedes ordenarlos bien?", "Cada uno a su lugar, vamos.", "Clasifiquemos juntos.", "Pon orden entre estas cosas.", "Agrúpalos como toca.", "A ver tu lógica: ordénalos."] },
    en: { tag: "the baskets", chip: "Sort", phrases: ["See if you can sort them.", "I'll challenge you to group them.", "Practice — each into its basket.", "Split these into groups.", "Can you sort them right?", "Each to its place, let's go.", "Let's classify them together.", "Bring order to these things.", "Group them as they should be.", "Test your logic: sort them."] },
  },
  "spot-typo": {
    es: { tag: "el error", chip: "Corregir", phrases: ["A ver si ves el error.", "Te reto a hallar la falta.", "Ojo: corrige esta palabra.", "Hay un error escondido, ¿lo ves?", "Encuentra la letra mal puesta.", "Una palabra está mal, ¿cuál?", "Afina la vista y corrígela.", "Caza la falta conmigo.", "Practiquemos corrigiendo.", "Detecta y arregla el desliz."] },
    en: { tag: "the typo", chip: "Spot", phrases: ["See if you can spot the mistake.", "I'll challenge you to find the slip.", "Sharp eye — fix this word.", "There's a hidden error, see it?", "Find the misplaced letter.", "One word is wrong — which?", "Sharpen your eye and fix it.", "Hunt the slip with me.", "Let's practice correcting.", "Spot and fix the slip."] },
  },
  "conjugation-tap": {
    es: { tag: "el verbo", chip: "Elegir", phrases: ["¿Cuál es la forma correcta?", "A ver si eliges el verbo bueno.", "Te pregunto: ¿cómo se conjuga?", "Elige bien cómo va el verbo.", "¿Qué forma cabe aquí?", "Te reto con un verbo.", "Practiquemos conjugando.", "Dime la forma justa.", "Acierta la conjugación.", "Toca el verbo correcto."] },
    en: { tag: "the verb", chip: "Pick", phrases: ["Which form is right?", "See if you pick the right verb.", "I'll quiz you: how does it conjugate?", "Choose how the verb should go.", "Which form fits here?", "I'll challenge you with a verb.", "Let's practice conjugating.", "Tell me the right form.", "Nail the conjugation.", "Tap the correct verb."] },
  },
  "rhyme-match": {
    es: { tag: "las rimas", chip: "Rimar", phrases: ["A ver si hallas las rimas.", "Te enseño un juego de rimas.", "Junta las que riman conmigo.", "¿Cuáles riman? Búscalas.", "Te reto a casar las rimas.", "Practiquemos rimando.", "Encuentra el eco que rima.", "Empareja por sonido.", "Vamos con un poco de rima.", "Dame la que rima con esta."] },
    en: { tag: "the rhymes", chip: "Rhyme", phrases: ["See if you can find the rhymes.", "Let me show you a rhyme game.", "Pair the ones that rhyme.", "Which ones rhyme? Find them.", "I'll challenge you to wed the rhymes.", "Let's practice rhyming.", "Find the echo that rhymes.", "Match them by sound.", "Let's do a little rhyme.", "Give me the one that rhymes with this."] },
  },
  "countdown-recall": {
    es: { tag: "la lista", chip: "Recordar", phrases: ["Pon a prueba tu memoria.", "A ver si recuerdas mi lista.", "Te reto: ¿qué tanto recuerdas?", "Memoriza y dímela de vuelta.", "Escucha y guarda la lista.", "¿Cuánto retienes? Veamos.", "Practiquemos recordando.", "Repíteme lo que dije.", "A ver tu memoria fresca.", "Recuerda todo lo que puedas."] },
    en: { tag: "the list", chip: "Recall", phrases: ["Let's test your memory.", "See if you recall my list.", "I'll challenge you: how much do you remember?", "Memorize it and give it back.", "Listen and keep the list.", "How much do you hold? Let's see.", "Let's practice recalling.", "Repeat what I said.", "Let's see your fresh memory.", "Recall all you can."] },
  },
  "true-false": {
    es: { tag: "verdad o no", chip: "Decidir", phrases: ["A ver: ¿verdadero o falso?", "Te pongo a prueba: ¿es cierto?", "Decide tú si es verdad.", "¿Te lo crees o no?", "Una afirmación: ¿va o no va?", "Te reto: ¿verdad o mentira?", "Practiquemos decidiendo.", "Dime si esto es correcto.", "¿Cierto o falso? Tú decides.", "Vota: verdadero o no."] },
    en: { tag: "true or false", chip: "Decide", phrases: ["Let's see — true or false?", "I'll test you: is it right?", "You decide if it's true.", "Do you buy it or not?", "A claim: does it hold or not?", "I'll challenge you: true or false?", "Let's practice deciding.", "Tell me if this is correct.", "True or false? You decide.", "Cast it: true or not."] },
  },
  "word-search": {
    es: { tag: "la sopa", chip: "Buscar", phrases: ["A ver si hallas las palabras.", "Te reto a buscarlas todas.", "Pon a prueba tu vista.", "Están escondidas, encuéntralas.", "Caza las palabras conmigo.", "¿Las ves en la sopa?", "Practiquemos buscando.", "Rastrea cada palabra.", "Ojo de águila: hállalas.", "Encuentra todas las que puedas."] },
    en: { tag: "the grid", chip: "Search", phrases: ["See if you can find the words.", "I'll challenge you to find them all.", "Test your sharp eyes.", "They're hidden — find them.", "Hunt the words with me.", "Do you see them in the grid?", "Let's practice searching.", "Track down each word.", "Eagle eye: find them.", "Find all you can."] },
  },
  "tap-translation": {
    es: { tag: "los iguales", chip: "Tocar", phrases: ["A ver si tocas las iguales.", "Te reto a marcar las que coinciden.", "Practica: toca las que significan esto.", "Señala las que se parean.", "¿Cuáles van juntas? Tócalas.", "Marca las que combinan.", "Empareja tocando conmigo.", "Toca las que significan lo mismo.", "Vamos: junta las iguales.", "Pulsa las que coinciden."] },
    en: { tag: "the matches", chip: "Tap", phrases: ["See if you can tap the matches.", "I'll challenge you to mark the pairs.", "Practice — tap the ones that mean this.", "Point out the ones that pair.", "Which go together? Tap them.", "Mark the ones that fit.", "Match by tapping with me.", "Tap the ones that mean the same.", "Let's go: join the matches.", "Press the ones that match."] },
  },
}

/**
 * MERGE a generated per-language locale table into the bank (the 50-language
 * plan). The generator emits `{ tool: { <lang>: SegueLocale } }` and calls this
 * at module load; existing entries win on conflict only if `override` is false.
 * Idempotent + additive: ships nothing today, future-proofs the structure.
 */
export function registerSegueLocale(
  table: Partial<Record<ChallengeToolId, Record<string, SegueLocale>>>,
  override = false,
): void {
  const next = { ...mutableSegues }
  for (const [tool, byLang] of Object.entries(table)) {
    if (!byLang) continue
    const existing = next[tool as ChallengeToolId] ?? {}
    next[tool as ChallengeToolId] = override
      ? { ...existing, ...byLang }
      : { ...byLang, ...existing }
  }
  mutableSegues = next
}

/** The live bank (a getter so merges via `registerSegueLocale` take effect). */
const SEGUES = (): Partial<Record<ChallengeToolId, Record<string, SegueLocale>>> =>
  mutableSegues

/** Resolve a tool id to its canonical (alias-followed) key. */
function canonical(tool: ChallengeToolId): ChallengeToolId {
  return SEGUE_ALIAS[tool] ?? tool
}

/** Pick the locale block for a tool + language. Never cross-fallback target text. */
function localeFor(tool: ChallengeToolId, lang: string): SegueLocale {
  const code = lang.split("-")[0]
  const byLang = SEGUES()[canonical(tool)]
  if (byLang) {
    const targetHit = byLang[lang] ?? byLang[code]
    if (targetHit) return targetHit
  }
  const generated = genericSegueText(lang)
  return { tag: generated.tag, chip: generated.chip, phrases: generated.phrases }
}

/** Tiny stable hash (FNV-1a) → 32-bit, for deterministic phrase rotation. */
function hashStr(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** The short, in-language TAG naming this game ("una palabra", "los precios"). */
export function segueTag(tool: ChallengeToolId, target: string): string {
  return localeFor(tool, target).tag
}

/** The short, in-language Play-chip LABEL ("Jugar", "Leer"). */
export function segueChipLabel(tool: ChallengeToolId, target: string): string {
  return localeFor(tool, target).chip
}

/** How many distinct phrases are authored for a tool+language (for tests/diagnostics). */
export function seguePhraseCount(tool: ChallengeToolId, target: string): number {
  return localeFor(tool, target).phrases.length
}

/**
 * A SHORT target-language segue phrase — the DETERMINISTIC, hardcoded challenge
 * intro the runtime speaks just before the Play chip appears (CHANGE 1). The model
 * is NEVER involved. `turn` rotates the phrase deterministically so the SAME NPC's
 * "play another" reads fresh, and different (NPC, visit) seeds land on different
 * phrases — variety with zero model, zero English. Combined with the tool id so
 * different games read differently.
 */
export function resolveSegue(tool: ChallengeToolId, target: string, turn = 0): string {
  const loc = localeFor(tool, target)
  const n = loc.phrases.length
  // Non-negative modulo so a negative seed never throws / picks NaN.
  const idx = ((hashStr(`${canonical(tool)}|${target}`) + turn) % n + n) % n
  return loc.phrases[idx]
}

/**
 * Deterministic phrase index from an arbitrary STRING seed (e.g. an NPC id +
 * visit). Lets the runtime vary the segue per NPC/visit without managing a
 * separate counter: same seed → same phrase, forever; different seeds spread
 * across the ~10-phrase bag. Pure; never the model.
 */
export function resolveSegueForSeed(
  tool: ChallengeToolId,
  target: string,
  seed: string,
): string {
  return resolveSegue(tool, target, hashStr(seed))
}
