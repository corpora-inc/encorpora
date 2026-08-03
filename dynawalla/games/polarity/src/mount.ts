import styles from "./ui/styles.css?inline";
import {
  createInstructions,
  onInsetsChange,
  safeInsets,
} from "../../../packs/shared/game-chrome/index.ts";
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
    onSkipRevive: (answered) => {
      if (reviveQ) {
        // What the child touched, not an empty string. A wrong answer a child
        // gave is data; a blank is a claim they gave none, and it is false.
        host.report({
          questionId: reviveQ.id,
          correct: false,
          ms: Math.max(1, Math.round(performance.now() - reviveAt)),
          answered,
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

  // --- how to play ----------------------------------------------------------
  //
  // The title card says "MATCH A BULLET'S SIGN TO DRINK IT. YOUR TOTAL IS THE
  // WEAPON. VENT IT AT THE EDGE." — which is exactly right and completely
  // opaque to a nine-year-old, and it is gone the instant they press PLAY.
  // Nothing anywhere said that an orb of the wrong sign passes straight
  // through you, or that the last shield buys one question rather than ending
  // the run. The manual stays behind the how-to-play button for the whole
  // session, because the moment a child needs the rules is never the title.
  const guide = createInstructions(root, {
    title: "POLARITY",
    summary: [
      "Your ship has a sign: plus or minus. Drink every bullet that has the same sign as you.",
      "The numbers you drink add up. Fire that total back out before it gets too big.",
    ],
    sections: [
      {
        heading: "Moving and flipping",
        lines: [
          "Drag your finger on the screen. The ship follows your finger.",
          "Tap FLIP to change your sign from plus to minus, or back again.",
          "Flip just as a bullet is about to hit you and the screen says CLUTCH. The bullet turns into food instead of hurting you.",
          "On a keyboard: arrow keys or W, A, S, D to move, SPACE to flip, SHIFT to fire your total back out.",
        ],
      },
      {
        heading: "Matching signs",
        lines: [
          "Every bullet has a number on it, like +3 or −5.",
          "A bullet with your sign is food. Fly into it and you drink it.",
          "A bullet with the other sign hurts you. Flip your sign, or get out of the way.",
          "A bullet marked 0 is safe either way.",
        ],
      },
      {
        heading: "Your total",
        lines: [
          "The big number at the top is your total. Drinking +3 adds 3. Drinking −5 takes 5 away.",
          "The bar under it grows right for plus and left for minus.",
          "The numbers at the ends of the bar are your limit. It starts at 20 each way.",
          "Go past the limit and the ship overloads: you lose the whole total and cannot move for a moment.",
          "Keep drinking without being hit and the small × number climbs. It multiplies your score.",
        ],
      },
      {
        heading: "Venting",
        lines: [
          "Tap VENT to fire your whole total back out as darts that chase enemies. To vent is to let it all out at once.",
          "A bigger total makes more darts. A total smaller than 3 does nothing at all.",
          "The bar turns red when you are near the limit. That is the moment to vent.",
          "Vent right at the limit and you get a PERFECT: three times the points and twice the damage.",
          "If the screen says VENT EXACTLY, a big enemy wants one exact total. Drink until your number is that number, then vent.",
        ],
      },
      {
        heading: "The orbs",
        lines: [
          "Now and then a large enemy floats in with a math problem written on it.",
          "It drops four orbs. Each orb holds a number, and one of them is the answer.",
          "An orb only touches you if its sign matches yours. Orbs of the other sign pass straight through you.",
          "So set your sign first, then fly into the orb you picked. A wrong orb blows up and costs a shield.",
          "The screen calls each of these questions a seal. SEALS 4/6 means six were asked and you got four right, and SEAL BROKEN means you have just got one.",
          "STRATUM at the top is how many you have got right in all. It is how deep you have gone.",
        ],
      },
      {
        heading: "Shields, and coming back",
        lines: [
          "The three small diamonds near the top are your shields.",
          "Being hit costs one shield, halves your total and ends your streak.",
          "When the last shield goes you get one question. That screen says REPOLARIZE, which just means getting your sign working again.",
          "Answer it right and you come back with every shield and a blast that clears the screen.",
          "Answer it wrong and the run is over.",
        ],
      },
    ],
    reducedMotion: host.prefersReducedMotion(),
  });

  // --- sizing ---------------------------------------------------------------
  let cssW = 1;
  let cssH = 1;
  function measure(): void {
    // Read every time, never cached from construction: a rotation trades one top
    // inset for two side ones, and iPadOS changes them when the pack is resized
    // in Split View. Read once at mount and the register is correct until the
    // first rotation and wrong after it.
    hud.setInsets(safeInsets());
    const r = root.getBoundingClientRect();
    cssW = Math.max(1, Math.round(r.width));
    cssH = Math.max(1, Math.round(r.height));
    setAspect(world, cssH / cssW);
    renderer.resize(cssW, cssH);
  }
  const ro = new ResizeObserver(() => measure());
  ro.observe(root);
  // The insets can move without the frame moving: the host publishes its
  // measurement over the `settings` channel, and a tablet's Split View changes
  // them outright. Without this the register keeps the shape the pack opened in.
  const stopInsets = onInsetsChange(() => measure());
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

    // Reading the rules is not playing. With the manual open the field holds
    // its shape, no bullet moves, and the finger resting on the panel is not a
    // steer — a child who looks something up must not be killed for it.
    const reading = guide.isOpen;

    if (!paused && !reading) {
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
    renderer.draw(world, paused || reading ? 0 : dt);

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
      stopInsets();
      saveSeen(world.cues);
      saveBest(world.stats.best);
      input.dispose();
      guide.destroy();
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
