/**
 * When to stop listening, from the microphone level the plugin reports about
 * eight times a second (RMS, 0..1). One tap starts; the person does not have
 * to tap again with a gloved hand:
 *
 * - The first half second sets the noise floor: the MEDIAN of its readings,
 *   ignoring dead-silent buffers (audio stacks often open with one), so a
 *   single quiet startup buffer cannot set the floor to zero.
 * - Speech is a reading at least `ratio` times the floor (and above
 *   `minLevel`). 1.5x is about 3.5 dB: it still hears a question spoken at
 *   5 dB SNR over a running engine, while engine wobble around its own level
 *   stays below it.
 * - After speech, a pause of `pauseMs` ends the question.
 * - With no speech detected by `idleMs`, or at `maxMs` in all, it ends too and
 *   whisper still transcribes what was recorded: the level test can miss
 *   speech, the transcript cannot be worse for trying.
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

export type EndpointResult = "listening" | "done";

/** Readings below this are treated as a dead buffer, not as the room. */
const DEAD = 1e-4;

export class Endpointer {
  private readonly cfg: EndpointConfig;
  private readonly calibration: number[] = [];
  private floor: number | null = null;
  private heard = false;
  private lastSpeech = 0;

  constructor(cfg: EndpointConfig = ENDPOINT) {
    this.cfg = cfg;
  }

  private median(): number | null {
    const xs = this.calibration.filter((x) => x >= DEAD).sort((a, b) => a - b);
    if (xs.length === 0) return null;
    const m = xs.length >> 1;
    return xs.length % 2 ? xs[m]! : (xs[m - 1]! + xs[m]!) / 2;
  }

  /** Feed one level reading taken `t` ms after recording started. */
  push(t: number, rms: number): EndpointResult {
    if (t < this.cfg.calibrateMs) {
      this.calibration.push(rms);
      return "listening";
    }
    if (this.floor === null) this.floor = this.median() ?? (rms >= DEAD ? rms : this.cfg.minLevel / this.cfg.ratio);
    const speech = rms >= Math.max(this.floor * this.cfg.ratio, this.cfg.minLevel);
    if (speech) {
      this.heard = true;
      this.lastSpeech = t;
    }
    if (t >= this.cfg.maxMs) return "done";
    if (this.heard && t - this.lastSpeech >= this.cfg.pauseMs) return "done";
    if (!this.heard && t >= this.cfg.idleMs) return "done";
    return "listening";
  }

  get speechHeard(): boolean {
    return this.heard;
  }
}
