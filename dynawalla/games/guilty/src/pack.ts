// GUILTY, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// dev host, because the adapter presents the same synchronous `Host` surface
// that `contract.ts` already describes — so the trench, the husks, the wave
// ladder and the boss are untouched.
//
// What crosses the boundary is the accusation. The host draws a problem and
// reveals its canonical answer; the game writes that answer on one descending
// husk and the mal-rule distractors on the others, which is the sanctioned use
// of `items.reveal` — placing the answer, never judging it. The game reports
// which husk was shot and the host is the judge.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts";

import type { Host } from "./contract.ts";
import { mount } from "./game/game.ts";

const root = document.getElementById("app");
if (!root) throw new Error("guilty: #app missing");

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "arith" });
  // Stocked before the first frame: wave one drops a husk immediately, and a
  // husk with a blank face is the kind of thing that happens exactly once, on
  // launch, in front of the child.
  await mounted.warm();

  const handle = mount(el, mounted.host as unknown as Host);

  // The host tells a pack before its port dies, so the rAF loop and the audio
  // context are torn down before the frame is, rather than a frame or two after.
  mounted.client.on("dispose", () => {
    handle.unmount();
  });
}

void start(root).catch((error: unknown) => {
  console.error("[guilty] could not start", error);
  renderNoHost(root, "GUILTY");
});
