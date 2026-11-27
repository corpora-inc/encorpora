/**
 * When to stop listening, from the microphone level the plugin reports about
 * eight times a second (RMS, 0..1). One tap starts; the person does not have
 * to tap again with a gloved hand:
 *
 * - The first half second sets the noise floor (a running crane is loud).
 * - Speech is a level clearly above that floor.
 * - After speech, a pause of `pauseMs` ends the question.
 * - Nothing heard for `idleMs`, or `maxMs` in all, also ends it.
 *
 * Tapping again always ends it too; this only removes the need to.
 */
export interface EndpointConfig {
  calibrateMs: number;
  pauseMs: number;
  idleMs: number;
  maxMs: number;
  /** Speech is a level at least this many times the floor... */
  ratio: number;
  /** ...and at least this absolute RMS. */
  minLevel: number;
}

export const ENDPOINT: EndpointConfig = { calibrateMs: 500, pauseMs: 1300, idleMs: 6000, maxMs: 20000, ratio: 2.5, minLevel: 0.015 };

export type EndpointResult = "listening" | "done" | "nothing-heard";

export class Endpointer {
  private floor = Infinity;
  private heard = false;
  private lastSpeech = 0;

  private readonly cfg: EndpointConfig;

  constructor(cfg: EndpointConfig = ENDPOINT) {
    this.cfg = cfg;
  }

  /** Feed one level reading taken `t` ms after recording started. */
  push(t: number, rms: number): EndpointResult {
    if (t < this.cfg.calibrateMs) {
      this.floor = Math.min(this.floor, rms);
      return "listening";
    }
    if (!Number.isFinite(this.floor)) this.floor = rms;
    const speech = rms >= Math.max(this.floor * this.cfg.ratio, this.cfg.minLevel);
    if (speech) {
      this.heard = true;
      this.lastSpeech = t;
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
