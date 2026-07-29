/**
 * The run: the thing that is actually happening.
 *
 * Owns the transport, the chart, the judge, the gates and the mix. Draws nothing —
 * every visible consequence is announced through `Fx` so the renderer and the juice
 * layer stay replaceable and this file stays testable.
 *
 * Two clocks, and the distinction matters:
 *   - `engine.now()` is when a sound will be *scheduled*.
 *   - `heard()` is `now() - outputLatency`: what the player is hearing this instant.
 * Notes are drawn against `heard()` and input is timestamped against `heard()`, so
 * the picture, the sound and the judgment agree even on a laptop with 40 ms of
 * Bluetooth latency.
 */

import type { Host } from "../contract.ts";
import { createEngine, type Engine } from "../audio/engine.ts";
import { createVoices, type Voices } from "../audio/voices.ts";
import { Lookahead, Timeline } from "../audio/scheduler.ts";
import {
  BASS_PATTERNS,
  chordAt,
  chordFreqs,
  comboNote,
  hz,
  LAYER_ORDER,
  PENTATONIC,
  type LayerId,
} from "../audio/music.ts";
import { barNotes, BEATS_PER_BAR, laneVoices, type ChartNote } from "./chart.ts";
import { buildGate, DEFAULT_FIT, type BuiltGate } from "./gate.ts";
import { classify, multiplierFor, NoteQueue, WINDOWS, type Judgment, type LiveNote } from "./judge.ts";
import { gatesToClear, stageAt, type StageSpec } from "./stages.ts";
import { makeRng, hashSeed, type Rng } from "../rng.ts";

export type GateOutcome = "correct" | "wrong" | "expired";

export type Fx = {
  hit(note: LiveNote, judgment: Judgment, delta: number, combo: number): void;
  miss(note: LiveNote): void;
  stray(lane: number): void;
  gateOpen(gate: BuiltGate): void;
  gateResolved(outcome: GateOutcome, note: LiveNote | null, gate: BuiltGate): void;
  bar(bar: number, downbeatTime: number): void;
  stageChanged(stage: StageSpec, index: number): void;
  drop(): void;
  stumble(): void;
  overdrive(on: boolean): void;
  layerEarned(layer: LayerId): void;
};

export type RunOptions = {
  host: Host;
  fx: Fx;
  seed?: string;
  /** Extra input offset in ms. Positive = the player's taps are treated as earlier. */
  calibrationMs?: number;
  onCalibrationChange?: (ms: number) => void;
  /** Start partway up the escalation. For QA and for showing someone the top end. */
  startStage?: number;
};

/**
 * The floor on how long a fraction question is on screen before its answer
 * crosses the strike line, in seconds.
 *
 * The gate window used to be one bar plus whatever the lookahead happened to
 * be, and the lookahead is a multiple of the bar — so the reading window was
 * `f(BPM)`, and BPM is this game's difficulty knob. Getting good made the
 * music faster, and faster music gave a child *less* time to work out a harder
 * sum. That is the coupling `dynawalla/docs/EXPERIENCE_DESIGN.md` forbids:
 * "COMPREHENSION — not budgeted. The child's time. Measured, never limited."
 *
 * Six seconds is the p50 cadence target for two-digit-with-regrouping and the
 * p90 for a single-digit fact. It is a floor, not a cap: at slow tempos the
 * bar is longer and the child gets more. Nothing about it moves with the
 * tempo, which is the entire point.
 */
export const GATE_READ_SEC = 6;

const HEALTH = {
  miss: -0.05,
  strayBurst: -0.02,
  perfect: 0.014,
  great: 0.007,
  gateCorrect: 0.16,
  gateWrong: -0.19,
  gateExpired: -0.05,
};

export type ActiveGate = {
  built: BuiltGate;
  bar: number;
  /**
   * Audio time of the first instant a candidate could be struck — the start of
   * the gate bar. NOT when the question appeared: see `resolveGate`.
   */
  strikeableAt: number;
  resolved: boolean;
};

export class Run {
  readonly engine: Engine;
  readonly voices: Voices;
  readonly timeline: Timeline;
  readonly notes = new NoteQueue();
  private readonly look: Lookahead;
  private readonly host: Host;
  private readonly fx: Fx;
  private readonly rng: Rng;
  readonly seed: string;

  stageIndex = 0;
  stage: StageSpec = stageAt(0);
  private stageStartBar = 0;

