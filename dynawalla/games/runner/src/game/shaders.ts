import * as THREE from "three";

/**
 * The shared GLSL every material in VOLTA includes, and the single uniform
 * block they all point at.
 *
 * The load-bearing idea is `voltaBend`. Gameplay lives on a perfectly straight
 * 1D track — lane is an integer, distance is a float, nothing curves — and the
 * *shader* bends the world by a quadratic in view depth. That buys three things
 * for about eight lines:
 *
 *   - The causeway visibly snakes and rolls, so a run does not read as a
 *     treadmill after ninety seconds.
 *   - Geometry enters from behind the curve instead of fading up out of fog, so
 *     there is no pop-in to hide.
 *   - Collision, lane logic and spawn scheduling stay one-dimensional and
 *     therefore stay debuggable.
 *
 * Three.js also never has to move the deck: the deck is a static ribbon and the
 * stripes scroll procedurally against `uTravel`, so the ground costs one draw
 * call and zero CPU forever.
 */

export type SharedUniforms = {
  uTime: { value: number };
  uTravel: { value: number };
  /** Quadratic bend coefficients: x sways, y rolls the horizon under/over you. */
  uBend: { value: THREE.Vector2 };
  uFogColor: { value: THREE.Color };
  uFogDensity: { value: number };
  uSkyTop: { value: THREE.Color };
  uSkyBot: { value: THREE.Color };
  uAccent: { value: THREE.Color };
  uAccent2: { value: THREE.Color };
  uDeck: { value: THREE.Color };
  uSpeed01: { value: number };
  uSurge: { value: number };
  /** Rises 0 -> 1 across a biome crossing; drives the white-out and palette lerp. */
  uShift: { value: number };
  uDanger: { value: number };
};

export function makeSharedUniforms(): SharedUniforms {
  return {
    uTime: { value: 0 },
    uTravel: { value: 0 },
    uBend: { value: new THREE.Vector2(0, 0) },
    uFogColor: { value: new THREE.Color(0x05070f) },
    uFogDensity: { value: 1 / 240 },
    uSkyTop: { value: new THREE.Color(0x03040c) },
    uSkyBot: { value: new THREE.Color(0x0a1430) },
    uAccent: { value: new THREE.Color(0x36e8ff) },
    uAccent2: { value: new THREE.Color(0xff3fa4) },
    uDeck: { value: new THREE.Color(0x070a16) },
    uSpeed01: { value: 0 },
    uSurge: { value: 0 },
    uShift: { value: 0 },
    uDanger: { value: 0 },
  };
}

/** Declarations + helpers. Prepended to every vertex and fragment shader. */
export const COMMON = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uTravel;
uniform vec2  uBend;
uniform vec3  uFogColor;
uniform float uFogDensity;
uniform vec3  uSkyTop;
uniform vec3  uSkyBot;
uniform vec3  uAccent;
uniform vec3  uAccent2;
uniform vec3  uDeck;
uniform float uSpeed01;
uniform float uSurge;
uniform float uShift;
uniform float uDanger;

// Quadratic world bend in view depth. p is world space; the camera sits at the
// origin looking down -z, so -p.z is "distance ahead".
vec3 voltaBend(vec3 p) {
  float d = max(0.0, -p.z);
  float k = d * d;
  p.x += uBend.x * k;
  p.y += uBend.y * k;
  return p;
}

float voltaFog(float depth) {
  float f = depth * uFogDensity;
  return clamp(1.0 - exp(-f * f * 1.35), 0.0, 1.0);
}

// Ordered-ish hash dither. Gradients over a 300-unit draw distance band badly
// on 8-bit displays and a child will read the bands as a graphical fault.
float voltaDither(vec2 c) {
  return (fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
}

float voltaHash(float n) { return fract(sin(n) * 43758.5453123); }
`;

/**
 * Barycentric edge factor: 1 in a face's interior, 0 along its edges, with a
 * screen-space-constant width. This is where the whole look comes from — solids
 * are near-black obsidian, edges are hot neon, and both stay legible at 62 u/s
 * because the edge width does not shrink with distance.
 */
export const EDGE_GLSL = /* glsl */ `
float voltaEdge(vec3 bary, float width) {
  vec3 d = fwidth(bary);
  vec3 a = smoothstep(vec3(0.0), d * width, bary);
  return min(min(a.x, a.y), a.z);
}
`;

/**
 * Convert an indexed geometry to non-indexed and attach a per-vertex
 * barycentric attribute. Called once per prototype at load, never in a frame.
 */
export function withBarycentric(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const count = g.getAttribute("position").count;
  const bary = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 3) {
    bary[i * 3 + 0] = 1;
    bary[(i + 1) * 3 + 1] = 1;
    bary[(i + 2) * 3 + 2] = 1;
  }
  g.setAttribute("bary", new THREE.BufferAttribute(bary, 3));
  if (g !== geo) geo.dispose();
  return g;
}
