import * as THREE from "three";
import type { Host, Question } from "../contract.ts";
import { makeSharedUniforms } from "./shaders.ts";
import { SolidField, GlowField } from "./fields.ts";
import { DigitField } from "./digits.ts";
import { Particles } from "./particles.ts";
import { Scenery, colorOf } from "./scenery.ts";
import { Entities, laneX, GATE_PLANE } from "./entities.ts";
import type { Gate, HazardKind } from "./entities.ts";
import { laneOptions } from "./options.ts";
import { Player, skiffGeometry } from "./player.ts";
import { makeSky, makeOcean, makeDeck, LANE_W } from "./world.ts";
import { Post } from "./post.ts";
import { Projector } from "./project.ts";
import { Audio } from "./audio.ts";
import { InputController } from "./input.ts";
import { Rng } from "./rng.ts";
import { biomeAt, biomeLength } from "./biomes.ts";
import { detectTier, TierController, type TierName } from "./tiers.ts";
import { buildHud, groupDigits, ringCircumference } from "./hud.ts";
import { ndcFrame } from "./chrome.ts";
import type { Frame } from "./readband.ts";
import {
  createInstructions,
  onInsetsChange,
  safeInsets,
} from "../../../../packs/shared/game-chrome/index.ts";
import { Shake, HitStop, FlashBus, Springy, clamp, clamp01, lerp, approach, easeOutCubic } from "./juice.ts";

import {
  V_START, V_TERMINAL, V_REDUCED_CAP, VOLT_MAX, COST_WRONG_GATE, COST_HAZARD,
  GAIN_GATE, GAIN_SPARK, GAIN_GRAZE, VOLT_BLEED, CHAIN_PER_SURGE, SURGE_MAX,
  STUMBLE_TIME, CLEAN_READ_SHARE, REVIVE_GRACE, speedAt, readWindow, breather, beatTime, difficultyFor,
} from "./pacing.ts";

type Phase = "idle" | "running" | "dying" | "revive" | "over";

type RunStats = {
  distance: number;
  score: number;
  gates: number;
  gatesRight: number;
  bestChain: number;
  cleanReads: number;
  sparks: number;
  grazes: number;
  revives: number;
};

// gitleaks:allow — a localStorage slot name for the furthest distance run, not
// a credential. The dotted-and-versioned shape is what trips `generic-api-key`.
const BEST_SLOT = "dynawalla.runner.best.v1";

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_SLOT) ?? 0) || 0;
  } catch {
    return 0;
  }
}
function writeBest(v: number): void {
  try {
    localStorage.setItem(BEST_SLOT, String(Math.round(v)));
  } catch {
    /* private mode; a best score is not worth an exception */
  }
}

