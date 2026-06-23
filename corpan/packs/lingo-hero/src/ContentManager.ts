import { HostApi, EntryOut } from "./sdk/types";

/**
 * WordSelector — the injection point that lets the learning stream bias round
 * content toward DUE / WEAK phrases WITHOUT any further Game.ts edits. Pass one
 * into the ContentManager constructor; omit it for the default (random) feel.
 *
 * It only *biases ordering/choice*; ContentManager always re-validates that the
 * chosen target is a real candidate (a foreign prompt + a target translation),
 * so a selector can never break the coherence contract — at any moment exactly
 * ONE correct next word is catchable, verifiable from the prompt.
 */
export interface WordSelector {
  /**
   * Choose the TARGET entry from the valid candidate pool. Return one of
   * `candidates`, or undefined/null to fall back to default behavior. Must NOT
   * return an entry outside `candidates`.
   */
  chooseTarget?(
    candidates: EntryOut[],
    activeLang: string
  ): EntryOut | undefined | null;
  /**
   * Score an entry's desirability as a DISTRACTOR source (higher = sooner).
   * Pure + cheap, please.
   */
  weight?(entry: EntryOut, activeLang: string): number;
  /** Optional observation hook so a stateful selector can prime itself. */
  observePool?(candidates: EntryOut[], activeLang: string): void;
}

/** Module-level default selector registry (learning-stream injection point). */
let defaultSelector: WordSelector | null = null;

/** Register the process-wide default WordSelector (learning stream entry). */
export function setDefaultWordSelector(selector: WordSelector | null): void {
  defaultSelector = selector;
}

/** Read the current default selector (mostly for tests / introspection). */
export function getDefaultWordSelector(): WordSelector | null {
  return defaultSelector;
}

/**
 * A single "Catch the Translation" round.
 *
 * The PROMPT (`promptText`, in the PRIMARY language the player already knows) is
 * shown large at the top. The player reconstructs the TARGET translation by
 * catching its words IN ORDER. `targetWords` are the ordered tokens to catch;
 * `targetText` is the full raw target translation (spoken on completion or per
 * word); `distractorWords` are REAL target-language words from OTHER entries
 * that are NOT part of this sequence — used as foils at higher difficulty.
 */
export interface Round {
  entryId: number;
  /** The phrase in the PRIMARY (known / UI) language — the prompt shown on top. */
  promptText: string;
  /** Language code of the prompt (primary). */
  promptLang: string;
  /** Ordered tokens of the target translation — what the player catches. */
  targetWords: string[];
  /** Full raw target translation text (for TTS / the completed strip). */
  targetText: string;
  /** Language code of the target (learning) language. */
  targetLang: string;
  /** Optional romanization of the target translation (if the host provided one). */
  romanization?: string;
  /**
   * Real target-language words NOT in this sequence — believable foils to fall
   * in the OTHER lanes once distractors are enabled. Deduped against the
   * sequence words. May be empty if the pool is too small.
   */
  distractorWords: string[];
}

/** Split a phrase into display tokens. Splits on whitespace; keeps punctuation
 *  attached to the word it trails (so "café," stays one catchable token). */
function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

