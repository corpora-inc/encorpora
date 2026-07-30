// Mounting a pack: the sandbox, the handshake, and taking it all down again.
//
// ── Why an iframe ────────────────────────────────────────────────────────────
// The obvious way to run a pack is a `<script>` tag, and it is what Corpán
// does. It puts pack code in the host's own realm, where `window.__TAURI__`,
// every store, the DOM and each other pack are all reachable, and the
// "capability boundary" is then a naming convention: a pack that does not use
// the host API is not prevented from anything, it merely did not ask nicely.
//
// This mounts the pack in an iframe with `sandbox="allow-scripts"` and NOT
// `allow-same-origin`. That single omission is the whole boundary:
//
//   * the frame's origin is opaque, so `window.parent` is cross-origin and
//     unreadable — the pack cannot reach the Tauri bridge, the practice store,
//     or another pack;
//   * there is no localStorage, no IndexedDB, no cookies, so a pack cannot
//     keep anything the host did not agree to keep for it (which is what the
//     `storage` capability is);
//   * top-level navigation is blocked, so a pack cannot replace the app.
//
// What it gets instead is one `MessagePort`, and everything on that port goes
// through `bridge.ts`. Handing over a port is the act of granting; there is no
// way for a frame to obtain one by asking.
//
// The cost is that the pack's own CSP cannot use `'self'` — an opaque origin
// matches nothing — which is why the Rust scheme handler names the scheme
// explicitly in the policy it serves.

import type { Capability, Connect, HostEventName, Settings } from "../../../packs/sdk/src/index.ts"
import { PROTOCOL_VERSION, SDK_VERSION } from "../../../packs/sdk/src/index.ts"
import type { Bridge, HostServices } from "./bridge.ts"
import { createBridge } from "./bridge.ts"

/** A pack that has not said `ready` by now is not going to. */
const HANDSHAKE_TIMEOUT_MS = 20_000

/* ------------------------------- liveness --------------------------------- */
//
// Everything below exists because VOLTA shipped in 0.3.1 completely blank on
// iOS and Android and nothing here noticed. It never threw: it mounted, said
// `ready`, took its port, warmed its question pool, built a WebGL context and a
// HUD, and drew all of it into a box 820 pixels wide and zero tall. The
// handshake timeout above is the right net for a pack that dies before
// `connect()` — and it was the only net there was.
//
// ── What the host can and cannot see ────────────────────────────────────────
//
// The frame is sandboxed without `allow-same-origin`, so its document is
// unreadable: there is no way to ask a pack how big its stage is, what it
// painted, or whether it painted. Exactly two channels cross the boundary.
//
//   1. **The frame element's own box.** Ours, in our document, measurable.
//   2. **The port.** Every message a pack sends arrives at `bridge.handle`.
//
// Both were measured against a real framed pack (`games/merge`, built, framed on
// an opaque origin at 820x1180, driven through a run) with its stage
// deliberately collapsed the way VOLTA's was:
//
//   * the frame element measured **820x1180** — healthy — while the stage inside
//     it measured **820x0**;
//   * the port carried **129 messages in the first 1.3 seconds** and 13 more
//     across the next five, whether the game was visible or not.
//
// So neither channel separates a blank pack from a playing one, and **nothing
// here could have caught VOLTA.** That collapse happened one document deeper
// than the host can reach, and catching it needs the pack to measure its own
// stage and say so, in the only place the measurement exists. `games/merge` does
// that now (`makeStage`, and a stage-collapse error in its `resize`).
// **`games/runner` does not** — as of this commit it still carries the line that
// blanked it, and the repair is in an open PR, not in this tree. Nothing here
// fixes VOLTA and nothing here can notice it.
//
// Neither fault has a consumer in a release build yet. They are written to the
// console and offered on `onFault` / `MountedPack.faults()`, and `Stage.tsx` does
// not pass `onFault`; there is also no console-to-native bridge in this app, so
// on a device these lines reach a WebInspector session and nowhere else. That
// makes this a dev-loop instrument today rather than the thing that would have
// told somebody other than the founder. Wiring a consumer — a fault on the
// developer surface, or a native log — is the next step and belongs to
// `Stage.tsx`.
//
// What the box *does* catch is the host's own copy of that bug, one level up,
// which was completely unwatched. That is not hypothetical either: taking
// `fixed; inset: 0` off the stage div in `Stage.tsx` was tried in a browser
// against the real `packs.css`, and the frame comes out **300x150** — an iframe
// with nothing to resolve its percentages against. Which is why the threshold
// below is a share of the window rather than zero.
//
// What the two channels *do* catch is stated narrowly, and each fault below says
// which real failure it is the net for. Neither is routed to `onError`: that
// replaces the pack with a curtain and ends a child's run, and a false
// "this pack is broken" is worse than the silence it replaces. They are said out
// loud, once, and offered on `MountedPack.faults()`.

