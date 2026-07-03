/**
 * beatlounge — split a phrase into the per-word tokens the scratch "record" uses
 * for its groove labels (the words placed around the disc).
 *
 * LANGUAGE-AWARE (#465): no-space scripts (Chinese zh, Japanese ja, Thai th)
 * segment into real tokens via the shared `tokenizePhrase` (Intl.Segmenter),
 * instead of the old naive `split(/\s+/)` that returned the whole phrase as ONE
 * blob for no-space scripts — the same class of bug as Lingo Hero #463.
 *
 * Pure (no React/Tone) so it unit-tests without a DOM.
 */

import { tokenizePhrase } from "../../phrase/tokenize"

export const splitWords = (text: string, lang?: string): string[] =>
  tokenizePhrase(text, lang)
    .map((t) => t.text)
    .filter(Boolean)
