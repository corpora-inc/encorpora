/**
 * Splitbeat game core: transport, planner, judgement, gates.
 *
 * TRANSPORT. `AudioContext.currentTime` is the only clock. Bars are planned
 * ahead into a ring buffer that records each bar's absolute start time and
 * seconds-per-beat, so a tempo change lands exactly on a bar line and the
 * renderer can position any note by `(note.time - now) * pxPerSecond` without
 * ever consulting a tempo map.
 *
 * TWO CURSORS. Notes are materialised ~3.4s ahead (cheap, no audio) so they can
 * scroll in. Backing audio is scheduled only ~0.25s ahead, so when combo
 * unlocks a new layer you hear it on the next bar rather than four bars later.
 *
 * NO HITSTOP ON NOTES. Freezing the picture is the standard way to make an
 * impact land, but in a rhythm game the picture is tempo-locked to the music,
 * so a freeze desynchronises the scroll from what you are hearing. The punch is
 * delivered instead by zoom, shake, lane flash and particles — and true hitstop
 * is allowed only when no note is within 0.35s, which is exactly the aftermath
 * bar where the gate shatters.
 *
 * THE RUN NEVER RESTARTS. See `oweHeart`.
 */

import {
  demandFor,
  observe,
  quickness,
  revealPlan,
  SECOND_GRADE_FLOW,
  seedSuccess,
  settle,
  type FlowSpec,
  type RevealPlan,
} from "../../../../packs/shared/game-pacing/index.ts";
import { AudioEngine } from "../audio/engine.ts";
import { SECTORS, scheduleBar, cadence, type Sector } from "../audio/music.ts";
import type { Host, Question } from "../contract.ts";
import { answerPlan, type AnswerPlan } from "./answer.ts";
import { polyBar, inhaleBar, showcaseBar, subdivisionFor, type ChartNote, type Lane } from "./chart.ts";
import { evolve, grooveBar, newGroove, ruleInto, type Groove } from "./groove.ts";
import { layerFor, multiplierFor, strikeWindows, verdictFor, windowsFor, VERDICT_SCORE, type Verdict } from "./judge.ts";
import { loadFlow, saveFlow } from "./memory.ts";

export type { Lane };

export const LANES = 3;
const NOTE_POOL = 320;
const BAR_RING = 64;
const NOTE_HORIZON = 3.4;
const AUDIO_HORIZON = 0.3;
const LEAD_IN = 0.45;
export const MAX_CHARGE = 5;

/**
 * SPLITBEAT's flow shape.
 *
 * `SECOND_GRADE_FLOW` with two changes, both of which this game earns:
 *
 *  - `start` is not `0.04`. A run resumes wherever the last one left off (see
 *    `memory.ts`), and a FIRST run starts at `0.06` — barely above the floor,
 *    because the founder is a drummer and a mathematician and could not last a
 *    few seconds, so the opening has to be genuinely trivial.
 *  - `fallSeconds` is 26 rather than 50. Relief is not earned, and in a game
 *    where the evidence arrives sixty times a second rather than once per
 *    answer it should arrive quickly too.
 */
export const SPLITBEAT_FLOW: FlowSpec = {
  ...SECOND_GRADE_FLOW,
  start: 0.06,
  fallSeconds: 26,
};

/**
 * THE HEART.
 *
 * `charge` used to be five integer blocks and every unhit note took one. Notes
 * land about every 0.6 s at the opening, so a player who was merely WATCHING —
 * a child who has just been handed the device, or an adult reading the
 * instructions — was dead in **3.14 seconds, measured**, and the first question
 * did not appear until 12.69 s. It was not possible to lose the run by playing
 * badly, because it was not possible to reach anything to play badly at.
 *
 * The heart is now continuous on [0,1] and it REFILLS as you play. The three
 * constants are chosen against the note rate the opening actually produces
 * (three notes a bar at 92 BPM is 1.15 notes/s):
 *
 *  - a player who taps NOTHING drains at `1.15 * MISS_COST` = 0.0288/s, so an
 *    untouched heart empties in about 35 s — and the first question now arrives
 *    inside 9 s, so they meet a question before they ever meet the consequence;
 *  - a player landing HALF their notes is at `0.575*0.020 - 0.575*0.025`, a
 *    drift of −0.0029/s: nearly two hundred seconds, and every gate they answer
 *    puts it back. Half is survivable indefinitely in practice;
 *  - a player landing 70% is net POSITIVE and stays full.
 */
const HEART_MISS = 0.025;
const HEART_HIT = 0.02;
const HEART_GATE_RIGHT = 0.34;
const HEART_GATE_WRONG = -0.12;

/**
 * The moving estimate of how many notes are being landed, as an EMA weight.
 *
 * A twenty-four-note window: long enough that one fumbled sixteenth does not
 * calm the world, short enough that a player who has genuinely lost the thread
 * feels the world back off within a bar or two.
 */
const NOTE_WINDOW = 24;

export type Note = {
  active: boolean;
  time: number;
  lane: Lane;
  accent: boolean;
  cell: number;
  cells: number;
  /** per-lane average spacing in this bar; drives the timing windows */
  spacing: number;
  isChoice: boolean;
  gateId: number;
  label: string;
  correct: boolean;
  /**
   * For a choice tile, the half-width of its strike window in seconds, straight
   * off `answerPlan(item)`. Zero for an ordinary note, which is judged on
   * `spacing` instead. See `judge.ts`.
   */
  strikeSec: number;
  /** 0 pending, 1 struck, 2 missed */
  state: 0 | 1 | 2;
  verdict: Verdict | null;
  delta: number;
  bornAt: number;
  hitAt: number;
};

/** The windows a note is judged against — the ONE place the choice is made. */
export function windowsForNote(n: Note): ReturnType<typeof windowsFor> {
  return n.isChoice ? strikeWindows(n.strikeSec) : windowsFor(n.spacing);
}

export type Gate = {
  id: number;
  active: boolean;
  q: Question | null;
  time: number;
  revealAt: number;
  resolved: boolean;
  correct: boolean;
  answered: string;
  labels: [string, string, string];
  correctLane: Lane;
  cells: number | null;
  accentEvery: number;
  /** the answering budget for this gate's item — pure, and fixed at spawn */
  plan: AnswerPlan;
  /**
   * True when this gate is the one the player owes because the heart ran out.
   * It is an ORDINARY gate in every other respect; the flag only decides
   * whether the renderer says RESTART THE HEART over it.
   */
  debt: boolean;
  /** 0..1 animation drivers, advanced by the renderer's clock */
  shatter: number;
  crack: number;
};

