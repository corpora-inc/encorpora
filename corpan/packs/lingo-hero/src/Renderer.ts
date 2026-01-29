import { LaneIndex, Note } from "./types";
import { LaneSystem } from "./LaneSystem";

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement, private laneSystem: LaneSystem) {
    this.ctx = canvas.getContext("2d")!;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
  }

  clear() {
    // Semi-clear for trail effect? Or full clear.
    // Full clear for now.
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawLanes() {
    const strumY = this.laneSystem.getStrumLineY();
    
    // Draw Lane Backgrounds
    for (let i = 0; i < 3; i++) {
      const bounds = this.laneSystem.getLaneBounds(i);
      
      // Gradient background for "highway" feel
      const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      grad.addColorStop(0, "rgba(255, 255, 255, 0)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0.1)");
      
      this.ctx.fillStyle = grad;
      this.ctx.fillRect(bounds.x, 0, bounds.width, this.canvas.height);
      
      // Vertical separators
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(bounds.x, 0);
      this.ctx.lineTo(bounds.x, this.canvas.height);
      this.ctx.stroke();
      
      if (i === 2) { // Right border
        this.ctx.beginPath();
        this.ctx.moveTo(bounds.x + bounds.width, 0);
        this.ctx.lineTo(bounds.x + bounds.width, this.canvas.height);
        this.ctx.stroke();
      }

      // Draw Strum Targets (Circles at the bottom)
      const centerX = this.laneSystem.getLaneX(i);
      this.ctx.beginPath();
      this.ctx.arc(centerX, strumY, 35, 0, Math.PI * 2);
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      this.ctx.lineWidth = 4;
      this.ctx.stroke();
      
      // Inner glow
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = "white";
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }
    
    // Strum Line (Horizontal)
    this.ctx.strokeStyle = this.getNeonColor(1); // Purple
    this.ctx.lineWidth = 4;
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = this.getNeonColor(1);
    this.ctx.beginPath();
    this.ctx.moveTo(this.laneSystem.getLaneBounds(0).x - 20, strumY);
    this.ctx.lineTo(this.laneSystem.getLaneBounds(2).x + this.laneSystem.getLaneBounds(2).width + 20, strumY);
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }

  drawNotes(notes: Note[]) {
    for (const note of notes) {
      if (note.hit || note.missed) continue; // Don't draw if processed (visual effects handled elsewhere maybe)

      const x = this.laneSystem.getLaneX(note.lane);
      const y = note.y;
      
      // Color based on lane
      const color = this.getNeonColor(note.lane);
      
      // Glow
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = color;
      
      // Shape (Rounded Rect or Circle)
      this.ctx.fillStyle = "rgba(0,0,0,0.8)";
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 3;
      
      this.ctx.beginPath();
      this.ctx.arc(x, y, 30, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      this.ctx.shadowBlur = 0;

      // Text
      this.ctx.fillStyle = "white";
      this.ctx.font = "bold 16px Arial";
      this.ctx.fillText(note.text, x, y);
    }
  }

  drawFeedback(text: string, x: number, y: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.font = "bold 24px Arial";
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = color;
    this.ctx.fillText(text, x, y);
    this.ctx.shadowBlur = 0;
  }

  private getNeonColor(lane: LaneIndex): string {
    switch(lane) {
      case 0: return "#00f3ff"; // Cyan
      case 1: return "#bc13fe"; // Purple/Pink
      case 2: return "#0aff0a"; // Green
      default: return "white";
    }
  }
}
