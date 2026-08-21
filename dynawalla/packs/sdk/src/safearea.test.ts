/**
 * The safe area, for the WHOLE FLEET, on every pull request.
 *
 * ## Why this file exists
 *
 * `env(safe-area-inset-*)` resolves to ZERO inside a pack. A pack runs in an
 * iframe sandboxed `allow-scripts` with deliberately no `allow-same-origin`;
 * `env()` belongs to the top-level browsing context, and a cross-origin child
 * gets nothing, so every rule that reaches for one silently collapses to its
 * fallback. It looks perfect in a browser tab and ships a HUD under the status
 * bar.
 *
 * That defect has now been found FIVE TIMES, each time by the founder, on a
 * device, with a green test suite behind it:
 *
 *   * SIEGE — the stats row under the status bar and the overcharge meter 38px
 *     into the navigation bar. Its canvas half was right, because `mount.ts`
 *     used the host's `safeInsets()`; its CSS half asked the browser. The two
 *     halves of one game disagreed about where the screen was.
 *   * MONUMENT — `.mn-tools { bottom: 12 }` became 60 only after a device
 *     report: a 40px sound button entirely inside the navigation bar. Its
 *     geometry was owned in two dialects, numbers for the test and
 *     `calc(env(...))` for the stylesheet, and only the tested one was right.
 *   * POLARITY — `.pol-hud` padded all four edges with `env()` since its FIRST
 *     COMMIT, so `hudRects` described a HUD that was never drawn.
 *   * CLAIM — a flat `padding: 20px` on a full-screen card, and a mute button
 *     pinned 10px from the bottom of the glass.
 *   * ABYSSAL BLOOM — `.ab-badge { bottom: 6px }`. This one never mentioned the
 *     safe area at all, so there was no text for anybody to search for.
 *
 * Each was fixed in its own pack. Nothing stopped the sixth. **That is what
 * this file is: the thing that stops the sixth.**
 *
 * ## Why it is HERE
 *
 * `dynawalla_packs` is `^dynawalla/(games|packs)/`, and the SDK's `npm test` is
 * the first thing that job runs. A guard that does not run on the change it
 * guards against is not a guard. Discovery is a glob, exactly as in
 * `fleet.test.ts` and `packs/build.mjs`: adding the thousandth pack is adding a
 * directory, and a hand-written list here would be one more register to forget.
 *
 * ## What it does NOT do
 *
 * It does not search for text and call that proof. SIEGE's own test asserted
 * `body.includes("env(safe-area-inset-top")` — a substring search that was TRUE
 * on the day the currency shipped under an Android clock. The rule was in the
 * file; the rule resolved to zero.
 *
 * So the stylesheet half of this file PARSES each pack's shipped CSS, runs the
 * cascade at ten real viewports with real insets, expands `padding:` shorthands
 * the way the box model does, and evaluates the winning declaration to a NUMBER
 * with `env(safe-area-inset-*)` defined as zero — because that is the
 * environment, not a simplification. See
 * `packs/shared/game-chrome/cssSafeArea.ts`.
 *
 * Two of the checks below ARE text checks, and are labelled as such: whether a
 * pack ever calls the publisher, and whether it ever subscribes. Neither can be
 * evaluated without mounting the game, and both are the kind of omission that
 * has no other symptom until a device shows one.
 */

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  SAFE_PREFIX,
  SIDES,
  safeVar,
} from "../../shared/game-chrome/insets.ts"
import { auditStylesheet, SHAPES, type Violation } from "../../shared/game-chrome/cssSafeArea.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const gamesRoot = path.resolve(here, "../../../games")

/* ── discovery ───────────────────────────────────────────────────────────── */

type Pack = {
  readonly name: string
  readonly dir: string
  /** Every file that reaches a device: sources, stylesheets, the entry document. */
  readonly shipped: readonly string[]
}

const isTest = (file: string): boolean => /\.test\.[cm]?[jt]sx?$/.test(file)

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  )) {
    if (entry.name === "node_modules" || entry.name === "dist-pack" || entry.name === "dist") {
      continue
    }
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.isFile()) out.push(full)
  }
  return out
}

/**
 * Every pack, and every file in it that a child's device will actually load.
 *
 * `index.html` is the dev harness and never ships, but it is included anyway:
 * it is where a `env()` gets written before being copied into `pack.html`, and
 * a rule that is wrong in the harness is a rule somebody will paste.
 *
 * Test files are excluded, and must be — several of them contain
 * `env(safe-area-inset-…)` inside the assertion that FORBIDS it, and a gate
 * that fires on its own error message is a gate that gets deleted.
 */
