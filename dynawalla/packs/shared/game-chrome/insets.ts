/**
 * The safe rectangle, in numbers a canvas can use.
 *
 * **Why this exists.** Every game here declares `viewport-fit=cover`, which is
 * not a neutral setting: it opts the document *into* the notch, the home
 * indicator and the rounded corners. A DOM HUD can then claw that back with
 * `padding: env(safe-area-inset-top)` — and the handful of games with DOM HUDs
 * do exactly that. A canvas HUD cannot. `env()` is a CSS value; a canvas knows
 * nothing about it, so `fillText` at `y = 24` lands under the notch on every
 * device that has one.
 *
 * That was true of 20 of the 27 shipped games. They all declared `cover` and
 * none of them read the insets back, so they were drawing into the unsafe
 * region deliberately and then ignoring it.
 *
 * **How it works.** `env()` cannot be read from JavaScript, so this measures it:
 * a zero-size fixed probe whose padding is set to the four `env()` values, read
 * back through `getComputedStyle`. That is the standard trick and it is exact,
 * because the browser resolves `env()` before computing the padding.
 *
 * The probe is `visibility:hidden`, out of flow, `aria-hidden`, and never
 * receives pointer events, so it cannot affect layout, hit-testing or the
 * accessibility tree.
 */

export type Insets = { top: number; right: number; bottom: number; left: number }

/**
 * Insets supplied by the HOST, which are the only trustworthy ones inside a
 * pack.
 *
 * A pack runs in an iframe sandboxed `allow-scripts` with deliberately no
 * `allow-same-origin`. `env(safe-area-inset-*)` is a property of the TOP-LEVEL
 * browsing context, so a cross-origin child resolves all four to 0 — the probe
 * below is correct in a browser tab and useless in the shipped app. Every game
 * that trusted it drew its HUD under the notch believing it was safe.
 *
 * The host measures the real values and sends them on the `settings` channel;
 * `game-host` calls this on the handshake and again on every `settings` event.
 * Until then, and in the dev harness where there is no host, the probe is the
 * best available answer and costs nothing.
 */
let hostInsets: Insets | null = null

/**
 * Everyone watching. Shared by `onInsetsChange` and `setHostInsets`.
 *
 * **Why `setHostInsets` has to notify.** It used to be a plain assignment, and
 * `onInsetsChange` listened only for `resize` and `orientationchange` — so the
 * one path the insets actually ARRIVE by was the one path nothing was told
 * about. The sequence on a device is: the pack mounts and lays itself out
 * against the probe's zeros, the host handshake completes, the real numbers are
 * written here, and nothing asks again until the child happens to rotate the
 * phone. The `settings` channel re-fires whenever the app's store changes,
 * which on iPadOS includes a Split View resize that moves the insets without
 * moving the pack's box at all — the exact case a ResizeObserver cannot see.
 *
 * A Set rather than an array: `onInsetsChange` returns an unsubscribe that has
 * to be exact, and a game that mounts and unmounts a HUD repeatedly would
 * otherwise leak one listener per cycle.
 */
const watchers = new Set<() => void>()

const notify = (): void => {
  // A copy, so a listener that unsubscribes during the walk cannot skip the
  // one after it.
  for (const fn of [...watchers]) fn()
}

