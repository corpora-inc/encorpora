/**
 * A small, hand-rolled post chain: bright-pass → separable blur → filmic
 * composite. Four full-screen quads at most, no EffectComposer, no dependency
 * beyond three itself.
 *
 * Why not UnrealBloomPass: it runs five mip levels and its own tone mapping,
 * and on the mid tablet that is most of the frame budget for an effect this
 * game uses on exactly one thing — the hot enamel accent. This does the job in
 * a quarter of the bandwidth and lets the composite also carry the flash and
 * the exposure, saving another blit.
 */

import {
  BufferAttribute,
  BufferGeometry,
  HalfFloatType,
  LinearFilter,
  Mesh,
  NoColorSpace,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from "three";

const VERT = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uThreshold;
uniform float uSoft;
void main() {
  vec3 c = texture2D(uTex, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(uThreshold, uThreshold + uSoft, l);
  gl_FragColor = vec4(c * k, 1.0);
}
`;

const BLUR = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  // 9-tap gaussian folded into 5 bilinear fetches.
  vec3 s = texture2D(uTex, vUv).rgb * 0.227027;
  vec2 o1 = uDir * 1.3846153846;
  vec2 o2 = uDir * 3.2307692308;
  s += texture2D(uTex, vUv + o1).rgb * 0.3162162162;
  s += texture2D(uTex, vUv - o1).rgb * 0.3162162162;
  s += texture2D(uTex, vUv + o2).rgb * 0.0702702703;
  s += texture2D(uTex, vUv - o2).rgb * 0.0702702703;
  gl_FragColor = vec4(s, 1.0);
}
`;

const COMPOSITE = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloom0;
uniform float uExposure;
uniform vec3  uFlash;
uniform float uFlashA;
uniform float uSat;
uniform vec2  uAberr;

// The ACES curve, applied to LUMINANCE ONLY, then used to rescale the colour.
// Full per-channel ACES skews saturated blues toward purple — it turned an
// authored blue-grey basalt into lavender on the first look at this game, so
// the palette is now tone-mapped without any hue rotation at all.
float filmic(float x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 tonemap(vec3 x) {
  float l = dot(x, vec3(0.2126, 0.7152, 0.0722));
  if (l < 1e-5) return x;
  vec3 c = x * (filmic(l) / l);
  // Only what still blows past white gets desaturated, and gently.
  float peak = max(max(c.r, c.g), c.b);
  c = mix(c, vec3(1.0), smoothstep(1.0, 2.6, peak) * 0.45);
  return clamp(c, 0.0, 1.0);
}

void main() {
  vec3 c;
  if (uAberr.x > 0.0001) {
    // Chromatic split that grows with trauma. Radial, so the centre stays sharp.
    vec2 d = (vUv - 0.5) * uAberr.x;
    c.r = texture2D(uScene, vUv + d).r;
    c.g = texture2D(uScene, vUv).g;
    c.b = texture2D(uScene, vUv - d).b;
  } else {
    c = texture2D(uScene, vUv).rgb;
  }
  c += texture2D(uBloom, vUv).rgb * uBloom0;
  // The flash is an EXPOSURE event, not a sheet of white laid over the frame.
  // Mixing toward white lifted the night sky to grey and read as fog; blowing
  // the exposure out before the tone curve blows out the LIT surfaces and
  // leaves the dark sky dark, which is what a bright frame is supposed to do.
  c *= uExposure * (1.0 + uFlashA * 9.0);
  c += uFlash * uFlashA * 0.05;
  c = tonemap(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  // linear -> sRGB
  c = mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0031308)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
  gl_FragColor = vec4(c, 1.0);
}
`;

function quad(mat: ShaderMaterial): { scene: Scene; mesh: Mesh } {
  const g = new BufferGeometry();
  g.setAttribute(
    "position",
    new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  const m = new Mesh(g, mat);
  m.frustumCulled = false;
  const s = new Scene();
  s.add(m);
  return { scene: s, mesh: m };
}

function rt(w: number, h: number): WebGLRenderTarget {
  const t = new WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
  });
  t.texture.colorSpace = NoColorSpace;
  t.texture.generateMipmaps = false;
  return t;
}

export class Post {
  scene!: WebGLRenderTarget;
  private a!: WebGLRenderTarget;
  private b!: WebGLRenderTarget;
  private cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

  private brightMat: ShaderMaterial;
  private blurMat: ShaderMaterial;
  private compMat: ShaderMaterial;
  private brightQ;
  private blurQ;
  private compQ;

  private w = 1;
  private h = 1;
  bloomEnabled = true;
  bloomDiv = 4;

  constructor(w: number, h: number, bloom: boolean, div: number) {
    this.bloomEnabled = bloom;
    this.bloomDiv = div;
    this.brightMat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: BRIGHT,
      depthTest: false,
      depthWrite: false,
      uniforms: { uTex: { value: null }, uThreshold: { value: 0.98 }, uSoft: { value: 0.7 } },
    });
    this.blurMat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: BLUR,
      depthTest: false,
      depthWrite: false,
      uniforms: { uTex: { value: null }, uDir: { value: new Vector2() } },
    });
    this.compMat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: COMPOSITE,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uScene: { value: null },
        uBloom: { value: null },
        uBloom0: { value: 0.9 },
        uExposure: { value: 1.18 },
        uFlash: { value: [1, 1, 1] },
        uFlashA: { value: 0 },
        uSat: { value: 1.0 },
        uAberr: { value: new Vector2(0, 0) },
      },
    });
    this.brightQ = quad(this.brightMat);
    this.blurQ = quad(this.blurMat);
    this.compQ = quad(this.compMat);
    this.resize(w, h);
  }

  resize(w: number, h: number): void {
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (w === this.w && h === this.h && this.scene) return;
    this.w = w;
    this.h = h;
    this.scene?.dispose();
    this.a?.dispose();
    this.b?.dispose();
    this.scene = rt(w, h);
    const d = this.bloomDiv;
    this.a = rt(Math.round(w / d), Math.round(h / d));
    this.b = rt(Math.round(w / d), Math.round(h / d));
  }

  setTier(bloom: boolean, div: number): void {
    if (bloom === this.bloomEnabled && div === this.bloomDiv) return;
    this.bloomEnabled = bloom;
    this.bloomDiv = div;
    const w = this.w;
    const h = this.h;
    this.w = -1;
    this.resize(w, h);
  }

  setFlash(r: number, g: number, b: number, a: number): void {
    const f = this.compMat.uniforms.uFlash!.value as number[];
    f[0] = r;
    f[1] = g;
    f[2] = b;
    this.compMat.uniforms.uFlashA!.value = a;
  }

  setTrauma(t: number): void {
    (this.compMat.uniforms.uAberr!.value as Vector2).x = t * t * 0.0095;
  }

  setBloom(v: number): void {
    this.compMat.uniforms.uBloom0!.value = v;
  }

  setExposure(v: number): void {
    this.compMat.uniforms.uExposure!.value = v;
  }

  /** Everything after the main scene has been rendered into `this.scene`. */
  present(r: WebGLRenderer): void {
    if (this.bloomEnabled) {
      this.brightMat.uniforms.uTex!.value = this.scene.texture;
      r.setRenderTarget(this.a);
      r.render(this.brightQ.scene, this.cam);

      const dir = this.blurMat.uniforms.uDir!.value as Vector2;
      const bw = this.a.width;
      const bh = this.a.height;

      this.blurMat.uniforms.uTex!.value = this.a.texture;
      dir.set(1 / bw, 0);
      r.setRenderTarget(this.b);
      r.render(this.blurQ.scene, this.cam);

      this.blurMat.uniforms.uTex!.value = this.b.texture;
      dir.set(0, 1 / bh);
      r.setRenderTarget(this.a);
      r.render(this.blurQ.scene, this.cam);

      // A second, wider pass gives the accent a real halo rather than a fringe.
      this.blurMat.uniforms.uTex!.value = this.a.texture;
      dir.set(2.4 / bw, 0);
      r.setRenderTarget(this.b);
      r.render(this.blurQ.scene, this.cam);

      this.blurMat.uniforms.uTex!.value = this.b.texture;
      dir.set(0, 2.4 / bh);
      r.setRenderTarget(this.a);
      r.render(this.blurQ.scene, this.cam);

      this.compMat.uniforms.uBloom!.value = this.a.texture;
    } else {
      this.compMat.uniforms.uBloom!.value = BLACK;
      this.compMat.uniforms.uBloom0!.value = 0;
    }
    this.compMat.uniforms.uScene!.value = this.scene.texture;
    r.setRenderTarget(null);
    r.render(this.compQ.scene, this.cam);
  }

  dispose(): void {
    this.scene.dispose();
    this.a.dispose();
    this.b.dispose();
    this.brightMat.dispose();
    this.blurMat.dispose();
    this.compMat.dispose();
    this.brightQ.mesh.geometry.dispose();
    this.blurQ.mesh.geometry.dispose();
    this.compQ.mesh.geometry.dispose();
  }
}

/** A 1×1 black texture so the composite shader always has a bloom sampler. */
const BLACK = (() => {
  const t = rt(1, 1);
  return t.texture;
})();
