import * as THREE from "three";
import { COMMON, EDGE_GLSL, type SharedUniforms, withBarycentric } from "./shaders.ts";

/**
 * Two instanced "fields" carry the entire world.
 *
 * Everything solid — monoliths, gate arches, hazards, the skiff, roadside
 * debris — is one `SolidField` draw call per prototype geometry. Everything
 * luminous — halos, particles, sparks, speed streaks, shockwave rings — is one
 * `GlowField` draw call.
 *
 * Both write into pre-allocated Float32Arrays. There is no per-frame allocation
 * anywhere in this file, and no `Object3D` is created after load, so a
 * twenty-minute run never asks the collector for anything.
 */

/* ------------------------------- solid field ------------------------------ */

const SOLID_VERT = /* glsl */ `
${COMMON}
attribute vec3 bary;
attribute vec3 iPos;
attribute vec3 iScale;
attribute float iRot;
attribute vec3 iColor;
attribute float iGlow;
attribute float iFade;

varying vec3 vBary;
varying vec3 vColor;
varying float vGlow;
varying float vFade;
varying float vFog;
varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec3 p = position * iScale;
  float c = cos(iRot), s = sin(iRot);
  p = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  p += iPos;
  float depth = max(0.0, -p.z);
  p = voltaBend(p);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  vec3 n = normal;
  n = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
  vNormal = n;
  vViewDir = normalize(-mv.xyz);
  vBary = bary;
  vColor = iColor;
  vGlow = iGlow;
  vFade = iFade;
  vFog = voltaFog(depth);
}
`;

const SOLID_FRAG = /* glsl */ `
${COMMON}
${EDGE_GLSL}
varying vec3 vBary;
varying vec3 vColor;
varying float vGlow;
varying float vFade;
varying float vFog;
varying vec3 vNormal;
varying vec3 vViewDir;

uniform float uEdgeWidth;

void main() {
  if (vFade <= 0.004) discard;
  vec3 n = normalize(vNormal);
  float key = 0.30 + 0.70 * max(0.0, dot(n, normalize(vec3(0.35, 0.86, 0.36))));
  float fill = 0.12 + 0.16 * max(0.0, dot(n, normalize(vec3(-0.5, 0.2, 0.84))));

  // Fresnel rim: reads the silhouette even against a dark sky.
  float rim = pow(1.0 - clamp(abs(dot(n, normalize(vViewDir))), 0.0, 1.0), 2.6);

  vec3 body = uDeck * (key * 0.55 + fill) + vColor * rim * (0.35 + vGlow * 0.5);
  float e = voltaEdge(vBary, uEdgeWidth);
  vec3 neon = vColor * (1.15 + vGlow * 2.6);
  vec3 col = mix(neon, body, e);

  col = mix(col, uFogColor, vFog);
  col += voltaDither(gl_FragCoord.xy);
  gl_FragColor = vec4(col, vFade);
}
`;

export class SolidField {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private geo: THREE.InstancedBufferGeometry;
  private capacity: number;
  private n = 0;
  private aPos: THREE.InstancedBufferAttribute;
  private aScale: THREE.InstancedBufferAttribute;
  private aRot: THREE.InstancedBufferAttribute;
  private aColor: THREE.InstancedBufferAttribute;
  private aGlow: THREE.InstancedBufferAttribute;
  private aFade: THREE.InstancedBufferAttribute;

  constructor(base: THREE.BufferGeometry, capacity: number, shared: SharedUniforms, edgeWidth = 1.35) {
    this.capacity = capacity;
    const src = withBarycentric(base);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = src.index;
    for (const key of ["position", "normal", "bary"]) {
      const a = src.getAttribute(key);
      if (a) geo.setAttribute(key, a);
    }
    const mk = (size: number) =>
      new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size);
    this.aPos = mk(3);
    this.aScale = mk(3);
    this.aRot = mk(1);
    this.aColor = mk(3);
    this.aGlow = mk(1);
    this.aFade = mk(1);
    geo.setAttribute("iPos", this.aPos);
    geo.setAttribute("iScale", this.aScale);
    geo.setAttribute("iRot", this.aRot);
    geo.setAttribute("iColor", this.aColor);
    geo.setAttribute("iGlow", this.aGlow);
    geo.setAttribute("iFade", this.aFade);
    geo.instanceCount = 0;
    // Bounds are meaningless for a shader-bent instanced field; skip culling
    // rather than let three cull the whole draw when the origin leaves frustum.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geo = geo;

