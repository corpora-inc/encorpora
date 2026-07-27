import styles from "./ui/styles.css?inline";
import type { Host, Question } from "./contract.ts";
import { TierMonitor, detectTier } from "./core/tier.ts";
import { clamp01 } from "./core/util.ts";
import { Audio } from "./audio/audio.ts";
import { EK } from "./game/constants.ts";
import { endRun, flip, release, revive, startRun, step } from "./game/sim.ts";
import type { Enemy } from "./game/types.ts";
import { cue, makeWorld, repool, setAspect } from "./game/world.ts";
import { Input } from "./input/input.ts";
import { Renderer } from "./render/renderer.ts";
import { Hud } from "./ui/hud.ts";

const BEST_KEY = "polarity.best.v1";
// `gitleaks:allow` — the pinned scanner's `generic-api-key` rule reads
// `KEY = "<dotted string>"` as a credential once the value clears its entropy
// floor, which this one does on length alone while `polarity.best.v1` next door
// does not. It is a localStorage path on the client, in a deliberately public
// repo. Same call, and same comment, as dynawalla/games/forge/src/game/save.ts.
const SEEN_SLOT = "polarity.seen.v1"; // gitleaks:allow

let styleTag: HTMLStyleElement | null = null;
function ensureStyles(): void {
  if (styleTag?.isConnected) return;
  styleTag = document.createElement("style");
  styleTag.dataset.polarity = "1";
  styleTag.textContent = styles;
  document.head.appendChild(styleTag);
}

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? "0") || 0;
  } catch (e) {
    console.warn("[polarity] best score unreadable", e);
    return 0;
  }
}
function saveBest(n: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(n)));
  } catch (e) {
    console.warn("[polarity] best score not saved", e);
  }
}
function loadSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_SLOT) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function saveSeen(s: Set<string>): void {
  try {
    localStorage.setItem(SEEN_SLOT, JSON.stringify([...s]));
  } catch (e) {
    console.warn("[polarity] cue memory not saved", e);
  }
}

