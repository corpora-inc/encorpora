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
 */

import { AudioEngine } from "../audio/engine.ts";
import { SECTORS, scheduleBar, cadence, type Sector } from "../audio/music.ts";
import type { Host, Question } from "../contract.ts";
import {
  grooveBar,
  polyBar,
  inhaleBar,
  subdivisionFor,
  type ChartNote,
  type Lane,
} from "./chart.ts";
import { layerFor, multiplierFor, verdictFor, windowsFor, VERDICT_SCORE, type Verdict } from "./judge.ts";

export type { Lane };

export const LANES = 3;
const NOTE_POOL = 320;
const BAR_RING = 64;
const NOTE_HORIZON = 3.4;
const AUDIO_HORIZON = 0.3;
const LEAD_IN = 0.45;
export const MAX_CHARGE = 5;

/**
 * The floor on how long a question is on screen before its answer has to be
 * struck, in seconds.
 *
 * The lead used to be a flat two bars — `revealT0 + spb * 8` — and `spb` comes
 * straight off `bpm`, which `applyDifficulty` raises with the difficulty. So
 * the reading window was `f(difficulty)` and it pointed the wrong way: getting
 * good sped the music up, and faster music gave a child LESS time to work out a
 * HARDER sum. At difficulty 1 that was 4.9 s; by difficulty 10 it was 3.2 s.
 *
 * `dynawalla/docs/EXPERIENCE_DESIGN.md`: "COMPREHENSION — not budgeted. The
 * child's time. Measured, never limited." A gate cannot be literally unlimited
 * — it is a bar of music — but the lead is now measured in seconds and the
 * inhale is stretched by however many bars it takes to cover them. Six seconds
 * is the p50 cadence target for two-digit-with-regrouping and the p90 for a
 * single-digit fact; at slow tempos a child gets more, never less.
 */
export const READ_SEC = 6;

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
  /** 0 pending, 1 struck, 2 missed */
  state: 0 | 1 | 2;
  verdict: Verdict | null;
  delta: number;
  bornAt: number;
  hitAt: number;
};

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
  /** 0..1 animation drivers, advanced by the renderer's clock */
  shatter: number;
  crack: number;
};

export type EventKind =
  | "hit"
  | "miss"
  | "ghost"
  | "gate-correct"
  | "gate-wrong"
  | "sector"
  | "breakdown"
  | "revive"
  | "charge-up";

export type GameEvent = {
  kind: EventKind;
  lane: Lane;
  verdict: Verdict | null;
  accent: boolean;
  strength: number;
};

