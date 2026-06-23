import { LaneIndex, Note } from "./types";

export class LaneSystem {
  private laneWidth: number = 0;
  private startX: number = 0;

  // Logical scale (updated on resize)
  private canvasHeight: number = 0;

  // Top of the clear PLAY AREA, in canvas-local px. The DOM HUD (prompt chip +
  // exit/mute controls) occupies the band above this; falling notes are only
  // drawn at/below it so they emerge fully visible BELOW the HUD instead of
  // spawning occluded behind the chip/audio button. Game measures the HUD band
  // each resize and pushes it here; 0 until then (no clip).
  private playTopY: number = 0;

  // Visual config
  // Now relative to screen size instead of fixed pixels
  private noteRadius: number = 40;
  // The strum line (hit-ring circles) sits at this fraction of the canvas
  // height. Pulled UP from the old 0.8 (issue #426) so the rings are FULLY
  // visible (never clipped by the bottom edge) and leave a clear band below for
  // the single compact stats row (level · score · combo). The rings' bottom is
  // strumY + noteRadius; at 0.74 that clears the bottom band on a tall phone.
  private readonly STRUM_LINE_Y_RATIO = 0.74;

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

  /** The strum-line height fraction (so the fall-speed math stays in sync). */
  getStrumRatio(): number {
    return this.STRUM_LINE_Y_RATIO;
  }

  /**
   * Set the top of the clear play area (canvas-local px) — the baseline BELOW
   * the DOM HUD band. Clamped to a sane range so a mis-measured HUD can never
   * push the play-area top past the strum line (which would hide every note).
   */
  setPlayTop(y: number): void {
    const strumY = this.getStrumLineY();
    // Never eat more than the top ~55% of the track, and never go negative.
    const cap = strumY > 0 ? strumY * 0.55 : this.canvasHeight * 0.44;
    this.playTopY = Math.max(0, Math.min(y, cap));
  }

  /** Top of the clear play area (canvas-local px). Notes draw at/below this. */
  getPlayTopY(): number {
    return this.playTopY;
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
