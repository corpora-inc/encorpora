// Tests for `shouldDevReloadManifest` — the scoping fix behind the iPad
// `tauri ios dev` beatlounge crash. Run with the repo's native runner (no extra
// deps): `npm test` → node --experimental-strip-types --test src/**/*.test.ts
//
// devReload.ts is React-free and uses only extensionless-free relative-less
// imports, so the bare strip-types loader can import it directly.
//
// The headline guarantee: an INSTALLED catalog pack (`corpan-pack://localhost/`
// on iOS/desktop, `http://corpan-pack.localhost/` on Android) is NEVER
// dev-reloaded — even though its host parses to `localhost`/`*.localhost`. Only
// packs served from the local Vite `/packs` middleware (localhost / loopback /
// private-LAN IP, in a DEV build) are polled.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  shouldDevReloadManifest,
  isContentPackProtocolUrl,
} from "./devReload.ts"

test("installed corpan-pack URL is never dev-reloaded (iOS/desktop)", () => {
  // The exact URL the native installer emits on iOS/desktop, which is what the
  // host received for beatlounge 0.3.1 and wrongly polled.
  const url = "corpan-pack://localhost/beatlounge/manifest.json"
  assert.equal(isContentPackProtocolUrl(url), true)
  assert.equal(shouldDevReloadManifest(url, true), false)
  assert.equal(shouldDevReloadManifest(url, false), false)
})

test("installed corpan-pack URL is never dev-reloaded (Android/Windows form)", () => {
  const url = "http://corpan-pack.localhost/beatlounge/manifest.json"
  assert.equal(isContentPackProtocolUrl(url), true)
  assert.equal(shouldDevReloadManifest(url, true), false)
})

test("production never polls, regardless of URL", () => {
  assert.equal(
    shouldDevReloadManifest("http://localhost:1420/packs/beatlounge/manifest.json", false),
    false
  )
  assert.equal(
    shouldDevReloadManifest("http://192.168.1.10:1420/packs/beatlounge/manifest.json", false),
    false
  )
})

test("dev middleware pack on localhost IS dev-reloaded in a dev build", () => {
  assert.equal(
    shouldDevReloadManifest("http://localhost:1420/packs/beatlounge/manifest.json", true),
    true
  )
})

test("dev middleware pack over the Mac's LAN IP (tethered iPad) IS dev-reloaded", () => {
  // This is the legitimate dev-reload case: a pack genuinely served from the
  // Vite /packs middleware, reached from the iPad over the Mac's private IP.
  assert.equal(
    shouldDevReloadManifest("http://192.168.1.10:1420/packs/beatlounge/manifest.json", true),
    true
  )
})

test("a public https catalog URL is never dev-reloaded", () => {
  assert.equal(
    shouldDevReloadManifest("https://encorpora.io/corpan/packs/beatlounge/manifest.json", true),
    false
  )
})
