/**
 * Standalone dev entry. `npm run dev` and play.
 * The real runtime supplies its own Host; this one is exact, seeded and local.
 */

import { mount } from "./game/mount.ts";
import { createStubHost } from "./host/stub.ts";

const el = document.getElementById("app")!;
const host = createStubHost({ seed: 0x5745, slots: 3 });
const game = mount(el, host);

// Hot-reload without leaking a WebGL context.
if (import.meta.hot) {
  import.meta.hot.dispose(() => game.unmount());
}