  score = 0;
  combo = 0;
  bestCombo = 0;
  health = 1;
  hits = 0;
  perfects = 0;
  misses = 0;
  gatesCorrect = 0;
  gatesSeen = 0;
  /** Gates cleared IN THE CURRENT STAGE. This, not the bar count, passes it. */
  stageGatesCorrect = 0;

  layers = new Set<LayerId>(["bass"]);
  gate: ActiveGate | null = null;
  gateStreak = 0;
  overdriveUntilBar = -1;
  bar = 0;
  running = false;

  /** Rolling timing error, used for silent auto-calibration. */
  private deltas: number[] = [];
  calibrationMs: number;
  private readonly onCalibrationChange: ((ms: number) => void) | undefined;
  private strayTimes: number[] = [];
  private lastReapTime = 0;

  constructor(o: RunOptions) {
    this.host = o.host;
    this.fx = o.fx;
    this.seed = o.seed ?? `pulse-${Date.now().toString(36)}`;
    this.rng = makeRng(hashSeed(this.seed));
    this.calibrationMs = o.calibrationMs ?? 0;
    this.onCalibrationChange = o.onCalibrationChange;
    if (o.startStage) {
      this.stageIndex = Math.max(0, Math.floor(o.startStage));
      this.stage = stageAt(this.stageIndex);
      (this.host as Host & { setFloor?: (d: number) => void }).setFloor?.(this.stage.gateFloor);
    }
    this.engine = createEngine();
    this.voices = createVoices(this.engine);
    this.timeline = new Timeline(this.engine.now() + 0.4, this.stage.bpm, BEATS_PER_BAR);
    this.look = new Lookahead(
      () => this.engine.now(),
      this.timeline,
      (bar, t) => this.fillBar(bar, t),
      {
        // One bar of future for the playfield, plus a floor that does not move
        // with the tempo so a gate is always readable for GATE_READ_SEC before
        // its answer arrives. See GATE_READ_SEC.
        lookaheadSec: () => Math.max(this.barSeconds() * 1.2 + 0.25, GATE_READ_SEC),
      },
    );
  }

  barSeconds(): number {
    return this.timeline.spbAtBeat(this.timeline.beatOfBar(this.bar)) * BEATS_PER_BAR;
  }

  /** Audio time of the sound reaching the player's ears right now. */
  heard(): number {
    return this.engine.now() - this.engine.latency();
  }

  nowBeat(): number {
    return this.timeline.beatAt(this.heard());
  }

  /**
   * Synchronous by design. An earlier version awaited `engine.resume()` first, and on
   * a page where autoplay never unlocked, that promise simply never settled — the HUD
   * drew, the stage name sat there, and not one note was ever scheduled. Nothing that
   * makes the game exist may sit behind a promise the platform is allowed to ignore.
   * Resume is fired and forgotten; a suspended context freezes `currentTime`, so the
   * transport is still correctly anchored whenever the audio does come up.
   */
  start(): void {
    void this.engine.resume();
    const t0 = this.engine.now() + 0.35;
    this.timeline.setTempoAtBeat(0, this.stage.bpm);
    (this.timeline as unknown as { segs: { beat0: number; time0: number; spb: number }[] }).segs = [
      { beat0: 0, time0: t0 + (60 / this.stage.bpm) * BEATS_PER_BAR, spb: 60 / this.stage.bpm },
    ];
    // A one-bar count-in: four clicks, so the tempo is in the body before bar 0.
    for (let b = -BEATS_PER_BAR; b < 0; b++) {
      const t = this.timeline.timeAt(b);
      this.voices.hat(t, b === -BEATS_PER_BAR ? 1 : 0.55);
      if (b === -BEATS_PER_BAR) this.voices.blip(t, 660, 0.7);
    }
    this.running = true;
    this.look.start(0);
    this.fx.stageChanged(this.stage, 0);
  }

  stop(): void {
    this.running = false;
    this.look.stop();
  }

  dispose(): void {
    this.stop();
    this.engine.dispose();
  }

  // ---------------------------------------------------------------- scheduling

  isGateBar(bar: number): boolean {
    const into = bar - this.stageStartBar;
    if (into <= 2) return false;
    return (into + 1) % this.stage.gateEvery === 0;
  }