export type Phase = "title" | "playing" | "breakdown" | "paused";

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
  charge = MAX_CHARGE;
  difficulty = 1;
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
  /** the revive question during a breakdown */
  reviveGate: Gate | null = null;

  cells = 4;
  accentEvery = 2;
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
  private started = false;

  constructor(host: Host) {
    this.host = host;
    this.eng = new AudioEngine();
    this.reduced = host.prefersReducedMotion();
    for (let i = 0; i < NOTE_POOL; i++) {
      this.notes.push({
        active: false, time: 0, lane: 0, accent: false, cell: 0, cells: 4, spacing: 0.5,
        isChoice: false, gateId: -1, label: "", correct: false, state: 0, verdict: null,
        delta: 0, bornAt: 0, hitAt: 0,
      });
    }
    for (let i = 0; i < 6; i++) {
      this.gates.push({
        id: -1, active: false, q: null, time: 0, revealAt: 0, resolved: false, correct: false,
        answered: "", labels: ["", "", ""], correctLane: 0, cells: null, accentEvery: 2,
        shatter: 0, crack: 0,
      });
    }
    for (let i = 0; i < 64; i++) {
      this.events.push({ kind: "hit", lane: 0, verdict: null, accent: false, strength: 1 });
    }
    for (let i = 0; i < 24; i++) this.barGrid.push({ t: -99, dur: 2, cells: 4, playEvery: 1 });
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
    this.cycleStartBar = 0;
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
    this.grooveBars = d < 3 ? 6 : d < 6 ? 5 : 4;
    // Bars get shorter as the tempo climbs, so the inhale gets longer to hold
    // the reading window at or above READ_SEC. The lead is [reveal][inhale × n],
    // so n bars of inhale buy (1 + n) bars of reading. Sparseness and time, not
    // less feedback: an inhale bar is the sparsest bar the game plays.
    const barDur = (60 / this.bpm) * 4;
    this.inhaleBars = Math.max(1, Math.ceil(READ_SEC / barDur) - 1);
    this.eng.setDelayTime((60 / this.bpm) * 0.75);
  }

  private get maxCells(): number {
    const d = this.difficulty;
    return d < 3 ? 8 : d < 6 ? 12 : 16;
  }

  private get density(): number {
    return clamp(0.2 + this.difficulty * 0.075, 0.2, 0.95);
  }

  private adjustDifficulty(delta: number): void {
    this.difficulty = clamp(this.difficulty + delta, 1, 10);
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
    let cells = clamp(this.cells, 2, this.maxCells);
    let playEvery = 1;
    let showcase = false;

    if (role === "inhale" || role === "gate" || role === "aftermath") {
      list = inhaleBar(this.scratch);
      cells = 4;
      if (role === "gate") list.length = 0;
      if (role === "aftermath") list.length = 0;
    } else if (role === "payoff") {
      const g = this.activeGate;
      showcase = true;
      if (g && g.correct && g.cells) {
        cells = g.cells;
        this.accentEvery = g.accentEvery;
        if (cells > this.maxCells) playEvery = Math.ceil(cells / this.maxCells);
      } else {
        cells = clamp(this.cells, 2, this.maxCells);
      }
      list = grooveBar(
        { bar, cells, accentEvery: this.accentEvery, density: 1, difficulty: this.difficulty, showcase: true },
        this.scratch,
      );
      if (playEvery > 1) list = list.filter((n) => n.cell % playEvery === 0);
    } else if (this.difficulty >= 6 && (bar * 7919) % 4 === 0) {
      list = polyBar(bar, this.scratch);
      cells = 12;
    } else {
      list = grooveBar(
        {
          bar,
          cells,
          accentEvery: this.accentEvery,
          density: this.density,
          difficulty: this.difficulty,
          showcase: false,
        },
        this.scratch,
      );
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
      n.state = 0;
      n.verdict = null;
      n.bornAt = this.eng.now;
      n.hitAt = 0;
    }

    if (role === "reveal") this.spawnGate(t0, spb);
    if (role === "gate") this.placeChoiceNotes(t0, spb);
    if (showcase && this.activeGate?.correct && this.activeGate.cells) {
      this.cells = clamp(this.activeGate.cells, 2, this.maxCells);
    }

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
    g.revealAt = revealT0;
    // [reveal][inhale × cycleInhale][gate] — as many inhale bars as it takes for
    // the lead to cover READ_SEC seconds. See READ_SEC.
    g.time = revealT0 + spb * 4 * (1 + this.cycleInhale);
    g.resolved = false;
    g.correct = false;
    g.answered = "";
    g.shatter = 0;
    g.crack = 0;

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
    // The bar we are actually planning is authoritative for the strike time.
    g.time = t0;
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

    if (correct) {
      this.gatesCorrect++;
      const bonus = g.cells ? 400 + g.cells * 60 : 400;
      this.score += bonus * multiplierFor(this.combo);
      this.charge = Math.min(MAX_CHARGE, this.charge + 1);
      this.adjustDifficulty(0.34);
      this.emit("gate-correct", g.correctLane, null, true, 1);
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
      this.charge -= 2;
      this.combo = 0;
      this.perfectRun = 0;
      this.adjustDifficulty(-0.22);
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
      if (this.charge <= 0) this.enterBreakdown();
    }
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
  /* breakdown / revive — the run never ends                           */
  /* ---------------------------------------------------------------- */

  private enterBreakdown(): void {
    this.phase = "breakdown";
    this.charge = 0;
    this.combo = 0;
    this.flushNotes();
    if (this.soundOn) this.eng.tapeStop(0.9);
    this.host.haptic("heavy");
    this.emit("breakdown", 1, null, true, 1);
    this.kick(1.0, 1.06, 1);

    const q = this.host.next({ difficulty: Math.max(1, Math.round(this.difficulty - 2)) });
    const g = this.takeGate();
    g.id = ++this.gateSeq;
    g.active = true;
    g.q = q;
    g.time = 0;
    g.revealAt = this.eng.now;
    g.resolved = false;
    g.correct = false;
    g.answered = "";
    g.shatter = 0;
    g.crack = 0;
    const sub = subdivisionFor(q.answer);
    g.cells = sub ? sub.cells : null;
    g.accentEvery = sub ? sub.accentEvery : 2;
    const wrong = q.distractors.filter((d) => d !== q.answer).slice(0, 2);
    while (wrong.length < 2) wrong.push(String(wrong.length + 1));
    const lane = (this.gateSeq * 5) % 3 as Lane;
    const labels: [string, string, string] = ["", "", ""];
    labels[lane] = q.answer;
    let w = 0;
    for (let i = 0; i < 3; i++) if (i !== lane) labels[i] = wrong[w++]!;
    g.labels = labels;
    g.correctLane = lane;
    this.reviveGate = g;
  }

  private answerRevive(lane: Lane): void {
    const g = this.reviveGate;
    if (!g || g.resolved) return;
    const correct = lane === g.correctLane;
    const ms = (this.eng.now - g.revealAt) * 1000;
    g.resolved = true;
    g.correct = correct;
    g.answered = g.labels[lane]!;
    this.gatesTotal++;
    if (g.q) this.host.report({ questionId: g.q.id, correct, ms: Math.round(ms), answered: g.answered });

    const t = this.eng.now;
    if (correct) {
      this.gatesCorrect++;
      this.charge = MAX_CHARGE;
      this.score += 800;
      this.emit("revive", lane, null, true, 1);
      this.host.haptic("success");
      if (this.soundOn) {
        this.eng.clearFilter(0.35);
        this.eng.shatter(t, 1, 16);
        this.eng.riser(t, 0.45, 1);
        cadence(this.eng, t + 0.1, 60 / this.bpm, this.sector, true);
      }
      this.kick(1, 1.08, 0.9);
    } else {
      this.charge = 3;
      this.adjustDifficulty(-1.6);
      this.emit("gate-wrong", g.correctLane, null, true, 1);
      this.host.haptic("failure");
      if (this.soundOn) {
        this.eng.clearFilter(0.6);
        this.eng.impact(t, 0.8);
        const dcells = g.cells ?? 4;
        const spb = 60 / this.bpm;
        for (let i = 0; i < Math.min(dcells, 8); i++) {
          this.eng.bell(t + 0.3 + (i * spb * 4) / Math.min(dcells, 8), this.sector.root + 48, 0.45, 0.4, 0.6);
        }
      }
      this.kick(1, 0.95, 0.7);
    }
    this.reviveGate = null;
    this.activeGate = null;
    this.phase = "playing";
    this.applyDifficulty();
    this.cells = clamp(this.cells, 2, this.maxCells);
    this.reanchorSoft();
  }

  /* ---------------------------------------------------------------- */
  /* input                                                             */
  /* ---------------------------------------------------------------- */

  laneFromKey(key: string): Lane | undefined {
    return KEY_LANE[key] ?? KEY_LANE[key.toLowerCase()];
  }

  /** `at` is an AudioContext-domain timestamp. */
  hit(lane: Lane, at: number): void {
    if (this.phase === "breakdown") {
      this.answerRevive(lane);
      return;
    }
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
      const w = windowsFor(best.spacing);
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
    if (this.perfectRun > 0 && this.perfectRun % 12 === 0 && this.charge < MAX_CHARGE) {
      this.charge++;
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

  private registerMiss(n: Note, struck: boolean): void {
    n.state = 2;
    this.notesMissed++;
    this.combo = 0;
    this.perfectRun = 0;
    this.charge -= 1;
    this.lastVerdict = "miss";
    this.lastJudgeAt = this.eng.now;
    this.emit("miss", n.lane, "miss", n.accent, struck ? 0.7 : 1);
    this.host.haptic("failure");
    if (this.soundOn) this.eng.thud(this.eng.now, struck ? 0.7 : 1);
    this.kick(0.7, 0.985, 0.5);
    this.fx.vignette = Math.min(1, this.fx.vignette + 0.55);
    if (this.charge <= 0) this.enterBreakdown();
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

    // Retire notes and register misses.
    for (const n of this.notes) {
      if (!n.active) continue;
      const w = windowsFor(n.spacing);
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
