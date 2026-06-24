/**
 * Centralized visual configuration for easy tweaking.
 * All magic numbers for scene rendering extracted here.
 */

// ============================================================
// SCENE SETTINGS
// ============================================================
export const SCENE = {
  // Background clear color (RGBA 0-1)
  clearColor: { r: 0.01, g: 0.015, b: 0.025, a: 1 },

  // Tone mapping and exposure
  exposure: 1.1,        // Scene brightness (0.5 = dark, 1.5 = bright)
  contrast: 1.5,        // Scene contrast (1.0 = neutral)

  // Fog - set density to 0 to disable
  fogDensity: 0.001,      // 0 = off, 0.006 = light fog, 0.015 = heavy
  fogColor: { r: 0.02, g: 0.04, b: 0.08 },
}

// ============================================================
// CAMERA
// ============================================================
export const CAMERA = {
  position: { x: 0, y: -0.05, z: -4.1 },
  target: { x: 0, y: -1.05, z: 10 },
  fov: 1.46,            // Field of view in radians (~84 degrees)
  minZ: 0.1,
  maxZ: 200,
}

// ============================================================
// LIGHTING
// ============================================================
export const LIGHTING = {
  // Hemisphere light (ambient fill)
  hemi: {
    direction: { x: 0, y: 1, z: 0.4 },
    intensity: 0.18,    // Main ambient brightness
    // intensity: 10,
    diffuse: { r: 0.3, g: 0.4, b: 0.6 },
    ground: { r: 0.02, g: 0.025, b: 0.04 },
  },

  // Main directional light (key light)
  accent: {
    direction: { x: -0.25, y: -0.9, z: 0.4 },
    position: { x: 6, y: 10, z: -6 },
    intensity: 5.18,
    // intensity: 0,
    diffuse: { r: 0.5, g: 0.6, b: 0.8 },
    specular: { r: 0.2, g: 0.3, b: 0.4 },
  },

  // Rim/back light for depth separation
  rim: {
    direction: { x: 0.4, y: -0.2, z: -0.9 },
    position: { x: -5, y: 3, z: 8 },
    intensity: 5.18,
    diffuse: { r: 0.4, g: 0.5, b: 0.7 },
    specular: { r: 0.1, g: 0.15, b: 0.25 },
  },
}

// ============================================================
// GLOW LAYER
// ============================================================
export const GLOW = {
  blurKernelSize: 4,   // Blur radius (4 = tight, 64 = wide) - reduced for crispness
  intensity: 0.35,      // Glow strength - reduced for readability
}

// ============================================================
// SHADOWS
// ============================================================
export const SHADOWS = {
  mapSize: 2048,        // Shadow map resolution
  bias: 0.0004,
  normalBias: 0.015,
  darkness: 1,       // Shadow darkness (0 = none, 1 = black)
  frustumEdgeFalloff: 0.3,
}

// ============================================================
// SSAO (Ambient Occlusion)
//
// NOTE: this needs to stay enabled. Turning it off caused visible
// flicker on the avatar/pyramid (likely because the SSAO2 prepass was
// implicitly stabilising render ordering between the pyramid body
// meshes / outline / GlowLayer interactions). The MRT-warning spam on
// iOS WKWebView is annoying but cosmetic — it does NOT crash, and the
// effect renders fine. If you want to address the spam without
// dropping the effect, the correct fix is to pass
// `forceGeometryBuffer: true` to `new SSAO2RenderingPipeline(...)` in
// game.ts (uses the legacy 2-pass path that doesn't trip the MRT
// validator). Don't just flip `enabled` to false.
// ============================================================
export const SSAO = {
  enabled: true,
  ssaoRatio: 0.4,       // Resolution ratio
  blurRatio: 0.4,
  radius: 0.8,          // AO radius
  totalStrength: 0.25,  // AO intensity (0.25 = subtle, 0.8 = strong)
  base: 0.15,
  samples: 8,           // Quality (8 = fast, 32 = high quality)
  maxZ: 100,
  expensiveBlur: false,
}

