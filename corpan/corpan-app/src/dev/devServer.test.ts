// What the dev server is willing to hand out over HTTP, as a gate rather than
// a comment in vite.config.ts.
//
// `server.fs` has no effect on `npm run build`, on `vite preview`, or on the
// shipped Tauri bundle — Rollup has no fs guard and the installed app loads
// from its bundle, not from a server. So nothing here protects a Corpán user.
// What it protects is the founder's machine, while `npm run dev` /
// `npm run tauri android dev` is running.
//
// That window is not hypothetical. `TAURI_DEV_HOST` is how you run on a phone,
// and setting it takes the server off 127.0.0.1 and onto the LAN, where every
// file the fs guard allows is readable by any host on the network. The repo is
// public, so its source is not the concern. The concern is the material that is
// deliberately NOT in it: `src-tauri/.gitignore` ignores `*.jks` precisely
// because an upload keystore is expected to live inside the dev server's root.
//
// Rather than parse vite.config.ts as text, this resolves it through Vite and
// asks the resolved config's own matcher. `fsDenyGlob` is the exact picomatch
// instance `server.fs` uses at request time, so a passing test here means the
// real server denies these paths — and the "Vite's defaults survive" check is
// computed from the INSTALLED Vite rather than from a hardcoded list, so a
// version bump that adds a default cannot slip past it.

import { test } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { resolveConfig } from "vite"

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, "../..")
const configFile = path.join(appRoot, "vite.config.ts")

type ResolvedWithMatcher = Awaited<ReturnType<typeof resolveConfig>> & {
  fsDenyGlob: (file: string) => boolean
}

const resolve = async (configArg: string | false) =>
  (await resolveConfig(
    { configFile: configArg, root: appRoot, logLevel: "silent" },
    "serve"
  )) as ResolvedWithMatcher

const ours = await resolve(configFile)
// The same Vite, with no config at all: its untouched defaults.
const bare = await resolve(false)

/**
 * Credential material that can plausibly land inside this app's tree. Every
 * one of these was served with a 200 and its body before the deny list existed.
 */
const MUST_BE_DENIED = [
  "src-tauri/upload-keystore.jks",
  "src-tauri/release.keystore",
  "src-tauri/AuthKey_ABC123.p8",
  "src-tauri/dist.p12",
  "src-tauri/gen/apple/build/embedded.mobileprovision",
  "src-tauri/distribution.cer",
  "src-tauri/CertificateSigningRequest.certSigningRequest",
  "src-tauri/play-service-account.json",
  ".env",
  ".env.local",
]

/** Things `npm run dev` must keep serving. */
const MUST_BE_SERVED = [
  "src/main.tsx",
  "index.html",
  "public/locales/en/common.json",
  "src-tauri/tauri.conf.json",
  "../packs/drift/manifest.json",
]

test("the dev server denies signing and credential material", () => {
  const served = MUST_BE_DENIED.filter((file) => !ours.fsDenyGlob(path.join(appRoot, file)))
  assert.deepEqual(served, [], "the dev server would hand these files to anyone who asks")
})

test("the deny list does not swallow the app itself", () => {
  const denied = MUST_BE_SERVED.filter((file) => ours.fsDenyGlob(path.join(appRoot, file)))
  assert.deepEqual(denied, [], "the deny list is too broad — dev would 403 on these")
})

/**
 * A concrete filename each glob would match, so "did we keep Vite's defaults"
 * can be asked behaviourally instead of by string equality. Our list is a
 * deliberate superset — `*.{crt,pem,key,p12,pfx,cer,der}` covers 8.0's
 * `*.{crt,pem}` without being the same string — and it is the coverage, not
 * the spelling, that matters.
 */