export function setHostInsets(i: Insets | null | undefined): void {
  hostInsets =
    i && [i.top, i.right, i.bottom, i.left].every((n) => Number.isFinite(n) && n >= 0)
      ? { top: i.top, right: i.right, bottom: i.bottom, left: i.left }
      : null
  notify()
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

const PROBE_ID = "dw-safe-probe"

function probe(): HTMLElement | null {
  if (typeof document === "undefined") return null
  const found = document.getElementById(PROBE_ID)
  if (found) return found
  const el = document.createElement("div")
  el.id = PROBE_ID
  el.setAttribute("aria-hidden", "true")
  el.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
    "padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);" +
    "padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left)"
  document.body.appendChild(el)
  return el
}

const px = (v: string): number => {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * The current safe-area insets in CSS pixels.
 *
 * Returns zeros where there is no environment to measure — node, a test, a
 * device without insets — so a caller never has to branch on platform.
 */
export function safeInsets(): Insets {
  // The host's measurement wins whenever there is one: inside the shipped app
  // the probe below can only ever return zeros.
  if (hostInsets) return { ...hostInsets }
  const el = probe()
  if (!el || typeof getComputedStyle !== "function") return { ...NO_INSETS }
  const s = getComputedStyle(el)
  return {
    top: px(s.paddingTop),
    right: px(s.paddingRight),
    bottom: px(s.paddingBottom),
    left: px(s.paddingLeft),
  }
}

/**
 * Watch the insets and call back when they change.
 *
 * They change more often than "never": rotation swaps top/bottom with
 * left/right, and iPadOS changes them when a pack is resized in Split View. A
 * game that reads them once at mount and never again is correct until the first
 * rotation and wrong after it.
 *
 * Returns an unsubscribe. Call it in `unmount` — a listener that outlives the
 * frame keeps the whole closure alive.
 */
export function onInsetsChange(fn: (insets: Insets) => void): () => void {
  let last = safeInsets()
  const check = (): void => {
    const now = safeInsets()
    if (
      now.top === last.top &&
      now.right === last.right &&
      now.bottom === last.bottom &&
      now.left === last.left
    ) {
      return
    }
    last = now
    fn(now)
  }
  // THREE triggers, not two. The window events cover a rotation and a window
  // resize; `watchers` covers the host telling us, which is the only way the
  // real numbers ever arrive inside the app and was the one this function used
  // to miss. In node there is no `addEventListener` and the host path is the
  // only one there is — which is also how a test drives this.
  watchers.add(check)
  const dom = typeof globalThis.addEventListener === "function"
  if (dom) {
    globalThis.addEventListener("resize", check)
    globalThis.addEventListener("orientationchange", check)
  }
  return () => {
    watchers.delete(check)
    if (!dom) return
    globalThis.removeEventListener("resize", check)
    globalThis.removeEventListener("orientationchange", check)
  }
}

/**
 * The safe rectangle inside a canvas of `w` x `h` CSS pixels.
 *
 * This is the value a canvas HUD actually wants: lay chrome out inside this
 * rect and it clears the notch and the home indicator on every device, and is
 * identical to the full rect on devices with no insets.
 *
 * The playfield does NOT have to obey it — a full-bleed background reaching
 * under the notch is usually what you want, and is why `viewport-fit=cover` is
 * set in the first place. It is the things a child must *read or touch* that
 * belong inside this rect.
 */
export function safeRect(
  w: number,
  h: number,
  insets: Insets = safeInsets(),
): { x: number; y: number; w: number; h: number } {
  const x = Math.min(insets.left, w)
  const y = Math.min(insets.top, h)
  return {
    x,
    y,
    w: Math.max(0, w - x - Math.min(insets.right, w)),
    h: Math.max(0, h - y - Math.min(insets.bottom, h)),
  }
}

/** The narrow slice of an element `publishSafeVars` needs, so a test can stub it. */
export type StyleTarget = { style: { setProperty(name: string, value: string): void } }

/**
 * The ONE name the safe area goes by, fleet-wide.
 *
 * It used to be five names. SIEGE published `--sg-safe-*`, MONUMENT
 * `--mn-safe-*`, POLARITY `--pol-safe-*`, HORDE `--hz-safe-*`, CLAIM
 * `--cl-safe-*` — and the four packs that had not been bitten yet published
 * nothing at all and read `env()` directly. Five dialects meant five chances to
 * spell one wrong, five things for a fleet gate to know about, and no way to
 * write a rule that reads "this string, exactly, or the build fails".
 *
 * So there is one prefix and it is not per-pack. A pack's own namespace buys
 * nothing here: these four properties are published on the pack's root element
 * by shared code, read by that pack's stylesheet and by nothing else, and a
 * collision is impossible because a pack is a whole document.
 */
export const SAFE_PREFIX = "--dw-safe-"

export const SIDES = ["top", "right", "bottom", "left"] as const
export type SideName = (typeof SIDES)[number]

/**
 * The only form in which a pack's CSS may mention the safe area.
 *
 * ```css
 * padding-top: max(12px, var(--dw-safe-top, env(safe-area-inset-top, 0px)));
 * ```
 *
 * The custom property is the answer inside the app. The `env()` behind it is
 * the answer in a dev browser tab opened straight at `index.html`, where there
 * is no host to publish anything and where `env()` happens to be right because
 * the document IS the top-level browsing context. Inside the shipped app the
 * `env()` is the number zero — a pack frame is sandboxed `allow-scripts` with
 * no `allow-same-origin`, and `env(safe-area-inset-*)` belongs to the top-level
 * context — so it must never be the thing a rule takes its answer from.
 *
 * `packs/sdk/src/safearea.test.ts` fails the build for any occurrence of
 * `env(safe-area-inset-` in a pack that is not character-for-character this.
 * Interpolate this function rather than typing the string: a hand-typed copy is
 * a chance to leave the `var()` off, which is the entire defect.
 */
export function safeVar(side: SideName): string {
  return `var(${SAFE_PREFIX}${side}, env(safe-area-inset-${side}, 0px))`
}

/** The four of them, for a stylesheet that wants all four sides. */
export const SAFE_VARS: Readonly<Record<SideName, string>> = {
  top: safeVar("top"),
  right: safeVar("right"),
  bottom: safeVar("bottom"),
  left: safeVar("left"),
}

/** What `installSafeArea` hands back. */
export type SafeArea = {
  /** The insets as they stand right now. Never stale: the subscription updates it. */
  current(): Insets
  /** Drop the subscription. Call it from `unmount`. */
  dispose(): void
}

/**
 * The one call every pack makes, and the only one it needs.
 *
 * It does the three things that were being done separately, inconsistently, or
 * not at all:
 *
 *   1. **Publishes** the four insets onto `root` as `--dw-safe-*`, immediately,
 *      with zeros written out explicitly. An absent custom property falls
 *      through to the `env()` in the `var()` fallback, and inside a pack frame
 *      that is zero — indistinguishable from a correct zero right up until the
 *      child picks up a phone with a notch.
 *   2. **Subscribes**, so a rotation or an iPadOS Split View resize republishes.
 *      Insets also arrive from the HOST after the first layout: `setHostInsets`
 *      is called when the handshake completes, which is after mount, so a pack
 *      that reads once at mount and never again has the probe's zeros forever.
 *      MERGE shipped exactly that.
 *   3. **Tells the canvas half**, through `onChange`. The defect that keeps
 *      being found is not "the CSS is wrong" or "the canvas is wrong" — it is
 *      the two halves of one game disagreeing about where the screen is,
 *      because they asked different things. Here they cannot: one measurement,
 *      published to the stylesheet and handed to the layout in the same call.
 *
 * `onChange` fires once synchronously with the insets at mount, so a caller
 * never needs a separate "and also lay out now" line — forgetting that line is
 * how a game ends up correct only after the first rotation.
 */
export function installSafeArea(
  root: StyleTarget,
  onChange?: (insets: Insets) => void,
): SafeArea {
  let insets = safeInsets()
  let published: Insets | null = null
  const apply = (next: Insets): void => {
    insets = next
    publishSafeVars(root, SAFE_PREFIX, next, published)
    published = next
    onChange?.(next)
  }
  apply(insets)
  const unsubscribe = onInsetsChange(apply)
  return {
    current: () => ({ ...insets }),
    dispose: unsubscribe,
  }
}

/**
 * Hand a STYLESHEET the safe area, as four custom properties it can do
 * arithmetic with.
 *
 * **Why a stylesheet cannot just ask.** `env(safe-area-inset-*)` belongs to the
 * top-level browsing context, and a pack is a cross-origin child, so all four
 * resolve to 0 there — every `padding: env(safe-area-inset-top)` in a pack
 * silently collapses to its fallback. That is not a rare edge: it is every
 * device, every time, and SIEGE, STACK and POLARITY all shipped a DOM HUD under
 * the Android status bar because of it. The numbers have to arrive as an
 * argument from the host, which is what this does.
 *
 * The stylesheet then reads `var(--x-safe-top, env(safe-area-inset-top, 0px))`:
 * the property inside the app, the `env()` only in a dev browser tab where there
 * is no host and where it happens to be right.
 *
 * Zeros are written EXPLICITLY rather than left unset. `var()` falls back to its
 * `env()` when the property is absent, and inside the app that is the wrong
 * answer even when the true inset happens to be zero — it is the wrong answer
 * *especially* then, because it is indistinguishable from the right one until
 * the child picks up a phone with a notch.
 *
 * @param prefix the pack's own namespace, e.g. `"--mn-safe-"`.
 * @param previous what was last published, so a resize path can skip a write.
 * @returns whether anything changed.
 */
export function publishSafeVars(
  root: StyleTarget,
  prefix: string,
  insets: Insets = safeInsets(),
  previous?: Insets | null,
): boolean {
  const i = insets ?? NO_INSETS
  const now: Insets = {
    top: Math.max(0, i.top),
    right: Math.max(0, i.right),
    bottom: Math.max(0, i.bottom),
    left: Math.max(0, i.left),
  }
  if (
    previous &&
    previous.top === now.top &&
    previous.right === now.right &&
    previous.bottom === now.bottom &&
    previous.left === now.left
  ) {
    return false
  }
  root.style.setProperty(`${prefix}top`, `${now.top}px`)
  root.style.setProperty(`${prefix}right`, `${now.right}px`)
  root.style.setProperty(`${prefix}bottom`, `${now.bottom}px`)
  root.style.setProperty(`${prefix}left`, `${now.left}px`)
  return true
}
