/**
 * learning/wordStats.ts — Per-word spaced-repetition memory for Lingo Hero.
 *
 * STREAM: learning. This is the durable "what do you actually know" model that
 * drives spaced difficulty, weak-word resurfacing, and the mastery readout. It
 * is intentionally a small, well-understood Leitner/SM-2-lite scheduler rather
 * than a heavyweight SRS — the game loop is fast and forgiving, so we optimise
 * for "resurface what you fumbled, retire what you nail, keep it gentle".
 *
 * KEYING: a word is identified by its host `entryId` (stable across sessions),
 * scoped by (stackId, lang) so a Spanish learner's memory never bleeds into a
 * Korean stack. We also persist the foreign/english strings purely so the
 * mastery model can show human-readable context if ever needed — scheduling
 * keys on entryId only.
 *
 * PERSISTENCE: offline-first localStorage, fully guarded (private-mode / no-DOM
 * hosts degrade to in-memory). Mirrors the progression/storage.ts pattern and
 * shares the same host-storage migration TODO: when HostApi grows a durable
 * key/value surface, route through it here and keep localStorage as fallback.
 *
 * NO NETWORK. NO REMOTE ASSETS. Pure local memory of the learner's progress.
 */

const SCHEMA_VERSION = 2;
const KEY_PREFIX = "lingo-hero:wordstats";

/**
 * Leitner-style boxes. A word climbs a box on a correct answer and drops on a
 * miss. Higher box ⇒ longer interval before it's "due" again ⇒ surfaced less.
 * Box 0 = brand new / just fumbled (due immediately). Box 5 = mastered.
 *
 * Intervals are measured in WAVES (the game's natural tick), not wall-clock —
 * the loop is the clock. Tuned so a fumbled word comes back within a few waves
 * (re-exposure while it still stings) and a mastered word fades to the deep
 * background but never fully disappears (occasional retention checks).
 */
export const BOX_INTERVALS_WAVES: readonly number[] = [0, 2, 5, 10, 20, 40] as const;
export const MAX_BOX = BOX_INTERVALS_WAVES.length - 1; // 5
/** A word at or above this box counts as "mastered" for the readout. */
export const MASTERED_BOX = 4;

/** The persisted record for a single word. */
export interface WordStat {
  /** Host entry id — the stable scheduling key. */
  entryId: number;
  /** Leitner box 0..MAX_BOX (higher = better known). */
  box: number;
  /** Lifetime correct answers for this word. */
  correct: number;
  /** Lifetime misses (wrong tap on its wave, or let it pass). */
  wrong: number;
  /** Wave index (global counter) when this word was last shown. */
  lastSeenWave: number;
  /** Wave index at/after which this word is "due" to resurface. */
  dueWave: number;
  /**
   * Smoothed strength 0..1 (EWMA of correctness). Distinct from `box`: box is
   * the discrete scheduler, strength is the continuous signal the mastery bar
   * and the adaptive-difficulty model read. Starts at 0.5 (unknown).
   */
  strength: number;
  /** Human context (not used for scheduling; handy for debugging/readouts). */
  foreign?: string;
  english?: string;
}

interface PersistedWordStats {
  version: number;
  /** Monotonic wave counter for this scope (the SRS "clock"). */
  wave: number;
  /** entryId → record. Stored as an object map for compact JSON. */
  words: Record<string, WordStat>;
}

function emptyPersisted(): PersistedWordStats {
  return { version: SCHEMA_VERSION, wave: 0, words: {} };
}

function storageKey(scope: string): string {
  return `${KEY_PREFIX}:${scope || "default"}`;
}

