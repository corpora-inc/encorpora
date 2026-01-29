import { LaneIndex, Note } from "./types";

export class LaneSystem {
  private lanes: number = 3;
  private laneWidth: number = 0;
  private startX: number = 0;
  
  // Logical scale (updated on resize)
  private canvasWidth: number = 0;
  private canvasHeight: number = 0;

  // Visual config
  // Now relative to screen size instead of fixed pixels
  private noteRadius: number = 40; 
  private readonly STRUM_LINE_Y_RATIO = 0.8;

  constructor(width: number, height: number) {
    this.resize(width, height);
  }

  resize(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    
    // Make lanes fill width on mobile, but cap on desktop
    // On mobile (narrow width), fill 100%. On desktop, max 600px total?
    const totalMaxWidth = 600;
    const actualTotalWidth = Math.min(width, totalMaxWidth);
    
    this.laneWidth = actualTotalWidth / 3;
    this.startX = (width - actualTotalWidth) / 2;
    
    // Scale note radius based on lane width
    this.noteRadius = Math.min(40, this.laneWidth * 0.35);
  }

  getLaneX(index: LaneIndex): number {
    return this.startX + (index * this.laneWidth) + (this.laneWidth / 2);
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
    const hitZoneRadius = this.noteRadius * 1.5; // Scale hit zone with note size

    // Find the note in this lane that is closest to the strum line
    // and hasn't been hit yet
    const hittableNote = notes
      .filter(n => n.lane === lane && !n.hit && !n.missed)
      .find(n => Math.abs(n.y - hitY) < hitZoneRadius);

    return hittableNote || null;
  }
}
