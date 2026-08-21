import * as THREE from "three";
import { COMMON, type SharedUniforms } from "./shaders.ts";
import { CHARS, COLS, ROWS, INK, TRACK, glyphIndex } from "./glyphs.ts";

/**
 * World-space numerals.
 *
 * The catalogue this game is answering shipped engraved serif numerals on
 * fast-moving targets and a child got 0.45s to read them. That is the bug this
 * file exists to not repeat. Every choice here is legibility:
 *
 *  - One heavy geometric sans, tabular, no ornament, no serifs.
 *  - Each glyph is baked with a dark stroke *and* a soft dark shadow beyond it,
 *    so a hot-white numeral stays readable over an aurora, over a white-out,
 *    over another gate.
 *  - The red channel separates fill from outline, so the shader can recolour
 *    the numeral without ever recolouring its own contrast.
 *  - Every numeral in the world is one draw call, so making them big and
 *    plentiful costs nothing.
 */

/** The character set, the grid and the two metrics all live in `glyphs.ts`. */
const CELL = 256;

type Atlas = { texture: THREE.Texture; advance: number[] };

function buildAtlas(): Atlas {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const size = Math.round(CELL * 0.74);
  ctx.font = `800 ${size}px "Archivo Black", "Helvetica Neue", "Arial Black", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  const advance: number[] = [];
  for (let i = 0; i < CHARS.length; i++) {
    const ch = CHARS[i];
    const cx = (i % COLS) * CELL + CELL / 2;
    const cy = Math.floor(i / COLS) * CELL + CELL / 2 + size * 0.03;

    // Shadow first: a soft dark bloom that survives any background.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.92)";
    ctx.shadowBlur = CELL * 0.1;
    ctx.strokeStyle = "rgba(3,5,12,1)";
    ctx.lineWidth = CELL * 0.115;
    ctx.strokeText(ch, cx, cy);
    ctx.strokeText(ch, cx, cy);
    ctx.restore();

    // Hard outline, then the fill. R=0 in the outline, R=1 in the fill.
    ctx.strokeStyle = "rgba(4,6,16,1)";
    ctx.lineWidth = CELL * 0.085;
    ctx.strokeText(ch, cx, cy);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(ch, cx, cy);

    advance.push(ctx.measureText(ch).width / CELL);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return { texture, advance };
}

const VERT = /* glsl */ `
${COMMON}
attribute vec3 iPos;
attribute vec2 iSize;
attribute vec2 iUv;
attribute vec3 iColor;
attribute vec3 iParam; // x alpha, y glow, z tilt (radians about X)

varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
varying float vFog;

void main() {
  vec3 local = vec3(position.x * iSize.x, position.y * iSize.y, 0.0);
  float c = cos(iParam.z), s = sin(iParam.z);
  local = vec3(local.x, local.y * c, local.y * s);
  vec3 wp = iPos + local;
  float depth = max(0.0, -iPos.z);
  wp = voltaBend(wp);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp, 1.0);
  vUv = iUv + uv * vec2(${(1 / COLS).toFixed(6)}, ${(1 / ROWS).toFixed(6)});
  vColor = iColor;
  vAlpha = iParam.x;
  vGlow = iParam.y;
  vFog = voltaFog(depth);
}
`;

const FRAG = /* glsl */ `
${COMMON}
uniform sampler2D uAtlas;
uniform vec3 uOutline;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vGlow;
varying float vFog;