/** A way a connected pack can be failing that the host can actually observe. */
export type LivenessFault =
  /**
   * The frame is nowhere near filling the window it was given, so whatever the
   * pack draws, the child is not seeing a game.
   *
   * This is the *host's* copy of the bug that blanked VOLTA, and it is the same
   * shape: `.pack-frame` gets its box from `block-size: 100%` against
   * `.pack-frame-host`, which gets one the same way from the `fixed; inset: 0`
   * div in `Stage.tsx`, and everything a pack draws is inside it. One edit
   * anywhere up that chain and the percentages resolve against nothing.
   *
   * The threshold is a *share of the window* rather than zero, and that is a
   * measurement rather than a preference. Taking `fixed; inset: 0` off the stage
   * div was tried in a real browser against the real `packs.css`: the frame does
   * not go to zero, it goes to **300x150** — an iframe's intrinsic default size,
   * which is what a replaced element falls back to when a percentage has nothing
   * to resolve against. A check written against zero would have watched the most
   * likely form of this failure go past.
   *
   * Half the window on either axis, because a window is the only honest
   * yardstick here. An absolute floor would accuse a desktop user who made their
   * window short; a share cannot, since a frame that fills a small window still
   * fills it. And `Stage.tsx` deliberately puts no bar above or below the frame
   * ("a bar above the frame is a bar that resizes the game every time the safe
   * area changes"), so half a window is an enormous amount of slack for any host
   * chrome that might one day be added — but not enough to hide a 150px strip.
   */
  | "no-room"
  /**
   * The pack took its port and then never used it.
   *
   * All twenty-seven shipping games do the same three things in the same order:
   * `createGameHost()`, `await warm()`, then mount. `warm()` is `items.next`, so
   * every one of them speaks within milliseconds of the handshake — measured at
   * **11ms** in a real framed pack. A pack that was granted `items` and has said
   * nothing at all after half a minute of being on screen never reached its game
   * loop.
   *
   * This is the fault that contradicts `renderNoHost()`. Every game's entry
   * catches a failure on the way up and draws "<GAME> runs inside Dynawalla" —
   * the standalone message — so a pack that crashed while starting tells a child
   * there is no host, and tells a developer the wrong thing. When the host sees
   * this fault it knows that message is false: the pack connected to it. It
   * catches a failure at or before `warm()`; a crash in `mount()` happens after
   * the warm burst and is invisible here.
   */
  | "never-spoke"

/**
 * The share of the window on each axis a framed pack has to reach.
 *
 * See `"no-room"`. Not zero, because the measured failure is 300x150 rather than
 * 0x0; and a share rather than a floor, because a small window is not a fault.
 */
export const MIN_FILL = 0.5

/** The two clocks the faults above are judged against. */
export type LivenessLimits = {
  /** How often the frame is measured. */
  readonly pollMs: number
  /** Visible time a frame gets to fill the window it was given. */
  readonly blankAfterMs: number
  /** Visible time a pack granted `items` gets to ask for one. */
  readonly muteAfterMs: number
}

export const LIVENESS: LivenessLimits = {
  pollMs: 250,
  // Generous, because the cost of being wrong is an accusation. A stage that is
  // animating in, a frame measured before first layout and a frame in a tab that
  // has just come back can all measure small or nothing for a moment; five
  // seconds of *visible* time is far past any of them, and one full measurement
  // at any point settles the question forever.
  blankAfterMs: 5_000,
  // Thirty seconds is roughly three thousand times the fleet's measured
  // handshake-to-`items.next` latency. Nothing that starts at all takes it.
  muteAfterMs: 30_000,
}