/**
 * A completed sum, held in front of the child.
 *
 * `packs/shared/game-pacing`'s rule, quoted from its own source: "**A shown
 * reveal never expires.** … 'then go on' is the child's own hand, and a hand
 * needs no deadline." So there is deliberately no deadline field here. The only
 * things that take it down are the child's next struck note (after `settleMs`,
 * so a tap already in flight cannot eat it) and the next question arriving,
 * which is also something the child caused.
 */
export type Reveal = {
  prompt: string;
  answer: string;
  bornAt: number;
  plan: RevealPlan;
};

export type EventKind =
  | "hit"
  | "miss"
  | "ghost"
  | "gate-correct"
  | "gate-wrong"
  | "sector"
  /** the heart hit zero and a question is now owed — the music does NOT stop */
  | "heart-out"
  /** the owed question was answered right and the heart is full again */
  | "revive"
  | "charge-up";

export type GameEvent = {
  kind: EventKind;
  lane: Lane;
  verdict: Verdict | null;
  accent: boolean;
  strength: number;
};

/**
 * There is no `"breakdown"`.
 *
 * The founder: *"I don't like that it 'restarts' … it shouldn't take you back to
 * the beginning … when you have to do a math problem to go on it should flow
 * with the regular game and not be a reset."* A phase the game could enter and
 * have to be let out of IS the reset, however short it is, so the phase is gone
 * rather than shortened. See `oweHeart`.
 */
export type Phase = "title" | "playing" | "paused";

export type Fx = {
  shake: number;
  shakeAngle: number;
  zoom: number;
  flash: number;
  chroma: number;
  laneFlash: [number, number, number];
  vignette: number;
  hitstopUntil: number;
  timeDilate: number;
};