function fleet(): readonly Pack[] {
  const out: Pack[] = []
  for (const entry of fs.readdirSync(gamesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.join(gamesRoot, entry.name)
    if (!fs.existsSync(path.join(dir, "pack.json"))) continue
    const shipped = [
      ...walk(path.join(dir, "src")).filter(
        (f) => !isTest(f) && /\.(ts|tsx|js|mjs|css|html)$/.test(f),
      ),
      ...["pack.html", "index.html"].map((f) => path.join(dir, f)).filter((f) => fs.existsSync(f)),
    ]
    out.push({ name: entry.name, dir, shipped })
  }
  return out.sort((a, b) => (a.name < b.name ? -1 : 1))
}

const PACKS = fleet()
const rel = (file: string): string => path.relative(path.resolve(gamesRoot, ".."), file)

test("the glob still finds the fleet", () => {
  // Without this, every assertion below passes on an empty list the day the
  // games move, and this file reports green forever while the defect it exists
  // to stop walks straight back in. `fleet.test.ts` next door carries the same
  // guard for the same reason.
  assert.ok(
    PACKS.length >= 24,
    `expected the fleet under ${gamesRoot}, found ${PACKS.length} pack.json directories`,
  )
  for (const pack of PACKS) {
    assert.ok(
      pack.shipped.length > 0,
      `${pack.name} has pack.json but no shipped source — this walker has gone stale`,
    )
  }
})

/* ── 1. no rule may take its answer from env() ───────────────────────────── */

/** The one form in which a pack may mention the safe area, per side. */
const SANCTIONED = new Set(SIDES.map((side) => safeVar(side)))

type Offence = { pack: string; file: string; line: number; text: string }

/**
 * Every `env(safe-area-inset-…)` in a file that is not, character for
 * character, `var(--dw-safe-<side>, env(safe-area-inset-<side>, 0px))`.
 *
 * Comments are stripped first — both `/* … *\/` and `//` — because every one of
 * these packs explains this defect in prose above the code that avoids it, and
 * a gate that fires on the explanation teaches people to stop writing the
 * explanation.
 */
function offences(pack: Pack, file: string): Offence[] {
  const raw = fs.readFileSync(file, "utf8")
  const stripped = raw
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  const out: Offence[] = []
  for (const m of stripped.matchAll(/env\(\s*safe-area-inset-(top|right|bottom|left)[^)]*\)/g)) {
    const side = m[1] as (typeof SIDES)[number]
    const at = m.index
    const whole = `var(${SAFE_PREFIX}${side}, ${m[0]})`
    const before = stripped.slice(Math.max(0, at - `var(${SAFE_PREFIX}${side}, `.length), at)
    const ok = before === `var(${SAFE_PREFIX}${side}, ` && SANCTIONED.has(whole)
    if (ok) continue
    out.push({
      pack: pack.name,
      file: rel(file),
      line: stripped.slice(0, at).split("\n").length,
      text: raw.split("\n")[stripped.slice(0, at).split("\n").length - 1]?.trim() ?? m[0],
    })
  }
  return out
}

test("no pack takes its answer from env() — it is the number zero where packs run", () => {
  const bad: Offence[] = []
  for (const pack of PACKS) for (const file of pack.shipped) bad.push(...offences(pack, file))
  assert.equal(
    bad.length,
    0,
    `${bad.length} unsanctioned env(safe-area-inset-*) reference(s). Inside a pack frame ` +
      `every one of them is the number ZERO.\n\n` +
      bad.map((b) => `  ${b.pack}  ${b.file}:${b.line}\n    ${b.text}`).join("\n") +
      `\n\nThe only permitted form is the shared one, which the host publishes into:\n` +
      `    ${safeVar("top")}\n` +
      `Interpolate safeVar("top") from packs/shared/game-chrome rather than typing it.`,
  )
})

/* ── 2. the stylesheets, parsed and evaluated ────────────────────────────── */

/**
 * Pull every CSS-bearing template literal out of a TypeScript source.
 *
 * These packs hold their stylesheets three ways: a `.css` file (five of them),
 * a `<style>` block in `pack.html` (all of them, for the document reset), and a
 * tagged-nothing template literal in a `.ts` module (nearly all of them, and it
 * is where ABYSSAL BLOOM's defect lived). The third kind is the only one a test
 * cannot simply read off disk, because `${HUD_TOP}px` is not a length until
 * something evaluates it.
 *
 * So the rule is: **CSS held in TypeScript must be EXPORTED.** One word,
 * `export`, and the audit can import the module and see the same string the
 * browser sees, interpolations and all. A stylesheet no gate can read is a
 * stylesheet the gate is not checking, and four of the five defects above lived
 * in exactly such a stylesheet.
 */
