// MONUMENT, as a Dynawalla pack.
//
// The seam and nothing else. `mount` is handed the real host in place of the
// seeded stub, because the adapter presents the same synchronous surface the
// `Host` in `contract.ts` already describes — so the sim, the sway, the shear
// and the WebGL tier detection are untouched.
//
// What changed is where a slab's value comes from and who says whether the
// drop was true. The sweeping slabs carry the canonical answer and the
// mal-rule distractors the curriculum produced for *that* item: a wrong slab
// is a wrong answer a child actually gives, which is the whole reason the
// distractors cross the boundary at all. The sim still owns the other half of
// the verdict — the alignment — because that is geometry, not arithmetic, and
// nothing about it is reported.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts";
import type { Host } from "./contract.ts";
import { mount } from "./game/mount.ts";

const root = document.getElementById("app");
if (!root) throw new Error("stack: #app missing");

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" });
  // Stocked before the first frame: the first slab sweeps immediately, and a
  // slab with a blank face is the kind of thing that happens exactly once, on
  // launch, in front of the child.
  await mounted.warm();

  const game = mount(el, mounted.host as unknown as Host);

  // The host tells a pack before its port dies, so the rAF loop stops and the
  // WebGL context is released before the frame is torn down rather than a
  // frame or two after it.
  mounted.client.on("dispose", () => {
    game.unmount();
  });
}

void start(root).catch((error: unknown) => {
  console.error("[stack] could not start", error);
  renderNoHost(root, "MONUMENT");
});