function examplesFor(pattern: string): string[] {
  const braces = /\{([^}]*)\}/.exec(pattern)
  if (braces) {
    return braces[1]
      .split(",")
      .flatMap((option) => examplesFor(pattern.replace(braces[0], option.trim())))
  }
  return [pattern.replace(/\*\*\//g, "").replace(/\*+/g, "x")]
}

test("restating the deny list keeps every default of the installed Vite", () => {
  // Vite REPLACES `server.fs.deny` rather than extending it
  // (`mergeWithDefaultsRecursively` assigns arrays), so restating five of six
  // silently drops the sixth: a config that looks like hardening and is the
  // opposite. `bare` is whatever the installed version ships today, so a Vite
  // upgrade that adds a default is checked here without anyone editing a list.
  const uncovered = bare.server.fs.deny
    .flatMap(examplesFor)
    .filter((file) => !ours.fsDenyGlob(path.join(appRoot, file)))
  assert.deepEqual(
    uncovered,
    [],
    "a Vite default is no longer covered by server.fs.deny — the array is replaced, not merged"
  )
})

test("the dev server's filesystem reach is not widened past Vite's default", () => {
  // Vite's default here is this app's own directory: `searchForWorkspaceRoot`
  // finds no workspace marker above it and falls back to the nearest package
  // root. `../packs/shared` is reached through the import graph
  // (`safeModulePaths`, consulted before `allow`), not through this list.
  //
  // Note that narrowing `allow` could never have fixed the keystore: `allow` is
  // a list of roots, not a subtractive filter, and `src-tauri/` is inside the
  // root the app is served from. `deny` is checked first and is the only lever.
  assert.deepEqual(
    ours.server.fs.allow,
    bare.server.fs.allow,
    "server.fs.allow no longer matches Vite's default"
  )
})

test("the dev server stays on loopback unless TAURI_DEV_HOST is set", () => {
  // The one switch that puts this server on the network, and the reason the
  // deny list is load-bearing. An unconditional `host: true` would bind every
  // interface for every developer, always.
  //
  // Asserted as a relationship rather than against an absolute, so running the
  // suite in a shell that already exports TAURI_DEV_HOST is not a false alarm.
  const devHost = process.env.TAURI_DEV_HOST
  assert.equal(
    ours.server.host,
    devHost || "127.0.0.1",
    devHost
      ? "TAURI_DEV_HOST is set but the dev server did not follow it"
      : "the dev server no longer defaults to loopback"
  )
})

test("the /packs middleware enforces the same denies Vite does", async () => {
  // This middleware streams from disk itself and never passes through
  // `server.fs`, so it is a complete bypass of every assertion above unless it
  // repeats the check.
  const plugin = ours.plugins.find((p) => p.name === "serve-corpan-packs")
  assert.ok(plugin?.configureServer, "the pack-serving plugin is gone")

  const routes = new Map<string, (req: any, res: any, next: () => void) => void>()
  const configure = plugin.configureServer as any
  await configure({ middlewares: { use: (route: string, fn: any) => routes.set(route, fn) } })
  const packs = routes.get("/packs")
  assert.ok(packs, "/packs is no longer served by this middleware")

  // The rejection is synchronous; falling through to the file lookup is not
  // (`fs.stat` calls back), so this settles on whichever happens.
  const ask = (url: string) =>
    new Promise<{ status: number; passed: boolean }>((done) => {
      const res = {
        statusCode: 200,
        end: () => done({ status: res.statusCode, passed: false }),
        setHeader: () => {},
      }
      packs({ url }, res, () => done({ status: res.statusCode, passed: true }))
    })

  assert.equal((await ask("/some-pack/upload-keystore.jks")).status, 403, "a keystore under packs/ is servable")
  assert.equal((await ask("/some-pack/AuthKey.p8")).status, 403, "an App Store Connect key under packs/ is servable")
  assert.equal((await ask("/some-pack/.env")).status, 403, "a .env under packs/ is servable")
  // A bare `startsWith(rootDir)` also accepts a sibling directory whose name
  // merely begins with the root's, so the check has to include the separator.
  assert.equal(
    (await ask("/../corpan-app/src-tauri/upload-keystore.jks")).status,
    403,
    "path traversal escapes packs/"
  )

  const legit = await ask("/no-such-pack/manifest.json")
  assert.equal(legit.status, 200, "a normal pack request is being blocked")
  assert.ok(legit.passed, "a normal pack request never reached the file lookup")
})
