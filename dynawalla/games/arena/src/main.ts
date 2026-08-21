import { mount } from "./contract.ts"
import { createStubHost } from "./host/stubHost.ts"

/**
 * Standalone dev entry. The real runtime lands underneath `mount()`; until it
 * does, the seeded stub Host makes the game fully playable with `npm run dev`.
 *
 *   ?seed=123   reproduce a run
 *   ?perf       show the fps / tier readout
 */

const el = document.getElementById("arena")
if (!el) throw new Error("[arena] #arena not found")

const params = new URLSearchParams(location.search)
const raw = params.get("seed")
// `Number(x) || default` swallows `?seed=0`, which is a perfectly good seed
// and the first one anybody types.
const seed = raw !== null && raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : 0x5eed1e

// Both halves, or the run is not reproducible: the Host seeds the questions,
// the World seeds the water.
const host = createStubHost({ seed })
const handle = mount(el, host, { seed })

// Vite HMR: tear down cleanly so a reload never leaves two loops running.
const hot = (import.meta as unknown as { hot?: { dispose(cb: () => void): void } }).hot
hot?.dispose(() => handle.unmount())
