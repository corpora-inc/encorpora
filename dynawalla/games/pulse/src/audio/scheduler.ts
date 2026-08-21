/**
 * Transport and lookahead scheduling — "A Tale of Two Clocks".
 *
 * `setInterval` jitters by tens of milliseconds, which is audible and fatal in a
 * rhythm game. So the interval never *plays* anything: it walks the timeline a
 * lookahead window ahead and hands every event an absolute `AudioContext` time.
 * The audio thread places them with sample accuracy.
 *
 * Tempo is a piecewise map, not a scalar, so a stage can change BPM at a bar line
 * without any previously scheduled event moving.
 */

export type TempoSegment = { beat0: number; time0: number; spb: number };

export class Timeline {
  private segs: TempoSegment[];
  readonly beatsPerBar: number;

  constructor(startTime: number, bpm: number, beatsPerBar = 4) {
    this.segs = [{ beat0: 0, time0: startTime, spb: 60 / bpm }];
    this.beatsPerBar = beatsPerBar;
  }

  get bpm(): number {
    return 60 / this.segs[this.segs.length - 1]!.spb;
  }

  /** Change tempo starting at an absolute beat. Must be >= the last segment start. */
  setTempoAtBeat(beat: number, bpm: number): void {
    const spb = 60 / bpm;
    const last = this.segs[this.segs.length - 1]!;
    if (Math.abs(last.spb - spb) < 1e-9) return;
    if (beat <= last.beat0) {
      this.segs[this.segs.length - 1] = { beat0: last.beat0, time0: last.time0, spb };
      return;
    }
    this.segs.push({ beat0: beat, time0: this.timeAt(beat), spb });
  }

  timeAt(beat: number): number {
    let seg = this.segs[0]!;
    for (const s of this.segs) if (s.beat0 <= beat) seg = s;
    return seg.time0 + (beat - seg.beat0) * seg.spb;
  }

  beatAt(time: number): number {
    let seg = this.segs[0]!;
    for (const s of this.segs) if (s.time0 <= time) seg = s;
    return seg.beat0 + (time - seg.time0) / seg.spb;
  }

  /** Seconds per beat at an absolute beat — used to size timing windows visually. */
  spbAtBeat(beat: number): number {
    let seg = this.segs[0]!;
    for (const s of this.segs) if (s.beat0 <= beat) seg = s;
    return seg.spb;
  }

  barOfBeat(beat: number): number {
    return Math.floor(beat / this.beatsPerBar);
  }
  beatOfBar(bar: number): number {
    return bar * this.beatsPerBar;
  }
}

export type SchedulerOptions = {
  /**
   * How far ahead bars are committed, in seconds. This is a function because it must
   * exceed one bar: the playfield shows exactly one bar of future, so a note has to
   * exist a whole measure before it is heard or it pops into view already arriving.
   * At 84 BPM that is ~3.3 s of scheduling depth, which Web Audio handles happily —
   * the only cost is that a mix change lands on the next bar line instead of
   * instantly, which is where a musician would put it anyway.
   */
  lookaheadSec?: () => number;
  /** How often the walker runs. */
  tickMs?: number;
};

/**
 * Pulls musical bars into the future. `fill(bar)` is called exactly once per bar,
 * in order, as soon as that bar's start time falls inside the lookahead window.
 */
export class Lookahead {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBar = 0;
  readonly lookaheadSec: () => number;
  private readonly tickMs: number;
  private readonly now: () => number;
  private readonly timeline: Timeline;
  private readonly fill: (bar: number, barStartTime: number) => void;

  constructor(
    now: () => number,
    timeline: Timeline,
    fill: (bar: number, barStartTime: number) => void,
    opts: SchedulerOptions = {},
  ) {
    this.now = now;
    this.timeline = timeline;
    this.fill = fill;
    this.lookaheadSec = opts.lookaheadSec ?? (() => 0.28);
    this.tickMs = opts.tickMs ?? 22;
  }

  start(fromBar = 0): void {
    this.nextBar = fromBar;
    this.pump();
    this.timer = setInterval(() => this.pump(), this.tickMs);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Bars already handed to `fill`. */
  get filledThrough(): number {
    return this.nextBar - 1;
  }

  pump(): void {
    const horizon = this.now() + this.lookaheadSec();
    // Guard against a runaway loop if a fill() call never advances the clock.
    let guard = 0;
    while (guard++ < 64) {
      const t = this.timeline.timeAt(this.timeline.beatOfBar(this.nextBar));
      if (t > horizon) break;
      const bar = this.nextBar;
      this.nextBar++;
      this.fill(bar, t);
    }
  }
}
