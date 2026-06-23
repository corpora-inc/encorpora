// Dev-only console forwarder.
//
// When the pack is loaded from the dev manifest server (typically
// http://<lan-ip>:8989/pronunciation-coach/), forwards every
// console.log / console.warn / console.error / console.info call to
// a sibling HTTP endpoint on port 8990 (`scripts/dev-console-server.js`
// running on the user's Mac). The Mac script appends to
// /tmp/pc-console.log, which Claude can read directly without the
// user copy-pasting Safari Web Inspector output.
//
// **Production-safe.** If `document.currentScript.dataset
// .corpGameBaseUrl` is missing, or looks like a `corpan-pack://`
// install URL, or is HTTPS (production), the forwarder never
// activates and console calls behave identically to before.
//
// Behavior is fire-and-forget: failed POSTs are swallowed silently
// so a slow / unreachable forwarder never throttles the pack.

const ENDPOINT_PATH = "/__console"
const FORWARDER_PORT = "8990"

function detectDevConsoleUrl(): string | null {
    if (typeof document === "undefined") return null
    const baseUrl =
        (document.currentScript as HTMLScriptElement | null)?.dataset
            ?.corpGameBaseUrl ?? null
    if (!baseUrl) return null
    let parsed: URL
    try {
        parsed = new URL(baseUrl)
    } catch {
        return null
    }
    // Only activate for plain HTTP dev manifests on a LAN. Skip
    // corpan-pack://, https:// (CDN production), file://, etc.
    if (parsed.protocol !== "http:") return null
    return `${parsed.protocol}//${parsed.hostname}:${FORWARDER_PORT}${ENDPOINT_PATH}`
}

function safeStringify(arg: unknown): unknown {
    if (arg === null || arg === undefined) return arg
    if (
        typeof arg === "string" ||
        typeof arg === "number" ||
        typeof arg === "boolean"
    ) {
        return arg
    }
    if (arg instanceof Error) {
        return { __error: true, name: arg.name, message: arg.message, stack: arg.stack }
    }
    try {
        // Attempt structured serialization. JSON.stringify on objects with
        // circular refs throws — fall back to String(arg) below.
        JSON.stringify(arg)
        return arg
    } catch {
        try {
            return String(arg)
        } catch {
            return "[unserializable]"
        }
    }
}

let installed = false

export function installDevConsoleForwarder(): void {
    if (installed) return
    const url = detectDevConsoleUrl()
    if (!url) return
    installed = true

    const original = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
    }

    const forward = (level: "log" | "info" | "warn" | "error", args: unknown[]) => {
        try {
            const body = JSON.stringify({
                level,
                args: args.map(safeStringify),
                ts: Date.now(),
            })
            // fetch with keepalive to ride out unmounts mid-flight.
            // Errors swallowed: a missing dev server should never
            // affect the pack's behavior.
            fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body,
                keepalive: true,
            }).catch(() => undefined)
        } catch {
            // never throw from the wrapper
        }
    }

    const make = (level: "log" | "info" | "warn" | "error") =>
        (...args: unknown[]) => {
            forward(level, args)
            original[level](...args)
        }

    console.log = make("log")
    console.info = make("info")
    console.warn = make("warn")
    console.error = make("error")

    // Also forward unhandled errors and promise rejections so we see
    // them in /tmp/pc-console.log even if no JS code logged them.
    if (typeof window !== "undefined") {
        window.addEventListener("error", (e) => {
            forward("error", [
                "[unhandled error]",
                e.message,
                e.filename,
                `${e.lineno}:${e.colno}`,
            ])
        })
        window.addEventListener("unhandledrejection", (e) => {
            forward("error", ["[unhandled rejection]", String(e.reason)])
        })
    }

    original.log(`[devConsole] forwarding to ${url}`)
}
