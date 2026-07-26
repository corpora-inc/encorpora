// SIEGE, as a Dynawalla pack.
//
// The seam and nothing else. `Siege` is constructed with the same `Host` shape
// the stub host presented, so the forge, the waves, the anvil and the
// overcharge are untouched — what changed is where a problem comes from and
// who says whether the child was right.
//
// The three slabs a child strikes are the canonical answer and the mal-rule
// distractors the curriculum produced for *that* item. A wrong slab is a wrong
// answer a child actually gives, not noise, which is the whole reason the
// distractors cross the boundary at all.

import "./ui/styles.css";
import { createGameHost, renderNoHost } from "../../../packs/shared/game-host/index.ts";
import type { Host } from "./contract.ts";
import { Siege } from "./mount.ts";

const root = document.getElementById("app");
if (!root) throw new Error("#app missing");

async function start(el: HTMLElement): Promise<void> {
  const mounted = await createGameHost({ domain: "add-sub" });
  await mounted.warm();

  const game = new Siege(el, mounted.host as unknown as Host);
  mounted.client.on("dispose", () => {
    game.destroy();
  });
}

void start(root).catch((error: unknown) => {
  console.error("[siege] could not start", error);
  renderNoHost(root, "SIEGE");
});