// ============================================================
// POST-PROCESSING PIPELINE
// ============================================================
export const POST_PROCESSING = {
  // Chromatic Aberration (color fringing at edges)
  //
  // #438 PR-4: dropped 15 -> 5. This is a TEXT game — the player reads glyphs
  // on the phrase surfaces, and amount:15 smeared visible red/blue fringes onto
  // every glyph edge, hurting legibility. 5 keeps a tasteful "premium lens"
  // edge tint at the screen periphery without mauling the text. (Tasteful call,
  // device review.)
  chromaticAberration: {
    enabled: true,
    amount: 5,          // Aberration strength (was 15 — fringed glyphs)
    radialIntensity: 0.8,
  },

  // Vignette (darkened edges)
  vignette: {
    enabled: true,
    weight: 1.5,        // Darkness of edges
    stretch: 0.5,       // Shape of vignette
  },

  // Bloom (glow on bright areas)
  //
  // #438 PR-4: threshold 0.9 / weight 0.99 meant almost nothing crossed the
  // threshold, so the DefaultRenderingPipeline bloom did essentially nothing —
  // the visible "glow" was entirely the GlowLayer. Lowered threshold to 0.7 so
  // the bright neon emissives (road center line, avatar ring, electric arcs)
  // actually bloom, and set weight to 0.45 so it's a tasteful halo, not a
  // blown-out wash. kernel/scale unchanged. (Tasteful call, device review.)
  bloom: {
    enabled: true,
    threshold: 0.7,     // bloom the bright neon emissives (was 0.9 = ~nothing)
    weight: 0.45,       // visible but tasteful halo (was 0.99, paired w/ 0.9 thr)
    kernel: 32,         // Blur radius (8 = sharp, 64 = soft)
    scale: 0.3,         // Bloom texture resolution
  },

  // Sharpen
  //
  // #438 PR-4: nudged 0.2 -> 0.3 to keep glyph edges crisp now that bloom is
  // actually contributing softness. Kept modest to avoid ringing artifacts.
  sharpen: {
    enabled: true,
    edgeAmount: 0.3,    // Sharpening strength (was 0.2)
  },

  // Film Grain
  //
  // #438 PR-4: intensity 3 was a touch coarse over text; eased to 2 for a
  // subtle filmic texture that doesn't compete with glyph legibility.
  grain: {
    enabled: true,
    intensity: 2,       // Grain amount (was 3) — 0 = off, 8 = heavy
    animated: true,
  },
}

// ============================================================
// SKY DOME
// ============================================================
export const SKY = {
  emissiveMultiplier: 0.2, // Overall sky brightness (was 0.05, 0.25, 0.25)
  baseColor: { r: 0.05, g: 0.03, b: 0.02 },

  // Gradient multipliers for top/mid/bottom
  gradient: {
    top: 1.2,
    mid: 0.6,
    bottom: 0.15,
  },

  // Horizon glow
  horizonGlowMultiplier: 1.5,
  horizonGlowAlphaStart: 0.1,
  horizonGlowAlphaEnd: 0.2,

  // Stars
  starCount: 70,
  starBaseAlpha: 0.2,
  starAlphaVariation: 0.1,

  // Rotation speed
  rotationSpeed: 0.008,
}

// ============================================================
// ROAD MATERIAL
// ============================================================
export const ROAD_MATERIAL = {
  albedoColor: { r: 0.4, g: 0.4, b: 0.4 },
  emissiveColor: { r: 0.35, g: 0.35, b: 0.35 },
  metallic: 0.1,
  roughness: 0.85,
  alpha: 0.4,           // Transparency (0 = invisible, 1 = solid)
}

// ============================================================
// DISTANT PYRAMIDS (background scenery)
// ============================================================
export const PYRAMIDS = {
  // Main pyramid (left side)
  main: {
    height: 40,
    diameter: 35,
    position: { x: -35, y: -8, z: 120 },  // Farther back, not in the way
    rotation: Math.PI / 4,
  },

  // Secondary pyramid (right side)
  secondary: {
    height: 28,
    diameter: 22,
    position: { x: 45, y: -10, z: 140 },
    rotation: Math.PI / 6,
  },

  // Material - solid silhouette, minimal emissive
  material: {
    albedo: { r: 0.03, g: 0.04, b: 0.06 },
    emissive: { r: 0.005, g: 0.008, b: 0.012 },  // Very subtle - mostly silhouette
    metallic: 0.05,
    roughness: 0.95,
  },
}

