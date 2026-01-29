import { LaneIndex, Note } from "./types";

export class LaneSystem {
  private lanes: number = 3;
  private laneWidth: number = 0;
  private startX: number = 0;
  
  // Visual config
  private readonly NOTE_RADIUS = 40;
  private readonly STRUM_LINE_Y_RATIO = 0.85;

  constructor(private canvasWidth: number, private canvasHeight: number) {
    this.resize(canvasWidth, canvasHeight);
  }

  resize(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    
    // Center the lanes. Each lane is e.g. 100px-150px wide depending on screen
    const maxLaneWidth = 150;
    this.laneWidth = Math.min(width / 3, maxLaneWidth);
    
    const totalWidth = this.laneWidth * 3;
    this.startX = (width - totalWidth) / 2;
  }

  getLaneX(index: LaneIndex): number {
    return this.startX + (index * this.laneWidth) + (this.laneWidth / 2);
  }

  getStrumLineY(): number {
    return this.canvasHeight * this.STRUM_LINE_Y_RATIO;
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
    const hitZoneRadius = 60; // How lenient is the timing?

    // Find the note in this lane that is closest to the strum line
    // and hasn't been hit yet
    const hittableNote = notes
      .filter(n => n.lane === lane && !n.hit && !n.missed)
      .find(n => Math.abs(n.y - hitY) < hitZoneRadius);

    return hittableNote || null;
  }
}
