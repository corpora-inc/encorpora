/**
 * MONUMENT — assembly and the frame loop.
 *
 * Composition rule the camera obeys: the top of the tower and the stone about
 * to be set are ALWAYS at the same place on screen, whatever the aspect ratio.
 * On a phone held upright the extra room goes to the tower, so you see how far
 * you have come; in landscape it goes to the sweep, so you can see the stone
 * approach. The distance is solved per frame from the sweep width, which means
 * the shot tightens by itself as the tower narrows — the drama is free.
 */

import {
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector3,
  WebGLRenderer,
  BoxGeometry,
  SRGBColorSpace,
} from "three";

import { createInstructions } from "../../../../packs/shared/game-chrome/index.ts";
import type { Host } from "../contract.ts";
import { Sim, type PlaceEvent, type SimEvent } from "./sim.ts";
import { T } from "./tuning.ts";
import { isBright, luma, stratumAt, type Stratum } from "./strata.ts";
import { Flash, HitStop, Shake, Spring, clamp01, damp, easeOutCubic } from "../feel/feel.ts";
import { Audio } from "../audio/audio.ts";
import { Hud } from "../ui/hud.ts";
import { Sky } from "../view/sky.ts";
import { Post } from "../view/post.ts";
import { Fallers, Sparks } from "../view/particles.ts";
import { Rings, disposeRingGeometry } from "../view/rings.ts";
import { Plaque, SlabPool, disposeSharedGeometry } from "../view/slabs.ts";
import { disposeTextures } from "../view/textures.ts";
import { FpsMeter, TierWatch, detectTier, TIERS, type Tier } from "../view/tier.ts";

const DEG = Math.PI / 180;
const ELEV = 21 * DEG;
const AZ = 45 * DEG;
const FOV = 34;
/** Where the stone-about-to-be-set sits on screen, 0 = top, 1 = bottom. */
const ACTION_SCREEN_Y = 0.33;
const HOVER = T.SLAB_H * 1.15;
const DROP_MS = 88;

