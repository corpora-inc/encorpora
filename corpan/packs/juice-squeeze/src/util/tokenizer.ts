/**
 * Tokenizer — MOVED to the cap-squeeze capability
 * (@shared/capabilities/squeeze). This shim keeps the pack's historical
 * import path pointing at the ONE implementation.
 */
export {
  isCJKText,
  tokenizeCJK,
  normalizeForTokenization,
  tokenizeText,
  isOnlyPunctuation,
  joinForTTS,
} from "@shared/capabilities/squeeze/src/tokenizer"