// ============================================================
// SKIN PRESETS (per-theme overrides)
// Now uses LIGHTING as base - change LIGHTING to affect all skins
// ============================================================
export const SKIN_PRESETS = {
  neon: {
    sky: { r: 0.01, g: 0.02, b: 0.04, a: 1 },
    hemi: {
      intensity: LIGHTING.hemi.intensity,  // <-- Uses LIGHTING
      diffuse: { r: 0.4, g: 0.5, b: 0.7 },
      ground: { r: 0.02, g: 0.03, b: 0.05 },
    },
    accent: {
      intensity: LIGHTING.accent.intensity,  // <-- Uses LIGHTING
      color: { r: 0.4, g: 0.6, b: 0.9 },
    },
    palette: {
      road: { r: 0.06, g: 0.08, b: 0.12 },
      emissive: { r: 0.02, g: 0.04, b: 0.08 },
      center: { r: 0.25, g: 0.7, b: 1 },
      edge: { r: 0.12, g: 0.55, b: 0.95 },
    },
  },

  desert: {
    sky: { r: 0.03, g: 0.015, b: 0.01, a: 1 },
    hemi: {
      intensity: LIGHTING.hemi.intensity,  // <-- Uses LIGHTING
      diffuse: { r: 0.6, g: 0.45, b: 0.3 },
      ground: { r: 0.06, g: 0.04, b: 0.03 },
    },
    accent: {
      intensity: LIGHTING.accent.intensity,  // <-- Uses LIGHTING
      color: { r: 0.8, g: 0.5, b: 0.3 },
    },
    palette: {
      road: { r: 0.12, g: 0.08, b: 0.06 },
      emissive: { r: 0.08, g: 0.04, b: 0.02 },
      center: { r: 1, g: 0.64, b: 0.3 },
      edge: { r: 0.85, g: 0.35, b: 0.2 },
    },
  },

  glacier: {
    sky: { r: 0.01, g: 0.025, b: 0.05, a: 1 },
    hemi: {
      intensity: LIGHTING.hemi.intensity,  // <-- Uses LIGHTING
      diffuse: { r: 0.45, g: 0.55, b: 0.7 },
      ground: { r: 0.02, g: 0.04, b: 0.06 },
    },
    accent: {
      intensity: LIGHTING.accent.intensity,  // <-- Uses LIGHTING
      color: { r: 0.4, g: 0.6, b: 0.85 },
    },
    palette: {
      road: { r: 0.04, g: 0.1, b: 0.16 },
      emissive: { r: 0.02, g: 0.05, b: 0.12 },
      center: { r: 0.45, g: 0.9, b: 1 },
      edge: { r: 0.28, g: 0.7, b: 0.95 },
    },
  },
}

// ============================================================
// AVATAR (Corpan pyramid logo)
// ============================================================
export const AVATAR = {
  // Base clay color (orange-brown)
  baseColor: { r: 0.835, g: 0.416, b: 0.102 },

  // Material tuning
  boardEmissiveScale: 0.5,    // Emissive multiplier for pyramid body
  earEmissiveScale: 0.5,      // Emissive multiplier for ear detail
  glowAlpha: 0.27,             // Glow overlay alpha (0-1)
  accentAlpha: 0.28,           // Accent glow alpha
  ringAlpha: 0.27,            // Ring alpha

  // Outline for crisp edges
  outlineWidth: 0.005,        // Outline thickness (higher = more visible)
  outlineColorScale: 11.4,     // How bright the outline is vs base

  // Point light illuminating the avatar
  light: {
    color: { r: 1, g: 0.72, b: 0.4 },
    intensity: 10.4,           // Brightness (was 0.85)
    range: 8,                 // Light radius
  },

  // Ring glow scales
  ringEmissiveScale: 1.0,     // Base ring brightness
  accentEmissiveScale: 1.1,   // Accent ring brightness

  // Pulse animation intensity
  pulseMin: 0,              // Min pulse brightness
  pulseMax: 1.7,              // Pulse amplitude
}

// ============================================================
// HELPER: Convert config objects to Babylon Color3/Color4
// ============================================================
export type RGB = { r: number; g: number; b: number }
export type RGBA = { r: number; g: number; b: number; a: number }
export type XYZ = { x: number; y: number; z: number }