void main() {
  vec4 t = texture2D(uAtlas, vUv);
  float a = t.a * vAlpha;
  if (a <= 0.004) discard;
  // t.r is 1 inside the glyph and ~0 in the baked outline/shadow.
  //
  // The base is deliberately close to 1.0 rather than 1.25. Anything above the
  // bloom threshold gets a halo, the halo fattens the strokes, and fattened
  // strokes on adjacent two-digit numerals is half of how "13 42 36" became
  // "134236". Candidates a child is still reading carry almost no glow; only a
  // *resolved* numeral, which nobody has to read any more, is allowed to blaze.
  vec3 fill = vColor * (1.0 + vGlow * 2.4);
  vec3 col = mix(uOutline, fill, t.r);
  // Fog never eats the numeral's contrast, only its brightness.
  col = mix(col, uFogColor * 0.7 + col * 0.3, vFog * 0.8);
  gl_FragColor = vec4(col, a);
}
`;

export class DigitField {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private geo: THREE.InstancedBufferGeometry;
  private atlas: Atlas;
  private capacity: number;
  private n = 0;
  private aPos: THREE.InstancedBufferAttribute;
  private aSize: THREE.InstancedBufferAttribute;
  private aUv: THREE.InstancedBufferAttribute;
  private aColor: THREE.InstancedBufferAttribute;
  private aParam: THREE.InstancedBufferAttribute;

  constructor(capacity: number, shared: SharedUniforms) {
    this.capacity = capacity;
    this.atlas = buildAtlas();
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute("position", quad.getAttribute("position"));
    geo.setAttribute("uv", quad.getAttribute("uv"));
    const mk = (s: number) => new THREE.InstancedBufferAttribute(new Float32Array(capacity * s), s);
    this.aPos = mk(3);
    this.aSize = mk(2);
    this.aUv = mk(2);
    this.aColor = mk(3);
    this.aParam = mk(3);
    geo.setAttribute("iPos", this.aPos);
    geo.setAttribute("iSize", this.aSize);
    geo.setAttribute("iUv", this.aUv);
    geo.setAttribute("iColor", this.aColor);
    geo.setAttribute("iParam", this.aParam);
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geo = geo;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uAtlas: { value: this.atlas.texture },
        // The baked stroke reads as a hard dark edge in the three dark biomes;
        // in THE BLEACH the world is bone and the numeral flips to black ink on
        // a pale halo instead. Contrast is never left to chance.
        uOutline: { value: new THREE.Color(0.012, 0.018, 0.045) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      // Numerals are the information layer and always win. A roadside monolith
      // eclipsing the one gate value a child needed is not atmosphere, it is a
      // lost run, and only one gate is ever alive so nothing else can be hidden
      // behind them.
      depthTest: false,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.renderOrder = 30;
  }

  begin(): void {
    this.n = 0;
  }

  /** Colour of the baked stroke around every glyph. Flips with the biome. */
  setOutline(r: number, g: number, b: number): void {
    (this.material.uniforms.uOutline.value as THREE.Color).setRGB(r, g, b);
  }

  /** Width, in world units, that `text` occupies at ink height `h`. */
  measure(text: string, h: number): number {
    const cell = h / INK;
    let w = 0;
    for (let i = 0; i < text.length; i++) {
      w += this.atlas.advance[glyphIndex(text[i])] * cell * TRACK;
    }
    return w;
  }

  /** Draw `text` centred on (x, y) with an ink height of `h` world units. */
  addNumber(
    text: string,
    x: number, y: number, z: number,
    h: number,
    r: number, g: number, b: number,
    alpha: number, glow: number,
    tilt = 0,
  ): void {
    const total = this.measure(text, h);
    const cell = h / INK;
    let pen = x - total / 2;
    const pos = this.aPos.array as Float32Array;
    const size = this.aSize.array as Float32Array;
    const uv = this.aUv.array as Float32Array;
    const col = this.aColor.array as Float32Array;
    const par = this.aParam.array as Float32Array;
    for (let i = 0; i < text.length; i++) {
      const idx = glyphIndex(text[i]);
      const adv = this.atlas.advance[idx] * cell * TRACK;
      const k = this.n;
      if (k >= this.capacity) return;
      pos[k * 3] = pen + adv / 2;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = z;
      size[k * 2] = cell;
      size[k * 2 + 1] = cell;
      uv[k * 2] = (idx % COLS) / COLS;
      uv[k * 2 + 1] = 1 - (Math.floor(idx / COLS) + 1) / ROWS;
      col[k * 3] = r; col[k * 3 + 1] = g; col[k * 3 + 2] = b;
      par[k * 3] = alpha; par[k * 3 + 1] = glow; par[k * 3 + 2] = tilt;
      this.n = k + 1;
      pen += adv;
    }
  }

  end(): void {
    this.geo.instanceCount = this.n;
    if (this.n === 0) return;
    this.aPos.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aUv.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aParam.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.material.dispose();
    this.atlas.texture.dispose();
  }
}
