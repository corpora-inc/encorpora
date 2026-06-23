/**
 * Incremental sentence detection for streamed tutor replies.
 *
 * Unicode's Sentence_Terminal property covers the punctuation used by the
 * pack's scripts (including 。, ؟, ।, and ۔). We only emit a boundary once
 * following text confirms it, because the current end of a token stream is not
 * evidence that a sentence is complete.
 */

const SENTENCE_TERMINAL_RE = /\p{Sentence_Terminal}/u
const WHITESPACE_RE = /\s/u
const CLOSER_RE = /[\p{Pe}\p{Pf}"'’”»›」』】〕〉》）\]\}*_~]/u

// These languages conventionally allow the next sentence to start immediately
// after sentence punctuation, without an intervening space.
const NO_SPACE_SENTENCE_LANGS = new Set(["ja", "zh", "yue"])

// Locale-tailored terminals that cannot be represented by a global Unicode
// property. In Greek, ASCII semicolon is the question mark.
const EXTRA_TERMINALS: Record<string, ReadonlySet<string>> = {
  el: new Set([";"]),
}

// CLDR calls these "sentence break suppressions": punctuation that looks like a
// boundary but normally belongs to an abbreviation. Keep this deliberately
// conservative; an uncertain boundary is spoken at finish rather than early.
const COMMON_ABBREVIATIONS = new Set(["mr", "mrs", "ms", "dr", "prof", "sr", "jr", "etc", "e.g", "i.e"])
const ABBREVIATIONS: Record<string, ReadonlySet<string>> = {
  en: new Set(["st", "vs", "fig", "no"]),
  ca: new Set(["sr", "sra", "dr", "dra", "prof", "núm", "pàg"]),
  de: new Set(["hr", "fr", "dr", "prof", "bzw", "z.b", "usw", "nr"]),
  es: new Set(["sr", "sra", "srta", "dr", "dra", "prof", "ud", "uds", "núm", "pág"]),
  fr: new Set(["m", "mme", "mlle", "dr", "pr", "etc", "n"]),
  it: new Set(["sig", "sig.ra", "dott", "dott.ssa", "prof", "ecc", "n"]),
  nl: new Set(["dhr", "mevr", "dr", "prof", "nr"]),
  pt: new Set(["sr", "sra", "dr", "dra", "prof", "etc", "n"]),
}

function codePointAt(text: string, index: number): string {
  return String.fromCodePoint(text.codePointAt(index)!)
}

function baseLanguage(locale: string): string {
  return locale.toLowerCase().split("-")[0]
}

function isSentenceTerminal(cp: string, locale: string): boolean {
  return SENTENCE_TERMINAL_RE.test(cp) || (EXTRA_TERMINALS[baseLanguage(locale)]?.has(cp) ?? false)
}

function tokenBefore(text: string, index: number): string {
  let start = index
  while (start > 0) {
    const cp = codePointAt(text, start - 1)
    if (WHITESPACE_RE.test(cp)) break
    start -= cp.length
  }
  return text
    .slice(start, index)
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .toLocaleLowerCase()
}

function nextNonWhitespace(text: string, index: number): string {
  let cursor = index
  while (cursor < text.length) {
    const cp = codePointAt(text, cursor)
    if (!WHITESPACE_RE.test(cp)) return cp
    cursor += cp.length
  }
  return ""
}

function suppressPeriodBoundary(text: string, periodIndex: number, afterIndex: number, locale: string): boolean {
  const token = tokenBefore(text, periodIndex)
  if (!token) return false

  const next = nextNonWhitespace(text, afterIndex)
  const previous = periodIndex > 0 ? codePointAt(text, periodIndex - 1) : ""
  if (/\p{N}/u.test(previous) && /\p{N}/u.test(next)) return true
  if (/\p{Lowercase}/u.test(next)) return true

  // Numbered-list markers and personal initials are not complete sentences.
  if (/^\p{N}+$/u.test(token) || /^\p{L}$/u.test(token)) return true
  if (/^(?:\p{L}\.)+\p{L}$/u.test(token)) return true

  return COMMON_ABBREVIATIONS.has(token) || (ABBREVIATIONS[baseLanguage(locale)]?.has(token) ?? false)
}

function confirmedBoundary(text: string, locale: string): number | null {
  const noSpace = NO_SPACE_SENTENCE_LANGS.has(baseLanguage(locale))
  let cursor = 0

  while (cursor < text.length) {
    const cp = codePointAt(text, cursor)
    if (!isSentenceTerminal(cp, locale)) {
      cursor += cp.length
      continue
    }

    const terminalStart = cursor
    let end = cursor + cp.length
    while (end < text.length) {
      const next = codePointAt(text, end)
      if (!isSentenceTerminal(next, locale)) break
      end += next.length
    }
    while (end < text.length) {
      const next = codePointAt(text, end)
      if (!CLOSER_RE.test(next)) break
      end += next.length
    }

    if (cp === "." && suppressPeriodBoundary(text, terminalStart, end, locale)) {
      cursor = end
      continue
    }

    // Never infer completion merely because a streamed chunk currently ends.
    // finish() will flush the final sentence when the model confirms EOF.
    if (end >= text.length) return null

    const next = codePointAt(text, end)
    if (WHITESPACE_RE.test(next)) {
      while (end < text.length) {
        const whitespace = codePointAt(text, end)
        if (!WHITESPACE_RE.test(whitespace)) break
        end += whitespace.length
      }
      return end
    }
    if (noSpace) return end

    cursor = end
  }

  return null
}

export class StreamingSentenceBuffer {
  private buffer = ""
  private readonly locale: string

  constructor(locale: string) {
    this.locale = locale
  }

  push(chunk: string): string[] {
    if (!chunk) return []
    this.buffer += chunk
    return this.drain()
  }

  finish(): string[] {
    const complete = this.drain()
    const remainder = this.buffer.trim()
    this.buffer = ""
    if (remainder) complete.push(remainder)
    return complete
  }

  discard(): void {
    this.buffer = ""
  }

  private drain(): string[] {
    const complete: string[] = []
    for (;;) {
      const end = confirmedBoundary(this.buffer, this.locale)
      if (end === null) return complete
      const sentence = this.buffer.slice(0, end).trim()
      this.buffer = this.buffer.slice(end)
      if (sentence) complete.push(sentence)
    }
  }
}

type MaybePromise = void | Promise<void>

/**
 * Serializes calls because hostApi.speak resolves when speech is queued, not
 * when it finishes. Native and browser synthesizers then preserve queue order.
 */
export class OrderedSpeechQueue {
  private generation = 0
  private tail: Promise<void> = Promise.resolve()
  private readonly speak: (locale: string, text: string) => Promise<void>
  private readonly stop?: () => MaybePromise
  private readonly onError: (error: unknown) => void

  constructor(
    speak: (locale: string, text: string) => Promise<void>,
    stop?: () => MaybePromise,
    onError: (error: unknown) => void = (error) => console.error("[tts]", error)
  ) {
    this.speak = speak
    this.stop = stop
    this.onError = onError
  }

  enqueue(locale: string, text: string): void {
    const clean = text.trim()
    if (!clean) return
    const generation = this.generation
    this.tail = this.tail.then(async () => {
      if (generation !== this.generation) return
      try {
        await this.speak(locale, clean)
      } catch (error) {
        this.onError(error)
      }
      // A stop may have raced an in-flight host call. Stop again before any
      // utterance from the new generation is allowed to queue.
      if (generation !== this.generation) await this.stopNow()
    })
  }

  cancel(): void {
    this.generation += 1
    const stopping = this.stopNow()
    this.tail = Promise.all([this.tail.catch(this.onError), stopping]).then(() => {})
  }

  async idle(): Promise<void> {
    await this.tail
  }

  private async stopNow(): Promise<void> {
    try {
      await this.stop?.()
    } catch (error) {
      this.onError(error)
    }
  }
}