/** One measurement of the two things that cross the boundary. */
export type Observation = {
  /** Whether the host document was visible over the interval just elapsed. */
  readonly visible: boolean
  /**
   * Whether the frame's box means anything right now.
   *
   * False when the host window has no box of its own, when the frame is not in
   * the document, or when the host has hidden it — a sheet over a paused pack, a
   * teardown in flight. A measurement the host caused is not a pack's fault, and
   * the watch neither accuses on it nor counts the time.
   */
  readonly measurable: boolean
  readonly width: number
  readonly height: number
  /** The window the frame is supposed to fill. The only honest yardstick. */
  readonly windowWidth: number
  readonly windowHeight: number
  /** Messages received from the pack since the port was transferred. */
  readonly messages: number
}

/** What the watch carries between observations. */
export type Watch = {
  /** Visible, measurable time since the handshake. */
  readonly visibleMs: number
  /** Set by the first measurement that filled the window, and never cleared. */
  readonly everFilled: boolean
  /** Faults already said. Each is said once. */
  readonly said: readonly LivenessFault[]
}

export const newWatch = (): Watch => ({ visibleMs: 0, everFilled: false, said: [] })

/** Whether a frame this size is showing a game in a window that size. */
export function fillsWindow(observation: Observation): boolean {
  return (
    observation.width >= observation.windowWidth * MIN_FILL &&
    observation.height >= observation.windowHeight * MIN_FILL
  )
}

/**
 * Fold one observation into the watch, and report anything newly wrong.
 *
 * A pure reducer, so the whole judgement — including every reason it should
 * stay quiet — is testable as a sequence of observations rather than as a
 * timing race against a browser.
 *
 * `asksForItems` is whether the pack was granted `items`. A pack that never
 * asked for questions is not expected to request any, and "never-spoke" is not
 * a fault it can commit.
 */
export function step(
  watch: Watch,
  observation: Observation,
  dtMs: number,
  asksForItems: boolean,
  limits: LivenessLimits = LIVENESS,
): { readonly watch: Watch; readonly faults: readonly LivenessFault[] } {
  const usable = observation.visible && observation.measurable
  const filled = usable && fillsWindow(observation)
  const next: Watch = {
    visibleMs: usable ? watch.visibleMs + dtMs : watch.visibleMs,
    everFilled: watch.everFilled || filled,
    said: watch.said,
  }

  const faults: LivenessFault[] = []
  const say = (fault: LivenessFault) => {
    if (!next.said.includes(fault)) faults.push(fault)
  }
  // A frame that has never once filled the window, after five seconds of being
  // visible in a window that itself has a size.
  if (usable && !next.everFilled && next.visibleMs >= limits.blankAfterMs) say("no-room")
  // Silence, and only silence. One message at any point in the pack's life
  // clears this forever — an idle child produces exactly as little traffic as a
  // crashed pack, so a *gap* in traffic is not evidence of anything.
  if (asksForItems && observation.messages === 0 && next.visibleMs >= limits.muteAfterMs) {
    say("never-spoke")
  }

  return {
    watch: faults.length === 0 ? next : { ...next, said: [...next.said, ...faults] },
    faults,
  }
}

/**
 * Whether anything is still worth watching for.
 *
 * The box latches on its first full measurement and silence latches on the pack's
 * first message, so a healthy pack stops being polled within a second of starting
 * rather than for the length of a child's run.
 */
export function stillWatching(watch: Watch, messages: number, asksForItems: boolean): boolean {
  const room = !watch.everFilled && !watch.said.includes("no-room")
  const mute = asksForItems && messages === 0 && !watch.said.includes("never-spoke")
  return room || mute
}

