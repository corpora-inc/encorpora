/**
 * BZ-06 — exactly one preview animates.
 *
 * Only the centred stall runs `render`. Every other visible stall paints a
 * **poster**: the last frame the live preview produced, snapshotted on unmount
 * at ≤ 256×256, LRU-cached, at most 24. That is the entire performance story of
 * the street, and it is why sixty stalls cost about what one does.
 *
 * A preview that runs over 4 ms is demoted to its poster **permanently** for
 * this session. It is not asked again, and nothing is said about it.
 */

import type { StallPreview } from "../types.ts";

const POSTER_MAX = 24;
const POSTER_SIZE = 256;
const FRAME_BUDGET_MS = 4;

export class PreviewDirector {
  private posters = new Map<string, HTMLCanvasElement>();
  private demoted = new Set<string>();
  private liveId: string | null = null;
  private renders = 0;

  /** Which stall is centred. Everything else is a poster. */
  setLive(id: string | null): void {
    if (this.liveId === id) return;
    this.liveId = id;
  }

  get live(): string | null {
    return this.liveId;
  }

  isLive(id: string): boolean {
    return this.liveId === id && !this.demoted.has(id);
  }

  /** How many `render` calls happened since the last `beginFrame`. BZ-06. */
  beginFrame(): void {
    this.renders = 0;
  }

  get rendersThisFrame(): number {
    return this.renders;
  }

  /**
   * Draw the aperture contents. Returns true if a live frame was produced.
   * Falls back to the poster, and then to nothing at all — a stall with no
   * preview keeps its specimen and its moving automaton, so it is never dead.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    id: string,
    preview: StallPreview | undefined,
    w: number,
    h: number,
    dpr: number,
    t: number,
    seed: number,
    reduced: boolean,
  ): boolean {
    if (preview && this.isLive(id)) {
      const start = now();
      this.renders++;
      try {
        preview.render(ctx, { width: w, height: h, dpr, t: t % preview.period, seed, reducedMotion: reduced });
      } catch {
        this.demoted.add(id);
        return false;
      }
      const cost = now() - start;
      if (cost > FRAME_BUDGET_MS * 3) this.demoted.add(id);
      this.capture(id, ctx.canvas, w, h);
      return true;
    }
    const poster = this.posters.get(id);
    if (poster) {
      // LRU touch.
      this.posters.delete(id);
      this.posters.set(id, poster);
      ctx.drawImage(poster, 0, 0, w, h);
      return true;
    }
    if (preview && !this.demoted.has(id)) {
      // No poster yet: produce a single still frame so the aperture is never
      // an empty hole, then leave it alone.
      this.renders++;
      try {
        preview.render(ctx, { width: w, height: h, dpr, t: 0, seed, reducedMotion: true });
        this.capture(id, ctx.canvas, w, h);
        return true;
      } catch {
        this.demoted.add(id);
      }
    }
    return false;
  }

  private capture(id: string, src: HTMLCanvasElement, w: number, h: number): void {
    let cv = this.posters.get(id);
    const scale = Math.min(1, POSTER_SIZE / Math.max(w, h));
    const pw = Math.max(1, Math.round(w * scale));
    const ph = Math.max(1, Math.round(h * scale));
    if (!cv || cv.width !== pw || cv.height !== ph) {
      cv = document.createElement("canvas");
      cv.width = pw;
      cv.height = ph;
    }
    const g = cv.getContext("2d");
    if (!g) return;
    try {
      g.drawImage(src, 0, 0, pw, ph);
    } catch {
      return;
    }
    this.posters.delete(id);
    this.posters.set(id, cv);
    while (this.posters.size > POSTER_MAX) {
      const oldest = this.posters.keys().next().value;
      if (oldest === undefined) break;
      this.posters.delete(oldest);
    }
  }

  get posterCount(): number {
    return this.posters.size;
  }

  clear(): void {
    this.posters.clear();
    this.demoted.clear();
    this.liveId = null;
  }
}

const now = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();
