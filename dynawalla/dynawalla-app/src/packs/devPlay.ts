// Open straight into a pack, and say how fast it is running.
//
//     VITE_DW_AUTOPLAY=dynawalla.fuse npm run tauri dev
//
// Two things, both only for whoever is building the app.
//
// **The launch.** Iterating on a game means restarting the app, and two taps
// per restart is two taps too many when the loop is fifty restarts long. It
// waits for the library to be read rather than firing blind, so it works on a
// cold device where the pack was installed by the bundled sync moments earlier.
//
// **The frame rate.** The pack and the host share one web process in every
// WebView this app ships to, so the host's own animation callback stalls
// exactly when the game does. Sampling it is a measurement of the game, taken
// from outside the sandbox, with nothing added to the pack contract to get it.
//
// `import.meta.env.VITE_*` is substituted at build time. With the variable
// unset — which is every build that is not a developer's own — the constant
// below is `undefined`, the guard is false, and none of this is reachable.

import { useLibrary } from "./libraryStore.ts"
import { useLaunch } from "./Stage.tsx"

const AUTOPLAY: string | undefined = import.meta.env["VITE_DW_AUTOPLAY"] as string | undefined

/** How often the frame-rate line is printed, in milliseconds. */
const REPORT_MS = 2000

function sampleFrameRate(): void {
  let frames = 0
  let worst = 0
  let last = performance.now()
  let since = last

  const tick = (now: number) => {
    const delta = now - last
    last = now
    frames += 1
    if (delta > worst) worst = delta
    if (now - since >= REPORT_MS) {
      const fps = (frames * 1000) / (now - since)
      // `console.error`, deliberately: Vite's dev client forwards errors to the
      // terminal and nothing else, and a frame-rate line nobody can read from
      // outside the WebView is a frame-rate line nobody reads. This path is
      // only reachable with the variable set.
      console.error(
        `[packs] ${fps.toFixed(1)} fps over ${String(frames)} frames, worst frame ${worst.toFixed(1)}ms`,
      )
      frames = 0
      worst = 0
      since = now
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/**
 * Wire the developer's launch, if one was asked for.
 *
 * Called from `main.tsx` unconditionally; it returns immediately unless the
 * variable is set.
 */
export function startAutoplay(): void {
  if (!AUTOPLAY) return

  const open = () => {
    const found = useLibrary.getState().entries.some((entry) => entry.manifest.id === AUTOPLAY)
    if (!found) {
      console.error(`[packs] VITE_DW_AUTOPLAY=${AUTOPLAY} is not installed`)
      return
    }
    console.error(`[packs] autoplay: ${AUTOPLAY}`)
    useLaunch.getState().play(AUTOPLAY)
    sampleFrameRate()
  }

  if (useLibrary.getState().ready) {
    open()
    return
  }
  const stop = useLibrary.subscribe((state) => {
    if (!state.ready) return
    stop()
    open()
  })
}