  private fillBar(bar: number, t: number): void {
    this.bar = bar;
    const beat0 = this.timeline.beatOfBar(bar);

    // --- Stage advance lands on the bar line, tempo and all — but only once
    // the child has actually cleared the stage. Bars are how a stage is paced;
    // right answers are how it is passed. A stage whose gates are still being
    // missed simply comes round again, with more gates on it.
    if (
      bar > 0 &&
      bar - this.stageStartBar >= this.stage.bars &&
      this.stageGatesCorrect >= gatesToClear(this.stage)
    ) {
      this.setStage(this.stageIndex + 1, beat0);
    }

    const spb = this.timeline.spbAtBeat(beat0);
    const chord = chordAt(bar);
    const overdrive = bar <= this.overdriveUntilBar;

    this.fx.bar(bar, t);

    // --- Backing: the band that keeps playing whatever the player does.
    this.scheduleBacking(bar, t, spb, overdrive);

    if (this.isGateBar(bar)) {
      this.scheduleGateBar(bar, t, spb);
      return;
    }

    // --- A riser into the next bar when it is a gate: the drop is announced.
    if (this.isGateBar(bar + 1)) {
      this.voices.riser(t + spb * (BEATS_PER_BAR - 2), spb * 2, 0.85);
    }

    // --- Phrase punctuation.
    if (bar % 4 === 0) {
      if (this.layers.has("pad")) {
        this.voices.chord(t, chordFreqs(chord, 2), spb * BEATS_PER_BAR * 0.95, overdrive ? 1.1 : 0.8);
      }
      if (bar % 16 === 0 && bar > 0) {
        this.voices.impact(t, 0.85);
        this.fx.drop();
      }
    }

    // --- Player notes.
    for (const n of barNotes(this.stage, this.seed, bar)) {
      const beat = beat0 + n.beatInBar;
      this.notes.add({
        time: this.timeline.timeAt(beat),
        beat,
        lane: n.lane,
        div: n.div,
        kind: n.kind,
        accent: n.accent,
      });
    }
  }

  private scheduleBacking(bar: number, t: number, spb: number, overdrive: boolean): void {
    const chord = chordAt(bar);
    const root = hz(chord.root + 24);
    const tier = Math.min(BASS_PATTERNS.length - 1, Math.floor(this.stageIndex / 2));
    if (this.layers.has("bass")) {
      for (const b of BASS_PATTERNS[tier]!) {
        this.voices.bass(t + b * spb, root / 2, spb * 0.62, overdrive ? 1.15 : 1);
      }
    }
    if (this.layers.has("shaker")) {
      for (let k = 0; k < BEATS_PER_BAR * 2; k++) {
        if (k % 2 === 0) continue;
        this.voices.hat(t + (k / 2) * spb, 0.34, false);
      }
    }
    if (this.layers.has("arp")) {
      const seq = PENTATONIC;
      for (let k = 0; k < BEATS_PER_BAR * 2; k++) {
        if ((k + bar) % 3 !== 0) continue;
        const semi = chord.root + seq[(k + bar) % seq.length]! + 36;
        this.voices.pluck(t + (k / 2) * spb, hz(semi), 0.3, 1.4);
      }
    }
  }

  private scheduleGateBar(bar: number, t: number, spb: number): void {
    // The band takes over so the groove never thins while the player thinks.
    for (let b = 0; b < BEATS_PER_BAR; b++) {
      const bt = t + b * spb;
      if (b % 2 === 0) this.voices.kick(bt, 0.8);
      else this.voices.clap(bt, 0.7);
      this.voices.hat(bt + spb * 0.5, 0.3, false);
    }

    // One gate at a time, deliberately rather than by luck. The reading-window
    // floor made the lookahead longer than `gateEvery` bars at the top of the
    // endless loop (a gate every 5 bars at 168 BPM is 7.1 s, against a 6 s
    // horizon plus the 0.17 s expiry window), so this bar can be filled while
    // the previous gate is still unresolved. Overwriting the slot would leave
    // its candidates strikeable: a stale tap would then resolve the question
    // being served RIGHT NOW and mark every one of its candidates spent, so
    // that question could never be answered and never be reported.
    const stale = this.gate;
    if (stale && !stale.resolved) {
      stale.resolved = true;
      this.gateStreak = 0;
      this.health = Math.max(0, this.health + HEALTH.gateExpired);
      for (const n of this.notes.gateNotes()) n.judged = "miss";
      this.fx.gateResolved("expired", null, stale.built);
      // No `checkStumble()` here on purpose: it can step the stage down and
      // cancel notes, and this runs INSIDE the fill of the bar it would be
      // cancelling. The next miss or gate in `update` reaches it a beat later.
    }

    const q = this.host.next();
    const built = buildGate(q, this.rng, { ...DEFAULT_FIT, maxCandidates: 4 });
    this.gatesSeen++;
    const beat0 = this.timeline.beatOfBar(bar);
    for (const c of built.candidates) {
      const beat = beat0 + c.pos * BEATS_PER_BAR;
      this.notes.add({
        time: this.timeline.timeAt(beat),
        beat,
        lane: Math.floor((this.stage.lanes - 1) / 2),
        div: 0,
        kind: "tom",
        accent: c.correct,
        gate: { questionId: q.id, label: c.label, correct: c.correct, pos: c.pos },
      });
    }
    this.gate = {
      built,
      bar,
      strikeableAt: this.timeline.timeAt(beat0),
      resolved: false,
    };
    this.fx.gateOpen(built);
  }

