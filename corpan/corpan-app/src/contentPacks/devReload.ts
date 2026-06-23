// Dev-reload scoping — kept in a React-free module so it is unit-testable with
// the repo's bare `node --experimental-strip-types --test` runner (no DOM, no
// bundler). `ContentPackHost` imports these to decide whether a pack's manifest
// should be polled for live changes during pack development.
//
// THE BUG THIS FIXES (iPad `tauri ios dev` over LAN, beatlounge 0.3.1):
// an INSTALLED catalog pack is launched from a `corpan-pack://localhost/<id>/
// manifest.json` base (iOS/desktop) or `http://corpan-pack.localhost/...`
// (Android/Windows). Both parse to a hostname of `localhost` / `*.localhost`,
// so the old `isLocalhostUrl(url) || isPrivateNetworkUrl(url)` test treated
// EVERY installed pack as dev-reloadable. The dev-reload poller then re-fetches
// the manifest with a `Date.now()` cache-bust and, on the slightest churn,
// re-runs `load()` while the previous pack's React root is still mid-teardown
// (the teardown is deferred to a `requestAnimationFrame`) → the pack's
// `createRoot(container)` runs against a container that already has a live root
// → "createRoot() on a container that has already been passed to createRoot()"
// + a detached-node `NotFoundError`. It only surfaced on LAN dev (where remount
// churn lines up) but the scoping was wrong on every platform.
//
// CORRECT SCOPE: dev-reload polling is ONLY for packs actually served from the
// local Vite dev middleware (the `/packs/<id>` path on the app's own dev
// origin). A pack the user DOWNLOADED from the catalog (a `corpan-pack://`
// install) must NEVER be polled, regardless of how the app shell itself is
// served (LAN dev included).

const isContentPackProtocolUrl = (rawUrl: string) =>
  rawUrl.startsWith("corpan-pack://") ||
  rawUrl.startsWith("http://corpan-pack.localhost/") ||
  rawUrl.startsWith("https://corpan-pack.localhost/")

/**
 * Decide whether a pack's manifest should be dev-reload polled.
 *
 * @param resolvedManifestUrl  the pack's manifest URL, already resolved against
 *   `window.location.href` (so it is absolute).
 * @param isDev  `import.meta.env.DEV` — dev-reload is a build-DEV-only affordance.
 *
 * Rules (all must hold to poll):
 *   1. We are in a dev build (`isDev`). Production never polls.
 *   2. The pack is NOT an installed `corpan-pack://` pack. Installed/catalog
 *      packs are immutable on disk and must never be hot-reloaded — this is the
 *      load-bearing fix for the iPad crash.
 *   3. The manifest is served from a local/dev-network HTTP origin (localhost,
 *      loopback, or a private-LAN IP — the Vite `/packs` middleware, reachable
 *      from a tethered device over the Mac's LAN IP during `tauri ios dev`).
 */
export const shouldDevReloadManifest = (
  resolvedManifestUrl: string,
  isDev: boolean
): boolean => {
  if (!isDev) return false
  // An installed catalog pack is never a dev-reload target, even though its
  // `corpan-pack://localhost` / `corpan-pack.localhost` host LOOKS local.
  if (isContentPackProtocolUrl(resolvedManifestUrl)) return false
  return (
    isLocalhostUrl(resolvedManifestUrl) ||
    isPrivateNetworkUrl(resolvedManifestUrl)
  )
}

export const isLocalhostUrl = (rawUrl: string) => {
  try {
    const resolved = new URL(rawUrl, locationHref())
    return (
      resolved.hostname === "localhost" ||
      resolved.hostname === "127.0.0.1" ||
      resolved.hostname.endsWith(".localhost")
    )
  } catch {
    return false
  }
}

export const isPrivateNetworkUrl = (rawUrl: string) => {
  try {
    const resolved = new URL(rawUrl, locationHref())
    const host = resolved.hostname
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return true
    }
    if (host.endsWith(".localhost") || host.endsWith(".local")) {
      return true
    }
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (ipv4) {
      const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
      if (a === 10 || a === 127) return true
      if (a === 192 && b === 168) return true
      if (a === 172 && b >= 16 && b <= 31) return true
      if (a === 169 && b === 254) return true
      return false
    }
    return host.startsWith("fe80:") || host.startsWith("fd") || host.startsWith("fc")
  } catch {
    return false
  }
}

export { isContentPackProtocolUrl }

// `window` may be absent under the bare Node test runner; fall back to a base
// that keeps relative-URL resolution working without throwing.
const locationHref = () =>
  typeof window !== "undefined" && window.location
    ? window.location.href
    : "http://localhost/"