    this.material = new THREE.ShaderMaterial({
      uniforms: { ...shared, uEdgeWidth: { value: edgeWidth } },
      vertexShader: SOLID_VERT,
      fragmentShader: SOLID_FRAG,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
  }

  begin(): void {
    this.n = 0;
  }

  add(
    x: number, y: number, z: number,
    sx: number, sy: number, sz: number,
    rot: number,
    r: number, g: number, b: number,
    glow: number, fade: number,
  ): void {
    const i = this.n;
    if (i >= this.capacity) return;
    const p = this.aPos.array as Float32Array;
    const s = this.aScale.array as Float32Array;
    const c = this.aColor.array as Float32Array;
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    s[i * 3] = sx; s[i * 3 + 1] = sy; s[i * 3 + 2] = sz;
    c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b;
    (this.aRot.array as Float32Array)[i] = rot;
    (this.aGlow.array as Float32Array)[i] = glow;
    (this.aFade.array as Float32Array)[i] = fade;
    this.n = i + 1;
  }

  end(): void {
    this.geo.instanceCount = this.n;
    if (this.n === 0) return;
    this.aPos.needsUpdate = true;
    this.aScale.needsUpdate = true;
    this.aRot.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aGlow.needsUpdate = true;
    this.aFade.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.material.dispose();
  }
}

/* ------------------------------- glow field ------------------------------- */

const GLOW_VERT = /* glsl */ `
${COMMON}
attribute vec3 iPos;
attribute vec3 iColor;
attribute vec4 iParam;   // x size, y alpha, z stretch (y-axis), w kind

varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
varying float vFog;

void main() {
  vec3 wp = voltaBend(iPos);
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  float depth = max(0.0, -iPos.z);
  // Billboard in view space: cheap, always faces the camera, immune to roll.
  mv.xy += position.xy * vec2(iParam.x, iParam.x * iParam.z);
  gl_Position = projectionMatrix * mv;
  vUv = uv;
  vColor = iColor;
  vAlpha = iParam.y;
  vKind = iParam.w;
  vFog = voltaFog(depth);
}
`;

const GLOW_FRAG = /* glsl */ `
${COMMON}
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vKind;
varying float vFog;

void main() {
  vec2 d = vUv * 2.0 - 1.0;
  float r = length(d);
  float a;
  if (vKind < 0.5) {
    // Soft round glow with a hot core.
    a = pow(max(0.0, 1.0 - r), 2.2) + pow(max(0.0, 1.0 - r), 12.0) * 0.9;
  } else if (vKind < 1.5) {
    // Ring / shockwave.
    a = pow(max(0.0, 1.0 - abs(r - 0.82) * 7.0), 2.0);
  } else if (vKind < 2.5) {
    // Four-point star: reads as a collectible even at four pixels.
    float cross = max(0.0, 1.0 - abs(d.x) * 9.0) + max(0.0, 1.0 - abs(d.y) * 9.0);
    a = pow(max(0.0, 1.0 - r), 2.0) * (0.35 + cross * 0.8);
  } else {
    // Hard-edged bar: gate shards and deck slabs.
    a = max(0.0, 1.0 - max(abs(d.x), abs(d.y)));
    a = pow(a, 0.7);
  }
  a *= vAlpha * (1.0 - vFog * 0.92);
  if (a <= 0.002) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`;

export class GlowField {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private geo: THREE.InstancedBufferGeometry;
  private capacity: number;
  private n = 0;
  private aPos: THREE.InstancedBufferAttribute;
  private aColor: THREE.InstancedBufferAttribute;
  private aParam: THREE.InstancedBufferAttribute;

  constructor(capacity: number, shared: SharedUniforms, renderOrder = 10) {
    this.capacity = capacity;
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute("position", quad.getAttribute("position"));
    geo.setAttribute("uv", quad.getAttribute("uv"));
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.aParam = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    geo.setAttribute("iPos", this.aPos);
    geo.setAttribute("iColor", this.aColor);
    geo.setAttribute("iParam", this.aParam);
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geo = geo;

    this.material = new THREE.ShaderMaterial({
      uniforms: { ...shared },
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.renderOrder = renderOrder;
  }

  begin(): void {
    this.n = 0;
  }

  /** kind: 0 soft, 1 ring, 2 star, 3 bar. */
  add(
    x: number, y: number, z: number,
    size: number, alpha: number, stretch: number, kind: number,
    r: number, g: number, b: number,
  ): void {
    const i = this.n;
    if (i >= this.capacity) return;
    const p = this.aPos.array as Float32Array;
    const c = this.aColor.array as Float32Array;
    const q = this.aParam.array as Float32Array;
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    c[i * 3] = r; c[i * 3 + 1] = g; c[i * 3 + 2] = b;
    q[i * 4] = size; q[i * 4 + 1] = alpha; q[i * 4 + 2] = stretch; q[i * 4 + 3] = kind;
    this.n = i + 1;
  }

  get used(): number {
    return this.n;
  }
  get free(): number {
    return this.capacity - this.n;
  }

  end(): void {
    this.geo.instanceCount = this.n;
    if (this.n === 0) return;
    this.aPos.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aParam.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.material.dispose();
  }
}
