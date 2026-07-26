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
  /** Injected in tests. Defaults to the real document. */
  readonly document?: Document
  readonly window?: Window
}

export type MountedPack = {
  readonly element: HTMLIFrameElement
  readonly bridge: Bridge
  /** True once the pack has completed the handshake. */
  readonly connected: () => boolean
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
      void bridge.handle(message.data).then((response) => {
        if (response !== null && !disposed) channel?.port1.postMessage(response)
      })
    }
    channel.port1.start()

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
    send,
    pushSettings: (settings) => send("settings", settings),
    dispose: () => {
      if (disposed) return
      disposed = true
      if (timer !== null) clearTimeout(timer)
      timer = null
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
