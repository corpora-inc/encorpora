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
    const width = parseFloat(this.canvas.style.width);
    const height = parseFloat(this.canvas.style.height);
    this.ctx.clearRect(0, 0, width, height);
  }

  drawLanes(activeLanes: number[] = []) {
    const height = parseFloat(this.canvas.style.height);
    const strumY = this.laneSystem.getStrumLineY();

    // 1. Draw Linear Highway Background
    // Dark background for the track
    const lane0 = this.laneSystem.getLaneBounds(0);
    const lane2 = this.laneSystem.getLaneBounds(2);
    const trackX = lane0.x;
    const trackWidth = (lane2.x + lane2.width) - lane0.x;
    
    // Fretboard gradient
    const grad = this.ctx.createLinearGradient(trackX, 0, trackX + trackWidth, 0);
    grad.addColorStop(0, "#080808");
    grad.addColorStop(0.5, "#151515");
    grad.addColorStop(1, "#080808");
    
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(trackX, 0, trackWidth, height);
    
    // Side borders
    this.ctx.strokeStyle = "#333";
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(trackX, 0);
    this.ctx.lineTo(trackX, height);
    this.ctx.moveTo(trackX + trackWidth, 0);
    this.ctx.lineTo(trackX + trackWidth, height);
    this.ctx.stroke();

    // 2. Vertical Lane Dividers
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    this.ctx.lineWidth = 2;
    for (let i = 1; i < 3; i++) {
        const x = this.laneSystem.getLaneBounds(i).x;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, height);
        this.ctx.stroke();
    }
    
    // 3. Strum Line (Target Area)
    // Draw a bar across
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    this.ctx.fillRect(trackX, strumY - 10, trackWidth, 20);
    
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(trackX, strumY);
    this.ctx.lineTo(trackX + trackWidth, strumY);
    this.ctx.stroke();

    // 4. Hit Targets (Fret Buttons)
    for (let i = 0; i < 3; i++) {
        const centerX = this.laneSystem.getLaneX(i);
        const color = this.getNeonColor(i);
        const isActive = activeLanes.includes(i);
        
        // Fret Button Logic
        const r = this.laneSystem.getNoteRadius();
        
        this.ctx.beginPath();
        this.ctx.arc(centerX, strumY, r, 0, Math.PI * 2);
        
        if (isActive) {
            // "Pressed" Animation State
            this.ctx.fillStyle = color;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = color;
            this.ctx.fill();
            
            this.ctx.fillStyle = "rgba(255,255,255,0.8)";
            this.ctx.fill();
        } else {
            // Resting State (Hollow Ring)
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 4;
            this.ctx.stroke();
            
            this.ctx.fillStyle = "rgba(0,0,0,0.5)";
            this.ctx.fill();
        }
        this.ctx.shadowBlur = 0;
    }
  }

  drawNotes(notes: Note[]) {
    const now = performance.now();
    
    // Draw notes top to bottom (linear)
    for (const note of notes) {
      if (note.missed) continue; 
      
      const centerX = this.laneSystem.getLaneX(note.lane);
      const y = note.y;
      
      // Hit Effect (Explosion)
      if (note.hit) {
         if (note.hitTime && (now - note.hitTime < 300)) {
             const progress = (now - note.hitTime) / 300;
             const alpha = 1 - progress;
             const r = this.laneSystem.getNoteRadius() * (1 + progress * 0.5);
             
             this.ctx.save();
             this.ctx.globalAlpha = alpha;
             this.ctx.translate(centerX, y);
             
             // Flash
             this.ctx.beginPath();
             this.ctx.arc(0, 0, r, 0, Math.PI * 2);
             this.ctx.fillStyle = "white";
             this.ctx.fill();
             
             // Ring
             this.ctx.beginPath();
             this.ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
             this.ctx.strokeStyle = this.getNeonColor(note.lane);
             this.ctx.lineWidth = 5;
             this.ctx.stroke();
             
             this.ctx.restore();
         }
         continue;
      }
      
      // Don't draw if off screen (top)
      if (y < -50) continue;

      const r = this.laneSystem.getNoteRadius();
      const color = this.getNeonColor(note.lane);
      
      // Draw Note (Rectangular "Tape" / "Card" style for Linear view)
      const laneW = this.laneSystem.getLaneBounds(0).width;
      const cardW = laneW * 0.9;
      const cardH = r * 1.5; 
      
      const x = centerX - cardW / 2;
      const cardY = y - cardH / 2;
      
      // Glow
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = color;
      
      // Body
      this.ctx.fillStyle = "rgba(20, 20, 20, 0.95)";
      this.ctx.beginPath();
      if (this.ctx.roundRect) {
          this.ctx.roundRect(x, cardY, cardW, cardH, 10);
      } else {
          this.ctx.rect(x, cardY, cardW, cardH);
      }
      this.ctx.fill();
      
      // Border / Color indicator
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 3;
      this.ctx.stroke();
      
      // Sidebar highlight (like a gem on the side?)
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      if (this.ctx.roundRect) {
          this.ctx.roundRect(x, cardY, 10, cardH, [10, 0, 0, 10]); // TopLeft, TopRight, BotRight, BotLeft
      } else {
          this.ctx.fillRect(x, cardY, 10, cardH);
      }
      this.ctx.fill();
      
      this.ctx.shadowBlur = 0;

      // Text Rendering
      if (note.text) {
        this.ctx.fillStyle = "white";
        let fontSize = 20; 
        this.ctx.font = `bold ${fontSize}px 'Russo One', sans-serif`;
        
        // Fit text
        const maxTextW = cardW - 20; // Padding
        let metrics = this.ctx.measureText(note.text);
        
        if (metrics.width > maxTextW) {
             fontSize = fontSize * (maxTextW / metrics.width);
             this.ctx.font = `bold ${fontSize}px 'Russo One', sans-serif`;
        }
        
        // Offset text slightly to right because of the colored bar
        // Update: Center text precisely in the remaining space or relative to card center?
        // User requested "completly centered on the box".
        // The "box" is the card.
        // We have a 10px bar on the left.
        // If we want visual centering on the card body (excluding bar), we should shift right.
        // But if we want centering on the whole object, use centerX.
        // Let's assume centering on the CARD BODY (white space) looks best.
        // Card Body Width = cardW - 10.
        // Center of Card Body relative to x: 10 + (cardW - 10)/2 = 10 + cardW/2 - 5 = cardW/2 + 5.
        // Absolute X: x + cardW/2 + 5 = (centerX - cardW/2) + cardW/2 + 5 = centerX + 5.
        // So centerX + 5 IS the center of the available space.
        // I will keep centerX + 5 but make sure alignment is strictly center/middle.
        
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(note.text, centerX + 5, y);
      }
    }
  }

  private getNeonColor(lane: LaneIndex): string {
    switch(lane) {
      case 0: return "#00ffff"; // Cyan
      case 1: return "#ff00ff"; // Pink
      case 2: return "#00ff00"; // Green
      default: return "white";
    }
  }
}
