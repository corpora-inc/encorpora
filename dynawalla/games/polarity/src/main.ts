/**
 * Standalone dev entry: the local stub Host so `npm run dev` is the real game.
 * The runtime lands underneath this later; nothing else changes.
 */
import { mount } from "./index.ts";
import { makeStubHost } from "./stubHost.ts";

const el = document.getElementById("app");
if (!el) throw new Error("[polarity] #app missing");

const seed = Number(new URL(location.href).searchParams.get("seed") ?? "") || 0x50147;
const host = makeStubHost({ seed });
const handle = mount(el, host);

// keep hot-reload from stacking instances
const h = import.meta as unknown as { hot?: { dispose(cb: () => void): void } };
h.hot?.dispose(() => handle.unmount());