export function mount(el: HTMLElement, host: Host): { unmount(): void } {
  ensureStyles();
  const root = document.createElement("div");
  root.className = "pol-root";
  root.dataset.pol = "1";
  el.appendChild(root);

  const tier0 = detectTier();
  const world = makeWorld(host, tier0, (Date.now() ^ 0x9e37) >>> 0);
  world.stats.best = loadBest();
  for (const k of loadSeen()) world.cues.add(k);

  const renderer = new Renderer(root, tier0);
  const audio = new Audio();
  let paused = false;
  let reviveQ: Question | null = null;
  let reviveAt = 0;

  const monitor = new TierMonitor(
    tier0,
    (t) => {
      repool(world, t);
      renderer.setTier(t);
    },
    tier0.name,
  );

  const hud = new Hud(root, {
    onFlip: () => {
      audio.resume();
      flip(world);
    },
    onVent: () => {
      audio.resume();
      release(world);
    },
    onStart: () => {
      audio.resume();
      hud.hideVeil();
      startRun(world);
    },
    onAgain: () => {
      audio.resume();
      hud.hideVeil();
      startRun(world);
    },
    onRevive: (answered) => {
      if (reviveQ) {
        host.report({
          questionId: reviveQ.id,
          correct: true,
          ms: Math.max(1, Math.round((performance.now() - reviveAt))),
          answered,
        });
        world.stats.asked++;
        world.stats.right++;
      }
      reviveQ = null;
      hud.hideVeil();
      revive(world);
      audio.sealWon();
    },
    onSkipRevive: () => {
      if (reviveQ) {
        host.report({
          questionId: reviveQ.id,
          correct: false,
          ms: Math.max(1, Math.round(performance.now() - reviveAt)),
          answered: "",
        });
        world.stats.asked++;
      }
      reviveQ = null;
      audio.sealWrong();
      host.haptic("failure");
      finish();
    },
    onToggleSound: () => {
      audio.resume();
      const on = !audio.enabled;
      audio.setEnabled(on);
      audio.setMusic(on);
      hud.setSound(on);
      if (on) audio.ui("tap");
    },
    onTogglePause: () => {
      if (world.phase !== "play" && !paused) return;
      paused = !paused;
      if (paused) hud.showPause();
      else hud.hideVeil();
      audio.ui("tap");
    },
  });
  hud.setSound(true);

  const input = new Input(root, world, {
    onPause: () => {
      if (world.phase === "play" || paused) {
        paused = !paused;
        if (paused) hud.showPause();
        else hud.hideVeil();
      }
    },
    onAnyInput: () => audio.resume(),
    isBlocked: () => hud.blocked(),
  });

  function finish(): void {
    endRun(world);
    saveBest(world.stats.best);
    hud.showOver(world);
  }

  // --- events -> sound + haptics --------------------------------------------
  function drain(): void {
    const ev = world.events;
    for (let i = 0; i < ev.length; i++) {
      switch (ev[i]) {
        case "absorb":
          audio.absorb(world.chain, world.pol, false);
          break;
        case "absorb-big":
          audio.absorb(world.chain, world.pol, true);
          break;
        case "flip":
          audio.flip(world.pol);
          break;
        case "clutch":
          audio.clutch();
          break;
        case "release":
          audio.release(false);
          break;
        case "perfect":
          audio.release(true);
          break;
        case "fizzle":
          audio.ui("tap");
          break;
        case "overload":
          audio.overload();
          break;
        case "hurt":
          audio.hurt();
          break;
        case "weak":
          audio.hitEnemy(true);
          break;
        case "seal-won":
        case "lock-exact":
          audio.sealWon();
          break;
        case "seal-wrong":
          audio.sealWrong();
          break;
        case "lock-near":
          audio.ui("big");
          break;
        case "bearer":
        case "warden":
        case "lock-open":
          audio.bossIn();
          break;
        case "boss-down":
          audio.kill(true);
          hud.banner_("SEAL BROKEN");
          break;
        case "stratum":
          audio.stratum();
          hud.banner_(`STRATUM ${world.stratum}`);
          break;
        case "death":
          audio.kill(true);
          audio.hurt();
          break;
        case "revive-offer":
          offerRevive();
          break;
        default:
          break;
      }
    }
    ev.length = 0;
  }

  function offerRevive(): void {
    if (world.bank <= 0) {
      finish();
      return;
    }
    try {
      reviveQ = host.next({ difficulty: 0.2 });
    } catch (e) {
      console.error("[polarity] host.next failed on revive", e);
      finish();
      return;
    }
    reviveAt = performance.now();
    const opts = [reviveQ.answer, ...reviveQ.distractors.slice(0, 2)];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = world.rng.i(0, i);
      const a = opts[i] as string;
      opts[i] = opts[j] as string;
      opts[j] = a;
    }
    hud.showRevive(reviveQ.prompt, opts, reviveQ.answer);
  }

  // --- sizing ---------------------------------------------------------------
  let cssW = 1;
  let cssH = 1;
  function measure(): void {
    const r = root.getBoundingClientRect();
    cssW = Math.max(1, Math.round(r.width));
    cssH = Math.max(1, Math.round(r.height));
    setAspect(world, cssH / cssW);
    renderer.resize(cssW, cssH);
  }
  const ro = new ResizeObserver(() => measure());
  ro.observe(root);
  measure();

  // --- loop -----------------------------------------------------------------
  let raf = 0;
  let last = performance.now();
  let ventCued = false;
  let running = true;

  const frame = (now: number): void => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const t0 = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 1 / 60; // a backgrounded tab must not teleport the world
    dt = Math.min(dt, 0.05);

    world.reduced = host.prefersReducedMotion();

    if (!paused) {
      input.step(dt);
      step(world, dt);
      drain();

      if (world.phase === "play") {
        if (!ventCued && Math.abs(world.core) >= 8) {
          ventCued = true;
          cue(world, "release");
        }
        audio.setIntensity(clamp01(world.stratum / 10) * 0.6 + clamp01(world.chain / 40) * 0.4);
      }
      if (world.phase === "title") hud.showTitle(world.stats.best);
    }

    hud.update(world, Math.abs(world.core) >= world.cap - 4);
    renderer.draw(world, paused ? 0 : dt);

    monitor.sample(performance.now() - t0, dt);
  };
  raf = requestAnimationFrame(frame);

  const onVis = (): void => {
    if (document.hidden && world.phase === "play" && !paused) {
      paused = true;
      hud.showPause();
    }
  };
  document.addEventListener("visibilitychange", onVis);

  hud.showTitle(world.stats.best);

  return {
    unmount(): void {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
      saveSeen(world.cues);
      saveBest(world.stats.best);
      input.dispose();
      hud.dispose();
      renderer.dispose();
      audio.dispose();
      root.remove();
    },
  };
}

/** Exposed for the shell: the boss currently holding a question, if any. */
export const activeSealHost = (enemies: Enemy[], n: number, serial: number): Enemy | null => {
  for (let i = 0; i < n; i++) {
    const e = enemies[i] as Enemy;
    if (e.seal === serial && (e.kind === EK.Bearer || e.kind === EK.Warden)) return e;
  }
  return null;
};
