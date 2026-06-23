import { LaneSystem } from "../LaneSystem";
import { rgba, type Rgb } from "./palette";

interface Star {
  x: number; // 0..1 normalized
  y: number;
  z: number; // depth 0..1 (parallax + size)
  tw: number; // twinkle phase
}

/**
 * Living background: a parallax starfield in the side gutters (the area outside
 * the 600px-max track that Renderer leaves transparent) plus a combo-reactive
 * aurora bloom and a moving scanline sheen. Drawn additively so it never muddies
 * the notes. Intensity ramps with combo energy fed from the orchestrator.
 *
 * NOTE: Renderer paints the central track opaquely AFTER clear() and BEFORE the
 * effects pass, so the starfield is intentionally confined to the gutters; the
 * aurora/vignette overlays the full screen at low additive alpha.
 */
export class Background {
  private stars: Star[] = [];
  private t = 0;
  /** 0..1 energy from combo; smoothed toward target. */
  private energy = 0;
  private energyTarget = 0;
  /** color the aurora leans toward (lane of last hit). */
  private hue: Rgb = { r: 80, g: 160, b: 255 };
  private hueTarget: Rgb = { r: 80, g: 160, b: 255 };
  private flash = 0; // brief full-screen tint on big events

  constructor(starCount = 90) {
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
        tw: Math.random() * Math.PI * 2,
      });
    }
  }

  setEnergy(e: number): void {
    this.energyTarget = e < 0 ? 0 : e > 1 ? 1 : e;
  }

  setHue(c: Rgb): void {
    this.hueTarget = c;
  }

  pulse(amount = 0.6): void {
    this.flash = Math.min(1, this.flash + amount);
  }

  update(dt: number): void {
    this.t += dt;
    // Ease energy + hue toward targets for buttery transitions.
    this.energy += (this.energyTarget - this.energy) * Math.min(1, dt * 4);
    this.hue.r += (this.hueTarget.r - this.hue.r) * Math.min(1, dt * 5);
    this.hue.g += (this.hueTarget.g - this.hue.g) * Math.min(1, dt * 5);
    this.hue.b += (this.hueTarget.b - this.hue.b) * Math.min(1, dt * 5);
    this.flash = Math.max(0, this.flash - dt * 2.2);
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number, lanes: LaneSystem): void {
    const lane0 = lanes.getLaneBounds(0);
    const lane2 = lanes.getLaneBounds(2);
    const trackX = lane0.x;
    const trackRight = lane2.x + lane2.width;
    const gutter = trackX > 2; // wide screen → visible side gutters

    ctx.save();

    // --- Gutter starfield (parallax drift upward, twinkle). ---
    if (gutter) {
      ctx.globalCompositeOperation = "lighter";
      const driftBase = this.t * 14;
      for (const s of this.stars) {
        const depth = 0.3 + s.z * 0.7;
        const drift = (driftBase * depth) % h;
        let sy = (s.y * h - drift) % h;
        if (sy < 0) sy += h;
        // Map normalized x into the two gutters only.
        const leftSide = s.x < 0.5;
        const localX = leftSide ? s.x * 2 : (s.x - 0.5) * 2;
        const px = leftSide
          ? localX * trackX
          : trackRight + localX * (w - trackRight);
        if ((leftSide && trackX <= 2) || (!leftSide && w - trackRight <= 2)) continue;
        const twinkle = 0.5 + 0.5 * Math.sin(this.t * 2 + s.tw);
        const size = (0.6 + s.z * 1.8) * (1 + this.energy * 0.6);
        const a = (0.12 + s.z * 0.35) * twinkle * (0.6 + this.energy * 0.7);
        ctx.beginPath();
        ctx.arc(px, sy, size, 0, Math.PI * 2);
        ctx.fillStyle = rgba(this.hue, a);
        ctx.fill();
      }
    }

    // --- Combo aurora: two slow vertical bands that bloom with energy. ---
    if (this.energy > 0.02 || this.flash > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      const bloom = this.energy * 0.5 + this.flash * 0.5;
      const cx1 = w * (0.5 + 0.18 * Math.sin(this.t * 0.7));
      const cx2 = w * (0.5 + 0.22 * Math.sin(this.t * 0.9 + 2));
      const grad1 = ctx.createRadialGradient(cx1, h * 0.35, 0, cx1, h * 0.35, h * 0.8);
      grad1.addColorStop(0, rgba(this.hue, 0.1 * bloom));
      grad1.addColorStop(1, rgba(this.hue, 0));
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, w, h);
      const grad2 = ctx.createRadialGradient(cx2, h * 0.7, 0, cx2, h * 0.7, h * 0.7);
      grad2.addColorStop(0, rgba(this.hue, 0.08 * bloom));
      grad2.addColorStop(1, rgba(this.hue, 0));
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);
    }

    // --- Moving sheen scanline that sweeps the strum zone with energy. ---
    if (this.energy > 0.15) {
      ctx.globalCompositeOperation = "lighter";
      const strumY = lanes.getStrumLineY();
      const sweep = (Math.sin(this.t * 1.5) * 0.5 + 0.5) * 60;
      const g = ctx.createLinearGradient(0, strumY - 80 - sweep, 0, strumY + 10);
      g.addColorStop(0, rgba(this.hue, 0));
      g.addColorStop(1, rgba(this.hue, 0.06 * this.energy));
      ctx.fillStyle = g;
      ctx.fillRect(trackX, strumY - 90, trackRight - trackX, 100);
    }

    ctx.restore();
  }

  reset(): void {
    this.energy = 0;
    this.energyTarget = 0;
    this.flash = 0;
  }
}
