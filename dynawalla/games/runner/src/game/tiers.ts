/**
 * Quality tiers.
 *
 * The mid-range tablet sets the FLOOR, never the ceiling. LOW must hold 60fps
 * on a 2019 Android tablet with a soldered GPU; ULTRA is allowed to be greedy.
 *
 * Tier is *guessed* from device signals and then *corrected* by the frame clock:
 * `TierController.observe()` demotes after a sustained stall and (once only, to
 * avoid oscillation) promotes back if the demotion left a lot of headroom.
 */

export type TierName = "low" | "mid" | "high" | "ultra";

export type TierSettings = {
  name: TierName;
  /** Device-pixel-ratio ceiling. */
  dprCap: number;
  /** Off-screen composite: bloom + chromatic aberration. Costs two extra passes. */
  post: boolean;
  /** Bloom blur iterations (each is one downsampled ping-pong). */
  bloomPasses: number;
  /** Live particle ceiling. */
  particles: number;
  /** Speed-streak instance count around the camera. */
  streaks: number;
  /** Deck subdivisions along z — the world-bend needs vertices to bend. */
  deckSegments: number;
  /** How far the camera can see, in world units. */
  far: number;
  /** Roadside monolith instances alive at once. */
  monoliths: number;
  /** Reflected light-ocean under the causeway. */
  ocean: boolean;
  /** Per-object emissive halo sprites (the cheap neon that works everywhere). */
  halos: boolean;
  /** Shadow-ish contact darkening under the skiff. */
  contactShadow: boolean;
};

const TIERS: Record<TierName, TierSettings> = {
  low: {
    name: "low",
    dprCap: 1.25,
    post: false,
    bloomPasses: 0,
    particles: 220,
    streaks: 0,
    deckSegments: 44,
    far: 300,
    monoliths: 26,
    ocean: false,
    halos: true,
    contactShadow: false,
  },
  mid: {
    name: "mid",
    dprCap: 1.6,
    post: true,
    bloomPasses: 2,
    particles: 620,
    streaks: 64,
    deckSegments: 84,
    far: 380,
    monoliths: 44,
    ocean: true,
    halos: true,
    contactShadow: true,
  },
  high: {
    name: "high",
    dprCap: 2,
    post: true,
    bloomPasses: 3,
    particles: 1200,
    streaks: 128,
    deckSegments: 120,
    far: 440,
    monoliths: 64,
    ocean: true,
    halos: true,
    contactShadow: true,
  },
  ultra: {
    name: "ultra",
    dprCap: 2,
    post: true,
    bloomPasses: 4,
    particles: 2400,
    streaks: 220,
    deckSegments: 168,
    far: 520,
    monoliths: 92,
    ocean: true,
    halos: true,
    contactShadow: true,
  },
};

const ORDER: TierName[] = ["low", "mid", "high", "ultra"];

export function detectTier(gl: WebGL2RenderingContext | WebGLRenderingContext | null): TierName {
  let score = 0;

  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 0;
  if (mem >= 8) score += 3;
  else if (mem >= 4) score += 2;
  else if (mem > 0) score += 0;
  else score += 1; // unknown (Safari): assume middling rather than punishing it

  const cores = navigator.hardwareConcurrency ?? 4;
  if (cores >= 10) score += 3;
  else if (cores >= 6) score += 2;
  else if (cores >= 4) score += 1;

  if (gl) {
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (maxTex >= 16384) score += 2;
    else if (maxTex >= 8192) score += 1;

    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? "") : "";
    const r = renderer.toLowerCase();
    // Apple silicon and desktop discrete parts are known-good.
    if (/apple (m\d|a1[5-9]|a2\d)/.test(r)) score += 3;
    else if (/(rtx|radeon rx|geforce|arc a\d)/.test(r)) score += 3;
    else if (/adreno \(tm\) (7\d\d|8\d\d)/.test(r)) score += 2;
    else if (/(mali-g7|mali-g8|mali-g9|xclipse)/.test(r)) score += 1;
    else if (/(swiftshader|llvmpipe|software)/.test(r)) score -= 6;
  }

  // A tiny viewport is usually a phone, and a phone is usually thermally capped.
  const px = window.innerWidth * window.innerHeight * Math.min(window.devicePixelRatio || 1, 2);
  if (px > 3_000_000) score -= 1;

  if (score <= 2) return "low";
  if (score <= 5) return "mid";
  if (score <= 8) return "high";
  return "ultra";
}

/**
 * Watches the frame clock and moves the tier when reality disagrees with the
 * guess. Demotion is aggressive (a child feeling 40fps is a real cost);
 * promotion happens at most once, and only from a demoted state.
 */
export class TierController {
  tier: TierName;
  settings: TierSettings;
  /** Extra render-scale multiplier applied on top of dprCap; 1 -> 0.72. */
  renderScale = 1;

  private acc = 0;
  private frames = 0;
  private slowStreak = 0;
  private fastStreak = 0;
  private demoted = false;
  private promotedOnce = false;
  private cooldown = 2.5;
  private onChange: () => void;
  lastFps = 60;

  constructor(initial: TierName, onChange: () => void) {
    this.tier = initial;
    this.settings = TIERS[initial];
    this.onChange = onChange;
  }

  force(name: TierName): void {
    if (name === this.tier) return;
    this.tier = name;
    this.settings = TIERS[name];
    this.renderScale = 1;
    this.cooldown = 3;
    this.demoted = false;
    this.promotedOnce = true; // manual choice wins; stop auto-promoting
    this.onChange();
  }

  observe(dt: number): void {
    this.acc += dt;
    this.frames++;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.acc < 0.5) return;

    const fps = this.frames / this.acc;
    this.lastFps = fps;
    this.acc = 0;
    this.frames = 0;
    if (this.cooldown > 0) return;

    if (fps < 52) {
      this.slowStreak++;
      this.fastStreak = 0;
    } else if (fps > 58) {
      this.fastStreak++;
      this.slowStreak = 0;
    } else {
      this.slowStreak = 0;
      this.fastStreak = 0;
    }

    if (this.slowStreak >= 3) {
      this.slowStreak = 0;
      // Drop resolution first — it is invisible next to dropping the bloom.
      if (this.renderScale > 0.74) {
        this.renderScale = Math.max(0.72, this.renderScale - 0.14);
        this.cooldown = 2.5;
        this.demoted = true;
        this.onChange();
        return;
      }
      const i = ORDER.indexOf(this.tier);
      if (i > 0) {
        this.tier = ORDER[i - 1];
        this.settings = TIERS[this.tier];
        this.renderScale = 1;
        this.cooldown = 4;
        this.demoted = true;
        this.onChange();
      }
    } else if (this.fastStreak >= 8 && this.demoted && !this.promotedOnce) {
      this.fastStreak = 0;
      this.promotedOnce = true;
      if (this.renderScale < 1) {
        this.renderScale = 1;
      } else {
        const i = ORDER.indexOf(this.tier);
        if (i < ORDER.length - 1) {
          this.tier = ORDER[i + 1];
          this.settings = TIERS[this.tier];
        }
      }
      this.cooldown = 6;
      this.onChange();
    }
  }
}