const KEY_LANE: Record<string, Lane> = {
  ArrowDown: 0, a: 0, j: 0, "1": 0, z: 0,
  ArrowRight: 1, s: 1, k: 1, "2": 1, x: 1, " ": 1,
  ArrowUp: 2, d: 2, l: 2, "3": 2, c: 2,
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export class Game {
  readonly eng: AudioEngine;
  readonly host: Host;

  readonly notes: Note[] = [];
  readonly gates: Gate[] = [];
  readonly events: GameEvent[] = [];
  private eventCount = 0;

  /**
   * Ring of planned bars, so the renderer can rule the floor into the current
   * subdivision. This is the whole visual thesis: the bar of music IS the
   * fraction bar, cut into `cells` equal slices, and the notes land on the cuts.
   */
  readonly barGrid: { t: number; dur: number; cells: number; playEvery: number }[] = [];
  private gridCur = 0;

  phase: Phase = "title";
  score = 0;
  combo = 0;
  bestCombo = 0;

  /**
   * The one adaptive scalar, [0,1] — `packs/shared/game-pacing`'s.
   *
   * It drives the maths difficulty asked of the host, the tempo, the
   * subdivision and the note count TOGETHER, in BOTH directions. That coupling
   * is the whole answer to *"it should just go on and adjust and vary itself as
   * you go on. If you keep sucking and losing then it should just get
   * easier/stay easy."*
   */
  intensity = SPLITBEAT_FLOW.start;
  /** the flow controller's estimate of how the MATHS is going */
  gateSuccess = seedSuccess(SPLITBEAT_FLOW);
  /**
   * …and of how the PLAYING is going. Kept separate and combined by taking the
   * WORSE of the two, so a child who is answering every sum right but cannot
   * land the notes is not dragged up the ladder by half of their evidence.
   * This is the channel that was missing: `adjustDifficulty` used to move on a
   * gate outcome and nothing else, so a player who never survived long enough
   * to REACH a gate never received any relief at all.
   */
  noteSuccess = seedSuccess(SPLITBEAT_FLOW);

  /** 0..1. See HEART_MISS. */
  heart = 1;
  /** True between the heart emptying and the owed question being answered. */
  heartDebt = false;
  /** How many times the heart has run out this run. Never a game over. */
  heartOuts = 0;

  /** Gates the child actually answered. An unanswered one is not an attempt. */
  gatesTotal = 0;
  gatesCorrect = 0;
  /** Gates that closed with nobody striking a tile. Never reported, never punished. */
  gatesExpired = 0;
  notesHit = 0;
  notesMissed = 0;
  perfectRun = 0;
  sectorIdx = 0;
  sectorFlash = 0;
  /** last judgement, for the timing meter */
  lastDelta = 0;
  lastVerdict: Verdict | null = null;
  lastJudgeAt = 0;

  /** the gate the player is currently being asked, or null */
  activeGate: Gate | null = null;
  /** the completed sum being held after a wrong or unanswered gate */
  reveal: Reveal | null = null;

  /** The evolving groove. The reason a long run does not repeat. */
  readonly groove: Groove = newGroove();
  bpm = 92;

  readonly fx: Fx = {
    shake: 0,
    shakeAngle: 0,
    zoom: 1,
    flash: 0,
    chroma: 0,
    laneFlash: [0, 0, 0],
    vignette: 0,
    hitstopUntil: 0,
    timeDilate: 1,
  };

  /** user timing calibration, seconds; positive = player is hitting late */
  calibration = 0;
  soundOn = true;
  reduced = false;

  private barTime = new Float64Array(BAR_RING);
  private barSpb = new Float64Array(BAR_RING);
  private noteCursor = 0;
  private audioCursor = 0;
  private cycleStartBar = 0;
  private grooveBars = 6;
  /**
   * Bars of inhale between the reveal and the gate, fixed for the whole of the
   * current cycle so a sector change mid-cycle cannot move the gate bar out
   * from under a question that is already on screen. Sized in `applyDifficulty`
   * so the reveal-to-strike lead is never under READ_SEC.
   */
  private inhaleBars = 1;
  private cycleInhale = 1;
  private gateSeq = 0;
  private schedTimer = 0;
  private laneLock = [0, 0, 0];
  private scratch: ChartNote[] = [];
  /** seconds since the flow state was last written to storage */
  private flowDirty = 0;
  private started = false;

  constructor(host: Host) {
    this.host = host;
    this.eng = new AudioEngine();
    this.reduced = host.prefersReducedMotion();
    for (let i = 0; i < NOTE_POOL; i++) {
      this.notes.push({
        active: false, time: 0, lane: 0, accent: false, cell: 0, cells: 4, spacing: 0.5,
        isChoice: false, gateId: -1, label: "", correct: false, strikeSec: 0, state: 0,
        verdict: null, delta: 0, bornAt: 0, hitAt: 0,
      });
    }
    for (let i = 0; i < 6; i++) {
      this.gates.push({
        id: -1, active: false, q: null, time: 0, revealAt: 0, resolved: false, correct: false,
        answered: "", labels: ["", "", ""], correctLane: 0, cells: null, accentEvery: 2,
        plan: answerPlan({ difficulty: 0 }), debt: false, shatter: 0, crack: 0,
      });
    }
    // A run resumes where the last one left off. A child who keeps struggling
    // must not be made to re-earn the relief they already earned yesterday.
    const remembered = loadFlow();
    if (remembered) {
      this.intensity = clamp(remembered.intensity, SPLITBEAT_FLOW.floor, SPLITBEAT_FLOW.ceiling);
      this.gateSuccess = clamp(remembered.gateSuccess, 0, 1);
      this.noteSuccess = clamp(remembered.noteSuccess, 0, 1);
    }
    for (let i = 0; i < 64; i++) {
      this.events.push({ kind: "hit", lane: 0, verdict: null, accent: false, strength: 1 });
    }
    for (let i = 0; i < 24; i++) this.barGrid.push({ t: -99, dur: 2, cells: 4, playEvery: 1 });
  }

  /**
   * The 1..10 scalar the HUD shows and the host is asked in. A view of
   * `intensity`, not a second source of truth — they drifted apart once and the
   * host was served questions from a ladder the world was not on.
   */
  get difficulty(): number {
    return 1 + this.intensity * 9;
  }
  set difficulty(v: number) {
    this.intensity = clamp((v - 1) / 9, 0, 1);
    this.gateSuccess = seedSuccess(SPLITBEAT_FLOW, this.intensity);
    this.noteSuccess = this.gateSuccess;
    this.applyDifficulty();
  }

  /** The heart, on the five-block scale the HUD draws it in. */
  get charge(): number {
    return this.heart * MAX_CHARGE;
  }

  /** The subdivision the world is ruled into right now. */
  get cells(): number {
    return this.groove.cells;
  }
  get accentEvery(): number {
    return this.groove.accentEvery;
  }

  get sector(): Sector {
    return SECTORS[this.sectorIdx % SECTORS.length]!;
  }

  get audioNow(): number {
    return this.eng.now;
  }

  /** Musical time a tap at wall-clock `audioTime` corresponds to. */
  private judgeTime(t: number): number {
    return t - this.eng.outputLatency - this.calibration;
  }

  /* ---------------------------------------------------------------- */
  /* events (pooled — the renderer drains this every frame)            */
  /* ---------------------------------------------------------------- */

  private emit(kind: EventKind, lane: Lane, verdict: Verdict | null, accent: boolean, strength: number): void {
    if (this.eventCount >= this.events.length) return;
    const e = this.events[this.eventCount++]!;
    e.kind = kind;
    e.lane = lane;
    e.verdict = verdict;
    e.accent = accent;
    e.strength = strength;
  }
  get pendingEvents(): number {
    return this.eventCount;
  }
  clearEvents(): void {
    this.eventCount = 0;
  }

  /* ---------------------------------------------------------------- */
  /* lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.eng.resume();
    this.phase = "playing";
    this.reanchor();
    this.schedTimer = self.setInterval(() => this.pump(), 22);
  }

  private reanchor(): void {
    const t = this.eng.now + LEAD_IN;
    this.noteCursor = 0;
    this.audioCursor = 0;
    // Seat the FIRST cycle already one bar in, so a new player meets a question
    // inside about seven seconds instead of thirteen. Meeting the maths early
    // matters more at the start of a run than a full opening vamp does, and it
    // has to happen well before the heart could possibly be in trouble.
    this.cycleStartBar = -1;
    this.barTime[0] = t;
    this.barSpb[0] = 60 / this.bpm;
    this.applyDifficulty();
    this.cycleInhale = this.inhaleBars;
    this.barSpb[0] = 60 / this.bpm;
  }

  pause(): void {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.eng.setMusicGain(0.0, 0.12);
  }

  resumeFromPause(): void {
    if (this.phase !== "paused") return;
    this.phase = "playing";
    this.eng.setMusicGain(0.62, 0.2);
    this.flushNotes();
    this.reanchorSoft();
  }

  /** Re-seat the transport at "now" without resetting the run. */
  private reanchorSoft(): void {
    const t = this.eng.now + LEAD_IN;
    const bar = this.noteCursor;
    this.barTime[bar % BAR_RING] = t;
    this.barSpb[bar % BAR_RING] = 60 / this.bpm;
    this.audioCursor = bar;
    this.cycleStartBar = bar;
    // A fresh cycle, so re-pin it like the other two cycle starts do. Without
    // this a sector change (which calls applyDifficulty mid-cycle) leaves the
    // pinned value one short and the next question's lead falls under READ_SEC.
    this.cycleInhale = this.inhaleBars;
  }

  private flushNotes(): void {
    for (const n of this.notes) n.active = false;
    for (const g of this.gates) g.active = false;
    this.activeGate = null;
  }

  destroy(): void {
    if (this.schedTimer) self.clearInterval(this.schedTimer);
    this.schedTimer = 0;
    this.eng.dispose();
  }

  /* ---------------------------------------------------------------- */
  /* difficulty                                                        */
  /* ---------------------------------------------------------------- */

  private applyDifficulty(): void {
    const d = this.difficulty;
    this.bpm = 92 + d * 6 + this.sector.bpmBias;
    // Four groove bars at the bottom, three higher up: a question every ~16 s
    // rather than every ~29 s. The founder wanted the maths to FLOW with the
    // game, and a gate you meet twice a minute is not part of the game.
    this.grooveBars = this.intensity < 0.4 ? 4 : 3;
    // A default only: `spawnGate` re-sizes this from the item it was actually
    // handed, before any inhale bar is planned. Sizing is the only thing the
    // tempo is allowed to touch; the WINDOW itself is `answer.ts`'s and the
    // tempo cannot reach it.
    this.inhaleBars = this.inhaleFor(answerPlan({ difficulty: 0 }).readSec);
    this.eng.setDelayTime((60 / this.bpm) * 0.75);
  }

  /**
   * Inhale bars that put the reveal instant at or after the reveal bar's start.
   *
   * The lead is `[reveal][inhale x n][gate]`, so `n` bars of inhale buy
   * `(1 + n)` bars of lead, and the reveal is placed `readSec` back from the
   * gate. `n` therefore only has to satisfy `(1 + n) * barDur >= readSec`.
   */
  private inhaleFor(readSec: number): number {
    const barDur = (60 / this.bpm) * 4;
    return Math.max(1, Math.ceil(readSec / barDur) - 1);
  }

  /**
   * The success estimate the controller steers on: the WORSE of the two
   * channels.
   *
   * `demandFor` is monotone non-decreasing in success, so taking the minimum
   * here is exactly `min(demandFor(gates), demandFor(notes))` — struggling in
   * either channel calms the world, and climbing takes both. See `noteSuccess`.
   */
  get steer(): number {
    return Math.min(this.gateSuccess, this.noteSuccess);
  }

  /** Where the controller wants the world, right now. For tests and the HUD. */
  get demand(): number {
    return demandFor(SPLITBEAT_FLOW, this.steer);
  }

  /* ---------------------------------------------------------------- */
  /* planner                                                           */
  /* ---------------------------------------------------------------- */

  private pump(): void {
    if (this.phase !== "playing") return;
    const now = this.eng.now;

    let guard = 0;
    while (guard++ < 8) {
      const bar = this.noteCursor;
      const t = this.barTime[bar % BAR_RING]!;
      if (t >= now + NOTE_HORIZON) break;
      if (!this.planBar(bar)) break;
      this.noteCursor = bar + 1;
    }

    guard = 0;
    while (guard++ < 8 && this.audioCursor < this.noteCursor) {
      const bar = this.audioCursor;
      const t = this.barTime[bar % BAR_RING]!;
      if (t >= now + AUDIO_HORIZON) break;
      const spb = this.barSpb[bar % BAR_RING]!;
      const g = this.activeGate;
      // Dip the arrangement while a question is on screen so it can be read.
      const reading = g && !g.resolved && now >= g.revealAt ? 0.42 : 1;
      scheduleBar(this.eng, t, spb, bar, this.sector, {
        layer: layerFor(this.combo),
        intensity: reading,
      });
      this.audioCursor = bar + 1;
    }
  }

  private roleOf(bar: number): "groove" | "reveal" | "inhale" | "gate" | "aftermath" | "payoff" {
    const i = bar - this.cycleStartBar;
    const G = this.grooveBars;
    const H = this.cycleInhale;
    if (i < G - 1) return "groove";
    if (i === G - 1) return "reveal";
    if (i < G + H) return "inhale";
    if (i === G + H) return "gate";
    if (i === G + H + 1) return "aftermath";
    return "payoff";
  }

  /** Plan one bar. Returns false when the bar cannot be planned yet. */
  private planBar(bar: number): boolean {
    const idx = bar % BAR_RING;
    // Roll the cycle over first, so roleOf() is asked about the right cycle.
    if (bar - this.cycleStartBar >= this.grooveBars + 4 + this.cycleInhale) {
      this.cycleStartBar = bar;
      this.applyDifficulty();
      // Pinned for the whole cycle: roleOf must not change shape underneath a
      // gate that is already planned.
      this.cycleInhale = this.inhaleBars;
    }
    const role = this.roleOf(bar);
    const t0 = this.barTime[idx]!;
    const spb = 60 / this.bpm;
    this.barSpb[idx] = spb;

    if (role === "payoff") {
      const g = this.activeGate;
      // Do not commit the payoff until the answer is in — the payoff *is* the
      // answer, played.
      if (g && !g.resolved) return false;
    }

    let list: ChartNote[];
    let cells = this.groove.cells;
    let playEvery = 1;

    if (role === "inhale" || role === "gate" || role === "aftermath") {
      list = inhaleBar(this.groove.phase + bar, this.scratch);
      cells = 4;
      if (role === "gate") list.length = 0;
      if (role === "aftermath") list.length = 0;
    } else if (role === "payoff") {
      const g = this.activeGate;
      if (g && g.correct && g.cells) {
        // The child answered with a denominator; the world re-rules itself into
        // it and they PLAY the answer they gave.
        ruleInto(this.groove, g.cells, g.accentEvery, this.intensity);
      }
      cells = this.groove.cells;
      list = showcaseBar(cells, this.groove.accentEvery, this.scratch);
      // A sixteenth-note showcase is a showcase, not an exam: at low intensity
      // every other slice is DRAWN but not required.
      const playable = Math.max(4, Math.round(4 + this.intensity * 12));
      if (cells > playable) {
        playEvery = Math.ceil(cells / playable);
        list = list.filter((n) => n.cell % playEvery === 0);
      }
    } else if (this.intensity >= 0.6 && (bar * 7919) % 4 === 0) {
      list = polyBar(bar, this.scratch);
      cells = 12;
    } else {
      // The ordinary bar, and the only one that evolves.
      evolve(this.groove, this.intensity);
      cells = this.groove.cells;
      list = grooveBar(this.groove, this.intensity, this.scratch);
    }

    // Per-lane spacing drives the timing windows for every note in this bar.
    const barDur = spb * 4;
    const perLane = [0, 0, 0];
    for (const n of list) perLane[n.lane]!++;
    const spacing: number[] = [
      barDur / Math.max(1, perLane[0]!),
      barDur / Math.max(1, perLane[1]!),
      barDur / Math.max(1, perLane[2]!),
    ];

    for (const cn of list) {
      const n = this.takeNote();
      if (!n) break;
      n.time = t0 + cn.beat * spb;
      n.lane = cn.lane;
      n.accent = cn.accent;
      n.cell = cn.cell;
      n.cells = cells;
      n.spacing = spacing[cn.lane]!;
      n.isChoice = false;
      n.gateId = -1;
      n.label = "";
      n.correct = false;
      n.strikeSec = 0;
      n.state = 0;
      n.verdict = null;
      n.bornAt = this.eng.now;
      n.hitAt = 0;
    }

    if (role === "reveal") this.spawnGate(t0, spb);
    if (role === "gate") this.placeChoiceNotes(t0, spb);

    const g = this.barGrid[this.gridCur % this.barGrid.length]!;
    this.gridCur++;
    g.t = t0;
    g.dur = barDur;
    g.cells = cells;
    g.playEvery = playEvery;

    this.barTime[(bar + 1) % BAR_RING] = t0 + barDur;
    return true;
  }

  private takeNote(): Note | null {
    for (const n of this.notes) if (!n.active) { n.active = true; return n; }
    return null;
  }

  private takeGate(): Gate {
    for (const g of this.gates) if (!g.active) return g;
    return this.gates[0]!;
  }

  /* ---------------------------------------------------------------- */
  /* gates                                                             */
  /* ---------------------------------------------------------------- */

  private spawnGate(revealT0: number, spb: number): void {
    const q = this.host.next({ difficulty: Math.round(this.difficulty) });
    const g = this.takeGate();
    g.id = ++this.gateSeq;
    g.active = true;
    g.q = q;
    g.plan = answerPlan(q);
    // Size the inhale from THIS item, now — before a single inhale bar has been
    // planned, and never again for this cycle. Sizing it in `applyDifficulty`
    // instead meant every question, however easy, waited out the lead the
    // HARDEST possible question would have needed, which put the first question
    // of a run at 13.06 s.
    this.cycleInhale = this.inhaleFor(g.plan.readSec);
    // [reveal][inhale × cycleInhale][gate]. The GATE is on the grid, because a
    // drummer can feel a downbeat coming and the three tiles land on one.
    g.time = revealT0 + spb * 4 * (1 + this.cycleInhale);
    // …and the REVEAL is placed exactly `readSec` before it, wherever in the bar
    // that falls. That is the whole trick: the quantisation is spent on the end
    // that is a box of text rather than on the end that is a note, so the
    // delivered reading window IS the planned one at every tempo. Rounding the
    // BUDGET up to whole bars instead made the window a function of `bpm` —
    // eight consecutive questions measured 7.35, 7.20, 7.05, 6.92, 6.54, 6.42,
    // 6.30, 6.19 s, each harder than the last and each given less time. See
    // `answer.ts`.
    g.revealAt = g.time - g.plan.readSec;
    g.resolved = false;
    g.correct = false;
    g.answered = "";
    g.debt = this.heartDebt;
    g.shatter = 0;
    g.crack = 0;
    // The last question's evidence has been superseded by a new one. This is one
    // of exactly two things that take a reveal down, and it is the child's own
    // progress rather than a timer. See `Reveal`.
    this.reveal = null;

    const sub = subdivisionFor(q.answer);
    g.cells = sub ? sub.cells : null;
    g.accentEvery = sub ? sub.accentEvery : this.accentEvery;

    const wrong = q.distractors.filter((d) => d !== q.answer).slice(0, 2);
    while (wrong.length < 2) wrong.push(String(wrong.length + 1));
    const lane = (this.gateSeq * 7 + Math.floor(revealT0 * 13)) % 3 as Lane;
    const labels: [string, string, string] = ["", "", ""];
    labels[lane] = q.answer;
    let w = 0;
    for (let i = 0; i < 3; i++) if (i !== lane) labels[i] = wrong[w++]!;
    g.labels = labels;
    g.correctLane = lane;
    this.activeGate = g;

    // Tension: a riser through the LAST inhale bar into the gate, so a longer
    // inhale reads as more room to think rather than a longer wind-up.
    if (this.soundOn) this.eng.riser(revealT0 + spb * 4 * this.cycleInhale, spb * 4, 0.85);
  }

  private placeChoiceNotes(t0: number, spb: number): void {
    const g = this.activeGate;
    if (!g) return;
    // The bar we are actually planning is authoritative for the strike time, so
    // the reveal instant moves with it and the delivered window stays exact.
    g.time = t0;
    g.revealAt = t0 - g.plan.readSec;
    for (let lane = 0 as Lane; lane < 3; lane = (lane + 1) as Lane) {
      const n = this.takeNote();
      if (!n) break;
      n.time = t0;
      n.lane = lane;
      n.accent = true;
      n.cell = 0;
      n.cells = 1;
      n.spacing = spb * 4;
      n.isChoice = true;
      n.gateId = g.id;
      n.label = g.labels[lane]!;
      n.correct = lane === g.correctLane;
      // NOT `windowsFor(spacing)`. A tile's window is the item's, and a harder
      // item's is wider — never narrower, and never touched by the tempo.
      n.strikeSec = g.plan.strikeSec;
      n.state = 0;
      n.verdict = null;
      n.bornAt = this.eng.now;
      n.hitAt = 0;
    }
  }

  private resolveGate(g: Gate, answered: string, correct: boolean, ms: number): void {
    if (g.resolved) return;
    g.resolved = true;
    g.correct = correct;
    g.answered = answered;
    this.gatesTotal++;
    const t = this.eng.now;
    const spb = 60 / this.bpm;

    if (g.q) {
      /**
       * `ms` is how long the CHILD took, measured from the first instant a tile
       * could be struck — not from when the question was revealed.
       *
       * All three tiles land on the same beat, so the READ_SEC-plus seconds
       * before the gate bar are the game's wait and not the child's thinking.
       * Reporting them also put every correct answer over the host's fluency
       * threshold — `dynawalla-app/src/packs/items.ts` climbs the arithmetic
       * ladder only on `correct && latencyMs <= 6000` — so a run of nothing but
       * right answers would have been pinned to the easiest rung forever.
       */
      this.host.report({ questionId: g.q.id, correct, ms: Math.max(1, Math.round(ms)), answered });
    }

    // The maths channel of the flow controller. `ms/1000` is THINKING time by
    // the same argument the `report` above is: it starts when a tile could
    // first be struck. See `game-pacing`'s latency contract.
    this.gateSuccess = observe(SPLITBEAT_FLOW, this.gateSuccess, correct, ms / 1000);
    // The GAME's debt, not the gate's flag. `g.debt` only decides whether the
    // banner is drawn; a debt raised while this question was already in flight
    // is still a debt, and this question is still the toll that clears it.
    const wasDebt = this.heartDebt;
    this.clearDebt();

    if (correct) {
      this.gatesCorrect++;
      // Speed is REWARDED, never enforced: `quickness` can only ADD to the
      // bonus, and a child who took a minute still gets the full base.
      const bonus = g.cells ? 400 + g.cells * 60 : 400;
      const swift = 1 + quickness(SPLITBEAT_FLOW, ms / 1000);
      this.score += Math.round(bonus * swift) * multiplierFor(this.combo);
      this.heart = clamp(this.heart + (wasDebt ? 1 : HEART_GATE_RIGHT), 0, 1);
      this.emit(wasDebt ? "revive" : "gate-correct", g.correctLane, null, true, 1);
      this.host.haptic("success");
      if (this.soundOn) {
        this.eng.shatter(t, 1, 12);
        this.eng.chirp(t, 420, 1400, 0.26, 1);
        cadence(this.eng, t + 0.05, spb, this.sector, true);
        this.eng.clearFilter(0.2);
      }
      this.kick(1.0, 1.045, 0.55);
      this.requestHitstop(0.07);
      if (this.gatesCorrect % 4 === 0) this.advanceSector();
    } else {
      this.combo = 0;
      this.perfectRun = 0;
      // A wrong answer at a debt gate still buys the heart back. The question
      // was the toll, and a child who paid it and got it wrong has just been
      // shown the sum — which is the point — so they play on either way.
      this.heart = clamp(this.heart + (wasDebt ? 0.6 : HEART_GATE_WRONG), 0, 1);
      this.showReveal(g);
      this.emit("gate-wrong", g.correctLane, null, true, 1);
      this.host.haptic("failure");
      if (this.soundOn) {
        this.eng.impact(t, 1);
        this.eng.chirp(t, 300, 120, 0.34, 0.9);
        this.eng.muffle(spb * 4, 380);
        // Demonstrate the answer rather than lecture about it: the correct
        // subdivision is played as a ghost rhythm on the bell.
        const dcells = g.cells ?? 4;
        const n = Math.min(dcells, 8);
        for (let i = 0; i < n; i++) {
          this.eng.bell(t + 0.35 + (i * spb * 4) / n, this.sector.root + 48, 0.4, 0.35, 0.6);
        }
      }
      this.kick(1.0, 0.965, 0.85);
      if (this.heart <= 0) this.oweHeart();
    }
  }

  /**
   * Put the finished sum in front of the child and leave it there.
   *
   * Accent colour, never red — `dynawalla/docs/EXPERIENCE_DESIGN.md`, and the
   * renderer draws it in `SectorTheme.horizon`. The hold comes from
   * `revealPlan`, whose `holdMs` is `Infinity` whenever there is a reveal at
   * all, so nothing in this file ever computes a deadline for it.
   */
  private showReveal(g: Gate): void {
    if (!g.q) return;
    const plan = revealPlan(SPLITBEAT_FLOW, this.intensity);
    if (plan.holdMs <= 0) return; // mastery: skip the ceremony
    this.reveal = { prompt: g.q.prompt, answer: g.q.answer, bornAt: this.eng.now, plan };
  }

  /** The child's own hand, once it has settled. See `Reveal`. */
  private dismissReveal(): void {
    const r = this.reveal;
    if (!r) return;
    if ((this.eng.now - r.bornAt) * 1000 < r.plan.settleMs) return;
    this.reveal = null;
  }

  /**
   * The gate closed and nobody struck a tile.
   *
   * This used to run the whole wrong path — charge −2, difficulty −0.22, and a
   * `report` of `{ correct: false, answered: "" }`. The `Host` this game mounts
   * against (dynawalla/packs/shared/game-host/index.ts) forwards `report`
   * straight to `items.answer` and *discards* the game's own `correct`, so an
   * empty response was filed as an attempt the child got wrong. Motor lateness
   * became indistinguishable from an arithmetic error, in the one record that
   * decides what a child is asked next.
   *
   * There is no way to say "unanswered" on that contract — `report` is the only
   * method the game-facing `Host` exposes, and the SDK's `items.skip` is not on
   * it. So the truthful move is silence, and the ladder does not move either: a
   * child who was still computing has told us nothing about what they know.
   *
   * The feedback stays. The mix muffles and the bell plays the correct
   * subdivision as a ghost rhythm — the game demonstrates the answer rather
   * than lecturing about it — but nothing is recorded and nothing is taken.
   */
  private expireGate(g: Gate): void {
    if (g.resolved) return;
    g.resolved = true;
    g.correct = false;
    g.answered = "";
    this.gatesExpired++;
    const t = this.eng.now;
    const spb = 60 / this.bpm;
    // The sum is completed in front of them all the same. Being still mid-thought
    // is the case where seeing it finished is worth the most.
    this.showReveal(g);
    // An unanswered gate cannot be the toll for the heart either — the child was
    // not refusing, they were computing — so the debt is forgiven and the heart
    // comes back. The alternative is a debt gate that expires into another debt
    // gate, which is the restart loop wearing a different hat.
    if (this.heartDebt) {
      this.clearDebt();
      this.heart = Math.max(this.heart, 0.6);
    }
    this.emit("gate-wrong", g.correctLane, null, true, 0.55);
    if (this.soundOn) {
      this.eng.muffle(spb * 4, 520);
      const dcells = g.cells ?? 4;
      const n = Math.min(dcells, 8);
      for (let i = 0; i < n; i++) {
        this.eng.bell(t + 0.35 + (i * spb * 4) / n, this.sector.root + 48, 0.4, 0.3, 0.6);
      }
    }
    this.kick(0.45, 0.99, 0.3);
  }

  private advanceSector(): void {
    this.sectorIdx = (this.sectorIdx + 1) % SECTORS.length;
    this.sectorFlash = 1;
    this.applyDifficulty();
    this.emit("sector", 1, null, true, 1);
    if (this.soundOn) {
      this.eng.impact(this.eng.now, 0.7);
      this.eng.riser(this.eng.now, 0.5, 0.6);
    }
  }

  /* ---------------------------------------------------------------- */
  /* the heart — the run never stops, and it never rewinds             */
  /* ---------------------------------------------------------------- */

  /**
   * The heart ran out. **Nothing restarts.**
   *
   * The founder, on what shipped:
   *
   *   "the problem on 'restart the heart' doesn't have enough contrast, I don't
   *    like that it 'restarts' .. 'restart the heart' an ok phrase but it
   *    shouldn't take you back to the beginning. … I think the misses can get
   *    counted that's fine and then you have to do math to go on .. but then it
   *    should just go on and adjust and vary itself as you go on. … when you
   *    have to do a math problem to go on it should flow with the regular game
   *    and not be a reset."
   *
   * `enterBreakdown` did every single thing he is describing: it set a `phase`
   * the transport refuses to plan in, called `flushNotes()` to delete every note
   * in flight, ran `tapeStop` on the mix, put a modal over the field with a
   * question drawn under a 72% black scrim, and — on the way out — called
   * `reanchorSoft()`, which re-seats the transport at "now" and starts the cycle
   * again. That is a reset, and a player who was struggling met it every fifteen
   * seconds.
   *
   * What happens instead, and the whole of it:
   *
   *   1. the music KEEPS PLAYING, in tempo, with every note in flight intact;
   *   2. a question is pulled forward so it arrives at the next reveal instead
   *      of at the end of the cycle — the toll, "you have to do math to go on";
   *   3. the world steps DOWN, because whatever it was doing was too much;
   *   4. the heart stops draining while the debt stands, so there is no spiral;
   *   5. answering — right OR wrong — clears the debt and the run continues from
   *      exactly where it was, evolved rather than rewound.
   *
   * The phrase survives. `RESTART THE HEART` is drawn over the ordinary gate as
   * a banner, on a field that never stopped moving.
   */
  private oweHeart(): void {
    if (this.heartDebt) return;
    this.heartDebt = true;
    this.heartOuts++;
    this.heart = 0;
    this.combo = 0;
    this.perfectRun = 0;

    // Step the world down hard and take the estimates with it, so the ease
    // survives the next few bars rather than being climbed straight back out of.
    this.intensity = clamp(this.intensity - 0.18, SPLITBEAT_FLOW.floor, SPLITBEAT_FLOW.ceiling);
    this.noteSuccess = Math.min(this.noteSuccess, SPLITBEAT_FLOW.strugglingBelow * 0.9);
    this.applyDifficulty();

    this.emit("heart-out", 1, null, true, 1);
    this.host.haptic("heavy");
    this.kick(0.9, 1.04, 0.7);
    // A filter sweep and a duck, NOT a tape stop: the groove is still there,
    // it has just gone underwater until the toll is paid.
    if (this.soundOn) this.eng.muffle(((60 / this.bpm) * 4) * 2, 420);

    this.pullGateForward();
  }

  /**
   * Bring the toll question to the front.
   *
   * If one is already on its way, THAT is the toll — it takes the banner and
   * nothing is rescheduled. Marking it matters: the flag used to be written
   * only at spawn, so a debt raised while a question was in flight was carried
   * by no gate at all, and `expireGate` (which cleared the debt only for a
   * flagged gate) then left `heartDebt` stuck true for the rest of the run.
   *
   * Otherwise the cycle is moved, not the transport: `roleOf` reads `bar -
   * cycleStartBar`, so seating the cycle start `grooveBars - 1` bars back makes
   * the next bar planned a reveal. No bar times move, no note is deleted, and
   * nothing already scheduled into the audio graph is disturbed.
   */
  private pullGateForward(): void {
    const g = this.activeGate;
    if (g && !g.resolved) {
      g.debt = true;
      return;
    }
    this.cycleStartBar = this.noteCursor - (this.grooveBars - 1);
  }

  private clearDebt(): void {
    if (!this.heartDebt) return;
    this.heartDebt = false;
    if (this.soundOn) this.eng.clearFilter(0.35);
  }

  /* ---------------------------------------------------------------- */
  /* input                                                             */
  /* ---------------------------------------------------------------- */

  laneFromKey(key: string): Lane | undefined {
    return KEY_LANE[key] ?? KEY_LANE[key.toLowerCase()];
  }

  /** `at` is an AudioContext-domain timestamp. */
  hit(lane: Lane, at: number): void {
    if (this.phase !== "playing") return;

    const t = this.judgeTime(at);
    if (t < this.laneLock[lane]!) return;

    let best: Note | null = null;
    let bestAbs = Infinity;
    for (const n of this.notes) {
      if (!n.active || n.state !== 0 || n.lane !== lane) continue;
      const d = t - n.time;
      const a = d < 0 ? -d : d;
      if (a < bestAbs) {
        bestAbs = a;
        best = n;
      }
    }

    if (best) {
      const w = windowsForNote(best);
      const delta = t - best.time;
      const v = verdictFor(delta, w);
      if (v && v !== "miss") {
        this.strike(best, v, delta);
        return;
      }
      if (v === "miss") {
        // Inside the outer window but outside "good": a real, cheap mistake.
        this.strike(best, "miss", delta);
        return;
      }
    }

    // Nothing there. Cheap, but it locks the lane briefly so mashing is not a
    // free win — that lock is what makes a wrong answer at a gate cost you.
    this.laneLock[lane] = t + 0.11;
    this.emit("ghost", lane, null, false, 0.4);
    if (this.soundOn) this.eng.tick(this.eng.now, 1);
  }

  private strike(n: Note, v: Verdict, delta: number): void {
    n.state = v === "miss" ? 2 : 1;
    n.verdict = v;
    n.delta = delta;
    n.hitAt = this.eng.now;
    this.lastDelta = delta;
    this.lastVerdict = v;
    this.lastJudgeAt = this.eng.now;

    // The child's hand is the only thing that takes a held sum down, and only
    // once it has settled. See `Reveal`.
    this.dismissReveal();

    if (n.isChoice) {
      const g = this.gates.find((x) => x.active && x.id === n.gateId);
      // Every choice tile in the row is spent the moment one is struck.
      for (const o of this.notes) if (o.active && o.isChoice && o.gateId === n.gateId && o !== n) o.state = 2;
      // Measured from `g.time` — the instant the tiles became strikeable —
      // and NOT from `g.revealAt`. See resolveGate.
      if (g) this.resolveGate(g, n.label, n.correct, (this.eng.now - g.time) * 1000);
      return;
    }

    if (v === "miss") {
      this.registerMiss(n, true);
      return;
    }

    this.notesHit++;
    this.combo++;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.perfectRun = v === "perfect" ? this.perfectRun + 1 : 0;
    this.noteEvidence(true);
    // Landing notes MENDS the heart. This is the half that was missing: the old
    // charge could only ever go down between gates, so a beginner's meter was a
    // countdown they had no way to stop.
    const before = this.heart;
    this.heart = clamp(this.heart + HEART_HIT, 0, 1);
    if (Math.ceil(before * MAX_CHARGE - 1e-9) < Math.ceil(this.heart * MAX_CHARGE - 1e-9)) {
      this.emit("charge-up", n.lane, v, true, 1);
      if (this.soundOn) this.eng.chirp(this.eng.now, 700, 1500, 0.2, 0.7);
    }
    this.score += VERDICT_SCORE[v] * multiplierFor(this.combo) * (n.accent ? 2 : 1);

    const t = this.eng.now;
    if (this.soundOn) {
      const power = v === "perfect" ? 1 : v === "great" ? 0.82 : 0.6;
      const g = power * (n.accent ? 1.15 : 1);
      // Pitch drifts a touch with the note's place in the bar so a 16-note run
      // reads as a phrase rather than a machine gun.
      const tune = 1 + ((n.cell / Math.max(1, n.cells)) - 0.5) * 0.06;
      if (n.lane === 0) this.eng.kick(t, g, tune);
      else if (n.lane === 1) this.eng.snare(t, g, tune);
      else this.eng.hat(t, g * 1.1, n.accent);
      if (v === "perfect" && n.accent) {
        this.eng.bell(t, this.sector.root + 48 + (n.cell % 5) * 2, 0.35, 0.35, 0.5);
      }
    }
    this.host.haptic(v === "perfect" ? "medium" : "light");
    this.emit("hit", n.lane, v, n.accent, v === "perfect" ? 1 : v === "great" ? 0.75 : 0.5);

    const mag = (v === "perfect" ? 1 : v === "great" ? 0.7 : 0.4) * (n.accent ? 1.5 : 1);
    this.kick(mag, 1 + 0.012 * mag, 0.16 * mag);
    this.fx.laneFlash[n.lane] = Math.min(1, this.fx.laneFlash[n.lane]! + 0.5 + mag * 0.5);
  }

  /**
   * A missed note is evidence, not just damage.
   *
   * The founder: *"If you keep sucking and losing then it should just get
   * easier/stay easy."* `adjustDifficulty` moved on a GATE outcome and nothing
   * else, so a player who never survived to reach a gate never received one
   * gram of relief — which is the exact population the complaint is about. Every
   * note, landed or not, now steers the controller.
   */
  private noteEvidence(landed: boolean): void {
    const k = 1 / NOTE_WINDOW;
    this.noteSuccess = clamp(this.noteSuccess + ((landed ? 1 : 0) - this.noteSuccess) * k, 0, 1);
  }

  private registerMiss(n: Note, struck: boolean): void {
    n.state = 2;
    this.notesMissed++;
    this.combo = 0;
    this.perfectRun = 0;
    this.noteEvidence(false);
    // While a question is owed the heart is already spent and is not taken
    // further: the toll is the question, not a spiral.
    if (!this.heartDebt) this.heart = clamp(this.heart - HEART_MISS, 0, 1);
    this.lastVerdict = "miss";
    this.lastJudgeAt = this.eng.now;
    this.emit("miss", n.lane, "miss", n.accent, struck ? 0.7 : 1);
    this.host.haptic("failure");
    if (this.soundOn) this.eng.thud(this.eng.now, struck ? 0.7 : 1);
    this.kick(0.7, 0.985, 0.5);
    this.fx.vignette = Math.min(1, this.fx.vignette + 0.55);
    if (this.heart <= 0) this.oweHeart();
  }

  /* ---------------------------------------------------------------- */
  /* frame                                                             */
  /* ---------------------------------------------------------------- */

  private kick(shake: number, zoom: number, chroma: number): void {
    if (this.reduced) {
      this.fx.flash = Math.min(0.35, this.fx.flash + shake * 0.12);
      return;
    }
    this.fx.shake = Math.min(2.2, this.fx.shake + shake);
    this.fx.shakeAngle = Math.random() * Math.PI * 2;
    this.fx.zoom = Math.max(this.fx.zoom, zoom);
    this.fx.chroma = Math.min(1.4, this.fx.chroma + chroma);
  }

  /** True hitstop, but only when it cannot desynchronise a note. */
  private requestHitstop(seconds: number): void {
    if (this.reduced) return;
    const now = this.eng.now;
    for (const n of this.notes) {
      if (n.active && n.state === 0 && n.time - now < 0.35) return;
    }
    this.fx.hitstopUntil = now + seconds;
  }

  /** Called once per rendered frame. `dt` is real seconds. */
  update(dt: number): void {
    const now = this.eng.now;
    const f = this.fx;
    const k = Math.min(1, dt * 60);

    f.shake *= Math.pow(0.0016, dt);
    f.chroma *= Math.pow(0.0006, dt);
    f.flash *= Math.pow(0.00005, dt);
    f.vignette *= Math.pow(0.06, dt);
    f.zoom += (1 - f.zoom) * Math.min(1, k * 0.22);
    for (let i = 0; i < 3; i++) f.laneFlash[i] = f.laneFlash[i]! * Math.pow(0.004, dt);
    if (this.sectorFlash > 0) this.sectorFlash = Math.max(0, this.sectorFlash - dt * 0.35);

    if (this.phase !== "playing") return;

    /**
     * The world moves toward what the evidence demands, every frame, in both
     * directions. This is the "continuous evolution" half of the founder's
     * note: nothing steps, nothing snaps, and a player who is struggling feels
     * the whole thing — tempo, subdivision, note count, and the maths the host
     * is asked for — breathe out together.
     *
     * Escalation is on ACHIEVEMENT, not the wall clock: `dt` only says how fast
     * to travel toward a target that comes entirely from what was played.
     */
    this.intensity = settle(SPLITBEAT_FLOW, this.intensity, this.steer, dt);
    this.flowDirty += dt;
    if (this.flowDirty >= 5) {
      this.flowDirty = 0;
      saveFlow({ intensity: this.intensity, gateSuccess: this.gateSuccess, noteSuccess: this.noteSuccess });
    }

    // Retire notes and register misses.
    for (const n of this.notes) {
      if (!n.active) continue;
      const w = windowsForNote(n);
      if (n.state === 0 && now - n.time > w.miss) {
        if (n.isChoice) {
          const g = this.gates.find((x) => x.active && x.id === n.gateId);
          n.state = 2;
          if (g && !g.resolved) {
            for (const o of this.notes) if (o.active && o.isChoice && o.gateId === n.gateId) o.state = 2;
            this.expireGate(g);
          }
        } else {
          this.registerMiss(n, false);
        }
      }
      if (now - n.time > 0.9) n.active = false;
    }

    for (const g of this.gates) {
      if (!g.active) continue;
      if (g.resolved) {
        if (g.correct) g.shatter = Math.min(1, g.shatter + dt * 2.2);
        else g.crack = Math.min(1, g.crack + dt * 2.2);
        if (now - g.time > 2.4) {
          g.active = false;
          if (this.activeGate === g) this.activeGate = null;
        }
      } else {
        g.crack = clamp(1 - (g.time - now) / 2.2, 0, 0.92);
      }
    }

    this.eng.setMusicGain(0.5 + layerFor(this.combo) * 0.05, 0.5);
  }

  get accuracy(): number {
    const total = this.notesHit + this.notesMissed;
    return total === 0 ? 1 : this.notesHit / total;
  }
}
