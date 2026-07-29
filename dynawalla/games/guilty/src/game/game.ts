/**
 * SHOOT THE GUILTY NUMBER.
 *
 * A problem hangs at the top of a trench. Candidate answers are thrown out of
 * it and sink towards a gate you cannot let them cross. Destroy the one that is
 * telling the truth; the rest scatter. Shoot an innocent and it turns on you.
 *
 * The loop, the phases, the collisions and the scoring all live here; the feel
 * lives in `../core/juice.ts` and the look in `./husk.ts`, `./scene.ts` and
 * `./ship.ts`.
 */

import {
  createInstructions,
  onInsetsChange,
  safeRect,
} from "../../../../packs/shared/game-chrome/index.ts";
import type { GameHandle, Host, Question } from "../contract.ts";
import { createAudio } from "../audio/audio.ts";
import { beginFrame, fitCamera, makeCamera } from "../core/camera.ts";
import {
  BULLET_R,
  CAM_Z,
  EQUATION_Y,
  FOCUS_DURATION,
  FOCUS_PER_SOLVE,
  FOCUS_TIME_SCALE,
  GATE_Y,
  HITSTOP_BOSS,
  HITSTOP_KILL,
  HITSTOP_WRONG,
  HUSK_R,
  MAX_LIVES,
  SHIP_HALF_W,
  SHIP_MAX_SPEED,
  SHIP_Y,
  START_LIVES,
  URGENCY_BAND,
  URGENCY_MULTIPLIER,
  VIEW_HALF_H,
  WAVE_GAP,
} from "../core/config.ts";
import {
  addHitstop,
  addTrauma,
  flash,
  makeJuice,
  punch,
  shakeAmount,
  slowMotion,
  stepJuice,
} from "../core/juice.ts";
import { C } from "../core/palette.ts";
import { hashString, makeRng } from "../math/rng.ts";
import { bakeVignette, clearGlyphCache } from "../render/bake.ts";
import { clamp, damp, makeLineBatch } from "../render/draw.ts";
import { drawBoss } from "./boss.ts";
import { drawParticles, embers, ring, shards, sparks, stepParticles } from "./fx.ts";
import { drawEquation, drawGameOver, drawHud, drawSecondWind, drawTitle, frameStats } from "./hud.ts";
import { drawHusk, resetHusk, updateHusk } from "./husk.ts";
import { attachInput } from "./input.ts";
import { bakeScene, drawBackground, drawFloor, drawVignette, seedMotes } from "./scene.ts";
import {
  drawBullets,
  drawShip,
  drawSight,
  findTarget,
  fireBolt as fireBoltAt,
  stepBullets,
  updateShip,
} from "./ship.ts";
import { hudLayout } from "./hudLayout.ts";
import { bannerFor, specFor } from "./waves.ts";
import { Mode, Phase, freeHusk, makePools, type Husk, type World } from "./world.ts";

const BEST_KEY = "dynawalla.guilty.best";

/**
 * Mounts the game. The return type is the contract's `GameHandle` plus a
 * read-only `stats()` — extra structure a host may ignore entirely, and the
 * only way the QA driver ever touches the running game.
 */
