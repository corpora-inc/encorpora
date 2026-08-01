#!/usr/bin/env node
/* ───────────────────────────────────────────────────────────────────────────
   Dynawalla — the eyes.

       node tools/capture.mjs                # build, serve, capture everything
       node tools/capture.mjs --no-build     # reuse dist/ and tools/.harness-dist
       node tools/capture.mjs --only=settings,parents
       node tools/capture.mjs --widths=390,1440 --themes=dark
       node tools/capture.mjs --textsize=largest   # the app's own a11y setting
       node tools/capture.mjs --probe=q.js         # one expression, every page

   Output:
       tools/shots/<theme>/<screen>-<width>.png     (gitignored — derived)
       tools/shots/measurements.json                (committed)
       tools/shots/AUDIT.md                         (committed, written by hand)

   The PNGs are deliberately NOT committed: nine megabytes an run, `*.png` is
   Git LFS repo-wide, and every one of them is back in seventy seconds. The
   numbers and the findings are committed, because those are what a reviewer
   without a machine to run Chrome on actually needs.

   ── WHY THIS EXISTS ───────────────────────────────────────────────────────

   The standing bar for this app is "premium native-like behavior", and every
   tell that breaks it is a VISUAL fact: a drawn scrollbar track, a page that
   slides sideways, a control smaller than a child's fingertip, a text pair
   that fails AA, spacing that does not match the screen next door. None of
   those can be reviewed by reading a component. Two of this app's five
   destinations once rendered completely empty for weeks with a green test
   suite, which is the same lesson in its most expensive form.

   So this tool takes the app apart into every screen × every size × both
   themes, writes a PNG of each, and — more usefully — writes the measurements
   that a screenshot cannot be trusted to reveal: horizontal overflow, elements
   escaping the viewport, interactive targets under 44 px, and the computed
   colour of every text run against the ground it actually sits on, with the
   contrast ratio already worked out.

   It is meant to be re-run. Change a token, run this, look again.

   ── THE HEADLESS-CHROME 500px CLAMP TRAP ──────────────────────────────────

   Read this before "fixing" the tool to be simpler.

   `chrome --headless --window-size=390,844 --screenshot=out.png` does NOT
   render at 390 px. Headless Chrome clamps its window — and therefore its
   viewport — to a 500 px minimum. What you get is a 500 px render cropped to
   390, which looks *exactly* like a mobile layout bug: cards clipped at the
   right edge, the header running off the side. Hours have been lost to
   diagnosing a defect that was the harness.

   There are two ways out. One is to load the app inside an `<iframe>` of the
   true width in a wrapper page served over http (`file://` iframes are
   blocked by the same-origin rules that make the wrapper useful in the first
   place). The other — used here — is to drive Chrome over the DevTools
   protocol and set the viewport with `Emulation.setDeviceMetricsOverride`,
   which is not subject to the window clamp at all, and then take the
   screenshot with `Page.captureScreenshot`. That path also gives us
   `Runtime.evaluate`, which is what makes the measurements possible.

   CDP needs a WebSocket. Node 24 has one built in, so this file has no
   dependencies beyond what the app already installs — Chrome is found on disk
   and driven by flags, and there is no puppeteer.

   The tool asserts the clamp is beaten: every capture records the viewport
   width it actually rendered at, and a mismatch is a hard failure rather than
   a screenshot nobody looks at twice.

   ── WHAT IT SEEDS, AND WHY THAT IS NOT CHEATING ───────────────────────────

   The catalogue is the front door and it is empty in a browser: `useLibrary`
   refuses to invent packs when there is no Tauri runtime, which is the honest
   answer and the right one. Rather than mock the *screen*, this seeds the
   layer underneath it — a shim for `window.__TAURI_INTERNALS__` that answers
   `packs_list` with the REAL `pack.json` of all 25 games in `dynawalla/games/`.
   The app then takes its own native path: the same manifest parse, the same
   run gate, the same localisation, the same registry mirror. Names, blurbs,
   skills and grade bands on the captured cards are the shipped ones.

   Everything else a screen reads is device state in `localStorage`, seeded to
   the same shapes the zustand stores persist (see `src/app/profile.ts` for the
   key scheme). A screen that is empty in these captures is empty in the app.

   ── WHAT IT CANNOT SEE ────────────────────────────────────────────────────

   * Safe-area insets. `env(safe-area-inset-*)` is 0 in Chrome, so the padding
     a notch adds is not in these shots. Check that on a device.
   * The transient touch scroll indicator, and anything else a real WebView
     draws for a coarse pointer. Chrome here is a fine pointer, so the app's
     `@media (pointer: coarse)` scrollbar suppression is deliberately NOT in
     effect — a scrollbar visible in a 390 px shot is the desktop behaviour,
     not a defect. `--coarse` forces the emulation on if you want to check it.
   * Motion. These are still frames.
   ─────────────────────────────────────────────────────────────────────────── */

