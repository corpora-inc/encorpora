import * as THREE from "three";
import { COMMON, type SharedUniforms } from "./shaders.ts";

/**
 * The sky, the light-ocean and the causeway.
 *
 * None of these three objects ever moves. The deck is a static ribbon and its
 * chevrons scroll procedurally against `uTravel`; the ocean's caustics do the
 * same; the sky is a shell parented to the camera. So the entire environment
 * costs three draw calls and precisely zero CPU per frame, which is what leaves
 * the budget for gates, hazards and two thousand particles.
 *
 * The one non-obvious detail is anti-aliasing. A high-contrast stripe scrolling
 * toward the camera at 62 units/second will shimmer into moire the moment the
 * pattern period drops below a pixel, and moire at speed genuinely hurts to
 * look at. Every periodic term is therefore filtered with `fwidth` and faded to
 * flat once it is undersampled.
 */

export const LANE_W = 3.35;
export const DECK_HALF = LANE_W * 1.5 + 1.35;

/* ----------------------------------- sky ---------------------------------- */

const SKY_VERT = /* glsl */ `
${COMMON}
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w; // always at the far plane
}
`;

const SKY_FRAG = /* glsl */ `
${COMMON}
varying vec3 vDir;
uniform float uAurora;
uniform float uStars;

float hash21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

// Cheap value noise; two octaves is enough for a curtain.
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uSkyBot, uSkyTop, pow(h, 0.75));

  // Horizon bloom, brightest straight ahead so the vanishing point pulls.
  float fwd = clamp(-d.z, 0.0, 1.0);
  float band = exp(-abs(d.y - 0.015) * 26.0);
  col += mix(uAccent, uAccent2, 0.25) * band * fwd * 0.28;
  col += uAccent * exp(-abs(d.y - 0.01) * 6.5) * fwd * 0.045;

  // Stars: only above the horizon, only in dark biomes.
  if (uStars > 0.01 && d.y > 0.02) {
    vec2 sp = d.xz / max(0.08, d.y) * 3.0;
    float s = hash21(floor(sp * 26.0));
    float tw = 0.6 + 0.4 * sin(uTime * 2.2 + s * 40.0);
    col += vec3(0.9, 0.95, 1.0) * step(0.9965, s) * tw * uStars * 1.5;
  }

  // Aurora curtains: two drifting sheets, vertically stretched, additive.
  if (uAurora > 0.01) {
    float y = d.y;
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float t = uTime * (0.045 + fi * 0.03) + uTravel * 0.0008;
      float n = vnoise(vec2(d.x * 2.4 + t, d.z * 1.6 - t * 0.6 + fi * 7.0));
      float n2 = vnoise(vec2(d.x * 7.0 - t * 2.0, d.z * 4.0 + fi * 3.0));
      float curtain = smoothstep(0.42, 0.95, n * 0.7 + n2 * 0.3);
      float vert = smoothstep(-0.02, 0.34, y) * smoothstep(0.95, 0.28, y);
      vec3 tint = mix(uAccent, uAccent2, fi * 0.7 + n2 * 0.3);
      col += tint * curtain * vert * (0.6 - fi * 0.2) * uAurora;
    }
  }

  // A hot rim right at the biome crossing.
  col = mix(col, vec3(1.0), uShift * 0.55);
  col += voltaDither(gl_FragCoord.xy) * 2.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function makeSky(shared: SharedUniforms): {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
} {
  const geo = new THREE.SphereGeometry(1, 40, 24);
  const material = new THREE.ShaderMaterial({
    uniforms: { ...shared, uAurora: { value: 1 }, uStars: { value: 1 } },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return { mesh, material };
}

/* ---------------------------------- ocean --------------------------------- */

const OCEAN_VERT = /* glsl */ `
${COMMON}
varying vec3 vWorld;
varying float vFog;
void main() {
  vec3 p = position;
  float depth = max(0.0, -p.z);
  vWorld = p;
  vec3 bent = voltaBend(p);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(bent, 1.0);
  vFog = voltaFog(depth);
}
`;

const OCEAN_FRAG = /* glsl */ `
${COMMON}
varying vec3 vWorld;
varying float vFog;

float band(float v, float period, float duty) {
  float p = v / period;
  float w = fwidth(p);
  if (w > 0.45) return duty;            // undersampled: go flat, never moire
  float f = abs(fract(p) - 0.5) * 2.0;
  return smoothstep(duty + w * 2.0, duty - w * 2.0, f);
}

void main() {
  float z = vWorld.z - uTravel;
  float x = vWorld.x;

  vec3 col = uSkyBot * 0.35;

  // Long light ribbons under the causeway, drifting laterally.
  float ribbons = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float off = sin(z * 0.004 + uTime * (0.11 + fi * 0.05) + fi * 2.1) * 22.0;
    float d = abs(x - off - (fi - 1.0) * 26.0);
    ribbons += exp(-d * 0.06) * (0.5 + 0.5 * sin(z * 0.02 + uTime * 1.6 + fi));
  }
  col += mix(uAccent, uAccent2, 0.35 + 0.35 * sin(uTime * 0.2)) * ribbons * 0.38;

  // The causeway's own reflection, smeared.
  float refl = exp(-abs(x) * 0.055) * (0.4 + 0.6 * band(z, 9.0, 0.42));
  col += uAccent * refl * 0.6;

  // Wave lines.
  col += vec3(0.6, 0.75, 1.0) * band(z + sin(x * 0.05 + uTime * 0.5) * 6.0, 34.0, 0.06) * 0.05;

  col = mix(col, uFogColor, vFog);
  col += voltaDither(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function makeOcean(shared: SharedUniforms, far: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(far * 3.2, far * 1.35, 1, 40);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -15.5, -far * 0.55);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...shared },
    vertexShader: OCEAN_VERT,
    fragmentShader: OCEAN_FRAG,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.renderOrder = -900;
  return mesh;
}