export function mount(
  el: HTMLElement,
  host: Host,
): { unmount(): void; setPaused(paused: boolean): void } {
  const reduced = host.prefersReducedMotion();
  let raf = 0;
  let running = true;
  let tier: Tier = detectTier();

  /* ── surface ────────────────────────────────────────────────────────── */

  const holder = document.createElement("div");
  holder.style.cssText =
    "position:relative;width:100%;height:100%;overflow:hidden;background:#05060f;touch-action:none;";
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
  holder.appendChild(canvas);
  el.appendChild(holder);

  const renderer = new WebGLRenderer({
    canvas,
    antialias: tier.antialias,
    powerPreference: "high-performance",
    stencil: false,
    alpha: false,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  // A lost context must stop the loop rather than throw sixty times a second.
  // Browsers cap the number of live WebGL contexts per document, so a host that
  // mounts and unmounts packs will eventually take one away.
  const onContextLost = (e: Event): void => {
    e.preventDefault();
    running = false;
    cancelAnimationFrame(raf);
    console.warn("[stack] WebGL context lost — the game has stopped");
  };
  canvas.addEventListener("webglcontextlost", onContextLost, false);
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tier.dprCap));

  const scene = new Scene();
  const fogColor = new Color(0x080a18);
  scene.fog = new Fog(fogColor.getHex(), 8, 30);

  const camera = new PerspectiveCamera(FOV, 1, 0.35, 220);

  /* ── light ──────────────────────────────────────────────────────────── */

  const hemi = new HemisphereLight(0x3a4a86, 0x0a0c18, 0.78);
  scene.add(hemi);

  const key = new DirectionalLight(0xfff0dd, 1.55);
  key.castShadow = true;
  key.shadow.mapSize.set(tier.shadowSize || 256, tier.shadowSize || 256);
  key.shadow.camera.left = -3.2;
  key.shadow.camera.right = 3.2;
  key.shadow.camera.top = 3.2;
  key.shadow.camera.bottom = -3.2;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 18;
  key.shadow.bias = -0.0022;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  const rim = new DirectionalLight(0x4d7bff, 0.95);
  scene.add(rim, rim.target);

  // The hot enamel, as an EVENT rather than a coat of paint. Tinting the slab
  // bodies with the accent turned an authored blue-grey into lavender in every
  // frame; a point light that flares on contact and dies in a third of a second
  // puts the same colour on the stone only when something happened.
  const flare = new PointLight(0xff6a1f, 0, 4.5, 2);
  scene.add(flare);
  let flareI = 0;

  /* ── the monument ───────────────────────────────────────────────────── */

  const tower = new Group();
  scene.add(tower);

  const pool = new SlabPool(tier.slabPool, true);
  tower.add(pool.group);

  // The shaft the whole monument stands on. Without it the first course floats
  // in the sky and the composition has no weight; with it the tower reads as
  // something that goes all the way down past the city.
  const plinthMat = new MeshStandardMaterial({ roughness: 0.72, metalness: 0.0 });
  const plinth = new Mesh(new BoxGeometry(1, 1, 1), plinthMat);
  plinth.castShadow = false;
  plinth.receiveShadow = true;
  tower.add(plinth);

  const blockMat = new MeshStandardMaterial({ roughness: 0.5, metalness: 0.04 });
  const block = new Mesh(new BoxGeometry(1, 1, 1), blockMat);
  block.castShadow = true;
  block.receiveShadow = false;
  scene.add(block);

  const plaqueBlock = new Plaque();
  const plaqueTower = [new Plaque(), new Plaque()];
  scene.add(plaqueBlock.group, ...plaqueTower.map((p) => p.group));

  const sparks = new Sparks(tier.particles);
  scene.add(sparks.points);
  const fallers = new Fallers(tier.debris * 4);
  scene.add(fallers.mesh);
  const rings = new Rings(6);
  scene.add(rings.group);

  const sky = new Sky();
  let post = new Post(1, 1, tier.bloom, tier.bloomDiv);

  /* ── systems ────────────────────────────────────────────────────────── */

  const audio = new Audio();
  audio.start(); // builds the graph now; a gesture only resumes it
  const shake = new Shake();
  shake.scale = reduced ? 0 : 1;
  const hitstop = new HitStop();
  const flash = new Flash(reduced ? 0 : T.FLASH_MAX_ALPHA, T.FLASH_MIN_GAP_MS, T.FLASH_FADE_MS);
  const camY = new Spring(0, T.CAM_SPRING, T.CAM_DAMP);
  const squash = new Spring(1, T.SQUASH_SPRING, T.SQUASH_DAMP);
  const fps = new FpsMeter();

  const sim = new Sim(host);

  function restart(): void {
    hud.hideOver();
    fallers.clear();
    rings.clear();
    sparks.clearAmbient();
    sim.reset();
    collapsed = false;
    collapseAt = -1;
    visualFloor = 0;
    camY.set(camTargetY());
    drop.active = false;
    drop.ev = null;
    slowmo = 0;
    shake.trauma = 0;
    applyStratum(stratumAt(0), 1);
  }

  const hud = new Hud(
    holder,
    {
      onRestart: restart,
      onRevive: () => {
        sim.offerRevive();
        if (sim.reviveQ) hud.showRevive(sim.reviveQ.prompt, sim.reviveChoices);
      },
      onChoose: (v) => {
        // The revive panel is real DOM sitting under whatever the host raised.
        // Answering it behind a sheet reports an item the child never saw.
        if (paused) return;
        const answer = sim.reviveQ?.answer ?? "";
        hud.markChoice(v, answer);
        const ok = sim.answerRevive(v, clock);
        audio.revive(ok);
        setTimeout(
          () => {
            if (ok) {
              hud.hideOver();
              fallers.clear();
              visualFloor = sim.floor;
              camY.set(camTargetY());
              rebuildFromSim();
            } else {
              hud.showOver(sim.floor, false);
            }
          },
          ok ? 480 : 900,
        );
      },
      onToggleAudio: (on) => {
        audio.enabled = on;
        if (on) audio.resume();
      },
    },
    reduced,
  );

  /* ── the clock, and who is allowed to stop it ───────────────────────────
   *
   * MONUMENT had no pause of any kind. Behind the manual the sweep kept
   * sweeping, the slot kept turning over — and worse, `dither` kept compounding,
   * so the sheet that says "Waiting never costs you anything" was itself making
   * the stone faster while it was open. Behind a host sheet the same, with no
   * scrim of ours to catch the tap.
   *
   * Declared above `createInstructions` because the sheet closes over them.
   */
  let paused = false;
  // The manual only lifts a pause it put on itself. A game the host had already
  // paused must not be handed back running because a child closed the rules.
  let heldForManual = false;

  // How to play. MONUMENT asks for two judgements in one tap — is this the
  // right value, and is it over the tower — and shipped saying only "Tap to set
  // the stone". A child who does not know the value matters reads the tap as
  // the whole game, drops on the first pass every time, and watches the tower
  // shear for reasons nothing on screen explains.
  //
  // It goes on `el` rather than on `holder`, so a tap on the panel is not also
  // a tap on the game: `holder` is what listens for the drop.
  const guide = createInstructions(el, {
    title: "MONUMENT",
    summary: [
      "A stone slides back and forth above your tower. Tap once to drop it.",
      "Drop it when the number on the stone is the right answer, and when it lines up with the tower.",
    ],
    sections: [
      {
        heading: "Two things have to be right",
        lines: [
          "There is a sum near the top, like 3 + ? = 10.",
          "The stone has a number on it. That number changes every time the stone turns around.",
          "Wait until the stone is showing the answer.",
          "Then tap when the stone is sitting right over the tower.",
        ],
      },
      {
        heading: "The tower",
        lines: [
          "Any part of the stone that hangs over the edge breaks off, so the tower gets thinner.",
          "Land it dead straight and the tower gets wider instead.",
          "Drop a wrong number and the stone cracks and takes even more off.",
          "If the tower gets too thin, it falls over and the run is done.",
        ],
      },
      {
        heading: "Waiting is free",
        lines: [
          "If the stone is showing a wrong number, do not tap. Let it go round again.",
          "You get a whole pass to read a number and decide.",
          "Waiting never costs you anything.",
        ],
      },
    ],
    reducedMotion: reduced,
    // The one part of pausing the shared sheet cannot do for us. It holds the
    // sound, the keys and the taps; it has no idea the sweep exists.
    onOpen: () => {
      if (paused) return;
      heldForManual = true;
      setPaused(true);
    },
    onClose: () => {
      if (!heldForManual) return;
      heldForManual = false;
      setPaused(false);
    },
  });

  /* ── palette blending ───────────────────────────────────────────────── */

  let cur: Stratum = stratumAt(0);
  let want: Stratum = cur;
  const cHemiUp = new Color();
  const cHemiDown = new Color();
  const cKey = new Color();
  const cRim = new Color();
  const cSlab = new Color();
  const cAccent = new Color();
  const cFog = new Color();
  const scratch = new Color();
  const scratch2 = new Color();

  function applyStratum(s: Stratum, t: number): void {
    want = s;
    if (t >= 1) {
      cur = s;
      cHemiUp.setHex(s.hemiUp);
      cHemiDown.setHex(s.hemiDown);
      cKey.setHex(s.key);
      cRim.setHex(s.rim);
      cSlab.setHex(s.slab);
      cAccent.setHex(s.accent);
      cFog.setHex(s.sky[0]);
      sky.setPalette(s.sky, s.spire, s.accent, s.name.startsWith("AURORA") ? 1 : 0);
      pushPalette();
      sparks.seedMotes(camY.value, reduced ? Math.round(tier.motes * 0.35) : tier.motes, s.mote.color, s.mote.rise, s.mote.drift, s.mote.size);
    }
  }

  function blendPalette(dt: number): void {
    if (cur === want) return;
    const t = Math.min(1, dt * 2.6);
    scratch.setHex(want.hemiUp);
    cHemiUp.lerp(scratch, t);
    scratch.setHex(want.hemiDown);
    cHemiDown.lerp(scratch, t);
    scratch.setHex(want.key);
    cKey.lerp(scratch, t);
    scratch.setHex(want.rim);
    cRim.lerp(scratch, t);
    scratch.setHex(want.slab);
    cSlab.lerp(scratch, t);
    scratch.setHex(want.accent);
    cAccent.lerp(scratch, t);
    scratch.setHex(want.sky[0]);
    cFog.lerp(scratch, t);
    sky.lerpPalette(want.sky, want.spire, want.accent, want.name.startsWith("AURORA") ? 1 : 0, t);
    pushPalette();
  }

  function pushPalette(): void {
    hemi.color.copy(cHemiUp);
    hemi.groundColor.copy(cHemiDown);
    key.color.copy(cKey);
    rim.color.copy(cRim);
    (scene.fog as Fog).color.copy(cFog);
    fallers.setColor(cSlab.getHex());
    const bright = isBright(want);
    // An accent chosen to glow against a night sky is unreadable as text on a
    // bright one, so it is darkened for chrome use only — the 3D accent, which
    // is emissive and blooms, keeps its authored value.
    scratch.copy(cAccent);
    if (bright && luma(scratch.getHex()) > 0.3) scratch.multiplyScalar(0.42);
    hud.setPalette(bright, bright ? "#f4f6fb" : "#" + cFog.getHexString(), "#" + scratch.getHexString());
  }

  /* ── framing ────────────────────────────────────────────────────────── */

  let visualFloor = 0;
  let aspect = 1;
  let dist = 9;
  /**
   * Plaques are sized in world units but must be a constant number of SCREEN
   * pixels, because a value a child reads under time pressure cannot get
   * smaller when the camera happens to pull back. The camera solves its own
   * distance per frame, so the plaques divide it back out.
   */
  const PLAQUE_REF = 9.5;
  let plaqueK = 1;

  function camTargetY(): number {
    return (visualFloor + 1) * T.SLAB_H;
  }

  function solveDistance(): number {
    const halfFovY = (FOV * 0.5) * DEG;
    const tanY = Math.tan(halfFovY);
    const tanX = tanY * aspect;
    // Horizontal: the whole sweep, plus the stone, plus air.
    const needX = sim.sweepHalf + 0.55 + 0.2;
    // Vertical: the stone above, and seven courses of tower below.
    const needY = (1.35 + 7 * T.SLAB_H) * 0.5;
    const dx = needX / Math.max(0.05, tanX);
    const dy = needY / Math.max(0.05, tanY) / Math.cos(ELEV);
    return Math.max(6.4, Math.min(30, Math.max(dx, dy)));
  }

  /* ── drop animation ─────────────────────────────────────────────────── */

  const drop = { active: false, t: 0, ev: null as PlaceEvent | null, x: 0, z: 0 };

  /* ── events ─────────────────────────────────────────────────────────── */

  const evBuf: SimEvent[] = [];
  let clock = 0;
  let slowmo = 0;
  let collapseAt = -1;
  let collapsed = false;
  let firstPlacement = true;

  function onPlaceImpact(ev: PlaceEvent): void {
    const s = cur;
    const y = ev.outcome === "miss" ? (visualFloor + 1) * T.SLAB_H : (sim.floor) * T.SLAB_H;
    const bx = drop.x;
    const bz = drop.z;

    if (ev.outcome !== "miss") visualFloor = sim.floor;

    // SLEEP, SCREENSHAKE, CAMERA KICK.
    const stopMs =
      ev.outcome === "perfect"
        ? T.HITSTOP_PERFECT_MS
        : ev.outcome === "wrong"
          ? T.HITSTOP_WRONG_MS
          : ev.outcome === "miss"
            ? T.HITSTOP_MISS_MS
            : T.HITSTOP_PLACE_MS;
    if (!reduced) hitstop.hit(stopMs);
    shake.add(
      ev.outcome === "perfect"
        ? T.TRAUMA_PERFECT
        : ev.outcome === "wrong"
          ? T.TRAUMA_WRONG
          : ev.outcome === "miss"
            ? T.TRAUMA_MISS
            : T.TRAUMA_PLACE,
    );
    if (!reduced) camY.kick(-(ev.outcome === "wrong" || ev.outcome === "miss" ? T.CAM_KICK_WRONG : T.CAM_KICK_PLACE) * 26);
    squash.punch(ev.outcome === "perfect" ? T.SQUASH_PERFECT : T.SQUASH_PLACE);

    flare.position.set(bx, y + T.SLAB_H * 1.6, bz);
    // A mistake does not get the celebratory accent; it gets a hard white
    // magnesium flash, which reads as damage rather than as a reward.
    if (ev.outcome === "wrong" || ev.outcome === "miss") flare.color.setRGB(1, 0.86, 0.74);
    else flare.color.copy(cAccent);
    flareI =
      ev.outcome === "perfect" ? 4.2 + Math.min(6, ev.combo * 0.8)
      : ev.outcome === "wrong" ? 3.6
      : ev.outcome === "miss" ? 5.2
      : 1.7;

    const p = reduced ? 0.4 : 1;
    // Contact dust — always, so every placement has weight.
    sparks.emit(bx, y - T.SLAB_H * 0.5, bz, {
      count: Math.round((ev.outcome === "perfect" ? 26 : 18) * p),
      color: s.slab,
      color2: s.accent,
      speed: 2.5,
      dome: 0.18,
      size: 0.055,
      life: 0.5,
      gravity: 5.5,
      drag: 2.4,
      radius: Math.max(sim.wx, sim.wz) * 0.5,
    });

    if (ev.shear) {
      // The overhang leaves as one slab, the way it does in every stacker worth
      // copying — then throws chips.
      const sgn = ev.shear.sign;
      fallers.launch(
        ev.shear.cx,
        y,
        ev.shear.cz,
        Math.max(0.02, ev.shear.wx),
        T.SLAB_H,
        Math.max(0.02, ev.shear.wz),
        ev.shear.axis === 0 ? sgn * 1.5 : 0,
        1.1,
        ev.shear.axis === 1 ? sgn * 1.5 : 0,
        6.5,
        2.6,
      );
      sparks.emit(ev.shear.cx, y, ev.shear.cz, {
        count: Math.round(10 * p),
        color: s.slab,
        speed: 1.9,
        dome: 0.5,
        size: 0.04,
        life: 0.45,
        gravity: 9,
        drag: 1.5,
      });
    }

    switch (ev.outcome) {
      case "perfect": {
        audio.perfect(ev.combo);
        audio.grow();
        flash.fire(clock * 1000, 0.55 + Math.min(0.45, ev.combo * 0.06));
        // A ring of accent sparks, escalating hard with the combo.
        sparks.emit(bx, y, bz, {
          count: Math.round(Math.min(90, 26 + ev.combo * 9) * p),
          color: s.accent,
          color2: 0xffffff,
          speed: 3.4 + ev.combo * 0.32,
          dome: 0.34,
          size: 0.075,
          life: 0.75,
          gravity: 3.2,
          drag: 1.5,
          radius: Math.max(sim.wx, sim.wz) * 0.5,
        });
        if (ev.combo >= 3) {
          sparks.emit(bx, y, bz, {
            count: Math.round(Math.min(50, ev.combo * 6) * p),
            color: 0xffffff,
            speed: 1.1,
            dome: 1,
            size: 0.13,
            life: 1.5,
            gravity: -0.9,
            drag: 0.7,
          });
        }
        rings.fire(bx, y + T.SLAB_H * 0.52, bz, s.accent, 0.35, 1.7 + Math.min(1.9, ev.combo * 0.22), 0.5, 0.85);
        if (ev.combo >= 4) {
          rings.fire(bx, y + T.SLAB_H * 0.52, bz, 0xffffff, 0.3, 2.6 + Math.min(2.4, ev.combo * 0.3), 0.66, 0.5);
        }
        if (ev.combo >= 8) {
          // A second, vertical ring at very high combos: the monument rings
          // like a struck bell and the whole screen knows about it.
          rings.fire(bx, y + T.SLAB_H * 0.52, bz, s.accent, 0.3, 3.4 + Math.min(2.6, ev.combo * 0.25), 0.85, 0.42, Math.PI / 2);
        }
        hud.callTrue(ev.combo);
        hud.setCombo(ev.combo);
        break;
      }
      case "good":
        audio.thunk(sim.peril, sim.floor);
        rings.fire(bx, y + T.SLAB_H * 0.52, bz, s.slab, 0.4, 1.35, 0.3, 0.3);
        hud.setCombo(0);
        break;
      case "wrong": {
        audio.crack();
        audio.thunk(sim.peril, sim.floor);
        rings.fire(bx, y + T.SLAB_H * 0.52, bz, 0xffffff, 0.3, 2.1, 0.36, 0.6);
        hud.setCombo(0);
        for (let i = 0; i < tier.debris; i++) {
          fallers.launch(
            bx + (Math.random() - 0.5) * sim.wx,
            y + (Math.random() - 0.4) * T.SLAB_H,
            bz + (Math.random() - 0.5) * sim.wz,
            0.06 + Math.random() * 0.11,
            0.05 + Math.random() * 0.1,
            0.06 + Math.random() * 0.11,
            (Math.random() - 0.5) * 5,
            1.4 + Math.random() * 2.6,
            (Math.random() - 0.5) * 5,
            13,
            1.5 + Math.random(),
          );
        }
        sparks.emit(bx, y, bz, {
          count: Math.round(44 * p),
          color: s.slab,
          color2: s.accent,
          speed: 4.4,
          dome: 0.6,
          size: 0.07,
          life: 0.66,
          gravity: 11,
          drag: 1.1,
          radius: sim.wx * 0.4,
        });
        break;
      }
      case "miss": {
        audio.shatter();
        rings.fire(bx, y, bz, 0xffffff, 0.25, 3.0, 0.5, 0.7);
        hud.setCombo(0);
        for (let i = 0; i < tier.debris * 2; i++) {
          fallers.launch(
            bx + (Math.random() - 0.5) * 0.7,
            y + (Math.random() - 0.5) * 0.3,
            bz + (Math.random() - 0.5) * 0.7,
            0.07 + Math.random() * 0.16,
            0.06 + Math.random() * 0.12,
            0.07 + Math.random() * 0.16,
            (Math.random() - 0.5) * 4.5,
            0.6 + Math.random() * 2.2,
            (Math.random() - 0.5) * 4.5,
            15,
            2.2 + Math.random(),
          );
        }
        sparks.emit(bx, y, bz, {
          count: Math.round(70 * p),
          color: s.slab,
          color2: 0xffffff,
          speed: 5.6,
          dome: 0.7,
          size: 0.08,
          life: 0.85,
          gravity: 12,
          drag: 0.9,
          radius: 0.4,
        });
        break;
      }
    }

    hud.setFloor(sim.floor, sim.best);
  }

  function collapse(): void {
    collapseAt = clock;
    collapsed = true;
    audio.collapse();
    shake.add(T.TRAUMA_COLLAPSE);
    if (!reduced) slowmo = 1.1;
    // Throw the visible monument outward. PERMANENCE, at scale.
    const n = Math.min(sim.slabs.length, tier.slabPool);
    for (let k = 0; k < n; k++) {
      const sl = sim.slabs[sim.slabs.length - 1 - k]!;
      const y = sl.i * T.SLAB_H;
      const a = Math.random() * Math.PI * 2;
      const sp = 1.4 + Math.random() * 2.6 + k * 0.06;
      fallers.launch(
        sl.cx,
        y,
        sl.cz,
        sl.wx,
        T.SLAB_H,
        sl.wz,
        Math.cos(a) * sp,
        1.2 + Math.random() * 2.4,
        Math.sin(a) * sp,
        7,
        3.4 + Math.random() * 1.6,
      );
    }
    sparks.emit(0, sim.topY, 0, {
      count: Math.round(tier.particles * 0.28),
      color: cur.slab,
      color2: cur.accent,
      speed: 6,
      dome: 0.55,
      size: 0.1,
      life: 1.5,
      gravity: 9,
      drag: 0.8,
      radius: 0.7,
    });
    rings.fire(0, sim.topY, 0, cur.accent, 0.3, 8, 1.4, 0.75);
    rings.fire(0, sim.topY, 0, 0xffffff, 0.3, 5.5, 1.05, 0.55);
    pool.hideFrom(0);
    block.visible = false;
    plaqueBlock.hide();
    for (const p of plaqueTower) p.hide();
  }

  function rebuildFromSim(): void {
    collapsed = false;
    // After a revive the tower stands again; nothing to rebuild but the view
    // state, since the sim kept every course.
    drop.active = false;
    collapseAt = -1;
  }

  function handle(e: SimEvent): void {
    switch (e.type) {
      case "tick":
        audio.tick(e.slot);
        break;
      case "stratum": {
        const s = stratumAt(e.index);
        applyStratum(s, 1);
        audio.stratum(e.index);
        flash.fire(clock * 1000, 1);
        if (!reduced) {
          slowmo = 0.42;
          hitstop.hit(T.HITSTOP_STRATUM_MS);
        }
        hud.announceBand(s.name);
        rings.fire(0, sim.topY, 0, s.accent, 0.3, 5.5, 1.1, 0.6);
        rings.fire(0, sim.topY, 0, 0xffffff, 0.3, 3.6, 0.85, 0.45);
        sparks.emit(0, sim.topY, 0, {
          count: Math.round(tier.particles * 0.16 * (reduced ? 0.4 : 1)),
          color: s.accent,
          color2: 0xffffff,
          speed: 5.2,
          dome: 0.9,
          size: 0.11,
          life: 1.8,
          gravity: -0.4,
          drag: 0.9,
          radius: 1.1,
        });
        break;
      }
      case "collapse":
        collapse();
        break;
      case "restart":
        hud.setFloor(0, sim.best);
        hud.setCombo(0);
        break;
      default:
        break;
    }
  }

  /* ── input ──────────────────────────────────────────────────────────── */

  let lastTapAt = 0;
  let lastLatency = 0;

  function tap(evTs?: number): void {
    // A host sheet is not the manual: the shared module's pointer swallow only
    // covers its own scrim, so the game has to refuse the tap itself. A touch
    // landing behind a paywall must not set a stone the child never aimed.
    if (paused) return;
    audio.resume();
    if (sim.phase !== "sweep") return;
    if (drop.active) return;
    const t0 = performance.now();
    const ev = sim.place(clock);
    if (!ev) return;
    audio.release();
    // The run is broken the instant the stone is committed, not 88ms later
    // when it lands — otherwise the prompt reveals the truth while the combo
    // chip is still boasting about a streak that no longer exists.
    if (ev.outcome !== "perfect") hud.setCombo(0);
    if (firstPlacement) {
      firstPlacement = false;
      hud.hideHint();
    }
    drop.active = true;
    drop.t = 0;
    drop.ev = ev;
    // The axis has already flipped inside place(); recover the placement axis.
    // A miss places nothing, so the stone falls where the sweep actually was.
    const placedAxis = ev.outcome === "miss" ? sim.axis : sim.axis === 0 ? 1 : 0;
    if (placedAxis === 0) {
      drop.x = ev.outcome === "miss" ? simSweepAtPlacement : ev.slab.cx;
      drop.z = ev.slab.cz;
    } else {
      drop.z = ev.outcome === "miss" ? simSweepAtPlacement : ev.slab.cz;
      drop.x = ev.slab.cx;
    }
    lastLatency = performance.now() - (evTs ?? t0);
    lastTapAt = t0;
    void lastTapAt;
  }

  // `place()` consumes the sweep, so remember where the stone actually was.
  let simSweepAtPlacement = 0;
  const origPlace = sim.place.bind(sim);
  sim.place = (t: number) => {
    simSweepAtPlacement = sim.sweep;
    return origPlace(t);
  };

  const onPointerDown = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    tap(e.timeStamp);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (paused) return;
    if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowDown" || e.code === "KeyR") {
      e.preventDefault();
      if (sim.phase !== "sweep" && collapseAt < 0) restart();
      else if (e.code !== "KeyR") tap();
    } else if (e.code === "KeyP") {
      showPerf = !showPerf;
    } else if (e.code === "KeyM") {
      audio.enabled = !audio.enabled;
    }
  };
  holder.addEventListener("pointerdown", onPointerDown, { passive: false });
  window.addEventListener("keydown", onKey);

  let showPerf =
    typeof location !== "undefined" && /(^|[?&])perf=1/.test(location.search);

  /* ── resize ─────────────────────────────────────────────────────────── */

  function resize(): void {
    const w = holder.clientWidth || 320;
    const h = holder.clientHeight || 480;
    aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tier.dprCap));
    renderer.setSize(w, h, false);
    const px = renderer.getPixelRatio();
    post.resize(w * px, h * px);
    sparks.setScale(h * px * 0.42);
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(holder);
  resize();
  applyStratum(stratumAt(0), 1);
  camY.set(camTargetY());

  function retier(next: Tier): void {
    tier = next;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, tier.dprCap));
    renderer.shadowMap.enabled = true;
    key.shadow.mapSize.set(tier.shadowSize || 256, tier.shadowSize || 256);
    key.shadow.map?.dispose();
    key.shadow.map = null;
    pool.resize(tier.slabPool, true);
    post.setTier(tier.bloom, tier.bloomDiv);
    resize();
  }
  const watch = new TierWatch(retier);

  /* ── the loop ───────────────────────────────────────────────────────── */

  let last = performance.now();
  const camPos = new Vector3();
  const lookAt = new Vector3();

  function frame(now: number): void {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (paused) {
      // Nothing steps, nothing renders: the WebGL front buffer holds its last
      // frame, which is exactly what belongs under the scrim. `last` still
      // tracks the real clock so the resume cannot arrive as one enormous
      // frame — and `clock` does not advance at all, which is what keeps
      // `questionAt`, `collapseAt` and the reported latency honest without any
      // rebasing: they are all measured in this clock, and this clock did not
      // pass.
      last = now;
      return;
    }
    let real = (now - last) / 1000;
    last = now;
    if (real > 0.05) real = 0.05; // a tab restore must not teleport the sim
    fps.push(real);
    watch.sample(real, tier);

    // SLOW MOTION on the biggest moments, then SLEEP inside it.
    let scale = 1;
    if (slowmo > 0) {
      slowmo = Math.max(0, slowmo - real * 1.7);
      scale = 0.28 + 0.72 * (1 - clamp01(slowmo / 0.42));
    }
    const dt = hitstop.consume(real) * scale;
    clock += real;

    /* sim */
    sim.update(dt, clock);
    sim.drain(evBuf);
    for (let i = 0; i < evBuf.length; i++) handle(evBuf[i]!);
    evBuf.length = 0;

    /* drop animation → impact */
    if (drop.active) {
      drop.t += real * 1000;
      if (drop.t >= DROP_MS) {
        drop.active = false;
        const ev = drop.ev!;
        drop.ev = null;
        onPlaceImpact(ev);
      }
    }

    /* feel */
    flareI = Math.max(0, flareI - flareI * 7.5 * real);
    flare.intensity = flareI;
    shake.update(real, T.TRAUMA_DECAY);
    flash.update(real);
    squash.target = 1;
    squash.update(real);
    camY.target = camTargetY();
    camY.update(real);
    blendPalette(real);

    /* framing */
    dist = damp(dist, solveDistance(), 3.2, real);
    plaqueK = Math.max(0.55, Math.min(2.1, dist / PLAQUE_REF));
    const tanY = Math.tan(FOV * 0.5 * DEG);
    const halfV = dist * tanY;
    const actionTop = camY.value + HOVER + T.SLAB_H * 0.6;
    const delta = (1 - 2 * ACTION_SCREEN_Y) * halfV / Math.cos(ELEV);
    const lookY = actionTop - delta;

    const breathe = reduced ? 0 : Math.sin(clock * 0.44) * 0.021;
    const az = AZ + breathe;
    lookAt.set(sim.bendX(1) * 0.3, lookY, sim.bendZ(1) * 0.3);
    camPos.set(
      lookAt.x + dist * Math.cos(ELEV) * Math.cos(az),
      lookAt.y + dist * Math.sin(ELEV),
      lookAt.z + dist * Math.cos(ELEV) * Math.sin(az),
    );
    camera.position.copy(camPos);
    camera.up.set(0, 1, 0);
    camera.lookAt(lookAt);
    if (shake.trauma > 0.0005) {
      camera.position.x += shake.x * 0.42;
      camera.position.y += shake.y * 0.42;
      camera.rotateZ(shake.rot * 0.035);
    }

    (scene.fog as Fog).near = dist * 0.8;
    (scene.fog as Fog).far = dist * 2.9;

    /* light rig follows the action so the shadow map stays tight */
    key.position.set(lookAt.x - 4.2, camY.value + 6.4, lookAt.z + 3.1);
    key.target.position.set(lookAt.x, camY.value, lookAt.z);
    key.target.updateMatrixWorld();
    rim.position.set(lookAt.x + 5.5, camY.value + 1.4, lookAt.z - 5.2);
    rim.target.position.set(lookAt.x, camY.value, lookAt.z);
    rim.target.updateMatrixWorld();

    /* tower */
    drawTower();
    drawBlock();

    /* particles */
    sparks.update(dt || real * 0.001, camY.value);
    fallers.update(dt || real * 0.001, 15);
    rings.update(real);

    /* sky + present */
    sky.update(camY.value, clock, aspect, tier.grain ? 0.0045 : 0, sim.peril);
    post.setTrauma(reduced ? 0 : shake.trauma);
    post.setFlash(1, 1, 1, flash.alpha);
    post.setBloom(tier.bloom ? 0.82 + sim.peril * 0.25 : 0);
    post.setExposure(1.16 - sim.peril * 0.06);

    renderer.setRenderTarget(post.scene);
    renderer.autoClear = true;
    renderer.clear();
    renderer.render(sky.scene, sky.camera);
    renderer.autoClear = false;
    renderer.render(scene, camera);
    renderer.autoClear = true;
    post.present(renderer);

    /* over panel, once the dust has had time to fall */
    if (collapseAt >= 0 && clock - collapseAt > 1.35) {
      collapseAt = -1;
      hud.showOver(sim.floor, true);
    }

    /* prompt */
    if (sim.phase === "sweep" && !collapsed) {
      hud.showPrompt(true);
      if (sim.revealLeft > 0 && sim.revealPrompt) hud.setPrompt(sim.revealPrompt, sim.revealAnswer);
      else hud.setPrompt(sim.question.prompt, null);
    } else {
      hud.showPrompt(false);
    }

    if (showPerf) {
      hud.setPerf(
        `${fps.fps.toFixed(0)} fps  p95 ${fps.p95.toFixed(1)}ms\n` +
          `tier ${tier.name}  dpr ${renderer.getPixelRatio().toFixed(2)}\n` +
          `sparks ${sparks.live}  input ${lastLatency.toFixed(3)}ms\n` +
          `floor ${sim.floor}  w ${sim.width.toFixed(3)}  sway ${sim.amplitude.toFixed(3)}`,
        true,
      );
    } else if (hud) {
      hud.setPerf("", false);
    }
  }

  /* ── drawing ────────────────────────────────────────────────────────── */

  function drawTower(): void {
    if (collapsed) {
      pool.hideFrom(0);
      for (const p of plaqueTower) p.hide();
      const b0 = sim.slabs[0]!;
      plinth.scale.set(b0.wx * 0.86, 90, b0.wz * 0.86);
      plinth.position.set(b0.cx, -45 - T.SLAB_H * 0.5, b0.cz);
      plinthMat.color.copy(cFog).lerp(cSlab, 0.42);
      return;
    }
    const base = sim.slabs[0]!;
    plinth.scale.set(base.wx * 0.86, 90, base.wz * 0.86);
    plinth.position.set(base.cx, -45 - T.SLAB_H * 0.5, base.cz);
    plinthMat.color.copy(cFog).lerp(cSlab, 0.42);

    const n = sim.slabs.length;
    const shown = Math.min(n, pool.meshes.length);
    const top = sim.floor;
    const span = Math.max(1, top);
    let m = 0;
    for (let k = 0; k < shown; k++) {
      const sl = sim.slabs[n - 1 - k]!;
      const mesh = pool.meshes[m++]!;
      const u = sl.i / span;
      const y = sl.i * T.SLAB_H;
      mesh.visible = true;
      mesh.position.set(sl.cx + sim.bendX(u), y, sl.cz + sim.bendZ(u));

      // Squash only the freshly-set course; SCALE PUNCH.
      const sq = k === 0 && !drop.active ? squash.value : 1;
      mesh.scale.set(sl.wx, T.SLAB_H * sq, sl.wz);
      mesh.position.y = y - (T.SLAB_H * (1 - sq)) * 0.5;

      // Colour is the stratum the course was BUILT in, so the tower records
      // the climb; then faded toward the sky as it recedes below the camera.
      const bandS = stratumAt(Math.floor(sl.i / T.STRATUM_FLOORS));
      scratch2.setHex(bandS.slab);
      const jitter = 0.94 + ((Math.imul(sl.i + 1, 2654435761) >>> 24) / 255) * 0.12;
      scratch2.multiplyScalar(sl.cracked ? jitter * 0.62 : jitter);
      const fade = clamp01((k - 4) / Math.max(2, pool.meshes.length - 6));
      scratch2.lerp(cFog, fade * fade);
      mesh.material.color.copy(scratch2);

      // A course set dead true stays visibly brighter for the rest of the run:
      // the tower becomes a record of every perfect. Self-coloured, so it never
      // shifts the palette.
      if (sl.perfect) mesh.material.emissive.copy(scratch2).multiplyScalar(0.16 * (1 - fade));
      else mesh.material.emissive.setRGB(0, 0, 0);
      mesh.material.opacity = 1;
    }
    pool.hideFrom(m);

    // Plaques: the top three courses only. Anything deeper is noise.
    for (let k = 0; k < plaqueTower.length; k++) {
      const p = plaqueTower[k]!;
      const sl = sim.slabs[n - 1 - k];
      if (!sl || sl.label === "" || collapseAt >= 0) {
        p.hide();
        continue;
      }
      const u = sl.i / span;
      const y = sl.i * T.SLAB_H;
      const off = 0.16;
      p.group.position.set(
        sl.cx + sim.bendX(u) - sl.wx * 0.5 - off,
        y + T.SLAB_H * 0.1,
        sl.cz + sim.bendZ(u) + sl.wz * 0.5 + off,
      );
      p.face(camera);
      const bright = isBright(want);
      p.set(
        sl.label,
        (k === 0 ? 0.26 : 0.2) * plaqueK,
        bright ? 0xf4f6fb : 0x05060c,
        sl.cracked ? cAccent.getHex() : bright ? 0x0d0b07 : 0xffffff,
        k === 0 ? 0.95 : 0.4,
        0.95,
      );
    }
  }

  function drawBlock(): void {
    if (sim.phase !== "sweep" && !drop.active) {
      block.visible = false;
      plaqueBlock.hide();
      return;
    }

    if (drop.active) {
      // The stone slams home over 88ms with an accelerating ease — the second
      // beat of the punch. The first was the release click on the tap itself.
      const ev = drop.ev!;
      const t = clamp01(drop.t / DROP_MS);
      const e = t * t;
      const y0 = (visualFloor + 1) * T.SLAB_H + HOVER;
      const y1 = (visualFloor + 1) * T.SLAB_H;
      block.visible = true;
      block.position.set(drop.x, y0 + (y1 - y0) * e, drop.z);
      const w = ev.outcome === "miss" ? sim.wx / T.MISS_KEEP : ev.slab.wx;
      const d = ev.outcome === "miss" ? sim.wz / T.MISS_KEEP : ev.slab.wz;
      // Before the shear lands, the stone is still full width.
      const pa = sim.axis === 0 ? 1 : 0;
      const fullW = pa === 0 ? (ev.shear ? w + ev.shear.wx : w) : w;
      const fullD = pa === 1 ? (ev.shear ? d + ev.shear.wz : d) : d;
      block.scale.set(fullW, T.SLAB_H, fullD);
      blockMat.color.copy(cSlab);
      blockMat.emissive.copy(cAccent).multiplyScalar(0.13);
      plaqueBlock.group.position.set(block.position.x, block.position.y, block.position.z);
      plaqueBlock.face(camera);
      const bb = isBright(want);
      plaqueBlock.set(ev.answered, 0.3 * plaqueK, bb ? 0xf4f6fb : 0x05060c, bb ? 0x0d0b07 : 0xffffff, 1 - e * 0.6, 0.95);
      return;
    }

    const y = (sim.floor + 1) * T.SLAB_H + HOVER;
    const x = sim.axis === 0 ? sim.sweep : sim.cx + sim.bendX(1);
    const z = sim.axis === 1 ? sim.sweep : sim.cz + sim.bendZ(1);
    block.visible = true;
    block.position.set(x, y, z);
    block.scale.set(sim.wx, T.SLAB_H, sim.wz);
    blockMat.color.copy(cSlab).multiplyScalar(1.1);

    // A hot pulse that quickens as the sweep is pushed by dithering, so the
    // impatience penalty is visible before it is felt.
    const urgency = (sim.dither - 1) / (T.DITHER_MAX - 1);
    const pulse = 0.08 + 0.05 * Math.sin(clock * (7 + urgency * 22));
    // Self-lit stone at rest; it only goes ACCENT-hot when dithering has begun,
    // which is exactly when the player needs to be told to commit.
    blockMat.emissive.copy(cSlab).lerp(cAccent, urgency * 0.85).multiplyScalar(pulse + urgency * 0.55);

    plaqueBlock.group.position.set(x, y, z);
    plaqueBlock.face(camera);
    // Fade in over the hold so the swap of value reads as a new stone arriving.
    const holdT = clamp01(1 - sim.holdLeft / 0.22);
    const brightNow = isBright(want);
    plaqueBlock.set(
      sim.value,
      (0.3 + (1 - easeOutCubic(holdT)) * 0.055) * plaqueK,
      brightNow ? 0xf4f6fb : 0x05060c,
      brightNow ? 0x0d0b07 : 0xffffff,
      0.35 + 0.65 * holdT,
      0.95,
    );
  }

  raf = requestAnimationFrame(frame);

  // Dev handle, off unless explicitly asked for. Lets a harness (or the founder
  // with a console open) drive the tower and read the numbers that matter.
  if (typeof location !== "undefined" && /(^|[?&])dev=1/.test(location.search)) {
    (window as unknown as Record<string, unknown>).__monument = {
      sim,
      tap,
      fps,
      get tier() {
        return tier.name;
      },
      setTier: (n: "low" | "mid" | "ultra") => retier(TIERS[n]),
      latency: () => lastLatency,
      /**
       * True cost of one frame, in ms, with the GPU pipeline drained.
       *
       * `fps` on a 120Hz panel only ever says "120" and proves nothing about
       * headroom, so this renders the real scene `n` times back to back and
       * calls finish(), which is the only number worth quoting about whether
       * this holds sixty on a slower machine.
       */
      bench: (n = 240, stress = false) => {
        const gl = renderer.getContext();
        const px = new Uint8Array(4);
        // readPixels is a hard sync: finish() alone under ANGLE/Metal can
        // return before the queue has actually drained, which would make this
        // number a flattering lie.
        const drain = (): void => {
          renderer.setRenderTarget(null);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        };
        if (stress) {
          // Worst case the game can produce: a collapse, mid-air.
          for (let i = 0; i < tier.debris * 4; i++) {
            fallers.launch(
              (Math.random() - 0.5) * 2, camY.value + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2,
              0.4, T.SLAB_H, 0.4, 0, 0, 0, 4, 9,
            );
          }
          sparks.emit(0, camY.value, 0, {
            count: Math.round(tier.particles * 0.8), color: 0xffffff, color2: 0xff6a1f,
            speed: 3, dome: 1, size: 0.12, life: 9, gravity: 0, drag: 0, radius: 1.2,
          });
        }
        for (let i = 0; i < 20; i++) {
          renderer.setRenderTarget(post.scene);
          renderer.clear();
          renderer.render(sky.scene, sky.camera);
          renderer.autoClear = false;
          renderer.render(scene, camera);
          renderer.autoClear = true;
          post.present(renderer);
        }
        drain();
        const t0 = performance.now();
        for (let i = 0; i < n; i++) {
          drawTower();
          drawBlock();
          sparks.update(1 / 60, camY.value);
          fallers.update(1 / 60, 15);
          renderer.setRenderTarget(post.scene);
          renderer.clear();
          renderer.render(sky.scene, sky.camera);
          renderer.autoClear = false;
          renderer.render(scene, camera);
          renderer.autoClear = true;
          post.present(renderer);
        }
        drain();
        return (performance.now() - t0) / n;
      },
    };
  }

  /* ── the pause ──────────────────────────────────────────────────────── */

  /**
   * Stop the monument's clock, or start it again.
   *
   * Idempotent in both directions: two pauses are one pause, and resuming a
   * running game is nothing. The host calls this around its own sheets, and the
   * manual calls it around itself.
   *
   * There is nothing to rebase on the way back. Everything MONUMENT measures —
   * `questionAt`, `collapseAt`, the `ms` on every report — is measured against
   * `clock`, which is an accumulator this loop advances and therefore did not
   * advance while stopped. The single wall-clock value in the loop is `last`,
   * and its whole job is to be reset here so the first frame back is one frame
   * and not the length of the read.
   */
  function setPaused(on: boolean): void {
    if (on === paused) return;
    paused = on;
    if (on) {
      audio.suspend();
      return;
    }
    last = performance.now();
    audio.resume();
  }

  /* ── teardown ───────────────────────────────────────────────────────── */

  return {
    setPaused,

    unmount(): void {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      holder.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      guide.destroy();
      hud.dispose();
      audio.dispose();
      sparks.dispose();
      fallers.dispose();
      rings.dispose();
      disposeRingGeometry();
      sky.dispose();
      post.dispose();
      pool.dispose();
      plaqueBlock.dispose();
      for (const p of plaqueTower) p.dispose();
      block.geometry.dispose();
      blockMat.dispose();
      plinth.geometry.dispose();
      plinthMat.dispose();
      disposeTextures();
      disposeSharedGeometry();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      // dispose() frees three's own objects but leaves the drawing context
      // alive; without forceContextLoss(), twenty-four mount/unmount cycles
      // exhaust the browser's context pool and start killing live games.
      renderer.forceContextLoss();
      renderer.dispose();
      holder.remove();
    },
  };
}

export { TIERS };
