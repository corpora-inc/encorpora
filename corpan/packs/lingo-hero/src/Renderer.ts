import { LaneIndex, Note } from "./types";
import { LaneSystem } from "./LaneSystem";
import {
  getBoardState,
  tickBoardState,
  type LaneFlash,
} from "./effects/boardState";

/**
 * Renderer — the Neon Arcade canvas floor. STREAM: board.
 *
 * Draws (back→front) each frame, inside Game's loop, BEFORE the VFX layer:
 *   1. clear()
 *   2. drawLanes()  — synthwave perspective grid floor + volumetric neon lane
 *                     shafts + glass strum bar + fret pads (combo-escalated).
 *   3. drawNotes()  — glass note cards with the foreign/answer word, approach
 *                     bloom, motion trails, and the per-note hit pop.
 * The particle/shake/shockwave/transition juice is layered on top by
 * effects/index.ts (a bus subscriber). This file never imports the bus and
 * never touches Game.ts; it reads gameplay escalation through the shared
 * `effects/boardState` seam that the effects stream writes to.
 *
 * Palette is single-sourced from the `--na-*` design tokens, resolved once from
 * :root at construction (with hardcoded fallbacks that MATCH the tokens, so the
 * board is correct fully offline even if getComputedStyle is unavailable).
 *
 * Performance: pure Canvas2D, allocation-light per frame (gradients are the only
 * per-frame allocs — unavoidable in 2D and cheap at this count), one additive
 * pass for trails/glow. Grid lines are bounded and depth-culled. Targets 60fps
 * on mobile; all motion is wall-clock driven so it's refresh-rate independent.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

// Fallbacks MATCH the --na-* tokens (offline-safe if :root can't be read).
const FALLBACK = {
  bg0: { r: 7, g: 6, b: 15 }, // --na-bg  #07060f
  bg1: { r: 13, g: 11, b: 26 }, // --na-bg-elev #0d0b1a
  bg2: { r: 20, g: 17, b: 42 }, // --na-surface #14112a
  lane1: { r: 47, g: 243, b: 255 }, // --na-lane-1 cyan
  lane2: { r: 255, g: 0, b: 212 }, // --na-lane-2 magenta
  lane3: { r: 123, g: 255, b: 123 }, // --na-lane-3 lime
  accent: { r: 154, g: 130, b: 255 }, // grid horizon violet (--neon-violet-ish)
  text: { r: 244, g: 241, b: 255 }, // --na-text
  wrong: { r: 255, g: 62, b: 165 }, // --na-wrong neon pink
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  // Resolved lane colors (from tokens, with fallback). Index = LaneIndex.
  private laneColors: [Rgb, Rgb, Rgb];
  private bgTop: Rgb;
  private bgMid: Rgb;
  private bgBot: Rgb;
  private horizonColor: Rgb;
  private textColor: Rgb;
  private wrongColor: Rgb;

  // Frame clock for the board-state easing + scrolling grid (wall-clock).
  private lastFrame = performance.now();
  // Scrolling phase for the synthwave floor grid (advances with energy).
  private gridScroll = 0;

  constructor(private canvas: HTMLCanvasElement, private laneSystem: LaneSystem) {
    this.ctx = canvas.getContext("2d")!;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";

    const root =
      typeof document !== "undefined" ? document.documentElement : null;
    const read = (name: string, fb: Rgb): Rgb =>
      parseColor(cssVar(root, name)) ?? fb;

    this.laneColors = [
      read("--na-lane-1", FALLBACK.lane1),
      read("--na-lane-2", FALLBACK.lane2),
      read("--na-lane-3", FALLBACK.lane3),
    ];
    this.bgTop = read("--na-bg", FALLBACK.bg0);
    this.bgMid = read("--na-bg-elev", FALLBACK.bg1);
    this.bgBot = read("--na-surface", FALLBACK.bg2);
    this.horizonColor = read("--na-accent", FALLBACK.accent);
    this.textColor = read("--na-text", FALLBACK.text);
    this.wrongColor = read("--na-wrong", FALLBACK.wrong);
  }

  clear() {
    const width = parseFloat(this.canvas.style.width);
    const height = parseFloat(this.canvas.style.height);
    this.ctx.clearRect(0, 0, width, height);
  }

  // -------------------------------------------------------------------------
  // LANES — perspective grid floor + volumetric neon lane shafts + strum/pads.
  // -------------------------------------------------------------------------
  drawLanes(activeLanes: number[] = []) {
    const ctx = this.ctx;
    const now = performance.now();

    // Advance shared board easing once per frame (Renderer is the first paint).
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (!(dt > 0)) dt = 1 / 60;
    if (dt > 0.1) dt = 0.1;
    tickBoardState(dt);
    const board = getBoardState();
    const energy = board.energy; // 0..1 combo-driven escalation
    const heat = board.heat;

    const height = parseFloat(this.canvas.style.height);
    const width = parseFloat(this.canvas.style.width);
    const strumY = this.laneSystem.getStrumLineY();

    const lane0 = this.laneSystem.getLaneBounds(0);
    const lane2 = this.laneSystem.getLaneBounds(2);
    const trackX = lane0.x;
    const trackWidth = lane2.x + lane2.width - trackX;
    const trackRight = trackX + trackWidth;

    // 1) FULL-SCREEN SYNTHWAVE BACKDROP — deep vertical wash so the gutters and
    //    the track share one cohesive night sky (the VFX starfield sits in the
    //    gutters on top of this). Drawn opaque so clear() leaves no host bleed.
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, rgbStr(this.bgTop));
    sky.addColorStop(0.55, rgbStr(this.bgMid));
    sky.addColorStop(1, rgbStr(mix(this.bgBot, this.horizonColor, 0.12)));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // 2) TRACK FLOOR — the perspective grid lives between the horizon (a little
    //    above the top of the visible track band) and the strum line, then a
    //    near-field continues below the strum toward the bottom edge.
    //    We give the track a subtly brighter, glassier base than the sky.
    const floorGrad = ctx.createLinearGradient(trackX, 0, trackRight, 0);
    floorGrad.addColorStop(0, rgba(this.bgMid, 0.0));
    floorGrad.addColorStop(0.5, rgba(mix(this.bgMid, this.horizonColor, 0.1), 0.55));
    floorGrad.addColorStop(1, rgba(this.bgMid, 0.0));
    ctx.fillStyle = floorGrad;
    ctx.fillRect(trackX, 0, trackWidth, height);

    this.drawPerspectiveGrid(
      trackX,
      trackRight,
      height,
      strumY,
      energy,
      dt
    );

    // 3) VOLUMETRIC NEON LANE SHAFTS — a soft column of lane-colored light per
    //    lane, brightest at the strum line, fading up the track. Additive.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const c = this.laneColors[i];
      const cx = this.laneSystem.getLaneX(i as LaneIndex);
      const halfW = lane0.width * 0.5;
      // Vertical shaft: brightest band hugging the strum line.
      const shaft = ctx.createLinearGradient(0, strumY - height * 0.62, 0, strumY + 12);
      const baseA = 0.05 + energy * 0.06;
      shaft.addColorStop(0, rgba(c, 0));
      shaft.addColorStop(0.78, rgba(c, baseA));
      shaft.addColorStop(1, rgba(c, baseA + 0.1 + energy * 0.08));
      ctx.fillStyle = shaft;
      ctx.fillRect(cx - halfW, strumY - height * 0.62, halfW * 2, height * 0.62 + 12);

      // A tighter, brighter central glow line down each lane.
      const core = ctx.createLinearGradient(cx - halfW * 0.12, 0, cx + halfW * 0.12, 0);
      core.addColorStop(0, rgba(c, 0));
      core.addColorStop(0.5, rgba(c, 0.08 + energy * 0.07));
      core.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = core;
      ctx.fillRect(cx - halfW * 0.12, strumY - height * 0.55, halfW * 0.24, height * 0.55);
    }
    ctx.restore();

    // 4) LANE EDGE RAILS — glowing neon dividers framing the three lanes. The
    //    outer rails blend the two adjacent lane colors; inner dividers too.
    this.drawLaneRails(trackX, trackRight, lane0.width, height, energy);

    // 5) STRUM LINE — a premium glass energy bar with a bright neon edge and a
    //    breathing bloom. Color leans toward the hottest recent lane.
    this.drawStrumBar(trackX, trackWidth, strumY, now, energy, heat, board);

    // 6) FRET PADS — glassy hit targets per lane with idle breathe + press slam.
    for (let i = 0; i < 3; i++) {
      this.drawFretPad(i as LaneIndex, strumY, now, activeLanes.includes(i), energy, board.laneFlash[i]);
    }

    // 7) MISS WASH — a brief red flood across the floor when the player whiffs
    //    or lets the target sail past (read from the board seam).
    const missAge = (now - board.lastMissAt) / 1000;
    if (missAge >= 0 && missAge < 0.45) {
      const k = 1 - missAge / 0.45;
      ctx.save();
      const g = ctx.createLinearGradient(0, strumY - 120, 0, strumY + 40);
      g.addColorStop(0, rgba(this.wrongColor, 0));
      g.addColorStop(1, rgba(this.wrongColor, 0.16 * k * board.lastMissPower));
      ctx.fillStyle = g;
      ctx.fillRect(trackX, strumY - 120, trackWidth, 160);
      ctx.restore();
    }
  }

  /**
   * Synthwave perspective grid: horizontal rails marching up toward a vanishing
   * horizon (spacing compresses with depth) + converging verticals that fan out
   * from the horizon to the lane edges at the strum line. Scrolls toward the
   * player; speed ramps with combo energy. Depth-faded so the horizon dissolves
   * into the sky and the near field reads crisp.
   */
  private drawPerspectiveGrid(
    trackX: number,
    trackRight: number,
    height: number,
    strumY: number,
    energy: number,
    dt: number
  ): void {
    const ctx = this.ctx;
    const cx = (trackX + trackRight) / 2;
    const trackW = trackRight - trackX;

    // Horizon sits above the playfield (off the top of the lane band) so lines
    // converge into the distance. Near plane = strum line.
    const horizonY = strumY - height * 0.92;
    const span = strumY - horizonY;
    if (span <= 1) return;

    // Scroll the grid toward the player; faster as the combo heats up.
    this.gridScroll += dt * (0.18 + energy * 0.42);
    if (this.gridScroll > 1) this.gridScroll -= Math.floor(this.gridScroll);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // --- Horizontal depth rails ---
    // Param u in [0,1): 0 = horizon, 1 = near (strum). Perspective: y grows
    // non-linearly. We march N rails and offset by scroll so they appear to
    // flow toward us; each rail's screen y = horizon + span * pow(u, p).
    const RAILS = 18;
    const p = 2.2; // perspective exponent (compresses near the horizon)
    for (let i = 0; i < RAILS; i++) {
      let u = (i + this.gridScroll) / RAILS;
      if (u <= 0 || u >= 1) continue;
      const y = horizonY + span * Math.pow(u, p);
      if (y < horizonY || y > strumY + 1) continue;
      // Lines widen toward the viewer (track edges fan from cx at horizon to
      // full width at strum). Width fraction follows the same perspective.
      const wf = Math.pow(u, p * 0.5);
      const halfSpan = (trackW / 2) * (0.04 + 0.96 * wf);
      // Depth fade: dim near horizon, brighter near player, then the very
      // nearest few fade as they pass off the bottom.
      const depthA = Math.pow(u, 1.4) * (1 - u * 0.15);
      const a = depthA * (0.16 + energy * 0.16);
      ctx.strokeStyle = rgba(mix(this.horizonColor, this.laneColors[1], 0.25), a);
      ctx.lineWidth = 0.6 + wf * 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - halfSpan, y);
      ctx.lineTo(cx + halfSpan, y);
      ctx.stroke();
    }

    // --- Converging verticals: fan from the horizon point to evenly spaced
    //     near-plane positions across the track. 7 lines for a clean weave. ---
    const VERTS = 7;
    for (let i = 0; i <= VERTS; i++) {
      const f = i / VERTS; // 0..1 across the track at the near plane
      const nearX = trackX + f * trackW;
      // All verticals originate near the horizon center (vanishing point) with
      // a slight spread so they don't pinch to a single pixel.
      const farX = cx + (f - 0.5) * trackW * 0.06;
      const grad = ctx.createLinearGradient(0, horizonY, 0, strumY);
      grad.addColorStop(0, rgba(this.horizonColor, 0));
      grad.addColorStop(1, rgba(mix(this.horizonColor, this.laneColors[1], 0.3), 0.12 + energy * 0.12));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(farX, horizonY);
      ctx.lineTo(nearX, strumY);
      ctx.stroke();
    }

    // --- Horizon glow bar: a soft bloom where the grid dissolves into sky. ---
    const hg = ctx.createLinearGradient(0, horizonY - 24, 0, horizonY + 40);
    hg.addColorStop(0, rgba(this.horizonColor, 0));
    hg.addColorStop(0.5, rgba(this.horizonColor, 0.1 + energy * 0.1));
    hg.addColorStop(1, rgba(this.horizonColor, 0));
    ctx.fillStyle = hg;
    ctx.fillRect(trackX, horizonY - 24, trackW, 64);

    ctx.restore();
  }

  /** Glowing neon rails framing the lanes (outer track edges + inner dividers). */
  private drawLaneRails(
    trackX: number,
    trackRight: number,
    laneW: number,
    height: number,
    energy: number
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // Four rail positions: left edge, two dividers, right edge.
    const rails: Array<{ x: number; c: Rgb }> = [
      { x: trackX, c: this.laneColors[0] },
      { x: trackX + laneW, c: mix(this.laneColors[0], this.laneColors[1], 0.5) },
      { x: trackX + laneW * 2, c: mix(this.laneColors[1], this.laneColors[2], 0.5) },
      { x: trackRight, c: this.laneColors[2] },
    ];

    for (const rail of rails) {
      // Soft halo column around the rail.
      const halo = ctx.createLinearGradient(rail.x - 6, 0, rail.x + 6, 0);
      halo.addColorStop(0, rgba(rail.c, 0));
      halo.addColorStop(0.5, rgba(rail.c, 0.18 + energy * 0.14));
      halo.addColorStop(1, rgba(rail.c, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(rail.x - 6, 0, 12, height);
      // Crisp 1px neon core.
      ctx.strokeStyle = rgba(rail.c, 0.5 + energy * 0.3);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rail.x, 0);
      ctx.lineTo(rail.x, height);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Premium glass strum bar with neon edge + breathing bloom, color-led by heat. */
  private drawStrumBar(
    trackX: number,
    trackWidth: number,
    strumY: number,
    now: number,
    energy: number,
    heat: number,
    board: Readonly<ReturnType<typeof getBoardState>>
  ): void {
    const ctx = this.ctx;
    const breathe = 0.5 + 0.5 * Math.sin(now * 0.004);

    // Lead color: blend toward the lane of the most recent flash.
    let lead: Rgb = mix(this.laneColors[0], this.laneColors[2], 0.5);
    let freshest = -Infinity;
    for (let i = 0; i < 3; i++) {
      const f = board.laneFlash[i];
      if (f.at > freshest) {
        freshest = f.at;
        const age = (now - f.at) / 1000;
        if (age < 0.5) lead = mix(lead, this.laneColors[i], 1 - age / 0.5);
      }
    }

    // Glass slab behind the line.
    ctx.save();
    const barH = 26;
    const slab = ctx.createLinearGradient(0, strumY - barH / 2, 0, strumY + barH / 2);
    slab.addColorStop(0, rgba(lead, 0.02));
    slab.addColorStop(0.5, rgba(lead, 0.14 + heat * 0.12 + breathe * 0.04));
    slab.addColorStop(1, rgba(lead, 0.02));
    ctx.fillStyle = slab;
    ctx.fillRect(trackX, strumY - barH / 2, trackWidth, barH);

    // Top glass highlight hairline.
    ctx.fillStyle = rgba({ r: 255, g: 255, b: 255 }, 0.08 + breathe * 0.05);
    ctx.fillRect(trackX, strumY - barH / 2, trackWidth, 1);

    // The neon line itself — additive, blooming.
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowBlur = 10 + breathe * 10 + heat * 14 + energy * 8;
    ctx.shadowColor = rgbStr(lead);
    ctx.strokeStyle = rgba(lead, 0.6 + breathe * 0.3 + heat * 0.1 + energy * 0.08);
    ctx.lineWidth = 2.5 + energy * 1;
    ctx.beginPath();
    ctx.moveTo(trackX, strumY);
    ctx.lineTo(trackX + trackWidth, strumY);
    ctx.stroke();
    // Bright white inner core for that "hot wire" pop.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = rgba({ r: 255, g: 255, b: 255 }, 0.25 + breathe * 0.2);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(trackX, strumY);
    ctx.lineTo(trackX + trackWidth, strumY);
    ctx.stroke();
    ctx.restore();
  }

  /** Glass fret pad with idle breathe, press slam, and a hit-flash column. */
  private drawFretPad(
    lane: LaneIndex,
    strumY: number,
    now: number,
    isActive: boolean,
    energy: number,
    flash: LaneFlash
  ): void {
    const ctx = this.ctx;
    const cx = this.laneSystem.getLaneX(lane);
    const c = this.laneColors[lane];
    const r = this.laneSystem.getNoteRadius();

    // --- Hit flash column: a bright lane-colored beam shooting up from the pad
    //     the instant a note lands here (decays over ~360ms). The particles
    //     come from the VFX layer; this is the lane's own light response. ---
    const flashAge = (now - flash.at) / 1000;
    if (flashAge >= 0 && flashAge < 0.36) {
      const k = 1 - flashAge / 0.36;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const beamW = r * (0.9 + (1 - k) * 0.5);
      const beam = ctx.createLinearGradient(0, strumY - r * 7, 0, strumY);
      beam.addColorStop(0, rgba(c, 0));
      beam.addColorStop(1, rgba(c, 0.5 * k * flash.power));
      ctx.fillStyle = beam;
      ctx.fillRect(cx - beamW, strumY - r * 7, beamW * 2, r * 7);
      ctx.restore();
    }

    const idle = 0.5 + 0.5 * Math.sin(now * 0.003 + lane * 1.3);

    ctx.save();
    if (isActive) {
      // PRESSED — bright slam: filled neon core, white-hot center, expanding halo.
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = 30;
      ctx.shadowColor = rgbStr(c);
      // Filled disc.
      ctx.beginPath();
      ctx.arc(cx, strumY, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(c, 0.85);
      ctx.fill();
      // White core.
      ctx.beginPath();
      ctx.arc(cx, strumY, r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = rgba({ r: 255, g: 255, b: 255 }, 0.9);
      ctx.fill();
      // Expanding halo ring.
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(cx, strumY, r * 1.4, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(c, 0.7);
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      // RESTING — glassy hollow ring with a soft inner well + idle breathe glow.
      // Glass well (subtle dark dish so the pad reads as a physical button).
      const well = ctx.createRadialGradient(cx, strumY, 0, cx, strumY, r);
      well.addColorStop(0, rgba(this.bgBot, 0.55));
      well.addColorStop(0.7, rgba(this.bgTop, 0.5));
      well.addColorStop(1, rgba(this.bgTop, 0.0));
      ctx.fillStyle = well;
      ctx.beginPath();
      ctx.arc(cx, strumY, r, 0, Math.PI * 2);
      ctx.fill();

      // Neon ring (additive glow).
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = 6 + idle * 8 + energy * 8;
      ctx.shadowColor = rgbStr(c);
      ctx.strokeStyle = rgba(c, 0.55 + idle * 0.25 + energy * 0.15);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx, strumY, r, 0, Math.PI * 2);
      ctx.stroke();
      // Thin bright inner rim highlight (glass edge).
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba({ r: 255, g: 255, b: 255 }, 0.12 + idle * 0.08);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, strumY, r * 0.86, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // NOTES — motion trails, glass cards w/ approach bloom, hit pop.
  // -------------------------------------------------------------------------
  drawNotes(notes: Note[]) {
    const ctx = this.ctx;
    const now = performance.now();
    const strumY = this.laneSystem.getStrumLineY();
    const r = this.laneSystem.getNoteRadius();

    // PASS 1 — additive motion trails behind every live note (comet tails that
    // brighten as they approach the strum line). One additive pass = cheap bloom.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const note of notes) {
      if (note.missed || note.hit || note.y < -50) continue;
      const cx = this.laneSystem.getLaneX(note.lane);
      const y = note.y;
      const c = this.laneColors[note.lane];
      const proximity = clamp01(1 - Math.abs(y - strumY) / (strumY + 1));
      const trailLen = r * (2.0 + proximity * 2.8);
      const grad = ctx.createLinearGradient(0, y - trailLen, 0, y);
      grad.addColorStop(0, rgba(c, 0));
      grad.addColorStop(1, rgba(c, 0.28 + proximity * 0.34));
      ctx.fillStyle = grad;
      const tw = r * (0.42 + proximity * 0.24);
      ctx.beginPath();
      ctx.moveTo(cx - tw, y);
      ctx.lineTo(cx + tw, y);
      ctx.lineTo(cx + tw * 0.22, y - trailLen);
      ctx.lineTo(cx - tw * 0.22, y - trailLen);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // PASS 2 — glass cards (+ hit pop).
    for (const note of notes) {
      if (note.missed) continue;
      const cx = this.laneSystem.getLaneX(note.lane);
      const y = note.y;
      const c = this.laneColors[note.lane];

      // HIT POP — quick expanding white core + lane ring, owned by Renderer so
      // the note's own light response reads instantly even before particles.
      if (note.hit) {
        if (note.hitTime && now - note.hitTime < 320) {
          const t = (now - note.hitTime) / 320;
          const a = 1 - t;
          const rr = r * (1 + t * 0.8);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.translate(cx, y);
          // White flash core.
          ctx.beginPath();
          ctx.arc(0, 0, rr * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = rgba({ r: 255, g: 255, b: 255 }, a * 0.85);
          ctx.fill();
          // Lane shockring.
          ctx.beginPath();
          ctx.arc(0, 0, rr * 1.4, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(c, a * 0.9);
          ctx.lineWidth = 5 * a + 1;
          ctx.stroke();
          ctx.restore();
        }
        continue;
      }

      if (y < -50) continue;

      const proximity = clamp01(1 - Math.abs(y - strumY) / (strumY + 1));
      const pulse = 0.5 + 0.5 * Math.sin(now * 0.011 + note.lane * 1.7);

      // UNIFORM, FIXED-SIZE cards across all lanes. Every card carries a SINGLE
      // target-language word, so the card geometry is constant and the word is
      // always laid out on ONE line (shrink-to-fit for the rare long token), with
      // comfortable padding — never wrapped, never clipped.
      const laneW = this.laneSystem.getLaneBounds(0).width;
      const cardW = laneW * 0.88;
      const cardH = r * 1.5;
      const wordFont = "'Russo One', 'Lingo Sans', system-ui, sans-serif";
      const fontSize = note.text
        ? fitOneLine(ctx, note.text, cardW - 26, Math.round(r * 0.6), 17, wordFont)
        : 0;
      const x = cx - cardW / 2;
      const cardY = y - cardH / 2;
      const radius = Math.min(16, cardH * 0.32);

      // The CATCHABLE target card gets the strong bloom; distractor cards read
      // clearly present but with restrained glow so the eye locks onto the word
      // to catch (tightened bloom — it never washes out the text).
      const isTgt = note.isTarget;
      const glowK = isTgt ? 1 : 0.42;

      // --- APPROACH BLOOM: a soft lane-colored glow pad behind the card that
      //     swells as it nears the strum line (anticipation). Reserved-strong
      //     for the target lane; muted for distractors. Additive. ---
      if (proximity > 0.02 && isTgt) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const bloomR = cardW * (0.6 + proximity * 0.42);
        const bg = ctx.createRadialGradient(cx, y, 0, cx, y, bloomR);
        bg.addColorStop(0, rgba(c, (0.13 + pulse * 0.04) * proximity));
        bg.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(cx, y, bloomR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // --- GLASS CARD BODY ---
      ctx.save();
      ctx.globalAlpha = isTgt ? 1 : 0.9;
      // Outer neon glow on the card edge (scales with proximity, tightened so it
      // never bleeds over the word).
      ctx.shadowBlur = (8 + proximity * 12 + pulse * 3) * glowK;
      ctx.shadowColor = rgbStr(c);

      // Frosted glass fill: vertical gradient from a lifted top to a darker base.
      const glass = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
      glass.addColorStop(0, rgba(mix(this.bgBot, c, isTgt ? 0.14 : 0.06), 0.95));
      glass.addColorStop(0.5, rgba(mix(this.bgMid, c, 0.05), 0.97));
      glass.addColorStop(1, rgba(this.bgTop, 0.96));
      ctx.fillStyle = glass;
      roundRectPath(ctx, x, cardY, cardW, cardH, radius);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Top glass highlight sheen (the "Apple-grade" specular line).
      const sheen = ctx.createLinearGradient(0, cardY, 0, cardY + cardH * 0.5);
      sheen.addColorStop(0, rgba({ r: 255, g: 255, b: 255 }, isTgt ? 0.16 : 0.1));
      sheen.addColorStop(1, rgba({ r: 255, g: 255, b: 255 }, 0));
      ctx.fillStyle = sheen;
      roundRectPath(ctx, x + 2, cardY + 2, cardW - 4, cardH * 0.5, radius * 0.8);
      ctx.fill();

      // Neon border.
      ctx.strokeStyle = rgba(c, (isTgt ? 0.8 + proximity * 0.2 : 0.5));
      ctx.lineWidth = (isTgt ? 2 + proximity * 1.4 : 1.5);
      roundRectPath(ctx, x, cardY, cardW, cardH, radius);
      ctx.stroke();

      // Lane-color accent spine on the leading (left) edge. CLIP to the card's
      // rounded-rect so the spine's top/bottom follow the card's rounded corners
      // EXACTLY (a plain bar would poke past the rounding). We clip to the full
      // card path, then paint a left-edge band; the clip carves it to the curve.
      ctx.save();
      roundRectPath(ctx, x, cardY, cardW, cardH, radius);
      ctx.clip();
      ctx.fillStyle = rgba(c, isTgt ? 0.95 : 0.6);
      ctx.fillRect(x, cardY, 6, cardH);
      ctx.restore();
      ctx.restore();

      // --- WORD (single line, centered, always inside with padding) ---
      if (fontSize > 0) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${fontSize}px ${wordFont}`;
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 4;
        ctx.fillStyle = isTgt
          ? rgbStr(this.textColor)
          : rgba(this.textColor, 0.82);
        ctx.fillText(note.text, cx + 3, y);
        ctx.restore();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Color + path helpers (module-scope, allocation-light).
// ---------------------------------------------------------------------------

/**
 * Fit a SINGLE word on ONE line inside a uniform card: use `baseFont` if it
 * fits within `maxW`; otherwise shrink to fit, floored at `minFont` (the rare
 * very long token stays on one line at the floor rather than wrapping or
 * overflowing — every catchable token is a single word, so this stays
 * comfortably readable). Returns the px font size to use.
 */
function fitOneLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  baseFont: number,
  minFont: number,
  family: string
): number {
  ctx.font = `bold ${baseFont}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w <= maxW || w === 0) return baseFont;
  const fit = (maxW / w) * baseFont;
  return Math.max(minFont, Math.min(baseFont, fit));
}

function cssVar(root: HTMLElement | null, name: string): string {
  if (!root || typeof getComputedStyle !== "function") return "";
  try {
    return getComputedStyle(root).getPropertyValue(name).trim();
  } catch {
    return "";
  }
}

/** Parse #rgb / #rrggbb / rgb()/rgba() into an Rgb, else null. */
function parseColor(v: string): Rgb | null {
  if (!v) return null;
  const s = v.trim();
  if (s[0] === "#") {
    let hex = s.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length >= 6) {
      const n = parseInt(hex.slice(0, 6), 16);
      if (!Number.isNaN(n)) {
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
      }
    }
    return null;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (m) {
    return { r: +m[1], g: +m[2], b: +m[3] };
  }
  return null;
}

function rgbStr(c: Rgb): string {
  return `rgb(${c.r | 0},${c.g | 0},${c.b | 0})`;
}

function rgba(c: Rgb, a: number): string {
  const aa = a < 0 ? 0 : a > 1 ? 1 : a;
  return `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${aa})`;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** roundRect with a per-corner radius array fallback for older engines. */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | [number, number, number, number]
): void {
  ctx.beginPath();
  const anyCtx = ctx as CanvasRenderingContext2D & {
    roundRect?: (
      x: number,
      y: number,
      w: number,
      h: number,
      r: number | number[]
    ) => void;
  };
  if (typeof anyCtx.roundRect === "function") {
    anyCtx.roundRect(x, y, w, h, radius as number | number[]);
    return;
  }
  // Manual rounded rect (uniform radius fallback).
  const r = Array.isArray(radius) ? radius[0] : radius;
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