/** What is written to the console. Says what was measured, and what to go read. */
export function describeFault(
  packId: string,
  fault: LivenessFault,
  observation: Observation,
): string {
  const size = (w: number, h: number) => `${String(Math.round(w))}x${String(Math.round(h))}`
  return fault === "no-room"
    ? `[packs] ${packId} is framed at ${size(observation.width, observation.height)} in a ` +
        `${size(observation.windowWidth, observation.windowHeight)} window. The pack may be ` +
        `running perfectly; the child is not seeing a game. The frame's box comes from ` +
        `.pack-frame -> .pack-frame-host -> the fixed, inset:0 div in Stage.tsx, and something ` +
        `in that chain has stopped giving it one — 300x150 is an iframe with nothing to resolve ` +
        `its percentages against.`
    : `[packs] ${packId} took its port and has not sent one message since. Every game asks for ` +
        `an item before it mounts, so this pack did not get that far. If it is showing "runs ` +
        `inside Dynawalla", that message is false — it is connected to this host.`
}

/* -------------------------------------------------------------------------- */

export type MountOptions = {
  readonly container: HTMLElement
  readonly packId: string
  /** From `packs_entry_url`. Always on the pack scheme. */
  readonly entryUrl: string
  readonly granted: readonly Capability[]
  readonly services: HostServices
  readonly hostVersion: string
  /** The frame's accessible name. A pack is a region of the app, not a picture. */
  readonly title: string
  readonly onError?: (reason: string) => void
  /**
   * Told when the host can see for itself that this pack is showing nothing.
   *
   * Deliberately not `onError`: that draws a curtain over the pack and ends the
   * run, and neither fault is certain enough to spend a child's session on. The
   * faults are always written to the console whether this is given or not.
   */
  readonly onFault?: (fault: LivenessFault, message: string) => void
  /** Injected in tests. Defaults to the real document. */
  readonly document?: Document
  readonly window?: Window
  /** Injected in tests, so a suite does not wait out half a minute. */
  readonly liveness?: Partial<LivenessLimits>
}

export type MountedPack = {
  readonly element: HTMLIFrameElement
  readonly bridge: Bridge
  /** True once the pack has completed the handshake. */
  readonly connected: () => boolean
  /** What the host has observed to be wrong with this pack. Usually empty. */
  readonly faults: () => readonly LivenessFault[]
  send(event: HostEventName, data?: unknown): void
  pushSettings(settings: Settings): void
  dispose(): void
}

/**
 * Frame a pack and connect it.
 *
 * Idempotent teardown is the whole of the lifecycle contract: `dispose` may be
 * called twice, may be called before the handshake completes, and must leave no
 * listener, no port and no element behind. React's StrictMode calls the effect
 * cleanup on the first mount, and a pack runtime that leaks one engine per
 * mount is the failure this repository has already paid for once.
 */
