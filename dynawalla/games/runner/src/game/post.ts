import * as THREE from "three";

/**
 * A small hand-rolled bloom + composite chain.
 *
 * Three's `UnrealBloomPass` is five render targets and a mip chain; on a
 * mid-range tablet that is most of the frame. This does the same job in a
 * bright-pass plus a couple of half-resolution ping-pongs, with the pass count
 * driven by the quality tier so LOW can skip the whole thing and render
 * straight to the canvas.
 *
 * The composite also owns chromatic aberration, the vignette and the screen
 * flash, so at HIGH and above they cost nothing extra — one dependent texture
 * read that was already happening.
 */

const TRI = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BRIGHT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc;
uniform float uThreshold;
uniform float uKnee;
void main() {
  vec3 c = texture2D(uSrc, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float s = clamp((l - uThreshold) / max(0.0001, uKnee), 0.0, 1.0);
  gl_FragColor = vec4(c * s * s, 1.0);
}
`;

const BLUR = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uSrc;
uniform vec2 uDir;
void main() {
  // 9-tap gaussian folded to 5 texture reads with linear sampling.
  vec3 c = texture2D(uSrc, vUv).rgb * 0.227027;
  c += texture2D(uSrc, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(uSrc, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(uSrc, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(uSrc, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

const COMPOSITE = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uChroma;
uniform float uVignette;
uniform vec3 uVignetteColor;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uExposure;
uniform float uDesat;

void main() {
  vec2 uv = vUv;
  vec2 d = uv - 0.5;
  float r2 = dot(d, d);

  vec3 col;
  if (uChroma > 0.0005) {
    // Radial split, strongest at the edges where the eye tolerates it.
    vec2 off = d * uChroma * (0.25 + r2 * 2.4);
    col.r = texture2D(uScene, uv + off).r;
    col.g = texture2D(uScene, uv).g;
    col.b = texture2D(uScene, uv - off).b;
  } else {
    col = texture2D(uScene, uv).rgb;
  }

  col += texture2D(uBloom, uv).rgb * uBloomStrength;
  col *= uExposure;

  if (uDesat > 0.001) {
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(l), uDesat);
  }

  float v = 1.0 - smoothstep(0.18, 0.95, r2 * 2.0) * uVignette;
  col = mix(uVignetteColor, col, clamp(v, 0.0, 1.0));

  col = mix(col, uFlashColor, clamp(uFlash, 0.0, 1.0));

  // Filmic-ish shoulder. Keeps the white-out biome from clipping to a flat
  // sheet, which is both ugly and a photosensitivity hazard.
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

  // Explicit linear -> sRGB. A raw ShaderMaterial gets no colour-space chunk
  // injected by three, so the encode has to happen here or the whole game
  // renders crushed and over-saturated.
  col = clamp(col, 0.0, 1.0);
  col = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), col));
  gl_FragColor = vec4(col, 1.0);
}
`;

function fullscreenTriangle(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  return g;
}

export class Post {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private geo = fullscreenTriangle();

  private sceneRT!: THREE.WebGLRenderTarget;
  private rtA!: THREE.WebGLRenderTarget;
  private rtB!: THREE.WebGLRenderTarget;

  private bright: THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;
  readonly composite: THREE.ShaderMaterial;

  private w = 1;
  private h = 1;
  passes = 3;
  enabled = true;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.bright = new THREE.ShaderMaterial({
      uniforms: { uSrc: { value: null }, uThreshold: { value: 1.05 }, uKnee: { value: 0.55 } },
      vertexShader: TRI, fragmentShader: BRIGHT, depthTest: false, depthWrite: false,
    });
    this.blur = new THREE.ShaderMaterial({
      uniforms: { uSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: TRI, fragmentShader: BLUR, depthTest: false, depthWrite: false,
    });
    this.composite = new THREE.ShaderMaterial({
      uniforms: {
        uScene: { value: null },
        uBloom: { value: null },
        uBloomStrength: { value: 0.85 },
        uChroma: { value: 0 },
        uVignette: { value: 0.6 },
        uVignetteColor: { value: new THREE.Color(0x000208) },
        uFlash: { value: 0 },
        uFlashColor: { value: new THREE.Color(0xffffff) },
        uExposure: { value: 1.05 },
        uDesat: { value: 0 },
      },
      vertexShader: TRI, fragmentShader: COMPOSITE, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(this.geo, this.composite);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.build(2, 2);
  }

  /** LOW runs the composite with zero bloom passes, so it needs no HDR buffer. */
  hdr = true;

  private build(w: number, h: number): void {
    const type = this.hdr && this.renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const opts = { type, depthBuffer: true, stencilBuffer: false, samples: 0 };
    this.sceneRT?.dispose();
    this.rtA?.dispose();
    this.rtB?.dispose();
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, opts);
    const bw = Math.max(2, Math.floor(w / 2));
    const bh = Math.max(2, Math.floor(h / 2));
    this.rtA = new THREE.WebGLRenderTarget(bw, bh, { ...opts, depthBuffer: false });
    this.rtB = new THREE.WebGLRenderTarget(bw, bh, { ...opts, depthBuffer: false });
    for (const rt of [this.sceneRT, this.rtA, this.rtB]) {
      rt.texture.minFilter = THREE.LinearFilter;
      rt.texture.magFilter = THREE.LinearFilter;
      rt.texture.generateMipmaps = false;
      rt.texture.wrapS = THREE.ClampToEdgeWrapping;
      rt.texture.wrapT = THREE.ClampToEdgeWrapping;
    }
    this.w = w;
    this.h = h;
  }

  setSize(w: number, h: number): void {
    if (w === this.w && h === this.h) return;
    this.build(Math.max(2, w), Math.max(2, h));
  }

  setHdr(on: boolean): void {
    if (on === this.hdr) return;
    this.hdr = on;
    this.build(this.w, this.h);
  }

  get target(): THREE.WebGLRenderTarget | null {
    return this.enabled ? this.sceneRT : null;
  }

  private draw(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null): void {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }

  /** Runs the bloom chain and blits to the canvas. */
  present(): void {
    if (!this.enabled) return;
    const r = this.renderer;
    const auto = r.autoClear;
    r.autoClear = true;

    if (this.passes > 0) {
      this.bright.uniforms.uSrc.value = this.sceneRT.texture;
      this.draw(this.bright, this.rtA);
      const bw = this.rtA.width;
      const bh = this.rtA.height;
      for (let i = 0; i < this.passes; i++) {
        const spread = 1 + i * 1.35;
        this.blur.uniforms.uSrc.value = this.rtA.texture;
        (this.blur.uniforms.uDir.value as THREE.Vector2).set(spread / bw, 0);
        this.draw(this.blur, this.rtB);
        this.blur.uniforms.uSrc.value = this.rtB.texture;
        (this.blur.uniforms.uDir.value as THREE.Vector2).set(0, spread / bh);
        this.draw(this.blur, this.rtA);
      }
      this.composite.uniforms.uBloom.value = this.rtA.texture;
    } else {
      this.composite.uniforms.uBloom.value = null;
      this.composite.uniforms.uBloomStrength.value = 0;
    }

    this.composite.uniforms.uScene.value = this.sceneRT.texture;
    this.draw(this.composite, null);
    r.autoClear = auto;
  }

  dispose(): void {
    this.sceneRT.dispose();
    this.rtA.dispose();
    this.rtB.dispose();
    this.bright.dispose();
    this.blur.dispose();
    this.composite.dispose();
    this.geo.dispose();
  }
}