  private setStage(index: number, atBeat: number): void {
    this.stageIndex = Math.max(0, index);
    this.stage = stageAt(this.stageIndex);
    this.stageStartBar = this.timeline.barOfBeat(atBeat);
    this.stageGatesCorrect = 0;
    this.timeline.setTempoAtBeat(atBeat, this.stage.bpm);
    const anyHost = this.host as Host & { setFloor?: (d: number) => void };
    anyHost.setFloor?.(this.stage.gateFloor);
    this.fx.stageChanged(this.stage, this.stageIndex);
  }

  // -------------------------------------------------------------------- input

  /**
   * @param lane   lane index the player struck
   * @param perfMs `performance.now()` of the input event
   */
  input(lane: number, perfMs: number): void {
    if (!this.running) return;
    // Any input is a gesture; if the platform is still holding audio hostage, this is
    // the moment it stops.
    if (this.engine.ctx.state !== "running") void this.engine.resume();
    const tHit = this.perfToHeard(perfMs);
    // A gate candidate may be struck from ANY lane — its position in the bar is
    // its value, and which lane your thumb was over is not part of the answer.
    // That licence lasts exactly as long as a candidate is strikeable, not for
    // the whole time the question is on screen: with a tempo-independent
    // reading window the question is up for seconds, and lane discipline has to
    // survive it.
    const gateActive = this.notes
      .gateNotes()
      .some((n) => Math.abs(n.time - tHit) <= WINDOWS.good);
    const res = this.notes.hit(lane, tHit, gateActive);
    if (!res) {
      this.onStray(lane, tHit);
      return;
    }
    const { note, delta, judgment } = res;
    if (note.gate) this.resolveGate(note, judgment, delta);
    else this.onHit(note, judgment, delta);
  }

  private perfToHeard(perfMs: number): number {
    const offset = this.engine.now() - performance.now() / 1000;
    return perfMs / 1000 + offset - this.engine.latency() - this.calibrationMs / 1000;
  }

  private onHit(note: LiveNote, judgment: Judgment, delta: number): void {
    this.hits++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = this.multiplier();
    const base = judgment === "perfect" ? 100 : judgment === "great" ? 60 : 30;
    this.score += base * mult;
    if (judgment === "perfect") {
      this.perfects++;
      this.health = Math.min(1, this.health + HEALTH.perfect);
    } else if (judgment === "great") {
      this.health = Math.min(1, this.health + HEALTH.great);
    }
    this.recordDelta(delta, judgment);

    const t = this.engine.now() + 0.002;
    const gain = note.accent ? 1.15 : 0.95;
    if (note.kind === "kick") this.voices.kick(t, gain);
    else if (note.kind === "snare") this.voices.snare(t, gain);
    else if (note.kind === "hat") this.voices.hat(t, gain, note.accent);
    else this.voices.tom(t, 180 - note.lane * 34, gain);
    this.voices.pluck(
      t,
      comboNote(this.combo),
      judgment === "perfect" ? 1 : 0.7,
      judgment === "perfect" ? 1.5 : 1,
    );
    this.fx.hit(note, judgment, delta, this.combo);
  }

  private onStray(lane: number, t: number): void {
    this.voices.hat(this.engine.now() + 0.002, 0.12, false);
    this.strayTimes.push(t);
    this.strayTimes = this.strayTimes.filter((s) => t - s < 1.2);
    if (this.strayTimes.length > 4) {
      this.health = Math.max(0, this.health + HEALTH.strayBurst);
      this.checkStumble();
    }
    this.fx.stray(lane);
  }