export function mount(
  el: HTMLElement,
  host: Host,
): GameHandle & { stats(): ReturnType<typeof frameStats> } {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";
  canvas.tabIndex = 0;
  el.appendChild(canvas);
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true }) as CanvasRenderingContext2D;

  const params = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
  const seed = Number(params.get("seed") ?? 0) || (Date.now() & 0xffffffff);
  const rng = makeRng(seed);
  const reduced = host.prefersReducedMotion();

  const world: World = {
    host,
    audio: createAudio(() => rng.nextFloat()),
    cam: makeCamera(),
    juice: makeJuice(reduced, () => rng.nextFloat()),
    batch: makeLineBatch(),
    rng,
    reduced,
    ctx,
    w: 1,
    h: 1,
    dpr: 1,
    hud: hudLayout(1, 1, { x: 0, y: 0, w: 1, h: 1 }),
    ...makePools(),
    ship: {
      x: 0,
      targetX: 0,
      vx: 0,
      fireCd: 0,
      recoil: 0,
      bank: 0,
      invuln: 0,
      alive: true,
      muzzle: 0,
      settled: 1,
    },
    boss: {
      active: false,
      x: 0,
      y: 0,
      hp: 0,
      maxHp: 3,
      stage: 0,
      flash: 0,
      spin: 0,
      shield: 1,
      volleyCd: 0,
      dying: 0,
    },
    motes: new Float32Array(0),
    moteCount: 0,
    phase: Phase.Title,
    phaseT: 0,
    time: 0,
    wave: 1,
    lives: START_LIVES,
    score: 0,
    displayScore: 0,
    combo: 0,
    bestCombo: 0,
    best: loadBest(),
    focus: 0,
    focusT: 0,
    question: null,
    askedAt: 0,
    firstWrong: null,
    resolved: true,
    perfectWave: true,
    descent: 12,
    swingAmp: 0,
    swingFreq: 0.4,
    swingPhase: 0,
    swingPhaseX: 0,
    formationY: EQUATION_Y,
    usedSecondWind: false,
    fireBolt: () => undefined,
    shotStep: 0,
    banner: "",
    bannerSub: "",
    bannerT: 0,
    gateDanger: 0,
    fpsSamples: [],
    frameMs: 16,
    quality: 1,
    showStats: params.has("stats"),
    paused: false,
    touch: false,
  };
  world.fireBolt = (x, y) => fireBoltAt(world, x, y);

  let vignette: HTMLCanvasElement | null = null;
  let bossFinishing = false;

  /* ---------------------------------------------------------------- layout */

  function resize(): void {
    const rect = el.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || window.innerWidth));
    const h = Math.max(360, Math.round(rect.height || window.innerHeight));
    // Cap the backing store: a 3x phone canvas costs more fill than any of this
    // is worth, and the look is all glow, which hides the resample.
    const raw = Math.min(window.devicePixelRatio || 1, 2);
    const dpr = w * h * raw * raw > 3_600_000 ? Math.max(1, raw * 0.75) : raw;
    world.w = w;
    world.h = h;
    world.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The camera is fitted to the whole GLASS: the trench, the gate, the husks
    // and the ship are supposed to bleed under the notch, which is why
    // `viewport-fit=cover` is set at all. Only the type moves.
    fitCamera(world.cam, w, h);
    world.hud = hudLayout(w, h, safeRect(w, h));
    bakeScene(w, h);
    vignette = bakeVignette(w, h);
  }

  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => resize()) : null;
  observer?.observe(el);
  window.addEventListener("resize", resize);
  // Rotation swaps the insets and iPadOS changes them when the pack is resized
  // in Split View, neither of which is guaranteed to change the canvas size. A
  // layout read once at mount is right until the first turn of the tablet.
  const stopInsets = onInsetsChange(() => {
    resize();
  });
  resize();
  seedMotes(world, 150);

  /* ------------------------------------------------------------- questions */

  function askQuestion(wanted: number, shroudChance: number, orbit: boolean): void {
    // A phone in portrait has a third of the lane width a laptop does. Rather
    // than let six cells overlap into an unreadable smear, the formation loses
    // a lane and every cell shrinks to keep a real gap between the numerals.
    const laneSpan = world.cam.playHalfW * 1.64;
    const count = orbit ? wanted : Math.max(3, Math.min(wanted, Math.floor(laneSpan / 21) + 1));
    const q: Question = host.next();
    world.question = q;
    world.askedAt = world.time;
    world.firstWrong = null;
    world.resolved = false;

    const qrng = makeRng(hashString(q.id));
    const labels: string[] = [q.answer];
    for (const d of q.distractors) {
      if (labels.length >= count) break;
      if (!labels.includes(d)) labels.push(d);
    }
    while (labels.length < count) labels.push(String(Number(q.answer) + labels.length * 3 + 1));
    qrng.shuffle(labels);

    const spread = world.cam.playHalfW * 0.82;
    const orbitR = Math.min(66, world.cam.playHalfW * 0.72);
    const spacing = labels.length > 1 ? (spread * 2) / (labels.length - 1) : 999;
    const cellR = clamp(spacing * 0.44, 8.5, HUSK_R);
    for (let i = 0; i < labels.length; i++) {
      const h = freeHusk(world);
      if (!h) break;
      resetHusk(h);
      h.label = labels[i] as string;
      h.guilty = h.label === q.answer;
      h.lane = labels.length === 1 ? 0 : -spread + (spread * 2 * i) / (labels.length - 1);
      h.row = (i % 2 === 0 ? 5 : -5) + (i % 3) * 1.5;
      h.spin = qrng.range(0, Math.PI * 2);
      h.spinV = qrng.range(0.5, 1.15) * (qrng.int(0, 1) ? 1 : -1);
      h.tilt = qrng.range(-0.3, 0.3);
      h.tiltV = qrng.range(-0.35, 0.35);
      h.wob = qrng.range(0, 6);
      h.shroud = qrng.nextFloat() < shroudChance ? 1 : 0;
      if (orbit) {
        h.mode = Mode.Orbit;
        h.orbit = (i / labels.length) * Math.PI * 2;
        h.orbitR = orbitR;
        h.radius = Math.min(11.5, orbitR * 0.3);
        h.x = world.boss.x + Math.cos(h.orbit) * orbitR;
        h.y = world.boss.y + Math.sin(h.orbit) * orbitR * 0.44;
      } else {
        h.radius = cellR;
        // Born out of the equation and thrown into formation. This fan-out is
        // the whole tutorial: these numbers came from that problem.
        h.x = qrng.range(-6, 6);
        h.y = EQUATION_Y - 6;
        h.vx = (h.lane - h.x) * 2.4 + qrng.range(-18, 18);
        h.vy = qrng.range(-30, 8);
        h.vz = qrng.range(-40, 40);
      }
      sparks(world, h.x, h.y, 0, 6, 60, C.amber, { life: 0.4, size: 1.3 });
    }
  }

  function startWave(): void {
    const spec = specFor(world.wave);
    world.descent = spec.descent;
    world.swingAmp = spec.swingAmp;
    world.swingFreq = spec.swingFreq;
    world.perfectWave = true;
    // Well below the equation: the husks are *born* out of it and fall clear,
    // so the problem never sits behind the answers.
    world.formationY = EQUATION_Y - 62;
    const [banner, sub] = bannerFor(world.wave);
    if (banner) showBanner(banner, sub);

    if (spec.boss) {
      world.boss.active = true;
      world.boss.hp = 3;
      world.boss.maxHp = 3;
      world.boss.x = 0;
      world.boss.y = EQUATION_Y - 46;
      world.boss.shield = 1;
      world.boss.dying = 0;
      world.boss.volleyCd = 3;
      bossFinishing = false;
      askQuestion(spec.candidates, 0, true);
    } else {
      world.boss.active = false;
      askQuestion(spec.candidates, spec.shroud, false);
    }
    world.phase = Phase.Wave;
    world.phaseT = 0;
  }

  function showBanner(text: string, sub: string): void {
    world.banner = text;
    world.bannerSub = sub;
    world.bannerT = 1.5;
  }

  function resolveQuestion(correct: boolean): void {
    if (world.resolved || !world.question) return;
    world.resolved = true;
    const clean = correct && world.firstWrong === null;
    host.report({
      questionId: world.question.id,
      correct: clean,
      ms: Math.round((world.time - world.askedAt) * 1000),
      answered: world.firstWrong ?? (correct ? world.question.answer : ""),
    });
  }

  /* --------------------------------------------------------------- outcomes */

  function onCorrect(h: Husk): void {
    resolveQuestion(true);
    const seconds = world.time - world.askedAt;
    world.combo += 1;
    world.bestCombo = Math.max(world.bestCombo, world.combo);
    const speedBonus = Math.round(100 * clamp(1 - (seconds - 0.9) / 4, 0, 1));
    world.score += (100 + speedBonus) * world.combo;
    world.focus = Math.min(1, world.focus + FOCUS_PER_SOLVE);

    kill(h, true);
    host.haptic("success");
    world.audio.correct(world.combo);
    addTrauma(world.juice, 0.5);
    addHitstop(world.juice, HITSTOP_KILL);
    punch(world.juice, 30);
    flash(world.juice, 0.3, C.white);
    // Slow motion is rationed: on every fifth link of a combo and on the boss,
    // so it always means "that was a big one" and never becomes wallpaper.
    if (world.combo % 5 === 0) slowMotion(world.juice, 0.32, 0.4);

    if (world.boss.active) {
      onBossDamaged();
      return;
    }
    scatterInnocents(h);
    if (world.perfectWave) {
      world.score += 150;
      world.audio.waveClear(world.combo);
    }
    world.phase = Phase.Clear;
    world.phaseT = 0;
  }

  function onWrong(h: Husk): void {
    if (world.firstWrong === null) world.firstWrong = h.label;
    world.combo = 0;
    world.perfectWave = false;
    h.hostile = true;
    h.hp = 3;
    h.mode = Mode.Hostile;
    h.vy = -6;
    h.vx = (h.x < world.ship.x ? 1 : -1) * 14;
    h.shroud = 0;
    h.hitFlash = 1;
    h.squash = 0.7;
    // The rest of the formation takes it personally.
    world.descent *= 1.14;

    host.haptic("failure");
    world.audio.wrong();
    world.audio.hostileWake();
    addTrauma(world.juice, 0.66);
    addHitstop(world.juice, HITSTOP_WRONG);
    punch(world.juice, -22);
    flash(world.juice, 0.24, C.hostile);
    ring(world, h.x, h.y, 0, C.hostile, h.radius, 150, 0.42, 3);
    sparks(world, h.x, h.y, 0, 26, 130, C.hostile, { life: 0.6, size: 1.8 });
    if (world.boss.active) bossVolley(3);
  }

  function kill(h: Husk, big: boolean): void {
    h.mode = Mode.Dying;
    h.dieT = 0;
    h.vx = 0;
    h.vy = 0;
    const color = h.hostile ? C.hostile : C.cyan;
    ring(world, h.x, h.y, 0, C.white, h.radius * 0.6, big ? 230 : 130, big ? 0.42 : 0.3, big ? 3.4 : 2);
    shards(world, h.x, h.y, 0, big ? 20 : 12, big ? 150 : 90, color, big ? 9 : 6);
    sparks(world, h.x, h.y, 0, big ? 42 : 20, big ? 220 : 130, big ? C.white : color, {
      life: big ? 0.7 : 0.45,
      size: big ? 2.1 : 1.4,
    });
    embers(world, h.x, h.y, 0, big ? 12 : 5, color);
  }

  /** The truth destroys the lies: a shockwave throws the innocents apart. */
  function scatterInnocents(source: Husk): void {
    for (const h of world.husks) {
      if (!h.active || h === source || h.mode === Mode.Dying) continue;
      const dx = h.x - source.x;
      const dy = h.y - source.y;
      const dist = Math.max(6, Math.hypot(dx, dy));
      h.mode = Mode.Dying;
      h.dieT = -dist * 0.0022;
      h.vx = (dx / dist) * 130;
      h.vy = (dy / dist) * 130 + 20;
      h.hostile = false;
      world.score += 10;
      sparks(world, h.x, h.y, 0, 10, 90, C.cyan, { life: 0.5, size: 1.3 });
    }
  }

  function dissolveAll(): void {
    for (const h of world.husks) {
      if (!h.active || h.mode === Mode.Dying) continue;
      h.mode = Mode.Dying;
      h.dieT = 0;
      h.vx = world.rng.range(-40, 40);
      h.vy = world.rng.range(-20, 40);
      sparks(world, h.x, h.y, 0, 8, 70, h.hostile ? C.hostile : C.cyan, { life: 0.4 });
    }
  }

  function onBreach(x: number): void {
    resolveQuestion(false);
    world.combo = 0;
    host.haptic("heavy");
    world.audio.breach();
    addTrauma(world.juice, 1);
    addHitstop(world.juice, 0.16);
    punch(world.juice, 46);
    flash(world.juice, 0.34, C.hostile);
    ring(world, x, GATE_Y, 0, C.hostile, 6, 330, 0.6, 4);
    sparks(world, x, GATE_Y, 0, 50, 260, C.hostile, { life: 0.8, size: 2.2, dirX: 0, dirY: 1, spread: 2.4 });
    dissolveAll();
    loseLife();
    if (world.phase === Phase.Wave) {
      world.phase = Phase.Breach;
      world.phaseT = 0;
    }
  }

  function onShipHit(): void {
    const ship = world.ship;
    if (ship.invuln > 0 || !ship.alive) return;
    ship.invuln = 2.2;
    world.combo = 0;
    host.haptic("heavy");
    world.audio.breach();
    addTrauma(world.juice, 0.9);
    addHitstop(world.juice, 0.14);
    punch(world.juice, 38);
    flash(world.juice, 0.3, C.hostile);
    ring(world, ship.x, SHIP_Y, 0, C.hostile, 8, 280, 0.55, 3);
    sparks(world, ship.x, SHIP_Y, 0, 40, 200, C.hostile, { life: 0.7, size: 2 });
    loseLife();
  }

  function loseLife(): void {
    world.lives -= 1;
    if (world.lives > 0) return;
    if (!world.usedSecondWind) startSecondWind();
    else gameOver();
  }

  /* ------------------------------------------------------------ second wind */

  function startSecondWind(): void {
    world.usedSecondWind = true;
    world.lives = 0;
    dissolveAll();
    for (const b of world.bullets) b.active = false;
    world.boss.active = false;
    world.phase = Phase.SecondWind;
    world.phaseT = 0;
    world.descent = 6.5;
    world.swingAmp = 0;
    world.formationY = EQUATION_Y - 62;
    world.ship.invuln = 3;
    world.audio.focus(true);
    slowMotion(world.juice, 0.5, 0.6);
    askQuestion(4, 0, false);
  }

  function onSecondWindWon(h: Husk): void {
    resolveQuestion(true);
    world.lives = 1;
    world.combo = 0;
    kill(h, true);
    scatterInnocents(h);
    world.audio.revive();
    host.haptic("success");
    addTrauma(world.juice, 0.7);
    flash(world.juice, 0.34, C.white);
    punch(world.juice, 44);
    ring(world, 0, SHIP_Y, 0, C.white, 10, 400, 0.75, 4);
    embers(world, 0, SHIP_Y + 20, 0, 24, C.ship);
    showBanner("BACK", "");
    world.phase = Phase.Clear;
    world.phaseT = 0;
  }

  function gameOver(): void {
    world.phase = Phase.Over;
    world.phaseT = 0;
    world.ship.alive = false;
    world.audio.gameOver();
    host.haptic("heavy");
    addTrauma(world.juice, 1);
    slowMotion(world.juice, 0.25, 1.2);
    sparks(world, world.ship.x, SHIP_Y, 0, 60, 240, C.ship, { life: 1.1, size: 2.4 });
    shards(world, world.ship.x, SHIP_Y, 0, 22, 170, C.ship, 10);
    if (world.score > world.best) {
      world.best = world.score;
      saveBest(world.best);
    }
  }

  /* -------------------------------------------------------------- the boss */

  function onBossDamaged(): void {
    const boss = world.boss;
    boss.hp -= 1;
    boss.flash = 1;
    boss.shield = 0;
    boss.y += 10;
    addHitstop(world.juice, HITSTOP_BOSS);
    addTrauma(world.juice, 0.85);
    punch(world.juice, 52);
    slowMotion(world.juice, 0.24, 0.55);
    flash(world.juice, 0.36, C.white);
    world.audio.bossHit(3 - boss.hp);
    host.haptic("heavy");
    ring(world, boss.x, boss.y, 0, C.boss, 20, 300, 0.65, 4);
    sparks(world, boss.x, boss.y, 0, 60, 260, C.boss, { life: 0.9, size: 2.4 });
    shards(world, boss.x, boss.y, 0, 24, 180, C.boss, 12);
    dissolveAll();

    if (boss.hp <= 0) {
      bossFinishing = true;
      boss.dying = 0.001;
      world.score += 1200;
      world.lives = Math.min(MAX_LIVES, world.lives + 1);
      world.audio.bossDown();
      showBanner("ARBITER DOWN", "");
    }
    world.phase = Phase.Clear;
    world.phaseT = 0;
  }

  function bossVolley(count: number): void {
    const boss = world.boss;
    for (let i = 0; i < count; i++) {
      const x = boss.x + (i - (count - 1) / 2) * 26;
      fireBoltAt(world, x, boss.y - 30);
    }
    world.audio.hostileWake();
  }

  /* ------------------------------------------------------------ collisions */

  function collide(): void {
    const ship = world.ship;
    for (const b of world.bullets) {
      if (!b.active) continue;
      if (b.enemy) {
        if (
          ship.alive &&
          Math.abs(b.x - ship.x) < SHIP_HALF_W + 3 &&
          Math.abs(b.y - SHIP_Y) < 11
        ) {
          b.active = false;
          onShipHit();
        }
        continue;
      }
      for (const h of world.husks) {
        if (!h.active || h.mode === Mode.Dying) continue;
        const dx = b.x - h.x;
        const dy = b.y - h.y;
        const r = h.radius + BULLET_R;
        if (dx * dx + dy * dy > r * r) continue;
        b.active = false;
        if (h.hostile) {
          h.hp -= 1;
          h.hitFlash = 1;
          h.squash = 0.6;
          world.audio.hit();
          sparks(world, b.x, b.y, 0, 8, 110, C.hostile, { life: 0.3, size: 1.3 });
          addTrauma(world.juice, 0.12);
          if (h.hp <= 0) {
            world.score += 25;
            kill(h, false);
            host.haptic("light");
            addTrauma(world.juice, 0.3);
            addHitstop(world.juice, 0.04);
          }
        } else if (h.guilty) {
          if (world.phase === Phase.SecondWind) onSecondWindWon(h);
          else onCorrect(h);
        } else {
          onWrong(h);
        }
        break;
      }
      if (!b.active) continue;
      // The Arbiter's hull simply eats bullets. Only the truth gets through.
      if (world.boss.active && world.boss.dying === 0) {
        const dx = b.x - world.boss.x;
        const dy = b.y - world.boss.y;
        if (dx * dx + dy * dy < 46 * 46) {
          b.active = false;
          world.boss.shield = Math.min(1, world.boss.shield + 0.25);
          sparks(world, b.x, b.y, 0, 5, 80, C.boss, { life: 0.25, size: 1.1 });
          world.audio.hit();
        }
      }
    }

    // Hostiles ram the ship; anything that crosses the gate is a life.
    let lowest = VIEW_HALF_H;
    for (const h of world.husks) {
      if (!h.active || h.mode === Mode.Dying) continue;
      if (h.mode !== Mode.Orbit) lowest = Math.min(lowest, h.y);
      if (
        ship.alive &&
        h.hostile &&
        Math.abs(h.x - ship.x) < h.radius + SHIP_HALF_W &&
        Math.abs(h.y - SHIP_Y) < h.radius + 9
      ) {
        kill(h, false);
        onShipHit();
        continue;
      }
      if (h.mode !== Mode.Orbit && h.y - h.radius * 0.35 < GATE_Y) {
        onBreach(h.x);
        return;
      }
    }
    if (world.boss.active && world.boss.dying === 0 && world.boss.y - 44 < GATE_Y) {
      world.boss.y = EQUATION_Y - 46;
      onBreach(world.boss.x);
      return;
    }
    const span = EQUATION_Y - GATE_Y;
    world.gateDanger = clamp(1 - (lowest - GATE_Y) / (span * 0.42), 0, 1);
  }

  /* ------------------------------------------------------------ the update */

  function update(realDt: number): void {
    const dt = stepJuice(world.juice, realDt);
    world.time += realDt;
    world.phaseT += realDt;
    world.bannerT = Math.max(0, world.bannerT - realDt);
    world.displayScore = damp(world.displayScore, world.score, 9, realDt);
    world.audio.tick(realDt);
    world.audio.setTimeScale(world.juice.timeScale);
    world.audio.setIntensity(
      clamp(world.gateDanger * 0.6 + Math.min(1, world.wave / 14) * 0.4 + world.combo * 0.02, 0, 1),
    );

    if (world.focusT > 0) {
      world.focusT = Math.max(0, world.focusT - realDt);
      if (world.focusT === 0) world.audio.focus(false);
    }

    // Keyboard steering rides on top of the pointer target.
    const axis = input.axis();
    if (axis !== 0) {
      world.ship.targetX = clamp(
        world.ship.targetX + axis * SHIP_MAX_SPEED * realDt,
        -world.cam.playHalfW - 6,
        world.cam.playHalfW + 6,
      );
    }
    if (bot) bot(realDt);

    updateShip(world, dt, realDt);
    stepBullets(world, dt);
    stepParticles(world, dt);

    const playing = world.phase === Phase.Wave || world.phase === Phase.SecondWind;

    if (playing) {
      // The last stretch is the fastest: once the formation is in the gate's
      // shadow it dives. Every wave gets a heartbeat ending instead of a
      // constant slide, and the player feels the deadline without a timer.
      const urgent = world.formationY < GATE_Y + URGENCY_BAND;
      world.formationY -= world.descent * (urgent ? URGENCY_MULTIPLIER : 1) * dt;
      world.swingPhase += dt * world.swingFreq;
      world.swingPhaseX = Math.sin(world.swingPhase * Math.PI * 2) * world.swingAmp;
    }

    if (world.boss.active) {
      const boss = world.boss;
      boss.spin += dt * 0.55;
      boss.flash = Math.max(0, boss.flash - realDt * 2.6);
      boss.shield = Math.min(1, boss.shield + dt * 0.35);
      if (boss.dying > 0) {
        boss.dying += realDt;
        if (world.rng.nextFloat() < realDt * 22) {
          sparks(
            world,
            boss.x + world.rng.range(-40, 40),
            boss.y + world.rng.range(-30, 30),
            world.rng.range(-20, 20),
            6,
            190,
            C.boss,
            { life: 0.8, size: 2 },
          );
        }
      } else if (world.phase === Phase.Wave) {
        boss.y -= 3.4 * dt;
        boss.volleyCd -= dt;
        if (boss.volleyCd <= 0) {
          boss.volleyCd = 4.6;
          bossVolley(2);
        }
      }
    }

    for (const h of world.husks) {
      if (!h.active) continue;
      updateHusk(world, h, dt);
    }

    if (playing) collide();

    if (world.phase === Phase.Clear && world.phaseT > (bossFinishing ? 1.9 : WAVE_GAP)) {
      advance();
    }
    if (world.phase === Phase.Breach && world.phaseT > 1) {
      if (world.lives > 0) advance();
    }
    if (world.phase === Phase.Title) {
      idleDrift(realDt);
    }

    // Adaptive quality: hold 60 by thinning the fireworks, never the game.
    const ms = world.frameMs;
    if (ms > 20.5 && world.quality > 0.45) world.quality = Math.max(0.45, world.quality - realDt * 0.9);
    else if (ms < 14 && world.quality < 1) world.quality = Math.min(1, world.quality + realDt * 0.25);
  }

  function advance(): void {
    if (bossFinishing) {
      bossFinishing = false;
      world.boss.active = false;
      world.boss.dying = 0;
      world.wave += 1;
      startWave();
      return;
    }
    if (world.boss.active && world.boss.hp > 0) {
      askQuestion(specFor(world.wave).candidates, 0, true);
      world.phase = Phase.Wave;
      world.phaseT = 0;
      return;
    }
    world.wave += 1;
    startWave();
  }

  /** Attract mode: husks sink through the title and dissolve at the gate. */
  let idleT = 0.2;
  function idleDrift(dt: number): void {
    idleT -= dt;
    if (idleT <= 0) {
      idleT = 1.15;
      const h = freeHusk(world);
      if (h) {
        resetHusk(h);
        h.mode = Mode.Drift;
        h.label = String(world.rng.int(0, 99));
        h.guilty = false;
        h.lane = world.rng.range(-world.cam.playHalfW * 0.9, world.cam.playHalfW * 0.9);
        h.row = 0;
        h.spin = world.rng.range(0, 6.28);
        h.spinV = world.rng.range(-1, 1);
        h.tiltV = world.rng.range(-0.4, 0.4);
        h.wob = world.rng.range(0, 6);
        h.x = h.lane;
        h.y = VIEW_HALF_H + 24;
      }
    }
    for (const h of world.husks) {
      if (h.active && h.mode === Mode.Drift && h.y < GATE_Y + 6) kill(h, false);
    }
  }

  /* -------------------------------------------------------------- the draw */

  const drawOrder: Husk[] = [];

  function render(): void {
    const { cam, juice } = world;
    const amt = shakeAmount(juice);
    // Smooth two-frequency shake instead of white noise: it reads as a camera
    // on a boom being hit, not as a loose cable.
    const t = world.time;
    cam.shakeX = (Math.sin(t * 47.3) * 0.65 + Math.sin(t * 28.1) * 0.35) * amt * 30;
    cam.shakeY = (Math.sin(t * 41.7 + 1.3) * 0.6 + Math.sin(t * 33.9) * 0.4) * amt * 24;
    cam.roll = Math.sin(t * 25.1) * amt * 0.035;
    cam.z = CAM_Z + juice.punch;
    cam.x = damp(cam.x, world.ship.x * 0.12, 5, 1 / 60);
    beginFrame(cam);

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    drawBackground(world);
    drawFloor(world);

    world.batch.reset();
    if (world.boss.active) drawBoss(world);
    if (world.phase !== Phase.Title && world.phase !== Phase.Over) {
      drawSight(world, world.ship.settled > 0.05 ? findTarget(world) : null);
    }
    drawBullets(world);

    // Husks back to front so the wireframes overlap correctly. Insertion sort
    // into a reused array: at most fourteen elements, already nearly ordered,
    // and it allocates nothing.
    let n = 0;
    for (const h of world.husks) {
      if (!h.active) continue;
      let i = n++;
      while (i > 0 && (drawOrder[i - 1] as Husk).z > h.z) {
        drawOrder[i] = drawOrder[i - 1] as Husk;
        i--;
      }
      drawOrder[i] = h;
    }
    for (let i = 0; i < n; i++) drawHusk(world, drawOrder[i] as Husk);
    drawShip(world);

    ctx.globalCompositeOperation = "lighter";
    world.batch.flush(ctx);
    drawParticles(world);
    world.batch.flush(ctx);
    ctx.globalCompositeOperation = "source-over";

    if (world.phase !== Phase.Title && world.phase !== Phase.Over) drawEquation(world);
    drawVignette(world, vignette);

    if (juice.flash > 0.002) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = juice.flashColor;
      ctx.globalAlpha = juice.flash;
      ctx.fillRect(0, 0, world.w, world.h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    if (world.phase === Phase.Title) drawTitle(world);
    else if (world.phase === Phase.Over) drawGameOver(world);
    else {
      if (world.phase === Phase.SecondWind) drawSecondWind(world);
      drawHud(world);
    }
  }

  /* -------------------------------------------------------------- the loop */

  let raf = 0;
  let last = performance.now();
  let running = true;

  function frame(now: number): void {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const realDt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000));
    last = now;
    // The manual freezes the trench. A child who went to read the rules must
    // not come back to a life they lost while reading them.
    if (world.paused || guide.isOpen) return;

    const t0 = performance.now();
    update(realDt);
    render();
    // `frameMs` is the cost of *our* work, which is what quality should react
    // to; `fpsSamples` is wall-clock delta between presented frames, which is
    // what a player actually experiences. They are not the same number and the
    // stats overlay reports the second one.
    world.frameMs = world.frameMs * 0.88 + (performance.now() - t0) * 0.12;
    world.fpsSamples.push(now - lastSample);
    lastSample = now;
    if (world.fpsSamples.length > 120) world.fpsSamples.shift();
  }
  let lastSample = performance.now();

  /* ------------------------------------------------------------ start/stop */

  function begin(): void {
    void world.audio.resume();
    if (world.phase === Phase.Title || world.phase === Phase.Over) {
      for (const h of world.husks) h.active = false;
      for (const b of world.bullets) b.active = false;
      world.wave = 1;
      world.lives = START_LIVES;
      world.score = 0;
      world.displayScore = 0;
      world.combo = 0;
      world.bestCombo = 0;
      world.focus = 0;
      world.focusT = 0;
      world.usedSecondWind = false;
      world.ship.alive = true;
      world.ship.invuln = 1.2;
      world.ship.x = 0;
      world.ship.targetX = 0;
      bossFinishing = false;
      startWave();
    }
  }

  function spendFocus(): void {
    if (world.phase === Phase.Title || world.phase === Phase.Over) {
      begin();
      return;
    }
    if (world.focus < 1 || world.focusT > 0) return;
    world.focus = 0;
    world.focusT = FOCUS_DURATION;
    slowMotion(world.juice, FOCUS_TIME_SCALE, FOCUS_DURATION);
    world.audio.focus(true);
    host.haptic("medium");
    ring(world, world.ship.x, SHIP_Y, 0, C.plankton, 8, 460, 0.7, 3);
    flash(world.juice, 0.16, C.plankton);
    embers(world, world.ship.x, SHIP_Y, 0, 16, C.plankton);
  }

  const input = attachInput(canvas, world, {
    // `guide` is declared below; this is only ever called from a DOM event, so
    // it is read long after the whole mount has finished.
    blocked: () => guide.isOpen,
    onStart: begin,
    onFocus: spendFocus,
    onToggleMute: () => world.audio.setMuted(!world.audio.muted()),
    onTogglePause: () => {
      world.paused = !world.paused;
      last = performance.now();
    },
    onToggleStats: () => {
      world.showStats = !world.showStats;
    },
  });

  /* ------------------------------------------------------- how to play */
  //
  // GUILTY shipped with no rules anywhere. A child was shown a trench, four
  // sinking shapes with numbers on them, and the word GUILTY — and the rule
  // that makes the game a maths game rather than a shooting game, that three of
  // those four numbers are mistakes somebody really makes and you must destroy
  // only the true one, was never stated. Shooting an innocent turns it hostile,
  // which reads as the game being unfair rather than as a punishment for
  // guessing.
  //
  // The panel stays reachable during play, and opening it freezes the descent:
  // a child who goes to read the rules must not lose a life while reading them.
  const guide = createInstructions(el, {
    title: "GUILTY",
    summary: [
      "A sum hangs over the trench. Four shells sink out of it, each with a different answer on it.",
      "Only one answer is right. Shoot that one. Shoot a wrong one and it turns on you.",
    ],
    sections: [
      {
        heading: "How to play",
        lines: [
          "Read the sum at the top and work out the answer yourself.",
          "Four shells sink towards the line above your ship. Each shell carries a number.",
          "Find the shell with your answer on it and shoot it. The other three scatter and you are safe.",
          "Do not let a shell reach the line. If one crosses it, you lose a life.",
        ],
      },
      {
        heading: "The wrong answers are real mistakes",
        lines: [
          "The three wrong numbers are not random. Each one is what you get if you make a mistake people really make.",
          "So a wrong number can look very close to the right one. Work the sum out properly instead of picking the one that looks about right.",
          "Shoot a wrong shell and it turns red and starts shooting back. That is why guessing is a bad plan.",
        ],
      },
      {
        heading: "Moving and shooting",
        lines: [
          "On a touch screen, drag anywhere to steer. Your finger does not have to be on the ship, so your hand never covers what you are aiming at.",
          "With a mouse, just move it. The ship follows the pointer.",
          "The arrow keys and A and D work too.",
          "Your gun fires by itself. It stops while you are sliding fast and starts again the moment you settle, so aim first, then hold still.",
        ],
      },
      {
        heading: "Deep focus",
        lines: [
          "Every right answer fills the thin bar along the bottom of the screen.",
          "When it is full, tap once quickly, or press the space bar, to slow the whole trench down.",
          "Use it when the shells are close to the line and you need a moment to think.",
        ],
      },
      {
        heading: "Waves and lives",
        lines: [
          "You start with three lives. Clear a wave and the next one sinks faster.",
          "Every sixth wave is a big one.",
          "Get a lot right in a row and each one is worth more.",
        ],
      },
      {
        heading: "Keyboard",
        lines: [
          "Left and right arrows, or A and D, steer.",
          "Space uses deep focus. M turns the sound off. P pauses.",
        ],
      },
    ],
    onClose: (): void => {
      last = performance.now();
    },
    reducedMotion: reduced,
  });

  /* --------------------------------------------------------------- the bot */

  let bot: ((dt: number) => void) | null = null;
  if (params.has("bot")) {
    const skill = Number(params.get("bot")) || 1;
    bot = makeBot(world, skill, begin, spendFocus);
  }
  if (params.has("wave")) {
    world.wave = Math.max(1, Number(params.get("wave")) || 1);
    begin();
  }

  raf = requestAnimationFrame(frame);

  return {
    stats: () => frameStats(world),
    unmount() {
      running = false;
      cancelAnimationFrame(raf);
      guide.destroy();
      stopInsets();
      input.detach();
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      world.audio.dispose();
      clearGlyphCache();
      canvas.remove();
    },
  };
}

