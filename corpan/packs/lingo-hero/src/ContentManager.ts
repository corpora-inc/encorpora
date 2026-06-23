import { HostApi, EntryOut } from "./sdk/types";

export class ContentManager {
  constructor(private hostApi: HostApi) {}

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
    const target =
      valid.find((e) =>
        e.translations.some(
          (t) => t.language_code === activeLang && t.text.trim()
        )
      ) ??
      valid[0] ??
      pool[0];

    // Distinct answers only: never repeat the target's English on a distractor.
    const seenEnglish = new Set<string>([this.englishOf(target).toLowerCase()]);
    const distractors: EntryOut[] = [];
    for (const e of pool) {
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
