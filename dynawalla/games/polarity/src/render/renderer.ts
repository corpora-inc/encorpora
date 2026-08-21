import {
  AdditiveBlending,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  NormalBlending,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
  type Blending,
  type BufferAttribute,
  type Texture,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { LABEL_COLS, LABEL_ROWS } from "../core/labels.ts";
import type { Tier } from "../core/tier.ts";
import { clamp, clamp01, wobble } from "../core/util.ts";
import { BK, EK, HALF_W, PLAYER, polColor } from "../game/constants.ts";
import type { Bullet, Enemy, FloatText, Particle } from "../game/types.ts";
import type { World } from "../game/world.ts";
import { LabelAtlas, buildPromptTexture } from "./atlas.ts";
import { FLOAT_HOLD, classOfBullet, classOfFloat, labelInk, type LabelClass } from "./ink.ts";
import {
  BACKDROP_FRAG,
  BACKDROP_VERT,
  BULLET_FRAG,
  BULLET_VERT,
  ENEMY_FRAG,
  ENEMY_VERT,
  FRONT_FRAG,
  FRONT_VERT,
  GRADE_SHADER,
  LABEL_FRAG,
  LABEL_VERT,
  PART_FRAG,
  PART_VERT,
  PLAYER_FRAG,
  PLAYER_VERT,
  WAVE_FRAG,
  WAVE_VERT,
} from "./shaders.ts";

type Layer = {
  mesh: Mesh;
  geo: InstancedBufferGeometry;
  attrs: Record<string, InstancedBufferAttribute>;
  cap: number;
};

const QUAD = new PlaneGeometry(1, 1);

function makeLayer(
  cap: number,
  spec: Record<string, number>,
  mat: ShaderMaterial,
  order: number,
): Layer {
  const geo = new InstancedBufferGeometry();
  geo.index = QUAD.index;
  geo.setAttribute("position", QUAD.getAttribute("position") as BufferAttribute);
  geo.setAttribute("uv", QUAD.getAttribute("uv") as BufferAttribute);
  const attrs: Record<string, InstancedBufferAttribute> = {};
  for (const [name, size] of Object.entries(spec)) {
    const a = new InstancedBufferAttribute(new Float32Array(cap * size), size);
    a.setUsage(35048 /* DynamicDrawUsage */);
    geo.setAttribute(name, a);
    attrs[name] = a;
  }
  geo.instanceCount = 0;
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  return { mesh, geo, attrs, cap };
}

const shader = (
  vert: string,
  frag: string,
  uniforms: Record<string, { value: unknown }>,
  blending: Blending = AdditiveBlending,
): ShaderMaterial =>
  new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending,
    side: DoubleSide,
  });

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderer;
  private readonly scene = new Scene();
  /**
   * The numerals, and only the numerals.
   *
   * A second scene composited AFTER the bloom pass and after the full-screen
   * composite, rather than a layer inside the first one. Both of those are
   * additive whole-screen lifts, and a numeral drawn underneath them is read
   * THROUGH them: the bloom bleeds an orb's own glow across its digits and a
   * flash whites the field out. Underneath is where the founder's third orb
   * was. Above, the glyph's ground is its own opaque halo and nothing
   * composited later can wash it out — which is what makes the table in
   * `ink.test.ts` a statement about what is on the glass rather than about an
   * intermediate buffer.
   */
  private readonly overlay = new Scene();
  private readonly cam = new OrthographicCamera(-50, 50, 70, -70, 0, 10);
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private grade: ShaderPass | null = null;

  private bullets: Layer;
  private enemies: Layer;
  private parts: Layer;
  private labels: Layer;
  private waves: Layer;
  private readonly player: Mesh;
  private readonly backdrop: Mesh;
  private readonly front: Mesh;
  private readonly promptMesh: Mesh;
  private promptTex: Texture | null = null;
  private promptV = -1;

  private readonly uBack: Record<string, { value: unknown }>;
  private readonly uFront: Record<string, { value: unknown }>;
  private readonly uPlayer: Record<string, { value: unknown }>;
  private readonly uBullet: Record<string, { value: unknown }>;
  private readonly uEnemy: Record<string, { value: unknown }>;
  private readonly uPrompt: Record<string, { value: unknown }>;

  private atlas: LabelAtlas;
  /** values already reported as undrawable, so the log stays one line each */
  private readonly faulted = new Set<number>();
  private tier: Tier;
  private w = 1;
  private h = 1;
  private polSmooth = 1;
  private shakeT = 0;
  /** world units per device pixel — drives every antialias width */
  private px = 0.1;

  constructor(host: HTMLElement, tier: Tier) {
    this.tier = tier;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "pol-canvas";
    host.appendChild(this.canvas);

    this.gl = new WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      stencil: false,
      depth: false,
    });
    this.gl.setClearColor(0x03040b, 1);
    this.gl.autoClear = true;

    // Cell HEIGHT, and the same as the tile size the baked atlas used: the cell
    // has only ever got wider, never shorter, so a numeral has exactly the
    // texels it always had and a long answer is drawn wide rather than crushed.
    this.atlas = new LabelAtlas(tier.name === "low" ? 96 : 128);

    this.uBack = {
      uTime: { value: 0 },
      uPol: { value: 1 },
      uHeat: { value: 0 },
      uAspect: { value: 1 },
      uLoad: { value: 0 },
      uAlive: { value: 1 },
      uMotion: { value: 1 },
      uField: { value: new Vector2(1, 1) },
    };
    this.uFront = {
      uFlash: { value: 0 },
      uFlashCol: { value: [1, 1, 1] },
      uTime: { value: 0 },
      uLoad: { value: 0 },
      uScan: { value: 0 },
      uAspect: { value: 1 },
    };
    this.uPlayer = {
      uPos: { value: new Vector2(0, 0) },
      uScale: { value: 30 },
      uPol: { value: 1 },
      uPx: { value: 0.01 },
      uTime: { value: 0 },
      uInvuln: { value: 0 },
      uAura: { value: 0.4 },
      uLoad: { value: 0 },
      uRecoil: { value: 0 },
      uStun: { value: 0 },
      uAlive: { value: 1 },
    };
    this.uBullet = { uBoost: { value: 1 }, uPx: { value: 0.1 } };
    this.uEnemy = { uTime: { value: 0 }, uPx: { value: 0.1 } };
    const promptInk = labelInk("prompt");
    this.uPrompt = {
      uMap: { value: null },
      uAlpha: { value: 0 },
      uCol: { value: [...promptInk.ink] },
      uHalo: { value: [...promptInk.halo] },
    };

    this.backdrop = new Mesh(QUAD, shader(BACKDROP_VERT, BACKDROP_FRAG, this.uBack, NormalBlending));
    this.backdrop.frustumCulled = false;
    this.backdrop.renderOrder = -100;
    this.scene.add(this.backdrop);

    this.waves = makeLayer(
      24,
      { iPos: 2, iT: 1, iStrength: 1, iPol: 1 },
      shader(WAVE_VERT, WAVE_FRAG, {}),
      5,
    );
    this.parts = makeLayer(
      tier.particles,
      { iPos: 2, iSize: 1, iSize2: 1, iCol: 3, iAlpha: 1, iRot: 1, iKind: 1, iT: 1 },
      shader(PART_VERT, PART_FRAG, {}),
      10,
    );
    this.enemies = makeLayer(
      64,
      { iPos: 2, iSize: 1, iRot: 1, iKind: 1, iPol: 1, iFlash: 1, iHp: 1 },
      shader(ENEMY_VERT, ENEMY_FRAG, this.uEnemy),
      20,
    );
    this.bullets = makeLayer(
      tier.bullets,
      { iPos: 2, iSize: 1, iRot: 1, iKind: 1, iPol: 1, iPull: 1, iGrow: 1 },
      shader(BULLET_VERT, BULLET_FRAG, this.uBullet),
      30,
    );
    this.labels = makeLayer(
      512,
      { iPos: 2, iSize: 1, iTile: 1, iAlpha: 1, iCol: 3, iHalo: 3 },
      shader(
        LABEL_VERT,
        LABEL_FRAG,
        {
          uMap: { value: this.atlas.texture },
          uGrid: { value: new Vector2(LABEL_COLS, LABEL_ROWS) },
          uAspect: { value: this.atlas.aspect },
        },
        // NOT additive, unlike every other layer here. An additive glyph cannot
        // darken anything, so its halo is a no-op and its ceiling on a clipped
        // ground is 1.00:1 — see `ink.ts`.
        NormalBlending,
      ),
      40,
    );

    this.player = new Mesh(QUAD, shader(PLAYER_VERT, PLAYER_FRAG, this.uPlayer));
    this.player.frustumCulled = false;
    this.player.renderOrder = 35;

    this.promptMesh = new Mesh(
      QUAD,
      shader(
        /* glsl */ `
        varying vec2 vUv; uniform vec2 uPos; uniform vec2 uSize;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(uPos + position.xy * uSize, 0.0, 1.0); }`,
        /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D uMap; uniform float uAlpha; uniform vec3 uCol; uniform vec3 uHalo;
        void main(){
          vec4 t = texture2D(uMap, vUv);
          float a = t.a * uAlpha;
          if (a < 0.005) discard;
          gl_FragColor = vec4(mix(uHalo, uCol, t.r), a);
        }`,
        { ...this.uPrompt, uPos: { value: new Vector2(0, 0) }, uSize: { value: new Vector2(1, 1) } },
        NormalBlending,
      ),
    );
    this.promptMesh.frustumCulled = false;
    this.promptMesh.renderOrder = 45;

    this.front = new Mesh(QUAD, shader(FRONT_VERT, FRONT_FRAG, this.uFront));
    this.front.frustumCulled = false;
    this.front.renderOrder = 100;

    for (const l of [this.waves, this.parts, this.enemies, this.bullets]) this.scene.add(l.mesh);
    this.scene.add(this.player, this.front);
    this.overlay.add(this.labels.mesh, this.promptMesh);

    this.buildPost(tier);
  }

  /**
   * The post chain, and where the numerals sit in it.
   *
   * `RenderPass` draws into the READ buffer and declares `needsSwap = false`,
   * which is exactly what an overlay needs: a second one with `clear = false`
   * placed after the bloom paints the numerals on top of the frame the rest of
   * the chain has built, and the grade still runs over the result so the
   * numerals get the same aberration and grain as everything else and do not
   * look pasted on. When there is no grade the bloom is the pass that reaches
   * the screen, and the overlay follows it there.
   */
  private buildPost(tier: Tier): void {
    this.composer?.dispose();
    this.composer = null;
    this.bloom = null;
    this.grade = null;
    if (!tier.bloom && !tier.grade) return;
    const c = new EffectComposer(this.gl);
    c.addPass(new RenderPass(this.scene, this.cam));
    if (tier.bloom) {
      this.bloom = new UnrealBloomPass(new Vector2(this.w, this.h), 0.62, 0.68, 0.12);
      c.addPass(this.bloom);
    }
    const over = new RenderPass(this.overlay, this.cam);
    over.clear = false;
    if (tier.grade) {
      c.addPass(over);
      this.grade = new ShaderPass(GRADE_SHADER as never);
      this.grade.renderToScreen = true;
      c.addPass(this.grade);
    } else {
      if (this.bloom) this.bloom.renderToScreen = true;
      over.renderToScreen = true;
      c.addPass(over);
    }
    this.composer = c;
    c.setSize(this.w, this.h);
  }

  setTier(tier: Tier): void {
    if (tier.name === this.tier.name) return;
    this.tier = tier;
    this.gl.setPixelRatio(Math.min(devicePixelRatio || 1, tier.maxDpr));
    this.buildPost(tier);
    this.resize(this.w, this.h);
  }

  resize(cssW: number, cssH: number): void {
    this.w = Math.max(1, cssW);
    this.h = Math.max(1, cssH);
    this.gl.setPixelRatio(Math.min(devicePixelRatio || 1, this.tier.maxDpr));
    this.gl.setSize(this.w, this.h, false);
    this.composer?.setSize(this.w, this.h);
    this.bloom?.setSize(this.w, this.h);
  }

  /** Fit the playfield into the canvas, letterboxing into the cabinet gutters. */
  private frame(w: World): void {
    const scale = Math.min(this.w / (2 * HALF_W), this.h / (2 * w.halfH));
    const halfWv = this.w / (2 * scale);
    const halfHv = this.h / (2 * scale);
    this.cam.left = -halfWv;
    this.cam.right = halfWv;
    this.cam.top = halfHv;
    this.cam.bottom = -halfHv;
    this.px = (2 * halfWv) / Math.max(1, this.w * Math.min(devicePixelRatio || 1, this.tier.maxDpr));
    (this.uBack.uField as { value: Vector2 }).value.set(
      clamp(HALF_W / halfWv, 0.05, 1),
      clamp(w.halfH / halfHv, 0.05, 1),
    );
    (this.uBack.uAspect as { value: number }).value = this.w / this.h;
    (this.uFront.uAspect as { value: number }).value = this.w / this.h;
  }

  dispose(): void {
    this.composer?.dispose();
    this.gl.dispose();
    this.atlas.dispose();
    this.promptTex?.dispose();
    this.canvas.remove();
  }

  // -------------------------------------------------------------------------

  draw(w: World, dt: number): void {
    const fx = w.fx;
    this.frame(w);

    // --- camera: trauma shake (shake = trauma², Art of Screenshake), punch, tilt
    this.shakeT += dt;
    const tr = fx.trauma * fx.trauma;
    const amp = tr * 5.2;
    const sx = Math.sin(this.shakeT * 61.7) * amp + Math.sin(this.shakeT * 113.1) * amp * 0.4;
    const sy = Math.cos(this.shakeT * 73.3) * amp + Math.cos(this.shakeT * 131.7) * amp * 0.35;
    this.cam.position.set(sx, sy, 5);
    this.cam.rotation.z = w.reduced ? 0 : tr * 0.035 * Math.sin(this.shakeT * 44.0);
    const pz = fx.punch > 0 ? wobble(fx.punchT, 26, 11) * fx.punch : 0;
    this.cam.zoom = 1 + pz * 0.055;
    this.cam.updateProjectionMatrix();

    // --- backdrop / composite uniforms
    this.polSmooth += (w.pol - this.polSmooth) * Math.min(1, dt * 9);
    const load = clamp01(Math.abs(w.core) / Math.max(1, w.cap));
    const alive = w.phase === "play" ? 1 : 0;
    (this.uBack.uTime as { value: number }).value = w.wall;
    (this.uBack.uPol as { value: number }).value = this.polSmooth;
    (this.uBack.uHeat as { value: number }).value = clamp01(w.stratum / 14);
    (this.uBack.uLoad as { value: number }).value = load;
    (this.uBack.uAlive as { value: number }).value = alive;
    (this.uBack.uMotion as { value: number }).value = w.reduced ? 0 : 1;

    (this.uFront.uFlash as { value: number }).value = fx.flash;
    (this.uFront.uFlashCol as { value: number[] }).value = [fx.flashR, fx.flashG, fx.flashB];
    (this.uFront.uTime as { value: number }).value = w.wall;
    (this.uFront.uLoad as { value: number }).value = load;
    (this.uFront.uScan as { value: number }).value = this.tier.grade && !w.reduced ? 1 : 0;

    (this.uBullet.uPx as { value: number }).value = this.px;
    // small screens get visually fatter bullets; the hitbox never changes
    (this.uBullet.uBoost as { value: number }).value = this.w < 520 ? 1.22 : 1;
    (this.uEnemy.uTime as { value: number }).value = w.wall;
    (this.uEnemy.uPx as { value: number }).value = this.px;

    this.fillWaves(w);
    this.fillParticles(w);
    this.fillEnemies(w);
    this.fillBullets(w);
    this.fillLabels(w);
    this.fillPlayer(w, load, alive);
    this.fillPrompt(w);

    if (this.grade) {
      const u = this.grade.uniforms as Record<string, { value: number }>;
      if (u.uAmount) u.uAmount.value = w.reduced ? 0 : clamp(tr * 3.2 + fx.flash * 2.0, 0, 2.2);
      if (u.uTime) u.uTime.value = w.wall;
      if (u.uGrain) u.uGrain.value = w.reduced ? 0.02 : 0.05;
    }
    if (this.bloom) {
      this.bloom.strength = 0.55 + fx.glow * 0.5 + (w.reduced ? 0 : tr * 0.5);
    }

    if (this.composer) {
      this.composer.render();
    } else {
      // LOW tier: no post chain at all, so the overlay is a second direct
      // render with the clear suppressed. The numerals still land last.
      this.gl.render(this.scene, this.cam);
      this.gl.autoClear = false;
      this.gl.render(this.overlay, this.cam);
      this.gl.autoClear = true;
    }
  }

  // -------------------------------------------------------------------------

  private fillWaves(w: World): void {
    const L = this.waves;
    const pos = L.attrs.iPos as InstancedBufferAttribute;
    const t = L.attrs.iT as InstancedBufferAttribute;
    const s = L.attrs.iStrength as InstancedBufferAttribute;
    const p = L.attrs.iPol as InstancedBufferAttribute;
    const src = w.fx.waves;
    const n = Math.min(L.cap, w.fx.waveN);
    for (let i = 0; i < n; i++) {
      const o = i * 6;
      (pos.array as Float32Array)[i * 2] = src[o] as number;
      (pos.array as Float32Array)[i * 2 + 1] = src[o + 1] as number;
      (t.array as Float32Array)[i] = (src[o + 2] as number) / (src[o + 3] as number);
      (s.array as Float32Array)[i] = src[o + 4] as number;
      (p.array as Float32Array)[i] = src[o + 5] as number;
    }
    L.geo.instanceCount = n;
    for (const a of [pos, t, s, p]) a.needsUpdate = true;
  }

  private fillParticles(w: World): void {
    const L = this.parts;
    const pos = (L.attrs.iPos as InstancedBufferAttribute).array as Float32Array;
    const size = (L.attrs.iSize as InstancedBufferAttribute).array as Float32Array;
    const size2 = (L.attrs.iSize2 as InstancedBufferAttribute).array as Float32Array;
    const col = (L.attrs.iCol as InstancedBufferAttribute).array as Float32Array;
    const alpha = (L.attrs.iAlpha as InstancedBufferAttribute).array as Float32Array;
    const rot = (L.attrs.iRot as InstancedBufferAttribute).array as Float32Array;
    const kind = (L.attrs.iKind as InstancedBufferAttribute).array as Float32Array;
    const tt = (L.attrs.iT as InstancedBufferAttribute).array as Float32Array;
    const n = Math.min(L.cap, w.partN);
    for (let i = 0; i < n; i++) {
      const p = w.parts[i] as Particle;
      const t = clamp01(p.age / p.life);
      pos[i * 2] = p.x;
      pos[i * 2 + 1] = p.y;
      size[i] = p.kind === 2 ? p.size : p.size * (1 - t * 0.55);
      size2[i] = p.size2;
      col[i * 3] = p.r;
      col[i * 3 + 1] = p.g;
      col[i * 3 + 2] = p.b;
      alpha[i] = p.a * (1 - t) * (1 - t);
      rot[i] = p.rot;
      kind[i] = p.kind;
      tt[i] = t;
    }
    L.geo.instanceCount = n;
    for (const k of Object.keys(L.attrs)) (L.attrs[k] as InstancedBufferAttribute).needsUpdate = true;
  }

  private fillEnemies(w: World): void {
    const L = this.enemies;
    const pos = (L.attrs.iPos as InstancedBufferAttribute).array as Float32Array;
    const size = (L.attrs.iSize as InstancedBufferAttribute).array as Float32Array;
    const rot = (L.attrs.iRot as InstancedBufferAttribute).array as Float32Array;
    const kind = (L.attrs.iKind as InstancedBufferAttribute).array as Float32Array;
    const pol = (L.attrs.iPol as InstancedBufferAttribute).array as Float32Array;
    const flash = (L.attrs.iFlash as InstancedBufferAttribute).array as Float32Array;
    const hp = (L.attrs.iHp as InstancedBufferAttribute).array as Float32Array;
    const n = Math.min(L.cap, w.enemyN);
    for (let i = 0; i < n; i++) {
      const e = w.enemies[i] as Enemy;
      pos[i * 2] = e.x;
      pos[i * 2 + 1] = e.y;
      size[i] = e.r * (1 + e.hitFlash * 0.09);
      rot[i] = e.rot;
      kind[i] = e.kind;
      pol[i] = e.pol;
      flash[i] = e.hitFlash;
      hp[i] = clamp01(e.hp / e.maxHp);
    }
    L.geo.instanceCount = n;
    for (const k of Object.keys(L.attrs)) (L.attrs[k] as InstancedBufferAttribute).needsUpdate = true;
  }

  private fillBullets(w: World): void {
    const L = this.bullets;
    const pos = (L.attrs.iPos as InstancedBufferAttribute).array as Float32Array;
    const size = (L.attrs.iSize as InstancedBufferAttribute).array as Float32Array;
    const rot = (L.attrs.iRot as InstancedBufferAttribute).array as Float32Array;
    const kind = (L.attrs.iKind as InstancedBufferAttribute).array as Float32Array;
    const pol = (L.attrs.iPol as InstancedBufferAttribute).array as Float32Array;
    const pull = (L.attrs.iPull as InstancedBufferAttribute).array as Float32Array;
    const grow = (L.attrs.iGrow as InstancedBufferAttribute).array as Float32Array;
    const n = Math.min(L.cap, w.bulletN);
    for (let i = 0; i < n; i++) {
      const b = w.bullets[i] as Bullet;
      pos[i * 2] = b.x;
      pos[i * 2 + 1] = b.y;
      size[i] = b.r;
      rot[i] = b.rot;
      kind[i] = b.kind;
      pol[i] = b.owner === 2 ? 0 : Math.sign(b.v);
      pull[i] = b.pull;
      grow[i] = b.grow;
    }
    L.geo.instanceCount = n;
    for (const k of Object.keys(L.attrs)) (L.attrs[k] as InstancedBufferAttribute).needsUpdate = true;
  }

  /**
   * Every numeral on the field, resolved to a tile HERE rather than at spawn.
   *
   * That ordering is the whole guard. A tile is claimed the frame its value is
   * first drawn and reclaimed only from a value nothing drew this frame, so an
   * orb can never be handed a tile that has since been repainted, and — because
   * `tileFor` never refuses — never be handed no tile at all. The one branch
   * that could still drop a numeral is `orbFault`, and it shouts.
   */
  private fillLabels(w: World): void {
    const L = this.labels;
    const A = this.atlas;
    A.beginFrame();
    const pos = (L.attrs.iPos as InstancedBufferAttribute).array as Float32Array;
    const size = (L.attrs.iSize as InstancedBufferAttribute).array as Float32Array;
    const tile = (L.attrs.iTile as InstancedBufferAttribute).array as Float32Array;
    const alpha = (L.attrs.iAlpha as InstancedBufferAttribute).array as Float32Array;
    const col = (L.attrs.iCol as InstancedBufferAttribute).array as Float32Array;
    const halo = (L.attrs.iHalo as InstancedBufferAttribute).array as Float32Array;
    let n = 0;
    const put = (x: number, y: number, s: number, t: number, a: number, cls: LabelClass): void => {
      if (n >= L.cap || t < 0) return;
      const pair = labelInk(cls);
      pos[n * 2] = x;
      pos[n * 2 + 1] = y;
      size[n] = s;
      tile[n] = t;
      alpha[n] = a;
      col[n * 3] = pair.ink[0];
      col[n * 3 + 1] = pair.ink[1];
      col[n * 3 + 2] = pair.ink[2];
      halo[n * 3] = pair.halo[0];
      halo[n * 3 + 1] = pair.halo[1];
      halo[n * 3 + 2] = pair.halo[2];
      n++;
    };

    const boost = this.w < 520 ? 1.18 : 1;
    for (let i = 0; i < w.bulletN; i++) {
      const b = w.bullets[i] as Bullet;
      if (!b.labelled) continue;
      const t = A.tileFor(b.v);
      if (t < 0) {
        this.orbFault(b.v, b.kind === BK.Orb);
        continue;
      }
      const isOrb = b.kind === BK.Orb;
      const s = (isOrb ? b.r * 1.35 : b.r * 1.55) * boost;
      put(b.x, b.y, s, t, 1, classOfBullet(isOrb, b.v));
    }
    for (let i = 0; i < w.textN; i++) {
      const t = w.texts[i] as FloatText;
      const k = clamp01(t.age / t.life);
      const a = Math.min(1, (1 - k) * FLOAT_HOLD) ** 2;
      put(t.x, t.y, t.size * (1 + k * 0.5), A.tileFor(t.value), a, classOfFloat(t.value));
    }
    // the Warden prints the exact total it demands, right on its hull
    for (let i = 0; i < w.enemyN; i++) {
      const e = w.enemies[i] as Enemy;
      if (e.kind !== EK.Warden || e.lockState !== 1) continue;
      const pulse = 0.7 + 0.3 * Math.sin(w.wall * 5);
      put(e.x, e.y, e.r * 1.15, A.tileFor(e.lockWant), pulse, "wardenLock");
    }
    A.flush();
    L.geo.instanceCount = n;
    for (const k of Object.keys(L.attrs)) (L.attrs[k] as InstancedBufferAttribute).needsUpdate = true;
  }

  /**
   * A numeral that could not be drawn. Unreachable, and deliberately noisy
   * anyway: this is the exact shape of the bug that shipped four blank glowing
   * discs to a child and said nothing. Logged once per value so a broken frame
   * does not become a broken console.
   */
  private orbFault(v: number, isOrb: boolean): void {
    if (this.faulted.has(v)) return;
    this.faulted.add(v);
    console.error(
      `[polarity] no tile for ${String(v)}${isOrb ? " — AN ORB WOULD HAVE BEEN BLANK" : ""}`,
    );
  }

  private fillPlayer(w: World, load: number, alive: number): void {
    const scale = PLAYER.absorb * 2.9;
    (this.uPlayer.uPos as { value: Vector2 }).value.set(w.px, w.py - w.recoil * 1.6);
    (this.uPlayer.uScale as { value: number }).value = scale;
    // morph runs through zero so the hull genuinely inverts rather than recolours
    const m = w.polMorph >= 1 ? w.pol : w.pol * (w.polMorph * 2 - 1) * -1;
    (this.uPlayer.uPol as { value: number }).value = w.polMorph >= 1 ? w.pol : m;
    (this.uPlayer.uPx as { value: number }).value = this.px / scale;
    (this.uPlayer.uTime as { value: number }).value = w.wall;
    (this.uPlayer.uInvuln as { value: number }).value = w.invuln > 0 ? 1 : 0;
    (this.uPlayer.uAura as { value: number }).value = (PLAYER.absorb / scale) * 3;
    (this.uPlayer.uLoad as { value: number }).value = load;
    (this.uPlayer.uRecoil as { value: number }).value = w.recoil;
    (this.uPlayer.uStun as { value: number }).value = w.stun > 0 && w.phase === "play" ? 1 : 0;
    (this.uPlayer.uAlive as { value: number }).value = alive;
    this.player.visible = w.phase === "play";
  }

  private fillPrompt(w: World): void {
    if (w.promptV !== this.promptV) {
      this.promptV = w.promptV;
      this.promptTex?.dispose();
      this.promptTex = w.prompt ? buildPromptTexture(w.prompt) : null;
      const u = (this.promptMesh.material as ShaderMaterial).uniforms;
      (u.uMap as { value: Texture | null }).value = this.promptTex;
    }
    let host: Enemy | null = null;
    for (let i = 0; i < w.enemyN; i++) {
      const e = w.enemies[i] as Enemy;
      if (e.seal === w.seal.serial && (e.kind === EK.Bearer || e.kind === EK.Warden)) host = e;
    }
    const show = host !== null && w.seal.state === "asking" && this.promptTex !== null;
    this.promptMesh.visible = show;
    if (!show || !host) return;
    const u = (this.promptMesh.material as ShaderMaterial).uniforms;
    const wide = Math.min(HALF_W * 1.6, 62);
    (u.uPos as { value: Vector2 }).value.set(host.x, host.y + host.r * 1.28);
    (u.uSize as { value: Vector2 }).value.set(wide, wide * 0.25);
    (u.uAlpha as { value: number }).value = 1;
  }

  /** The polarity colour a HUD element should use. Kept here so CSS matches GLSL. */
  static hudColor(pol: number): string {
    const c = polColor(pol);
    return `rgb(${Math.round((c[0] as number) * 255)},${Math.round((c[1] as number) * 255)},${Math.round((c[2] as number) * 255)})`;
  }
}
