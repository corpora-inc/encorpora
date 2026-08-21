/** Standalone dev entry: the game plus the local stub host. `npm run dev`. */

import { mount } from "./index.ts";
import { createStubHost } from "./stubHost.ts";

const el = document.getElementById("stage");
if (!el) throw new Error("[splitbeat] #stage missing");

const params = new URLSearchParams(location.search);
const host = createStubHost({
  seed: Number(params.get("seed") ?? 20260726) >>> 0,
  // ?musical=0 feeds plain arithmetic only, to prove the game degrades
  // gracefully when an answer is not a playable subdivision.
  musical: params.get("musical") !== "0",
});

const handle = mount(el, host);
(window as unknown as Record<string, unknown>).__unmount = () => handle.unmount();
