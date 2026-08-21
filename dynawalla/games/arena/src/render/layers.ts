import * as THREE from "three"
import { GLYPH_COUNT, type Atlas } from "./atlas.ts"
import { splitDigits } from "../core/digits.ts"

/*
 * Every drawable in ARENA is one instanced draw call with a hand-written
 * shader. Nothing allocates after construction: the instance buffers are sized
 * once at the ULTRA ceiling and the live count is moved with `instanceCount`.
 *
 * The visual grammar is deliberately one rule, applied to everything:
 *
 *    smooth disc  = smaller than you, you may swallow it
 *    spiked ring  = larger than you, it will hurt
 *
 * Motes obey it. Rivals obey it. It is never carried by colour alone, and it
 * changes the instant your mass crosses the threshold — which is why growth
 * feels like the world converting rather than like a number going up.
 */

const QUAD = new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5])
const QUAD_IDX = new Uint16Array([0, 1, 2, 0, 2, 3])

function quadGeometry(): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(QUAD, 2))
  g.setIndex(new THREE.BufferAttribute(QUAD_IDX, 1))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
  return g
}

/** Shared GLSL: cheap value noise + fbm. */
const NOISE = /* glsl */ `
float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+34.56); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  float a = hash21(i), b = hash21(i+vec2(1.0,0.0)), c = hash21(i+vec2(0.0,1.0)), d = hash21(i+vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i=0;i<4;i++){ s += a*vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
`

// ---------------------------------------------------------------------------
// Backdrop — the water itself
// ---------------------------------------------------------------------------

export class Backdrop {
  readonly mesh: THREE.Mesh
  private readonly u: Record<string, THREE.IUniform>

