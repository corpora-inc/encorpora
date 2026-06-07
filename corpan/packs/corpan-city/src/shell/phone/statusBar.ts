/**
 * statusBar — the faux-but-believable iOS-style status bar at the top of the in-world
 * Phone's screen. It is what instantly sells "this is a real device, not a drawer":
 * a live clock (the player's real wall time), a signal-dots glyph, a network label
 * (5G), and a battery pill. Purely cosmetic + non-interactive (the device is the
 * GAME's phone, so its "OS chrome" is part of the fiction, PHONE_DESIGN.md §2.1).
 *
 * The clock updates on each open (the shell calls `refresh()`) and ticks itself once
 * a minute while mounted. Glyphs inherit the screen ink via `currentColor`, so they
 * read correctly on the warm paper background and flip cleanly under RTL (the bar
 * uses logical layout so time sits at the inline-start, signal cluster inline-end).
 */

const LOG = "[wp/phone/statusBar]"

/* Inline SVG signal bars (four ascending) + a wifi-ish dot cluster — currentColor. */
const ICON_SIGNAL =
  '<svg viewBox="0 0 20 14" fill="currentColor" aria-hidden="true" class="wp-phone-status-bars">' +
  '<rect x="0" y="9" width="3.2" height="5" rx="1"/>' +
  '<rect x="5.6" y="6" width="3.2" height="8" rx="1"/>' +
  '<rect x="11.2" y="3" width="3.2" height="11" rx="1"/>' +
  '<rect x="16.8" y="0" width="3.2" height="14" rx="1"/></svg>'

export interface StatusBarHandle {
  el: HTMLElement
  /** Re-read the wall clock now (called by the shell on each open). */
  refresh(): void
  /** Stop the once-a-minute tick + drop the node. */
  dispose(): void
}

/** Two-digit, locale-neutral H:MM (12h, no AM/PM — the iconic "9:41" form). */
function clockText(d = new Date()): string {
  let h = d.getHours() % 12
  if (h === 0) h = 12
  const m = d.getMinutes()
  return `${h}:${m < 10 ? "0" : ""}${m}`
}

/**
 * Build the status bar. `networkLabel` defaults to "5G"; pass "" to hide it (e.g. a
 * narrower device). The battery level is cosmetic (a near-full pill) — we don't read
 * the real Battery API (not worth the permission surface for a fictional phone).
 */
export function createStatusBar(opts: { networkLabel?: string } = {}): StatusBarHandle {
  const el = document.createElement("div")
  el.className = "wp-phone-status"
  el.setAttribute("aria-hidden", "true")

  const clock = document.createElement("span")
  clock.className = "wp-phone-status-clock"
  clock.textContent = clockText()

  const right = document.createElement("span")
  right.className = "wp-phone-status-right"
  const net = document.createElement("span")
  net.className = "wp-phone-status-net"
  net.textContent = opts.networkLabel ?? "5G"
  const batt = document.createElement("span")
  batt.className = "wp-phone-status-batt"
  // The fill is a CSS ::before; nothing to set here.
  right.innerHTML = ICON_SIGNAL
  right.append(net, batt)

  el.append(clock, right)

  // Tick once a minute so a long session doesn't show a frozen time. Cheap; the
  // device is usually open only briefly, but a live clock is the believable detail.
  let timer: number | undefined
  const tick = () => {
    try {
      clock.textContent = clockText()
    } catch (err) {
      console.error(`${LOG} clock tick failed:`, err)
    }
  }
  const start = () => {
    stop()
    // align to the next minute boundary, then every 60s.
    const msToMinute = 60000 - (Date.now() % 60000)
    timer = window.setTimeout(() => {
      tick()
      timer = window.setInterval(tick, 60000) as unknown as number
    }, msToMinute) as unknown as number
  }
  const stop = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer)
      window.clearInterval(timer)
      timer = undefined
    }
  }
  start()

  return {
    el,
    refresh: () => {
      tick()
      start()
    },
    dispose: () => {
      stop()
      el.remove()
    },
  }
}