function cssLiterals(source: string): { name: string; exported: boolean }[] {
  const out: { name: string; exported: boolean }[] = []
  const decl = /(export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::\s*[\w<>[\]| ]+\s*)?=\s*`/g
  for (const m of source.matchAll(decl)) {
    const open = (m.index ?? 0) + m[0].length
    // Scan to the matching backtick, stepping over `${ … }` — which can itself
    // contain a nested template literal, and does in several packs.
    let i = open
    let depth = 0
    let end = -1
    while (i < source.length) {
      const ch = source[i]
      if (ch === "\\") {
        i += 2
        continue
      }
      if (ch === "$" && source[i + 1] === "{") {
        depth++
        i += 2
        continue
      }
      if (ch === "}" && depth > 0) {
        depth--
        i++
        continue
      }
      if (ch === "`" && depth === 0) {
        end = i
        break
      }
      i++
    }
    if (end < 0) continue
    const body = source.slice(open, end)
    // A CSS rule: a selector at the start of a line, then a brace, then a
    // declaration. Deliberately narrow — an SQL string or a shader also has
    // braces, and neither is a stylesheet.
    if (!/^[\t ]*[.#@:a-zA-Z][^\n{}]*\{[^}]*[a-z-]+\s*:/m.test(body)) continue
    out.push({ name: m[2] as string, exported: Boolean(m[1]) })
  }
  return out
}

/** Every stylesheet of one pack, as text with every interpolation resolved. */
async function stylesheetsOf(pack: Pack): Promise<{ where: string; css: string }[]> {
  const sheets: { where: string; css: string }[] = []
  for (const file of pack.shipped) {
    // `index.html` is the dev harness: it is a browser tab, it is the TOP-LEVEL
    // browsing context, and its own chrome never reaches a child. It stays in
    // the `env()` scan above — a rule written there is a rule somebody pastes
    // into `pack.html` — but its layout is not a promise to anybody.
    if (path.basename(file) === "index.html") continue
    if (file.endsWith(".css")) {
      sheets.push({ where: rel(file), css: fs.readFileSync(file, "utf8") })
      continue
    }
    if (file.endsWith(".html")) {
      for (const m of fs.readFileSync(file, "utf8").matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
        sheets.push({ where: `${rel(file)} <style>`, css: m[1] as string })
      }
      continue
    }
    if (!/\.(ts|tsx|js|mjs)$/.test(file)) continue
    const source = fs.readFileSync(file, "utf8")
    const literals = cssLiterals(source)
    if (literals.length === 0) continue
    const hidden = literals.filter((l) => !l.exported).map((l) => l.name)
    assert.deepEqual(
      hidden,
      [],
      `${rel(file)} holds a stylesheet in ${hidden.join(", ")} without exporting it, so no ` +
        `gate can read what it resolves to. Add \`export\` — ABYSSAL BLOOM's ` +
        `\`.ab-badge { bottom: 6px }\` sat inside a 48px navigation bar in exactly such a ` +
        `constant, and nothing could see it.`,
    )
    let module: Record<string, unknown>
    try {
      module = (await import(pathToFileURL(file).href)) as Record<string, unknown>
    } catch (e) {
      assert.fail(
        `${rel(file)} holds a stylesheet but does not import in node: ${String(e).split("\n")[0]}\n` +
          `Move the CSS into a module of its own that imports cleanly. A stylesheet the fleet ` +
          `gate cannot evaluate is a stylesheet nothing is checking.`,
      )
    }
    for (const { name } of literals) {
      const value = module[name]
      assert.equal(
        typeof value,
        "string",
        `${rel(file)} exports ${name}, but it is not a string at run time`,
      )
      sheets.push({ where: `${rel(file)} ${name}`, css: value as string })
    }
  }
  return sheets
}

const report = (where: string, violations: readonly Violation[]): string =>
  violations.map((v) => `  ${where}\n    ${v.rule}: ${v.message}`).join("\n\n")

for (const pack of PACKS) {
  test(`${pack.name}: every shipped stylesheet clears the safe area at every shape`, async () => {
    const sheets = await stylesheetsOf(pack)
    assert.ok(
      sheets.length > 0,
      `${pack.name} ships no stylesheet this gate can read. Every pack has at least the ` +
        `document reset in pack.html, so this means the walker has gone stale.`,
    )
    const found: string[] = []
    for (const { where, css } of sheets) {
      const violations = auditStylesheet(css, SHAPES)
      if (violations.length > 0) found.push(report(where, violations))
    }
    assert.deepEqual(
      found,
      [],
      `${pack.name} has ${found.length} stylesheet(s) that put chrome outside the safe ` +
        `rectangle:\n\n${found.join("\n\n")}\n`,
    )
  })
}

/* ── 3. the wiring: published, and re-published ──────────────────────────── */

