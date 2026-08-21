/**
 * Standalone dev entry.
 *
 * `npm run dev` gives a real, complete, playable game with no Dynawalla runtime
 * underneath it — the stub host supplies the questions and swallows the
 * reports. When the runtime lands, this file is the only thing that changes.
 *
 * Query parameters, for verification rather than for players:
 *   ?tier=low|mid|high|ultra   pin the quality tier
 *   ?stats=1                   fps, worst frame, input latency, draw calls
 *   ?seed=12345                reproduce an exact run
 */
import { mount } from "./contract.ts";
import { createStubHost } from "./stubHost.ts";

const el = document.getElementById("game");
if (!el) throw new Error("#game not found");

const params = new URLSearchParams(location.search);
const seedParam = Number(params.get("seed") ?? 0);
const verbose = params.get("log") === "1";

const host = createStubHost({
  seed: seedParam || undefined,
  onReport: verbose
    ? (r) => console.info(`[host] ${r.questionId} ${r.correct ? "OK " : "MISS"} ${r.answered} (${r.ms}ms)`)
    : undefined,
});

const instance = mount(el, host);

// Vite HMR: tear the game down properly rather than stacking WebGL contexts.
if (import.meta.hot) {
  import.meta.hot.dispose(() => instance.unmount());
}
