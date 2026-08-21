// Standalone dev entry. The stub host stands in until the curriculum package
// lands; the game itself only ever sees the `Host` interface.

import "./style.css"
import { mount } from "./game/index.ts"
import { createStubHost } from "./stubHost.ts"
import { INTERIOR_CELLS } from "./game/grid.ts"

const el = document.getElementById("stage")
if (!el) throw new Error("#stage missing")

// `?seed=` replays an exact run — the only way to reproduce a bug a child hit.
const seedParam = new URLSearchParams(location.search).get("seed")

const host = createStubHost({
  total: INTERIOR_CELLS,
  ...(seedParam ? { seed: seedParam } : {}),
  onReport: (r) => {
    // eslint-disable-next-line no-console
    console.log("[claim] report", r)
  },
})

mount(el, host)
