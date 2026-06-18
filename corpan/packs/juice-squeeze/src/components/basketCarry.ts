/**
 * basketCarry — the meta-loop payoff (Ian's idea): when the shelf hits a full
 * basket (BASKET_SIZE jars), a basket appears CENTERED, the collected jars fly
 * INTO it, it's CARRIED OFF-SCREEN, and a single gold COIN flies up to the header
 * coin counter.
 *
 * Same bulletproof approach as jarFly: a DOM overlay on document.body with FULLY
 * INLINE styles + the Web Animations API + a MAX z-index (no CSS class/@keyframes
 * dependency). Clones the real `.jsf-jar-icon`s so the glossy jars themselves
 * appear to go in; `onStart` fires once they're cloned so the caller can clear
 * the shelf, and `onCoin` fires when the coin lands so the counter bumps in sync.
 *
 * Fail-safe: no document → no-op; if there are no jars it still fires the
 * callbacks so the store stays consistent. Auto-removes with a timeout fallback.
 */

const CARRY_MS = 2300
const COIN_LAND_MS = 2180

type Cleanup = () => void
type Options = { onStart?: () => void; onCoin?: () => void; onDone?: () => void }

export function launchBasketCarry(opts: Options = {}): Cleanup {
  const fire = (fn?: () => void) => {
    try {
      fn?.()
    } catch {
      /* noop */
    }
  }
  if (typeof document === "undefined" || !document.body) {
    fire(opts.onStart)
    fire(opts.onCoin)
    fire(opts.onDone)
    return () => {}
  }

  let removed = false
  let root: HTMLDivElement | null = null
  const timers: number[] = []

  const remove = () => {
    if (removed) return
    removed = true
    for (const t of timers) window.clearTimeout(t)
    try {
      root?.remove()
    } catch {
      /* noop */
    }
    root = null
  }
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))

  try {
    const vw = window.innerWidth || 360
    const vh = window.innerHeight || 640
    const collection = document.querySelector<HTMLElement>('[data-testid="bottle-collection"]')
    const jarEls = collection ? Array.from(collection.querySelectorAll<HTMLElement>(".jsf-jar-icon")) : []

    // Where the basket sits, and the "mouth" the jars drop into.
    const bx = vw * 0.5
    const by = vh * 0.46
    const mouthY = by - 8

    root = document.createElement("div")
    root.setAttribute("aria-hidden", "true")
    root.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "pointer-events:none",
      "overflow:hidden",
    ].join(";")
    document.body.appendChild(root)

    // ---- Basket -----------------------------------------------------------
    const basket = document.createElement("div")
    basket.style.cssText = [
      "position:fixed",
      `left:${bx}px`,
      `top:${by}px`,
      "width:96px",
      "height:66px",
      "transform:translate(-50%,-50%)",
      "filter:drop-shadow(0 10px 16px rgba(60,30,8,0.34))",
      "will-change:transform,opacity",
    ].join(";")
    // weave body (trapezoid via border) + rim
    basket.innerHTML =
      // back rim (ellipse opening)
      '<div style="position:absolute;left:50%;top:6px;transform:translateX(-50%);' +
      "width:92px;height:20px;border-radius:50%;background:linear-gradient(180deg,#7a4a1e,#5d3614);" +
      'box-shadow:inset 0 -3px 5px rgba(0,0,0,0.3),inset 0 2px 2px rgba(255,220,170,0.4)"></div>' +
      // body
      '<div style="position:absolute;left:50%;top:12px;transform:translateX(-50%);width:88px;height:50px;' +
      "border-radius:8px 8px 30px 30px / 8px 8px 22px 22px;" +
      "background:repeating-linear-gradient(90deg,#b5742f 0 7px,#9c5f23 7px 14px);" +
      "border:2px solid #6e4318;border-top:none;" +
      'box-shadow:inset 0 -6px 10px rgba(70,40,12,0.4),inset 0 3px 4px rgba(255,220,170,0.35)"></div>' +
      // handle arc
      '<div style="position:absolute;left:50%;top:-12px;transform:translateX(-50%);width:60px;height:34px;' +
      'border:5px solid #7a4a1e;border-bottom:none;border-radius:30px 30px 0 0;background:transparent"></div>'
    root.appendChild(basket)

    basket.animate(
      [
        { transform: "translate(-50%,-50%) translateY(-34px) scale(0.5)", opacity: 0, offset: 0 },
        { transform: "translate(-50%,-50%) translateY(0) scale(1.06)", opacity: 1, offset: 0.12 },
        { transform: "translate(-50%,-50%) translateY(0) scale(1)", opacity: 1, offset: 0.2 },
        { transform: "translate(-50%,-50%) translateY(0) scale(1)", opacity: 1, offset: 0.52 }, // hold for jars
        { transform: "translate(-50%,-50%) translateY(-8px) scale(1.07)", opacity: 1, offset: 0.6 }, // hoist
        {
          transform: `translate(-50%,-50%) translate(${vw * 0.62}px,${-vh * 0.72}px) scale(0.7) rotate(10deg)`,
          opacity: 0,
          offset: 1,
        }, // carried off-screen (up + right)
      ],
      { duration: CARRY_MS, easing: "cubic-bezier(0.42,0,0.3,1)", fill: "forwards" }
    )

    // ---- Jars fly into the basket ----------------------------------------
    jarEls.forEach((jar, i) => {
      const r = jar.getBoundingClientRect()
      const clone = jar.cloneNode(true) as HTMLElement
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      clone.style.cssText = [
        "position:fixed",
        `left:${r.left}px`,
        `top:${r.top}px`,
        `width:${r.width}px`,
        `height:${r.height}px`,
        "margin:0",
        "will-change:transform,opacity",
      ].join(";")
      root!.appendChild(clone)
      const dx = bx - cx
      const dy = mouthY - cy
      clone.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1, offset: 0 },
          { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 26}px) scale(1.12)`, opacity: 1, offset: 0.5 }, // arc up
          { transform: `translate(${dx}px,${dy}px) scale(0.32)`, opacity: 0.15, offset: 1 }, // drop in
        ],
        { duration: 620, delay: 260 + i * 85, easing: "cubic-bezier(0.5,0,0.4,1)", fill: "forwards" }
      )
    })

    // Clear the real shelf now that the clones carry the visual.
    fire(opts.onStart)

    // ---- Gold coin flies to the header coin counter ----------------------
    const counter = document.querySelector<HTMLElement>('[data-testid="coin-counter"]')
    let tx = vw * 0.86
    let ty = 44
    if (counter) {
      const cr = counter.getBoundingClientRect()
      tx = cr.left + cr.width / 2
      ty = cr.top + cr.height / 2
    }
    const coin = document.createElement("div")
    coin.style.cssText = [
      "position:fixed",
      `left:${bx}px`,
      `top:${by - 6}px`,
      "width:30px",
      "height:30px",
      "border-radius:50%",
      "background:radial-gradient(circle at 34% 30%,#fff3b0 0%,#ffd84d 38%,#f4b423 70%,#b9790f 100%)",
      "border:1.5px solid #9a6410",
      "box-shadow:0 3px 8px rgba(120,70,8,0.4),inset 0 1px 2px rgba(255,255,255,0.8)",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "font:700 16px system-ui",
      "color:#9a6410",
      "transform:translate(-50%,-50%) scale(0.2)",
      "opacity:0",
      "will-change:transform,opacity",
    ].join(";")
    coin.textContent = "★"
    root.appendChild(coin)
    const cdx = tx - bx
    const cdy = ty - (by - 6)
    coin.animate(
      [
        { transform: "translate(-50%,-50%) scale(0.2)", opacity: 0, offset: 0 },
        { transform: "translate(-50%,-50%) translateY(-14px) scale(1.25)", opacity: 1, offset: 0.2 }, // pop out
        { transform: "translate(-50%,-50%) translateY(-14px) scale(1.25)", opacity: 1, offset: 0.42 },
        { transform: `translate(-50%,-50%) translate(${cdx}px,${cdy}px) scale(0.45)`, opacity: 1, offset: 1 }, // to counter
      ],
      { duration: 760, delay: COIN_LAND_MS - 760, easing: "cubic-bezier(0.4,0,0.25,1)", fill: "forwards" }
    )

    later(() => fire(opts.onCoin), COIN_LAND_MS)
    later(() => {
      fire(opts.onDone)
      remove()
    }, CARRY_MS + 120)
  } catch {
    fire(opts.onStart)
    fire(opts.onCoin)
    fire(opts.onDone)
    remove()
  }

  return remove
}

export const BASKET_CARRY_MS = CARRY_MS
