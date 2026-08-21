import { mount } from "./mount.ts";
import { createStubHost } from "./host/stubHost.ts";

/**
 * Standalone entry. `npm run dev` gives a fully playable FUSE against the local
 * stub host; the real Dynawalla host drops in by replacing these two lines.
 *
 *   ?seed=<text>  reproducible run
 *   ?debug=1      fps / particle / phase readout
 */
const params = new URLSearchParams(location.search);
const seed = params.get("seed") ?? undefined;
const host = createStubHost(seed ?? "fuse");
const root = document.getElementById("root") as HTMLElement;

const probe: Record<string, unknown> = { host };
const instance = mount(root, host, {
  seed,
  debug: params.has("debug"),
  onReady: (p) => {
    probe.game = p.game;
    probe.step = p.step;
  },
});
probe.instance = instance;

// expose for the playtest harness
Object.assign(window as unknown as Record<string, unknown>, { __fuse: probe });