/** Best-effort Storage access; null when blocked/unavailable (mirrors progression). */
function safeLocalStorage(): Storage | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = `${KEY_PREFIX}:__probe__`;
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function sanitizeStat(raw: Partial<WordStat>, entryId: number): WordStat {
  const box = clampInt(raw.box, 0, MAX_BOX, 0);
  return {
    entryId,
    box,
    correct: clampInt(raw.correct, 0, Number.MAX_SAFE_INTEGER, 0),
    wrong: clampInt(raw.wrong, 0, Number.MAX_SAFE_INTEGER, 0),
    lastSeenWave: clampInt(raw.lastSeenWave, 0, Number.MAX_SAFE_INTEGER, 0),
    dueWave: clampInt(raw.dueWave, 0, Number.MAX_SAFE_INTEGER, 0),
    strength:
      typeof raw.strength === "number" && Number.isFinite(raw.strength)
        ? clamp01(raw.strength)
        : 0.5,
    foreign: typeof raw.foreign === "string" ? raw.foreign : undefined,
    english: typeof raw.english === "string" ? raw.english : undefined,
  };
}

function clampInt(v: unknown, lo: number, hi: number, dflt: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return dflt;
  const i = Math.round(v);
  return i < lo ? lo : i > hi ? hi : i;
}

/**
 * The in-memory, persisted word-memory store. One instance per (stack, lang)
 * scope; the learning init creates/swaps these as the active language changes.
 */