import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(HERE, "..")
const GAMES = path.resolve(APP, "../games")
const DIST = path.join(APP, "dist")
const HARNESS_DIST = path.join(HERE, ".harness-dist")
const SHOTS = path.join(HERE, "shots")
const NPM = path.join(process.env["HOME"] ?? "", ".nvm/versions/node/v24.18.0/bin/npm")

/* ── What is captured ─────────────────────────────────────────────────────
   `app` screens are the shipped shell at a route hash. `harness` screens are
   the pass sheet, which the shell cannot currently reach (see
   tools/harness/main.tsx for the reason) and which is therefore mounted on its
   own. `act` names a short click sequence run after load, before the shot. */
const SCREENS = [
  { name: "packs", kind: "app", hash: "#/" },
  // The same screen, whole. 27 cards do not fit a phone viewport, and a grid's
  // rhythm is a property of the grid rather than of its first two rows.
  { name: "packs-full", kind: "app", hash: "#/", full: true },
  { name: "progress", kind: "app", hash: "#/progress" },
  { name: "profiles", kind: "app", hash: "#/profiles" },
  { name: "settings", kind: "app", hash: "#/settings" },
  { name: "parents", kind: "app", hash: "#/parents" },
  // Developer mode on: the row count triples and the values get long, which is
  // the state that broke the parent area sideways once already.
  { name: "parents-dev", kind: "app", hash: "#/parents", dev: true, full: true },
  { name: "pass-rest", kind: "harness" },
  { name: "pass-gate", kind: "harness", act: "gate" },
  { name: "pass-offer", kind: "harness", act: "offer" },
]

/** Width → the height of the device that width belongs to. Not arbitrary. */
const VIEWPORTS = {
  // The narrowest screen this app ships to, and the one every width-dependent
  // defect shows on first. It was missing from this table, so the tab bar's
  // label truncation — which fails WCAG 1.4.4 here at the SHIPPED text size,
  // not only at an accessibility one — was in none of the captures.
  320: { height: 568, dsf: 2, mobile: true }, //  iPhone SE (1st gen)
  390: { height: 844, dsf: 2, mobile: true }, //  iPhone 14 / 15
  430: { height: 932, dsf: 2, mobile: true }, //  iPhone 15 Pro Max
  834: { height: 1112, dsf: 2, mobile: true }, // iPad Air, portrait
  1024: { height: 768, dsf: 2, mobile: true }, // iPad, landscape
  1440: { height: 900, dsf: 1, mobile: false }, // desktop
}

const THEMES = ["light", "dark"]

/* ── Arguments ───────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const option = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}
const list = (name) => {
  const raw = option(name)
  return raw === null ? null : raw.split(",").map((s) => s.trim()).filter(Boolean)
}

const wantScreens = list("only")
const wantWidths = list("widths")?.map(Number)
const wantThemes = list("themes")
const coarse = flag("coarse")
/* `--textsize=large|largest` seeds the app's own accessibility text-size
   setting. Only "normal" was ever captured, and the app SHIPS a Largest
   option — so a defect that only exists there (four of five tab labels
   clipping to a prefix at 390) was in none of the hundred committed shots.
   Named in the output file so two sweeps do not overwrite each other. */
const textSize = option("textsize") ?? "normal"
/* `--probe=path/to/expr.js` evaluates one expression in every captured page
   and writes the results to `tools/shots/probe.json`.

   This exists so that verifying a specific claim — "the tab labels no longer
   clip", "the chip rail rests with its leading dissolve off" — does not need
   another copy of this file. Four 900-line forks of this tool were written in
   one review round to answer four such questions, and they were 90% identical
   to each other and to this. A question about the DOM is an expression; the
   harness around it is this file, once. */
const probeFile = option("probe")
const PROBE = probeFile === null ? null : fs.readFileSync(probeFile, "utf8")

const screens = SCREENS.filter((s) => !wantScreens || wantScreens.includes(s.name))
const widths = Object.keys(VIEWPORTS).map(Number).filter((w) => !wantWidths || wantWidths.includes(w))
const themes = THEMES.filter((t) => !wantThemes || wantThemes.includes(t))

