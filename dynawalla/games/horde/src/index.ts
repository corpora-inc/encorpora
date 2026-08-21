import css from "./style.css?inline"
import type { Host } from "./contract.ts"
import { Game } from "./game/game.ts"

export type { Host, Question } from "./contract.ts"
export { createStubHost } from "./stubHost.ts"

let styleTag: HTMLStyleElement | null = null
let mounts = 0

function ensureStyles(): void {
  if (styleTag) return
  styleTag = document.createElement("style")
  styleTag.setAttribute("data-horde", "")
  styleTag.textContent = css
  document.head.appendChild(styleTag)
}

/**
 * Mount DEEPSWARM into `el`. The element is sized by the host; the game fills
 * it and never touches anything outside it.
 */
export function mount(el: HTMLElement, host: Host): { unmount(): void } {
  ensureStyles()
  mounts++
  const root = document.createElement("div")
  root.className = "hz-root"
  el.appendChild(root)

  let game: Game | null = null
  try {
    game = new Game(root, host)
  } catch (err) {
    // Never fail silently: a black rectangle with no explanation is the worst
    // possible outcome for a child and for whoever has to debug it.
    console.error("[horde] failed to start", err)
    root.innerHTML =
      '<div class="hz-modal hz-open"><div class="hz-big">NO LIGHT</div>' +
      '<div class="hz-tagline">THIS DEVICE CANNOT OPEN THE DEEP</div>' +
      '<div class="hz-hint">DEEPSWARM needs WebGL2. Try another browser, or turn hardware acceleration back on.</div></div>'
  }

  return {
    unmount() {
      game?.destroy()
      game = null
      root.remove()
      mounts--
      if (mounts <= 0 && styleTag) {
        styleTag.remove()
        styleTag = null
      }
    },
  }
}
