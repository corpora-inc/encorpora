/**
 * Dev harness entry point. The shipped runtime will call `mount(el, host)`
 * itself; this file only exists so `npm run dev` gives a real, playable game.
 *
 * Query parameters, all QA-only:
 *   ?seed=N        deterministic presentation RNG
 *   ?stats         frame-time overlay (also toggled with `)
 *   ?bot=0.9       autoplay at the given accuracy, for screenshots and soak
 *   ?wave=12       start at a wave, to reach escalation without playing there
 *   ?d=0.8         start the question ladder at this difficulty
 */

import { createDevHost } from "./devHost.ts";
import { mount } from "./game/game.ts";

const params = new URLSearchParams(location.search);
const el = document.getElementById("stage");
if (!el) throw new Error("#stage missing");

const reports: Array<{ questionId: string; correct: boolean; ms: number; answered: string }> = [];
const host = createDevHost({
  seed: Number(params.get("seed")) || undefined,
  difficulty: Number(params.get("d")) || undefined,
  onReport: (r) => {
    reports.push(r);
    if (reports.length > 200) reports.shift();
  },
});

const handle = mount(el, host);

// A tiny surface for the QA driver: no gameplay hook, just read-only telemetry.
Object.assign(window as unknown as Record<string, unknown>, {
  __guilty: {
    reports: () => reports,
    stats: () => handle.stats(),
    unmount: () => handle.unmount(),
  },
});