/* ── The seed ─────────────────────────────────────────────────────────────
   Real manifests, from the `pack.json` beside each game in `dynawalla/games/`.

   A `pack.json` in the source tree is the AUTHORED manifest; three fields are
   added by the pack build after the archive exists and can only be known then
   (`schema`, `assets`, `download`). They are synthesised here, deterministically
   from the pack id, so the same seed produces the same screenshot twice and a
   diff between two runs is a change in the app rather than in the noise. The
   digest is a real SHA-256 — of the id, not of an archive — because the
   manifest parser requires 64 lower-case hex and rejects a placeholder. */

function seedManifests() {
  const dirs = fs
    .readdirSync(GAMES, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()

  const rows = []
  for (const dir of dirs) {
    const file = path.join(GAMES, dir, "pack.json")
    if (!fs.existsSync(file)) continue
    const authored = JSON.parse(fs.readFileSync(file, "utf8"))
    const digest = createHash("sha256").update(authored.id).digest("hex")
    // Plausible and stable: 180 kB–1.2 MB, spread by the digest so the "Space
    // used" figure and the per-card size are not all the same number.
    const bytes = 180 * 1024 + (parseInt(digest.slice(0, 6), 16) % (1024 * 1024))
    const manifest = {
      schema: 1,
      ...authored,
      assets: { files: 6 + (parseInt(digest.slice(6, 8), 16) % 40), bytes },
      download: { bytes: Math.max(1, Math.floor(bytes * 0.42)), sha256: digest },
    }
    // `build` is a pack-build field the manifest schema does not carry.
    delete manifest.build
    rows.push({ id: manifest.id, version: manifest.version, manifest: JSON.stringify(manifest), bytes })
  }
  if (rows.length === 0) throw new Error(`no pack.json under ${GAMES}`)
  return rows
}

function seedState(rows) {
  const now = new Date()
  const day = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`
  return {
    rows,
    day,
    // One game rested today. It changes exactly one word on one card, which is
    // the design's own claim — "not a lock and never drawn as one" — and a
    // capture is the only way to check it reads that way.
    resting: [rows[0]?.id].filter(Boolean),
    // Two named learners and one unnamed, because the unnamed case draws a
    // placeholder and is the one that looks wrong if it is wrong.
    profiles: [
      { id: "p1", name: "Amina" },
      { id: "p2", name: "Yusuf" },
      { id: "p3", name: "" },
    ],
  }
}

/* ── The bootstrap injected into the page ─────────────────────────────────
   Served as a FILE from the capture server, not inlined. The app ships under
   `script-src 'self'`, and a tool that only works because it injects an inline
   script is a tool that will not work the day the built index.html grows a CSP
   meta tag. Same origin, same rules as the app's own bundle. */

function bootstrapSource(seed) {
  return `/* generated by tools/capture.mjs — not committed */
(function () {
  var SEED = ${JSON.stringify(seed)};
  var q = new URLSearchParams(location.search);
  var theme = q.get("theme") === "dark" ? "dark" : "light";
  var developer = q.get("dev") === "1";
  // The accessibility text-size setting the app itself ships. Only "normal"
  // was ever seeded, so every defect that appears only at "large" or
  // "largest" — four of five tab labels clipping to a prefix, a settings
  // screen that scrolls again, a catalogue that collapses to one card — was
  // invisible to a hundred committed captures.
  var textSize = q.get("text") || "normal";

  function put(key, state, version) {
    try { localStorage.setItem(key, JSON.stringify({ state: state, version: version })); }
    catch (error) { console.error("[capture] could not seed " + key, error); }
  }

  try { localStorage.clear(); } catch (error) { console.error("[capture] clear failed", error); }

  // Device-scoped keys — dynawalla.<name>. See src/app/profile.ts.
  put("dynawalla.theme", { mode: theme }, 0);
  put("dynawalla.settings", {
    sound: true, haptics: true, reduceMotion: false,
    textSize: textSize, quality: "full", developer: developer,
  }, 1);
  put("dynawalla.profiles", { profiles: SEED.profiles, currentId: "p1" }, 1);
  put("dynawalla.packs", { installed: SEED.installed }, 1);
  put("dynawalla.pass", { pass: null, ledger: { day: SEED.day, resting: SEED.resting } }, 1);

  // Learner-scoped keys — dynawalla.<profileId>.<name>.
  put("dynawalla.p1.record", { answered: 1284, correct: 1102 }, 1);
  put("dynawalla.p1.world", { placed: 37 }, 1);
  put("dynawalla.p2.record", { answered: 96, correct: 71 }, 1);
  put("dynawalla.p2.world", { placed: 4 }, 1);

  // The native runtime, shimmed. \`isNative\` is a test for this object, so its
  // mere presence puts the app on its native path; the app then asks the four
  // questions below and no others. An unknown command REJECTS loudly rather
  // than resolving undefined — a silent resolve is how a capture ends up
  // showing a screen no device can produce.
  window.__TAURI_INTERNALS__ = {
    invoke: function (cmd) {
      if (cmd === "packs_list") return Promise.resolve(SEED.rows);
      if (cmd === "plugin:app|version") return Promise.resolve(SEED.version);
      if (cmd === "packs_catalog") return Promise.resolve(JSON.stringify({ packs: [] }));
      console.error("[capture] unshimmed native command: " + cmd);
      return Promise.reject(new Error("capture: no shim for " + cmd));
    },
    transformCallback: function (callback) {
      var id = "cb" + Math.random().toString(36).slice(2);
      window[id] = callback;
      return id;
    },
    unregisterCallback: function () {},
    convertFileSrc: function (file) { return file; },
  };
})();
`
}

/* ── Build ────────────────────────────────────────────────────────────────── */

function run(command, args, cwd) {
  const done = spawnSync(command, args, { cwd, stdio: "inherit" })
  if (done.status !== 0) throw new Error(`${command} ${args.join(" ")} failed (${String(done.status)})`)
}

function build() {
  if (flag("no-build")) {
    if (!fs.existsSync(DIST)) throw new Error("--no-build, but dist/ does not exist")
    console.log("· reusing dist/")
    return
  }
  console.log("· building the app")
  run(NPM, ["run", "build"], APP)
  console.log("· building the pass-sheet harness")
  // Failing here must not cost the other eight screens: the harness is a
  // second build with its own config, and the five destinations are the point.
  const done = spawnSync(NPM, ["exec", "--", "vite", "build", "--config", "tools/harness/vite.config.mjs"], {
    cwd: APP,
    stdio: "inherit",
  })
  if (done.status !== 0) console.error("! the harness build failed — pass-sheet screens will be skipped")
}

/* ── The server ───────────────────────────────────────────────────────────── */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
}

function serve(seed) {
  const bootstrap = bootstrapSource(seed)

  // dist/index.html, with one <script src> added as the first thing in <head>
  // so the seed and the shim are in place before the app's module runs.
  const inject = (file, src) => {
    const html = fs.readFileSync(file, "utf8")
    return html.replace(/<head([^>]*)>/i, `<head$1>\n    <script src="${src}"></script>`)
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    const route = url.pathname

    const send = (body, type, status = 200) => {
      res.writeHead(status, { "content-type": type, "cache-control": "no-store" })
      res.end(body)
    }

    try {
      if (route === "/__capture/bootstrap.js") return send(bootstrap, MIME[".js"])
      if (route === "/__capture/app.html") {
        return send(inject(path.join(DIST, "index.html"), "/__capture/bootstrap.js"), MIME[".html"])
      }
      if (route === "/__capture/pass.html") {
        return send(inject(path.join(HARNESS_DIST, "index.html"), "/__capture/bootstrap.js"), MIME[".html"])
      }

      // Static. The harness bundle is mounted under a prefix of its own; the
      // app owns the root, which is what its absolute /assets/ paths expect.
      const root = route.startsWith("/__harness/") ? HARNESS_DIST : DIST
      const rel = route.startsWith("/__harness/") ? route.slice("/__harness".length) : route
      const file = path.join(root, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""))
      if (!file.startsWith(root)) return send("no", "text/plain", 403)
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return send("not found", "text/plain", 404)
      return send(fs.readFileSync(file), MIME[path.extname(file)] ?? "application/octet-stream")
    } catch (error) {
      console.error("[capture] server", error)
      return send("error", "text/plain", 500)
    }
  })

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }))
  })
}

/* ── Chrome, over the DevTools protocol ───────────────────────────────────── */

const CHROME_CANDIDATES = [
  process.env["CHROME"],
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean)

function findChrome() {
  const found = CHROME_CANDIDATES.find((candidate) => fs.existsSync(candidate))
  if (!found) throw new Error(`no Chrome found. Tried:\n  ${CHROME_CANDIDATES.join("\n  ")}`)
  return found
}

function launchChrome() {
  const binary = findChrome()
  const profile = fs.mkdtempSync(path.join(process.env["TMPDIR"] ?? "/tmp", "dw-capture-"))
  const child = spawn(binary, [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-features=Translate,MediaRouter",
    "--force-color-profile=srgb",
    // Text that is hinted differently between runs is a diff nobody can read.
    "--font-render-hinting=none",
    // Big enough that no clamp is ever in play; the real viewport is set per
    // capture over CDP. See the header.
    "--window-size=1600,1200",
    "about:blank",
  ])

  return new Promise((resolve, reject) => {
    let buffered = ""
    const timer = setTimeout(() => reject(new Error("Chrome did not print a DevTools endpoint")), 30_000)
    child.stderr.on("data", (chunk) => {
      buffered += String(chunk)
      const hit = /DevTools listening on (ws:\/\/\S+)/.exec(buffered)
      if (hit) {
        clearTimeout(timer)
        resolve({ child, profile, wsUrl: hit[1] })
      }
    })
    child.on("exit", (code) => reject(new Error(`Chrome exited early (${String(code)})`)))
  })
}

async function connect(wsUrl) {
  const socket = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", () => reject(new Error("CDP socket failed")), { once: true })
  })

  let nextId = 0
  const pending = new Map()
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data)
    const waiting = pending.get(message.id)
    if (!waiting) return
    pending.delete(message.id)
    if (message.error) waiting.reject(new Error(`${message.method ?? ""} ${message.error.message}`))
    else waiting.resolve(message.result)
  })

  return {
    send(method, params = {}, sessionId) {
      const id = ++nextId
      const payload = sessionId ? { id, method, params, sessionId } : { id, method, params }
      socket.send(JSON.stringify(payload))
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
    },
    close: () => socket.close(),
  }
}

/* ── In-page measurement ──────────────────────────────────────────────────
   Everything below runs inside the page. It is a string on purpose: it is not
   part of the app, must never be bundled with it, and must be readable beside
   what it measures. */

const MEASURE = String.raw`(() => {
  const de = document.documentElement
  const vw = de.clientWidth
  const vh = de.clientHeight

  const describe = (el) => {
    const id = el.id ? "#" + el.id : ""
    const cls = typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\s+/).slice(0, 4).join(".")
      : ""
    return el.tagName.toLowerCase() + id + cls
  }

  /* ── colour ─────────────────────────────────────────────────────────── */
  const rgb = (value) => {
    const nums = (value.match(/[\d.]+/g) || []).map(Number)
    if (nums.length < 3) return null
    return { r: nums[0], g: nums[1], b: nums[2], a: nums.length > 3 ? nums[3] : 1 }
  }
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  })
  const lum = (c) => {
    const f = (v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const ratio = (a, b) => {
    const la = lum(a), lb = lum(b)
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  }
  /** The ground a run of text actually sits on: the first painted ancestor. */
  const groundOf = (el) => {
    let node = el
    let stack = []
    while (node && node !== document.documentElement.parentNode) {
      const bg = rgb(getComputedStyle(node).backgroundColor)
      if (bg && bg.a > 0) {
        stack.push(bg)
        if (bg.a >= 1) break
      }
      node = node.parentElement
    }
    let base = { r: 255, g: 255, b: 255, a: 1 }
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base)
    return base
  }

  /* ── the walk ───────────────────────────────────────────────────────── */
  const INTERACTIVE = 'a[href],button,input,select,textarea,summary,[role="button"],[role="tab"],[tabindex]:not([tabindex="-1"])'
  const escaping = []
  const small = []
  const scrollers = []
  const swatches = new Map()

  /* documentElement.scrollHeight is NOT the whole story in this app, and
     assuming it was hid the app's real scroller for a whole capture run.
     \`html, body { height: 100%; overflow-x: hidden }\` makes overflow-y compute
     to \`auto\` on BODY, so body becomes the scrolling box and the document
     element stays exactly one viewport tall no matter how long the catalogue
     is. Every box that actually scrolls is listed instead. */
  const scrollBoxes = [document.documentElement, document.body, ...document.querySelectorAll("*")]
  const seenBox = new Set()
  for (const el of scrollBoxes) {
    if (seenBox.has(el)) continue
    seenBox.add(el)
    const vertical = el.scrollHeight - el.clientHeight
    const sideways = el.scrollWidth - el.clientWidth
    if (vertical <= 1 && sideways <= 1) continue
    const style = getComputedStyle(el)
    if (style.overflowX === "visible" && style.overflowY === "visible") continue
    scrollers.push({
      el: el === document.documentElement ? "html" : el === document.body ? "body" : describe(el),
      vertical: Math.max(0, Math.round(vertical)),
      sideways: Math.max(0, Math.round(sideways)),
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      // A drawn track is one of the named web-view tells. scrollbar-width is
      // only suppressed under a coarse-pointer media query in this app, so on
      // a desktop — a first-class target — these tracks are painted.
      scrollbarWidth: style.scrollbarWidth,
    })
  }

  for (const el of document.querySelectorAll("*")) {
    const box = el.getBoundingClientRect()
    if (box.width === 0 && box.height === 0) continue
    const style = getComputedStyle(el)
    if (style.visibility === "hidden" || style.display === "none") continue

    // Escaping the viewport sideways. A tolerance of 1px absorbs subpixel
    // layout; anything more is a real overhang.
    if (box.right > vw + 1 || box.left < -1) {
      // Only the outermost offender is interesting: a wide row drags every
      // descendant with it and would otherwise print forty identical lines.
      const parent = el.parentElement
      const parentBox = parent ? parent.getBoundingClientRect() : null
      const parentEscapes = parentBox && (parentBox.right > vw + 1 || parentBox.left < -1)
      if (!parentEscapes) {
        escaping.push({ el: describe(el), left: Math.round(box.left), right: Math.round(box.right) })
      }
    }

    if (el.matches(INTERACTIVE) && !el.hasAttribute("disabled")) {
      const w = Math.round(box.width * 10) / 10
      const h = Math.round(box.height * 10) / 10
      if (w < 44 || h < 44) {
        small.push({
          el: describe(el),
          text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
          w, h,
        })
      }
    }
  }

  /* ── every text run, with the ground it is on ───────────────────────── */
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.nodeValue || "").trim()
    if (!text) continue
    const el = node.parentElement
    if (!el) continue
    const box = el.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) continue
    const style = getComputedStyle(el)
    if (style.visibility === "hidden") continue
    const ink = rgb(style.color)
    if (!ink) continue
    const ground = groundOf(el)
    const painted = ink.a < 1 ? over(ink, ground) : ink
    const size = parseFloat(style.fontSize)
    const weight = Number(style.fontWeight) || 400
    // 18.66px, or 14px bold — the WCAG "large text" boundary.
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const key = [
      Math.round(painted.r), Math.round(painted.g), Math.round(painted.b),
      Math.round(ground.r), Math.round(ground.g), Math.round(ground.b),
      size, weight,
    ].join("/")
    if (swatches.has(key)) { swatches.get(key).count++; continue }
    const value = Math.round(ratio(painted, ground) * 100) / 100
    swatches.set(key, {
      sample: text.slice(0, 40),
      color: "rgb(" + [painted.r, painted.g, painted.b].map(Math.round).join(" ") + ")",
      background: "rgb(" + [ground.r, ground.g, ground.b].map(Math.round).join(" ") + ")",
      fontSize: size,
      fontWeight: weight,
      largeText: large,
      ratio: value,
      passesAA: value >= (large ? 3 : 4.5),
      count: 1,
    })
  }

  return {
    viewport: { width: vw, height: vh, innerWidth: window.innerWidth },
    overflow: {
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      horizontal: de.scrollWidth - de.clientWidth,
      scrollHeight: de.scrollHeight,
      clientHeight: de.clientHeight,
    },
    scrollers,
    escaping: escaping.slice(0, 40),
    escapingCount: escaping.length,
    smallTargets: small.slice(0, 40),
    smallTargetCount: small.length,
    text: [...swatches.values()].sort((a, b) => a.ratio - b.ratio),
  }
})()`

/* ── The act sequences ────────────────────────────────────────────────────
   The pass sheet has three stages and only the first is on screen at load.
   Both transitions are driven the way an adult drives them: press "Grown-ups",
   then answer the gate. The gate is a *reading* challenge, not arithmetic
   (deliberately — see pass/parentalGate.ts), so the answer is on screen or is
   the current year, and both are computable here without reaching into the
   app's state. */

const ACTS = {
  gate: String.raw`(() => {
    const press = [...document.querySelectorAll("button")]
      .find((b) => /grown-ups/i.test(b.textContent || ""))
    if (!press) return "no Grown-ups control"
    press.click()
    return "ok"
  })()`,

  offer: String.raw`(() => {
    const open = [...document.querySelectorAll("button")]
      .find((b) => /grown-ups/i.test(b.textContent || ""))
    if (open) open.click()
    return "ok"
  })()`,

  // Run after the gate has painted. Kept separate because React needs a frame
  // between the click and the field existing.
  offerAnswer: String.raw`(() => {
    const field = document.querySelector("#pass-gate-entry")
    if (!field) return "no gate field"
    const shown = document.querySelector("#pass-gate-title")
    const word = [...document.querySelectorAll("p")]
      .map((p) => (p.textContent || "").trim())
      .find((t) => /^[A-Z]{10,}$/.test(t))
    const answer = word || String(new Date().getFullYear())
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(field, answer)
    field.dispatchEvent(new Event("input", { bubbles: true }))
    const form = field.closest("form")
    if (!form) return "no form"
    form.requestSubmit()
    void shown
    return "answered " + answer
  })()`,
}

/* ── Capture ──────────────────────────────────────────────────────────────── */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function evaluate(cdp, session, expression) {
  const result = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    session,
  )
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "evaluate threw")
  }
  return result.result.value
}

/** Wait until the app has actually drawn something, not merely loaded. */
async function settle(cdp, session, marker) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const ready = await evaluate(
      cdp,
      session,
      `document.readyState === "complete" && !!document.querySelector(${JSON.stringify(marker)})`,
    )
    if (ready) break
    await sleep(100)
  }
  // Two animation frames plus a beat: transitions in this app are 120–200ms
  // and a shot taken mid-transition is a shot of a colour that does not exist.
  await evaluate(
    cdp,
    session,
    `new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250))))`,
  )
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  for (const theme of themes) fs.mkdirSync(path.join(SHOTS, theme), { recursive: true })

  build()

  const rows = seedManifests()
  const state = seedState(rows)
  const version = JSON.parse(fs.readFileSync(path.join(APP, "package.json"), "utf8")).version
  const seed = {
    rows: state.rows,
    day: state.day,
    resting: state.resting,
    profiles: state.profiles,
    version,
    // What the registry mirror would already hold on a warm launch, so the
    // parent area's counts are right on the very first frame.
    installed: state.rows.map((row) => {
      const manifest = JSON.parse(row.manifest)
      return {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        bytes: row.bytes,
        sha256: manifest.download.sha256,
        installedAt: Date.now(),
        description: manifest.description,
        skills: manifest.covers.skills,
      }
    }),
  }
  console.log(`· seeded ${String(rows.length)} packs from ${GAMES}`)

  const { server, port } = await serve(seed)
  const { child, profile, wsUrl } = await launchChrome()
  const cdp = await connect(wsUrl)

  const harnessBuilt = fs.existsSync(path.join(HARNESS_DIST, "index.html"))
  if (!harnessBuilt) console.error("! no harness bundle — pass-sheet screens skipped")

  const measurements = {}
  const probed = {}
  const written = []
  const problems = []

  try {
    for (const theme of themes) {
      for (const screen of screens) {
        if (screen.kind === "harness" && !harnessBuilt) continue
        for (const width of widths) {
          const view = VIEWPORTS[width]
          const label = `${theme}/${screen.name}-${String(width)}`

          const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" })
          const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true })

          try {
            await cdp.send("Page.enable", {}, sessionId)
            await cdp.send(
              "Emulation.setDeviceMetricsOverride",
              {
                width,
                height: view.height,
                deviceScaleFactor: view.dsf,
                mobile: view.mobile,
                screenWidth: width,
                screenHeight: view.height,
              },
              sessionId,
            )
            // The theme is carried by the seeded store, not by the OS
            // preference — but a mismatch between the two is exactly how a
            // half-painted screen happens, so the OS is told the same thing.
            await cdp.send(
              "Emulation.setEmulatedMedia",
              { features: [{ name: "prefers-color-scheme", value: theme }] },
              sessionId,
            )
            if (coarse) {
              // `setEmitTouchEventsForMouse` alone changes what EVENTS fire and
              // does not move the pointer media queries — measured, the page
              // still reported `any-pointer: coarse` false, so a `--coarse` run
              // proved nothing about the scrollbar suppression it exists to
              // check. `setTouchEmulationEnabled` is what makes the device
              // report a touchscreen; both are set, because the app also cares
              // which events arrive.
              await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, sessionId)
              await cdp.send("Emulation.setEmitTouchEventsForMouse", { enabled: true, configuration: "mobile" }, sessionId)
            }

            const base = screen.kind === "harness" ? "/__capture/pass.html" : "/__capture/app.html"
            const query = `?theme=${theme}${screen.dev ? "&dev=1" : ""}${textSize === "normal" ? "" : `&text=${textSize}`}`
            const url = `http://127.0.0.1:${String(port)}${base}${query}${screen.hash ?? ""}`

            await cdp.send("Page.navigate", { url }, sessionId)
            await settle(cdp, sessionId, screen.kind === "harness" ? '[role="dialog"]' : "nav")

            if (screen.act === "gate") {
              await evaluate(cdp, sessionId, ACTS.gate)
              await settle(cdp, sessionId, "#pass-gate-entry")
            }
            if (screen.act === "offer") {
              await evaluate(cdp, sessionId, ACTS.offer)
              await settle(cdp, sessionId, "#pass-gate-entry")
              const said = await evaluate(cdp, sessionId, ACTS.offerAnswer)
              await settle(cdp, sessionId, "#pass-offer-title")
              if (!String(said).startsWith("answered")) problems.push(`${label}: gate — ${String(said)}`)
            }

            const measured = await evaluate(cdp, sessionId, MEASURE)
            if (PROBE !== null) probed[`${label}${textSize === "normal" ? "" : `-${textSize}`}`] = await evaluate(cdp, sessionId, PROBE)

            // The clamp check. If this ever fires, the viewport override lost
            // to something and every shot in the run is a lie — see the header.
            if (measured.viewport.width !== width) {
              throw new Error(
                `viewport clamped: asked ${String(width)}, rendered ${String(measured.viewport.width)}`,
              )
            }

            const shot = await cdp.send(
              "Page.captureScreenshot",
              screen.full
                ? { format: "png", captureBeyondViewport: true, optimizeForSpeed: false }
                : { format: "png", optimizeForSpeed: false },
              sessionId,
            )
            // The text size is in the filename and in the measurement key, so a
            // `--textsize=largest` sweep sits BESIDE the normal one instead of
            // overwriting it. A defect that only exists at one text size has to
            // be comparable against the size where it does not.
            const suffix = textSize === "normal" ? "" : `-${textSize}`
            const file = path.join(SHOTS, theme, `${screen.name}-${String(width)}${suffix}.png`)
            fs.writeFileSync(file, Buffer.from(shot.data, "base64"))
            written.push(file)

            measurements[`${label}${suffix}`] = {
              screen: screen.name,
              textSize,
              theme,
              width,
              height: view.height,
              url,
              ...measured,
            }

            const flags = []
            if (measured.overflow.horizontal > 0) flags.push(`h-scroll ${String(measured.overflow.horizontal)}px`)
            if (measured.escapingCount > 0) flags.push(`${String(measured.escapingCount)} escaping`)
            if (measured.smallTargetCount > 0) flags.push(`${String(measured.smallTargetCount)} small`)
            const fails = measured.text.filter((t) => !t.passesAA).length
            if (fails > 0) flags.push(`${String(fails)} AA fail`)
            console.log(`  ${label}${flags.length ? "  ⟨" + flags.join(", ") + "⟩" : ""}`)
          } catch (error) {
            problems.push(`${label}: ${error.message}`)
            console.error(`  ${label}  FAILED — ${error.message}`)
          } finally {
            await cdp.send("Target.closeTarget", { targetId }).catch(() => undefined)
          }
        }
      }
    }
  } finally {
    cdp.close()
    server.close()
    // Wait for the process to actually go before removing its profile: Chrome
    // is still flushing that directory when `kill` returns, and `rmSync` loses
    // the race with ENOTEMPTY — after a completely successful run, which is the
    // worst possible moment to throw.
    const exited = new Promise((resolve) => child.once("exit", resolve))
    child.kill()
    await Promise.race([exited, sleep(5000)])
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch (error) {
      console.error(`! left ${profile} behind — ${error.message}`)
    }
  }

  // MERGED, never replaced, and this is not tidiness. `--only=packs` used to
  // overwrite the file with its ten keys, which silently erased the ninety
  // numbers behind every per-screen claim in the write-ups beside it — a
  // reviewer opening `measurements.json` found evidence for one screen and no
  // record that the rest had ever been measured. Old entries for a screen this
  // run DID capture are replaced; entries for screens it did not touch survive,
  // and each carries the timestamp of the run that produced it.
  const measuredAt = new Date().toISOString()
  const previous = (() => {
    try {
      const held = JSON.parse(fs.readFileSync(path.join(SHOTS, "measurements.json"), "utf8"))
      return held && typeof held.screens === "object" ? held.screens : {}
    } catch {
      return {}
    }
  })()
  const allScreens = { ...previous }
  for (const [key, value] of Object.entries(measurements)) {
    allScreens[key] = { ...value, measuredAt }
  }

  fs.writeFileSync(
    path.join(SHOTS, "measurements.json"),
    JSON.stringify(
      {
        capturedAt: measuredAt,
        appVersion: version,
        packs: rows.length,
        note: "env(safe-area-inset-*) is 0 here; Chrome is a fine pointer, so the app's coarse-pointer scrollbar suppression is not in effect. Entries are MERGED across runs — `measuredAt` on each says when that screen was last actually captured.",
        problems,
        screens: allScreens,
      },
      null,
      2,
    ) + "\n",
  )

  if (PROBE !== null) {
    const out = path.join(SHOTS, "probe.json")
    fs.writeFileSync(out, JSON.stringify(probed, null, 2) + "\n")
    console.log(`probe → ${out}`)
  }

  console.log(`\n${String(written.length)} shots → ${SHOTS}`)
  console.log(`measurements → ${path.join(SHOTS, "measurements.json")}`)
  if (problems.length > 0) {
    console.error(`\n${String(problems.length)} problem(s):`)
    for (const problem of problems) console.error(`  ${problem}`)
    process.exitCode = 1
  }
}

await main()
