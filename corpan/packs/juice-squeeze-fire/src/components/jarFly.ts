/**
 * jarFly — the "capped jar flies up into the header collection" celebration
 * (Ian's jar idea). A pure DOM overlay (NO React render, NO host change) driven
 * imperatively from useGameLogic's bottle-complete branch.
 *
 * Visual: a small jar (a body filled with the just-completed bottle's fruit
 * gradient + a lid capping it) appears center-screen, scales up, then flies up to
 * the BottleCollection area in the header — so the flown jar visually "joins" the
 * collected capped-jar icons. It removes itself when the flight finishes.
 *
 * Timing (~900ms total): a short cap/scale-in beat, then the translate-up fly.
 * The jar-close sound is played by the caller AT THE MOMENT the lid caps (the
 * start of the fly).
 *
 * Fully self-contained + fail-safe: if there's no document or no target element
 * it is a silent no-op (so tests / SSR never crash). The element auto-removes on
 * animationend AND via a belt-and-suspenders timeout in case the event is missed.
 */

const FLY_MS = 900

type Cleanup = () => void

/**
 * Launch the jar-fly. Returns a cleanup fn that removes the overlay early (call
 * it from the win-timer teardown so an unmount mid-flight never leaks a node).
 */
export function launchJarFly(gradient: [string, string, string]): Cleanup {
  if (typeof document === "undefined" || !document.body) return () => {}

  let removed = false
  let el: HTMLDivElement | null = null
  let timer: number | null = null

  const remove = () => {
    if (removed) return
    removed = true
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
    try {
      el?.remove()
    } catch {
      /* noop */
    }
    el = null
  }

  try {
    // Target: the header BottleCollection (where collected jars live). Fall back
    // to the top-center of the viewport if it isn't on screen yet.
    const target = document.querySelector<HTMLElement>('[data-testid="bottle-collection"]')
    const vw = window.innerWidth || 360
    const vh = window.innerHeight || 640
    // Start: center-ish of the screen (over the juice). End: the header
    // collection's right edge (where the next jar appends), or top-left fallback.
    const sx = vw * 0.5
    const sy = vh * 0.45
    let tx = vw * 0.2
    let ty = 56
    if (target) {
      const r = target.getBoundingClientRect()
      tx = r.right + 10
      ty = r.top + r.height / 2
    }

    el = document.createElement("div")
    el.className = "jsf-jarfly"
    // CSS custom props feed the keyframes (defined in game.css): start center,
    // end at the collection. The jar is centered on (left,top) via translate(-50%).
    el.style.setProperty("--jf-sx", `${sx}px`)
    el.style.setProperty("--jf-sy", `${sy}px`)
    el.style.setProperty("--jf-tx", `${tx}px`)
    el.style.setProperty("--jf-ty", `${ty}px`)
    el.setAttribute("aria-hidden", "true")

    const grad = `linear-gradient(to bottom, ${gradient[0]}, ${gradient[1]}, ${gradient[2]})`
    el.innerHTML =
      '<div class="jsf-jarfly__lid"></div>' +
      `<div class="jsf-jarfly__body" style="background:${grad}"></div>`

    document.body.appendChild(el)

    el.addEventListener("animationend", remove, { once: true })
    timer = window.setTimeout(remove, FLY_MS + 250)
  } catch {
    remove()
  }

  return remove
}

export const JAR_FLY_MS = FLY_MS