/* ----------------------------------- deck --------------------------------- */

const DECK_VERT = /* glsl */ `
${COMMON}
varying vec3 vWorld;
varying float vFog;
void main() {
  vec3 p = position;
  float depth = max(0.0, -p.z);
  vWorld = p;
  vec3 bent = voltaBend(p);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(bent, 1.0);
  vFog = voltaFog(depth);
}
`;

const DECK_FRAG = /* glsl */ `
${COMMON}
varying vec3 vWorld;
varying float vFog;

uniform float uLaneW;
uniform float uHalf;
uniform float uPlayerX;
// Up to four open pits, by world z. Unrolled rather than indexed: GLSL ES 1.00
// forbids dynamic indexing of a vector, and three compiles ShaderMaterial as
// ES 1.00 even on a WebGL2 context.
uniform vec4 uPits;
uniform float uPitHalf;   // 0 disables

// Filtered periodic bar. Returns 0..1, flat once undersampled.
float bar(float v, float period, float duty) {
  float p = v / period;
  float w = fwidth(p);
  if (w > 0.4) return duty * 0.55;
  float f = abs(fract(p) - 0.5) * 2.0;
  return smoothstep(duty + w * 2.5, duty - w * 2.5, f);
}

float line(float v, float halfWidth) {
  float w = fwidth(v) * 1.5 + 0.0001;
  return smoothstep(halfWidth + w, halfWidth - w, abs(v));
}

void main() {
  float z = vWorld.z - uTravel;
  float x = vWorld.x;

  if (uPitHalf > 0.0 && abs(x) < uHalf - 0.55) {
    float pd = min(min(abs(vWorld.z - uPits.x), abs(vWorld.z - uPits.y)),
                   min(abs(vWorld.z - uPits.z), abs(vWorld.z - uPits.w)));
    if (pd < uPitHalf) discard;
  }

  // Perspective makes a two-metre stripe fill half the screen when it is four
  // metres away. Without this the near deck blows out to a white wedge and the
  // gates lose the contrast fight to the floor.
  float nearTame = smoothstep(-2.0, 26.0, -vWorld.z) * 0.72 + 0.28;

  vec3 col = uDeck;

  // Transverse ties: the primary speed cue, and the thing that tells a child
  // how fast they are actually going. Loud on purpose.
  float ties = bar(z, 8.0, 0.13);
  col += mix(uAccent, uAccent2, 0.18) * ties * 0.5 * nearTame;

  // Chevrons pointing the way you are going.
  float chev = bar(z + abs(x) * 1.6, 24.0, 0.045);
  col += mix(uAccent, vec3(1.0), 0.3) * chev * 0.62 * nearTame;

  // Lane dividers: continuous, so lanes are legible even between ties.
  float l1 = line(x + uLaneW * 0.5, 0.06);
  float l2 = line(x - uLaneW * 0.5, 0.06);
  col += uAccent * (l1 + l2) * 0.6 * nearTame;

  // Which lane are you in. Not information (the skiff is), just weight.
  float own = exp(-pow((x - uPlayerX) / (uLaneW * 0.5), 2.0));
  col += uAccent * own * 0.22 * (0.65 + 0.35 * sin(uTime * 4.0));

  // Edge beams and the drop-off.
  float edge = smoothstep(uHalf - 0.66, uHalf - 0.16, abs(x));
  col += mix(uAccent, vec3(1.0), 0.25) * edge * (0.5 + 0.4 * bar(z, 4.5, 0.3)) * 0.75 * nearTame;

  // Surge: the deck lights up as the combo climbs.
  col += uAccent * uSurge * 0.34 * (0.4 + 0.6 * bar(z, 12.0, 0.32)) * nearTame;

  // Low voltage: a red pulse crawling the deck. Colour is never alone —
  // the HUD bar and a heartbeat carry the same message.
  float pulse = 0.5 + 0.5 * sin(uTime * 5.5 - z * 0.05);
  col = mix(col, vec3(1.0, 0.16, 0.22) * (0.45 + pulse * 0.85), uDanger * 0.55);

  col = mix(col, uFogColor, vFog);
  col = mix(col, vec3(1.0), uShift * 0.4);
  col += voltaDither(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
`;

export type Deck = {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  rebuild(segments: number, far: number): void;
};

export function makeDeck(shared: SharedUniforms, segments: number, far: number): Deck {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uLaneW: { value: LANE_W },
      uHalf: { value: DECK_HALF },
      uPlayerX: { value: 0 },
      uPits: { value: new THREE.Vector4(1e9, 1e9, 1e9, 1e9) },
      uPitHalf: { value: 0 },
    },
    vertexShader: DECK_VERT,
    fragmentShader: DECK_FRAG,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(build(segments, far), material);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;

  function build(seg: number, f: number): THREE.BufferGeometry {
    const len = f + 60;
    const g = new THREE.PlaneGeometry(DECK_HALF * 2, len, 4, seg);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -len / 2 + 40);
    return g;
  }

  return {
    mesh,
    material,
    rebuild(seg: number, f: number) {
      const old = mesh.geometry;
      mesh.geometry = build(seg, f);
      old.dispose();
    },
  };
}