  private resolveGate(note: LiveNote, judgment: Judgment, delta: number): void {
    const g = this.gate;
    if (!g || g.resolved) return;
    const info = note.gate!;
    g.resolved = true;
    /**
     * How long the CHILD took, measured from the first instant they could have
     * answered — not from when the question appeared.
     *
     * A candidate cannot be struck before it reaches the strike line, so the
     * `GATE_READ_SEC`-plus seconds before the gate bar are the game's wait, not
     * the child's thinking. Reporting them was reporting a property of the
     * tempo. It also put every single correct answer over the host's fluency
     * threshold — `dynawalla-app/src/packs/items.ts` climbs the arithmetic
     * ladder only on `correct && latencyMs <= 6000` — so a child answering
     * every gate right would have been pinned to the easiest rung forever,
     * which is the exact failure this game was just fixed for having.
     *
     * What is left is honest and small: how far past the first opportunity the
     * strike landed. In a game whose commit moment is set by the music, that is
     * the only part of the interval a child owns.
     */
    const ms = Math.max(1, Math.round((note.time + delta - g.strikeableAt) * 1000));
    this.host.report({
      questionId: info.questionId,
      correct: info.correct,
      ms,
      answered: info.label,
    });

    if (info.correct) {
      this.gatesCorrect++;
      this.stageGatesCorrect++;
      this.gateStreak++;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const bonus = judgment === "perfect" ? 1200 : judgment === "great" ? 900 : 700;
      this.score += bonus * this.multiplier();
      this.health = Math.min(1, this.health + HEALTH.gateCorrect);
      this.earnLayer();
      const t = this.engine.now() + 0.002;
      this.voices.impact(t, 0.75);
      this.voices.chord(t, chordFreqs(chordAt(this.bar), 3), this.barSeconds() * 0.6, 1);
      this.voices.pluck(t, comboNote(this.combo + 4), 1.1, 1.7);
      this.host.haptic(judgment === "perfect" ? "success" : "medium");
      if (this.gateStreak > 0 && this.gateStreak % 4 === 0) {
        this.overdriveUntilBar = this.bar + 8;
        this.fx.overdrive(true);
        this.voices.riser(t, 0.5, 1);
      }
      this.fx.gateResolved("correct", note, g.built);
    } else {
      this.gateStreak = 0;
      this.combo = 0;
      this.health = Math.max(0, this.health + HEALTH.gateWrong);
      this.duck(this.barSeconds() * 0.9);
      this.voices.stumble(this.engine.now() + 0.002);
      this.host.haptic("failure");
      this.fx.gateResolved("wrong", note, g.built);
      this.checkStumble();
    }
    // The unchosen candidates stop being targets the moment one is struck.
    for (const n of this.notes.gateNotes()) if (n !== note) n.judged = "miss";
  }

  private earnLayer(): void {
    for (const l of LAYER_ORDER) {
      if (!this.layers.has(l)) {
        this.layers.add(l);
        this.fx.layerEarned(l);
        return;
      }
    }
  }

  private loseLayer(): void {
    for (let i = LAYER_ORDER.length - 1; i >= 0; i--) {
      const l = LAYER_ORDER[i]!;
      if (l !== "bass" && this.layers.has(l)) {
        this.layers.delete(l);
        return;
      }
    }
  }