/** Strip surrounding punctuation for dedup/comparison (keeps inner apostrophes). */
function normWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/^[¿¡"'«»()[\]{}.,!?;:…—–-]+/, "")
    .replace(/[¿¡"'«»()[\]{}.,!?;:…—–-]+$/, "")
    .trim();
}

export class ContentManager {
  private selector?: WordSelector;

  constructor(
    private hostApi: HostApi,
    selector?: WordSelector
  ) {
    this.selector = selector ?? defaultSelector ?? undefined;
  }

  /** The translation of `e` in `lang`, trimmed (or "" if none). */
  private transIn(e: EntryOut, lang: string): string {
    return (
      e.translations.find((t) => t.language_code === lang)?.text || ""
    ).trim();
  }

  private hasLang(e: EntryOut, lang: string): boolean {
    return !!this.transIn(e, lang);
  }

  private async fetchBatch(n: number): Promise<EntryOut[]> {
    if (this.hostApi.getRandomEntries) {
      return (await this.hostApi.getRandomEntries(n)) ?? [];
    }
    if (this.hostApi.getRandomEntry) {
      const out = await Promise.all(
        Array.from({ length: n }, () => this.hostApi.getRandomEntry!())
      );
      return out.filter(Boolean) as EntryOut[];
    }
    return [];
  }

  /**
   * Resolve the PROMPT (known/UI) language + the TARGET (learning) language for a
   * round, given the host stack. The stack convention is
   * `languages[0]` = the language the player already KNOWS (prompt / UI) and
   * `languages[1..]` = the learning TARGET languages.
   *
   * Two first-class modes (issue #407):
   *
   *  - **≥2 languages — translation mode**: prompt in `languages[0]`; the TARGET
   *    is chosen RANDOMLY among `languages[1..]` so over many rounds the player
   *    practices EVERY learning language in the stack, not just `languages[1]`.
   *    `reading` is false.
   *
   *  - **exactly 1 language — READING mode**: there is no foreign language to
   *    translate INTO, so we NEVER substitute one. Instead the round is a reading
   *    exercise in that single language: the prompt and the catchable words are
   *    BOTH that language (`primary === target`). `reading` is true.
   *
   * Pass `rng` to make the random target choice deterministic in tests. `entry`
   * is no longer consulted — single-language stacks resolve purely to reading
   * mode in their own language (no cross-language guessing from the pool).
   */
  resolveLanguages(
    languages: string[],
    rng: () => number = Math.random
  ): { primary: string; target: string; reading: boolean } {
    const langs = (languages ?? []).filter(Boolean);
    const primary = langs[0] ?? "en";
    // The learning targets are everything after the known/UI language.
    const targets = langs.slice(1).filter((l) => l && l !== primary);
    if (targets.length === 0) {
      // Single-language stack → READING mode in that one language. Never pick a
      // foreign substitute (the old "default to en/es" behavior — issue #407).
      return { primary, target: primary, reading: true };
    }
    // Translation mode: rotate the target RANDOMLY across all learning langs.
    const target = targets[Math.floor(rng() * targets.length) % targets.length];
    return { primary, target, reading: false };
  }

  /**
   * Build one round: a prompt in the primary language + the target translation
   * tokenized in order + a pool of distractor target-language words.
   *
   * Accumulates a few random batches so the distractor pool is well-populated
   * even when a language's entry pool is small.
   */
  async getRound(languages: string[]): Promise<Round> {
    const byId = new Map<number, EntryOut>();
    for (let attempt = 0; attempt < 4 && byId.size < 10; attempt++) {
      for (const e of await this.fetchBatch(8)) {
        if (e && !byId.has(e.entry_id)) byId.set(e.entry_id, e);
      }
    }
    const pool = [...byId.values()];
    if (pool.length === 0) throw new Error("No content available");

    // Per-round language resolution. In TRANSLATION mode the target rotates
    // randomly across languages[1..] each round; in READING mode (1-lang stack)
    // primary === target and the round is read in that single language.
    const { primary, target, reading } = this.resolveLanguages(languages);

    // A valid round entry must carry the TARGET translation; in translation mode
    // it must ALSO carry the prompt (primary). In reading mode primary === target
    // so this collapses to "has the one language" — exactly what we want (the
    // prompt and catchable tokens are the same single-language text).
    let valid = reading
      ? pool.filter((e) => this.hasLang(e, target))
      : pool.filter((e) => this.hasLang(e, primary) && this.hasLang(e, target));
    if (valid.length === 0 && !reading) {
      // No entry carries both prompt+target (e.g. mock pool lacks the chosen
      // target lang). Relax: require just the target-language translation and use
      // any other translation as the prompt. Never silently leave reading mode.
      valid = pool.filter(
        (e) => this.hasLang(e, target) && e.translations.length >= 2
      );
    }
    if (valid.length === 0 && !reading) {
      // Last resort (translation mode only): anything with two translations;
      // treat the first as prompt. Reading mode never falls through to a foreign
      // language — if the single language is absent we error rather than guess.
      valid = pool.filter((e) => e.translations.length >= 2);
    }
    if (valid.length === 0) throw new Error("No usable round content");

    this.selector?.observePool?.(valid, target);
    const inValid = (e: EntryOut | undefined | null): e is EntryOut =>
      !!e && valid.some((v) => v.entry_id === e.entry_id);
    const chosen = this.selector?.chooseTarget?.(valid, target);
    const entry = (inValid(chosen) ? chosen : undefined) ?? valid[0];

    const targetText =
      this.transIn(entry, target) ||
      entry.translations.find((t) => t.language_code !== primary)?.text?.trim() ||
      "";
    const promptText =
      this.transIn(entry, primary) ||
      entry.translations.find((t) => t.language_code !== target)?.text?.trim() ||
      entry.translations[0]?.text?.trim() ||
      "";
    const promptLang =
      entry.translations.find((t) => t.text.trim() === promptText)
        ?.language_code || primary;
    const romanization = entry.translations
      .find((t) => t.language_code === target)
      ?.romanization?.trim();

    const targetWords = tokenize(targetText);

    // Distractor pool: real target-language words from OTHER entries, not in the
    // sequence. Order biased by the optional selector weight.
    let distractorSources = pool.filter((e) => e.entry_id !== entry.entry_id);
    if (this.selector?.weight) {
      const w = this.selector.weight.bind(this.selector);
      distractorSources = distractorSources
        .map((e, i) => ({ e, i, s: w(e, target) }))
        .sort((a, b) => b.s - a.s || a.i - b.i)
        .map((x) => x.e);
    }
    const seqNorms = new Set(targetWords.map(normWord));
    const seenDistractor = new Set<string>();
    const distractorWords: string[] = [];
    for (const e of distractorSources) {
      const t = this.transIn(e, target);
      if (!t) continue;
      for (const w of tokenize(t)) {
        const key = normWord(w);
        if (!key || seqNorms.has(key) || seenDistractor.has(key)) continue;
        seenDistractor.add(key);
        distractorWords.push(w);
        if (distractorWords.length >= 12) break;
      }
      if (distractorWords.length >= 12) break;
    }

    return {
      entryId: entry.entry_id,
      promptText,
      promptLang,
      targetWords,
      targetText,
      targetLang: target,
      romanization,
      distractorWords,
    };
  }

  /** Speak RAW text in the given language. */
  speak(text: string, lang: string, _rate?: number) {
    if (!text) return;
    this.hostApi.speak(lang, text);
  }
}