  constructor() {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9)
    this.u = {
      uTime: { value: 0 },
      uWater: { value: new THREE.Vector3(0.004, 0.014, 0.038) },
      uShaft: { value: new THREE.Vector3(0.1, 0.42, 0.72) },
      uCam: { value: new THREE.Vector2() },
      uSpan: { value: 400 },
      uAspect: { value: 1 },
      uGodrays: { value: 1 },
      uIntensity: { value: 1 },
      uArenaR: { value: 1600 },
      uCalm: { value: 0 },
    }
    const mat = new THREE.RawShaderMaterial({
      uniforms: this.u,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 position;
        varying vec2 vNdc;
        void main(){ vNdc = position; gl_Position = vec4(position, 0.999, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vNdc;
        uniform float uTime, uSpan, uAspect, uGodrays, uIntensity, uArenaR, uCalm;
        uniform vec3 uWater, uShaft;
        uniform vec2 uCam;
        ${NOISE}
        void main(){
          vec2 ndc = vNdc;
          vec2 world = uCam + vec2(ndc.x*uAspect, ndc.y) * uSpan * 0.5;

          // Base water: a slow vertical gradient, darkest at the bottom, so the
          // frame always has a floor and a "surface somewhere far above".
          float g = clamp(0.5 - ndc.y*0.42, 0.0, 1.0);
          vec3 col = uWater * (0.30 + g*1.10);

          // Deep caustics — very low contrast, purely to keep the black alive.
          float c1 = fbm(world*0.0016 + vec2(uTime*0.014, uTime*0.009));
          float c2 = fbm(world*0.0041 - vec2(uTime*0.021, uTime*0.011));
          float caustic = pow(max(0.0, c1*0.6 + c2*0.6 - 0.50), 3.2);
          col += uShaft * caustic * 0.075 * uIntensity;

          // Light shafts from an unreachable surface. Angular beams that drift.
          if (uGodrays > 0.5) {
            float a = ndc.x*uAspect*0.9 + 0.42;
            float beams = 0.0;
            beams += pow(max(0.0, sin(a*5.1 + uTime*0.05)), 22.0);
            beams += pow(max(0.0, sin(a*8.3 - uTime*0.031 + 1.7)), 30.0)*0.7;
            beams += pow(max(0.0, sin(a*3.2 + uTime*0.017 + 3.1)), 16.0)*0.5;
            float fall = smoothstep(-1.05, 0.75, -ndc.y);
            col += uShaft * beams * fall * 0.018 * uIntensity;
          }

          // The membrane. You can always see where the world ends.
          float dr = length(world) - uArenaR;
          float wall = exp(-abs(dr)*0.0055) * smoothstep(-260.0, 40.0, dr);
          col += uShaft * wall * 0.55;
          float grid = smoothstep(0.965, 1.0, abs(sin(atan(world.y, world.x)*46.0)));
          col += uShaft * wall * grid * 0.5;

          // Calm is raised during a Resonance: the water darkens and holds.
          col *= mix(1.0, 0.20, uCalm);

          // Vignette, then a whisper of grain so flat blacks never band.
          float v = 1.0 - dot(ndc, ndc)*0.30;
          col *= v;
          col += (hash21(ndc*512.0 + uTime) - 0.5) * 0.0035;
          gl_FragColor = vec4(max(col, 0.0), 1.0);
        }
      `,
    })
    this.mesh = new THREE.Mesh(g, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -100
  }

  set(
    time: number,
    water: readonly [number, number, number],
    shaft: readonly [number, number, number],
    camX: number,
    camY: number,
    span: number,
    aspect: number,
    godrays: boolean,
    intensity: number,
    arenaR: number,
    calm: number,
  ): void {
    this.u.uTime!.value = time
    ;(this.u.uWater!.value as THREE.Vector3).set(water[0], water[1], water[2])
    ;(this.u.uShaft!.value as THREE.Vector3).set(shaft[0], shaft[1], shaft[2])
    ;(this.u.uCam!.value as THREE.Vector2).set(camX, camY)
    this.u.uSpan!.value = span
    this.u.uAspect!.value = aspect
    this.u.uGodrays!.value = godrays ? 1 : 0
    this.u.uIntensity!.value = intensity
    this.u.uArenaR!.value = arenaR
    this.u.uCalm!.value = calm
  }
}

// ---------------------------------------------------------------------------
// Marine snow — parallax drift, the thing that makes the water feel like water
// ---------------------------------------------------------------------------

export class Snow {
  readonly mesh: THREE.Mesh
  private readonly u: Record<string, THREE.IUniform>
  private readonly cap: number

  constructor(cap: number) {
    this.cap = cap
    const g = quadGeometry()
    const seed = new Float32Array(cap * 4)
    for (let i = 0; i < cap; i++) {
      seed[i * 4] = Math.random()
      seed[i * 4 + 1] = Math.random()
      seed[i * 4 + 2] = 0.18 + Math.random() * 0.82 // parallax
      seed[i * 4 + 3] = Math.random()
    }
    g.setAttribute("iSeed", new THREE.InstancedBufferAttribute(seed, 4))
    g.instanceCount = cap
    this.u = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector2() },
      uSpan: { value: 400 },
      uAspect: { value: 1 },
      uTint: { value: new THREE.Vector3(0.4, 0.8, 1) },
      uIntensity: { value: 1 },
    }
    const mat = new THREE.RawShaderMaterial({
      uniforms: this.u,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 position;
        attribute vec4 iSeed;
        varying vec2 vL; varying float vA; varying float vTw;
        uniform float uTime, uSpan, uAspect;
        uniform vec2 uCam;
        void main(){
          float par = iSeed.z;
          // Tile the field in screen space so the drift is infinite and free.
          vec2 base = iSeed.xy * 2.0 - 1.0;
          vec2 drift = vec2(sin(uTime*0.045 + iSeed.w*31.0)*0.06, -uTime*0.012*par);
          vec2 p = base + drift - (uCam / (uSpan*3.0)) * par;
          p = fract((p + 1.0) * 0.5) * 2.0 - 1.0;
          float s = (0.0022 + iSeed.w*0.0060) * mix(0.5, 1.35, par);
          vL = position * 2.0;
          vA = mix(0.10, 0.75, par) * (0.35 + iSeed.w*0.65);
          vTw = 0.6 + 0.4*sin(uTime*1.7 + iSeed.w*44.0);
          vec2 ndc = vec2(p.x, p.y) + position * s * vec2(1.0/uAspect, 1.0);
          gl_Position = vec4(ndc, 0.99, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        varying vec2 vL; varying float vA; varying float vTw;
        uniform vec3 uTint; uniform float uIntensity;
        void main(){
          float d = length(vL);
          float a = exp(-d*d*3.2);
          gl_FragColor = vec4(uTint * a * vA * vTw * uIntensity, a);
        }
      `,
    })
    this.mesh = new THREE.Mesh(g, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -90
  }

  setCount(n: number): void {
    ;(this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = Math.min(n, this.cap)
  }

  set(time: number, camX: number, camY: number, span: number, aspect: number, tint: readonly [number, number, number], intensity: number): void {
    this.u.uTime!.value = time
    ;(this.u.uCam!.value as THREE.Vector2).set(camX, camY)
    this.u.uSpan!.value = span
    this.u.uAspect!.value = aspect
    ;(this.u.uTint!.value as THREE.Vector3).set(tint[0], tint[1], tint[2])
    this.u.uIntensity!.value = intensity
  }
}

// ---------------------------------------------------------------------------
// Motes
// ---------------------------------------------------------------------------

export class Motes {
  readonly mesh: THREE.Mesh
  private readonly aPos: THREE.InstancedBufferAttribute
  private readonly aData: THREE.InstancedBufferAttribute
  private readonly u: Record<string, THREE.IUniform>
  private n = 0

  constructor(cap: number) {
    const g = quadGeometry()
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3) // x, y, r
    this.aData = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4) // flip, kind, phase, seed
    this.aPos.setUsage(THREE.DynamicDrawUsage)
    this.aData.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute("iPos", this.aPos)
    g.setAttribute("iData", this.aData)
    this.u = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector2() },
      uSpan: { value: 400 },
      uAspect: { value: 1 },
      uFood: { value: new THREE.Vector3(0.45, 0.9, 1) },
      uThreat: { value: new THREE.Vector3(1, 0.42, 0.62) },
      uCalm: { value: 0 },
    }
    const mat = new THREE.RawShaderMaterial({
      uniforms: this.u,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 position;
        attribute vec3 iPos;
        attribute vec4 iData;
        varying vec2 vL; varying float vFlip; varying float vKind; varying float vPhase; varying float vSeed;
        uniform vec2 uCam; uniform float uSpan, uAspect;
        void main(){
          vL = position * 2.9;
          vFlip = iData.x; vKind = iData.y; vPhase = iData.z; vSeed = iData.w;
          vec2 world = iPos.xy + position * iPos.z * 2.9;
          vec2 ndc = (world - uCam) / (uSpan*0.5);
          ndc.x /= uAspect;
          gl_Position = vec4(ndc, 0.5, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vL; varying float vFlip; varying float vKind; varying float vPhase; varying float vSeed;
        uniform vec3 uFood, uThreat;
        uniform float uTime, uCalm;
        ${NOISE}
        void main(){
          float d = length(vL);
          float ang = atan(vL.y, vL.x);

          // --- edible: a filled, breathing cell -------------------------------
          float pulse = 1.0 + 0.045*sin(uTime*2.6 + vSeed*23.0);
          float rr = d / pulse;
          float body = smoothstep(1.02, 0.80, rr);
          float rim  = exp(-pow((rr-0.95)*7.5, 2.0));
          float nuc  = exp(-rr*rr*7.0);
          float grain = fbm(vL*2.6 + vec2(uTime*0.25, vSeed*10.0));
          vec3 foodCol = uFood * (body*(0.82 + grain*0.34) + rim*1.30 + nuc*1.05);
          foodCol += vec3(0.80,0.95,1.0) * nuc*nuc * 0.30;

          // --- threat: a spiked, hollow husk -----------------------------------
          float spikes = 0.80 + 0.20*cos(ang*7.0 + vPhase*0.9);
          float ring = exp(-pow((d - spikes)*7.0, 2.0));
          float barb = exp(-pow((d - spikes*1.16)*6.2, 2.0)) * pow(max(0.0, cos(ang*7.0 + vPhase*0.9)), 3.0);
          float hollow = smoothstep(0.80, 0.58, d) * 0.055;
          vec3 threatCol = uThreat * (ring*1.7 + barb*1.35 + hollow*1.2);

          vec3 col = mix(threatCol, foodCol, vFlip);

          // --- void: an inward collapse, always hostile ------------------------
          if (vKind > 0.5 && vKind < 1.5) {
            float chev = exp(-pow((d - 0.86)*9.0, 2.0)) * (0.45 + 0.55*pow(max(0.0,-cos(ang*3.0 + uTime*1.6)), 2.0));
            float core = exp(-d*d*10.0);
            col = vec3(1.0, 0.10, 0.24) * (chev*1.5 + core*0.55);
            col += vec3(0.35, 0.0, 0.12) * smoothstep(1.0, 0.5, d);
          }

          // --- shed: your own exhaust, cooler and softer -----------------------
          if (vKind > 1.5 && vKind < 2.5) {
            col = mix(col, uFood*vec3(0.7,1.0,0.85) * (body*0.5 + rim*1.0 + nuc*0.7), 0.75);
          }

          // --- answer sphere: glass, arcs, a hard bright edge ------------------
          if (vKind > 2.5) {
            float shell = exp(-pow((d - 0.94)*9.0, 2.0));
            float inner = smoothstep(0.94, 0.20, d) * (0.10 + 0.10*fbm(vL*3.0 + uTime*0.4));
            float arcs = 0.0;
            for (int k=0;k<3;k++){
              float ph = uTime*(0.9 + float(k)*0.45) + float(k)*2.1 + vSeed*7.0;
              arcs += exp(-pow((d - (0.60 + float(k)*0.11))*30.0, 2.0)) * pow(max(0.0, cos(ang*2.0 - ph)), 6.0);
            }
            vec3 glass = vec3(0.72, 0.92, 1.0);
            col = glass*(shell*2.0 + inner) + vec3(1.0,0.96,0.82)*arcs*0.9;
            col += glass * exp(-d*2.6) * 0.10;
          }

          float glow = exp(-d*3.4) * 0.085;
          col += mix(uThreat, uFood, vFlip) * glow;

          float a = clamp(max(max(col.r,col.g), col.b), 0.0, 1.0);
          // RESONANCE hush. The one moment the game asks a direct question used
          // to be the busiest frame on screen: the labels snapped off but the
          // SHAPES stayed lit, so four thin answer rings competed against a
          // full-intensity field of hot stars. The field now drops to a twentieth
          // — present, so you can still see where you are, inert, so nothing
          // competes — and the four spheres are simultaneously pushed brighter.
          float isField = step(vKind, 2.5);
          col *= mix(1.0, 0.05, uCalm * isField);
          col *= 1.0 + 0.55 * uCalm * (1.0 - isField);
          gl_FragColor = vec4(col, a);
        }
      `,
    })
    this.mesh = new THREE.Mesh(g, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 10
  }

  begin(): void {
    this.n = 0
  }

  push(x: number, y: number, r: number, flip: number, kind: number, phase: number, seed: number): void {
    const cap = this.aPos.count
    if (this.n >= cap) return
    const i = this.n++
    const p = this.aPos.array as Float32Array
    const d = this.aData.array as Float32Array
    p[i * 3] = x
    p[i * 3 + 1] = y
    p[i * 3 + 2] = r
    d[i * 4] = flip
    d[i * 4 + 1] = kind
    d[i * 4 + 2] = phase
    d[i * 4 + 3] = seed
  }

  end(): void {
    ;(this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = this.n
    if (this.n === 0) return
    this.aPos.addUpdateRange(0, this.n * 3)
    this.aData.addUpdateRange(0, this.n * 4)
    this.aPos.needsUpdate = true
    this.aData.needsUpdate = true
  }

  set(time: number, camX: number, camY: number, span: number, aspect: number, food: readonly [number, number, number], threat: readonly [number, number, number], calm: number): void {
    this.u.uTime!.value = time
    ;(this.u.uCam!.value as THREE.Vector2).set(camX, camY)
    this.u.uSpan!.value = span
    this.u.uAspect!.value = aspect
    ;(this.u.uFood!.value as THREE.Vector3).set(food[0], food[1], food[2])
    ;(this.u.uThreat!.value as THREE.Vector3).set(threat[0], threat[1], threat[2])
    this.u.uCalm!.value = calm
  }
}

// ---------------------------------------------------------------------------
// Cores — player and rivals, one shader, one grammar
// ---------------------------------------------------------------------------

export class Cores {
  readonly mesh: THREE.Mesh
  private readonly aPos: THREE.InstancedBufferAttribute
  private readonly aCol: THREE.InstancedBufferAttribute
  private readonly aData: THREE.InstancedBufferAttribute
  private readonly u: Record<string, THREE.IUniform>
  private n = 0

  constructor(cap: number) {
    const g = quadGeometry()
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)
    this.aData = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4) // threat, surge, self, phase
    for (const a of [this.aPos, this.aCol, this.aData]) a.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute("iPos", this.aPos)
    g.setAttribute("iCol", this.aCol)
    g.setAttribute("iData", this.aData)
    this.u = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector2() },
      uSpan: { value: 400 },
      uAspect: { value: 1 },
      uCombo: { value: 0 },
      uInvuln: { value: 0 },
      uCalm: { value: 0 },
    }
    const mat = new THREE.RawShaderMaterial({
      uniforms: this.u,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 position;
        attribute vec3 iPos;
        attribute vec3 iCol;
        attribute vec4 iData;
        varying vec2 vL; varying vec3 vCol; varying vec4 vD;
        uniform vec2 uCam; uniform float uSpan, uAspect;
        void main(){
          vL = position * 3.2;
          vCol = iCol; vD = iData;
          vec2 world = iPos.xy + position * iPos.z * 3.2;
          vec2 ndc = (world - uCam) / (uSpan*0.5);
          ndc.x /= uAspect;
          gl_Position = vec4(ndc, 0.4, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vL; varying vec3 vCol; varying vec4 vD;
        uniform float uTime, uCombo, uInvuln, uCalm;
        ${NOISE}
        void main(){
          float threat = vD.x, surge = vD.y, self = vD.z, phase = vD.w;
          float d = length(vL);
          float ang = atan(vL.y, vL.x);

          // Membrane: a bright, thin, slightly wobbling edge. The wobble comes
          // from the same noise as the interior so the cell reads as one body.
          float wob = 1.0 + 0.028*sin(ang*5.0 + uTime*1.6 + phase) + 0.020*sin(ang*8.0 - uTime*1.1 + phase*2.0);
          float rr = d / wob;
          float membrane = exp(-pow((rr-0.97)*11.0, 2.0));
          float interior = smoothstep(1.0, 0.30, rr);
          float caustic = fbm(vL*2.2 + vec2(uTime*0.22 + phase, -uTime*0.16));
          float nucleus = exp(-rr*rr*5.5);

          // The shape grammar SNAPS. threat ramps from 0 over the band just
          // above your mass, and hanging the hollowing and the barbs directly
          // off it meant that at 1.05x your size — the near-tie the entire game
          // is about — the spikes were at a tenth of their strength while the
          // colour had already switched fully. Hue was doing the work alone in
          // precisely the place the README promises it never does. Once a thing
          // is a threat at all it LOOKS like one; threat then only says how
          // much of one.
          float threatK = threat > 0.005 ? (0.55 + 0.45*clamp(threat, 0.0, 1.0)) : 0.0;
          float fill = mix(1.0, 0.30, threatK);
          vec3 col = vCol * (membrane*(2.2 + threat*0.9) + interior*(0.16 + caustic*0.30)*fill + nucleus*0.55*fill);
          if (self > 0.5) col += vCol * (interior*(0.42 + caustic*0.34) + nucleus*1.25);
          col += vec3(1.0) * nucleus * nucleus * 0.55;

          // The spiked husk: identical language to a mote too big to eat.
          if (threat > 0.01) {
            float sp = 0.98 + 0.16*cos(ang*9.0 + uTime*1.3 + phase);
            float barb = exp(-pow((d - sp*1.14)*5.2, 2.0)) * pow(max(0.0, cos(ang*9.0 + uTime*1.3 + phase)), 4.0);
            col += vCol * barb * 1.5 * threatK;
            col += vec3(1.0,0.35,0.35) * barb * 0.55 * threatK;
          }

          // Surge corona — a hot forward-facing bloom while burning mass.
          if (surge > 0.01) {
            float corona = exp(-pow((d-1.06)*4.0, 2.0));
            col += vCol * corona * surge * 1.5;
            col += vec3(1.0,0.9,0.7) * corona * surge * 0.5;
          }

          // The player gets a combo halo and a shield while re-forming.
          if (self > 0.5) {
            float halo = exp(-pow((d - (1.16 + 0.05*sin(uTime*3.0)))*3.4, 2.0));
            col += vCol * halo * (0.20 + uCombo*0.55);
            float arc = 0.0;
            arc += pow(max(0.0, cos(ang*2.0 - uTime*1.15)), 12.0) * exp(-pow((d-1.045)*13.0, 2.0));
            arc += pow(max(0.0, cos(ang*3.0 + uTime*0.75 + 1.0)), 14.0) * exp(-pow((d-1.135)*15.0, 2.0));
            col += vec3(1.0) * arc * 1.35;
            col += vCol * arc * 1.1;
            if (uInvuln > 0.001) {
              float hex = abs(sin(ang*6.0 + uTime*2.0));
              float shield = exp(-pow((d - 1.30)*7.0, 2.0)) * (0.45 + 0.55*hex);
              col += vec3(0.7,0.95,1.0) * shield * uInvuln * 1.6;
            }
          }

          float glow = exp(-d*2.8) * 0.10;
          col += vCol * glow;

          // During a Resonance every core but yours falls back into the dark,
          // so the four spheres are the only thing left to look at.
          col *= mix(1.0, 0.07 + self*0.80, uCalm);
          float a = clamp(max(max(col.r,col.g), col.b), 0.0, 1.0);
          gl_FragColor = vec4(col, a);
        }
      `,
    })
    this.mesh = new THREE.Mesh(g, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 20
  }

  begin(): void {
    this.n = 0
  }

  push(x: number, y: number, r: number, cr: number, cg: number, cb: number, threat: number, surge: number, self: number, phase: number): void {
    if (this.n >= this.aPos.count) return
    const i = this.n++
    const p = this.aPos.array as Float32Array
    const c = this.aCol.array as Float32Array
    const d = this.aData.array as Float32Array
    p[i * 3] = x
    p[i * 3 + 1] = y
    p[i * 3 + 2] = r
    c[i * 3] = cr
    c[i * 3 + 1] = cg
    c[i * 3 + 2] = cb
    d[i * 4] = threat
    d[i * 4 + 1] = surge
    d[i * 4 + 2] = self
    d[i * 4 + 3] = phase
  }

  end(): void {
    ;(this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = this.n
    if (this.n === 0) return
    this.aPos.addUpdateRange(0, this.n * 3)
    this.aCol.addUpdateRange(0, this.n * 3)
    this.aData.addUpdateRange(0, this.n * 4)
    this.aPos.needsUpdate = true
    this.aCol.needsUpdate = true
    this.aData.needsUpdate = true
  }

  set(time: number, camX: number, camY: number, span: number, aspect: number, combo: number, invuln: number, calm: number): void {
    this.u.uCalm!.value = calm
    this.u.uTime!.value = time
    ;(this.u.uCam!.value as THREE.Vector2).set(camX, camY)
    this.u.uSpan!.value = span
    this.u.uAspect!.value = aspect
    this.u.uCombo!.value = combo
    this.u.uInvuln!.value = invuln
  }
}

// ---------------------------------------------------------------------------
// Particles — integrated entirely on the GPU, so a burst costs one buffer write
// ---------------------------------------------------------------------------

export class Particles {
  readonly mesh: THREE.Mesh
  private readonly aA: THREE.InstancedBufferAttribute // p0.xy, v0.xy
  private readonly aB: THREE.InstancedBufferAttribute // t0, life, size, kind
  private readonly aC: THREE.InstancedBufferAttribute // colour
  private readonly u: Record<string, THREE.IUniform>
  private readonly cap: number
  private cursor = 0
  private dirtyLo = Infinity
  private dirtyHi = -Infinity
  private live = 0

  constructor(cap: number) {
    this.cap = cap
    const g = quadGeometry()
    this.aA = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4)
    this.aB = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4)
    this.aC = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3)
    for (const a of [this.aA, this.aB, this.aC]) a.setUsage(THREE.DynamicDrawUsage)
    // life = 0 means "never spawned"; the vertex shader collapses those.
    g.setAttribute("iA", this.aA)
    g.setAttribute("iB", this.aB)
    g.setAttribute("iC", this.aC)
    g.instanceCount = cap
    this.u = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector2() },
      uSpan: { value: 400 },
      uAspect: { value: 1 },
      uDrag: { value: 2.4 },
      uMotion: { value: 1 },
      uCalm: { value: 0 },
    }
    const mat = new THREE.RawShaderMaterial({
      uniforms: this.u,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 position;
        attribute vec4 iA; attribute vec4 iB; attribute vec3 iC;
        varying vec2 vL; varying vec3 vCol; varying float vA; varying float vKind;
        uniform vec2 uCam; uniform float uSpan, uAspect, uTime, uDrag, uMotion, uCalm;
        void main(){
          float life = iB.y;
          float t = uTime - iB.x;
          if (life <= 0.0 || t < 0.0 || t > life) { gl_Position = vec4(2.0,2.0,2.0,1.0); vA = 0.0; return; }
          float k = uDrag;
          vec2 p = iA.xy + iA.zw * ((1.0 - exp(-k*t)) / k) * uMotion;
          float u01 = t / life;
          // A quick pop out, then a long settle — the shape of a good spark.
          float grow = smoothstep(0.0, 0.10, u01);
          float fade = 1.0 - u01;
          float s = iB.z * grow * (0.35 + fade*0.85);

          // Elongate along travel so fast debris reads as motion, not as dots.
          vec2 dir = normalize(iA.zw + vec2(1e-5));
          float sp = length(iA.zw) * exp(-k*t);
          float stretch = 1.0 + min(2.6, sp*0.0032) * step(0.5, iB.w) * uMotion;
          vec2 local = position;
          vec2 ax = dir, ay = vec2(-dir.y, dir.x);
          vec2 off = (ax * local.x * stretch + ay * local.y) * s * 3.0;

          vL = position * 3.0;
          vCol = iC;
          vA = pow(fade, 1.35) * mix(1.0, 0.10, uCalm);
          vKind = iB.w;
          vec2 world = p + off;
          vec2 ndc = (world - uCam) / (uSpan*0.5);
          ndc.x /= uAspect;
          gl_Position = vec4(ndc, 0.3, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        varying vec2 vL; varying vec3 vCol; varying float vA; varying float vKind;
        void main(){
          float d = length(vL);
          float core = exp(-d*d*5.0);
          float halo = exp(-d*2.2)*0.35;
          vec3 col = vCol*(core*1.5 + halo) + vec3(1.0)*core*core*0.55;
          gl_FragColor = vec4(col*vA, clamp((core+halo)*vA, 0.0, 1.0));
        }
      `,
    })
    this.mesh = new THREE.Mesh(g, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 15
  }

  setCount(n: number): void {
    this.live = Math.min(n, this.cap)
    ;(this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = this.live
  }

  spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, r: number, g: number, b: number, kind: number, now: number): void {
    const cap = this.live || this.cap
    const i = this.cursor % cap
    this.cursor = (this.cursor + 1) % cap
    const A = this.aA.array as Float32Array
    const B = this.aB.array as Float32Array
    const C = this.aC.array as Float32Array
    A[i * 4] = x
    A[i * 4 + 1] = y
    A[i * 4 + 2] = vx
    A[i * 4 + 3] = vy
    B[i * 4] = now
    B[i * 4 + 1] = life
    B[i * 4 + 2] = size
    B[i * 4 + 3] = kind
    C[i * 3] = r
    C[i * 3 + 1] = g
    C[i * 3 + 2] = b
    if (i < this.dirtyLo) this.dirtyLo = i
    if (i > this.dirtyHi) this.dirtyHi = i
  }

  flush(time: number, camX: number, camY: number, span: number, aspect: number, motion: number, calm: number): void {
    this.u.uCalm!.value = calm
    this.u.uTime!.value = time
    ;(this.u.uCam!.value as THREE.Vector2).set(camX, camY)
    this.u.uSpan!.value = span
    this.u.uAspect!.value = aspect
    this.u.uMotion!.value = motion
    if (this.dirtyHi >= this.dirtyLo) {
      const lo = this.dirtyLo
      const n = this.dirtyHi - lo + 1
      this.aA.addUpdateRange(lo * 4, n * 4)
      this.aB.addUpdateRange(lo * 4, n * 4)
      this.aC.addUpdateRange(lo * 3, n * 3)
      this.aA.needsUpdate = true
      this.aB.needsUpdate = true
      this.aC.needsUpdate = true
      this.dirtyLo = Infinity
      this.dirtyHi = -Infinity
    }
  }
}

// ---------------------------------------------------------------------------
// Rings — shockwaves
// ---------------------------------------------------------------------------

const RING_CAP = 24

export class Rings {
  readonly mesh: THREE.Mesh
  private readonly aA: THREE.InstancedBufferAttribute // x, y, r0, r1
  private readonly aB: THREE.InstancedBufferAttribute // t0, life, width, kind
  private readonly aC: THREE.InstancedBufferAttribute
  private readonly u: Record<string, THREE.IUniform>
  private cursor = 0

  constructor() {
    const g = quadGeometry()
    this.aA = new THREE.InstancedBufferAttribute(new Float32Array(RING_CAP * 4), 4)
    this.aB = new THREE.InstancedBufferAttribute(new Float32Array(RING_CAP * 4), 4)
    this.aC = new THREE.InstancedBufferAttribute(new Float32Array(RING_CAP * 3), 3)
    for (const a of [this.aA, this.aB, this.aC]) a.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute("iA", this.aA)
    g.setAttribute("iB", this.aB)
    g.setAttribute("iC", this.aC)
    g.instanceCount = RING_CAP
    this.u = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector2() },
      uSpan: { value: 400 },
      uAspect: { value: 1 },
    }
    const mat = new THREE.RawShaderMaterial({
      uniforms: this.u,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 position;
        attribute vec4 iA; attribute vec4 iB; attribute vec3 iC;
        varying vec2 vL; varying vec3 vCol; varying float vU; varying float vW; varying float vKind;
        uniform vec2 uCam; uniform float uSpan, uAspect, uTime;
        void main(){
          float life = iB.y; float t = uTime - iB.x;
          if (life <= 0.0 || t < 0.0 || t > life) { gl_Position = vec4(2.0,2.0,2.0,1.0); vU = 1.0; return; }
          float u01 = t/life;
          float e = 1.0 - pow(1.0 - u01, 3.0);           // out-cubic
          float R = mix(iA.z, iA.w, e);
          vL = position * 2.4;
          vCol = iC; vU = u01; vW = iB.z; vKind = iB.w;
          vec2 world = iA.xy + position * R * 2.4;
          vec2 ndc = (world - uCam) / (uSpan*0.5);
          ndc.x /= uAspect;
          gl_Position = vec4(ndc, 0.35, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vL; varying vec3 vCol; varying float vU; varying float vW; varying float vKind;
        uniform float uTime;
        void main(){
          float d = length(vL);
          float ang = atan(vL.y, vL.x);
          float w = vW * (0.16 + (1.0-vU)*0.34);
          float band = exp(-pow((d - 1.0)/max(0.008,w), 2.0));
          // A second, faster inner edge gives the wave a leading crack of light.
          float lead = exp(-pow((d - 0.972)/max(0.0025,w*0.28), 2.0));
          float ripple = 1.0;
          if (vKind > 1.5) ripple = 0.7 + 0.3*cos(ang*12.0 - vU*22.0);
          float fade = pow(1.0 - vU, 1.6);
          vec3 col = vCol * (band*1.15 + lead*1.9) * ripple * fade;
          col += vec3(1.0) * lead * fade * 0.55;
          gl_FragColor = vec4(col, clamp((band+lead)*fade, 0.0, 1.0));
        }
      `,
    })
    this.mesh = new THREE.Mesh(g, mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 25
  }

  spawn(x: number, y: number, r0: number, r1: number, life: number, width: number, kind: number, r: number, g: number, b: number, now: number): void {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % RING_CAP
    const A = this.aA.array as Float32Array
    const B = this.aB.array as Float32Array
    const C = this.aC.array as Float32Array
    A[i * 4] = x
    A[i * 4 + 1] = y
    A[i * 4 + 2] = r0
    A[i * 4 + 3] = r1
    B[i * 4] = now
    B[i * 4 + 1] = life
    B[i * 4 + 2] = width
    B[i * 4 + 3] = kind
    C[i * 3] = r
    C[i * 3 + 1] = g
    C[i * 3 + 2] = b
    this.aA.needsUpdate = true
    this.aB.needsUpdate = true
    this.aC.needsUpdate = true
  }

  set(time: number, camX: number, camY: number, span: number, aspect: number): void {
    this.u.uTime!.value = time
    ;(this.u.uCam!.value as THREE.Vector2).set(camX, camY)
    this.u.uSpan!.value = span
    this.u.uAspect!.value = aspect
  }
}

// ---------------------------------------------------------------------------
// Numerals — drawn last, over the bloom, never eaten by it
// ---------------------------------------------------------------------------

const NUM_CAP = 2400

export class Numerals {
  /** The dark backing slab. Drawn first, as its own pass — see below. */
  readonly plate: THREE.Mesh
  /** The white ink. */
  readonly mesh: THREE.Mesh
  readonly advance: number
  private readonly aPos: THREE.InstancedBufferAttribute // x, y, capHeight, glyph
  private readonly aCol: THREE.InstancedBufferAttribute // r, g, b, alpha
  private readonly uPlate: Record<string, THREE.IUniform>
  private readonly uInk: Record<string, THREE.IUniform>
  /**
   * Both uniform sets, as one preallocated pair.
   *
   * `set()` runs sixty times a second and used to iterate a `[this.uPlate,
   * this.uInk]` literal, which is an array allocation per frame in a file whose
   * stated contract is that nothing allocates after construction.
   */
  private readonly uBoth: Record<string, THREE.IUniform>[]
  private n = 0
  private readonly digits = new Int32Array(12)

  constructor(atlas: Atlas) {
    const g = quadGeometry()
    this.advance = atlas.advance
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(NUM_CAP * 4), 4)
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(NUM_CAP * 4), 4)
    for (const a of [this.aPos, this.aCol]) a.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute("iPos", this.aPos)
    g.setAttribute("iCol", this.aCol)

    // `iPos.z` is CAP HEIGHT in world units — the height of the ink itself,
    // not of the atlas cell. Quoting sizes in ink makes the minimum-size rule
    // in gfx.ts mean what it says: a 13px numeral has thirteen pixels of
    // actual digit, which the old cell-height convention silently turned into
    // about six.
    const VERT = /* glsl */ `
      attribute vec2 position;
      attribute vec4 iPos;
      attribute vec4 iCol;
      varying vec2 vUv; varying vec4 vCol; varying float vAA;
      uniform vec2 uCam; uniform float uSpan, uAspect, uCells, uCellPerCap, uCellAspect, uAAK, uPxPerWorld;
      void main(){
        vec2 uv = position + 0.5;
        // DataTexture is not flipped on upload, so v is inverted here.
        vUv = vec2((iPos.w + uv.x) / uCells, 1.0 - uv.y);
        vCol = iCol;
        float cell = iPos.z * uCellPerCap;
        vec2 world = iPos.xy + position * cell * vec2(uCellAspect, 1.0);
        // Antialias width, in field units, for exactly one screen pixel. The
        // distance field is linear in atlas pixels, so this is arithmetic
        // rather than a guess — and it is why the glyph is as crisp at twelve
        // pixels as at a hundred.
        vAA = clamp(uAAK / max(cell * uPxPerWorld, 0.0001) * 0.62, 0.006, 0.30);
        vec2 ndc = (world - uCam) / (uSpan*0.5);
        ndc.x /= uAspect;
        gl_Position = vec4(ndc, 0.1, 1.0);
      }
    `
    const FRAG = /* glsl */ `
      precision highp float;
      varying vec2 vUv; varying vec4 vCol; varying float vAA;
      uniform sampler2D uAtlas;
      uniform float uIso, uIso2, uPlate;
      uniform vec3 uPlateCol;
      void main(){
        float d = texture2D(uAtlas, vUv).r;
        float core = smoothstep(uIso - vAA, uIso + vAA, d);
        if (uPlate > 0.5) {
          // The plate is the same glyph read at a fatter iso-level, plus a
          // wider, softer aura so a numeral still separates from a core that
          // the bloom has blown to pure white.
          float aura = smoothstep(uIso2 - vAA*2.2, uIso2 + vAA*2.2, d);
          float a = max(core * 0.95, aura * 0.38) * vCol.a;
          gl_FragColor = vec4(uPlateCol, a);
          return;
        }
        gl_FragColor = vec4(vCol.rgb, core * vCol.a);
      }
    `

    const shared = (): Record<string, THREE.IUniform> => ({
      uAtlas: { value: atlas.texture },
      uCam: { value: new THREE.Vector2() },
      uSpan: { value: 400 },
      uAspect: { value: 1 },
      uCells: { value: GLYPH_COUNT },
      uCellPerCap: { value: atlas.cellPerCap },
      uCellAspect: { value: atlas.cellAspect },
      uAAK: { value: atlas.aaK },
      uPxPerWorld: { value: 1 },
      uIso: { value: 0.5 },
      uIso2: { value: atlas.auraIso },
      uPlate: { value: 0 },
      uPlateCol: { value: new THREE.Vector3(0.0, 0.012, 0.028) },
    })

    this.uPlate = shared()
    this.uPlate.uIso!.value = atlas.padIso
    this.uPlate.uPlate!.value = 1
    this.uInk = shared()
    this.uBoth = [this.uPlate, this.uInk]

    const make = (u: Record<string, THREE.IUniform>): THREE.RawShaderMaterial =>
      new THREE.RawShaderMaterial({
        uniforms: u,
        transparent: true,
        blending: THREE.NormalBlending,
        depthTest: false,
        depthWrite: false,
        vertexShader: VERT,
        fragmentShader: FRAG,
      })

    // Two meshes over ONE instance buffer. Every plate lands before any ink
    // does, which is the only way a four-digit number is safe: drawn glyph by
    // glyph, digit n+1's plate would punch a hole in digit n's ink.
    this.plate = new THREE.Mesh(g, make(this.uPlate))
    this.plate.frustumCulled = false
    this.plate.renderOrder = 190
    this.mesh = new THREE.Mesh(g, make(this.uInk))
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 200
  }

  begin(): void {
    this.n = 0
  }

  private glyph(x: number, y: number, cap: number, gi: number, r: number, g: number, b: number, a: number): void {
    if (this.n >= NUM_CAP) return
    const i = this.n++
    const p = this.aPos.array as Float32Array
    const c = this.aCol.array as Float32Array
    p[i * 4] = x
    p[i * 4 + 1] = y
    p[i * 4 + 2] = cap
    p[i * 4 + 3] = gi
    c[i * 4] = r
    c[i * 4 + 1] = g
    c[i * 4 + 2] = b
    c[i * 4 + 3] = a
  }

  /** Width of a signed integer at a given cap height, in world units. */
  widthOf(v: number, cap: number): number {
    const neg = v < 0
    const count = splitDigits(v, this.digits)
    return (count + (neg ? 1 : 0)) * cap * this.advance
  }

  /**
   * Lay out a signed integer centred on (x, y) at cap height `cap`. Digits are
   * extracted into a preallocated scratch array — no `String(n)` in the hot
   * path.
   */
  number(v: number, x: number, y: number, cap: number, r: number, g: number, b: number, a: number): void {
    if (a <= 0.004 || cap <= 0.0001) return
    const neg = v < 0
    const count = splitDigits(v, this.digits)
    const total = count + (neg ? 1 : 0)
    const step = cap * this.advance
    let cx = x - ((total - 1) * step) / 2
    if (neg) {
      this.glyph(cx, y, cap, 10, r, g, b, a)
      cx += step
    }
    for (let i = count - 1; i >= 0; i--) {
      this.glyph(cx, y, cap, this.digits[i] as number, r, g, b, a)
      cx += step
    }
  }

  end(): void {
    ;(this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = this.n
    if (this.n === 0) return
    this.aPos.addUpdateRange(0, this.n * 4)
    this.aCol.addUpdateRange(0, this.n * 4)
    this.aPos.needsUpdate = true
    this.aCol.needsUpdate = true
  }

  set(camX: number, camY: number, span: number, aspect: number, pxPerWorld: number): void {
    for (const u of this.uBoth) {
      ;(u.uCam!.value as THREE.Vector2).set(camX, camY)
      u.uSpan!.value = span
      u.uAspect!.value = aspect
      u.uPxPerWorld!.value = pxPerWorld
    }
  }
}
