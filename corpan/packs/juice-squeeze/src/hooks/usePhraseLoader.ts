/**
 * Phrase-loading concern.
 *
 * The phrase-loading loop (language-pair rotation, loadUtterance retry/skip,
 * applying to the store, scheduling the target-phrase TTS, and history wiring)
 * is folded into useGameLogic so loading, win detection, and history share one
 * set of cancellable timers and a single mounted-guard. This module re-exports
 * the underlying primitives for direct/test use.
 */
export { loadUtterance, type Utterance } from "../util/phraseLoader"
export { pickLanguagePair, resetLanguagePairRotation } from "../util/languagePair"