  /** The failure sound: the whole mix goes underwater for a moment. */
  private duck(seconds: number): void {
    const t = this.engine.now();
    const f = this.engine.colour.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(400, f.value), t);
    f.exponentialRampToValueAtTime(380, t + 0.06);
    f.exponentialRampToValueAtTime(20000, t + Math.max(0.35, seconds));
  }

  private checkStumble(): void {
    if (this.health > 0.0001) return;
    // No game over, ever. The music falls apart and the stage steps back.
    this.health = 0.62;
    this.combo = 0;
    this.gateStreak = 0;
    this.overdriveUntilBar = -1;
    this.loseLayer();
    this.duck(1.6);
    this.voices.stumble(this.engine.now() + 0.002, 1.2);
    this.host.haptic("heavy");
    if (this.stageIndex > 0) {
      const nextBarBeat = this.timeline.beatOfBar(this.bar + 1);
      this.setStage(this.stageIndex - 1, nextBarBeat);
      this.notes.cancelAfter(this.timeline.timeAt(nextBarBeat));
    }
    this.fx.stumble();
  }

  /**
   * Whether the gate bar is close enough that the playfield should get out of
   * the way. Separate from `gate` being set, because the question now appears
   * seconds ahead of the bar it lands on and the field must not sit dimmed for
   * all of it.
   */
  gateImminent(): boolean {
    const g = this.gate;
    if (!g || g.resolved) return false;
    const start = this.timeline.timeAt(this.timeline.beatOfBar(g.bar));
    return this.heard() > start - this.barSeconds();
  }

  multiplier(): number {
    const m = multiplierFor(this.combo);
    return this.bar <= this.overdriveUntilBar ? m * 2 : m;
  }

  overdriveActive(): boolean {
    return this.bar <= this.overdriveUntilBar && this.overdriveUntilBar >= 0;
  }

  // ------------------------------------------------------------------- update

  /** Call once per rendered frame. */
  update(): void {
    if (!this.running) return;
    const t = this.heard();
    if (t <= this.lastReapTime) return;
    /**
     * A frame gap the player could not have played through (a tab switch, a long
     * hitch) is not a performance. Sweep those notes off the board without scoring
     * them: being punished for a stall the game caused is the fastest way to make a
     * child stop trusting it.
     */
    const stalled = t - this.lastReapTime > 0.6;
    this.lastReapTime = t;
    if (stalled) {
      this.notes.reap(t);
      this.combo = 0;
      this.look.pump();
      return;
    }

    for (const n of this.notes.reap(t)) {
      if (n.gate) continue; // gate expiry is handled as a unit below
      this.misses++;
      this.combo = 0;
      this.health = Math.max(0, this.health + HEALTH.miss);
      this.voices.thud(this.engine.now() + 0.002, 0.55);
      this.fx.miss(n);
      this.checkStumble();
    }

    const g = this.gate;
    if (g && !g.resolved) {
      const lastBeat = this.timeline.beatOfBar(g.bar) + BEATS_PER_BAR;
      if (t > this.timeline.timeAt(lastBeat) + WINDOWS.good) {
        g.resolved = true;
        this.gateStreak = 0;
        this.health = Math.max(0, this.health + HEALTH.gateExpired);
        // Nothing is reported. Nobody struck a candidate, so there is no
        // response to file; the old code filed an empty one marked incorrect,
        // which recorded a child who was still working as a child who cannot do
        // the sum. The `Host` this game mounts against
        // (dynawalla/packs/shared/game-host/index.ts) forwards `report` straight
        // to `items.answer` and drops the game's own `correct` — so an empty
        // `answered` IS a wrong attempt in the learner's record. Silence is the
        // only truthful option the contract offers.
        this.duck(0.5);
        this.fx.gateResolved("expired", null, g.built);
        this.checkStumble();
      }
    }
    if (this.gate && this.gate.resolved && t > this.timeline.timeAt(this.timeline.beatOfBar(this.gate.bar) + BEATS_PER_BAR) + 0.4) {
      this.gate = null;
    }
    if (this.overdriveUntilBar >= 0 && this.bar > this.overdriveUntilBar) {
      this.overdriveUntilBar = -1;
      this.fx.overdrive(false);
    }
    this.notes.prune(t);
    this.look.pump();
  }

  // -------------------------------------------------------------- calibration

  /**
   * Silent auto-calibration. A tablet over Bluetooth can sit 120 ms behind and no
   * child will ever find a settings screen to fix it, so once there is real evidence
   * of a consistent bias we absorb most of it. Bounded, gradual, and it only ever
   * looks at hits the player already landed.
   */
  private recordDelta(delta: number, judgment: Judgment): void {
    if (judgment === "good" || judgment === "great" || judgment === "perfect") {
      this.deltas.push(delta * 1000);
      if (this.deltas.length > 32) this.deltas.shift();
    }
    if (this.deltas.length < 16) return;
    const sorted = [...this.deltas].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    if (Math.abs(median) < 25) return;
    const next = Math.max(-140, Math.min(140, this.calibrationMs + median * 0.5));
    if (Math.abs(next - this.calibrationMs) < 1) return;
    this.calibrationMs = next;
    this.deltas = [];
    this.onCalibrationChange?.(next);
  }

  accuracy(): number {
    const total = this.hits + this.misses;
    return total === 0 ? 1 : this.hits / total;
  }
}

export type { ChartNote, LiveNote, StageSpec };
export { laneVoices, classify };
