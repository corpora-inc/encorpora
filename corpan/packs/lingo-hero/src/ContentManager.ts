import { HostApi, EntryOut } from "./sdk/types";

export class ContentManager {
  constructor(private hostApi: HostApi) {}

  async getWaveContent(): Promise<{
    target: EntryOut;
    distractors: EntryOut[];
  }> {
    // We need 3 items: 1 target, 2 distractors
    let entries: EntryOut[] = [];
    
    // Attempt to get random entries
    if (this.hostApi.getRandomEntries) {
      entries = await this.hostApi.getRandomEntries(3);
    } else {
      // Fallback if bulk fetch not available
      const p1 = this.hostApi.getRandomEntry ? this.hostApi.getRandomEntry() : Promise.resolve(null);
      const p2 = this.hostApi.getRandomEntry ? this.hostApi.getRandomEntry() : Promise.resolve(null);
      const p3 = this.hostApi.getRandomEntry ? this.hostApi.getRandomEntry() : Promise.resolve(null);
      
      const results = await Promise.all([p1, p2, p3]);
      entries = results.filter(e => e !== null) as EntryOut[];
    }
    
    // Ensure unique entries if possible (simple dedup by ID)
    // For a prototype, raw fetch is okay.

    if (entries.length === 0) {
        throw new Error("No content available");
    }

    // Pick one as target
    const target = entries[0];
    const distractors = entries.slice(1);
    
    return { target, distractors };
  }

  /**
   * Speak RAW text in the given language. `rate` is accepted for signature
   * symmetry with the host stack config; the current HostApi.speak takes
   * (lang, text) and reads rate from its own stack config, so rate is a
   * forward-compat hint here (host applies its configured rate).
   */
  speak(text: string, lang: string, _rate?: number) {
    this.hostApi.speak(lang, text);
  }
}
