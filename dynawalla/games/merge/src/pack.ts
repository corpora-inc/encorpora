// FUSE, as a Dynawalla pack.
//
// The whole seam is this file. `mount.ts`, the game, the renderer and the
// particle budget are untouched: the real host is handed to the same `mount`
// the stub host was, because the adapter presents the same synchronous surface.
//
// Everything mathematical now comes from the host — the questions, the
// canonical answer on a chip's face, the mal-rule distractors, the judgement,
// and the record it lands in. The game does no arithmetic that decides
// anything, which is exactly the property the pack contract exists to give.

import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts";
import type { FocusableHost } from "./contract.ts";
import { mount } from "./mount.ts";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" });
  // Stocked before the first frame: a chip that spawns into an empty pool is a
  // chip with a blank face, and it would happen exactly once, on launch, in
  // front of the child.
  await mounted.warm();

  const instance = mount(el, mounted.host as unknown as FocusableHost);

  // The host tells a pack before its port dies, so the loop stops before the
  // frame is torn down rather than a frame or two after it.
  mounted.client.on("dispose", () => {
    instance.unmount();
  });
}

void start(root).catch((error: unknown) => {
  console.error("[fuse] could not start", error);
  renderNoHost(root, "FUSE");
});
