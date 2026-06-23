// Core geometric types
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Game specific types
export enum LaneIndex {
  Left = 0,
  Center = 1,
  Right = 2
}

export interface Note {
  id: string;
  lane: LaneIndex;
  y: number;      // Current vertical position in canvas pixels
  text: string;   // The single TARGET-language word printed on the card
  /**
   * True iff this card carries the NEXT word the player must catch (the correct
   * next token of the target translation). In "Catch the Translation" exactly
   * one such card is catchable at a time. Distractor cards have isTarget=false.
   */
  isTarget: boolean;
  /**
   * Index of this word in the target translation sequence (target cards only;
   * -1 for distractors). Lets the loop verify catch-in-order.
   */
  seqIndex: number;
  hit: boolean;   // Has it been caught/tapped?
  missed: boolean; // Did it pass the line without a catch?
  spawnTime: number;
  hitTime?: number;
}

export enum GameState {
  MENU,
  PLAYING,
  GAME_OVER
}

export enum GameMode {
  PRACTICE, // Wait for user
  BLITZ     // Continuous stream
}

export interface GameConfig {
  mode: GameMode;
  speed: number; // Pixels per frame or similar
}

// ---------------------------------------------------------------------------
// Resolved language context (FOUNDATION → UI/Content)
// ---------------------------------------------------------------------------
// The active target language the player is being quizzed in, resolved from
// hostApi.getStackConfig().languages (first non-English entry, falling back to
// the first entry). `isRTL` is true for ar/he/fa/ur so the UI can mirror.
export interface ActiveLanguage {
  /** The TARGET (learning) language whose words fall + get spoken, e.g. "es". */
  code: string;
  /**
   * The PRIMARY language the player already knows (stack.languages[0]) — also
   * the UI language. The prompt phrase is shown in this language and is never
   * required to be spoken aloud.
   */
  primary: string;
  /** True for right-to-left scripts: ar, he, fa, ur. */
  isRTL: boolean;
  /** TTS playback rate from stack config (0..1+), pass-through to speak(). */
  rate: number;
  /** "small" | "medium" | "large" — host text-size preference. */
  textSize: string;
  /** Whether the host wants romanization shown under foreign text. */
  showRomanization: boolean;
}

// ---------------------------------------------------------------------------
// EVENT BUS payload types (FOUNDATION → all streams)
// ---------------------------------------------------------------------------
// These are the *only* contract surfaces parallel streams may depend on.
// Game.ts emits; effects/audio/progression/ui subscribe. Do NOT widen these
// without coordinating — they are the cross-stream ABI.

/**
 * The identity of the TARGET word a wave is quizzing. Carried on noteHit /
 * noteMiss / wave-resolved so the learning stream can do spaced-difficulty
 * bookkeeping and the UI can do meaning-reveal / feedback cards WITHOUT
 * reaching into Game.ts or ContentManager. This is the learning ABI.
 *
 * `foreign` is the RAW (un-cleaned) foreign prompt text — the same string that
 * is spoken — so the learning stream keys on stable identity, not the
 * display-cleaned label. `english` is the display-cleaned correct answer.
 */
export interface WordIdentity {
  /** Stable host entry id for the target word (dedup/spacing key). */
  entryId: number;
  /** RAW foreign prompt text (what TTS speaks), not the display-cleaned form. */
  foreign: string;
  /** The correct English answer (display-cleaned). */
  english: string;
  /** Optional romanization of the foreign prompt, if the host provided one. */
  romanization?: string;
  /** Language code of the foreign prompt (e.g. "es", "ar"). */
  lang: string;
}

/** Emitted once per game start (Practice or Blitz). */
export interface GameStartEvent {
  mode: GameMode;
  /** The resolved active target language at game start. */
  language: ActiveLanguage;
}

/** Emitted whenever the MENU screen is (re)shown. */
export interface MenuShownEvent {
  /** Final score of the run that just ended, if any (else 0). */
  lastScore: number;
}

/** Emitted when the player hits the CORRECT note. */
export interface NoteHitEvent {
  lane: LaneIndex;
  /** Screen-space x of the hit (CSS px), for VFX spawning. */
  x: number;
  /** Screen-space y of the hit (CSS px) — the strum line. */
  y: number;
  /** Combo value AFTER this hit. */
  combo: number;
  /** Base points awarded for this hit (pre-progression-multiplier). */
  points: number;
  mode: GameMode;
  /**
   * Identity of the target word the player just answered correctly. Drives
   * spaced-difficulty (mark word easier) and meaning-reveal. Always present
   * on a correct hit.
   */
  word: WordIdentity;
}

/** Emitted when the player hits a WRONG note OR lets the target pass. */
export interface NoteMissEvent {
  lane: LaneIndex | null;
  /** Screen-space x of the miss (CSS px); null lane → strum-line center. */
  x: number;
  y: number;
  /** "wrong" = tapped a distractor; "passed" = target fell past the line. */
  reason: "wrong" | "passed";
  mode: GameMode;
  /**
   * Identity of the target word the player missed. Drives spaced-difficulty
   * (mark word due-sooner / weaker) and the meaning-reveal feedback card.
   * Always present.
   */
  word: WordIdentity;
}

/**
 * Emitted exactly once when a wave concludes — whether the player got it right,
 * tapped a distractor, or let the target pass. This is the single, reliable
 * hook for the learning stream to record an outcome and for the UI to raise the
 * post-answer feedback card. (noteHit/noteMiss can fire on distractor taps mid-
 * wave; wave-resolved fires once with the FINAL verdict.)
 */
export interface WaveResolvedEvent {
  /** Identity of the target word this wave quizzed. */
  word: WordIdentity;
  /** Final outcome of the wave. */
  outcome: "correct" | "wrong" | "passed";
  /** True iff outcome === "correct". Convenience for subscribers. */
  correct: boolean;
  /** Combo value at the moment the wave resolved. */
  combo: number;
  mode: GameMode;
}

/** Emitted whenever the combo counter changes (hit increments, miss → 0). */
export interface ComboChangeEvent {
  value: number;
  /** Previous combo value (so effects can detect milestone crossings). */
  previous: number;
}

/** Emitted whenever the score changes. */
export interface ScoreChangeEvent {
  value: number;
  /** Signed delta from the previous score (negative on penalty). */
  delta: number;
}

/** Emitted once when the run ends. */
export interface GameOverEvent {
  finalScore: number;
  mode: GameMode;
}

/**
 * The full event map. Keys are event names, values are payload types.
 * `GameEventBus` (src/events.ts) is typed against this map.
 */
export interface GameEventMap {
  gameStart: GameStartEvent;
  menuShown: MenuShownEvent;
  noteHit: NoteHitEvent;
  noteMiss: NoteMissEvent;
  "wave-resolved": WaveResolvedEvent;
  comboChange: ComboChangeEvent;
  scoreChange: ScoreChangeEvent;
  gameOver: GameOverEvent;
}

export type GameEventName = keyof GameEventMap;
