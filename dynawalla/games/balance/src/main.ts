// Standalone dev shell. Not shipped: the app mounts `mount(el, host)` with the
// real host. Everything here exists so the game is playable, and drivable by a
// playtest harness, on its own.

import { mount } from "./game.ts";
import { makeStubHost } from "./stubHost.ts";
import { freshSeed } from "./rng.ts";

const params = new URLSearchParams(location.search);
// A fresh run every sitting. `?seed=` pins one, which is what the playtest
// harness and every bug report should use; the hardcoded `0x5eed1e` that used
// to be here meant a child who came back got the same boards in the same order,
// forever.
const seed = Number(params.get("seed") ?? "") || freshSeed();
const start = Number(params.get("start") ?? "") || 0;
const reduced = params.get("reduced") === "1";

const host = makeStubHost({
  seed,
  startIndex: start,
  reducedMotion: reduced ? true : undefined,
  onReport: (r) => {
    // eslint-disable-next-line no-console
    console.log(`[report] ${r.correct ? "OK " : "NO "} ${r.questionId} = ${r.answered} (${Math.round(r.ms)}ms)`);
  },
});

const el = document.getElementById("stage");
if (!el) throw new Error("#stage missing");
const app = mount(el, host);

// Harness handle. Standalone only.
(window as unknown as { counterpoise: unknown }).counterpoise = {
  ...app.debug,
  host,
  unmount: () => app.unmount(),
};
