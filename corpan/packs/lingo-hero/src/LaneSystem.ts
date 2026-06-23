import { LaneIndex, Note } from "./types";

export class LaneSystem {
  private laneWidth: number = 0;
  private startX: number = 0;

  // Logical scale (updated on resize)
  private canvasHeight: number = 0;

  // Top of the PLAY FIELD in CSS px — the y below which notes fall and lane FX
  // are drawn. Sits below the DOM HUD band (header + cue + phrase strip + score
  // chips) so falling cards never collide with or draw under the HUD. Measured
  // from the live HUD layout each frame via setPlayFieldTop(); the fallback is a
  // proportional gutter so geometry is still sane before the first measurement.
  private playFieldTop: number = 0;

  // Visual config
  // Now relative to screen size instead of fixed pixels
  private noteRadius: number = 40;
  private readonly STRUM_LINE_Y_RATIO = 0.8;

  constructor(width: number, height: number) {
    this.resize(width, height);
  }

  resize(width: number, height: number) {
    this.canvasHeight = height;

    // Make lanes fill width on mobile, but cap on desktop
    // On mobile (narrow width), fill 100%. On desktop, max 600px total?
    const totalMaxWidth = 600;
    const actualTotalWidth = Math.min(width, totalMaxWidth);

    this.laneWidth = actualTotalWidth / 3;
    this.startX = (width - actualTotalWidth) / 2;

    // Scale note radius based on lane width — bigger cards so the words are
    // readable while they fall.
    this.noteRadius = Math.min(72, this.laneWidth * 0.5);

    // Proportional fallback gutter until the HUD is measured (≈ a third of the
    // height, which clears the header + chips on phone aspect ratios).
    if (this.playFieldTop <= 0) {
      this.playFieldTop = Math.min(height * 0.34, this.getStrumLineY() - this.noteRadius * 3);
    }
  }

  /**
   * Set the top of the play field (CSS px), measured from the live HUD layout.
   * Clamped so it always leaves at least a card's worth of fall above the strum
   * line — the player must see the note travel, never teleport. Game.ts calls
   * this each resize / each HUD update.
   */
  setPlayFieldTop(y: number): void {
    const maxTop = this.getStrumLineY() - this.noteRadius * 3;
    this.playFieldTop = Math.max(0, Math.min(y, maxTop));
  }

  /** Top of the play field (CSS px) — notes fall from here to the strum line. */
  getPlayFieldTop(): number {
    return this.playFieldTop;
  }

  getLaneX(index: LaneIndex): number {
    return this.startX + (index * this.laneWidth) + (this.laneWidth / 2);
  }

  // Inverse of getLaneX, honoring the centered/capped lane band. Taps in the
  // side margins clamp to the nearest edge lane. Keeps input lanes == drawn lanes.
  laneAtX(x: number): LaneIndex {
    const idx = Math.floor((x - this.startX) / this.laneWidth);
    return Math.max(0, Math.min(2, idx)) as LaneIndex;
  }

  getStrumLineY(): number {
    return this.canvasHeight * this.STRUM_LINE_Y_RATIO;
  }
  
  getNoteRadius(): number {
    return this.noteRadius;
  }

  getLaneBounds(index: LaneIndex): {x: number, width: number} {
    return {
      x: this.startX + (index * this.laneWidth),
      width: this.laneWidth
    };
  }

  // Hit detection logic
  checkHit(lane: LaneIndex, notes: Note[]): Note | null {
    const hitY = this.getStrumLineY();
    const hitZoneRadius = this.noteRadius * 2.4; // Generous, forgiving timing window

    // The hittable note in this lane CLOSEST to the strum line (the prior code
    // returned the first in array order, which could grab the wrong note when
    // two were on screen).
    let best: Note | null = null;
    let bestDist = Infinity;
    for (const n of notes) {
      if (n.lane !== lane || n.hit || n.missed) continue;
      const dist = Math.abs(n.y - hitY);
      if (dist < hitZoneRadius && dist < bestDist) {
        best = n;
        bestDist = dist;
      }
    }
    return best;
  }
}
