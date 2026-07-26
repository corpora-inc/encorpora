/**
 * The world behind the monument, entirely procedural.
 *
 * A three-stop vertical gradient per stratum, a horizon bloom, thin altitude
 * striations that scroll as you climb, and a parallaxed skyline of dark
 * monoliths that you literally climb out of: by about floor 55 the city is gone
 * and there is only weather. That fade is the story the background tells, and
 * it costs one full-screen triangle.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
} from "three";

const VERT = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.999, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform vec3  uC0;      // bottom
uniform vec3  uC1;      // mid
uniform vec3  uC2;      // top
uniform vec3  uSpire;
uniform vec3  uAccent;
uniform float uAlt;     // camera height, world units
uniform float uTime;
uniform float uAspect;
uniform float uBandLight; // aurora band strength
uniform float uGrain;
uniform float uPeril;     // 0..1 — the sky closes in as the tower thins

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// One parallax band of monoliths. Two copies a period apart so the skyline
// scrolls forever without a seam.
float skyline(vec2 uv, float cols, float speed, float base, float amp, float seed) {
  float p = uAlt * speed;
  float period = 1.35;
  float x = uv.x * cols + seed * 31.7;
  float i = floor(x);
  float lit = 0.0;
  for (int k = 0; k < 2; k++) {
    float phase = p + float(k) * period;
    float cyc = floor(phase / period);
    float local = phase - cyc * period;
    float h = hash21(vec2(i, cyc * 7.0 + seed));
    // A setback near the top so the silhouettes read as buildings, not teeth.
    float notch = step(0.62, hash21(vec2(i + 0.5, cyc * 3.0 + seed))) * 0.06;
    float top = base + h * amp - local + notch * step(0.5, fract(x));
    lit = max(lit, step(uv.y, top));
  }
  return lit;
}

void main() {
  vec2 uv = vUv;

  // Gradient. Two smoothsteps so the mid stop actually reads.
  vec3 col = mix(uC0, uC1, smoothstep(0.0, 0.52, uv.y));
  col = mix(col, uC2, smoothstep(0.46, 1.0, uv.y));

  // Horizon bloom, low and wide.
  float hz = exp(-pow((uv.y - 0.10) * 9.0, 2.0));
  col += uAccent * hz * 0.035;

  // Altitude striations — thin haze layers sliding down as the camera rises.
  float s = sin((uv.y * 46.0) + uAlt * 1.6) * 0.5 + 0.5;
  float sMask = smoothstep(0.9, 1.0, s) * smoothstep(0.05, 0.5, uv.y) * 0.03;
  col += uC2 * sMask;

  // A slow moving band, mostly asleep. AURORA turns it up.
  if (uBandLight > 0.001) {
    float y = uv.y - 0.66;
    float w = sin(uv.x * 3.1 + uTime * 0.21) * 0.06 + sin(uv.x * 7.7 - uTime * 0.13) * 0.03;
    float b = exp(-pow((y - w) * 9.0, 2.0));
    col += uAccent * b * uBandLight * (0.55 + 0.45 * sin(uTime * 0.7 + uv.x * 4.0));
  }

  // The city, fading out by the time the monument is above it.
  float cityFade = 1.0 - smoothstep(6.0, 26.0, uAlt);
  if (cityFade > 0.002) {
    float far  = skyline(uv, 15.0 * uAspect, 0.0075, 0.075, 0.085, 1.0);
    float mid  = skyline(uv, 10.0 * uAspect, 0.014,  0.045, 0.115, 2.0);
    float near = skyline(uv, 6.5  * uAspect, 0.024,  0.005, 0.15, 3.0);
    vec3 farC  = mix(col, uSpire, 0.42);
    vec3 midC  = mix(col, uSpire, 0.66);
    vec3 nearC = uSpire * 0.55;
    col = mix(col, farC,  far  * cityFade);
    col = mix(col, midC,  mid  * cityFade);
    col = mix(col, nearC, near * cityFade);
    // Window glimmer on the near band only — a hint of life down there.
    float wc = hash21(floor(uv * vec2(320.0 * uAspect, 420.0)));
    float win = step(0.988, wc) * near * cityFade;
    col += uAccent * win * 0.18;
  }

  // Vignette, tightening with peril. The sky closes in as the tower thins.
  vec2 d = (uv - 0.5) * vec2(uAspect, 1.0);
  float vig = 1.0 - smoothstep(0.30, 0.92 - uPeril * 0.26, length(d));
  col *= mix(0.48, 1.0, vig);

  if (uGrain > 0.001) {
    float g = hash21(uv * 1024.0 + fract(uTime) * 37.0) - 0.5;
    col += g * uGrain;
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly material: ShaderMaterial;
  private mesh: Mesh;
  private c0 = new Color();
  private c1 = new Color();
  private c2 = new Color();
  private cs = new Color();
  private ca = new Color();

  constructor() {
    const g = new BufferGeometry();
    // One oversized triangle covering the viewport — cheaper than a quad.
    g.setAttribute(
      "position",
      new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uC0: { value: this.c0 },
        uC1: { value: this.c1 },
        uC2: { value: this.c2 },
        uSpire: { value: this.cs },
        uAccent: { value: this.ca },
        uAlt: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uBandLight: { value: 0 },
        uGrain: { value: 0.02 },
        uPeril: { value: 0 },
      },
    });
    this.mesh = new Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  setPalette(sky: [number, number, number], spire: number, accent: number, band: number): void {
    this.c0.setHex(sky[0]);
    this.c1.setHex(sky[1]);
    this.c2.setHex(sky[2]);
    this.cs.setHex(spire);
    this.ca.setHex(accent);
    this.material.uniforms.uBandLight!.value = band;
  }

  /** Blend toward a new palette so a stratum change is a sweep, not a cut. */
  lerpPalette(
    sky: [number, number, number],
    spire: number,
    accent: number,
    band: number,
    t: number,
  ): void {
    const u = this.material.uniforms;
    tmp.setHex(sky[0]);
    this.c0.lerp(tmp, t);
    tmp.setHex(sky[1]);
    this.c1.lerp(tmp, t);
    tmp.setHex(sky[2]);
    this.c2.lerp(tmp, t);
    tmp.setHex(spire);
    this.cs.lerp(tmp, t);
    tmp.setHex(accent);
    this.ca.lerp(tmp, t);
    const cur = u.uBandLight!.value as number;
    u.uBandLight!.value = cur + (band - cur) * t;
  }

  update(alt: number, time: number, aspect: number, grain: number, peril: number): void {
    const u = this.material.uniforms;
    u.uAlt!.value = alt;
    u.uTime!.value = time;
    u.uAspect!.value = aspect;
    u.uGrain!.value = grain;
    u.uPeril!.value = peril;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

const tmp = new Color();
