/**
 * jarFly — the bottle-complete celebration: a jar pops up center-screen, a LID
 * drops on and SEATS (the "capping" moment), then the capped jar flies up and
 * docks into the header collection, shrinking as it lands.
 *
 * BULLETPROOF rendering: appended to document.body with FULLY INLINE styles + the
 * Web Animations API + a MAX z-index (no CSS class / @keyframes / custom-prop
 * dependency). On-device logs proved a class-styled body-child stayed invisible
 * (CSS scope/stacking) — driving everything inline + JS removes that failure mode.
 *
 * The lid animates SEPARATELY from the body so the cap-on reads clearly, and an
 * `onLidSeat` callback fires the instant the lid lands so the caller can play the
 * jar-close sound perfectly in sync (no magic-number guessing).
 *
 * Fail-safe: no document → silent no-op (tests/SSR safe). Auto-removes on finish
 * with a timeout fallback; cleanup also clears the lid-seat timer.
 */

const FLY_MS = 1650 // a touch slower so the cap + travel are clearly visible
const LID_SEAT_MS = 300 // when the lid visually lands (→ play jar-close here)

type Cleanup = () => void
type Options = { onLidSeat?: () => void }

export function launchJarFly(gradient: [string, string, string], opts: Options = {}): Cleanup {
  if (typeof document === "undefined" || !document.body) return () => {}

  let removed = false
  let el: HTMLDivElement | null = null
  let timer: number | null = null
  let seatTimer: number | null = null

  const remove = () => {
    if (removed) return
    removed = true
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
    if (seatTimer !== null) {
      window.clearTimeout(seatTimer)
      seatTimer = null
    }
    try {
      el?.remove()
    } catch {
      /* noop */
    }
    el = null
  }

  try {
    // Land on the NEWEST collected jar — the LAST `.jsf-jar-icon` in the header
    // collection — so the fly docks where this bottle's jar lives and the real
    // icon is underneath when removed (it "stays home"). Fall back to the
    // collection container's LEFT (where jars start), NOT its right edge.
    const collection = document.querySelector<HTMLElement>('[data-testid="bottle-collection"]')
    const jars = collection?.querySelectorAll<HTMLElement>(".jsf-jar-icon")
    const landEl: HTMLElement | null = jars && jars.length ? jars[jars.length - 1] : collection
    const vw = window.innerWidth || 360
    const vh = window.innerHeight || 640
    const sx = vw * 0.5 // start: center
    const sy = vh * 0.45
    let tx = vw * 0.16 // fallback: top-left
    let ty = 52
    if (landEl) {
      const r = landEl.getBoundingClientRect()
      tx = r.left + r.width / 2
      ty = r.top + r.height / 2
    }

    const grad = `linear-gradient(to bottom, ${gradient[0]}, ${gradient[1]}, ${gradient[2]})`

    el = document.createElement("div")
    el.setAttribute("aria-hidden", "true")
    // Container — everything inline so no CSS class / stacking can hide it.
    el.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "z-index:2147483647", // above ANY pack/host UI
      "pointer-events:none",
      "width:64px",
      "display:flex",
      "flex-direction:column",
      "align-items:center",
      "filter:drop-shadow(0 6px 16px rgba(0,0,0,0.32))",
      "will-change:transform,opacity",
    ].join(";")

    // Lid (its own element so we can drop it on independently).
    const lid = document.createElement("div")
    lid.style.cssText = [
      "width:56px",
      "height:16px",
      "border-radius:7px 7px 4px 4px",
      "background:linear-gradient(180deg,#e6b15a 0%,#c98a35 56%,#a86c22 100%)",
      "border:1.5px solid rgba(80,48,12,0.55)",
      "box-shadow:inset 0 1px 0 rgba(255,255,255,0.55),inset 0 -2px 3px rgba(0,0,0,0.18)",
      "margin-bottom:-2px",
      "will-change:transform,opacity",
    ].join(";")

    // Body (fruit gradient + glossy highlight).
    const body = document.createElement("div")
    body.style.cssText = [
      "width:52px",
      "height:66px",
      "border-radius:5px 5px 12px 12px",
      `background:${grad}`,
      "border:1.5px solid rgba(255,255,255,0.85)",
      "box-shadow:inset 0 -3px 7px rgba(0,0,0,0.2),inset 0 2px 4px rgba(255,255,255,0.5),inset 6px 0 8px rgba(255,255,255,0.22)",
    ].join(";")

    el.appendChild(lid)
    el.appendChild(body)
    document.body.appendChild(el)

    console.log("[juice-squeeze] jarFly launch", {
      sx: Math.round(sx), sy: Math.round(sy), tx: Math.round(tx), ty: Math.round(ty),
      hasJars: !!(jars && jars.length), vw, vh,
    })

    const at = (x: number, y: number, s: number) =>
      `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s})`

    // Container: pop big at center, hold while the lid seats, then fly + shrink
    // to dock on the collection jar (lands fully visible so it "stays" home).
    const anim = el.animate(
      [
        { transform: at(sx, sy, 0.5), opacity: 0, offset: 0 },
        { transform: at(sx, sy, 1.32), opacity: 1, offset: 0.13 }, // pop BIG
        { transform: at(sx, sy, 1.16), opacity: 1, offset: 0.22 }, // hold (lid seats)
        { transform: at(sx, sy, 1.16), opacity: 1, offset: 0.34 },
        { transform: at(tx, ty, 0.34), opacity: 1, offset: 1 }, // fly + dock small
      ],
      { duration: FLY_MS, easing: "cubic-bezier(0.34,0,0.2,1)", fill: "forwards" }
    )

    // Lid: starts lifted + faded, drops on with a tiny overshoot, seats.
    lid.animate(
      [
        { transform: "translateY(-22px) scale(1.06)", opacity: 0.25, offset: 0 },
        { transform: "translateY(-22px) scale(1.06)", opacity: 0.25, offset: 0.04 },
        { transform: "translateY(3px) scale(0.99)", opacity: 1, offset: 0.16 }, // contact + squash
        { transform: "translateY(-1px) scale(1)", opacity: 1, offset: 0.2 }, // tiny bounce
        { transform: "translateY(0) scale(1)", opacity: 1, offset: 0.26 }, // seated
        { transform: "translateY(0) scale(1)", opacity: 1, offset: 1 },
      ],
      { duration: FLY_MS, easing: "ease-out", fill: "forwards" }
    )

    // Fire the jar-close sound exactly when the lid seats.
    if (opts.onLidSeat) {
      seatTimer = window.setTimeout(() => {
        seatTimer = null
        try {
          opts.onLidSeat?.()
        } catch {
          /* noop */
        }
      }, LID_SEAT_MS)
    }

    anim.onfinish = remove
    anim.oncancel = remove
    // Belt-and-suspenders: remove even if onfinish never fires.
    timer = window.setTimeout(remove, FLY_MS + 300)
  } catch {
    remove()
  }

  return remove
}

export const JAR_FLY_MS = FLY_MS