/**
 * Everything a pack ships, as one string, comments removed.
 *
 * The two assertions below are WIRING checks and nothing more: they ask whether
 * a call appears at all. That is a weaker question than the stylesheet audit
 * asks, and it is asked anyway because the omission it catches — never calling
 * the publisher, or calling it once at mount and never again — has no symptom
 * until a device shows one. MERGE never called `onInsetsChange`, so its HUD was
 * laid out against the probe's zeros and stayed there: the host's real insets
 * arrive AFTER the first layout, over the settings channel, and nothing asked
 * again.
 */
function shippedText(pack: Pack): string {
  return pack.shipped
    .filter((f) => /\.(ts|tsx|js|mjs)$/.test(f))
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
}

test("every pack asks the shared module where the screen is (wiring)", () => {
  // The failure this catches is the quietest one of all: a pack that never
  // mentions the safe area anywhere. It has no wrong rule to find and no `env()`
  // to flag — it simply lays out as though the glass were the screen. Every one
  // of these games declares `viewport-fit=cover` in its `pack.html`, which opts
  // the document INTO the notch, the home indicator and the rounded corners; a
  // game that then never reads the insets back has taken the unsafe region on
  // purpose and ignored it.
  const bad: string[] = []
  for (const pack of PACKS) {
    const text = shippedText(pack)
    const asks = ["installSafeArea(", "safeInsets(", "safeRect(", "SAFE_VARS"].some((call) =>
      text.includes(call),
    )
    if (asks) continue
    bad.push(
      `${pack.name}: nothing in this pack asks where the safe rectangle is. It declares ` +
        `viewport-fit=cover, so it has opted into the notch and the home indicator — call ` +
        `installSafeArea(root, …) or safeRect(w, h) from packs/shared/game-chrome.`,
    )
  }
  assert.deepEqual(bad, [], bad.join("\n"))
})

test("a pack whose CSS reads the safe area also publishes it (wiring)", () => {
  const bad: string[] = []
  for (const pack of PACKS) {
    const text = shippedText(pack)
    const usesVar = pack.shipped.some((f) => fs.readFileSync(f, "utf8").includes(SAFE_PREFIX))
    if (!usesVar) continue
    if (text.includes("installSafeArea(") || text.includes("publishSafeVars(")) continue
    bad.push(
      `${pack.name}: its stylesheet reads ${SAFE_PREFIX}* but nothing in the pack publishes ` +
        `it. An unpublished custom property falls through to the env() behind it, which ` +
        `inside a pack frame is the number zero — indistinguishable from a correct zero ` +
        `right up until a child picks up a phone with a notch.`,
    )
  }
  assert.deepEqual(bad, [], bad.join("\n"))
})

test("a pack that reads the insets also subscribes to them changing (wiring)", () => {
  const bad: string[] = []
  for (const pack of PACKS) {
    const text = shippedText(pack)
    const reads =
      text.includes("safeInsets(") || text.includes("safeRect(") || text.includes(SAFE_PREFIX)
    if (!reads) continue
    if (text.includes("installSafeArea(") || text.includes("onInsetsChange(")) continue
    bad.push(
      `${pack.name}: it reads the safe area once and never asks again. The host's insets ` +
        `arrive AFTER the first layout, and iPadOS changes them in Split View without ` +
        `moving the canvas box. Call installSafeArea(root, …) — it publishes, subscribes ` +
        `and hands the numbers to the canvas in one call — and dispose it on unmount.`,
    )
  }
  assert.deepEqual(bad, [], bad.join("\n"))
})

test("the shapes include the device the defect keeps being found on", () => {
  // A viewport matrix a pack could quietly shrink is a matrix that shrinks. The
  // founder's phone is 1080x2340 at dpr 2.75 — 393x851 CSS px — with a 24dp
  // status bar and a 48dp three-button navigation bar, and on Android a CSS
  // pixel IS a dp.
  const founder = SHAPES.find((s) => s.w === 393 && s.h === 851)
  assert.ok(founder, "the founder's phone is no longer in SHAPES")
  assert.deepEqual(founder?.insets, { top: 24, right: 0, bottom: 48, left: 0 })
  assert.ok(
    SHAPES.some((s) => s.w === 320 && s.h === 568),
    "the smallest phone anyone still holds is no longer in SHAPES",
  )
  assert.ok(
    SHAPES.some((s) => s.insets.top === 47 || s.insets.left === 47),
    "no notched shape is left in SHAPES",
  )
  assert.ok(
    SHAPES.some((s) => s.w >= 1024 && s.w > s.h) && SHAPES.some((s) => s.h > s.w && s.w >= 768),
    "SHAPES has lost a tablet in one orientation",
  )
  assert.ok(
    SHAPES.some((s) => s.w > s.h && s.insets.right > 0) &&
      SHAPES.some((s) => s.w > s.h && s.insets.left > 0),
    "SHAPES no longer covers a navigation bar on each side in landscape",
  )
})