/* ------------------------------------------------------------------ helpers */

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* private mode, or a sandboxed webview */
  }
}

/**
 * A deterministic autoplayer. It exists for QA — it drives the *real* input
 * surface (a target x and the focus button), never a private hook, so anything
 * it proves is true of a human playing.
 */
function makeBot(
  world: World,
  skill: number,
  begin: () => void,
  spendFocus: () => void,
): (dt: number) => void {
  let think = 0;
  let started = false;
  return (dt: number) => {
    if (!started) {
      started = true;
      begin();
    }
    if (world.phase === Phase.Over) {
      begin();
      return;
    }
    think -= dt;
    let target: Husk | null = null;
    let threat: Husk | null = null;
    for (const h of world.husks) {
      if (!h.active || h.mode === Mode.Dying) continue;
      if (h.hostile) {
        if (!threat || h.y < threat.y) threat = h;
      } else if (h.guilty) target = h;
    }
    // A deliberately imperfect bot: at skill < 1 it sometimes indicts a
    // neighbour, which is how the failure states get exercised.
    if (skill < 1 && think <= 0) {
      think = 2.5;
      if (world.rng.nextFloat() > skill) {
        for (const h of world.husks) {
          if (h.active && !h.guilty && !h.hostile && h.mode !== Mode.Dying) {
            target = h;
            break;
          }
        }
      }
    }
    const aim = threat && threat.y < 20 ? threat : target;
    if (aim) {
      // Lead the shot. In formation a husk's x is driven by the swing, not by
      // its own velocity, so the lead comes from the swing's derivative.
      const swingV =
        aim.mode === Mode.Formation
          ? Math.cos(world.swingPhase * Math.PI * 2) * world.swingAmp * world.swingFreq * Math.PI * 2
          : aim.vx;
      const flight = Math.max(0, (aim.y - SHIP_Y) / 560);
      world.ship.targetX = aim.x + swingV * flight;
    }
    if (world.focus >= 1 && world.rng.nextFloat() < dt * 0.6) spendFocus();
  };
}
