import { HostApi, EntryOut } from "./sdk/types";

/**
 * WordSelector — the injection point that lets the learning stream bias wave
 * content toward DUE / WEAK words WITHOUT any further Game.ts edits. Pass one
 * into the ContentManager constructor; omit it for the default (random) feel.
 *
 * CRITICAL: the selector only *biases ordering/choice*. ContentManager ALWAYS
 * re-applies the distinct-entries + distinct-English-answers dedup AFTER the
 * selector runs, so the core correctness contract (correct English appears on
 * exactly one note) can never be broken by a selector. A selector cannot
 * fabricate entries — it only reorders / scores the candidates it is handed.
 */
export interface WordSelector {
  /**
   * Choose the TARGET entry from the valid candidate pool (entries that have a
   * foreign prompt AND an English answer). Return one of `candidates`, or
   * undefined/null to fall back to default behavior. Must NOT return an entry
   * outside `candidates`.
   */
  chooseTarget?(
    candidates: EntryOut[],
    activeLang: string
  ): EntryOut | undefined | null;
  /**
   * Score an entry's *desirability as a distractor* (higher = sooner). Used to
   * order distractor candidates so e.g. confusable / due words surface. Dedup
   * still runs after; ties keep pool order. Pure + cheap, please.
   */
  weight?(entry: EntryOut, activeLang: string): number;
  /**
   * Optional observation hook so a stateful selector can prime itself when a
   * wave's candidate pool is known (before target/distractor pick). Side-effect
   * only; return value ignored.
   */
  observePool?(candidates: EntryOut[], activeLang: string): void;
}

/**
 * Module-level default selector registry. This is how the learning stream
 * injects spaced-difficulty biasing WITHOUT editing Game.ts: the stream calls
 * `setDefaultWordSelector(mySelector)` from its own init module (e.g. imported
 * for side-effects in main.ts), and any ContentManager constructed without an
 * explicit selector arg picks it up. Set to null to clear.
 */
let defaultSelector: WordSelector | null = null;

/** Register the process-wide default WordSelector (learning stream entry). */
export function setDefaultWordSelector(selector: WordSelector | null): void {
  defaultSelector = selector;
}

/** Read the current default selector (mostly for tests / introspection). */
export function getDefaultWordSelector(): WordSelector | null {
  return defaultSelector;
}

export class ContentManager {
  private selector?: WordSelector;

  constructor(
    private hostApi: HostApi,
    /**
     * Optional learning-stream selector. If omitted, falls back to the
     * module-level default (set via setDefaultWordSelector); if that's also
     * unset, behavior is the original random feel.
     */
    selector?: WordSelector
  ) {
    this.selector = selector ?? defaultSelector ?? undefined;
  }

  private englishOf(e: EntryOut): string {
    return (
      e.translations.find((t) => t.language_code === "en")?.text || ""
    ).trim();
  }

  private hasForeign(e: EntryOut): boolean {
    return e.translations.some((t) => t.language_code !== "en" && t.text.trim());
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
   * Returns one target + up to two distractors that are GUARANTEED to be
   * distinct entries with DISTINCT English answers. This is the core
   * correctness contract: the correct English must appear on exactly ONE note,
   * so tapping the right answer can never be scored wrong. We accumulate across
   * a few random batches to dedup — which matters when a language's entry pool
   * is small (the prior code did no dedup, so the correct answer often appeared
   * on two notes and the "wrong" copy beat the player down).
   */
  async getWaveContent(
    activeLang: string
  ): Promise<{ target: EntryOut; distractors: EntryOut[] }> {
    const byId = new Map<number, EntryOut>();
    for (let attempt = 0; attempt < 4 && byId.size < 6; attempt++) {
      for (const e of await this.fetchBatch(6)) {
        if (e && !byId.has(e.entry_id)) byId.set(e.entry_id, e);
      }
    }
    const pool = [...byId.values()];
    if (pool.length === 0) throw new Error("No content available");

    // Target must have a foreign prompt AND an English answer; prefer one whose
    // prompt is in the user's active language.
    const valid = pool.filter((e) => this.hasForeign(e) && this.englishOf(e));

    // Let an injected learning-stream selector observe + bias the pick. It can
    // ONLY choose from `valid`; anything else is ignored and we fall back to
    // the original (random) behavior. Dedup below is unconditional.
    this.selector?.observePool?.(valid, activeLang);
    const inValid = (e: EntryOut | undefined | null): e is EntryOut =>
      !!e && valid.some((v) => v.entry_id === e.entry_id);
    const chosen = this.selector?.chooseTarget?.(valid, activeLang);

    const target =
      (inValid(chosen) ? chosen : undefined) ??
      valid.find((e) =>
        e.translations.some(
          (t) => t.language_code === activeLang && t.text.trim()
        )
      ) ??
      valid[0] ??
      pool[0];

    // Optional weighting biases the ORDER distractors are considered in. Stable:
    // higher weight first, ties keep original pool order. Dedup still gates.
    let distractorOrder = pool;
    if (this.selector?.weight) {
      const w = this.selector.weight.bind(this.selector);
      distractorOrder = pool
        .map((e, i) => ({ e, i, s: w(e, activeLang) }))
        .sort((a, b) => b.s - a.s || a.i - b.i)
        .map((x) => x.e);
    }

    // Distinct answers only: never repeat the target's English on a distractor.
    const seenEnglish = new Set<string>([this.englishOf(target).toLowerCase()]);
    const distractors: EntryOut[] = [];
    for (const e of distractorOrder) {
      if (e.entry_id === target.entry_id) continue;
      const en = this.englishOf(e);
      const key = en.toLowerCase();
      if (!en || seenEnglish.has(key)) continue;
      seenEnglish.add(key);
      distractors.push(e);
      if (distractors.length === 2) break;
    }

    return { target, distractors };
  }

  /**
   * Speak RAW text in the given language. The current HostApi.speak takes
   * (lang, text) and reads rate from its own stack config, so `rate` is a
   * forward-compat hint the host already applies.
   */
  speak(text: string, lang: string, _rate?: number) {
    this.hostApi.speak(lang, text);
  }
}