export function mountPack(options: MountOptions): MountedPack {
  const doc = options.document ?? document
  const win = options.window ?? window

  const bridge = createBridge({
    packId: options.packId,
    granted: options.granted,
    services: options.services,
  })

  const frame = doc.createElement("iframe")
  frame.title = options.title
  frame.className = "pack-frame"
  // No `allow-same-origin`. See the module note — this is the boundary.
  frame.setAttribute("sandbox", "allow-scripts")
  // Nothing in the permissions policy: no camera, no microphone, no geolocation,
  // no autoplay grant. A pack asks the host for feedback, it does not take it.
  frame.setAttribute("allow", "")
  frame.setAttribute("referrerpolicy", "no-referrer")
  frame.setAttribute("loading", "eager")

  let channel: MessageChannel | null = null
  let connected = false
  let disposed = false
  let timer: ReturnType<typeof setTimeout> | null = null

  /* ------------------------------ liveness ------------------------------- */

  const limits: LivenessLimits = { ...LIVENESS, ...options.liveness }
  // A pack that did not ask for questions cannot be guilty of never asking.
  const asksForItems = options.granted.includes("items")
  let watch = newWatch()
  let messages = 0
  let poll: ReturnType<typeof setInterval> | null = null

  /**
   * Read the two channels that cross the boundary.
   *
   * Every "cannot tell" here is a false positive that was not shipped. The frame
   * is measured only while the host document is visible, the host window has a
   * box of its own, the frame is still in the document, and nothing above the
   * frame has hidden it — a sheet over a paused pack, a teardown in flight, a
   * stage collapsed by the app rather than by the pack.
   */
  const observe = (): Observation => {
    const box = frame.getBoundingClientRect()
    // `checkVisibility` walks ancestors, which is the whole reason for using it
    // over the frame's own computed style; a host that hid the frame's *parent*
    // has hidden the frame. Optional-called because a fake frame in a test has
    // no layout at all, and "no opinion" must read as visible rather than hidden.
    const shown = frame.checkVisibility?.() !== false
    return {
      visible: doc.visibilityState !== "hidden",
      measurable: shown && frame.isConnected !== false && win.innerWidth >= 1 && win.innerHeight >= 1,
      width: box.width,
      height: box.height,
      windowWidth: win.innerWidth,
      windowHeight: win.innerHeight,
      messages,
    }
  }

  const tick = () => {
    if (disposed) return
    const observation = observe()
    const result = step(watch, observation, limits.pollMs, asksForItems, limits)
    watch = result.watch
    for (const fault of result.faults) {
      const message = describeFault(options.packId, fault, observation)
      // Loud, always. This is the whole point: the last time a pack showed a
      // child nothing, the only thing that noticed was the founder.
      console.error(message)
      options.onFault?.(fault, message)
    }
    if (!stillWatching(watch, messages, asksForItems) && poll !== null) {
      clearInterval(poll)
      poll = null
    }
  }

  const onReady = (event: MessageEvent) => {
    // The only thing that authenticates this message is the frame it came from.
    // `event.origin` is `"null"` for a sandboxed frame and is worth nothing.
    if (disposed || connected) return
    if (event.source !== frame.contentWindow) return
    const data: unknown = event.data
    if (typeof data !== "object" || data === null) return
    if ((data as { event?: unknown }).event !== "ready") return

    connected = true
    if (timer !== null) clearTimeout(timer)
    timer = null

    channel = new MessageChannel()
    channel.port1.onmessage = (message: MessageEvent) => {
      // Counted before it is validated. "Did the pack use its port" is a
      // different question from "was the message any good", and a pack sending
      // garbage has at least reached the code that sends.
      messages += 1
      void bridge.handle(message.data).then((response) => {
        if (response !== null && !disposed) channel?.port1.postMessage(response)
      })
    }
    channel.port1.start()

    // The watch starts at the handshake, not at mount: before the port is
    // transferred the pack has no way to speak, and the timeout below is already
    // the net for that.
    poll = setInterval(tick, limits.pollMs)

    const connect: Connect = {
      event: "connect",
      protocol: PROTOCOL_VERSION,
      sdk: SDK_VERSION,
      host: options.hostVersion,
      packId: options.packId,
      granted: options.granted,
      settings: options.services.settings(),
    }
    // `"*"` because an opaque origin cannot be named. The payload is not a
    // secret; the transferred port is the grant, and only this frame receives
    // it. `frame-src` in the app's CSP is what keeps this frame from being
    // navigated somewhere else first.
    frame.contentWindow?.postMessage(connect, "*", [channel.port2])
  }

  win.addEventListener("message", onReady)

  timer = setTimeout(() => {
    if (connected || disposed) return
    options.onError?.("This pack did not start.")
  }, HANDSHAKE_TIMEOUT_MS)

  frame.addEventListener("error", () => options.onError?.("This pack could not be opened."))
  frame.src = options.entryUrl
  options.container.appendChild(frame)

  const send = (event: HostEventName, data?: unknown) => {
    if (!connected || disposed) return
    channel?.port1.postMessage(data === undefined ? { event } : { event, data })
  }

  return {
    element: frame,
    bridge,
    connected: () => connected,
    faults: () => watch.said,
    send,
    pushSettings: (settings) => send("settings", settings),
    dispose: () => {
      if (disposed) return
      disposed = true
      if (timer !== null) clearTimeout(timer)
      timer = null
      if (poll !== null) clearInterval(poll)
      poll = null
      // Tell the pack first, so it can stop its own loop before its port dies.
      if (connected) channel?.port1.postMessage({ event: "dispose" })
      win.removeEventListener("message", onReady)
      if (channel) {
        channel.port1.onmessage = null
        channel.port1.close()
        channel.port2.close()
        channel = null
      }
      // Blanking `src` before removal stops an in-flight load; removing the
      // element is what destroys the frame's realm and everything in it.
      frame.src = "about:blank"
      frame.remove()
    },
  }
}
