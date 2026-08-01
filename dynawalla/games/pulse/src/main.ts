/**
 * Standalone dev entry. `npm run dev` and the game is playable with the local stub
 * host — no curriculum package, no engine package, no app shell.
 *
 * Haptics degrade silently: in the shipped app the host routes `haptic()` to
 * `tauri-plugin-haptics`; here it is `navigator.vibrate` where that exists and
 * nothing at all where it does not.
 */

import {
  MODE_IDS,
  pickSoundscape,
  setHostSoundscape,
} from "../../../packs/shared/game-soundscape/index.ts";
import { mount } from "./mount.ts";
import { createStubHost } from "./stubHost.ts";

const VIBE: Record<string, number | number[]> = {
  light: 8,
  medium: 16,
  heavy: [24, 18, 30],
  success: [12, 24, 12],
  failure: [34, 40, 34],
};

const root = document.getElementById("root");
if (!root) throw new Error("pulse: #root missing");

const params = new URLSearchParams(location.search);

// ── The soundscape, in the harness only ─────────────────────────────────────
//
// The real app publishes one and `game-host` forwards it, so the shipped pack
// is told which key the bazaar is in. Here there is no app, so the harness
// publishes one — and PULSE reads it as RHYTHM: the chart's probability matrix
// is built from the mode (`game/chart.ts` → `packs/shared/game-soundscape/groove.ts`).
// `?mode=maqam.rast` pins one and `?scape=<n>` draws a specific seed, which is
// how one groove can be listened to twice. `?soundscape=off` is the A/B.
if (params.get("soundscape") !== "off") {
  const seed = Number(params.get("scape") ?? Math.floor(Math.random() * 0xffffffff));
  const drawn = pickSoundscape(Number.isFinite(seed) ? seed : 1);
  const wanted = params.get("mode");
  const scape = wanted && MODE_IDS.includes(wanted) ? { ...drawn, modeId: wanted } : drawn;
  setHostSoundscape(scape);
  console.info(`[pulse] soundscape ${scape.modeId}, seed ${scape.seed}`);
}

const host = createStubHost({
  seed: params.get("seed") ?? "pulse-dev",
  startDifficulty: Number(params.get("difficulty") ?? "0.12"),
  haptic(kind) {
    if (typeof navigator.vibrate === "function") navigator.vibrate(VIBE[kind] ?? 8);
  },
  onReport(r) {
    if (params.has("log")) console.info("[pulse] report", r);
  },
});

document.documentElement.style.height = "100%";
document.body.style.height = "100%";
document.body.style.margin = "0";
document.body.style.background = "#04050a";
root.style.position = "fixed";
root.style.inset = "0";

mount(root, host, {
  ignoreVisibility: params.has("nopause"),
  startStage: params.has("stage") ? Number(params.get("stage")) : 0,
});

// QA harness. Never reachable from `mount()`, only from this dev entry.
if (params.has("bot") || params.has("qa")) {
  void import("./dev/bot.ts").then(({ attachBot, burst }) => {
    const g = window as unknown as {
      __PULSE__?: Record<string, unknown> & { run: never; start?: () => void };
    };
    const api = g.__PULSE__;
    if (!api) return;
    api.start?.();
    const bot = params.has("bot")
      ? attachBot(api.run, {
          skill: Number(params.get("bot") ?? "0.9"),
          biasMs: Number(params.get("bias") ?? "0"),
        })
      : null;
    api.bot = bot;
    api.burst = (ms: number, o: Parameters<typeof burst>[3] = {}) =>
      burst(api as unknown as Parameters<typeof burst>[0], bot, ms, {
        canvas: root.querySelector("canvas") as HTMLCanvasElement,
        ...o,
      });
  });
}