export class WordStatsStore {
  private state: PersistedWordStats;
  private dirty = false;
  private flushHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly scope: string) {
    this.state = this.load();
  }

  private load(): PersistedWordStats {
    const ls = safeLocalStorage();
    if (!ls) return emptyPersisted();
    try {
      const raw = ls.getItem(storageKey(this.scope));
      if (!raw) return emptyPersisted();
      const parsed = JSON.parse(raw) as Partial<PersistedWordStats>;
      const words: Record<string, WordStat> = {};
      const src = parsed.words && typeof parsed.words === "object" ? parsed.words : {};
      for (const [k, v] of Object.entries(src)) {
        const id = Number(k);
        if (!Number.isFinite(id)) continue;
        words[k] = sanitizeStat((v ?? {}) as Partial<WordStat>, id);
      }
      return {
        version: SCHEMA_VERSION,
        wave: clampInt(parsed.wave, 0, Number.MAX_SAFE_INTEGER, 0),
        words,
      };
    } catch {
      return emptyPersisted();
    }
  }

  /** Debounced persist so a fast Blitz run doesn't thrash localStorage. */
  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushHandle != null) return;
    this.flushHandle = setTimeout(() => {
      this.flushHandle = null;
      this.flush();
    }, 400);
  }

  /** Force-write now (call on run end / dispose). */
  flush(): void {
    if (!this.dirty) return;
    const ls = safeLocalStorage();
    if (!ls) {
      this.dirty = false;
      return;
    }
    try {
      ls.setItem(storageKey(this.scope), JSON.stringify(this.state));
      this.dirty = false;
    } catch {
      /* quota / blocked — in-memory remains source of truth */
    }
  }

  /** Current global wave clock for this scope. */
  get wave(): number {
    return this.state.wave;
  }

  /** Read (never mutates) a word's record, or undefined if unseen. */
  get(entryId: number): WordStat | undefined {
    return this.state.words[String(entryId)];
  }

  /** Ensure a record exists (new words start in box 0, due now, strength 0.5). */
  private ensure(entryId: number, foreign?: string, english?: string): WordStat {
    const key = String(entryId);
    let s = this.state.words[key];
    if (!s) {
      s = {
        entryId,
        box: 0,
        correct: 0,
        wrong: 0,
        lastSeenWave: this.state.wave,
        dueWave: this.state.wave,
        strength: 0.5,
        foreign,
        english,
      };
      this.state.words[key] = s;
    } else {
      if (foreign && !s.foreign) s.foreign = foreign;
      if (english && !s.english) s.english = english;
    }
    return s;
  }

  /**
   * Note that a word was just SHOWN as the target of a wave. Advances the wave
   * clock and stamps lastSeen, so "due-ness" is measured from exposures.
   */
  markShown(entryId: number, foreign?: string, english?: string): void {
    this.state.wave += 1;
    const s = this.ensure(entryId, foreign, english);
    s.lastSeenWave = this.state.wave;
    this.scheduleFlush();
  }

  /**
   * Record the OUTCOME of a resolved wave for `entryId`. Climbs/drops the
   * Leitner box, updates the EWMA strength, and reschedules the due wave.
   *
   * @param correct true iff the learner answered correctly.
   */
  recordOutcome(entryId: number, correct: boolean, foreign?: string, english?: string): WordStat {
    const s = this.ensure(entryId, foreign, english);
    // EWMA strength: weight recent performance, but don't whiplash on one tap.
    const alpha = 0.4;
    s.strength = clamp01(s.strength * (1 - alpha) + (correct ? 1 : 0) * alpha);
    if (correct) {
      s.correct += 1;
      s.box = Math.min(MAX_BOX, s.box + 1);
    } else {
      s.wrong += 1;
      // A miss drops two boxes (but not below 0) — fumbles should sting and
      // resurface fast, which is the whole point of spaced difficulty.
      s.box = Math.max(0, s.box - 2);
    }
    const interval = BOX_INTERVALS_WAVES[s.box] ?? 0;
    s.dueWave = this.state.wave + interval;
    this.scheduleFlush();
    return s;
  }

  /**
   * Stamp human-readable context (foreign/english) for a word WITHOUT advancing
   * the scheduler — used by the selector's observePool priming pass so the
   * mastery readout has labels even before a word is first quizzed. Creates the
   * record in box 0 / due-now if unseen, but does NOT touch the wave clock.
   */
  primeContext(entryId: number, foreign?: string, english?: string): void {
    const before = this.get(entryId);
    const beforeForeign = before?.foreign;
    const beforeEnglish = before?.english;
    const s = this.ensure(entryId, foreign, english);
    // Only mark dirty if something actually changed: a brand-new record, or
    // context that was previously empty and is now filled.
    if (!before || s.foreign !== beforeForeign || s.english !== beforeEnglish) {
      this.scheduleFlush();
    }
  }

  /** All records as an array (snapshot copy; cheap for our pool sizes). */
  all(): WordStat[] {
    return Object.values(this.state.words);
  }

  /**
   * Urgency score for surfacing a word as the TARGET (higher = sooner). Combines:
   *  - overdue-ness (how many waves past due), so the scheduler is respected;
   *  - weakness (1 - strength), so fumbled words get priority;
   *  - novelty (unseen words get a healthy baseline so new content still flows,
   *    but below the ceiling a weak+overdue word can reach, so spaced
   *    repetition can out-prioritise novelty for actively-fumbled words).
   * Pure read; safe to call in tight loops.
   */
  targetUrgency(entryId: number): number {
    const s = this.get(entryId);
    const wave = this.state.wave;
    // Unseen: a HEALTHY baseline so fresh content always flows, but below the
    // ceiling a genuinely weak+overdue word can reach — spaced repetition must
    // be able to out-prioritise novelty when something is actively fumbled.
    if (!s) return 0.6;
    const overdue = Math.max(0, wave - s.dueWave);
    const overdueScore = 1 - 1 / (1 + overdue); // 0..1, saturating
    const weakness = 1 - s.strength; // 0..1
    const dueBonus = wave >= s.dueWave ? 0.2 : 0;
    // Weak + overdue can reach ~1.0 (above the 0.6 unseen baseline); a strong,
    // not-yet-due word sinks toward ~0, fading into the background.
    return Math.min(1, 0.5 * weakness + 0.45 * overdueScore + dueBonus);
  }

  /**
   * Desirability of a word as a DISTRACTOR (higher = surface sooner). We bias
   * toward words the learner KNOWS reasonably well (so distractors are plausible
   * but not cruel) and toward recently/often-seen words (familiar foils sharpen
   * discrimination). Never affects correctness — only ordering before dedup.
   */
  distractorAffinity(entryId: number): number {
    const s = this.get(entryId);
    if (!s) return 0.3; // unseen distractors are fine but not preferred
    // Mid-to-high strength makes a believable foil; very weak words as foils
    // just add noise. Familiarity (exposure) adds a little.
    const believability = s.strength; // 0..1
    const familiarity = Math.min(1, (s.correct + s.wrong) / 6); // 0..1
    return 0.7 * believability + 0.3 * familiarity;
  }

  dispose(): void {
    if (this.flushHandle != null) {
      clearTimeout(this.flushHandle);
      this.flushHandle = null;
    }
    this.flush();
  }
}