export function mountRunner(el: HTMLElement, host: Host): { unmount(): void } {
  /* ------------------------------ chrome -------------------------------- */

  const params = new URLSearchParams(location.search);
  el.style.position = el.style.position || "relative";
  el.style.overflow = "hidden";
  el.style.touchAction = "none";
  el.style.background = "#04060f";

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;";
  el.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
    depth: true,
  });
  renderer.autoClear = true;
  renderer.setClearColor(0x04060f, 1);

  const hud = buildHud(el);

  /* ------------------------------- tiers -------------------------------- */

  const forced = params.get("tier") as TierName | null;
  const detected = forced ?? detectTier(renderer.getContext());
  const tiers = new TierController(detected, () => applyTier());

  /* ------------------------------- scene -------------------------------- */

  const shared = makeSharedUniforms();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(74, 1, 0.35, tiers.settings.far);

  const sky = makeSky(shared);
  scene.add(sky.mesh);
  let ocean = makeOcean(shared, tiers.settings.far);
  scene.add(ocean);
  const deck = makeDeck(shared, tiers.settings.deckSegments, tiers.settings.far);
  scene.add(deck.mesh);

  const shardField = new SolidField(new THREE.CylinderGeometry(0.42, 0.58, 1, 6, 1), tiers.settings.monoliths, shared, 2.4);
  const boxField = new SolidField(new THREE.BoxGeometry(1, 1, 1), 300, shared, 1.9);
  const skiffField = new SolidField(skiffGeometry(), 12, shared, 1.7);
  const glow = new GlowField(Math.max(900, tiers.settings.particles + 700), shared, 12);
  const digits = new DigitField(300, shared);
  scene.add(shardField.mesh, boxField.mesh, skiffField.mesh, glow.mesh, digits.mesh);

  const post = new Post(renderer);
  post.passes = tiers.settings.bloomPasses;
  post.hdr = tiers.settings.bloomPasses > 0;
  const proj = new Projector();

  /* ------------------------------- systems ------------------------------ */

  const seed = Number(params.get("seed") ?? 0) || ((Math.random() * 0xffffffff) >>> 0);
  const rng = new Rng(seed);
  const parts = new Particles(tiers.settings.particles);
  const scenery = new Scenery(tiers.settings.monoliths, tiers.settings.far, rng);
  const ents = new Entities();
  const player = new Player();
  const audio = new Audio();
  const shake = new Shake();
  const hitstop = new HitStop();
  const flash = new FlashBus();
  const fovSpring = new Springy(74, 130, 15);
  const pullSpring = new Springy(0, 90, 12);
  const chromaSpring = new Springy(0, 70, 11);
  const input = new InputController(canvas, () => audio.start());

  /* -------------------------------- state ------------------------------- */

  let phase: Phase = "idle";
  let travel = 0;
  let elapsed = 0;
  let speed = V_START;
  let score = 0;
  let displayScore = 0;
  let surge = 1;
  let chain = 0;
  let voltage = VOLT_MAX;
  let stumble = 0;
  let biomeIndex = 0;
  let biome = biomeAt(0);
  let prevBiome = biome;
  let biomeMix = 1;
  let nextBiomeAt = biomeLength(0);
  let gateCooldown = 0.6;
  let nextBeatAt = 60;
  let activeGate: Gate | null = null;
  let pendingQuestion: Question | null = null;
  let reviveQ: Question | null = null;
  let reviveTimer = 0;
  let reviveLimit = 7;
  let dyingT = 0;
  let sfxOn = true;
  let motionOverride = false;
  let best = readBest();
  let lowVoltWarned = false;
  let lowVoltTick = 0;
  /** `elapsed` at the last lane change. Distinguishes a read from a swerve. */
  let laneSettledAt = 0;
  const stats: RunStats = { distance: 0, score: 0, gates: 0, gatesRight: 0, bestChain: 0, cleanReads: 0, sparks: 0, grazes: 0, revives: 0 };

  // Perf instrumentation, surfaced with ?stats=1.
  let fpsAcc = 0, fpsFrames = 0, fps = 0, worstFrame = 0;
  let latencySum = 0, latencyN = 0, latencyWorst = 0;
  let sceneCalls = 0, sceneTris = 0;
  const showPerf = params.get("stats") === "1";
  if (showPerf) hud.perf.classList.add("vt-on");

  const reduced = (): boolean => motionOverride || host.prefersReducedMotion();

  /**
   * Verification probe, published only under `?stats=1`.
   *
   * A runner cannot be checked by reading it — the questions that matter are
   * "does a five-minute run stay at 60fps", "does the reading window still fit
   * a child at 3 km", "does the fifth biome arrive". Those need a machine that
   * can play. This exposes exactly enough read-only state for a harness to
   * steer, and nothing that could change the game's behaviour. Input still goes
   * through real KeyboardEvents, so the harness exercises the same path a
   * player does.
   */
  if (showPerf) {
    (window as unknown as Record<string, unknown>).__volta = {
      state: () => ({
        phase, travel: Math.round(travel), speed: +speed.toFixed(1),
        voltage: +voltage.toFixed(1), surge, chain, score: Math.round(score), fps: +fps.toFixed(1),
        biome: biome.name, tier: tiers.tier, particles: parts.count, worstMs: +(worstFrame * 1000).toFixed(1),
        latency: { avg: latencyN ? +(latencySum / latencyN).toFixed(1) : 0, max: +latencyWorst.toFixed(1), n: latencyN },
        gates: stats.gates, right: stats.gatesRight, clean: stats.cleanReads, grazes: stats.grazes, revives: stats.revives,
        playerX: +player.x.toFixed(2), playerY: +player.y.toFixed(2), lane: player.lane,
        gate: activeGate && activeGate.state === "incoming"
          ? { z: +activeGate.z.toFixed(1), correctLane: activeGate.correctLane, values: activeGate.values.slice(), window: +activeGate.window.toFixed(2) }
          : null,
        hazards: ents.hazards
          .filter((h) => h.active && h.z > -140)
          .map((h) => ({ kind: h.kind, z: +h.z.toFixed(1), x: +ents.hazardX(h).toFixed(2), span: h.span }))
          .sort((a, b) => b.z - a.z),
        reviveLane: phase === "revive" ? reviveAnswerLane : -1,
      }),
    };
  }

  /* ------------------------------- palette ------------------------------ */

  const tmpA = new THREE.Color();
  const tmpB = new THREE.Color();
  const numeralInk: [number, number, number] = [1, 1, 1];
  function applyBiomeUniforms(): void {
    const m = easeOutCubic(biomeMix);
    const mixHex = (a: number, b: number, out: THREE.Color) => {
      tmpA.setHex(a, THREE.SRGBColorSpace);
      tmpB.setHex(b, THREE.SRGBColorSpace);
      out.copy(tmpA).lerp(tmpB, m);
    };
    mixHex(prevBiome.skyTop, biome.skyTop, shared.uSkyTop.value);
    mixHex(prevBiome.skyBot, biome.skyBot, shared.uSkyBot.value);
    mixHex(prevBiome.fog, biome.fog, shared.uFogColor.value);
    mixHex(prevBiome.deck, biome.deck, shared.uDeck.value);
    mixHex(prevBiome.accent, biome.accent, shared.uAccent.value);
    mixHex(prevBiome.accent2, biome.accent2, shared.uAccent2.value);
    shared.uFogDensity.value = lerp(prevBiome.fogDensity, biome.fogDensity, m);
    (sky.material.uniforms.uAurora as { value: number }).value = lerp(prevBiome.auroraStrength, biome.auroraStrength, m);
    (sky.material.uniforms.uStars as { value: number }).value = lerp(prevBiome.starDensity, biome.starDensity, m);
    const vig = post.composite.uniforms.uVignetteColor.value as THREE.Color;
    vig.copy(shared.uFogColor.value).multiplyScalar(biome.inverted ? 1.1 : 0.55);
    hud.root.style.color = biome.inverted ? "#12121a" : "#eaf6ff";
    // The chrome borrows the world's accent, so the recharge gate is lit by the
    // biome you died in rather than being a grey box bolted over the top of it.
    hud.root.style.setProperty("--vt-accent", `#${shared.uAccent.value.getHexString()}`);
    post.composite.uniforms.uExposure.value = biome.inverted ? 0.88 : 1.06;
    // Candidate numerals are hot white ink with a black stroke in the dark
    // worlds, and black ink with a bone stroke in THE BLEACH. Contrast is never
    // left to whichever sky happens to be behind the row.
    const flip = m > 0.5 ? biome.inverted : prevBiome.inverted;
    if (flip) {
      numeralInk[0] = 0.03; numeralInk[1] = 0.03; numeralInk[2] = 0.045;
      digits.setOutline(0.94, 0.92, 0.86);
    } else {
      numeralInk[0] = 1; numeralInk[1] = 1; numeralInk[2] = 1;
      digits.setOutline(0.012, 0.018, 0.045);
    }
  }

  /* -------------------------------- sizing ------------------------------ */

  let vw = 1, vh = 1;
  /**
   * The NDC box the numeral row, the payoff and the score popups live inside.
   *
   * Recomputed on every resize, and on every inset change, because the insets
   * are not a launch-time constant: a rotation swaps the top inset for two side
   * ones, and iPadOS changes them when the pack is resized in Split View. A
   * game that reads them once at mount is correct until the first rotation.
   */
  let frameNdc: Frame = ndcFrame(1, 1, safeInsets());
  function resize(): void {
    const r = el.getBoundingClientRect();
    vw = Math.max(1, Math.round(r.width));
    vh = Math.max(1, Math.round(r.height));
    frameNdc = ndcFrame(vw, vh, safeInsets());
    const dpr = Math.min(window.devicePixelRatio || 1, tiers.settings.dprCap) * tiers.renderScale;
    renderer.setPixelRatio(1);
    const bw = Math.max(2, Math.round(vw * dpr));
    const bh = Math.max(2, Math.round(vh * dpr));
    renderer.setSize(bw, bh, false);
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    post.setSize(bw, bh);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();
  }

  function applyTier(): void {
    const s = tiers.settings;
    camera.far = s.far;
    camera.updateProjectionMatrix();
    deck.rebuild(s.deckSegments, s.far);
    scene.remove(ocean);
    ocean.geometry.dispose();
    (ocean.material as THREE.Material).dispose();
    ocean = makeOcean(shared, s.far);
    ocean.visible = s.ocean;
    scene.add(ocean);
    scenery.resize(s.monoliths, s.far);
    post.passes = s.bloomPasses;
    post.setHdr(s.bloomPasses > 0);
    resize();
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(el);
  resize();
  applyTier();
  applyBiomeUniforms();

  // A rotation does not always change the element's box — a square-ish split
  // view can rotate and keep its size — but it always changes the insets.
  const stopInsets = onInsetsChange(() => resize());

  /* ----------------------------- how to play ---------------------------- */

  // VOLTA's start card says "pick the lane that is right" and lists the swipes,
  // and then it is gone. A child who works out on the fourth gate that the
  // numbers ARE the answers had nowhere to go back to, and no way at all to
  // find out what the voltage bar is or why a wrong lane costs so much. The
  // manual stays reachable during the run, because the moment a child needs the
  // rules is never the title screen.
  const guide = createInstructions(el, {
    title: "VOLTA",
    summary: [
      "You are running down a road with three lanes.",
      "A sum is at the top. Each lane has a number. Move to the lane with the right answer.",
    ],
    sections: [
      {
        heading: "Moving",
        lines: [
          "Swipe left or right to change lane. You can also tap the left or right side of the screen.",
          "Swipe up to jump over a hole.",
          "Swipe down to slide under a bar.",
          "On a keyboard, use the arrow keys.",
        ],
      },
      {
        heading: "Answering",
        lines: [
          "Read the sum at the top of the screen.",
          "Three numbers float above the road. Only one is the answer.",
          "Get into that lane before you reach the gate. The lane you are in is your answer.",
          "You do not press anything. Driving through is answering.",
        ],
      },
      {
        heading: "The blue bar",
        lines: [
          "The bar along the bottom is your power.",
          "A right answer adds power. A wrong answer takes a lot away, and you stumble.",
          "Hitting a wall or a bar also takes power away.",
        ],
      },
      {
        heading: "When the power runs out",
        lines: [
          "The run stops and you get one more sum, with three big buttons.",
          "Get it right and you carry on with full power.",
          "Get it wrong and the run is over. Then you can start again.",
        ],
      },
      {
        heading: "Going faster",
        lines: [
          "Three right answers in a row make your score count for more.",
          "One wrong answer sets that back to normal.",
          "The road never ends. See how far you can get.",
        ],
      },
    ],
    reducedMotion: reduced(),
  });

  /* --------------------------------- HUD -------------------------------- */

  function setPrompt(text: string): void {
    hud.promptText.textContent = text;
    hud.prompt.classList.remove("vt-punch");
    void hud.prompt.offsetWidth;
    hud.prompt.classList.add("vt-punch");
  }

  function refreshHud(): void {
    hud.score.textContent = groupDigits(displayScore);
    hud.dist.textContent = `${groupDigits(travel)} m`;
    hud.surgeN.textContent = String(surge);
    const pips = hud.chain.children;
    for (let i = 0; i < pips.length; i++) {
      (pips[i] as HTMLElement).classList.toggle("on", i < chain);
    }
    const v = clamp01(voltage / VOLT_MAX);
    hud.voltFill.style.transform = `scaleX(${v})`;
    hud.voltFill.style.color = v > 0.55 ? "#5effc9" : v > 0.28 ? "#ffc02a" : "#ff3a5e";
    hud.volt.classList.toggle("vt-crit", v <= 0.28);
  }

  function showVeil(which: "start" | "revive" | "over" | null): void {
    hud.start.classList.toggle("vt-on", which === "start");
    hud.revive.classList.toggle("vt-on", which === "revive");
    hud.over.classList.toggle("vt-on", which === "over");
    hud.root.classList.toggle("vt-veiled", which !== null);
    input.setPaused(which !== null);
  }

  function banner(text: string): void {
    hud.banner.textContent = text;
    hud.banner.classList.remove("vt-show");
    void hud.banner.offsetWidth;
    hud.banner.classList.add("vt-show");
  }

  /* ------------------------------ run control --------------------------- */

  function resetRun(): void {
    travel = 0;
    elapsed = 0;
    speed = V_START;
    score = 0;
    displayScore = 0;
    surge = 1;
    chain = 0;
    voltage = VOLT_MAX;
    stumble = 0;
    biomeIndex = 0;
    biome = prevBiome = biomeAt(0);
    biomeMix = 1;
    nextBiomeAt = biomeLength(0);
    gateCooldown = 0.75;
    nextBeatAt = 70;
    activeGate = null;
    pendingQuestion = null;
    reviveLimit = 7;
    lowVoltWarned = false;
    stats.distance = 0; stats.score = 0; stats.gates = 0; stats.gatesRight = 0;
    stats.bestChain = 0; stats.cleanReads = 0; stats.sparks = 0; stats.grazes = 0; stats.revives = 0;
    ents.reset();
    parts.clear();
    player.reset();
    shake.trauma = 0;
    latencySum = 0; latencyN = 0; latencyWorst = 0;
    shared.uTravel.value = 0;
    applyBiomeUniforms();
    refreshHud();
    setPrompt("—");
    banner(biome.name);
  }

  function startRun(): void {
    audio.start();
    audio.setScale(biome.scale, biome.bpm);
    audio.setMusicLayers(1);
    resetRun();
    phase = "running";
    showVeil(null);
    input.clear();
  }

  function endRun(): void {
    phase = "over";
    audio.setMusicLayers(0);
    audio.runOver();
    host.haptic("failure");
    if (travel > best) {
      best = travel;
      writeBest(best);
    }
    const acc = stats.gates ? Math.round((stats.gatesRight / stats.gates) * 100) : 0;
    hud.overStats.innerHTML = `
      <div class="vt-stat"><b class="vt-num">${groupDigits(travel)}</b><i>Metres</i></div>
      <div class="vt-stat"><b class="vt-num">${groupDigits(score)}</b><i>Score</i></div>
      <div class="vt-stat"><b class="vt-num">${acc}%</b><i>Gates right</i></div>
      <div class="vt-stat"><b class="vt-num">&times;${stats.bestChain}</b><i>Best surge</i></div>
    `;
    showVeil("over");
    hud.againBtn.focus();
  }

  /* --------------------------------- gates ------------------------------ */

  const difficulty = (): number => difficultyFor(travel, surge, stats.gates, stats.gatesRight);

  function requestGate(): void {
    if (activeGate) return;
    const q = pendingQuestion ?? host.next({ difficulty: difficulty() });
    pendingQuestion = null;
    const w = readWindow(travel, reduced());
    const dist = clamp(speed * w, 68, tiers.settings.far * 0.84);
    const g = ents.spawnGate(q, dist, dist / Math.max(1, speed), rng);
    if (!g) {
      pendingQuestion = q;
      return;
    }
    activeGate = g;
    setPrompt(q.prompt);
    audio.uiTick();
  }

  function resolveGate(g: Gate): void {
    const lane = clamp(Math.round(player.x / LANE_W) + 1, 0, 2);
    const correct = lane === g.correctLane;
    // How long the answer has been committed. A child who reads the row and
    // steers once is doing the thing the game is for; one who sweeps the lanes
    // and hopes is not, and the surge meter should be able to tell them apart.
    const held = elapsed - laneSettledAt;
    const cleanRead = correct && held >= g.window * CLEAN_READ_SHARE;
    g.chosenLane = lane;
    g.state = correct ? "passed" : "hit";
    g.burst = 0;
    activeGate = null;
    gateCooldown = breather(travel);
    stats.gates++;

    const q = g.q!;
    const t0 = performance.now();
    host.report({
      questionId: q.id,
      correct,
      ms: Math.round(t0 - g.shownAt),
      answered: g.values[lane].replace(/−/g, "-"),
    });

    const ac = colorOf(biome.accent);
    const gx = laneX(lane);

    if (correct) {
      stats.gatesRight++;
      if (cleanRead) stats.cleanReads++;
      chain += cleanRead ? 2 : 1;
      while (chain >= CHAIN_PER_SURGE && surge < SURGE_MAX) {
        chain -= CHAIN_PER_SURGE;
        surge++;
        audio.surgeUp(surge);
        hud.surge.classList.remove("vt-bump");
        void hud.surge.offsetWidth;
        hud.surge.classList.add("vt-bump");
        flash.fire(0.20, [ac[0], ac[1], ac[2]], reduced());
        shake.add(0.30);
        ents.popup(String(surge), gx, 4.2, 0.5, 1.5, 1, 1, 1, 1.3);
        audio.setMusicLayers(surge >= 4 ? 3 : surge >= 2 ? 2 : 1);
        if (surge === SURGE_MAX) {
          banner("Overdrive");
          flash.fire(0.3, [1, 1, 1], reduced());
          host.haptic("heavy");
        }
      }
      if (surge >= SURGE_MAX) chain = CHAIN_PER_SURGE;
      stats.bestChain = Math.max(stats.bestChain, surge);
      // At full surge every gate pays double. Twenty-seven consecutive correct
      // answers is a real achievement and it should feel like one for as long as
      // it is held, not just for the frame it was earned.
      const gained = 100 * surge * (surge >= SURGE_MAX ? 2 : 1);
      score += gained;
      voltage = Math.min(VOLT_MAX, voltage + GAIN_GATE);
      audio.gateCorrect(surge + chain);
      host.haptic("success");
      shake.add(reduced() ? 0 : 0.16 + surge * 0.012);
      fovSpring.kick(reduced() ? 0 : 46 + (cleanRead ? 22 : 0));
      chromaSpring.kick(reduced() ? 0 : 2.2);
      hitstop.hit(reduced() ? 0.02 : (cleanRead ? 0.06 : 0.045), 0.14);
      flash.fire(0.11, [ac[0], ac[1], ac[2]], reduced());
      ents.popup(`+${gained}`, gx, 3.6, 0.4, 1.05, ac[0], ac[1], ac[2], 1.05);
      if (cleanRead) {
        hud.chain.classList.remove("vt-clean");
        void hud.chain.offsetWidth;
        hud.chain.classList.add("vt-clean");
        audio.uiTick();
      }

      const hot = colorOf(0xffffff);
      const boost = cleanRead ? 1.45 : 1;
      parts.burst(gx, 2.3, 0.2, reduced() ? 10 : Math.round(34 * boost), 16, 0.55, 0.4, hot[0], hot[1], hot[2], 9);
      parts.burst(gx, 2.3, 0.2, reduced() ? 8 : Math.round(26 * boost), 11, 0.8, 0.55, ac[0], ac[1], ac[2], 6);
      parts.ring(gx, 2.4, 0.3, 3, 0.44, hot[0], hot[1], hot[2], 62);
      if (cleanRead) parts.ring(gx, 2.4, 0.3, 1.6, 0.5, ac[0], ac[1], ac[2], 92);
      parts.shards(gx, 2.4, 0.4, reduced() ? 4 : Math.round(14 * boost), 9, ac[0], ac[1], ac[2], 5);
    } else {
      const bad = colorOf(0xff2f52);
      chain = 0;
      surge = 1;
      audio.setMusicLayers(1);
      voltage -= COST_WRONG_GATE;
      stumble = STUMBLE_TIME;
      player.stumble();
      audio.gateWrong();
      audio.duckMusic(0.5);
      host.haptic("failure");
      shake.add(reduced() ? 0 : 0.85);
      hitstop.hit(reduced() ? 0.05 : 0.13, 0.05);
      fovSpring.kick(reduced() ? 0 : -110);
      pullSpring.kick(reduced() ? 0 : 22);
      chromaSpring.kick(reduced() ? 0 : 9);
      flash.fire(0.22, [1, 0.16, 0.24], reduced());
      // The right answer is shown on the gate you did not take. This is the
      // whole teaching moment and it is one second long, not a lecture.
      ents.popup(g.values[g.correctLane], laneX(g.correctLane), 3.0, 0.4, 1.35, 0.4, 1, 0.75, 1.6);
      parts.burst(gx, 1.8, 0.2, reduced() ? 12 : 44, 19, 0.75, 0.5, bad[0], bad[1], bad[2], -4);
      parts.shards(gx, 1.9, 0.3, reduced() ? 6 : 22, 13, bad[0], bad[1], bad[2], -2);
      parts.ring(gx, 1.9, 0.3, 2, 0.5, bad[0], bad[1], bad[2], 40);
    }
    refreshHud();
  }

  /* ------------------------------- hazards ------------------------------- */

  function pickHazard(): HazardKind {
    const r = rng.next();
    if (travel < 320) return "pylon";
    if (travel < 850) return r < 0.72 ? "pylon" : "lowbar";
    if (travel < 1700) return r < 0.5 ? "pylon" : r < 0.78 ? "lowbar" : "pit";
    return r < 0.38 ? "pylon" : r < 0.62 ? "lowbar" : r < 0.8 ? "pit" : "sweeper";
  }

  function emitBeat(): void {
    const spawnZ = tiers.settings.far * 0.88;
    // Never put a hazard inside the reading window of a gate: the child would
    // be dodging while reading, which is not difficulty, it is noise.
    if (activeGate && Math.abs(-spawnZ - activeGate.z) < 30) return;

    const roll = rng.next();
    const hazardChance = clamp(0.42 + travel / 9000, 0.42, 0.78);
    if (roll < hazardChance) {
      const kind = pickHazard();
      if (kind === "pit") {
        ents.spawnHazard("pit", 1, spawnZ);
        // Sparks arcing over the gap: the reward line *is* the instruction.
        for (let i = 0; i < 5; i++) {
          const t = i / 4;
          ents.spawnSpark(0, 1.4 + Math.sin(t * Math.PI) * 2.4, spawnZ + 8 - i * 4);
        }
      } else if (kind === "lowbar") {
        const span = travel > 2200 && rng.chance(0.45) ? 3 : 1;
        const lane = span === 3 ? 1 : rng.int(0, 2);
        ents.spawnHazard("lowbar", lane, spawnZ, span);
      } else if (kind === "sweeper") {
        ents.spawnHazard("sweeper", 1, spawnZ);
      } else {
        const lanes = [0, 1, 2];
        rng.shuffle(lanes);
        const n = travel > 1400 && rng.chance(0.42) ? 2 : 1;
        for (let i = 0; i < n; i++) ents.spawnHazard("pylon", lanes[i], spawnZ - i * 0.01);
        // Sparks in a surviving lane: a positive read of where to go.
        if (rng.chance(0.6)) {
          const safe = lanes[n];
          for (let i = 0; i < 4; i++) ents.spawnSpark(laneX(safe), 1.25, spawnZ + 14 - i * 4.5);
        }
      }
    } else if (roll < hazardChance + 0.38) {
      const lane = rng.int(0, 2);
      const n = rng.int(4, 8);
      const wavy = rng.chance(0.4);
      for (let i = 0; i < n; i++) {
        const x = wavy ? laneX(lane) + Math.sin(i * 0.8) * LANE_W * 0.9 : laneX(lane);
        ents.spawnSpark(clamp(x, -LANE_W, LANE_W), 1.25, spawnZ + 16 - i * 4.4);
      }
    }
  }

  /* ------------------------------ collisions ----------------------------- */

  function hitHazard(x: number, cause: "hazard" | "pit"): void {
    if (player.invuln > 0) return;
    const bad = colorOf(0xff5a2a);
    // Voltage is the world, surge is the maths. A pylon costs you charge and a
    // second of control; it does not touch the multiplier a child earned by
    // reading, because that multiplier is the only thing measuring the reading.
    voltage -= COST_HAZARD;
    stumble = STUMBLE_TIME * 0.8;
    player.stumble();
    player.invuln = 1.05;
    audio.hazardHit();
    host.haptic("heavy");
    shake.add(reduced() ? 0 : 0.68);
    hitstop.hit(reduced() ? 0.04 : 0.1, 0.05);
    fovSpring.kick(reduced() ? 0 : -80);
    chromaSpring.kick(reduced() ? 0 : 7);
    flash.fire(0.24, [1, 0.32, 0.16], reduced());
    parts.burst(x, cause === "pit" ? 0.4 : 1.6, 0.2, reduced() ? 10 : 36, 17, 0.7, 0.5, bad[0], bad[1], bad[2], -3);
    parts.shards(x, 1.4, 0.3, reduced() ? 5 : 18, 11, bad[0], bad[1], bad[2], -2);
    refreshHud();
  }

  function collide(): void {
    const px = player.x;
    const pBot = player.y;
    const pTop = player.y + player.hitHalfH * 2;

    for (const h of ents.hazards) {
      if (!h.active || h.hit) continue;
      if (h.kind === "pit") continue;
      const depth = h.kind === "lowbar" ? 0.7 : 0.6;
      if (Math.abs(h.z) > 1.5 + depth) continue;
      const hx = ents.hazardX(h);
      if (h.kind === "lowbar") {
        const halfW = (LANE_W * h.span) / 2;
        if (Math.abs(px - hx) < halfW + 0.7 && pTop > 1.6 && pBot < 3.2) {
          h.hit = true;
          hitHazard(px, "hazard");
        }
      } else {
        if (Math.abs(px - hx) < 0.82 + LANE_W * 0.31 && pBot < 3.4) {
          h.hit = true;
          hitHazard(px, "hazard");
        } else if (!h.grazed && Math.abs(px - hx) < 2.55) {
          h.grazed = true;
          onGraze(hx);
        }
      }
    }

    for (const s of ents.sparks) {
      if (!s.active || s.taken) continue;
      if (Math.abs(s.z) > 2.2) continue;
      if (Math.abs(px - s.x) > 1.55) continue;
      if (Math.abs(player.y + 0.85 - s.y) > 1.7) continue;
      s.taken = true;
      s.active = false;
      stats.sparks++;
      score += 10 * surge;
      voltage = Math.min(VOLT_MAX, voltage + GAIN_SPARK);
      audio.spark(stats.sparks);
      const c = colorOf(biome.accent);
      parts.burst(s.x, s.y, s.z, reduced() ? 3 : 9, 7, 0.34, 0.28, c[0], c[1], c[2], 6);
      if (stats.sparks % 12 === 0) host.haptic("light");
    }
  }

  function onGraze(hx: number): void {
    stats.grazes++;
    score += 25 * surge;
    voltage = Math.min(VOLT_MAX, voltage + GAIN_GRAZE);
    audio.graze(clamp01((speed - V_START) / (V_TERMINAL - V_START)));
    host.haptic("light");
    // The near-miss punch: this is the format's signature feeling and it is
    // worth more juice than the reward for a correct gate.
    shake.add(reduced() ? 0 : 0.20);
    fovSpring.kick(reduced() ? 0 : 70);
    hitstop.hit(reduced() ? 0 : 0.028, 0.2);
    const c = colorOf(0xffffff);
    parts.ring(hx, 1.4, 0.6, 2.4, 0.3, c[0], c[1], c[2], 34);
    ents.popup("+" + 25 * surge, hx, 2.4, 0.6, 0.62, 1, 1, 1, 0.75);
  }

  /* -------------------------------- revive ------------------------------- */

  function beginDying(): void {
    phase = "dying";
    dyingT = 0;
    audio.setMusicLayers(0);
    audio.reviveCharge();
    shake.add(reduced() ? 0 : 1);
    hitstop.hit(reduced() ? 0.08 : 0.22, 0.03);
    flash.fire(0.4, [1, 0.2, 0.28], reduced());
    host.haptic("heavy");
    const bad = colorOf(0xff2f52);
    parts.burst(player.x, 1.2, 0.2, reduced() ? 16 : 70, 24, 1.1, 0.7, bad[0], bad[1], bad[2], 0);
    parts.shards(player.x, 1.2, 0.2, reduced() ? 8 : 30, 15, bad[0], bad[1], bad[2], 0);
    parts.ring(player.x, 1.4, 0.4, 3, 0.9, 1, 1, 1, 70);
  }

  function openRevive(): void {
    phase = "revive";
    reviveQ = host.next({ difficulty: Math.max(0, difficulty() - 1) });
    reviveLimit = Math.max(4.5, 7 - stats.revives * 0.6);
    reviveTimer = reviveLimit;
    hud.revivePrompt.textContent = reviveQ.prompt;
    // Exactly the rules the gates out on the causeway use. A recharge question
    // that offers a different quality of wrong answer is a different question.
    const { values, correct } = laneOptions(reviveQ.answer, reviveQ.distractors, rng);
    reviveAnswerLane = correct;
    hud.reviveLanes.forEach((b, i) => {
      b.className = "vt-lane";
      b.disabled = false;
      (b.firstElementChild as HTMLElement).textContent = values[i];
    });
    hud.reviveCount.textContent = stats.revives === 0 ? "" : `Recharge ${stats.revives + 1}`;
    showVeil("revive");
    hud.reviveLanes[1].focus();
  }

  let reviveAnswerLane = 0;
  let reviveResolving = false;
  /**
   * The verdict beat between choosing a recharge lane and the run resuming.
   *
   * Held so `unmount()` can cancel it. A host that swaps packs while the beat is
   * in flight would otherwise get a callback that starts audio, writes to a HUD
   * that is no longer in the document and resurrects a disposed run — half a
   * second after the game was told to go away.
   */
  let reviveVerdict = 0;

  function answerRevive(lane: number): void {
    if (reviveResolving || !reviveQ) return;
    reviveResolving = true;
    const correct = lane === reviveAnswerLane;
    host.report({
      questionId: reviveQ.id,
      correct,
      ms: Math.round((reviveLimit - reviveTimer) * 1000),
      answered: lane < 0 ? "" : (hud.reviveLanes[lane].textContent ?? "").trim().replace(/−/g, "-"),
    });
    hud.reviveLanes.forEach((b, i) => {
      b.disabled = true;
      b.classList.add(i === reviveAnswerLane ? "vt-right" : "vt-wrong");
    });
    reviveVerdict = window.setTimeout(() => {
      reviveVerdict = 0;
      if (disposed) return;
      reviveResolving = false;
      if (correct) {
        stats.revives++;
        voltage = VOLT_MAX;
        surge = 1;
        chain = 0;
        player.reset();
        // After `reset()`, which zeroes it. You come back on the deck, centred,
        // with a beat of grace before the world can touch you again.
        player.invuln = REVIVE_GRACE;
        stumble = 0;
        ents.reset();
        activeGate = null;
        gateCooldown = 1.1;
        phase = "running";
        showVeil(null);
        audio.reviveSuccess();
        audio.setMusicLayers(1);
        host.haptic("success");
        flash.fire(0.45, [1, 1, 1], reduced());
        shake.add(reduced() ? 0 : 0.5);
        const c = colorOf(biome.accent);
        parts.burst(player.x, 1.2, 0.2, reduced() ? 20 : 90, 26, 1.2, 0.8, c[0], c[1], c[2], 12);
        parts.ring(player.x, 1.4, 0.4, 2, 0.8, 1, 1, 1, 90);
        refreshHud();
        banner("Recharged");
      } else {
        endRun();
      }
    }, correct ? 420 : 780);
  }

  /* ---------------------------------- loop ------------------------------- */

  let raf = 0;
  let last = performance.now();
  let disposed = false;

  function frame(now: number): void {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const rawDt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (rawDt <= 0) return;

    // The manual is open: hold the world still. VOLTA answers by which lane you
    // are in, so a road that kept moving while a child read the rules would
    // carry them through gate after gate and report each one as a wrong answer
    // they never gave. `last` is already advanced above, so lifting the manual
    // does not deliver one enormous frame.
    if (guide.isOpen) return;

    fpsAcc += rawDt;
    fpsFrames++;
    if (rawDt > worstFrame) worstFrame = rawDt;
    if (fpsAcc >= 0.5) {
      fps = fpsFrames / fpsAcc;
      fpsAcc = 0;
      fpsFrames = 0;
      if (showPerf) {
        hud.perf.textContent =
          `${fps.toFixed(0)} fps  worst ${(worstFrame * 1000).toFixed(1)}ms\n` +
          `tier ${tiers.tier} x${tiers.renderScale.toFixed(2)}  ${vw}x${vh}\n` +
          `input->act avg ${(latencyN ? latencySum / latencyN : 0).toFixed(1)}ms max ${latencyWorst.toFixed(1)}\n` +
          `parts ${parts.count}  draws ${sceneCalls}  tris ${sceneTris}\n` +
          `seed ${seed.toString(16)}`;
        worstFrame = 0;
      }
    }
    tiers.observe(rawDt);

    const rm = reduced();
    hud.root.classList.toggle("vt-rm", rm);
    const dt = rawDt * hitstop.scale(rawDt);

    audio.tick();
    flash.update(rawDt);

    if (phase === "running" || phase === "dying") step(dt, rawDt, rm);
    else stepIdle(dt, rm);

    render(rawDt, rm);
  }

  function stepIdle(dt: number, rm: boolean): void {
    // The world keeps running behind every overlay. A frozen menu over a frozen
    // game looks broken; a menu over a living world looks like a game.
    elapsed += dt;
    const drift = phase === "over" ? 9 : phase === "revive" ? 24 : 16;
    shared.uTime.value += dt;
    shared.uTravel.value += drift * dt;
    const scroll = drift * dt;
    scenery.update(dt, scroll, travel, biome, parts);
    parts.update(dt, scroll);
    ents.update(dt, scroll);
    player.update(dt, true, rm);
    if (phase === "revive") {
      reviveTimer -= dt;
      const f = clamp01(reviveTimer / reviveLimit);
      hud.reviveRing.style.strokeDashoffset = String(ringCircumference * (1 - f));
      hud.reviveRing.style.stroke = f > 0.4 ? "currentColor" : "#ff3a5e";
      if (reviveTimer <= 0 && !reviveResolving) answerRevive(-1);
    }
  }

  function step(dt: number, rawDt: number, rm: boolean): void {
    elapsed += dt;

    if (phase === "dying") {
      dyingT += rawDt;
      speed = approach(speed, 4, 2.4, dt);
      pullSpring.target = 12;
      if (dyingT > 1.15) {
        pullSpring.target = 0;
        openRevive();
      }
    } else {
      const surgeBoost = 1 + Math.min(0.2, (surge - 1) * 0.026);
      let want = speedAt(elapsed, rm) * surgeBoost;
      if (rm) want = Math.min(want, V_REDUCED_CAP);
      if (stumble > 0) {
        stumble = Math.max(0, stumble - dt);
        want *= 0.52;
      }
      speed = approach(speed, want, stumble > 0 ? 9 : 1.6, dt);
    }

    const scroll = speed * dt;
    travel += scroll;
    shared.uTime.value += dt;
    shared.uTravel.value += scroll;
    shared.uSpeed01.value = clamp01((speed - V_START) / (V_TERMINAL - V_START));
    shared.uSurge.value = clamp01((surge - 1) / (SURGE_MAX - 1));
    shared.uDanger.value = phase === "running" ? clamp01(1 - voltage / 32) : 0;

    /* input */
    if (phase === "running" && stumble <= 0) {
      for (let guard = 0; guard < 2; guard++) {
        const i = input.consume(() => true);
        if (!i) break;
        latencyN++;
        latencySum += input.lastLatencyMs;
        latencyWorst = Math.max(latencyWorst, input.lastLatencyMs);
        if (i === "left") {
          if (player.moveLane(-1)) laneMoved();
        } else if (i === "right") {
          if (player.moveLane(1)) laneMoved();
        } else if (i === "jump") {
          if (player.jump()) {
            audio.jump();
            host.haptic("light");
            parts.burst(player.x, 0.2, 0.3, rm ? 3 : 10, 6, 0.3, 0.3, 1, 1, 1, 4);
          }
        } else if (player.slide()) {
          audio.slide();
          host.haptic("light");
          parts.burst(player.x, 0.2, 0.4, rm ? 3 : 12, 8, 0.35, 0.34, 1, 1, 1, -3);
        }
      }
    }

    /* world bend */
    const t = shared.uTime.value;
    const amp = rm ? 0.5 : 1;
    shared.uBend.value.set(
      (Math.sin(t * 0.127) * 0.66 + Math.sin(t * 0.071 + 2.1) * 0.44) * 1.25e-4 * amp,
      (Math.sin(t * 0.091 + 1.3) * 0.5 + Math.sin(t * 0.043) * 0.3) * 0.9e-4 * amp - 0.2e-4,
    );

    /* pit state: the deck is genuinely open, so falling is falling. Every
       visible pit is cut, not just the one underfoot — a hole a child cannot
       see coming is not a hazard, it is an ambush. */
    const pit = ents.pitAt(0);
    const pitsV = deck.material.uniforms.uPits.value as THREE.Vector4;
    pitsV.set(1e9, 1e9, 1e9, 1e9);
    let pitSlot = 0;
    for (const h of ents.hazards) {
      if (!h.active || h.kind !== "pit" || pitSlot > 3) continue;
      pitsV.setComponent(pitSlot++, h.z);
    }
    (deck.material.uniforms.uPitHalf as { value: number }).value = 3.4;
    (deck.material.uniforms.uPlayerX as { value: number }).value = player.x;

    player.update(dt, !pit || player.invuln > 0, rm);
    if (player.y < -3.5) {
      player.y = 0;
      player.vy = 0;
      hitHazard(player.x, "pit");
    }

    scenery.update(dt, scroll, travel, biome, parts);
    ents.update(dt, scroll);
    parts.update(dt, scroll);
    player.emitThrust(dt, parts, shared.uSpeed01.value, ...thrustColor(), rm ? 0.4 : 1);

    if (phase === "running") {
      collide();

      if (activeGate && activeGate.z >= GATE_PLANE && activeGate.state === "incoming") {
        resolveGate(activeGate);
      }
      if (!activeGate) {
        gateCooldown -= dt;
        if (gateCooldown <= 0) requestGate();
      }

      if (travel >= nextBeatAt) {
        nextBeatAt = travel + speed * beatTime(travel);
        emitBeat();
      }

      if (travel >= nextBiomeAt) {
        biomeIndex++;
        prevBiome = biome;
        biome = biomeAt(biomeIndex);
        biomeMix = 0;
        nextBiomeAt = travel + biomeLength(biomeIndex);
        audio.biomeShift();
        audio.setScale(biome.scale, biome.bpm);
        banner(biome.name);
        flash.fire(0.32, [1, 1, 1], rm);
        shake.add(rm ? 0 : 0.42);
        fovSpring.kick(rm ? 0 : 90);
        host.haptic("medium");
      }

      /* voltage */
      voltage -= dt * VOLT_BLEED;
      if (voltage <= 32 && !lowVoltWarned) {
        lowVoltWarned = true;
        banner("Low voltage");
      }
      if (voltage > 40) lowVoltWarned = false;
      if (voltage <= 32) {
        lowVoltTick -= dt;
        if (lowVoltTick <= 0) {
          lowVoltTick = 0.8;
          audio.lowVoltage();
          host.haptic("light");
        }
      }
      if (voltage <= 0) {
        voltage = 0;
        beginDying();
      }

      score += scroll * 1;
    }

    if (biomeMix < 1) {
      biomeMix = Math.min(1, biomeMix + dt / 1.6);
      applyBiomeUniforms();
    }
    shared.uShift.value = biomeMix < 1 ? Math.sin(biomeMix * Math.PI) * 0.55 : 0;

    displayScore = approach(displayScore, score, 7, rawDt);
    refreshHud();
    audio.setDrive(shared.uSpeed01.value, phase === "running");
  }

  function laneMoved(): void {
    laneSettledAt = elapsed;
    host.haptic("light");
    const c = colorOf(biome.accent);
    parts.puff(player.x, 0.9, 0.9, -player.vx * 0.35, 0.6, 6, 0.3, 0.5, 0.4, c[0], c[1], c[2], 1);
    if (!reduced()) shake.add(0.045);
  }

  function thrustColor(): [number, number, number] {
    const c = colorOf(biome.accent2);
    return [c[0], c[1], c[2]];
  }

  /* --------------------------------- render ------------------------------ */

  const camTarget = new THREE.Vector3();
  function render(rawDt: number, rm: boolean): void {
    shake.update(rawDt, rm, 1);

    const speed01 = shared.uSpeed01.value;
    fovSpring.target = 72 + speed01 * 12 + (surge - 1) * 0.9 + (vw < vh ? 6 : 0);
    const fov = fovSpring.update(rawDt);
    const pull = pullSpring.update(rawDt);
    const chroma = Math.max(0, chromaSpring.update(rawDt));

    camera.fov = clamp(fov, 58, 104);
    camera.position.set(
      player.x * 0.6 + shake.x,
      4.45 + player.y * 0.42 - (player.sliding ? 0.85 : 0) + shake.y + pull * 0.32,
      11.4 + pull,
    );
    camTarget.set(player.x * 0.3, 2.35 + player.y * 0.62, -26);
    camera.lookAt(camTarget);
    camera.rotation.z += shake.roll + player.roll * 0.55;
    camera.updateProjectionMatrix();
    sky.mesh.position.copy(camera.position);
    sky.mesh.scale.setScalar(Math.max(60, camera.far * 0.9));

    /* build the frame */
    const ac = colorOf(biome.accent);
    const ac2 = colorOf(biome.accent2);
    const hot = colorOf(0xffffff);
    const good = colorOf(0x6dffb0);
    const bad = colorOf(0xff3355);
    const warn = colorOf(biome.inverted ? 0xff2f6d : 0xff7a1f);

    shardField.begin();
    boxField.begin();
    skiffField.begin();
    glow.begin();
    digits.begin();

    proj.update(camera, shared.uBend.value.x, shared.uBend.value.y);

    scenery.draw(shardField, boxField, biome, shared.uShift.value);
    ents.drawGates(boxField, glow, digits, proj, ac, hot, bad, good, numeralInk, shared.uTime.value, false, frameNdc);
    ents.drawHazards(boxField, glow, warn, ac, shared.uTime.value);
    ents.drawPits(glow, warn);
    ents.drawSparks(glow, ac2, shared.uTime.value);

    // Speed streaks: near-camera additive slivers, length driven by velocity.
    if (!rm && tiers.settings.streaks > 0) {
      const n = Math.round(tiers.settings.streaks * (0.25 + speed01 * 0.75));
      const seedT = shared.uTravel.value * 0.02;
      for (let i = 0; i < n; i++) {
        const a = i * 2.399963;
        const rr = 6 + ((i * 7.13) % 26);
        const zz = -4 - ((i * 3.7 + seedT * 40) % 46);
        glow.add(
          Math.cos(a) * rr, 3 + Math.sin(a) * rr * 0.55, zz,
          0.12, 0.18 + speed01 * 0.3, 10 + speed01 * 26, 0,
          ac[0], ac[1], ac[2],
        );
      }
    }

    parts.draw(glow, rm ? 0.75 : 1);
    player.draw(skiffField, boxField, glow, ac[0], ac[1], ac[2], ac2[0], ac2[1], ac2[2], rm);
    ents.drawPopups(digits, proj, frameNdc);

    shardField.end();
    boxField.end();
    skiffField.end();
    glow.end();
    digits.end();

    post.composite.uniforms.uChroma.value = rm ? 0 : Math.min(0.02, chroma * 0.0016 + speed01 * 0.0012);
    post.composite.uniforms.uBloomStrength.value = biome.inverted ? 0.34 : 0.62;
    post.composite.uniforms.uVignette.value = 0.52 + shared.uDanger.value * 0.3;
    post.composite.uniforms.uFlash.value = flash.value;
    (post.composite.uniforms.uFlashColor.value as THREE.Color).setRGB(flash.color[0], flash.color[1], flash.color[2]);
    // The run summary is over and may fade. The recharge gate is not over — a
    // desaturated world behind it is the game telling a child they already lost.
    post.composite.uniforms.uDesat.value = phase === "over" ? 0.45 : 0;

    renderer.setRenderTarget(post.target);
    renderer.render(scene, camera);
    sceneCalls = renderer.info.render.calls;
    sceneTris = renderer.info.render.triangles;
    post.present();
    renderer.setRenderTarget(null);
  }

  /* -------------------------------- events ------------------------------- */

  const onStart = (): void => startRun();
  const onAgain = (): void => startRun();
  const onSound = (): void => {
    sfxOn = !sfxOn;
    audio.start();
    audio.setEnabled(sfxOn);
    hud.soundBtn.setAttribute("aria-pressed", String(sfxOn));
  };
  const onMotion = (): void => {
    motionOverride = !motionOverride;
    hud.motionBtn.setAttribute("aria-pressed", String(motionOverride));
  };
  hud.startBtn.addEventListener("click", onStart);
  hud.againBtn.addEventListener("click", onAgain);
  hud.soundBtn.addEventListener("click", onSound);
  hud.motionBtn.addEventListener("click", onMotion);
  hud.reviveLanes.forEach((b, i) => b.addEventListener("click", () => answerRevive(i)));

  const onKey = (e: KeyboardEvent): void => {
    if (phase === "idle" && (e.code === "Space" || e.code === "Enter")) {
      e.preventDefault();
      startRun();
    } else if (phase === "over" && (e.code === "Space" || e.code === "Enter")) {
      e.preventDefault();
      startRun();
    } else if (phase === "revive" && !reviveResolving) {
      const map: Record<string, number> = { ArrowLeft: 0, KeyA: 0, ArrowDown: 1, KeyS: 1, ArrowUp: 1, KeyW: 1, ArrowRight: 2, KeyD: 2, Digit1: 0, Digit2: 1, Digit3: 2 };
      const lane = map[e.code];
      if (lane !== undefined) {
        e.preventDefault();
        answerRevive(lane);
      }
    }
  };
  window.addEventListener("keydown", onKey);

  const onVisibility = (): void => {
    if (document.hidden) {
      audio.suspend();
    } else {
      last = performance.now();
      if (sfxOn) audio.resume();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  /**
   * The GPU took the context away.
   *
   * Stopping the loop is the whole point. Preventing the default and then
   * carrying on schedules `render()` forever against a dead context: every draw
   * is a silent no-op, so a child sees a frozen black canvas and the host is
   * told nothing. Better to halt, say so loudly, and let the run end.
   */
  const onContextLost = (e: Event): void => {
    e.preventDefault();
    console.error("[runner] WebGL context lost — the run cannot continue.");
    cancelAnimationFrame(raf);
    raf = 0;
    audio.suspend();
    if (phase === "running" || phase === "dying") endRun();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  showVeil("start");
  refreshHud();
  hud.startBtn.focus({ preventScroll: true });
  raf = requestAnimationFrame(frame);

  /* -------------------------------- unmount ------------------------------ */

  return {
    unmount(): void {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      if (reviveVerdict) window.clearTimeout(reviveVerdict);
      guide.destroy();
      stopInsets();
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      hud.startBtn.removeEventListener("click", onStart);
      hud.againBtn.removeEventListener("click", onAgain);
      hud.soundBtn.removeEventListener("click", onSound);
      hud.motionBtn.removeEventListener("click", onMotion);
      input.dispose();
      audio.dispose();
      post.dispose();
      shardField.dispose();
      boxField.dispose();
      skiffField.dispose();
      glow.dispose();
      digits.dispose();
      deck.mesh.geometry.dispose();
      deck.material.dispose();
      ocean.geometry.dispose();
      (ocean.material as THREE.Material).dispose();
      sky.mesh.geometry.dispose();
      sky.material.dispose();
      renderer.dispose();
      // `dispose()` unbinds three's listeners and empties its caches; it does
      // NOT release the GL context — `forceContextLoss()` is a separate call.
      // A browser allows on the order of sixteen live contexts, so a host that
      // swaps packs would eventually have one evicted underneath a running game.
      renderer.forceContextLoss();
      // The verification probe closes over the scene, the renderer and every
      // pool. Leaving it on `window` pins all of that for the life of the page —
      // and the harness that uses it is precisely the thing that mounts often.
      if (showPerf) delete (window as unknown as Record<string, unknown>).__volta;
      hud.style.remove();
      el.querySelectorAll(".vt-root").forEach((n) => n.remove());
      canvas.remove();
    },
  };
}
