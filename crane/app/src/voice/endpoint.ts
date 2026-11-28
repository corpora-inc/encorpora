/**
 * When to stop listening, from the microphone level the plugin reports about
 * eight times a second (RMS, 0..1). One tap starts; the person does not have
 * to tap again with a gloved hand:
 *
 * - The first half second sets the noise floor: the 25th percentile of its
 *   readings, ignoring dead-silent buffers (audio stacks often open with
 *   one), so neither a quiet startup buffer nor speech that starts at once
 *   sets it.
 * - Speech is a reading at least `ratio` times the floor (and above
 *   `minLevel`). 1.5x is about 3.5 dB: it still hears a question spoken at
 *   5 dB SNR over a running engine, while engine wobble around its own level
 *   stays below it.
 * - After speech, a pause of `pauseMs` ends the question.
 * - If the person was already talking when recording began, the floor starts
 *   at their voice; the drop when they stop marks the speech, and the pause
 *   after it ends the question.
 * - With no speech by `idleMs` it ends as nothing heard (nothing is
 *   transcribed, so noise never overwrites a typed question); at `maxMs` it
 *   ends whatever was said.
 *
 * Tapping again always ends it; this only removes the need to.
 */
export interface EndpointConfig {
  calibrateMs: number;
  pauseMs: number;
  idleMs: number;
  maxMs: number;
  ratio: number;
  minLevel: number;
}

export const ENDPOINT: EndpointConfig = { calibrateMs: 500, pauseMs: 1300, idleMs: 7000, maxMs: 20000, ratio: 1.5, minLevel: 0.01 };

export type EndpointResult = "listening" | "done" | "nothing-heard";

/** Readings below this are treated as a dead buffer, not as the room. */
const DEAD = 1e-4;
/** How far the level must fall from the start to mean "they were already talking". */
const START_DROP = 2.5;

export class Endpointer {
  private readonly cfg: EndpointConfig;
  private readonly calibration: number[] = [];
  private floor: number | null = null;
  private startFloor = 0;
  private heard = false;
  private lastSpeech = 0;

  constructor(cfg: EndpointConfig = ENDPOINT) {
    this.cfg = cfg;
  }

  private quartile(): number | null {
    const xs = this.calibration.filter((x) => x >= DEAD).sort((a, b) => a - b);
    if (xs.length === 0) return null;
    return xs[Math.floor((xs.length - 1) / 4)]!;
  }

  /** Feed one level reading taken `t` ms after recording started. */
  push(t: number, rms: number): EndpointResult {
    if (t < this.cfg.calibrateMs) {
      this.calibration.push(rms);
      return "listening";
    }
    if (this.floor === null) {
      this.floor = this.quartile() ?? (rms >= DEAD ? rms : this.cfg.minLevel / this.cfg.ratio);
      this.startFloor = this.floor;
    }
    const speech = rms >= Math.max(this.floor * this.cfg.ratio, this.cfg.minLevel);
    if (speech) {
      this.heard = true;
      this.lastSpeech = t;
    } else if (!this.heard && rms >= DEAD && rms * START_DROP <= this.startFloor) {
      // A clear fall from the starting level (voice to engine is ~4x; engine
      // wobble ~1.7x): the person was already talking when recording began.
      // Their speech just ended; the room's real floor is this.
      this.heard = true;
      this.lastSpeech = t;
      this.floor = rms;
    }
    if (t >= this.cfg.maxMs) return this.heard ? "done" : "nothing-heard";
    if (this.heard && t - this.lastSpeech >= this.cfg.pauseMs) return "done";
    if (!this.heard && t >= this.cfg.idleMs) return "nothing-heard";
    return "listening";
  }

  get speechHeard(): boolean {
    return this.heard;
  }
}
