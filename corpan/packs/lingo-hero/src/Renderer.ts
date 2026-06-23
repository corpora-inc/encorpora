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
    // Top of the play field — all lane FX + notes are clipped to [fieldTop,
    // height] so beams/cards never bloom up into the DOM HUD band.
    const fieldTop = this.laneSystem.getPlayFieldTop();

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

    // CLIP EVERYTHING BELOW TO THE PLAY FIELD. The grid, lane shafts, rails,
    // strum bar and fret pads all draw inside [fieldTop, height] so their glow
    // can never bleed up over the prompt/score HUD band. (drawNotes applies the
    // same clip.) A tiny feather at the top keeps the clip edge from reading as
    // a hard seam.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, fieldTop, width, height - fieldTop);
    ctx.clip();

    // A soft top scrim that fades the field into the HUD band (so the clip edge
    // is a graceful gradient, not a razor line).
    const topFade = ctx.createLinearGradient(0, fieldTop, 0, fieldTop + 36);
    topFade.addColorStop(0, rgba(this.bgTop, 0.6));
    topFade.addColorStop(1, rgba(this.bgTop, 0));
    ctx.fillStyle = topFade;
    ctx.fillRect(0, fieldTop, width, 36);

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
    // Shaft top is clamped to the play field so the beam is a contained column,
    // not a full-height cone that merges with the hit rings.
    const shaftTop = Math.max(fieldTop, strumY - height * 0.5);
    for (let i = 0; i < 3; i++) {
      const c = this.laneColors[i];
      const cx = this.laneSystem.getLaneX(i as LaneIndex);
      // NARROWED: a contained column (was the full lane width) + stops short of
      // the strum so the ring sits in clear air, not inside the beam's brightest
      // band. This is the fix for the "cones merge into the rings" washout.
      const halfW = lane0.width * 0.28;
      const shaftBottom = strumY - this.laneSystem.getNoteRadius() * 1.3;
      const shaft = ctx.createLinearGradient(0, shaftTop, 0, shaftBottom);
      // HARD-CAPPED, energy-modest alpha so the shafts stay faint ambient lane
      // light and never bloom into the bright cones that wash the playfield
      // (fixes major (d)). Peak alpha is half what it was.
      const baseA = Math.min(0.032, 0.018 + energy * 0.014);
      shaft.addColorStop(0, rgba(c, 0));
      shaft.addColorStop(0.85, rgba(c, baseA));
      shaft.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = shaft;
      ctx.fillRect(cx - halfW, shaftTop, halfW * 2, shaftBottom - shaftTop);

      // A tighter, dimmer central glow line down each lane (also stops short).
      const core = ctx.createLinearGradient(cx - halfW * 0.12, 0, cx + halfW * 0.12, 0);
      core.addColorStop(0, rgba(c, 0));
      core.addColorStop(0.5, rgba(c, Math.min(0.06, 0.03 + energy * 0.025)));
      core.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = core;
      ctx.fillRect(cx - halfW * 0.12, shaftTop, halfW * 0.24, shaftBottom - shaftTop);
    }
    ctx.restore();

    // 4) LANE EDGE RAILS — glowing neon dividers framing the three lanes. The
    //    outer rails blend the two adjacent lane colors; inner dividers too.
    this.drawLaneRails(trackX, trackRight, lane0.width, height, energy);

    // 5) STRUM LINE — a premium glass energy bar with a bright neon edge and a
    //    breathing bloom. Color leans toward the hottest recent lane.
    this.drawStrumBar(trackX, trackWidth, strumY, now, energy, heat, board);

    // 5b) HIT-WINDOW BAND — a defined "now tap" zone bracketing the strum line so
    //     the rhythm read is unambiguous (the timing window the game actually
    //     scores against). Two faint guide lines + a soft fill; drawn UNDER the
    //     fret rings so the rings stay the crisp focal target.
    this.drawHitWindow(trackX, trackWidth, strumY, now, energy);

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

    // Close the play-field clip opened after the sky fill.
    ctx.restore();
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
      // Soft halo column around the rail (capped so the dividers stay crisp
      // lines, not glowing bars that merge with the lane shafts).
      const halo = ctx.createLinearGradient(rail.x - 5, 0, rail.x + 5, 0);
      const haloA = Math.min(0.12, 0.09 + energy * 0.06);
      halo.addColorStop(0, rgba(rail.c, 0));
      halo.addColorStop(0.5, rgba(rail.c, haloA));
      halo.addColorStop(1, rgba(rail.c, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(rail.x - 5, 0, 10, height);
      // Crisp 1px neon core.
      ctx.strokeStyle = rgba(rail.c, 0.45 + energy * 0.25);
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

  /**
   * The defined HIT-WINDOW band: the scoring zone around the strum line drawn as
   * a pair of faint guide hairlines (top = "approach edge", bottom = "release
   * edge") with a barely-there fill between them. Gives the rhythm game a clear
   * "now tap" region distinct from the approach beam. Height tracks the actual
   * timing tolerance (≈ the note radius) so what you see is what's scored.
   */
  private drawHitWindow(
    trackX: number,
    trackWidth: number,
    strumY: number,
    now: number,
    energy: number
  ): void {
    const ctx = this.ctx;
    const r = this.laneSystem.getNoteRadius();
    const band = r * 1.05; // half-height of the visible window
    const breathe = 0.5 + 0.5 * Math.sin(now * 0.0035);
    ctx.save();
    // Soft fill between the brackets (source-over, low alpha — never additive so
    // it can't pile onto the beam and wash the rings).
    const fill = ctx.createLinearGradient(0, strumY - band, 0, strumY + band);
    fill.addColorStop(0, rgba({ r: 255, g: 255, b: 255 }, 0));
    fill.addColorStop(0.5, rgba({ r: 255, g: 255, b: 255 }, 0.03 + breathe * 0.015));
    fill.addColorStop(1, rgba({ r: 255, g: 255, b: 255 }, 0));
    ctx.fillStyle = fill;
    ctx.fillRect(trackX, strumY - band, trackWidth, band * 2);
    // Two guide hairlines marking the window edges.
    ctx.strokeStyle = rgba({ r: 255, g: 255, b: 255 }, 0.1 + energy * 0.06);
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(trackX, strumY - band);
    ctx.lineTo(trackX + trackWidth, strumY - band);
    ctx.moveTo(trackX, strumY + band);
    ctx.lineTo(trackX + trackWidth, strumY + band);
    ctx.stroke();
    ctx.setLineDash([]);
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
      // CAPPED: shorter, narrower beam (was r*7 tall, full lane) + lower peak
      // alpha so the hit response doesn't bloom into a cone over the rings.
      const beamW = r * (0.55 + (1 - k) * 0.3);
      const beamH = r * 3.2;
      const beam = ctx.createLinearGradient(0, strumY - beamH, 0, strumY);
      beam.addColorStop(0, rgba(c, 0));
      beam.addColorStop(1, rgba(c, 0.34 * k * flash.power));
      ctx.fillStyle = beam;
      ctx.fillRect(cx - beamW, strumY - beamH, beamW * 2, beamH);
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

      // GLOW UNDERLAY (additive, capped) — a soft halo so the ring reads neon,
      // kept separate from the crisp stroke below so it can't wash the ring out.
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = Math.min(14, 5 + idle * 5 + energy * 5);
      ctx.shadowColor = rgbStr(c);
      ctx.strokeStyle = rgba(c, 0.28 + idle * 0.12);
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(cx, strumY, r, 0, Math.PI * 2);
      ctx.stroke();

      // CRISP RING — drawn source-over (NOT additive) at full opacity so it
      // always sits sharp ON TOP of any beam/shaft glow. This is the high-
      // contrast hit target the player reads.
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 0;
      ctx.strokeStyle = rgba(c, 0.95);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, strumY, r, 0, Math.PI * 2);
      ctx.stroke();
      // Thin bright inner rim highlight (glass edge).
      ctx.strokeStyle = rgba({ r: 255, g: 255, b: 255 }, 0.16 + idle * 0.08);
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
    const fieldTop = this.laneSystem.getPlayFieldTop();
    const width = parseFloat(this.canvas.style.width);
    const height = parseFloat(this.canvas.style.height);
    // Half-height of the scored hit window (matches drawHitWindow's band).
    const hitBand = r * 1.05;

    // Clip ALL note drawing to the play field so a freshly spawned card can
    // never paint over the HUD band above fieldTop.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, fieldTop, width, height - fieldTop);
    ctx.clip();

    // PASS 1 — additive motion trails behind every live note (comet tails that
    // brighten as they approach the strum line). One additive pass = cheap bloom.
    // The card's center is clamped to stop a fixed gap above the ring (see
    // drawNotes PASS 2); the trail must follow the CARD, not the raw note.y, so
    // it never streaks down across the card→ring gap into the fret ring.
    const ringTop = strumY - r;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const note of notes) {
      if (note.missed || note.hit || note.y < -50) continue;
      const cx = this.laneSystem.getLaneX(note.lane);
      const cardH = Math.min(r * 1.35, 96);
      const RING_GAP = Math.max(10, r * 0.22);
      const maxCardCenter = ringTop - RING_GAP - cardH / 2;
      const y = Math.min(note.y, maxCardCenter); // trail tracks the drawn card
      const c = this.laneColors[note.lane];
      const proximity = clamp01(1 - Math.abs(note.y - strumY) / (strumY + 1));
      const trailLen = r * (1.6 + proximity * 2.2);
      const grad = ctx.createLinearGradient(0, y - trailLen, 0, y);
      grad.addColorStop(0, rgba(c, 0));
      grad.addColorStop(1, rgba(c, 0.2 + proximity * 0.26));
      ctx.fillStyle = grad;
      const tw = r * (0.38 + proximity * 0.2);
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
      // CONTACT STATE: the card is inside the scored hit window ("now tap").
      const inWindow = Math.abs(y - strumY) <= hitBand;

      // UNIFORM single-word cards: every lane's card is the SAME rigid slot —
      // IDENTICAL width, height and corner radius across all three lanes,
      // computed ONCE from the lane geometry and totally independent of the
      // word's length (a short "I" reads in the exact same box as "thank").
      // Only the lane COLOR and the (single) word inside differ. The word sits
      // on ONE line, shrink-to-fit only as a safety net for a rare long token,
      // with >=PAD px of inner padding the text never crosses. (Fixes blocker
      // (c): no per-content sizing.)
      const laneW = this.laneSystem.getLaneBounds(0).width;
      // Fixed slot dims — clamped to safe constants so the box is the same on
      // every lane and every frame, and never deforms as it descends.
      const cardW = Math.min(laneW * 0.82, 132);
      const cardH = Math.min(r * 1.35, 96); // fixed for ALL cards
      const PAD = 16; // >=12px inner padding requirement
      // Constant card→ring gap: the card NEVER overlaps the fret ring. We clamp
      // the card's CENTER so its bottom edge always stays a fixed gap above the
      // ring's top, even as note.y crosses the strum line — so the rounded card
      // and the circular ring stay two visibly distinct elements (fixes blocker
      // (b) "card merges into the ring" and minor "ambiguous card↔ring gap").
      const RING_GAP = Math.max(10, r * 0.22);
      const ringTop = strumY - r;
      const maxCardCenter = ringTop - RING_GAP - cardH / 2;
      const drawCy = Math.min(y, maxCardCenter);
      const x = cx - cardW / 2;
      const cardY = drawCy - cardH / 2;
      const radius = 14; // CONSTANT corner radius — never scales with the box

      const wordFont = "'Russo One', 'Lingo Sans', system-ui, sans-serif";
      const layout = note.text
        ? fitWord(
            ctx,
            note.text,
            // Usable text width = card minus L/R padding minus the accent spine.
            cardW - PAD * 2 - 6,
            Math.max(20, r * 0.6),
            14,
            wordFont
          )
        : null;

      // --- APPROACH BLOOM: a soft lane-colored glow pad behind the card that
      //     swells as it nears the strum line (anticipation). Additive but
      //     TIGHT + CAPPED — small radius, low alpha, identical per lane, so it
      //     never washes out the word or the hit rings underneath. ---
      if (proximity > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const bloomR = cardW * (0.34 + proximity * 0.12);
        const bloomA = Math.min(0.08, 0.05 * proximity + (inWindow ? 0.03 : 0));
        const bg = ctx.createRadialGradient(cx, drawCy, 0, cx, drawCy, bloomR);
        bg.addColorStop(0, rgba(c, bloomA));
        bg.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(cx, drawCy, bloomR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // --- GLASS CARD BODY — a discrete, rigid slot drawn as ONE layer above
      //     the ring. Constant box + corner radius every frame; never morphs. ---
      ctx.save();
      // Outer neon glow on the card edge — uniform across lanes; a small extra
      // lift ONLY in the hit window so "now tap" reads as a contact state.
      // Capped so the card's own glow can't bloom into the ring below.
      ctx.shadowBlur = (inWindow ? 12 : 7) + proximity * 5;
      ctx.shadowColor = rgbStr(c);

      // SCRIM PASS: an OPAQUE dark base behind the card so whatever lane beam or
      // ghost sits behind it is fully occluded — guarantees word contrast and
      // makes the card read as a solid object on top of the field (fixes major
      // (d) "ghosts/beams wash into the field"). Drawn source-over, fully solid.
      ctx.fillStyle = rgbStr(mix(this.bgTop, { r: 0, g: 0, b: 0 }, 0.25));
      roundRectPath(ctx, x, cardY, cardW, cardH, radius);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Frosted glass tint on top of the opaque scrim (now fully opaque overall).
      const glass = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
      glass.addColorStop(0, rgba(mix(this.bgBot, c, 0.16), 1));
      glass.addColorStop(0.5, rgba(mix(this.bgMid, c, 0.07), 1));
      glass.addColorStop(1, rgba(this.bgTop, 1));
      ctx.fillStyle = glass;
      roundRectPath(ctx, x, cardY, cardW, cardH, radius);
      ctx.fill();

      // Top glass highlight sheen (the "Apple-grade" specular line).
      const sheen = ctx.createLinearGradient(0, cardY, 0, cardY + cardH * 0.5);
      sheen.addColorStop(0, rgba({ r: 255, g: 255, b: 255 }, 0.14));
      sheen.addColorStop(1, rgba({ r: 255, g: 255, b: 255 }, 0));
      ctx.fillStyle = sheen;
      roundRectPath(ctx, x + 2, cardY + 2, cardW - 4, cardH * 0.5, radius * 0.7);
      ctx.fill();

      // Neon border — uniform weight across lanes; a crisp brighter ring ONLY
      // when the card is in the hit window (the "contact" cue).
      ctx.strokeStyle = rgba(c, inWindow ? 1 : 0.9);
      ctx.lineWidth = inWindow ? 3 : 2;
      roundRectPath(ctx, x, cardY, cardW, cardH, radius);
      ctx.stroke();

      // Lane-color accent spine on the leading (left) edge.
      ctx.fillStyle = rgba(c, 0.95);
      roundRectPath(ctx, x, cardY, 6, cardH, [radius, 0, 0, radius]);
      ctx.fill();
      ctx.restore();

      // --- WORD (single line, centered in the usable area, never touches the
      //     border or the accent spine) ---
      if (layout) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${layout.fontSize}px ${wordFont}`;
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 4;
        ctx.fillStyle = rgbStr(this.textColor);
        // Centered in the area right of the 6px spine so it never crowds it.
        ctx.fillText(layout.text, cx + 3, drawCy);
        ctx.restore();
      }
    }

    // Close the play-field clip opened at the top of drawNotes.
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Color + path helpers (module-scope, allocation-light).
// ---------------------------------------------------------------------------

/**
 * Fit a SINGLE word on one line inside `maxW` (the card width minus inner
 * padding). Uses `baseFont` if it fits; otherwise shrinks to fit, floored at
 * `minFont`. Word Lanes notes are single, short words by construction, so this
 * almost always returns `baseFont` — the shrink path is just a safety net for a
 * rare long token (e.g. a German compound). The word never wraps and never
 * touches the border (the caller subtracts the padding before passing maxW).
 */
function fitWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  baseFont: number,
  minFont: number,
  family: string
): { text: string; fontSize: number } {
  ctx.font = `bold ${baseFont}px ${family}`;
  const w = ctx.measureText(text).width;
  if (w <= maxW || w === 0) return { text, fontSize: baseFont };
  const fit = (maxW / w) * baseFont;
  return { text, fontSize: Math.max(minFont, Math.min(baseFont, fit)) };
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
